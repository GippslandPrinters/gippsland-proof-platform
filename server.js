const express = require('express');
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

// In-memory storage
const proofs = new Map();

// Root route
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Gippsland Printers - Proof Upload</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #1e3a5f; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: Arial; box-sizing: border-box; }
    button { background-color: #1e3a5f; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
    button:hover { background-color: #152d47; }
    .success { color: #28a745; margin-top: 20px; padding: 10px; background: #d4edda; border-radius: 4px; }
    .error { color: #dc3545; margin-top: 20px; padding: 10px; background: #f8d7da; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
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
      <button type="submit">Upload & Generate Link</button>
    </form>
    <div id="result"></div>
  </div>

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
          const resultHtml = '<div class="success"><h3>✓ Success!</h3><p><strong>Approval Link:</strong></p><p><code>' + data.approvalLink + '</code></p><p>Share this link with ' + data.customerEmail + '</p></div>';
          document.getElementById('result').innerHTML = resultHtml;
          document.getElementById('proofForm').reset();
        } else {
          document.getElementById('result').innerHTML = '<div class="error">Error: ' + data.error + '</div>';
        }
      } catch (err) {
        document.getElementById('result').innerHTML = '<div class="error">Error: ' + err.message + '</div>';
      }
    });
  </script>
</body>
</html>`);
});

// Approval page
app.get('/approve/:token', (req, res) => {
  const token = req.params.token;
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Approve Proof - Gippsland Printers</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #1e3a5f; }
    .proof-info { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .buttons { margin-top: 20px; display: flex; gap: 10px; }
    button { padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
    .approve-btn { background-color: #28a745; color: white; }
    .approve-btn:hover { background-color: #218838; }
    .reject-btn { background-color: #dc3545; color: white; }
    .reject-btn:hover { background-color: #c82333; }
    textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .loading { text-align: center; color: #666; }
    .error { color: #dc3545; padding: 10px; background: #f8d7da; border-radius: 4px; }
    .success { color: #28a745; padding: 10px; background: #d4edda; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Review & Approve Proof</h1>
    <div id="content" class="loading">Loading proof...</div>
  </div>

  <script>
    async function loadProof() {
      try {
        const response = await fetch('/api/approve/${token}');
        const proof = await response.json();

        if (proof.error) {
          document.getElementById('content').innerHTML = '<div class="error">Proof not found</div>';
          return;
        }

        const html = '<div class="proof-info">' +
          '<p><strong>Job ID:</strong> ' + proof.jobId + '</p>' +
          '<p><strong>Status:</strong> ' + proof.status + '</p>' +
          '<p><a href="/uploads/' + proof.fileName + '" target="_blank">📄 View PDF</a></p>' +
          '</div>' +
          '<h3>Your Response</h3>' +
          '<textarea id="feedback" placeholder="Optional feedback (e.g., changes needed)"></textarea>' +
          '<div class="buttons">' +
          '<button class="approve-btn" onclick="submitResponse(\\'approve\\')">✓ Approve</button>' +
          '<button class="reject-btn" onclick="submitResponse(\\'reject\\')">✗ Request Changes</button>' +
          '</div>' +
          '<div id="response"></div>';

        document.getElementById('content').innerHTML = html;
      } catch (err) {
        document.getElementById('content').innerHTML = '<div class="error">Error: ' + err.message + '</div>';
      }
    }

    async function submitResponse(action) {
      const feedback = document.getElementById('feedback').value;
      try {
        const response = await fetch('/api/approve/${token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, feedback: feedback })
        });
        const data = await response.json();
        if (data.success) {
          document.getElementById('response').innerHTML = '<div class="success"><h3>✓ ' + data.message + '</h3></div>';
        } else {
          document.getElementById('response').innerHTML = '<div class="error">Error: ' + data.error + '</div>';
        }
      } catch (err) {
        document.getElementById('response').innerHTML = '<div class="error">Error: ' + err.message + '</div>';
      }
    }

    loadProof();
  </script>
</body>
</html>`);
});

// API: Send proof
app.post('/api/send-proof', upload.single('proof'), (req, res) => {
  const { customerName, customerEmail, jobDetails } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No proof file provided' });
  }

  if (!customerName || !customerEmail || !jobDetails) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const approvalToken = crypto.randomBytes(16).toString('hex');

  proofs.set(approvalToken, {
    jobId: `PROOF_${Date.now()}`,
    fileName: req.file.filename,
    filePath: req.file.path,
    approvalToken: approvalToken,
    status: 'pending',
    createdAt: new Date().toISOString(),
    customerName: customerName,
    customerEmail: customerEmail,
    jobDetails: jobDetails
  });

  const approvalLink = `${req.protocol}://${req.get('host')}/approve/${approvalToken}`;

  res.json({
    success: true,
    message: 'Proof uploaded successfully',
    approvalToken: approvalToken,
    approvalLink: approvalLink,
    customerEmail: customerEmail
  });
});

// API: Get proof details
app.get('/api/approve/:token', (req, res) => {
  const { token } = req.params;
  const proof = proofs.get(token);

  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  res.json(proof);
});

// API: Submit approval/rejection
app.post('/api/approve/:token', express.json(), (req, res) => {
  const { token } = req.params;
  const { action, feedback } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const proof = proofs.get(token);
  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  proof.status = newStatus;
  proof.feedback = feedback;

  res.json({
    success: true,
    message: `Proof ${newStatus}`
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
