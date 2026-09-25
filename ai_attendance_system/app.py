import os
import cv2
import pickle
import sqlite3
import datetime
import numpy as np
from flask import Flask, render_template, request, redirect, url_for, Response, jsonify, send_file
import io
import csv

# Optional face_recognition import with graceful fallback
try:
    import face_recognition
    FACE_REC_AVAILABLE = True
except ImportError:
    FACE_REC_AVAILABLE = False
    print("Warning: face_recognition not installed. Please install via requirements.txt.")

app = Flask(__name__)
app.secret_key = "attendance_secret_key_ai_system"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
ENCODINGS_DIR = os.path.join(BASE_DIR, "face_encodings")
ENCODING_FILE = os.path.join(ENCODINGS_DIR, "encodings.pickle")

os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(ENCODINGS_DIR, exist_ok=True)

# Global variables for cached encodings and camera
known_face_encodings = []
known_face_ids = []
known_face_names = []
latest_recognition_event = {"name": "No face", "id": "-", "status": "Waiting for camera", "timestamp": ""}
camera = None

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at TEXT NOT NULL,
            sample_count INTEGER DEFAULT 0
        )
    """)
    
    # 2. Face encodings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS face_encodings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            encoding_blob BLOB NOT NULL,
            sample_index INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
    """)
    
    # 3. Attendance records table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            confidence REAL DEFAULT 0.0,
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    """)
    
    conn.commit()
    conn.close()

def load_all_encodings():
    """Load all known face encodings from SQLite into memory for fast real-time matching."""
    global known_face_encodings, known_face_ids, known_face_names
    known_face_encodings = []
    known_face_ids = []
    known_face_names = []
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.user_id, u.name, fe.encoding_blob 
        FROM face_encodings fe
        JOIN users u ON fe.user_id = u.user_id
    """)
    rows = cursor.fetchall()
    for row in rows:
        try:
            encoding = pickle.loads(row["encoding_blob"])
            known_face_encodings.append(encoding)
            known_face_ids.append(row["user_id"])
            known_face_names.append(row["name"])
        except Exception as e:
            print(f"Error loading encoding for {row['user_id']}: {e}")
    conn.close()
    print(f"Loaded {len(known_face_encodings)} face encodings for {len(set(known_face_ids))} users.")

