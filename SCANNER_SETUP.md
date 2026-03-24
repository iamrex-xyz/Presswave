# Press-Readiness Scanner Setup

## Database Setup

The scanner requires a `presswave_emails` table in Supabase to capture email leads.

### Create the table

Run this in the Supabase SQL Editor:
https://supabase.com/dashboard/project/vfjsyyextdvrvtirdpbh/sql

```sql
CREATE TABLE IF NOT EXISTS presswave_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  scan_url TEXT NOT NULL,
  score INTEGER,
  source TEXT DEFAULT 'scanner',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_presswave_emails_created_at ON presswave_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presswave_emails_email ON presswave_emails(email);
```

## API Endpoints

### `/api/scan.js` (NEW)
Press-Readiness Scanner API

**POST /api/scan**
```json
{
  "url": "https://yourproduct.com",
  "action": "scan" | "unlock",
  "email": "user@example.com" // required for unlock action
}
```

**Response (scan):**
```json
{
  "score": 75,
  "breakdown": {
    "websiteQuality": 28,
    "socialPresence": 15,
    "launchReadiness": 20,
    "contentSignals": 12
  },
  "meta": { ... },
  "suggestions": ["...", "..."],
  "contacts": [{"name": "...", "blurred": true}, ...],
  "totalMatches": 300,
  "unlocked": false
}
```

**Response (unlock):**
```json
{
  "score": 75,
  "breakdown": { ... },
  "contacts": [{"name": "...", "description": "...", "audience_size": 50000}, ...],
  "suggestions": ["...", "..."],
  "unlocked": true
}
```

## Frontend Flow

1. User enters URL → `/api/scan` (action: scan)
2. Shows score + breakdown + 3 blurred contacts (FREE)
3. User enters email → `/api/scan` (action: unlock, email: "...")
4. Email saved to `presswave_emails`, full report unlocked
5. CTA to purchase $49 package → existing checkout flow

## PostHog Events

- `scan_started` — user initiates scan
- `scan_completed` — scan finishes, includes score
- `email_captured` — user unlocks report
- `checkout_clicked` — user clicks "Get me listed" CTA from scanner

## Deployment

1. Create Supabase table (see SQL above)
2. Commit changes to GitHub
3. Vercel auto-deploys from `iamrex-xyz/Presswave` repo
4. Verify scanner works at https://presswave.xyz

## Testing

Test locally (if needed):
```bash
cd presswave-site
npx vercel dev
```

Then visit http://localhost:3000 and test the scanner.
