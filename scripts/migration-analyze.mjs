import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 Migration Analysis Starting...\n');

let allContacts = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('contacts')
    .select('id, full_name, phone, assigned_to_name, assigned_to_names, agent_statuses, agent_temperatures, agent_scores, contact_status, temperature, lead_score, is_deleted, created_at, assigned_at')
    .range(from, from + 999);
  if (error) { console.log(error); process.exit(1); }
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = allContacts.filter(c => !c.is_deleted);
console.log(`📊 Total contacts: ${allContacts.length} (active: ${active.length}, deleted: ${allContacts.length - active.length})`);

const distribution = {};
let willClone = 0;
let unassigned = 0;
const multiContacts = [];
for (const c of active) {
  const names = Array.isArray(c.assigned_to_names) ? c.assigned_to_names.length : 0;
  distribution[names] = (distribution[names] || 0) + 1;
  if (names === 0) unassigned++;
  if (names > 1) {
    willClone += (names - 1);
    multiContacts.push(c);
  }
}
console.log('\n📈 Distribution of assigned_to_names length:');
for (const [k, v] of Object.entries(distribution).sort((a,b)=>+a[0]-+b[0])) {
  console.log(`  ${k} assignees: ${v} contacts`);
}
console.log(`\n📌 Migration impact:`);
console.log(`  Contacts that need cloning: ${multiContacts.length}`);
console.log(`  New records to create:      ${willClone}`);
console.log(`  Total records after:        ${active.length + willClone}`);
console.log(`  Multiplier:                 ${((active.length + willClone) / active.length).toFixed(2)}x`);

const agentNew = {};
for (const c of active) {
  const names = Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 0
    ? c.assigned_to_names
    : (c.assigned_to_name ? [c.assigned_to_name] : []);
  for (const n of names) agentNew[n] = (agentNew[n] || 0) + 1;
}
console.log('\n👥 Per-agent record count AFTER migration (top 25):');
const sorted = Object.entries(agentNew).sort((a,b)=>b[1]-a[1]);
sorted.slice(0, 25).forEach(([name, cnt], i) => console.log(`  ${(i+1).toString().padStart(2)}. ${name.padEnd(25)} ${cnt}`));
console.log(`\n  Total agent names: ${sorted.length}`);
console.log(`  Sum of records:    ${sorted.reduce((a,b)=>a+b[1],0)}`);

console.log('\n🔍 Sampling activities/tasks/opps for multi-contacts...');
let totalActs = 0, totalTasks = 0, totalOpps = 0, orphanActs = 0;
const sampleSize = Math.min(multiContacts.length, 100);
for (let i = 0; i < sampleSize; i++) {
  const c = multiContacts[i];
  const [{ data: acts }, { data: tasks }, { data: opps }] = await Promise.all([
    supabase.from('activities').select('user_name_en, user_name_ar').eq('contact_id', c.id),
    supabase.from('tasks').select('assigned_to_name_en, assigned_to_name_ar').eq('contact_id', c.id),
    supabase.from('opportunities').select('assigned_to_name, agent_name').eq('contact_id', c.id),
  ]);
  totalActs += acts?.length || 0;
  totalTasks += tasks?.length || 0;
  totalOpps += opps?.length || 0;
  const names = new Set((c.assigned_to_names || []));
  for (const a of acts || []) {
    const author = a.user_name_en || a.user_name_ar;
    if (author && !names.has(author)) orphanActs++;
  }
}
const projActs = Math.round(totalActs / sampleSize * multiContacts.length);
const projTasks = Math.round(totalTasks / sampleSize * multiContacts.length);
const projOpps = Math.round(totalOpps / sampleSize * multiContacts.length);
const projOrphans = Math.round(orphanActs / sampleSize * multiContacts.length);
console.log(`  Sampled ${sampleSize} multi-contacts:`);
console.log(`    Activities:  ${totalActs} (projected total: ~${projActs})`);
console.log(`    Tasks:       ${totalTasks} (projected total: ~${projTasks})`);
console.log(`    Opps:        ${totalOpps} (projected total: ~${projOpps})`);
console.log(`    Orphan acts: ${orphanActs} (projected: ~${projOrphans})`);

let drifted = 0, ghostKeys = 0;
for (const c of active) {
  const names = new Set((c.assigned_to_names || []));
  for (const k of Object.keys(c.agent_statuses || {})) {
    if (!names.has(k)) ghostKeys++;
  }
  if (Object.keys(c.agent_statuses || {}).some(k => !names.has(k))) drifted++;
}
console.log(`\n👻 Drift detection (current state):`);
console.log(`  Contacts with ghost keys in agent_statuses: ${drifted}`);
console.log(`  Total ghost keys: ${ghostKeys}`);

let primaryMismatch = 0;
for (const c of active) {
  if (!Array.isArray(c.assigned_to_names) || c.assigned_to_names.length === 0) continue;
  if (c.assigned_to_name !== c.assigned_to_names[0]) primaryMismatch++;
}
console.log(`  Primary mismatch (assigned_to_name ≠ assigned_to_names[0]): ${primaryMismatch}`);

const report = {
  timestamp: new Date().toISOString(),
  totals: { all: allContacts.length, active: active.length, deleted: allContacts.length - active.length },
  distribution,
  multiAssignmentImpact: {
    contactsToClone: multiContacts.length,
    newRecordsToCreate: willClone,
    totalAfter: active.length + willClone,
    multiplier: (active.length + willClone) / active.length,
  },
  perAgent: Object.fromEntries(sorted),
  childRecordsProjection: {
    activities: projActs,
    tasks: projTasks,
    opportunities: projOpps,
    orphanActivities: projOrphans,
  },
  drift: { contactsWithGhostKeys: drifted, totalGhostKeys: ghostKeys, primaryMismatch },
};
const reportPath = `scripts/backups/migration-analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n💾 Report saved: ${reportPath}`);
console.log('\n✅ Analysis complete. NO WRITES PERFORMED.');
