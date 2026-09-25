import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { dbManager } from './src/server/database.ts';
import JSZip from 'jszip';

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Seed initial users if database is empty
async function seedInitialData() {
  try {
    await dbManager.init();
    const users = await dbManager.getAllUsers();
    if (users.length === 0) {
      console.log('Seeding initial demonstration users in SQLite...');
      await dbManager.registerUser('EMP-101', 'Dr. Sarah Connor', 'sarah.connor@institution.edu');
      await dbManager.registerUser('EMP-102', 'Alex Chen', 'alex.chen@institution.edu');
      await dbManager.registerUser('STU-204', 'Maya Patel', 'maya.patel@institution.edu');

      // Add baseline synthetic face encodings for immediate recognition demo
      // 128 normalized feature dimensions
      const makeVector = (seed: number) => {
        const v: number[] = [];
        for (let i = 0; i < 128; i++) {
          v.push(Math.sin(seed + i * 0.1) * 0.5 + Math.cos(seed * 2 + i * 0.05) * 0.5);
        }
        // Normalize
        const mag = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
        return v.map(x => x / mag);
      };

      await dbManager.addFaceEncoding('EMP-101', makeVector(1.1), 1);
      await dbManager.addFaceEncoding('EMP-101', makeVector(1.2), 2);
      await dbManager.addFaceEncoding('EMP-102', makeVector(3.3), 1);
      await dbManager.addFaceEncoding('EMP-102', makeVector(3.4), 2);
      await dbManager.addFaceEncoding('STU-204', makeVector(5.5), 1);

      // Pre-seed 1 attendance record for today to show populated table
      await dbManager.markAttendance('STU-204', 'Maya Patel', 0.96);
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

// ---------------- API ENDPOINTS ---------------- //

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dbManager.getDashboardStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await dbManager.getAllUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { user_id, name, email } = req.body;
    if (!user_id || !name || !email) {
      return res.status(400).json({ error: 'Name, User ID, and Email are required.' });
    }
    await dbManager.registerUser(user_id.trim().toUpperCase(), name.trim(), email.trim().toLowerCase());
    res.json({ success: true, message: `User ${name} registered successfully.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/save_face_sample', async (req, res) => {
  try {
    const { user_id, sample_index, encoding, photo_preview } = req.body;
    if (!user_id || !encoding || !Array.isArray(encoding)) {
      return res.status(400).json({ error: 'User ID and facial encoding array are required.' });
    }
    await dbManager.addFaceEncoding(user_id, encoding, sample_index || 1, photo_preview);
    res.json({ success: true, message: `Sample ${sample_index} stored in SQLite successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await dbManager.deleteUser(userId);
    res.json({ success: true, message: `User ${userId} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const { search, date } = req.query;
    const records = await dbManager.getAttendance(search as string, date as string);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/mark', async (req, res) => {
  try {
    const { user_id, name, confidence } = req.body;
    if (!user_id || !name) {
      return res.status(400).json({ error: 'User ID and Name are required.' });
    }
    const result = await dbManager.markAttendance(user_id, name, confidence || 0.95);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Match a live face encoding against all stored encodings in SQLite
app.post('/api/recognize', async (req, res) => {
  try {
    const { encoding, tolerance = 0.50 } = req.body;
    if (!encoding || !Array.isArray(encoding) || encoding.length === 0) {
      return res.status(400).json({ error: 'Face feature vector is required.' });
    }

    const allEncodings = await dbManager.getAllFaceEncodings();
    if (allEncodings.length === 0) {
      return res.json({ matched: false, reason: 'No registered faces in database' });
    }

    let minDistance = Infinity;
    let bestMatch: { user_id: string; name: string } | null = null;

    // Euclidean distance calculation (identical to face_recognition.face_distance)
    for (const record of allEncodings) {
      if (record.encoding.length !== encoding.length) continue;
      let sumSq = 0;
      for (let i = 0; i < encoding.length; i++) {
        const diff = encoding[i] - record.encoding[i];
        sumSq += diff * diff;
      }
      const dist = Math.sqrt(sumSq);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = { user_id: record.user_id, name: record.name };
      }
    }

    if (bestMatch && minDistance <= tolerance) {
      const confidence = Math.max(0.60, Math.min(0.99, 1.0 - (minDistance * 0.7)));
      // Auto mark attendance
      const markResult = await dbManager.markAttendance(bestMatch.user_id, bestMatch.name, confidence);

      return res.json({
        matched: true,
        user_id: bestMatch.user_id,
        name: bestMatch.name,
        distance: minDistance,
        confidence: Number(confidence.toFixed(2)),
        attendanceResult: markResult,
      });
    }

    res.json({
      matched: false,
      distance: minDistance,
      label: 'Unknown Person',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Provide full Python codebase files for client inspection
app.get('/api/project_files', (req, res) => {
  try {
    const baseDir = path.resolve(process.cwd(), 'ai_attendance_system');
    const readDirRecursive = (dir: string, rel = ''): any[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const results: any[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const relativePath = path.join(rel, entry.name);
        if (entry.isDirectory()) {
          results.push({
            name: entry.name,
            path: relativePath,
            type: 'dir',
            children: readDirRecursive(full, relativePath),
          });
        } else {
          let content = '';
          try {
            content = fs.readFileSync(full, 'utf8');
          } catch {
            content = '[Binary file]';
          }
          results.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            content,
            size: fs.statSync(full).size,
          });
        }
      }
      return results;
    };

    const files = readDirRecursive(baseDir);
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download complete Python project ZIP archive
app.get('/api/download_project_zip', async (req, res) => {
  try {
    const baseDir = path.resolve(process.cwd(), 'ai_attendance_system');
    const zip = new JSZip();

    const addFilesToZip = (dir: string, zipFolder: JSZip) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          const sub = zipFolder.folder(item.name);
          if (sub) addFilesToZip(fullPath, sub);
        } else {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(item.name, content);
        }
      }
    };

    const rootFolder = zip.folder('ai_attendance_system');
    if (rootFolder) {
      addFilesToZip(baseDir, rootFolder);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="ai_attendance_system.zip"');
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error generating project zip:', err);
    res.status(500).send('Failed to generate project zip');
  }
});

// Start Express with Vite middleware in development
async function startServer() {
  await seedInitialData();

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
