// deployed: 2026-09-05
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
   app.use(express.static('./public'));
// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });
// Initialize SQLite database
const db = new sqlite3.Database('./gippsland-proof.db', (err) => {
  if (err) console.error(err);
  else console.log('Connected to SQLite database');
});
// Create tables
db.serialize(() => {
  // Jobs table
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    jobNumber TEXT UNIQUE,
    customerName TEXT,
    customerEmail TEXT,
    amount REAL,
    status TEXT,
    dateEntered TEXT,
    dueDate TEXT,
    jobType TEXT,
    notes TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  // Proofs table
  db.run(`CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    jobId TEXT,
    jobNumber TEXT,
    version INTEGER DEFAULT 1,
    filePath TEXT,
    fileName TEXT,
    proofUrl TEXT UNIQUE,
    sentAt TIMESTAMP,
    clientEmail TEXT,
    status TEXT DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(jobId) REFERENCES jobs(id)
  )`);
  // Approvals table
  db.run(`CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    proofId TEXT,
    jobNumber TEXT,
    clientEmail TEXT,
    approvalStatus TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY(proofId) REFERENCES proofs(id)
  )`);
});
// Helper functions
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};
// Trigger Zapier webhook
const triggerZapier = async (event, data) => {
  const webhookUrl = process.env.ZAPIER_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/';
  try {
    await axios.post(webhookUrl, {
      event,
      ...data,
      timestamp: new Date().toISOString()
    });
    console.log(`Zapier webhook triggered: ${event}`);
  } catch (err) {
    console.error('Zapier webhook error:', err.message);
  }
};
// Routes
// 1. CSV Upload - Import jobs from E&P export
app.post('/api/jobs/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const jobs = [];
  const filePath = req.file.path;
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      // Map CSV columns to our schema
      jobs.push({
        id: uuidv4(),
        jobNumber: row[0] || row['Job Number'] || '',
        customerName: row[2] || row['Customer'] || '',
        customerEmail: row[8] || row['Email'] || '',
        amount: parseFloat(row[11]) || 0,
        status: row[10] || row['Status'] || 'Order Received',
        dateEntered: row[9] || row['Date'] || new Date().toISOString(),
        dueDate: row[9] || '',
        jobType: 'Print Job',
        notes: ''
      });
    })
    .on('end', async () => {
      try {
        // Clear existing jobs first
        await dbRun('DELETE FROM jobs');
        // Insert new jobs
        for (const job of jobs) {
          await dbRun(
            `INSERT OR REPLACE INTO jobs (id, jobNumber, customerName, customerEmail, amount, status, dateEntered, dueDate, jobType, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [job.id, job.jobNumber, job.customerName, job.customerEmail, job.amount, job.status, job.dateEntered, job.dueDate, job.jobType, job.notes]
          );
        }
        fs.unlink(filePath, (err) => {
          if (err) console.error(err);
        });
        res.json({
          success: true,
          message: `Imported ${jobs.length} jobs`,
          jobsImported: jobs.length
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
});
// 2. Get all jobs with dashboard logic
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await dbAll('SELECT * FROM jobs ORDER BY dateEntered DESC');
    // Add days waiting calculation
    const today = new Date();
    const jobsWithDaysWaiting = jobs.map(job => {
      const dateEntered = new Date(job.dateEntered);
      const daysWaiting = Math.floor((today - dateEntered) / (1000 * 60 * 60 * 24));
      let warningLevel = 'none';
      if (job.status === 'Awaiting GP Supplied Artwork' || job.status === 'Tim Art') {
        if (daysWaiting >= 5) warningLevel = 'critical';
        else if (daysWaiting >= 3) warningLevel = 'warning';
      } else if (job.status === 'On Proof') {
        if (daysWaiting >= 7) warningLevel = 'critical';
        else if (daysWaiting >= 4) warningLevel = 'warning';
      }
      return {
        ...job,
        daysWaiting,
        warningLevel
      };
    });
    res.json(jobsWithDaysWaiting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 3. Get dashboard data grouped by section
app.get('/api/dashboard', async (req, res) => {
  try {
    const jobs = await dbAll('SELECT * FROM jobs ORDER BY dateEntered DESC');
    const today = new Date();
    const sections = {
      waitingForDesign: [],
      proofsSent: [],
      approvedReady: []
    };
    for (const job of jobs) {
      const dateEntered = new Date(job.dateEntered);
      const daysWaiting = Math.floor((today - dateEntered) / (1000 * 60 * 60 * 24));
      let warningLevel = 'none';
      if (job.status === 'Awaiting GP Supplied Artwork' || job.status === 'Tim Art') {
        if (daysWaiting >= 5) warningLevel = 'critical';
        else if (daysWaiting >= 3) warningLevel = 'warning';
        sections.waitingForDesign.push({
          ...job,
          daysWaiting,
          warningLevel
        });
      } else if (job.status === 'On Proof') {
        if (daysWaiting >= 7) warningLevel = 'critical';
        else if (daysWaiting >= 4) warningLevel = 'warning';
        sections.proofsSent.push({
          ...job,
          daysWaiting,
          warningLevel
        });
      } else if (job.status === 'GP to Print') {
        sections.approvedReady.push({
          ...job,
          daysWaiting,
          warningLevel: 'none'
        });
      }
    }
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 4. Update job status
app.patch('/api/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;
  try {
    await dbRun(
      'UPDATE jobs SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, jobId]
    );
    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 5. Create proof request
app.post('/api/proofs', upload.single('file'), async (req, res) => {
  try {
    const { jobNumber, jobId, clientEmail, version } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const proofId = uuidv4();
    const proofUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/proof/${proofId}`;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    // Save to uploads folder with proofId
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const newFilePath = path.join(uploadsDir, `${proofId}_${fileName}`);
    fs.renameSync(filePath, newFilePath);
    // Insert proof record
    await dbRun(
      `INSERT INTO proofs (id, jobId, jobNumber, version, filePath, fileName, proofUrl, clientEmail, status, sentAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
      [proofId, jobId, jobNumber, version || 1, newFilePath, fileName, proofUrl, clientEmail]
    );
    // Trigger Zapier - proof sent
    await triggerZapier('proof_sent', {
      jobNumber,
      clientEmail,
      proofUrl,
      proofId
    });
    res.json({
      success: true,
      proofId,
      proofUrl,
      message: 'Proof created and notification sent to client'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 6. Get proof by ID (for viewing)
app.get('/api/proofs/:proofId', async (req, res) => {
  try {
    const { proofId } = req.params;
    const proof = await dbGet('SELECT * FROM proofs WHERE id = ?', [proofId]);
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }
    // Read file and send
    const filePath = proof.filePath;
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 7. Approve proof
app.post('/api/proofs/:proofId/approve', async (req, res) => {
  try {
    const { proofId } = req.params;
    const proof = await dbGet('SELECT * FROM proofs WHERE id = ?', [proofId]);
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }
    // Record approval
    await dbRun(
      `INSERT INTO approvals (id, proofId, jobNumber, clientEmail, approvalStatus)
       VALUES (?, ?, ?, ?, 'approved')`,
      [uuidv4(), proofId, proof.jobNumber, proof.clientEmail]
    );
    // Update proof status
    await dbRun('UPDATE proofs SET status = ? WHERE id = ?', ['approved', proofId]);
    // Trigger Zapier - proof approved
    await triggerZapier('proof_approved', {
      jobNumber: proof.jobNumber,
      clientEmail: proof.clientEmail,
      artEmail: process.env.ART_EMAIL || 'art@gippslandprinters.com.au',
      printEmail: process.env.PRINT_EMAIL || 'print@gippslandprinters.com.au',
      proofId
    });
    res.json({ success: true, message: 'Proof approved and notifications sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 8. Reject proof
app.post('/api/proofs/:proofId/reject', async (req, res) => {
  try {
    const { proofId } = req.params;
    const { reason } = req.body;
    const proof = await dbGet('SELECT * FROM proofs WHERE id = ?', [proofId]);
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }
    // Record rejection
    await dbRun(
      `INSERT INTO approvals (id, proofId, jobNumber, clientEmail, approvalStatus, notes)
       VALUES (?, ?, ?, ?, 'rejected', ?)`,
      [uuidv4(), proofId, proof.jobNumber, proof.clientEmail, reason || '']
    );
    // Update proof status
    await dbRun('UPDATE proofs SET status = ? WHERE id = ?', ['rejected', proofId]);
    // Trigger Zapier - proof rejected
    await triggerZapier('proof_rejected', {
      jobNumber: proof.jobNumber,
      artEmail: process.env.ART_EMAIL || 'art@gippslandprinters.com.au',
      reason: reason || 'Client requested changes',
      proofId
    });
    res.json({ success: true, message: 'Proof rejected and art@ notified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 9. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gippsland Proof Platform running on port ${PORT}`);
});
