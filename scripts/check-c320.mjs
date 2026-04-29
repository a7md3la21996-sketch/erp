import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

// Check both potentially problematic states
const { data: c1 } = await supabase.from('contacts').select('*').eq('contact_number', 'C-00320');
console.log('Records with contact_number C-00320:', c1?.length);
c1?.forEach(c => console.log(`  id=${c.id} | full_name=${c.full_name} | assigned_to_name=${c.assigned_to_name} | assigned_to_names=${JSON.stringify(c.assigned_to_names)}`));

// Check the original ID from the backup
import fs from 'fs';
const before = JSON.parse(fs.readFileSync('/Users/ahmedaladdin/Downloads/platform-erp-v2/scripts/backups/phase1-sample-2026-04-29T17-06-14-808Z/sample-contacts-before.json'));
const c320 = before.find(x => x.contact_number === 'C-00320');
console.log('\nOriginal C-00320 from backup:');
console.log(`  id=${c320.id}`);
console.log(`  assigned_to_names=${JSON.stringify(c320.assigned_to_names)}`);

const { data: byId } = await supabase.from('contacts').select('*').eq('id', c320.id);
console.log('\nQuery by original id:', byId?.length || 0, 'rows');
byId?.forEach(c => console.log(`  full_name=${c.full_name} | contact_number=${c.contact_number} | assigned=${c.assigned_to_name} | is_deleted=${c.is_deleted}`));
