import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

// 1. Get all users with both name versions
const { data: users } = await supabase.from('users')
  .select('id, full_name_en, full_name_ar, role, status');
console.log(`👤 Users in DB: ${users.length}`);

// Build name → user mapping (both en and ar versions point to same user)
const nameToUser = new Map();
for (const u of users) {
  if (u.full_name_en) nameToUser.set(u.full_name_en, u);
  if (u.full_name_ar) nameToUser.set(u.full_name_ar, u);
}

// 2. Scan all unique names in contacts.assigned_to_names
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts')
    .select('assigned_to_names, assigned_to_name, is_deleted')
    .range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = allContacts.filter(c => !c.is_deleted);

const nameCount = {};
for (const c of active) {
  const names = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : [];
  for (const n of names) nameCount[n] = (nameCount[n] || 0) + 1;
}

// 3. Detect: which names map to same user via en/ar
const userToNames = new Map();
for (const [name, count] of Object.entries(nameCount)) {
  const u = nameToUser.get(name);
  if (!u) continue; // unknown name (orphan)
  if (!userToNames.has(u.id)) userToNames.set(u.id, []);
  userToNames.get(u.id).push({ name, count });
}

console.log('\n🔄 Users with MULTIPLE name versions in assigned_to_names:');
let totalAffected = 0;
const dupes = [];
for (const [uid, namesList] of userToNames.entries()) {
  if (namesList.length > 1) {
    const u = users.find(x => x.id === uid);
    const total = namesList.reduce((s, n) => s + n.count, 0);
    totalAffected += total;
    dupes.push({ user: u, names: namesList, total });
    console.log(`\n  User: ${u.full_name_en} / ${u.full_name_ar} (${u.role})`);
    namesList.forEach(({name, count}) => console.log(`    • "${name}": ${count} contacts`));
    console.log(`    → Total: ${total}`);
  }
}
console.log(`\n📌 Summary:`);
console.log(`  Users with name version conflicts: ${dupes.length}`);
console.log(`  Total contacts affected: ${totalAffected}`);

// 4. Detect orphan names (in assigned_to_names but no user match)
console.log('\n👻 Orphan names (in assigned_to_names but NO user match):');
const orphans = [];
for (const [name, count] of Object.entries(nameCount)) {
  if (!nameToUser.has(name)) orphans.push({ name, count });
}
orphans.sort((a,b) => b.count - a.count);
orphans.slice(0, 20).forEach(({name, count}) => console.log(`  "${name}": ${count} contacts`));
console.log(`\n  Total orphan names: ${orphans.length}`);
console.log(`  Total contacts with orphan names: ${orphans.reduce((s,o)=>s+o.count, 0)}`);
