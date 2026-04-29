import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const { data: users } = await supabase.from('users').select('*').order('created_at');
console.log(`👤 Total users: ${users.length}\n`);

// Status breakdown
const statusCount = {};
for (const u of users) statusCount[u.status || 'null'] = (statusCount[u.status || 'null'] || 0) + 1;
console.log('Status breakdown:');
for (const [s, c] of Object.entries(statusCount)) console.log(`  ${s}: ${c}`);

// Role breakdown
const roleCount = {};
for (const u of users) roleCount[u.role || 'null'] = (roleCount[u.role || 'null'] || 0) + 1;
console.log('\nRole breakdown:');
for (const [r, c] of Object.entries(roleCount)) console.log(`  ${r}: ${c}`);

// Check duplicate names
const enNames = {}, arNames = {};
for (const u of users) {
  if (u.full_name_en) enNames[u.full_name_en] = (enNames[u.full_name_en] || []);
  if (u.full_name_en) enNames[u.full_name_en].push(u);
  if (u.full_name_ar) arNames[u.full_name_ar] = (arNames[u.full_name_ar] || []);
  if (u.full_name_ar) arNames[u.full_name_ar].push(u);
}
console.log('\n🔍 Duplicate full_name_en:');
let dupesEn = 0;
for (const [name, list] of Object.entries(enNames)) {
  if (list.length > 1) {
    dupesEn++;
    console.log(`  "${name}" — ${list.length} users:`);
    list.forEach(u => console.log(`    • ${u.id} | role=${u.role} | status=${u.status} | created=${u.created_at?.slice(0,10)}`));
  }
}
console.log(`Duplicates count: ${dupesEn}`);

console.log('\n🔍 Duplicate full_name_ar:');
let dupesAr = 0;
for (const [name, list] of Object.entries(arNames)) {
  if (list.length > 1) {
    dupesAr++;
    console.log(`  "${name}" — ${list.length} users:`);
    list.forEach(u => console.log(`    • ${u.id} | role=${u.role} | status=${u.status} | created=${u.created_at?.slice(0,10)}`));
  }
}
console.log(`Duplicates count: ${dupesAr}`);

// Users with missing names
console.log('\n⚠️ Users with missing names:');
const missingEn = users.filter(u => !u.full_name_en).length;
const missingAr = users.filter(u => !u.full_name_ar).length;
const missingBoth = users.filter(u => !u.full_name_en && !u.full_name_ar).length;
console.log(`  Missing full_name_en: ${missingEn}`);
console.log(`  Missing full_name_ar: ${missingAr}`);
console.log(`  Missing both: ${missingBoth}`);

// Users with leading/trailing whitespace or unusual chars
console.log('\n⚠️ Users with whitespace/odd chars:');
let oddCount = 0;
for (const u of users) {
  if (u.full_name_en && (u.full_name_en !== u.full_name_en.trim())) {
    console.log(`  WHITESPACE EN: "${u.full_name_en}" (id: ${u.id})`);
    oddCount++;
  }
  if (u.full_name_ar && (u.full_name_ar !== u.full_name_ar.trim())) {
    console.log(`  WHITESPACE AR: "${u.full_name_ar}" (id: ${u.id})`);
    oddCount++;
  }
}
if (oddCount === 0) console.log('  ✅ None found');

// All user names listing
console.log('\n📋 All users (id, en, ar, role, status):');
users.forEach(u => console.log(`  ${u.id} | "${u.full_name_en || '—'}" / "${u.full_name_ar || '—'}" | ${u.role || '—'} | ${u.status || '—'}`));
