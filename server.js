const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Initialize SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Database error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      jobId TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      email TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'waiting',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating jobs table:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      approvalToken TEXT UNIQUE NOT NULL,
      version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(jobId) REFERENCES jobs(jobId)
    )
  `, (err) => {
    if (err) console.error('Error creating proofs table:', err);
  });

  // Seed test data
  const now = new Date().toISOString();
  db.run(
    'INSERT OR IGNORE INTO jobs (jobId, customer, email, description, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    ['TEST001', 'Nathan Test', 'test@gippslandprinters.com.au', 'Test Proof Job', 'waiting', now],
    (err) => {
      if (err) console.error('Error seeding TEST001:', err);
    }
  );
  db.run(
    'INSERT OR IGNORE INTO jobs (jobId, customer, email, description, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    ['TEST002', 'Another Customer', 'another@test.com', 'Design Approval', 'waiting', now],
    (err) => {
      if (err) console.error('Error seeding TEST002:', err);
    }
  );
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Approve page route
app.get('/approve/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'approve.html'));
});

// API endpoints

// Get all jobs
app.get('/api/jobs', (req, res) => {
  db.all(`
    SELECT j.*, COUNT(p.id) as proofCount
    FROM jobs j
    LEFT JOIN proofs p ON j.jobId = p.jobId
    GROUP BY j.jobId
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ jobs: rows || [] });
    }
  });
});

// Create new job
app.post('/api/jobs', express.json(), (req, res) => {
  const { jobId, customer, email, description } = req.body;

  if (!jobId || !customer || !email) {
    return res.status(400).json({ error: 'jobId, customer, and email are required' });
  }

  db.run(
    'INSERT INTO jobs (jobId, customer, email, description) VALUES (?, ?, ?, ?)',
    [jobId, customer, email, description],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          jobId: jobId,
          message: 'Job created successfully'
        });
      }
    }
  );
});

// Get job details
app.get('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;

  db.get('SELECT * FROM jobs WHERE jobId = ?', [jobId], (err, job) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!job) {
      res.status(404).json({ error: 'Job not found' });
    } else {
      res.json(job);
    }
  });
});

// Send proof - Upload PDF and generate approval link
app.post('/api/jobs/:jobId/send-proof', upload.single('proof'), (req, res) => {
  const { jobId } = req.params;
  const { customerEmail } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No proof file provided' });
  }

  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email is required' });
  }

  // Generate unique approval token
  const approvalToken = crypto.randomBytes(16).toString('hex');
  const filePath = req.file.path;
  const fileName = req.file.filename;

  // Insert proof record into database
  db.run(
    'INSERT INTO proofs (jobId, fileName, filePath, approvalToken, status) VALUES (?, ?, ?, ?, ?)',
    [jobId, fileName, filePath, approvalToken, 'pending'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        // Get job details for webhook
        db.get('SELECT * FROM jobs WHERE jobId = ?', [jobId], (err, job) => {
          if (err || !job) {
            return res.status(500).json({ error: 'Failed to retrieve job details' });
          }

          // Generate approval link
          const approvalLink = `${req.protocol}://${req.get('host')}/approve/${approvalToken}`;

          // Prepare webhook data for Zapier
          const webhookData = {
            event: 'proof_sent',
            jobId: jobId,
            customer: job.customer,
            email: customerEmail,
            description: job.description,
            approvalLink: approvalLink,
            timestamp: new Date().toISOString()
          };

          // Send webhook to Zapier
          const https = require('https');
          const zapierUrl = 'https://hooks.zapier.com/hooks/catch/28758004/4he15ub/';

          const options = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          };

          const zapierReq = https.request(zapierUrl, options, (zapierRes) => {
            // Webhook sent, respond to client regardless
            res.json({
              success: true,
              message: 'Proof uploaded and email sent successfully',
              approvalToken: approvalToken,
              approvalLink: approvalLink,
              emailSent: true
            });
          });

          zapierReq.on('error', (error) => {
            console.error('Zapier webhook error:', error);
            // Still respond with success - webhook failure shouldn't block the upload
            res.json({
              success: true,
              message: 'Proof uploaded successfully (email queued)',
              approvalToken: approvalToken,
              approvalLink: approvalLink,
              emailSent: false
            });
          });

          zapierReq.write(JSON.stringify(webhookData));
          zapierReq.end();
        });
      }
    }
  );
});

// Get proof details for client (using approval token)
app.get('/api/approve/:token', (req, res) => {
  const { token } = req.params;

  db.get(`
    SELECT p.*, j.jobId, j.customer, j.description, j.email
    FROM proofs p
    JOIN jobs j ON p.jobId = j.jobId
    WHERE p.approvalToken = ?
  `, [token], (err, proof) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!proof) {
      res.status(404).json({ error: 'Proof not found' });
    } else {
      res.json(proof);
    }
  });
});

// Process client approval/rejection
app.post('/api/approve/:token', express.json(), (req, res) => {
  const { token } = req.params;
  const { action, feedback } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  }

  // Get proof details
  db.get('SELECT * FROM proofs WHERE approvalToken = ?', [token], (err, proof) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    // Update proof status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    db.run(
      'UPDATE proofs SET status = ? WHERE approvalToken = ?',
      [newStatus, token],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Get job details for webhook
        db.get('SELECT * FROM jobs WHERE jobId = ?', [proof.jobId], (err, job) => {
          const webhookData = {
            event: `proof_${newStatus}`,
            jobId: proof.jobId,
            customer: job.customer,
            email: job.email,
            proofToken: token,
            feedback: feedback || null,
            timestamp: new Date().toISOString()
          };

          res.json({
            success: true,
            message: `Proof ${newStatus} recorded`,
            webhook: webhookData
          });
        });
      }
    );
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
