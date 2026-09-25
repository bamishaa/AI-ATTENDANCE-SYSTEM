import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve(process.cwd(), 'database.db');

export interface User {
  id: number;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  sample_count: number;
  photo_preview?: string;
}

export interface FaceEncodingRecord {
  id: number;
  user_id: string;
  name: string;
  encoding: number[];
  sample_index: number;
}

export interface AttendanceRecord {
  id: number;
  user_id: string;
  name: string;
  date: string;
  time: string;
  status: string;
  confidence: number;
}

class AttendanceDatabase {
  private db: Database | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized && this.db) return this.db;

    const SQL = await initSqlJs();

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileBuffer = fs.readFileSync(DB_FILE);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('Failed reading existing DB file, creating new:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    // Initialize tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sample_count INTEGER DEFAULT 0,
        photo_preview TEXT
      );

      CREATE TABLE IF NOT EXISTS face_encodings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        encoding_json TEXT NOT NULL,
        sample_index INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence REAL DEFAULT 0.95,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      );
    `);

    this.saveToDisk();
    this.isInitialized = true;
    return this.db;
  }

  private saveToDisk() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE, buffer);
    } catch (err) {
      console.error('Error saving SQLite database to disk:', err);
    }
  }

  async getAllUsers(): Promise<User[]> {
    await this.init();
    const res = this.db!.exec(`
      SELECT u.id, u.user_id, u.name, u.email, u.created_at, 
             COUNT(fe.id) as sample_count, u.photo_preview
      FROM users u
      LEFT JOIN face_encodings fe ON u.user_id = fe.user_id
      GROUP BY u.user_id
      ORDER BY u.id DESC
    `);
    if (!res.length || !res[0].values.length) return [];
    
    return res[0].values.map((row: any[]) => ({
      id: row[0],
      user_id: row[1],
      name: row[2],
      email: row[3],
      created_at: row[4],
      sample_count: Number(row[5] || 0),
      photo_preview: row[6] || undefined,
    }));
  }

  async getUser(userId: string): Promise<User | null> {
    await this.init();
    const stmt = this.db!.prepare(`SELECT id, user_id, name, email, created_at, sample_count, photo_preview FROM users WHERE user_id = :uid`);
    stmt.bind({ ':uid': userId });
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        created_at: row.created_at,
        sample_count: row.sample_count,
        photo_preview: row.photo_preview,
      };
    }
    stmt.free();
    return null;
  }

  async registerUser(userId: string, name: string, email: string): Promise<boolean> {
    await this.init();
    const existing = await this.getUser(userId);
    if (existing) {
      throw new Error(`User ID "${userId}" is already registered.`);
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.db!.run(
      `INSERT INTO users (user_id, name, email, created_at, sample_count) VALUES (?, ?, ?, ?, 0)`,
      [userId, name, email, nowStr]
    );
    this.saveToDisk();
    return true;
  }

  async addFaceEncoding(userId: string, encoding: number[], sampleIndex: number, photoPreview?: string): Promise<void> {
    await this.init();
    const jsonStr = JSON.stringify(encoding);
    this.db!.run(
      `INSERT INTO face_encodings (user_id, encoding_json, sample_index) VALUES (?, ?, ?)`,
      [userId, jsonStr, sampleIndex]
    );

    if (photoPreview) {
      this.db!.run(
        `UPDATE users SET sample_count = sample_count + 1, photo_preview = ? WHERE user_id = ?`,
        [photoPreview, userId]
      );
    } else {
      this.db!.run(
        `UPDATE users SET sample_count = sample_count + 1 WHERE user_id = ?`,
        [userId]
      );
    }
    this.saveToDisk();
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.init();
    this.db!.run(`DELETE FROM face_encodings WHERE user_id = ?`, [userId]);
    this.db!.run(`DELETE FROM attendance WHERE user_id = ?`, [userId]);
    this.db!.run(`DELETE FROM users WHERE user_id = ?`, [userId]);
    this.saveToDisk();
    return true;
  }

  async getAllFaceEncodings(): Promise<FaceEncodingRecord[]> {
    await this.init();
    const res = this.db!.exec(`
      SELECT fe.id, fe.user_id, u.name, fe.encoding_json, fe.sample_index
      FROM face_encodings fe
      JOIN users u ON fe.user_id = u.user_id
    `);
    if (!res.length || !res[0].values.length) return [];

    return res[0].values.map((row: any[]) => {
      let enc: number[] = [];
      try {
        enc = JSON.parse(row[3]);
      } catch (e) {
        enc = [];
      }
      return {
        id: row[0],
        user_id: row[1],
        name: row[2],
        encoding: enc,
        sample_index: row[4],
      };
    });
  }

  async getAttendance(search?: string, dateFilter?: string): Promise<AttendanceRecord[]> {
    await this.init();
    let sql = `SELECT id, user_id, name, date, time, status, confidence FROM attendance WHERE 1=1`;
    const params: any[] = [];

    if (search && search.trim()) {
      sql += ` AND (name LIKE ? OR user_id LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (dateFilter && dateFilter.trim()) {
      sql += ` AND date = ?`;
      params.push(dateFilter.trim());
    }

    sql += ` ORDER BY id DESC`;

    const res = this.db!.exec(sql, params);
    if (!res.length || !res[0].values.length) return [];

    return res[0].values.map((row: any[]) => ({
      id: row[0],
      user_id: row[1],
      name: row[2],
      date: row[3],
      time: row[4],
      status: row[5],
      confidence: Number(row[6] || 0.95),
    }));
  }

  async markAttendance(userId: string, name: string, confidence = 0.95): Promise<{ success: boolean; alreadyMarked: boolean; message: string; record?: AttendanceRecord }> {
    await this.init();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false }); // HH:MM:SS

    // Check if duplicate on same day
    const checkStmt = this.db!.prepare(`SELECT id, time FROM attendance WHERE user_id = :uid AND date = :dt`);
    checkStmt.bind({ ':uid': userId, ':dt': today });
    if (checkStmt.step()) {
      const row = checkStmt.getAsObject() as any;
      checkStmt.free();
      return {
        success: false,
        alreadyMarked: true,
        message: `Attendance already recorded for ${name} today at ${row.time}.`,
      };
    }
    checkStmt.free();

    this.db!.run(
      `INSERT INTO attendance (user_id, name, date, time, status, confidence) VALUES (?, ?, ?, ?, 'Present', ?)`,
      [userId, name, today, nowTime, confidence]
    );
    this.saveToDisk();

    return {
      success: true,
      alreadyMarked: false,
      message: `Marked Present for ${name} (${userId}) at ${nowTime}!`,
      record: {
        id: Date.now(),
        user_id: userId,
        name,
        date: today,
        time: nowTime,
        status: 'Present',
        confidence,
      }
    };
  }

  async getDashboardStats() {
    await this.init();
    const today = new Date().toISOString().slice(0, 10);

    const totalUsersRes = this.db!.exec(`SELECT COUNT(DISTINCT user_id) FROM users`);
    const totalUsers = totalUsersRes.length && totalUsersRes[0].values.length ? Number(totalUsersRes[0].values[0][0]) : 0;

    const presentRes = this.db!.exec(`SELECT COUNT(DISTINCT user_id) FROM attendance WHERE date = ?`, [today]);
    const presentToday = presentRes.length && presentRes[0].values.length ? Number(presentRes[0].values[0][0]) : 0;

    const percentage = totalUsers > 0 ? Math.round((presentToday / totalUsers) * 100) : 0;

    const recentRecords = await this.getAttendance(undefined, undefined);

    return {
      totalUsers,
      presentToday,
      attendancePercentage: percentage,
      recentRecords: recentRecords.slice(0, 8),
      date: today,
    };
  }
}

export const dbManager = new AttendanceDatabase();
