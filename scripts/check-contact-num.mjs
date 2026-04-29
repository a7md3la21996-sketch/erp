import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const num = process.argv[2] || 'C-21807';
const numNum = num.replace(/[^0-9]/g, '');

// Try contact_number as text or as number
const { data, error } = await supabase.from('contacts')
  .select('*')
  .or(`contact_number.eq.${numNum},contact_number.eq."${num}"`);
console.log('found:', data?.length, 'err:', error);
if (data?.length) console.log(JSON.stringify(data, null, 2));

// Backup lookup — what was it before?
const id = data?.[0]?.id;
if (id) {
  console.log('\n=== Searching backups for id:', id, '===');
  const nada = JSON.parse(fs.readFileSync('scripts/backups/nada-removal-backup-2026-04-28T13-39-36-897Z.json'));
  const esraa = JSON.parse(fs.readFileSync('scripts/backups/esraa-transfer-backup-2026-04-28T13-44-22-868Z.json'));
  const inNada = nada.find(c => c.id === id);
  const inEsraaAlone = esraa.alone.find(c => c.id === id);
  const inEsraaShared = esraa.shared.find(c => c.id === id);
  console.log('In Nada-removal backup (was Nada+others):', inNada ? inNada.assigned_to_names : 'NO');
  console.log('In Esraa-alone backup (was Esraa-only):  ', inEsraaAlone ? inEsraaAlone.assigned_to_names : 'NO');
  console.log('In Esraa-shared backup (was Esraa+others):', inEsraaShared ? inEsraaShared.assigned_to_names : 'NO');
}
