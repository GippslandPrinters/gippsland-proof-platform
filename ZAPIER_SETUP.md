# Zapier Email Automation Setup

Complete step-by-step guide to set up automated email notifications for proof approvals.

## What You'll Set Up

| Event | Recipients | Email |
|-------|-----------|-------|
| Proof Sent | Client | "Your proof is ready - click to approve" |
| Proof Approved | art@, print@, client | "✅ Proof approved! Ready for production" |
| Proof Rejected | art@ | "⚠️ Changes requested - client feedback included" |

---

## Prerequisites

- Zapier account (free: zapier.com)
- Your deployed Proof Platform URL
- Gmail or Office 365 account for sending emails

---

## Step 1: Get Your Zapier Webhook URL

### Create New Zap

1. Go to **zapier.com** and log in
2. Click **"Create Zap"** (top left)
3. For trigger, search: **"Webhooks by Zapier"**
4. Click **"Catch Raw Hook"**
5. Click **"Continue"**

### Get Your Unique URL

You'll see a unique URL:
```
https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/
```

**Copy this URL** — you'll need it for your backend configuration.

### Save for Now (Don't Publish Yet)

Leave this tab open. We'll complete it after testing.

---

## Step 2: Update Backend Configuration

Add your Zapier webhook to `.env`:

```bash
# In your backend/.env file:
ZAPIER_WEBHOOK=https://hooks.zapier.com/hooks/catch/YOUR_ZAPIER_ID/
```

Then restart your backend:
```bash
npm start
```

---

## Step 3: Create "Proof Sent" Zap

### Trigger: Webhook Received

1. Create new Zap
2. Search: **"Webhooks by Zapier"**
3. Click **"Catch Raw Hook"**
4. Continue
5. Copy the webhook URL provided
6. **Important:** This should match your `.env` ZAPIER_WEBHOOK

### Action: Send Email

1. Click **"+ Add step"**
2. Search: **"Gmail"** or **"Outlook"** (use whatever you have)
3. Click **"Send Email"**
4. Click **"Connect"** and authorize (sign in to your email)
5. Configure email:

**Field: To**
```
{{clientEmail}}
```

**Field: Subject**
```
Your Proof is Ready for Approval - Job #{{jobNumber}}
```

**Field: Body (Rich Text)**
```
Hi,

Your proof for job #{{jobNumber}} is ready for approval!

🔗 Click here to approve: {{proofUrl}}

What to expect:
• No login required—just click the link
• Review your proof and approve or request changes
• Our team will be notified of your decision

---

If you have any questions, reply to this email.

Best regards,
Tim & the Design Team
Gippsland Printers

📍 South Gippsland, Victoria
🌱 Sustainable Print Solutions
```

6. Click **"Test & Review"**
7. Test with sample data:
   - clientEmail: your-email@gmail.com
   - jobNumber: TEST123
   - proofUrl: https://your-domain.com/proof/test-123

8. If test succeeds, click **"Publish"**

---

## Step 4: Create "Proof Approved" Zap

### Trigger: Webhook Received

1. Create new Zap
2. Search: **"Webhooks by Zapier"**
3. Click **"Catch Raw Hook"**
4. Use same webhook URL as Step 3
5. Continue

### Add Filter (Important!)

1. Click **"Filter by Zapier"**
2. Condition: 
   - `event` | `equals` | `proof_approved`

### Action: Send Email (Art)

1. Click **"+ Add Action"**
2. Search: **"Gmail"** or **"Outlook"**
3. Click **"Send Email"**
4. Authorize if needed

**Configure for Art Team:**

**Field: To**
```
{{artEmail}}
```

**Field: Subject**
```
✅ PROOF APPROVED - Job #{{jobNumber}}
```

**Field: Body**
```
Proof approved! Ready for production.

Job #: {{jobNumber}}
Client: [Client name from E&P]
Status: GP to Print

📋 Next steps:
1. Upload final production files to E&P
2. Confirm job is in "GP to Print" status
3. Production team will route (Digital/Offset)

Approved by: {{clientEmail}}
Time: {{timestamp}}
```

5. **Test & Review**
6. **Publish**

### Action: Send Email (Print)

Repeat the above, but send to:
```
{{printEmail}}
```

Same subject and body.

### Action: Send Confirmation to Client

Add another email:

**To:** `{{clientEmail}}`

**Subject:**
```
✓ Your Approval Confirmed - Job #{{jobNumber}}
```

**Body:**
```
Thank you for approving your proof!

We've received your approval and are preparing your job for production.

Job #: {{jobNumber}}
Expected delivery: [Your standard timeframe]

Your order is in good hands. We'll update you when production is complete.

Thanks,
Gippsland Printers
```