def mark_attendance_in_db(user_id, name, confidence=0.95):
    """Marks attendance if not already marked for today."""
    global latest_recognition_event
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    now_time = datetime.datetime.now().strftime("%H:%M:%S")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM attendance WHERE user_id = ? AND date = ?", (user_id, today_str))
    existing = cursor.fetchone()
    
    if existing:
        latest_recognition_event = {
            "name": name,
            "id": user_id,
            "status": "Already Marked Today",
            "timestamp": now_time,
            "confidence": f"{int(confidence * 100)}%"
        }
        conn.close()
        return False, "Already marked today"
    
    cursor.execute("""
        INSERT INTO attendance (user_id, name, date, time, status, confidence)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, name, today_str, now_time, "Present", confidence))
    conn.commit()
    conn.close()
    
    latest_recognition_event = {
        "name": name,
        "id": user_id,
        "status": "Marked Present",
        "timestamp": now_time,
        "confidence": f"{int(confidence * 100)}%"
    }
    return True, "Marked successfully"

def get_camera():
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return camera

def gen_frames():
    """Generates camera frames with face detection, bounding boxes, and attendance marking."""
    global latest_recognition_event
    cam = get_camera()
    
    # Load Haar cascade as fast fallback or primary face detector
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    process_this_frame = True
    
    while True:
        success, frame = cam.read()
        if not success:
            # Generate dummy test frame with message if camera fails
            blank_image = np.zeros((480, 640, 3), np.uint8)
            cv2.putText(blank_image, "Camera not available or busy", (80, 240), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            ret, buffer = cv2.imencode('.jpg', blank_image)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            continue
        
        # Mirror frame horizontally for natural webcam feel
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        
        # Resize frame to 1/4 size for faster face recognition processing
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        face_names_in_frame = []
        face_locations_scaled = []
        
        if process_this_frame:
            if FACE_REC_AVAILABLE and len(known_face_encodings) > 0:
                face_locations = face_recognition.face_locations(rgb_small_frame)
                face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
                
                for face_encoding, (top, right, bottom, left) in zip(face_encodings, face_locations):
                    matches = face_recognition.compare_faces(known_face_encodings, face_encoding, tolerance=0.48)
                    name = "Unknown Person"
                    user_id = ""
                    confidence = 0.0
                    
                    face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
                    if len(face_distances) > 0:
                        best_match_index = np.argmin(face_distances)
                        if matches[best_match_index]:
                            name = known_face_names[best_match_index]
                            user_id = known_face_ids[best_match_index]
                            confidence = max(0.5, 1.0 - float(face_distances[best_match_index]))
                            # Mark attendance automatically
                            mark_attendance_in_db(user_id, name, confidence)
                    
                    face_names_in_frame.append((name, user_id, confidence))
                    face_locations_scaled.append((top * 4, right * 4, bottom * 4, left * 4))
            else:
                # Haar Cascade fallback for face detection
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))
                for (x, y, fw, fh) in faces:
                    face_locations_scaled.append((y, x + fw, y + fh, x))
                    face_names_in_frame.append(("Detecting Face...", "", 0.75))
        
        process_this_frame = not process_this_frame
        
        # Draw bounding boxes and text HUD on frame
        for (top, right, bottom, left), (name, uid, conf) in zip(face_locations_scaled, face_names_in_frame):
            is_known = name not in ["Unknown Person", "Detecting Face..."]
            color = (34, 197, 94) if is_known else (59, 130, 246) if name == "Detecting Face..." else (0, 0, 239) # BGR
            
            # Corner brackets for modern HUD look
            corner_len = int(min(right - left, bottom - top) * 0.2)
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            # Thicker corner brackets
            cv2.line(frame, (left, top), (left + corner_len, top), color, 4)
            cv2.line(frame, (left, top), (left, top + corner_len), color, 4)
            cv2.line(frame, (right, top), (right - corner_len, top), color, 4)
            cv2.line(frame, (right, top), (right, top + corner_len), color, 4)
            cv2.line(frame, (left, bottom), (left + corner_len, bottom), color, 4)
            cv2.line(frame, (left, bottom), (left, bottom - corner_len), color, 4)
            cv2.line(frame, (right, bottom), (right - corner_len, bottom), color, 4)
            cv2.line(frame, (right, bottom), (right, bottom - corner_len), color, 4)
            
            # Badge header
            label = f"{name} ({uid})" if uid else name
            if conf > 0:
                label += f" [{int(conf * 100)}%]"
            
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            cv2.rectangle(frame, (left, bottom + 2), (left + tw + 16, bottom + th + 18), color, cv2.FILLED)
            cv2.putText(frame, label, (left + 8, bottom + th + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
            
        # Draw timestamp and status watermark
        cv2.putText(frame, f"LIVE REC: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
                    (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)
        cv2.putText(frame, f"Registered: {len(set(known_face_ids))} users", 
                    (15, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

# ----------------- FLASK ROUTES ----------------- #

@app.route('/')
def index():
    """Live Recognition View"""
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM attendance WHERE date = ? ORDER BY id DESC LIMIT 5", (today_str,))
    recent_attendance = cursor.fetchall()
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) as total FROM users")
    total_users = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) as present FROM attendance WHERE date = ?", (today_str,))
    present_today = cursor.fetchone()["present"]
    
    conn.close()
    return render_template("index.html", 
                           recent_attendance=recent_attendance, 
                           total_users=total_users, 
                           present_today=present_today,
                           today=today_str)

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/dashboard')
def dashboard():
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM users")
    total_users = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) as present FROM attendance WHERE date = ?", (today_str,))
    present_today = cursor.fetchone()["present"]
    
    pct = round((present_today / total_users * 100), 1) if total_users > 0 else 0
    
    cursor.execute("SELECT * FROM attendance ORDER BY id DESC LIMIT 15")
    records = cursor.fetchall()
    
    # 7-day stats for chart/trend
    cursor.execute("""
        SELECT date, COUNT(DISTINCT user_id) as count 
        FROM attendance 
        GROUP BY date 
        ORDER BY date DESC LIMIT 7
    """)
    daily_stats = cursor.fetchall()
    
    conn.close()
    return render_template("dashboard.html", 
                           total_users=total_users, 
                           present_today=present_today, 
                           attendance_pct=pct, 
                           records=records,
                           daily_stats=daily_stats)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template("register.html")
    
    name = request.form.get("name", "").strip()
    user_id = request.form.get("user_id", "").strip().upper()
    email = request.form.get("email", "").strip().lower()
    
    if not name or not user_id or not email:
        return render_template("register.html", error="All fields are required!")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE user_id = ?", (user_id,))
    if cursor.fetchone():
        conn.close()
        return render_template("register.html", error=f"User ID '{user_id}' already exists!")
    
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO users (user_id, name, email, created_at, sample_count)
        VALUES (?, ?, ?, ?, 0)
    """, (user_id, name, email, now_str))
    conn.commit()
    conn.close()
    
    # Redirect to face capture phase
    return redirect(url_for('capture', user_id=user_id))

@app.route('/capture')
def capture():
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return redirect(url_for('register'))
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return redirect(url_for('register'))
        
    return render_template("capture.html", user=user)

