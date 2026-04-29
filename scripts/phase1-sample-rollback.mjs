import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const backupDir = process.argv[2];
if (!backupDir) {
  console.log('Usage: node scripts/phase1-sample-rollback.mjs <backup-dir>');
  process.exit(1);
}

console.log(`🔄 Rolling back from ${backupDir}\n`);

const before = JSON.parse(fs.readFileSync(path.join(backupDir, 'sample-contacts-before.json')));
const acts = JSON.parse(fs.readFileSync(path.join(backupDir, 'activities-before.json')));
const tasks = JSON.parse(fs.readFileSync(path.join(backupDir, 'tasks-before.json')));
const opps = JSON.parse(fs.readFileSync(path.join(backupDir, 'opportunities-before.json')));
const deals = JSON.parse(fs.readFileSync(path.join(backupDir, 'deals-before.json')));
const map = JSON.parse(fs.readFileSync(path.join(backupDir, 'clone-id-map.json')));
const newRecs = JSON.parse(fs.readFileSync(path.join(backupDir, 'new-records.json')));

// 1. Restore activities/tasks/opps/deals contact_id back to original
const restoreChild = async (table, rows, fkField = 'contact_id') => {
  let ok = 0, fail = 0;
  for (const r of rows) {
    const { error } = await supabase.from(table).update({ [fkField]: r[fkField] }).eq('id', r.id);
    if (error) { fail++; console.log(`  ❌ ${table} ${r.id}: ${error.message}`); }
    else ok++;
  }
  console.log(`  ${table}: ok=${ok} fail=${fail}`);
};
console.log('1. Restoring child record contact_id references...');
await restoreChild('activities', acts);
await restoreChild('tasks', tasks);
await restoreChild('opportunities', opps);
await restoreChild('deals', deals);

// 2. Delete clones
console.log('\n2. Deleting clones...');
const cloneIds = newRecs.map(r => r.clone);
const { error: delErr } = await supabase.from('contacts').delete().in('id', cloneIds);
if (delErr) console.log(`  ❌ Failed: ${delErr.message}`);
else console.log(`  ✅ Deleted ${cloneIds.length} clones`);

// 3. Restore primary records
console.log('\n3. Restoring primary records...');
let okP = 0, failP = 0;
for (const c of before) {
  const restore = {
    assigned_to_names: c.assigned_to_names,
    assigned_to_name: c.assigned_to_name,
    assigned_to: c.assigned_to,
    contact_status: c.contact_status,
    temperature: c.temperature,
    lead_score: c.lead_score,
    agent_statuses: c.agent_statuses,
    agent_temperatures: c.agent_temperatures,
    agent_scores: c.agent_scores,
  };
  const { error } = await supabase.from('contacts').update(restore).eq('id', c.id);
  if (error) { failP++; console.log(`  ❌ ${c.contact_number}: ${error.message}`); }
  else okP++;
}
console.log(`  ok=${okP} fail=${failP}`);

console.log('\n✅ Rollback complete');
