import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const TARGET = process.argv[2] || 'Esraa Bakr';
const tokens = TARGET.toLowerCase().split(/\s+/);
const isMatch = (n) => typeof n === 'string' && tokens.every(t => n.toLowerCase().includes(t));

// User info
const { data: users } = await supabase.from('users')
  .select('id, full_name_en, full_name_ar, role, team_id, status')
  .ilike('full_name_en', `%${tokens[0]}%`);
console.log(`=== Users matching "${tokens[0]}" ===`);
console.log(users?.filter(u => isMatch(u.full_name_en)));

// Fetch contacts
let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('contacts')
    .select('id, full_name, phone, assigned_to_names, assigned_to_name, contact_status, source, is_deleted')
    .range(from, from + 999);
  if (error) { console.log(error); break; }
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = all.filter(c => !c.is_deleted);

const targetContacts = active.filter(c =>
  Array.isArray(c.assigned_to_names) && c.assigned_to_names.some(isMatch)
);
console.log(`\n=== ${TARGET} total contacts: ${targetContacts.length} ===`);

let alone = 0, shared = 0;
const partnerCount = {};
for (const c of targetContacts) {
  const others = c.assigned_to_names.filter(n => !isMatch(n));
  if (others.length === 0) alone++;
  else {
    shared++;
    for (const o of others) partnerCount[o] = (partnerCount[o] || 0) + 1;
  }
}
console.log(`ALONE (${TARGET} only):`, alone);
console.log(`SHARED (${TARGET} + others):`, shared);
console.log('\nShared partners:');
for (const [k, v] of Object.entries(partnerCount).sort((a,b) => b[1]-a[1])) console.log(`  ${k}: ${v}`);
