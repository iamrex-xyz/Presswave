-- Run this in Supabase SQL Editor to create the presswave_emails table
-- URL: https://supabase.com/dashboard/project/vfjsyyextdvrvtirdpbh/sql

CREATE TABLE IF NOT EXISTS presswave_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  scan_url TEXT NOT NULL,
  score INTEGER,
  source TEXT DEFAULT 'scanner',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_presswave_emails_created_at ON presswave_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presswave_emails_email ON presswave_emails(email);