6. Test all three emails
7. Publish

---

## Step 5: Create "Proof Rejected" Zap

### Trigger: Webhook Received

1. Create new Zap
2. Search: **"Webhooks by Zapier"**
3. Click **"Catch Raw Hook"**
4. Use same webhook URL
5. Continue

### Add Filter

1. Click **"Filter by Zapier"**
2. Condition:
   - `event` | `equals` | `proof_rejected`

### Action: Send Email (Art)

1. Add Action → **"Gmail"** or **"Outlook"**

**To:**
```
{{artEmail}}
```

**Subject:**
```
⚠️ CHANGES REQUESTED - Job #{{jobNumber}}
```

**Body:**
```
Client feedback on proof:

Job #: {{jobNumber}}
Client: [Name from E&P]

Change Request:
{{reason}}

---

📝 Please review and upload revised proof.
Proof URL: {{proofUrl}}

Reply when ready to re-send!
```

2. Test & Review
3. Publish

### Optional: Notify Client Change Received

Add another action:

**To:** `{{clientEmail}}`

**Subject:**
```
We Received Your Feedback - Job #{{jobNumber}}
```

**Body:**
```
Thank you for your feedback! We received your change request:

{{reason}}

Our design team is already working on the revisions. You'll receive an updated proof within 24 hours.

We appreciate your attention to detail.

Best,
Gippsland Printers
```

---

## Step 6: Test the Complete Flow

### Test Proof Sent

1. Go to dashboard: `https://your-domain.com`
2. Click **"Send Proof"**
3. Fill in:
   - Job Number: `TEST-001`
   - Client Email: `your-email@gmail.com`
   - Upload any PDF
   - Version: `1`
4. Click **"Send Proof"**

**Check:**
- ✅ Email received from your email account (Gmail/Outlook)
- ✅ Proof link is clickable
- ✅ Zapier shows "Success" in task history

### Test Proof Approved

1. Click the approval link from the email
2. Review proof PDF
3. Click **"✓ Approve This Proof"**

**Check:**
- ✅ Success message appears
- ✅ Emails to art@, print@, client received
- ✅ Zapier shows 3 "Success" tasks (one per recipient)

### Test Proof Rejected

1. Send another proof
2. Click approval link
3. Click **"✗ Request Changes"**
4. Type: "Please make the logo bigger"
5. Click **"Send Feedback"**

**Check:**
- ✅ Email to art@ received with your feedback
- ✅ Optional: Confirmation email to client
- ✅ Zapier shows "Success"

---

## Troubleshooting Zapier

**"Email not received?"**
- Check spam folder
- Verify email addresses in `.env` are correct
- Check Zapier task history for errors
- Test webhook manually:
  ```bash
  curl -X POST https://hooks.zapier.com/hooks/catch/YOUR_ID/ \
    -H "Content-Type: application/json" \
    -d '{"event":"proof_sent","clientEmail":"test@gmail.com","jobNumber":"TEST","proofUrl":"https://example.com"}'
  ```

**"Zapier shows error?"**
- Click the failed task → View details
- Check if field names match (e.g., `clientEmail` vs `email`)
- Verify Gmail/Outlook is still authorized
- Re-authenticate email account

**"Webhook URL not matching?"**
- All three zaps must use the **same** webhook URL
- Copy from first "Catch Raw Hook" step
- Paste into `.env` exactly
- Restart backend after updating `.env`

---

## Pro Tips

**Custom Email Branding**
- Use your company logo/colors
- Add social links (Instagram, Facebook, etc.)
- Include your phone number

**Personalization**
- Use `{{customerName}}` if available in webhook data
- Add job details from E&P

**Follow-ups**
- Add a 4th Zap to send reminders if proof not approved after 3 days
- Use Zapier's "Delay" action to wait 72 hours, then check status

---

## Email Template Library

### Professional Tone
```
Dear {{clientName}},

We're pleased to present your proof for job #{{jobNumber}}.

Please review at your convenience and let us know if any adjustments are needed.

Click here to approve: {{proofUrl}}

Regards,
The Gippsland Printers Team
```

### Casual/Friendly Tone
```
Hi {{clientName}}!

Your proof is ready to go! 🎨

Have a look over: {{proofUrl}}

Love it? Click approve. Need tweaks? Just let us know!

Cheers,
Tim & Co.
```

---

## Next Steps

1. ✅ Create three Zaps (Sent, Approved, Rejected)
2. ✅ Test complete flow
3. ✅ Update email templates with your branding
4. ✅ Monitor Zapier logs for the first week
5. ✅ Adjust delays/timings as needed

Your automated proof workflow is live! 🚀
