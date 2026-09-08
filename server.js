const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8080;

console.log('=== Gippsland Proof Platform Starting ===');
console.log('PORT:', PORT);
console.log('EMAIL_USER configured:', !!process.env.EMAIL_USER);

// Configure email transporter only if credentials are set
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    console.log('✓ Email transporter configured');
  } catch (err) {
    console.error('Email config error:', err.message);
  }
} else {
  console.log('⚠ Email credentials not set - emails disabled');
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  console.log('✓ Uploads directory ready');
} catch (err) {
  console.error('Upload dir error:', err.message);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, name);
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

// Simple in-memory proof storage
const proofStorage = new Map();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Send proof
app.post('/api/send-proof', upload.single('proof'), (req, res) => {
  try {
    const { customerName, customerEmail, jobDetails } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No proof file provided' });
    }
    if (!customerName || !customerEmail || !jobDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const approvalToken = crypto.randomBytes(16).toString('hex');
    const approvalLink = `${req.protocol}://${req.get('host')}/approve/${approvalToken}`;

    // Store proof data
    proofStorage.set(approvalToken, {
      customerName,
      customerEmail,
      jobDetails,
      fileName: req.file.filename,
      filePath: req.file.path,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Send response immediately
    res.json({
      success: true,
      message: 'Proof uploaded' + (transporter ? ' - email queued' : ''),
      approvalToken,
      approvalLink,
      emailSent: transporter ? true : false
    });

    // Send email in background
    if (transporter) {
      setImmediate(() => {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: customerEmail,
          subject: `Proof Approval Request - ${jobDetails}`,
          html: `
            <h2>Proof Approval Required</h2>
            <p>Hello ${customerName},</p>
            <p>Your proof for <strong>${jobDetails}</strong> is ready for approval.</p>
            <p><a href="${approvalLink}" style="background-color: #1e3a5f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Review & Approve</a></p>
            <p>Or visit: <code>${approvalLink}</code></p>
            <p>Thank you,<br/>Gippsland Printers</p>
          `
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error('Email error:', err.message);
          } else {
            console.log('Email sent to:', customerEmail);
          }
        });
      });
    }
  } catch (err) {
    console.error('Send proof error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get proof details
app.get('/api/approve/:token', (req, res) => {
  const proof = proofStorage.get(req.params.token);
  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }
  res.json(proof);
});

// Submit approval/rejection
app.post('/api/approve/:token', express.json(), (req, res) => {
  const proof = proofStorage.get(req.params.token);
  if (!proof) {
    return res.status(404).json({ error: 'Proof not found' });
  }

  const { action, feedback } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  proof.status = action;
  proof.feedback = feedback;
  proof.approvedAt = new Date().toISOString();

  res.json({ success: true, message: `Proof ${action}ed` });

  // Send notification email
  if (transporter) {
    setImmediate(() => {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'info@gippslandprinters.com.au',
        subject: `Proof ${action.toUpperCase()} - ${proof.jobDetails}`,
        html: `<h2>Proof ${action.toUpperCase()}</h2><p>${proof.customerName} ${action}ed the proof.</p>${feedback ? `<p>Feedback: ${feedback}</p>` : ''}`
      }, (err) => {
        if (err) console.error('Notification error:', err.message);
        else console.log('Notification sent');
      });
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Ready at http://localhost:${PORT}`);
});
