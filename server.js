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
// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Fallback route for root path
app.get('/', (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Proof Approval Dashboard - Gippsland Printers</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n\n        body {\n            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n            background-color: #f5f5f5;\n            color: #333;\n        }\n\n        .header {\n            background: linear-gradient(135deg, #5a3e36 0%, #8b7355 100%);\n            color: white;\n            padding: 20px;\n            text-align: center;\n            box-shadow: 0 2px 10px rgba(0,0,0,0.1);\n        }\n\n        .header h1 {\n            font-size: 28px;\n            margin-bottom: 5px;\n        }\n\n        .header p {\n            opacity: 0.9;\n            font-size: 14px;\n        }\n\n        .container {\n            max-width: 1400px;\n            margin: 20px auto;\n            padding: 0 20px;\n        }\n\n        .tabs {\n            display: flex;\n            gap: 10px;\n            margin-bottom: 20px;\n            border-bottom: 2px solid #ddd;\n        }\n\n        .tab-button {\n            padding: 12px 24px;\n            background: none;\n            border: none;\n            cursor: pointer;\n            font-size: 16px;\n            color: #666;\n            border-bottom: 3px solid transparent;\n            transition: all 0.3s;\n        }\n\n        .tab-button.active {\n            color: #5a3e36;\n            border-bottom-color: #5a3e36;\n        }\n\n        .tab-button:hover {\n            color: #5a3e36;\n        }\n\n        .tab-content {\n            display: none;\n        }\n\n        .tab-content.active {\n            display: block;\n        }\n\n        .dashboard {\n            display: grid;\n            grid-template-columns: repeat(3, 1fr);\n            gap: 20px;\n        }\n\n        .column {\n            background: white;\n            border-radius: 8px;\n            box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n            padding: 15px;\n            min-height: 600px;\n        }\n\n        .column h2 {\n            color: #5a3e36;\n            margin-bottom: 15px;\n            font-size: 18px;\n            border-bottom: 2px solid #f0f0f0;\n            padding-bottom: 10px;\n        }\n\n        .job-card {\n            background: #f9f9f9;\n            border-left: 4px solid #5a3e36;\n            padding: 12px;\n            margin-bottom: 10px;\n            border-radius: 4px;\n            cursor: move;\n            transition: all 0.2s;\n            user-select: none;\n        }\n\n        .job-card:hover {\n            box-shadow: 0 2px 8px rgba(0,0,0,0.15);\n            transform: translateY(-2px);\n        }\n\n        .job-card.dragging {\n            opacity: 0.5;\n        }\n\n        .job-id {\n            font-weight: bold;\n            color: #5a3e36;\n            margin-bottom: 5px;\n        }\n\n        .job-client {\n            font-size: 13px;\n            color: #666;\n            margin-bottom: 3px;\n        }\n\n        .job-date {\n            font-size: 12px;\n            color: #999;\n        }\n\n        .warning {\n            font-size: 11px;\n            padding: 4px 8px;\n            border-radius: 3px;\n            margin-top: 5px;\n            font-weight: 600;\n        }\n\n        .warning.yellow {\n            background: #fff3cd;\n            color: #856404;\n        }\n\n        .warning.red {\n            background: #f8d7da;\n            color: #721c24;\n        }\n\n        .form-group {\n            margin-bottom: 15px;\n        }\n\n        .form-group label {\n            display: block;\n            margin-bottom: 5px;\n            font-weight: 600;\n            color: #5a3e36;\n        }\n\n        .form-group input,\n        .form-group textarea,\n        .form-group select {\n            width: 100%;\n            padding: 8px 12px;\n            border: 1px solid #ddd;\n            border-radius: 4px;\n            font-size: 14px;\n        }\n\n        .form-group textarea {\n            resize: vertical;\n            min-height: 80px;\n        }\n\n        .button {\n            padding: 10px 20px;\n            background: #5a3e36;\n            color: white;\n            border: none;\n            border-radius: 4px;\n            cursor: pointer;\n            font-size: 14px;\n            transition: background 0.3s;\n        }\n\n        .button:hover {\n            background: #8b7355;\n        }\n\n        .button.secondary {\n            background: #8b7355;\n        }\n\n        .button.secondary:hover {\n            background: #5a3e36;\n        }\n\n        .message {\n            padding: 12px;\n            border-radius: 4px;\n            margin-bottom: 15px;\n        }\n\n        .message.success {\n            background: #d4edda;\n            color: #155724;\n            border: 1px solid #c3e6cb;\n        }\n\n        .message.error {\n            background: #f8d7da;\n            color: #721c24;\n            border: 1px solid #f5c6cb;\n        }\n\n        .import-section {\n            background: white;\n            padding: 20px;\n            border-radius: 8px;\n            box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n        }\n\n        .file-input-wrapper {\n            position: relative;\n            overflow: hidden;\n            display: inline-block;\n            width: 100%;\n        }\n\n        .file-input-wrapper input[type=file] {\n            position: absolute;\n            left: -9999px;\n        }\n\n        .file-label {\n            display: block;\n            padding: 40px;\n            border: 2px dashed #5a3e36;\n            border-radius: 4px;\n            text-align: center;\n            cursor: pointer;\n            transition: all 0.3s;\n            background: #fafafa;\n        }\n\n        .file-label:hover {\n            background: #f5f5f5;\n            border-color: #8b7355;\n        }\n\n        .file-label p {\n            margin: 0;\n            color: #666;\n        }\n\n        .file-label .filename {\n            display: block;\n            margin-top: 10px;\n            color: #5a3e36;\n            font-weight: 600;\n        }\n\n        @media (max-width: 1024px) {\n            .dashboard {\n                grid-template-columns: 1fr;\n            }\n        }\n    </style>\n</head>\n<body>\n    <div class=\"header\">\n        <h1>📋 Proof Approval Platform</h1>\n        <p>Gippsland Printers - Job & Approval Tracking</p>\n    </div>\n\n    <div class=\"container\">\n        <div class=\"tabs\">\n            <button class=\"tab-button active\" onclick=\"switchTab('dashboard')\">Dashboard</button>\n            <button class=\"tab-button\" onclick=\"switchTab('sendProof')\">Send Proof</button>\n            <button class=\"tab-button\" onclick=\"switchTab('importJobs')\">Import Jobs</button>\n        </div>\n\n        <!-- Dashboard Tab -->\n        <div id=\"dashboard\" class=\"tab-content active\">\n            <div class=\"dashboard\" id=\"dashboardContent\">\n                <div class=\"column\">\n                    <h2>📥 Waiting for Proof</h2>\n                    <div id=\"column-waiting\"></div>\n                </div>\n                <div class=\"column\">\n                    <h2>⏳ Proof Sent</h2>\n                    <div id=\"column-sent\"></div>\n                </div>\n                <div class=\"column\">\n                    <h2>✅ Approved</h2>\n                    <div id=\"column-approved\"></div>\n                </div>\n            </div>\n            <p style=\"text-align: center; color: #999; margin-top: 30px; font-size: 12px;\">Auto-refreshing every 30 seconds</p>\n        </div>\n\n        <!-- Send Proof Tab -->\n        <div id=\"sendProof\" class=\"tab-content\">\n            <div style=\"max-width: 500px; margin: 0 auto;\">\n                <div class=\"import-section\">\n                    <h2 style=\"color: #5a3e36; margin-bottom: 20px;\">📤 Send Proof to Client</h2>\n                    <div id=\"sendMessage\"></div>\n                    <div class=\"form-group\">\n                        <label>Select Job</label>\n                        <select id=\"jobSelect\" onchange=\"updateJobDetails()\">\n                            <option value=\"\">-- Select a job --</option>\n                        </select>\n                    </div>\n                    <div class=\"form-group\">\n                        <label>Client Email</label>\n                        <input type=\"email\" id=\"clientEmail\" placeholder=\"client@example.com\">\n                    </div>\n                    <div class=\"form-group\">\n                        <label>Proof File Link</label>\n                        <input type=\"url\" id=\"proofLink\" placeholder=\"https://...\">\n                    </div>\n                    <div class=\"form-group\">\n                        <label>Instructions</label>\n                        <textarea id=\"proofNotes\" placeholder=\"Any special instructions for approval...\"></textarea>\n                    </div>\n                    <button class=\"button\" onclick=\"sendProof()\">Send Proof</button>\n                </div>\n            </div>\n        </div>\n\n        <!-- Import Jobs Tab -->\n        <div id=\"importJobs\" class=\"tab-content\">\n            <div style=\"max-width: 600px; margin: 0 auto;\">\n                <div class=\"import-section\">\n                    <h2 style=\"color: #5a3e36; margin-bottom: 20px;\">📥 Import Jobs from CSV</h2>\n                    <p style=\"color: #666; margin-bottom: 20px;\">Upload a CSV file with columns: JobID, ClientName, ClientEmail, Description, Deadline</p>\n                    <div id=\"importMessage\"></div>\n                    <div class=\"file-input-wrapper\">\n                        <input type=\"file\" id=\"csvFile\" accept=\".csv\" onchange=\"handleFileSelect(event)\">\n                        <label for=\"csvFile\" class=\"file-label\">\n                            <p>📁 Click to select CSV file or drag and drop</p>\n                            <span class=\"filename\" id=\"fileName\"></span>\n                        </label>\n                    </div>\n                    <button class=\"button\" onclick=\"importCSV()\" style=\"width: 100%; margin-top: 20px;\">Import Jobs</button>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <script>\n        const API_BASE = window.location.origin + '/api';\n\n        // Initialize\n        document.addEventListener('DOMContentLoaded', function() {\n            loadDashboard();\n            loadJobsForSelect();\n            setInterval(loadDashboard, 30000);\n        });\n\n        function switchTab(tabName) {\n            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));\n            document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));\n            document.getElementById(tabName).classList.add('active');\n            event.target.classList.add('active');\n        }\n\n        function loadDashboard() {\n            fetch(`${API_BASE}/jobs`)\n                .then(r => r.json())\n                .then(jobs => renderDashboard(jobs))\n                .catch(e => console.error('Error loading dashboard:', e));\n        }\n\n        function renderDashboard(jobs) {\n            const waiting = jobs.filter(j => j.status === 'waiting');\n            const sent = jobs.filter(j => j.status === 'sent');\n            const approved = jobs.filter(j => j.status === 'approved');\n\n            document.getElementById('column-waiting').innerHTML = waiting.map(job => createJobCard(job)).join('');\n            document.getElementById('column-sent').innerHTML = sent.map(job => createJobCard(job)).join('');\n            document.getElementById('column-approved').innerHTML = approved.map(job => createJobCard(job)).join('');\n\n            setupDragDrop();\n        }\n\n        function createJobCard(job) {\n            const now = new Date();\n            const deadline = new Date(job.deadline);\n            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));\n            let warning = '';\n\n            if (job.status === 'sent') {\n                if (daysLeft <= 2) {\n                    warning = `<div class=\"warning red\">⚠️ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left!</div>`;\n                } else if (daysLeft <= 4) {\n                    warning = `<div class=\"warning yellow\">⏰ ${daysLeft} days left</div>`;\n                }\n            }\n\n            return `\n                <div class=\"job-card\" draggable=\"true\" data-job-id=\"${job.id}\">\n                    <div class=\"job-id\">${job.id}</div>\n                    <div class=\"job-client\">${job.client_name}</div>\n                    <div class=\"job-date\">Due: ${deadline.toLocaleDateString()}</div>\n                    ${warning}\n                </div>\n            `;\n        }\n\n        function setupDragDrop() {\n            const cards = document.querySelectorAll('.job-card');\n            const columns = document.querySelectorAll('.column > div:last-child');\n\n            cards.forEach(card => {\n                card.addEventListener('dragstart', (e) => {\n                    e.dataTransfer.effectAllowed = 'move';\n                    e.target.classList.add('dragging');\n                });\n                card.addEventListener('dragend', (e) => {\n                    e.target.classList.remove('dragging');\n                });\n            });\n\n            columns.forEach(col => {\n                col.addEventListener('dragover', (e) => {\n                    e.preventDefault();\n                    e.dataTransfer.dropEffect = 'move';\n                });\n                col.addEventListener('drop', (e) => {\n                    e.preventDefault();\n                    const card = document.querySelector('.job-card.dragging');\n                    if (card) {\n                        const jobId = card.dataset.jobId;\n                        const newStatus = getStatusFromColumn(col);\n                        updateJobStatus(jobId, newStatus);\n                    }\n                });\n            });\n        }\n\n        function getStatusFromColumn(col) {\n            if (col.id === 'column-waiting') return 'waiting';\n            if (col.id === 'column-sent') return 'sent';\n            if (col.id === 'column-approved') return 'approved';\n        }\n\n        function updateJobStatus(jobId, newStatus) {\n            fetch(`${API_BASE}/jobs/${jobId}`, {\n                method: 'PATCH',\n                headers: { 'Content-Type': 'application/json' },\n                body: JSON.stringify({ status: newStatus })\n            })\n            .then(r => r.json())\n            .then(() => loadDashboard())\n            .catch(e => console.error('Error updating job:', e));\n        }\n\n        function loadJobsForSelect() {\n            fetch(`${API_BASE}/jobs`)\n                .then(r => r.json())\n                .then(jobs => {\n                    const select = document.getElementById('jobSelect');\n                    select.innerHTML = '<option value=\"\">-- Select a job --</option>' +\n                        jobs.map(j => `<option value=\"${j.id}\">${j.id} - ${j.client_name}</option>`).join('');\n                })\n                .catch(e => console.error('Error loading jobs:', e));\n        }\n\n        function updateJobDetails() {\n            const jobId = document.getElementById('jobSelect').value;\n            if (!jobId) return;\n\n            fetch(`${API_BASE}/jobs/${jobId}`)\n                .then(r => r.json())\n                .then(job => {\n                    document.getElementById('clientEmail').value = job.client_email || '';\n                })\n                .catch(e => console.error('Error loading job details:', e));\n        }\n\n        function sendProof() {\n            const jobId = document.getElementById('jobSelect').value;\n            const email = document.getElementById('clientEmail').value;\n            const link = document.getElementById('proofLink').value;\n            const notes = document.getElementById('proofNotes').value;\n\n            if (!jobId || !email || !link) {\n                showMessage('sendMessage', 'Please fill in all required fields', 'error');\n                return;\n            }\n\n            fetch(`${API_BASE}/proofs`, {\n                method: 'POST',\n                headers: { 'Content-Type': 'application/json' },\n                body: JSON.stringify({\n                    job_id: jobId,\n                    client_email: email,\n                    proof_link: link,\n                    notes: notes\n                })\n            })\n            .then(r => r.json())\n            .then(() => {\n                showMessage('sendMessage', 'Proof sent successfully!', 'success');\n                document.getElementById('proofNotes').value = '';\n                setTimeout(() => {\n                    document.getElementById('jobSelect').value = '';\n                    document.getElementById('clientEmail').value = '';\n                    document.getElementById('proofLink').value = '';\n                }, 1000);\n                loadDashboard();\n            })\n            .catch(e => showMessage('sendMessage', 'Error sending proof: ' + e.message, 'error'));\n        }\n\n        function handleFileSelect(event) {\n            const file = event.target.files[0];\n            if (file) {\n                document.getElementById('fileName').textContent = '✓ ' + file.name;\n            }\n        }\n\n        function importCSV() {\n            const file = document.getElementById('csvFile').files[0];\n            if (!file) {\n                showMessage('importMessage', 'Please select a file', 'error');\n                return;\n            }\n\n            const formData = new FormData();\n            formData.append('file', file);\n\n            fetch(`${API_BASE}/import`, {\n                method: 'POST',\n                body: formData\n            })\n            .then(r => r.json())\n            .then(result => {\n                showMessage('importMessage', `Successfully imported ${result.imported} jobs!`, 'success');\n                document.getElementById('csvFile').value = '';\n                document.getElementById('fileName').textContent = '';\n                setTimeout(() => {\n                    loadDashboard();\n                    loadJobsForSelect();\n                }, 1000);\n            })\n            .catch(e => showMessage('importMessage', 'Error importing CSV: ' + e.message, 'error'));\n        }\n\n        function showMessage(elementId, message, type) {\n            const el = document.getElementById(elementId);\n            el.innerHTML = `<div class=\"message ${type}\">${message}</div>`;\n            setTimeout(() => el.innerHTML = '', 5000);\n        }\n    </script>\n</body>\n</html>\n`);
});
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
