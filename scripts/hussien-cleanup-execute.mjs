import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const HUSSIEN_ID = 'f6030cb5-7699-478d-b641-a10c26ff7444';
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/hussien-cleanup-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });

console.log(`🚀 Hussien Cleanup\n💾 Backup dir: ${backupDir}\n`);

async function withRetry(fn, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < attempts - 1) await new Promise(r => setTimeout(r, 200 * 2**i)); }
  }
  throw last;
}

// Re-fetch fresh
let all = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, full_name, assigned_to').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const byPhone = {};
for (const c of all) { if (c.phone) (byPhone[c.phone] = byPhone[c.phone] || []).push(c); }

const hussien = all.filter(c => c.assigned_to === HUSSIEN_ID);
const withSibling = [];
for (const c of hussien) {
  const siblings = (byPhone[c.phone] || []).filter(s => s.id !== c.id);
  if (siblings.length > 0) withSibling.push({ hussien_record: c, siblings });
}
console.log(`Hussien with sibling: ${withSibling.length}`);

// Filter out deals/opps
const ids = withSibling.map(p => p.hussien_record.id);
const dealsIds = new Set();
const oppsIds = new Set();
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const [d, o] = await Promise.all([
    supabase.from('deals').select('contact_id').in('contact_id', chunk),
    supabase.from('opportunities').select('contact_id').in('contact_id', chunk),
  ]);
  for (const x of d.data || []) dealsIds.add(x.contact_id);
  for (const x of o.data || []) oppsIds.add(x.contact_id);
}

const safe = withSibling.filter(p => !dealsIds.has(p.hussien_record.id) && !oppsIds.has(p.hussien_record.id));
const skipped = withSibling.filter(p => dealsIds.has(p.hussien_record.id) || oppsIds.has(p.hussien_record.id));
console.log(`Safe: ${safe.length} | Skipped (deals/opps): ${skipped.length}\n`);

// Backup full records + activities + tasks
const safeIds = safe.map(p => p.hussien_record.id);
const fullContacts = [];
const fullActs = [];
const fullTasks = [];
for (let i = 0; i < safeIds.length; i += 100) {
  const chunk = safeIds.slice(i, i + 100);
  const [c, a, t] = await Promise.all([
    supabase.from('contacts').select('*').in('id', chunk),
    supabase.from('activities').select('*').in('contact_id', chunk),
    supabase.from('tasks').select('*').in('contact_id', chunk),
  ]);
  fullContacts.push(...(c.data || []));
  fullActs.push(...(a.data || []));
  fullTasks.push(...(t.data || []));
}
fs.writeFileSync(`${backupDir}/contacts-before.json`, JSON.stringify(fullContacts, null, 2));
fs.writeFileSync(`${backupDir}/activities-before.json`, JSON.stringify(fullActs, null, 2));
fs.writeFileSync(`${backupDir}/tasks-before.json`, JSON.stringify(fullTasks, null, 2));
fs.writeFileSync(`${backupDir}/skipped.json`, JSON.stringify(skipped.map(s => ({ id: s.hussien_record.id, name: s.hussien_record.full_name, has_deal: dealsIds.has(s.hussien_record.id), has_opp: oppsIds.has(s.hussien_record.id) })), null, 2));
console.log(`💾 Backup saved: ${fullContacts.length} contacts, ${fullActs.length} acts, ${fullTasks.length} tasks\n`);

// Process each safe record
let actsMoved = 0, tasksMoved = 0, deletedOk = 0, deletedFail = 0;
const errors = [];
const moveMap = [];

console.log('Processing...\n');
const BATCH = 8;
for (let i = 0; i < safe.length; i += BATCH) {
  const slice = safe.slice(i, i + BATCH);
  await Promise.all(slice.map(async p => {
    const fromId = p.hussien_record.id;
    const toId = p.siblings[0].id; // first sibling

    // Move activities
    const acts = fullActs.filter(a => a.contact_id === fromId);
    for (const a of acts) {
      try {
        await withRetry(async () => {
          const { error } = await supabase.from('activities').update({ contact_id: toId }).eq('id', a.id);
          if (error) throw error;
        });
        actsMoved++;
        moveMap.push({ id: a.id, type: 'activity', from: fromId, to: toId });
      } catch (err) { errors.push({ table: 'activities', id: a.id, error: err.message }); }
    }

    // Move tasks
    const tasks = fullTasks.filter(t => t.contact_id === fromId);
    for (const t of tasks) {
      try {
        await withRetry(async () => {
          const { error } = await supabase.from('tasks').update({ contact_id: toId }).eq('id', t.id);
          if (error) throw error;
        });
        tasksMoved++;
        moveMap.push({ id: t.id, type: 'task', from: fromId, to: toId });
      } catch (err) { errors.push({ table: 'tasks', id: t.id, error: err.message }); }
    }

    // Soft-delete
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('contacts').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', fromId);
        if (error) throw error;
      });
      deletedOk++;
    } catch (err) { deletedFail++; errors.push({ table: 'contacts', id: fromId, error: err.message }); }
  }));
  process.stdout.write(`\r  ${Math.min(i + BATCH, safe.length)}/${safe.length} | deleted=${deletedOk} fail=${deletedFail} | acts=${actsMoved} tasks=${tasksMoved}    `);
}
console.log('\n');

fs.writeFileSync(`${backupDir}/move-map.json`, JSON.stringify(moveMap, null, 2));
if (errors.length > 0) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));

console.log('=== DONE ===');
console.log(`Deleted: ${deletedOk} / ${safe.length}`);
console.log(`Failed deletes: ${deletedFail}`);
console.log(`Activities moved: ${actsMoved}`);
console.log(`Tasks moved: ${tasksMoved}`);
console.log(`Errors: ${errors.length}`);
console.log(`\n💾 ${backupDir}`);
