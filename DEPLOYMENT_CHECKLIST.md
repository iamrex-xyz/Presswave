# Presswave Scanner Deployment Checklist

## ✅ Completed

1. **API Endpoint Created** — `/api/scan.js`
   - URL scanning and press-readiness analysis
   - Email capture to unlock full report
   - Matched media contacts from Supabase
   - Handles scan and unlock actions

2. **Frontend Updated** — `index.html`
   - Scanner as primary hero CTA
   - Score display with circular progress (0-100)
   - Breakdown bars for 4 categories
   - 3 blurred contacts preview (teaser)
   - Email unlock flow
   - Full report with suggestions
   - CTA to $49 package

3. **Styles Added** — Scanner CSS integrated
   - Score circle with conic gradient animation
   - Breakdown bars with smooth transitions
   - Matched contacts list with blur effect
   - Email unlock form
   - Suggestions display

4. **JavaScript Functions** — Scanner logic
   - `runPressScanner()` — initiates scan
   - `displayScanResults()` — shows score + breakdown
   - `animateBar()` — animates progress bars
   - `unlockReport()` — email capture + unlock
   - `goToCheckout()` — redirect to purchase flow

5. **PostHog Events** — Analytics tracking
   - `scan_started` — user enters URL
   - `scan_completed` — scan finishes
   - `email_captured` — email provided
   - `checkout_clicked` — CTA clicked

6. **Git Commit & Push** — ✅ Deployed to GitHub
   - Commit: `76d030c` — "Add Press-Readiness Scanner tool"
   - Pushed to `iamrex-xyz/Presswave` (main branch)
   - Vercel auto-deploys from GitHub

## ⚠️ REQUIRED: Manual Setup

### 1. Create Supabase Table

**IMPORTANT:** The scanner requires the `presswave_emails` table to capture leads.

1. Go to Supabase SQL Editor:
   https://supabase.com/dashboard/project/vfjsyyextdvrvtirdpbh/sql

2. Run this SQL:
   ```sql
   CREATE TABLE IF NOT EXISTS presswave_emails (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email TEXT NOT NULL,
     scan_url TEXT NOT NULL,
     score INTEGER,
     source TEXT DEFAULT 'scanner',
     created_at TIMESTAMPTZ DEFAULT now()
   );

   CREATE INDEX IF NOT EXISTS idx_presswave_emails_created_at ON presswave_emails(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_presswave_emails_email ON presswave_emails(email);
   ```

3. Verify table exists:
   ```sql
   SELECT * FROM presswave_emails LIMIT 1;
   ```

### 2. Verify Deployment

1. Check Vercel deployment:
   https://vercel.com/agentpr (project: agentpr)

2. Wait for build to complete (usually 1-2 minutes)

3. Visit https://presswave.xyz

4. Test the scanner:
   - Enter a URL (e.g., https://stripe.com)
   - Click "Scan my site"
   - Verify score appears
   - Verify breakdown bars animate
   - Verify 3 contacts shown (blurred)
   - Enter email
   - Click "Unlock full report"
   - Verify contacts unblurred
   - Verify suggestions appear
   - Verify "Get me listed" CTA shows

### 3. Test Email Capture

After table creation:

1. Run a scan on https://presswave.xyz
2. Enter a test email
3. Check Supabase table:
   ```sql
   SELECT * FROM presswave_emails ORDER BY created_at DESC LIMIT 5;
   ```
4. Verify email, scan_url, and score are saved

### 4. Monitor PostHog

Check PostHog for events:
https://us.posthog.com/project/...

Events to verify:
- `scan_started`
- `scan_completed`
- `email_captured`
- `checkout_clicked`

## 🎯 Conversion Funnel

```
Homepage → Free Scanner (URL only)
    ↓
Scan Results (score + 3 blurred contacts) — FREE
    ↓
Email Prompt ("Unlock full report")
    ↓
Email Captured → Full Report (12 contacts + suggestions)
    ↓
CTA "Get me listed — $49"
    ↓
Existing checkout flow (Step 2)
```

## 📊 What Was Built

### API: `/api/scan.js`

**Endpoint:** POST /api/scan

**Analyzes:**
- Meta tags (title, description, OG tags)
- Social links (Twitter, LinkedIn)
- Content signals (pricing, press page, blog, case studies, founder story)
- Mobile-friendliness (viewport meta tag)

**Scoring (0-100):**
- Website Quality: /35 points
- Social Presence: /20 points
- Launch Readiness: /25 points
- Content Signals: /20 points

**Returns:**
- Score + breakdown
- Matched media contacts (3 for preview, 12 after unlock)
- Priority fix suggestions
- Meta analysis

**Actions:**
- `scan` — Initial free scan (no email)
- `unlock` — Email provided, unlock full report

### Frontend Components

1. **Scanner Card** (hero-right)
   - URL input
   - Scan button
   - Results display (hidden initially)

2. **Score Display**
   - Circular progress indicator (conic gradient)
   - Score 0-100
   - Status text (based on score)

3. **Breakdown Bars**
   - 4 categories with progress bars
   - Smooth width transitions
   - Score labels (e.g., "28/35")

4. **Matched Contacts**
   - 3 contacts (blurred initially)
   - Overlay with email prompt
   - 12 contacts after unlock (unblurred)

5. **Email Unlock**
   - Email input (centered)
   - Unlock button
   - Saves to Supabase

6. **Full Report**
   - Priority fix suggestions (up to 5)
   - CTA to purchase $49 package

## 📝 Files Changed

- `index.html` — Added scanner UI, CSS, JavaScript
- `api/scan.js` — NEW scanner API endpoint
- `SCANNER_SETUP.md` — Setup documentation
- `SETUP_TABLE.sql` — Supabase table creation SQL
- `DEPLOYMENT_CHECKLIST.md` — This file

## 🚀 Next Steps

1. ✅ **CRITICAL:** Create Supabase table (see above)
2. ✅ Verify Vercel deployment completed
3. ✅ Test scanner on live site
4. ✅ Monitor PostHog events
5. ✅ Check Supabase for captured emails

## ⚡ Quick Test

```bash
# Test scanner API locally
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com", "action": "scan"}'

# Test unlock
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com", "email": "test@example.com", "action": "unlock"}'
```

## 📈 Success Metrics

Track these in PostHog:
- Scanner usage rate (scans / visitors)
- Email capture rate (emails / scans)
- Conversion rate (checkouts / emails)

Expected funnel:
- 100 scans → 40 emails (40%) → 5 purchases (12.5%)
