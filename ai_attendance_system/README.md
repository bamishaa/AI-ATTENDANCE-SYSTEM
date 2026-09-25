# AI-Based Attendance Management System
### Built with Python, Flask, OpenCV, Face Recognition, and SQLite

An enterprise-ready, biometric attendance management system that automatically detects and recognizes faces through a live webcam stream, prevents duplicate attendance records, and logs real-time entries into an SQLite database.

---

## 🚀 Key Features

1. **User Registration & Dataset Generation:**
   - Multi-step registration (Name, ID, Email).
   - High-resolution webcam capture taking 5 unique facial angles (straight, left, right, chin up, smile).
   - Generates 128-dimensional deep metric face embeddings stored in SQLite.

2. **Real-Time Face Detection & HUD:**
   - Real-time video processing using OpenCV & dlib/face_recognition.
   - Dynamic corner bounding boxes: **Green** for recognized users, **Red** for "Unknown Person".
   - Shows recognized Name, ID, and confidence score directly overlaid on video.

3. **Automated Anti-Duplicate Attendance:**
   - Automatically marks attendance the instant a registered face is verified.
   - Enforces single check-in per user per calendar day.
   - Records first arrival timestamp with exact seconds and status `Present`.

4. **Modern Analytics Dashboard & Logs:**
   - Total Registered Personnel counter.
   - Present Today counter and real-time attendance rate percentage.
   - Search by Name or ID with date filtering.
   - One-click CSV Export for administrative reporting.

5. **User Management:**
   - Browse all registered users.
   - View enrolled vector count.
   - Delete users with automatic dataset and encoding cleanup.

---

## 🛠️ Technology Stack

- **Backend:** Python 3.9+ / 3.10 / 3.11, Flask
- **Computer Vision:** OpenCV (`cv2`), `face_recognition` (dlib ResNet-34)
- **Mathematical Processing:** NumPy
- **Database:** SQLite (`database.db`)
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), FontAwesome

---

## 📦 Project Directory Structure

```
ai_attendance_system/
│
├── app.py                  # Core Flask server, webcam pipeline & routes
├── requirements.txt        # Python dependency manifest
├── database.db             # SQLite database (auto-generated on launch)
├── face_encodings/         # Directory for serialized face encodings
├── dataset/                # Dataset folder containing raw face images by ID
│
├── templates/              # Jinja2 HTML templates
│   ├── base.html           # Master layout with sidebar & navigation
│   ├── index.html          # Live recognition webcam feed
│   ├── register.html       # Step 1: User info form
│   ├── capture.html        # Step 2: Multi-sample webcam capture
│   ├── dashboard.html      # Metrics, KPI cards & statistics
│   ├── attendance.html     # Searchable, filterable attendance table
│   └── users.html          # Enrolled user directory & deletion
│
├── static/
│   ├── css/
│   │   └── style.css       # Modern dark UI theme with responsive layout
│   └── js/
│       └── script.js       # Client-side helper scripts
│
└── README.md               # Setup and execution guide
```

---

## ⚡ Quick Start & Installation

### Step 1: Clone or Navigate to the Directory
```bash
cd ai_attendance_system
```

### Step 2: Create a Virtual Environment (Recommended)
```bash
# On macOS / Linux:
python3 -m venv venv
source venv/bin/activate

# On Windows (cmd):
python -m venv venv
venv\Scripts\activate

# On Windows (PowerShell):
python -m venv venv
venv\Scripts\Activate.ps1
```

### Step 3: Install CMake and dlib prerequisites

> **Note on `face_recognition`:**  
> The `face_recognition` package depends on `dlib`, which requires a C++ compiler and CMake:
> - **macOS:** `brew install cmake`
> - **Ubuntu / Debian:** `sudo apt-get install build-essential cmake libopenblas-dev liblapack-dev`
> - **Windows:** Install Visual Studio with "Desktop development with C++" and `pip install cmake`

### Step 4: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 5: Run the Application
```bash
python app.py
```

### Step 6: Access the Web Interface
Open your web browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🗄️ Database Schema (SQLite)

### `users` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key (Autoincrement) |
| `user_id` | TEXT | Unique Employee/Student ID |
| `name` | TEXT | Personnel Full Name |
| `email` | TEXT | Contact Email |
| `created_at` | TEXT | Registration Timestamp |
| `sample_count` | INTEGER | Number of face snapshots captured |

### `face_encodings` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key (Autoincrement) |
| `user_id` | TEXT | Foreign Key -> `users.user_id` |
| `encoding_blob`| BLOB | Serialized 128-dimensional numpy array |
| `sample_index` | INTEGER | Capture sequence index (1 to 5) |

### `attendance` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key (Autoincrement) |
| `user_id` | TEXT | Foreign Key -> `users.user_id` |
| `name` | TEXT | Name of attendee |
| `date` | TEXT | Date string (`YYYY-MM-DD`) |
| `time` | TEXT | Check-in time (`HH:MM:SS`) |
| `status` | TEXT | Status (`Present`) |
| `confidence` | REAL | Verification confidence score |

---

## 🔒 Security & Performance Considerations

1. **Threshold Tuning:** The Euclidean distance threshold is configured to `0.48` in `app.py`. A lower threshold provides stricter verification; a higher threshold allows looser matching.
2. **Frame Skipping & Rescaling:** The webcam stream downscales frames to 25% for real-time inference at 30+ frames per second without CPU bottlenecking.
3. **Encodings in Memory:** Encodings are loaded into fast RAM cache at startup and reloaded only upon new registrations or deletions.
