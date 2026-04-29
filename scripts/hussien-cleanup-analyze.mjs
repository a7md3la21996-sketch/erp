import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const HUSSIEN_ID = 'f6030cb5-7699-478d-b641-a10c26ff7444';

console.log('🔍 Hussien Cleanup — Analysis (read-only)\n');

// All active contacts
let all = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts')
    .select('id, phone, full_name, assigned_to, assigned_to_name, contact_status, created_at')
    .eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Active contacts: ${all.length}`);

const byPhone = {};
for (const c of all) { if (c.phone) (byPhone[c.phone] = byPhone[c.phone] || []).push(c); }

// Hussien's records
const hussien = all.filter(c => c.assigned_to === HUSSIEN_ID);
console.log(`Hussien records: ${hussien.length}\n`);

// Categorize
const exclusive = []; // only Hussien on this phone — KEEP
const withSibling = []; // someone else also has the same phone — candidates for DELETE
for (const c of hussien) {
  const siblings = (byPhone[c.phone] || []).filter(s => s.id !== c.id);
  if (siblings.length === 0) exclusive.push(c);
  else withSibling.push({ hussien_record: c, siblings });
}
console.log(`Exclusive (KEEP): ${exclusive.length}`);
console.log(`With sibling (DELETE candidates): ${withSibling.length}\n`);

// Check for deals/opps on Hussien records to be deleted
const ids = withSibling.map(p => p.hussien_record.id);
const dealsByContact = {};
const oppsByContact = {};
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const [d, o] = await Promise.all([
    supabase.from('deals').select('id, contact_id, status, deal_number').in('contact_id', chunk),
    supabase.from('opportunities').select('id, contact_id, stage, opp_number').in('contact_id', chunk),
  ]);
  for (const x of d.data || []) (dealsByContact[x.contact_id] = dealsByContact[x.contact_id] || []).push(x);
  for (const x of o.data || []) (oppsByContact[x.contact_id] = oppsByContact[x.contact_id] || []).push(x);
}

// Activities count
const actsByContact = {};
const tasksByContact = {};
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const [a, t] = await Promise.all([
    supabase.from('activities').select('contact_id', { count: 'exact', head: false }).in('contact_id', chunk),
    supabase.from('tasks').select('contact_id', { count: 'exact', head: false }).in('contact_id', chunk),
  ]);
  for (const x of a.data || []) actsByContact[x.contact_id] = (actsByContact[x.contact_id] || 0) + 1;
  for (const x of t.data || []) tasksByContact[x.contact_id] = (tasksByContact[x.contact_id] || 0) + 1;
}

const safeToDelete = [];
const skipDeal = [];
const skipOpp = [];

for (const p of withSibling) {
  const cid = p.hussien_record.id;
  if (dealsByContact[cid]?.length) skipDeal.push({ ...p, deals: dealsByContact[cid] });
  else if (oppsByContact[cid]?.length) skipOpp.push({ ...p, opps: oppsByContact[cid] });
  else safeToDelete.push({ ...p, acts: actsByContact[cid] || 0, tasks: tasksByContact[cid] || 0 });
}

console.log('=== CATEGORIZATION ===\n');
console.log(`🟢 Safe to delete (no deals/opps): ${safeToDelete.length}`);
console.log(`🟡 Has open opportunity (skip): ${skipOpp.length}`);
console.log(`🔴 Has deal (skip — commission): ${skipDeal.length}`);

const totalActs = safeToDelete.reduce((s, p) => s + p.acts, 0);
const totalTasks = safeToDelete.reduce((s, p) => s + p.tasks, 0);
console.log(`\nActivities to migrate: ${totalActs}`);
console.log(`Tasks to migrate: ${totalTasks}`);

// Per-sibling owner breakdown — who's getting Hussien's work?
const recipientCount = {};
for (const p of safeToDelete) {
  // Pick the first sibling as recipient (or in real exec, more sophisticated)
  const target = p.siblings[0];
  const targetName = target?.assigned_to_name || 'unassigned';
  recipientCount[targetName] = (recipientCount[targetName] || 0) + 1;
}
console.log('\n=== RECIPIENTS (Top 10) — who would get the migrated history ===');
const sortedR = Object.entries(recipientCount).sort((a,b) => b[1] - a[1]);
sortedR.slice(0, 10).forEach(([n, c]) => console.log(`  ${n.padEnd(25)} ${c}`));
if (sortedR.length > 10) console.log(`  ... +${sortedR.length - 10} more`);

// Sample
console.log('\n=== Sample of safe deletes (first 5) ===');
safeToDelete.slice(0, 5).forEach((p, i) => {
  console.log(`${i+1}. ${p.hussien_record.full_name?.padEnd(25)} | ${p.hussien_record.phone}`);
  console.log(`   acts: ${p.acts} | tasks: ${p.tasks}`);
  console.log(`   sibling: ${p.siblings[0]?.assigned_to_name || '?'}`);
});

if (skipDeal.length) {
  console.log('\n=== Records WITH DEAL (will skip) ===');
  skipDeal.forEach(p => console.log(`  - ${p.hussien_record.full_name} | deal: ${p.deals[0].deal_number || p.deals[0].id.slice(0,8)} (${p.deals[0].status})`));
}
if (skipOpp.length) {
  console.log('\n=== Records WITH OPP (will skip, sample) ===');
  skipOpp.slice(0, 5).forEach(p => console.log(`  - ${p.hussien_record.full_name} | opp stage: ${p.opps[0].stage}`));
  if (skipOpp.length > 5) console.log(`  ... +${skipOpp.length - 5} more`);
}

// Save analysis
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = `scripts/backups/hussien-cleanup-analysis-${ts}.json`;
fs.writeFileSync(reportFile, JSON.stringify({
  totals: {
    hussien_records: hussien.length,
    exclusive_keep: exclusive.length,
    withSibling: withSibling.length,
    safeToDelete: safeToDelete.length,
    skipDeal: skipDeal.length,
    skipOpp: skipOpp.length,
    totalActivities: totalActs,
    totalTasks: totalTasks,
  },
  recipients: Object.fromEntries(sortedR),
  safeToDelete: safeToDelete.map(p => ({
    id: p.hussien_record.id,
    full_name: p.hussien_record.full_name,
    phone: p.hussien_record.phone,
    sibling_id: p.siblings[0]?.id,
    sibling_owner: p.siblings[0]?.assigned_to_name,
    acts: p.acts,
    tasks: p.tasks,
  })),
  skipOpp: skipOpp.map(p => ({ id: p.hussien_record.id, full_name: p.hussien_record.full_name, opp_stage: p.opps[0]?.stage })),
  skipDeal: skipDeal.map(p => ({ id: p.hussien_record.id, full_name: p.hussien_record.full_name, deal_status: p.deals[0]?.status })),
}, null, 2));

console.log(`\n💾 Analysis saved: ${reportFile}`);
console.log('\n✅ READ-ONLY ANALYSIS COMPLETE.');
