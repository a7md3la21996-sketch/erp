import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const supabase = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

const cloneMap = JSON.parse(fs.readFileSync('/Users/ahmedaladdin/Downloads/platform-erp-v2/scripts/backups/phase1-sample-2026-04-29T17-06-14-808Z/clone-id-map.json'));
const stragglerId = 'af72f1c9-2efc-4c1b-af4c-fd2ce0791fb3';

// Find this activity
const { data: act } = await supabase.from('activities').select('id, contact_id, user_id').eq('id', stragglerId).single();
console.log('Straggler:', act);

// Find correct clone
const cloneId = cloneMap[act.contact_id]?.[act.user_id];
console.log('Should move to clone:', cloneId);

if (cloneId) {
  const { error } = await supabase.from('activities').update({ contact_id: cloneId }).eq('id', stragglerId);
  console.log(error ? `❌ ${error.message}` : '✅ Fixed');
}
