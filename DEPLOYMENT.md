# Deployment Guide - Gippsland Printers Proof Platform

Deploy your proof platform to production in 15 minutes.

## Quick Start: Deploy to Railway ⚡

Railway is the easiest option. Auto-scales, free SSL, and costs ~$5-10/month.

### Step 1: Prepare Repository

```bash
# At root of project, create Procfile
echo "web: cd backend && npm install && npm start" > Procfile
```

Create `.railwayapp.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "dockerfile"
  },
  "deploy": {
    "startCommand": "cd backend && npm install && npm start"
  }
}
```

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Proof platform"
git remote add origin https://github.com/YOUR_USERNAME/gippsland-proof-platform.git
git push -u origin main
```

### Step 3: Deploy on Railway

1. Go to **railway.app**
2. Click "Start a New Project"
3. Select "Deploy from GitHub"
4. Authorize and select your repo
5. Railway auto-detects and deploys

### Step 4: Set Environment Variables

In Railway dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add:
   ```
   PORT=3000
   NODE_ENV=production
   BASE_URL=https://your-railway-domain.up.railway.app
   ZAPIER_WEBHOOK=https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/
   ART_EMAIL=art@gippslandprinters.com.au
   PRINT_EMAIL=print@gippslandprinters.com.au
   ```
4. Click "Deploy" to redeploy with new variables

### Step 5: Get Your URL

Your app is live at: `https://your-railway-domain.up.railway.app`

---

## Alternative: Deploy to Render

Similar process, also free tier available.

### Step 1: Create Render Account

1. Go to **render.com**
2. Sign up
3. Click "New +"
4. Select "Web Service"

### Step 2: Connect GitHub

1. Select "GitHub"
2. Authorize and select your repo
3. Name: `gippsland-proof-platform`
4. Runtime: Node
5. Build command: `cd backend && npm install`
6. Start command: `cd backend && npm start`

### Step 3: Set Environment Variables

In Render dashboard → Environment:
```
PORT=3000
NODE_ENV=production
BASE_URL=https://your-render-domain.onrender.com
ZAPIER_WEBHOOK=https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/
ART_EMAIL=art@gippslandprinters.com.au
PRINT_EMAIL=print@gippslandprinters.com.au
```

### Step 4: Deploy

Click "Deploy" - your app goes live in ~2 minutes

---

## Setup: Local Development

For testing before deployment:

```bash
# Install dependencies
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values
nano .env

# Start server
npm start

# Server runs on http://localhost:3000
```

---

## Setup: Self-Hosted (VPS/Dedicated Server)

For full control, host on your own server:

### Prerequisites
- Ubuntu 20.04+ or similar
- Node.js 18+
- PostgreSQL (recommended over SQLite for production)

### Installation

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PostgreSQL (optional but recommended)
sudo apt install postgresql postgresql-contrib -y

# 4. Clone repository
git clone your-repo-url
cd gippsland-proof-platform/backend

# 5. Install dependencies
npm install --production

# 6. Setup environment
cp .env.example .env
nano .env  # Edit with your values

# 7. Create systemd service
sudo nano /etc/systemd/system/proof-platform.service
```

Add to service file:
```ini
[Unit]
Description=Gippsland Proof Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/ubuntu/gippsland-proof-platform/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable proof-platform
sudo systemctl start proof-platform

# Check status
sudo systemctl status proof-platform
```

### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Auto-renew
sudo systemctl enable certbot.timer
```

### Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/proof-platform
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/proof-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Upgrade Database to PostgreSQL

For production, upgrade from SQLite:

```bash
# Install PostgreSQL client
npm install pg

# Create .env variable
DATABASE_URL=postgresql://user:password@localhost/gippsland_proofs

# Update server.js to use PostgreSQL
# (provides migration script on request)
```

---

## Monitoring & Maintenance

### Backup Database

```bash
# SQLite
cp gippsland-proof.db gippsland-proof.db.backup

# PostgreSQL
pg_dump gippsland_proofs > backup.sql

# Store off-site (AWS S3, Google Cloud, etc.)
```

### Monitor Logs

```bash
# Local
npm start  # See logs in terminal

# Systemd
sudo journalctl -u proof-platform -f

# Railway
Railway dashboard → Logs tab

# Render
Render dashboard → Logs tab
```

### Performance Tuning

- Set `NODE_ENV=production` (2-3x faster)
- Use PostgreSQL for large datasets
- Enable gzip compression in Nginx
- Monitor disk usage for PDF uploads

---

## Custom Domain Setup

### Connect Your Domain

**Railway:**
1. Go to your project → Settings
2. Add custom domain: `proofs.yourdomain.com`
3. Update DNS CNAME to Railway's provided target

**Render:**
1. Project Settings → Custom Domains
2. Add `proofs.yourdomain.com`
3. Update DNS CNAME

**Self-hosted:**
1. Point DNS A record to your server IP
2. Certificate auto-renews

---

## Troubleshooting Deployment

**App not starting?**
```bash
# Check for syntax errors
node -c backend/server.js

# Check environment variables
echo $PORT $NODE_ENV

# Review logs
tail -f ~/.pm2/logs/proof-platform-error.log
```

**Database errors?**
```bash
# Verify database file exists
ls -la backend/gippsland-proof.db

# Rebuild database
rm gippsland-proof.db
npm start  # Recreates on startup
```

**Port already in use?**
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

**Email not sending?**
- Check Zapier webhook URL in `.env`
- Test webhook with curl:
  ```bash
  curl -X POST https://hooks.zapier.com/hooks/catch/YOUR_ID/ \
    -H "Content-Type: application/json" \
    -d '{"test":"data"}'
  ```

---

## Next Steps

1. ✅ Deploy to production (Railway/Render/Self-hosted)
2. ✅ Set up Zapier webhooks for email notifications
3. ✅ Import your first E&P job export
4. ✅ Send test proof to client
5. ✅ Monitor logs and performance

Your platform is ready to manage 14 waiting proofs! 🚀