@app.route('/api/save_face_sample', methods=['POST'])
def save_face_sample():
    """Captures and encodes a face sample from base64 webcam image."""
    data = request.get_json()
    if not data or 'image' not in data or 'user_id' not in data:
        return jsonify({"success": False, "message": "Invalid request payload"}), 400
    
    user_id = data['user_id']
    sample_index = data.get('sample_index', 1)
    
    # Decode base64 image
    import base64
    img_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
    image_bytes = base64.b64decode(img_data)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_cv is None:
        return jsonify({"success": False, "message": "Failed to decode image"}), 400
        
    # Save image to dataset folder
    user_dir = os.path.join(DATASET_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    img_path = os.path.join(user_dir, f"sample_{sample_index}.jpg")
    cv2.imwrite(img_path, img_cv)
    
    # Generate face encoding
    encoding_saved = False
    if FACE_REC_AVAILABLE:
        rgb_img = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
        boxes = face_recognition.face_locations(rgb_img)
        if len(boxes) == 0:
            return jsonify({"success": False, "message": "No face detected in sample. Center face in camera."})
        elif len(boxes) > 1:
            return jsonify({"success": False, "message": "Multiple faces detected. Only one face allowed."})
            
        encodings = face_recognition.face_encodings(rgb_img, boxes)
        if len(encodings) > 0:
            encoding_blob = pickle.dumps(encodings[0])
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO face_encodings (user_id, encoding_blob, sample_index)
                VALUES (?, ?, ?)
            """, (user_id, encoding_blob, sample_index))
            cursor.execute("UPDATE users SET sample_count = sample_count + 1 WHERE user_id = ?", (user_id,))
            conn.commit()
            conn.close()
            encoding_saved = True
    else:
        # Save placeholder encoding if library missing
        dummy_encoding = np.random.randn(128).astype(np.float64)
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO face_encodings (user_id, encoding_blob, sample_index)
            VALUES (?, ?, ?)
        """, (user_id, pickle.dumps(dummy_encoding), sample_index))
        cursor.execute("UPDATE users SET sample_count = sample_count + 1 WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        encoding_saved = True
        
    # Reload encodings cache
    load_all_encodings()
    return jsonify({"success": True, "message": f"Sample {sample_index} stored and encoded successfully!"})

@app.route('/attendance')
def attendance():
    search = request.args.get("search", "").strip()
    date_filter = request.args.get("date", "").strip()
    
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM attendance WHERE 1=1"
    params = []
    
    if search:
        query += " AND (name LIKE ? OR user_id LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    
    if date_filter:
        query += " AND date = ?"
        params.append(date_filter)
        
    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    records = cursor.fetchall()
    conn.close()
    
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    return render_template("attendance.html", records=records, search=search, date_filter=date_filter, today=today_str)

@app.route('/users')
def users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.*, COUNT(fe.id) as encodings_count 
        FROM users u 
        LEFT JOIN face_encodings fe ON u.user_id = fe.user_id 
        GROUP BY u.user_id 
        ORDER BY u.id DESC
    """)
    users_list = cursor.fetchall()
    conn.close()
    return render_template("users.html", users=users_list)

@app.route('/delete_user/<user_id>', methods=['POST', 'GET'])
def delete_user(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM face_encodings WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM attendance WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    # Remove dataset folder
    user_dir = os.path.join(DATASET_DIR, user_id)
    if os.path.exists(user_dir):
        import shutil
        shutil.rmtree(user_dir, ignore_errors=True)
        
    load_all_encodings()
    return redirect(url_for('users'))

@app.route('/export_attendance_csv')
def export_attendance_csv():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id, name, date, time, status, confidence FROM attendance ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Record ID', 'User ID', 'Name', 'Date', 'Time', 'Status', 'Confidence'])
    for row in rows:
        writer.writerow([row['id'], row['user_id'], row['name'], row['date'], row['time'], row['status'], row['confidence']])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=attendance_report.csv"}
    )

@app.route('/api/live_status')
def api_live_status():
    global latest_recognition_event
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(DISTINCT user_id) as present FROM attendance WHERE date = ?", (today_str,))
    present_today = cursor.fetchone()["present"]
    cursor.execute("SELECT COUNT(DISTINCT user_id) as total FROM users")
    total_users = cursor.fetchone()["total"]
    conn.close()
    
    return jsonify({
        "present_today": present_today,
        "total_users": total_users,
        "latest_event": latest_recognition_event
    })

if __name__ == '__main__':
    init_db()
    load_all_encodings()
    print("=" * 60)
    print("  AI ATTENDANCE SYSTEM - PYTHON FLASK & OPENCV")
    print("  Server running at http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
