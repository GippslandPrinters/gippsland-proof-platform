# Gippsland Printers - Proof Approval & Workflow Platform

A complete proof approval and job workflow management system for Gippsland Printers.

## Features

✅ **CSV Import** — Upload E&P job exports to populate dashboard
✅ **Job Dashboard** — Three-column workflow (Waiting for Design → Proofs Sent → Approved & Ready)
✅ **Drag & Drop** — Move jobs between statuses with simple drag-and-drop
✅ **Proof Sending** — Tim sends proofs, clients approve via unique links (no login needed)
✅ **Color Warnings** — Yellow (aging) and Red (overdue) indicators
✅ **Email Notifications** — Automatic emails to art@, print@, and clients via Zapier
✅ **Version History** — Track multiple proof versions for each job
✅ **Real-time Updates** — Dashboard refreshes every 30 seconds

## Architecture

**Backend:** Node.js + Express
**Database:** SQLite (starts local, can upgrade to PostgreSQL)
**Frontend:** Vanilla JavaScript + HTML/CSS
**Notifications:** Zapier webhooks for email

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Environment

Copy `.env.example` to `.env` and update with your details:

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
BASE_URL=https://your-production-domain.com
ZAPIER_WEBHOOK=https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/
ART_EMAIL=art@gippslandprinters.com.au
PRINT_EMAIL=print@gippslandprinters.com.au
```

### 3. Start the Server

```bash
npm start
```

Server runs on `http://localhost:3000`

### 4. Access Dashboard

Open `http://localhost:3000` in your browser

## How to Use

### Importing Jobs

1. Export your E&P job list as CSV
2. On the dashboard, click "Import Jobs from E&P"
3. Select the CSV file and click "Import Jobs"
4. Dashboard updates with all jobs

### Sending Proofs

**Tim's workflow:**
1. Click "📤 Send Proof" tab
2. Enter: Job Number, Client Email, Proof PDF, Version
3. Click "Send Proof"
4. Client receives email with approval link
5. Proof status shows in dashboard

### Approving Proofs

**Client's workflow:**
1. Receives email with unique approval link
2. Clicks link (no login needed)
3. Views proof PDF
4. Clicks "Approve" or "Request Changes"
5. Approval recorded, notifications sent

### Workflow Status Updates

**Matt & Nathan:**
1. Drag jobs between columns to update status
2. Yellow warning = job waiting 3+ days (design) or 4+ days (proof)
3. Red warning = job waiting 5+ days (design) or 7+ days (proof)
4. Approved jobs automatically move to "GP to Print"

## Email Notifications (Zapier Setup)

### What Triggers Emails

| Event | Recipients | When |
|-------|-----------|------|
| Proof Sent | Client | Tim sends proof link |
| Proof Approved | art@, print@, client | Client clicks approve |
| Proof Rejected | art@ | Client requests changes |

### Setting Up Zapier Webhooks

**Step 1: Create Zapier Account**
- Go to zapier.com
- Sign up (free account works)

**Step 2: Create Proof Sent Zap**
1. Click "Create Zap"
2. Trigger: "Webhooks by Zapier" → "Catch Raw Hook"
3. Copy your webhook URL from Zapier
4. Paste into `.env` as `ZAPIER_WEBHOOK=`
5. Action: "Email" → "Send Outbound Email"
6. Set up email template:

```
To: {{clientEmail}}
Subject: Your Proof is Ready for Approval - Job #{{jobNumber}}
Body:
Hi,

Your proof for job #{{jobNumber}} is ready for approval.

Click here to approve: {{proofUrl}}

- No login needed
- You can request changes or approve
- Art team will be notified of your decision

Best regards,
Gippsland Printers
Tim, Design Studio
```

**Step 3: Create Proof Approved Zap**
1. Click "Create Zap"
2. Trigger: "Webhooks by Zapier" → "Catch Raw Hook"
3. Use same webhook URL
4. Filter: `event = "proof_approved"`
5. Action: "Email" → Send to art@ and print@

Template:
```
To: {{artEmail}}, {{printEmail}}
Subject: ✅ PROOF APPROVED - Job #{{jobNumber}}
Body:
Job #{{jobNumber}} has been approved by client.

Status: Ready for Production
Client: {{jobNumber}}

Update E&P and move to "GP to Print"

Next: Upload final artwork to E&P
```

**Step 4: Create Proof Rejected Zap**
1. Click "Create Zap"
2. Trigger: "Webhooks by Zapier" → "Catch Raw Hook"
3. Filter: `event = "proof_rejected"`
4. Action: "Email" → Send to art@

Template:
```
To: {{artEmail}}
Subject: ⚠️ PROOF REJECTED - Job #{{jobNumber}}
Body:
Client requested changes on Job #{{jobNumber}}

Reason: {{reason}}

Please review and upload revised proof.
```

## Database

SQLite database (`gippsland-proof.db`) stores:
- **jobs** — All imported jobs from E&P
- **proofs** — Proof files and versions
- **approvals** — Client approval records

Backup your database regularly.

## Deployment to Production

### Option 1: Railway (Recommended)

1. Create account at railway.app
2. Connect GitHub repo
3. Set environment variables in Railway dashboard
4. Deploy — Railway auto-scales

### Option 2: Render

1. Create account at render.com
2. Create "New Web Service"
3. Connect GitHub
4. Set environment variables
5. Deploy

### Option 3: AWS/DigitalOcean

For more control, deploy to VPS:

```bash
# Install Node.js on your server
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone your-repo
cd gippsland-proof-platform/backend
npm install --production

# Use PM2 to keep server running
sudo npm install -g pm2
pm2 start server.js --name "proof-platform"
pm2 startup
```

## API Endpoints

```
POST   /api/jobs/upload          — Import CSV jobs
GET    /api/jobs                 — Get all jobs
GET    /api/dashboard            — Get dashboard data (grouped)
PATCH  /api/jobs/:jobId          — Update job status
POST   /api/proofs               — Create/send proof
GET    /api/proofs/:proofId      — View proof PDF
POST   /api/proofs/:proofId/approve    — Approve proof
POST   /api/proofs/:proofId/reject     — Reject proof
GET    /api/health               — Health check
```

## Troubleshooting

**Dashboard not loading?**
- Check browser console for errors
- Verify API is running on correct port
- Check CORS settings

**Emails not sending?**
- Verify Zapier webhook URL in `.env`
- Check Zapier dashboard for failed tasks
- Test webhook with curl:
  ```bash
  curl -X POST https://hooks.zapier.com/hooks/catch/YOUR_ID/ \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}'
  ```

**Proofs not uploading?**
- Check file size (max 25MB by default)
- Ensure `uploads/` folder exists
- Check disk space

**Jobs not importing?**
- Verify CSV format matches E&P export
- Check for header row
- Ensure email column exists

## Future Enhancements

- [ ] Live E&P API integration (when available)
- [ ] Client login portal with approval history
- [ ] Automated job routing based on type
- [ ] Payment status blocking (optional)
- [ ] Mobile app
- [ ] Analytics dashboard

## Support

For issues or questions:
- Check this README first
- Review Zapier dashboard for webhook errors
- Test API with Postman

---

Built for Gippsland Printers with ❤️ by Claude
