#!/usr/bin/env node
// Create presswave_emails table in Supabase

const SUPABASE_URL = 'https://vfjsyyextdvrvtirdpbh.supabase.co';
const SUPABASE_SERVICE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmanN5eWV4dGR2cnZ0aXJkcGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzExNjc4NCwiZXhwIjoyMDg4NjkyNzg0fQ.MxmfLf3gjsqS68F6PaCazqnboD_QOLnaW9a6RU-Gnyg';

const SQL = `
CREATE TABLE IF NOT EXISTS presswave_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  scan_url TEXT NOT NULL,
  score INTEGER,
  source TEXT DEFAULT 'scanner',
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

async function createTable() {
  try {
    // Try inserting a test row (table will be created via frontend API if needed)
    // For now, just verify connection
    const res = await fetch(`${SUPABASE_URL}/rest/v1/presswave_emails?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_JWT,
        'Authorization': `Bearer ${SUPABASE_SERVICE_JWT}`
      }
    });
    
    if (res.status === 404 || res.status === 406) {
      console.error('Table does not exist. Create it manually in Supabase SQL editor:');
      console.log(SQL);
      process.exit(1);
    }
    
    console.log('Table check:', res.status, res.statusText);
    if (res.ok) {
      console.log('✅ presswave_emails table exists');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.log('\nCreate table manually in Supabase SQL editor:');
    console.log(SQL);
  }
}

createTable();
