import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { buildResolver } from './lib/nameResolver.mjs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const errLog = `scripts/backups/uuid-backfill-errors-${ts}.json`;
const allErrors = { contacts: [], activities: [], tasks: [], opportunities: [], deals: [] };

console.log('🚀 UUID Backfill Execution Starting...\n');

const { data: users } = await supabase.from('users').select('*');
const resolve = buildResolver(users);
console.log(`👤 Users loaded: ${users.length}\n`);

async function fetchAll(table, columns) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) { console.log(`❌ ${table}: ${error.message}`); break; }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function applyBatch(table, updates, batchSize = 100) {
  let ok = 0, fail = 0;
  for (let i = 0; i < updates.length; i += batchSize) {
    const slice = updates.slice(i, i + batchSize);
    const results = await Promise.all(slice.map(async u => {
      const { id, ...patch } = u;
      const { error } = await supabase.from(table).update(patch).eq('id', id);
      return error ? { id, error: error.message, patch } : { id, ok: true };
    }));
    for (const r of results) { if (r.ok) ok++; else { fail++; allErrors[table].push(r); } }
    process.stdout.write(`\r  ${table}: ${Math.min(i + batchSize, updates.length)}/${updates.length} | ok=${ok} fail=${fail}    `);
  }
  console.log('');
  return { ok, fail };
}

// ===== contacts =====
console.log('=== contacts (assigned_to + created_by) ===');
const contacts = await fetchAll('contacts', 'id, assigned_to, assigned_to_name, created_by, created_by_name, is_deleted');
const updates_c = [];
for (const c of contacts) {
  if (c.is_deleted) continue;
  const patch = { id: c.id };
  let touched = false;
  if (!c.assigned_to && c.assigned_to_name) {
    const r = resolve(c.assigned_to_name);
    if (r) { patch.assigned_to = r.user_id; touched = true; }
  }
  if (!c.created_by && c.created_by_name) {
    const r = resolve(c.created_by_name);
    if (r) { patch.created_by = r.user_id; touched = true; }
  }
  if (touched) updates_c.push(patch);
}
console.log(`  Will update ${updates_c.length} contacts...`);
const r_c = await applyBatch('contacts', updates_c);

// ===== activities =====
console.log('\n=== activities (user_id) ===');
const activities = await fetchAll('activities', 'id, user_id, user_name_en, user_name_ar');
const updates_a = [];
for (const a of activities) {
  if (a.user_id) continue;
  const name = a.user_name_en || a.user_name_ar;
  if (!name) continue;
  const r = resolve(name);
  if (r) updates_a.push({ id: a.id, user_id: r.user_id });
}
console.log(`  Will update ${updates_a.length} activities...`);
const r_a = await applyBatch('activities', updates_a);

// ===== tasks =====
console.log('\n=== tasks (assigned_to) ===');
const tasks = await fetchAll('tasks', 'id, assigned_to, assigned_to_name_en, assigned_to_name_ar');
const updates_t = [];
for (const t of tasks) {
  if (t.assigned_to) continue;
  const name = t.assigned_to_name_en || t.assigned_to_name_ar;
  if (!name) continue;
  const r = resolve(name);
  if (r) updates_t.push({ id: t.id, assigned_to: r.user_id });
}
console.log(`  Will update ${updates_t.length} tasks...`);
const r_t = await applyBatch('tasks', updates_t);

// ===== opportunities =====
console.log('\n=== opportunities (assigned_to) ===');
const opps = await fetchAll('opportunities', 'id, assigned_to, assigned_to_name, agent_name');
const updates_o = [];
for (const o of opps) {
  if (o.assigned_to) continue;
  const name = o.assigned_to_name || o.agent_name;
  if (!name) continue;
  const r = resolve(name);
  if (r) updates_o.push({ id: o.id, assigned_to: r.user_id });
}
console.log(`  Will update ${updates_o.length} opportunities...`);
const r_o = await applyBatch('opportunities', updates_o);

// ===== deals =====
console.log('\n=== deals (assigned_to) ===');
const deals = await fetchAll('deals', 'id, assigned_to, agent_en, agent_ar');
const updates_d = [];
for (const d of deals) {
  if (d.assigned_to) continue;
  const name = d.agent_en || d.agent_ar;
  if (!name) continue;
  const r = resolve(name);
  if (r) updates_d.push({ id: d.id, assigned_to: r.user_id });
}
console.log(`  Will update ${updates_d.length} deals...`);
const r_d = await applyBatch('deals', updates_d);

// ===== Save errors =====
const totalErrors = Object.values(allErrors).reduce((s, arr) => s + arr.length, 0);
if (totalErrors > 0) {
  fs.writeFileSync(errLog, JSON.stringify(allErrors, null, 2));
  console.log(`\n⚠️ ${totalErrors} errors saved to: ${errLog}`);
}

console.log('\n=== EXECUTION SUMMARY ===');
console.log(`  contacts:      ok=${r_c.ok} fail=${r_c.fail}`);
console.log(`  activities:    ok=${r_a.ok} fail=${r_a.fail}`);
console.log(`  tasks:         ok=${r_t.ok} fail=${r_t.fail}`);
console.log(`  opportunities: ok=${r_o.ok} fail=${r_o.fail}`);
console.log(`  deals:         ok=${r_d.ok} fail=${r_d.fail}`);
console.log(`  TOTAL OK:      ${r_c.ok + r_a.ok + r_t.ok + r_o.ok + r_d.ok}`);
console.log(`  TOTAL FAIL:    ${r_c.fail + r_a.fail + r_t.fail + r_o.fail + r_d.fail}`);
console.log('\n✅ DONE');
