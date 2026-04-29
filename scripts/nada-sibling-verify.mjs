import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFزnamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
// fix encoding
const KEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY2, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';

// Get all Nada records
let nada = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, contact_status').eq('is_deleted', false).eq('assigned_to', NADA_ID).range(from, from + 999);
  if (!data?.length) break;
  nada = nada.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Nada records: ${nada.length}`);

// For each Nada record, check phone existence elsewhere
// Including in deleted contacts
const phones = [...new Set(nada.map(n => n.phone).filter(Boolean))];
console.log(`Unique phones: ${phones.length}\n`);

let allWithPhones = [];
for (let i = 0; i < phones.length; i += 100) {
  const chunk = phones.slice(i, i + 100);
  const { data } = await supabase.from('contacts').select('id, phone, assigned_to, assigned_to_name, is_deleted').in('phone', chunk);
  if (data) allWithPhones = allWithPhones.concat(data);
}

const byPhone = {};
for (const c of allWithPhones) { (byPhone[c.phone] = byPhone[c.phone] || []).push(c); }

// Categorize per status
const stats = {};
for (const n of nada) {
  const st = n.contact_status || 'null';
  if (!stats[st]) stats[st] = { total: 0, exclusive_active: 0, has_active_sibling: 0, has_deleted_sibling_only: 0 };
  stats[st].total++;
  const all = byPhone[n.phone] || [];
  const others = all.filter(c => c.id !== n.id);
  const activeOthers = others.filter(c => !c.is_deleted);
  const deletedOthers = others.filter(c => c.is_deleted);
  if (activeOthers.length > 0) stats[st].has_active_sibling++;
  else if (deletedOthers.length > 0) stats[st].has_deleted_sibling_only++;
  else stats[st].exclusive_active++;
}

console.log('=== Per status — does the phone exist anywhere else? ===\n');
console.log('Status'.padEnd(20) + 'Total'.padEnd(10) + 'Only Nada (exclusive)'.padEnd(25) + 'Has active sibling'.padEnd(22) + 'Has deleted only');
for (const [st, s] of Object.entries(stats).sort((a,b) => b[1].total - a[1].total)) {
  console.log(`${st.padEnd(20)}${String(s.total).padEnd(10)}${String(s.exclusive_active).padEnd(25)}${String(s.has_active_sibling).padEnd(22)}${s.has_deleted_sibling_only}`);
}

// Aggregate
const totals = { exclusive: 0, hasActive: 0, hasDeleted: 0 };
for (const s of Object.values(stats)) {
  totals.exclusive += s.exclusive_active;
  totals.hasActive += s.has_active_sibling;
  totals.hasDeleted += s.has_deleted_sibling_only;
}
console.log('\n=== TOTAL ===');
console.log(`Exclusive (only Nada has this phone, anywhere): ${totals.exclusive}`);
console.log(`Has ACTIVE sibling (someone else has it now): ${totals.hasActive}`);
console.log(`Has DELETED sibling only (had it before, deleted): ${totals.hasDeleted}`);
