import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let all = [];
let from = 0;
const pageSize = 1000;
while (true) {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, full_name, phone, assigned_to_names, assigned_to_name, contact_status, source, created_at, is_deleted')
    .range(from, from + pageSize - 1);
  if (error) { console.log('page err:', error); break; }
  if (!data || data.length === 0) break;
  all = all.concat(data);
  if (data.length < pageSize) break;
  from += pageSize;
}
const active = all.filter(c => !c.is_deleted);
console.log('Total contacts:', all.length, '| active:', active.length);

const isNada = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);
const nadaContacts = active.filter(c =>
  (Array.isArray(c.assigned_to_names) && c.assigned_to_names.some(isNada)) ||
  isNada(c.assigned_to_name)
);
console.log('Nada Kafafy total:', nadaContacts.length);

const aloneList = [];
const sharedList = [];
for (const c of nadaContacts) {
  const arr = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : (c.assigned_to_name ? [c.assigned_to_name] : []);
  const others = arr.filter(n => !isNada(n));
  if (others.length === 0) aloneList.push(c);
  else sharedList.push({ ...c, others });
}
console.log('\n=== ALONE (Nada only):', aloneList.length, '===');
console.log('=== SHARED (Nada + others):', sharedList.length, '===');

// Partner breakdown
const partnerCount = {};
for (const c of sharedList) for (const o of c.others) partnerCount[o] = (partnerCount[o] || 0) + 1;
console.log('\nShared partners:');
for (const [k, v] of Object.entries(partnerCount).sort((a,b) => b[1]-a[1])) console.log(`  ${k}: ${v}`);

console.log('\n--- ALONE list ---');
aloneList.forEach((c,i) => console.log(`${i+1}. ${c.full_name} | ${c.phone || ''} | status=${c.contact_status||'-'} | src=${c.source||'-'}`));
console.log('\n--- SHARED list ---');
sharedList.forEach((c,i) => console.log(`${i+1}. ${c.full_name} | ${c.phone || ''} | with: ${c.others.join(', ')} | status=${c.contact_status||'-'}`));
