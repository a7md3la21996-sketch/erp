import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const KHALED_ID = 'd5c800ad-df84-480c-bc9c-72e81a03a897';

console.log('🔍 Khaled phantom deep-check\n');

// Get Khaled's team
const { data: khaledTeam } = await supabase.from('users')
  .select('id, full_name_en')
  .eq('role', 'sales_agent')
  .eq('team_id', '0bd11e30-0c11-4fa5-b209-6527c6776e7d'); // Khaled's team
console.log('Khaled team members:', khaledTeam?.map(u => u.full_name_en).join(', '));

// Find Khaled's phantom records (his + team member on same phone)
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, full_name, assigned_to, contact_status, created_at').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const byPhone = {};
for (const c of allContacts) {
  if (!c.phone) continue;
  if (!byPhone[c.phone]) byPhone[c.phone] = [];
  byPhone[c.phone].push(c);
}

const teamIds = (khaledTeam || []).map(t => t.id);
const khaledRecords = allContacts.filter(c => c.assigned_to === KHALED_ID);

const phantoms = [];
for (const c of khaledRecords) {
  const siblings = (byPhone[c.phone] || []).filter(s => s.id !== c.id);
  const teamSibling = siblings.find(s => teamIds.includes(s.assigned_to));
  if (teamSibling) phantoms.push({ khaled_record: c, team_sibling: teamSibling });
}
console.log(`\nFound ${phantoms.length} phantoms for Khaled\n`);

// For each, count activities BY KHALED specifically
const ids = phantoms.map(p => p.khaled_record.id);
const { data: actsAll } = await supabase.from('activities').select('id, contact_id, user_id, type, created_at').in('contact_id', ids);

const actsByContact = {};
for (const a of actsAll || []) {
  if (!actsByContact[a.contact_id]) actsByContact[a.contact_id] = { byKhaled: 0, byOthers: 0, total: 0 };
  actsByContact[a.contact_id].total++;
  if (a.user_id === KHALED_ID) actsByContact[a.contact_id].byKhaled++;
  else actsByContact[a.contact_id].byOthers++;
}

console.log('=== Per-Record Breakdown ===\n');
let trulyPhantom = 0;
let khaledWorked = 0;
const trulyPhantomList = [];
phantoms.forEach((p, i) => {
  const stats = actsByContact[p.khaled_record.id] || { byKhaled: 0, byOthers: 0, total: 0 };
  const isTrulyPhantom = stats.byKhaled === 0;
  if (isTrulyPhantom) { trulyPhantom++; trulyPhantomList.push(p); }
  else khaledWorked++;
  console.log(`${(i+1).toString().padStart(2)}. ${p.khaled_record.full_name?.padEnd(25)} | ${p.khaled_record.phone}`);
  console.log(`    activities by Khaled: ${stats.byKhaled} | by others: ${stats.byOthers} | total: ${stats.total}`);
  console.log(`    sibling owner: ${p.team_sibling.assigned_to?.slice(0,8) || '?'}`);
  console.log(`    → ${isTrulyPhantom ? '✅ TRULY PHANTOM (Khaled never touched)' : '⚠️  Khaled actually worked it'}\n`);
});

console.log(`\n=== SUMMARY ===`);
console.log(`Truly phantom (Khaled didn't work): ${trulyPhantom}`);
console.log(`Khaled actually worked: ${khaledWorked}`);
console.log(`\nSafe to delete WITHOUT data loss: ${trulyPhantom}`);
