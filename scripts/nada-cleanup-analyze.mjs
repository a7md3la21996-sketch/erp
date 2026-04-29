import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';

console.log('🔍 Nada Cleanup Analysis (read-only)\n');

// All active contacts
let all = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, full_name, assigned_to, assigned_to_name, contact_status, source, created_at, contact_type').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const byPhone = {};
for (const c of all) { if (c.phone) (byPhone[c.phone] = byPhone[c.phone] || []).push(c); }

const nadaRecords = all.filter(c => c.assigned_to === NADA_ID);
console.log(`Nada records: ${nadaRecords.length}`);

// Categorize
const withSibling = [];
const exclusive = [];
for (const c of nadaRecords) {
  const siblings = (byPhone[c.phone] || []).filter(s => s.id !== c.id);
  if (siblings.length > 0) withSibling.push({ nada: c, siblings });
  else exclusive.push(c);
}
console.log(`\n📌 With sibling (delete Nada, migrate to sibling): ${withSibling.length}`);
console.log(`📌 Exclusive (Nada is the only owner — needs redistribution): ${exclusive.length}\n`);

// Check deals/opps on records to delete
const ids = withSibling.map(p => p.nada.id);
const dealIds = new Set();
const oppIds = new Set();
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const [d, o] = await Promise.all([
    supabase.from('deals').select('contact_id').in('contact_id', chunk),
    supabase.from('opportunities').select('contact_id').in('contact_id', chunk),
  ]);
  for (const x of d.data || []) dealIds.add(x.contact_id);
  for (const x of o.data || []) oppIds.add(x.contact_id);
}
const safeWithSibling = withSibling.filter(p => !dealIds.has(p.nada.id) && !oppIds.has(p.nada.id));
const skipWithSibling = withSibling.filter(p => dealIds.has(p.nada.id) || oppIds.has(p.nada.id));
console.log(`✂️  Safe to delete (no deals/opps): ${safeWithSibling.length}`);
console.log(`🟡 Skipped (have deals/opps): ${skipWithSibling.length}\n`);

// Recipients of migrated history (who'd get Nada's records' history)
const recipients = {};
for (const p of safeWithSibling) {
  const target = p.siblings[0];
  const name = target?.assigned_to_name || 'unassigned';
  recipients[name] = (recipients[name] || 0) + 1;
}
const sortedR = Object.entries(recipients).sort((a, b) => b[1] - a[1]);
console.log('=== HISTORY RECIPIENTS (Top 15) ===');
sortedR.slice(0, 15).forEach(([n, c]) => console.log(`  ${n.padEnd(25)} ${c}`));
if (sortedR.length > 15) console.log(`  ... +${sortedR.length - 15} more`);

// Activity counts to migrate
let totalActs = 0, totalTasks = 0;
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const [a, t] = await Promise.all([
    supabase.from('activities').select('id').in('contact_id', chunk),
    supabase.from('tasks').select('id').in('contact_id', chunk),
  ]);
  totalActs += a.data?.length || 0;
  totalTasks += t.data?.length || 0;
}
console.log(`\nActivities to migrate: ${totalActs}`);
console.log(`Tasks to migrate: ${totalTasks}`);

// Exclusive analysis — for redistribution decisions
console.log('\n=== EXCLUSIVE RECORDS (need redistribution) ===\n');
const exclusiveByStatus = {};
const exclusiveBySource = {};
for (const c of exclusive) {
  exclusiveByStatus[c.contact_status || 'null'] = (exclusiveByStatus[c.contact_status || 'null'] || 0) + 1;
  exclusiveBySource[c.source || 'null'] = (exclusiveBySource[c.source || 'null'] || 0) + 1;
}
console.log('By status:');
for (const [s, c] of Object.entries(exclusiveByStatus).sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(20)} ${c}`);
console.log('\nBy source (top 10):');
const sortedSources = Object.entries(exclusiveBySource).sort((a, b) => b[1] - a[1]);
sortedSources.slice(0, 10).forEach(([s, c]) => console.log(`  ${s.padEnd(20)} ${c}`));

// Save analysis
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = `scripts/backups/nada-cleanup-analysis-${ts}.json`;
fs.writeFileSync(reportFile, JSON.stringify({
  totals: {
    nada_records: nadaRecords.length,
    withSibling: withSibling.length,
    safeWithSibling: safeWithSibling.length,
    skipWithSibling: skipWithSibling.length,
    exclusive: exclusive.length,
    activities: totalActs,
    tasks: totalTasks,
  },
  recipients: Object.fromEntries(sortedR),
  exclusiveByStatus,
  exclusiveBySource,
}, null, 2));
console.log(`\n💾 ${reportFile}`);
