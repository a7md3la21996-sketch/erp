import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const cid = '5b255389-7d8b-4d78-a1c1-3ad5fb2f0ab3';

// Sample one row from each related table to find columns
for (const t of ['activities', 'tasks', 'opportunities', 'deals', 'stage_history']) {
  const { data: sample } = await supabase.from(t).select('*').limit(1);
  console.log(`\n=== ${t} columns ===`);
  console.log(sample?.[0] ? Object.keys(sample[0]).join(', ') : 'no rows');
}
