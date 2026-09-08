const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8080;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || ''
  }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`);
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

const proofs = new Map();

app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Gippsland Printers - Proof Upload</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
    button { background-color: #1e3a5f; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background-color: #152d47; }
  </style>
</head>
<body>
  <h1>Upload Proof for Approval</h1>
  <form id="proofForm">
    <div class="form-group">
      <label for="customerName">Customer Name:</label>
      <input type="text" id="customerName" name="customerName" required>
    </div>
    <div class="form-group">
      <label for="customerEmail">Customer Email:</label>
      <input type="email" id="customerEmail" name="customerEmail" required>
    </div>
    <div class="form-group">
      <label for="jobDetails">Job Details:</label>
      <textarea id="jobDetails" name="jobDetails" rows="4" required></textarea>
    </div>
    <div class="form-group">
      <label for="proof">PDF Proof:</label>
      <input type="file" id="proof" name="proof" accept=".pdf" required>
    </div>
    <button type="submit">Upload & Send Proof</button>
  </form>
  <div id="result"></div>
  <script>
    document.getElementById('proofForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData();
      formData.append('customerName', document.getElementById('customerName').value);
      formData.append('customerEmail', document.getElementById('customerEmail').value);
      formData.append('jobDetails', document.getElementById('jobDetails').value);
      formData.append('proof', document.getElementById('proof').files[0]);
      try {
        const response = await fetch('/api/send-proof', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          document.getElementById('result').innerHTML = '<div style="color:green"><h3>Success!</h3><p>Proof uploaded and email sent</p></div>';
          document.getElementById('proofForm').reset();
        } else {
          document.getElementById('result').innerHTML = '<div style="color:red">Error: ' + data.error + '</div>';
        }
      } catch (err) {
        document.getElementById('result').innerHTML = '<div style="color:red">Error: ' + err.message + '</div>';
      }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

app.get('/approve/:token', (req, res) => {
  const token = req.params.token;
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Approve Proof</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    button { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-right: 10px; }
    .approve-btn { background-color: #28a745; color: white; }
    .reject-btn { background-color: #dc3545; color: white; }
    textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Proof Approval</h1>
  <div id="content">Loading...</div>
  <script>
    async function loadProof() {
      try {
        const response = await fetch('/api/approve/${token}');
        const proof = await response.json();
        if (proof.error) {
          document.getElementById('content').innerHTML = '<div style="color:red">Proof not found</div>';
          return;
        }
        const html = '<p><strong>Job ID:</strong> ' + proof.jobId + '</p>' +
          '<p><strong>Status:</strong> ' + proof.status + '</p>' +
          '<p><a href="/uploads/' + proof.fileName + '" target="_blank">View PDF</a></p>' +
          '<textarea id="feedback" placeholder="Optional feedback"></textarea>' +
          '<br><button class="approve-btn" onclick="submitResponse(\\'approve\\')">Approve</button>' +
          '<button class="reject-btn" onclick="submitResponse(\\'reject\\')">Request Changes</button>' +
          '<div id="response"></div>';
        document.getElementById('content').innerHTML = html;
      } catch (err) {
        document.getElementById('content').innerHTML = '<div style="color:red">Error: ' + err.message + '</div>';
      }
    }
    async function submitResponse(action) {
      try {
        const response = await fetch('/api/approve/${token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, feedback: document.getElementById('feedback').value })
        });
        const data = await response.json();
        document.getElementById('response').innerHTML = data.success ? '<div style="color:green">' + data.message + '</div>' : '<div style="color:red">Error: ' + data.error + '</div>';
      } catch (err) {
        document.getElementById('response').innerHTML = '<div style="color:red">Error: ' + err.message + '</div>';
      }
    }
    loadProof();
  </script>
</body>
</html>`;
  res.send(html);
});

app.post('/api/send-proof', upload.single('proof'), (req, res) => {
  const { customerName, customerEmail, jobDetails } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No proof file provided' });
  if (!customerName || !customerEmail || !jobDetails) return res.status(400).json({ error: 'All fields required' });

  const approvalToken = crypto.randomBytes(16).toString('hex');
  proofs.set(approvalToken, {
    jobId: `PROOF_${Date.now()}`,
    fileName: req.file.filename,
    filePath: req.file.path,
    approvalToken: approvalToken,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  const approvalLink = `${req.protocol}://${req.get('host')}/approve/${approvalToken}`;
  res.json({ success: true, approvalLink: approvalLink });

  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    setImmediate(() => {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: customerEmail,
        subject: `Proof Approval Request - ${jobDetails}`,
        html: `<h2>Proof Approval Required</h2><p>Hello ${customerName},</p><p>Your proof for <strong>${jobDetails}</strong> is ready for approval.</p><p><a href="${approvalLink}">Review & Approve Proof</a></p>`
      }, (error) => {
        if (error) console.error('Email error:', error);
      });
    });
  }
});

app.get('/api/approve/:token', (req, res) => {
  const proof = proofs.get(req.params.token);
  res.status(proof ? 200 : 404).json(proof || { error: 'Proof not found' });
});

app.post('/api/approve/:token', express.json(), (req, res) => {
  const proof = proofs.get(req.params.token);
  if (!proof) return res.status(404).json({ error: 'Proof not found' });
  
  const newStatus = req.body.action === 'approve' ? 'approved' : 'rejected';
  proof.status = newStatus;
  res.json({ success: true, message: `Proof ${newStatus}` });

  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    setImmediate(() => {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'art@gippslandprinters.com.au',
        subject: `Proof ${newStatus.toUpperCase()} - Job ${proof.jobId}`,
        html: `<h2>Proof ${newStatus.toUpperCase()}</h2><p>Job ID: ${proof.jobId}</p><p>Timestamp: ${new Date().toISOString()}</p>`
      }, (error) => {
        if (error) console.error('Email error:', error);
      });
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
