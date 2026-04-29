import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const KHALED_ID = 'd5c800ad-df84-480c-bc9c-72e81a03a897';
const KHALED_TEAM_ID = '0bd11e30-0c11-4fa5-b209-6527c6776e7d';
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/khaled-phantom-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });

console.log(`🚀 Khaled Phantom Cleanup\n💾 Backup dir: ${backupDir}\n`);

// 1. Identify Khaled's phantoms (re-run to get fresh state)
const { data: teamMembers } = await supabase.from('users')
  .select('id, full_name_en')
  .eq('team_id', KHALED_TEAM_ID).eq('role', 'sales_agent');
const teamIds = teamMembers.map(t => t.id);
console.log(`Team: ${teamMembers.map(t => t.full_name_en).join(', ')}`);

let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, full_name, assigned_to').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const byPhone = {};
for (const c of allContacts) { if (c.phone) (byPhone[c.phone] = byPhone[c.phone] || []).push(c); }

const khaledRecords = allContacts.filter(c => c.assigned_to === KHALED_ID);
const phantoms = [];
for (const c of khaledRecords) {
  const siblings = (byPhone[c.phone] || []).filter(s => s.id !== c.id);
  const teamSibling = siblings.find(s => teamIds.includes(s.assigned_to));
  if (teamSibling) phantoms.push({ khaled_record: c, team_sibling: teamSibling });
}
console.log(`Phantoms found: ${phantoms.length}\n`);

// 2. Filter out those with deals or opportunities
const ids = phantoms.map(p => p.khaled_record.id);
const [dRes, oRes] = await Promise.all([
  supabase.from('deals').select('id, contact_id').in('contact_id', ids),
  supabase.from('opportunities').select('id, contact_id, opp_number').in('contact_id', ids),
]);
const hasDealsByContact = new Set((dRes.data || []).map(d => d.contact_id));
const hasOppsByContact = new Set((oRes.data || []).map(o => o.contact_id));

const safe = [];
const skipped = [];
for (const p of phantoms) {
  const cid = p.khaled_record.id;
  if (hasDealsByContact.has(cid)) { skipped.push({ ...p, reason: 'has_deal' }); continue; }
  if (hasOppsByContact.has(cid)) { skipped.push({ ...p, reason: 'has_opp' }); continue; }
  safe.push(p);
}
console.log(`Safe to delete: ${safe.length}`);
console.log(`Skipped (deals/opps): ${skipped.length}\n`);

// 3. Fetch full records + child records for backup
const safeIds = safe.map(p => p.khaled_record.id);
const [fullContacts, fullActs, fullTasks] = await Promise.all([
  supabase.from('contacts').select('*').in('id', safeIds),
  supabase.from('activities').select('*').in('contact_id', safeIds),
  supabase.from('tasks').select('*').in('contact_id', safeIds),
]);

fs.writeFileSync(`${backupDir}/contacts-before.json`, JSON.stringify(fullContacts.data, null, 2));
fs.writeFileSync(`${backupDir}/activities-before.json`, JSON.stringify(fullActs.data, null, 2));
fs.writeFileSync(`${backupDir}/tasks-before.json`, JSON.stringify(fullTasks.data, null, 2));
fs.writeFileSync(`${backupDir}/skipped.json`, JSON.stringify(skipped.map(s => ({ id: s.khaled_record.id, name: s.khaled_record.full_name, reason: s.reason })), null, 2));
console.log(`💾 Backup: ${fullContacts.data.length} contacts, ${fullActs.data?.length || 0} activities, ${fullTasks.data?.length || 0} tasks\n`);

// 4. For each safe phantom: move activities/tasks to team sibling, then soft-delete the phantom
let totalActsMoved = 0, totalTasksMoved = 0, deletedOk = 0, deletedFail = 0;
const errors = [];
const moveMap = []; // {from, to, type}

for (const p of safe) {
  const fromId = p.khaled_record.id;
  const toId = p.team_sibling.id;

  // Move activities
  const acts = (fullActs.data || []).filter(a => a.contact_id === fromId);
  for (const a of acts) {
    const { error } = await supabase.from('activities').update({ contact_id: toId }).eq('id', a.id);
    if (error) errors.push({ table: 'activities', id: a.id, error: error.message });
    else { totalActsMoved++; moveMap.push({ id: a.id, type: 'activity', from: fromId, to: toId }); }
  }

  // Move tasks
  const tasks = (fullTasks.data || []).filter(t => t.contact_id === fromId);
  for (const t of tasks) {
    const { error } = await supabase.from('tasks').update({ contact_id: toId }).eq('id', t.id);
    if (error) errors.push({ table: 'tasks', id: t.id, error: error.message });
    else { totalTasksMoved++; moveMap.push({ id: t.id, type: 'task', from: fromId, to: toId }); }
  }

  // Soft-delete the phantom record
  const { error: delErr } = await supabase.from('contacts').update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  }).eq('id', fromId);
  if (delErr) { deletedFail++; errors.push({ table: 'contacts', id: fromId, error: delErr.message }); }
  else deletedOk++;

  process.stdout.write(`\rProcessed ${deletedOk + deletedFail}/${safe.length} | acts moved: ${totalActsMoved} | tasks moved: ${totalTasksMoved}    `);
}
console.log('\n');

fs.writeFileSync(`${backupDir}/move-map.json`, JSON.stringify(moveMap, null, 2));
if (errors.length > 0) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));

console.log('=== DONE ===');
console.log(`Deleted (soft): ${deletedOk} / ${safe.length}`);
console.log(`Failed: ${deletedFail}`);
console.log(`Activities moved: ${totalActsMoved}`);
console.log(`Tasks moved: ${totalTasksMoved}`);
console.log(`Errors: ${errors.length}`);
console.log(`\n💾 ${backupDir}`);
