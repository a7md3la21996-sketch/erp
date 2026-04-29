import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { buildResolver } from './lib/nameResolver.mjs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/phase1-full-fast-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });
console.log(`🚀 PHASE 1 FAST MIGRATION (parallelized)\n`);
console.log(`💾 Backup dir: ${backupDir}\n`);

const PARALLEL = 8; // contacts processed concurrently
const RETRY = 3;

async function withRetry(fn, attempts = RETRY) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < attempts - 1) await new Promise(r => setTimeout(r, 200 * 2**i)); }
  }
  throw last;
}

// Load resolver
const { data: users } = await supabase.from('users').select('*');
const resolve = buildResolver(users);

// Load remaining multi-contacts
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const multi = allContacts.filter(c => !c.is_deleted && Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 1);
console.log(`📊 Multi-contacts to migrate: ${multi.length}\n`);

fs.writeFileSync(`${backupDir}/multi-contacts-before.json`, JSON.stringify(multi, null, 2));

// Pre-fetch children
console.log('📥 Fetching child records...');
const ids = multi.map(c => c.id);
const fetchChildren = async (table, fields) => {
  let result = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await withRetry(async () => {
      const { data, error } = await supabase.from(table).select(fields).in('contact_id', chunk);
      if (error) throw error;
      return { data };
    });
    if (data) result = result.concat(data);
  }
  return result;
};
const [allActs, allTasks, allOpps, allDeals] = await Promise.all([
  fetchChildren('activities', 'id, contact_id, user_id'),
  fetchChildren('tasks', 'id, contact_id, assigned_to'),
  fetchChildren('opportunities', 'id, contact_id, assigned_to'),
  fetchChildren('deals', 'id, contact_id, assigned_to'),
]);
console.log(`  Activities: ${allActs.length} | Tasks: ${allTasks.length} | Opps: ${allOpps.length} | Deals: ${allDeals.length}\n`);

const groupBy = (arr, key) => arr.reduce((m, x) => { (m[x[key]] = m[x[key]] || []).push(x); return m; }, {});
const actsByC = groupBy(allActs, 'contact_id');
const tasksByC = groupBy(allTasks, 'contact_id');
const oppsByC = groupBy(allOpps, 'contact_id');
const dealsByC = groupBy(allDeals, 'contact_id');

const cloneIdMap = {};
const newRecords = [];
const errors = [];
let migrated = 0, failed = 0, childOk = 0, childFail = 0;
const startTime = Date.now();

async function migrateOne(c) {
  try {
    const names = c.assigned_to_names || [];
    const assignees = names.map(name => {
      const r = resolve(name);
      return r ? { name, user_id: r.user_id } : null;
    }).filter(Boolean);
    if (assignees.length !== names.length) throw new Error('unresolved names');

    let primary = assignees.find(a => a.name === c.assigned_to_name) || assignees[0];
    // Dedupe others by user_id (handles Ahmed Maher / احمد ماهر case)
    const seen = new Set([primary.user_id]);
    const others = assignees.filter(a => {
      if (seen.has(a.user_id)) return false;
      seen.add(a.user_id);
      return true;
    });

    const slotFor = (a) => ({
      contact_status: (c.agent_statuses || {})[a.name] || 'new',
      temperature: (c.agent_temperatures || {})[a.name] || 'cold',
      lead_score: (c.agent_scores || {})[a.name] || 0,
    });

    cloneIdMap[c.id] = {};

    if (others.length === 0) {
      // Edge case: collapse only
      const slot = slotFor(primary);
      await withRetry(async () => {
        const { error } = await supabase.from('contacts').update({
          assigned_to_names: [primary.name],
          assigned_to_name: primary.name,
          assigned_to: primary.user_id,
          contact_status: slot.contact_status,
          temperature: slot.temperature,
          lead_score: slot.lead_score,
          agent_statuses: { [primary.name]: slot.contact_status },
          agent_temperatures: { [primary.name]: slot.temperature },
          agent_scores: { [primary.name]: slot.lead_score },
        }).eq('id', c.id);
        if (error) throw error;
      });
      return { ok: true };
    }

    // Build all clone payloads
    const clonePayloads = others.map((a, idx) => {
      const slot = slotFor(a);
      return {
        full_name: c.full_name, phone: c.phone, phone2: c.phone2, email: c.email,
        contact_type: c.contact_type, source: c.source, department: c.department, platform: c.platform,
        campaign_name: c.campaign_name, campaign_id: c.campaign_id, campaign_interactions: c.campaign_interactions,
        preferred_location: c.preferred_location, interested_in_type: c.interested_in_type,
        budget_min: c.budget_min, budget_max: c.budget_max,
        company: c.company, job_title: c.job_title, gender: c.gender, nationality: c.nationality,
        birth_date: c.birth_date, prefix: c.prefix, extra_phones: c.extra_phones,
        referred_by: c.referred_by, notes: c.notes,
        contact_status: slot.contact_status, temperature: slot.temperature, lead_score: slot.lead_score,
        assigned_to_name: a.name, assigned_to: a.user_id, assigned_to_names: [a.name],
        agent_statuses: { [a.name]: slot.contact_status },
        agent_temperatures: { [a.name]: slot.temperature },
        agent_scores: { [a.name]: slot.lead_score },
        created_at: c.created_at, assigned_at: c.assigned_at || c.created_at,
        contact_number: c.contact_number ? `${c.contact_number}-${idx + 2}` : null,
      };
    });

    // Bulk insert all clones at once
    const inserted = await withRetry(async () => {
      const { data, error } = await supabase.from('contacts').insert(clonePayloads).select('id, assigned_to');
      if (error) throw error;
      return data;
    });
    for (const ins of inserted) cloneIdMap[c.id][ins.assigned_to] = ins.id;
    for (const ins of inserted) newRecords.push({ original: c.id, clone: ins.id, user_id: ins.assigned_to });

    // Redistribute children in parallel (per child table)
    const otherUserIds = new Set(others.map(a => a.user_id));
    const moveOps = [];
    for (const a of (actsByC[c.id] || [])) {
      if (otherUserIds.has(a.user_id) && cloneIdMap[c.id][a.user_id]) {
        moveOps.push({ table: 'activities', id: a.id, target: cloneIdMap[c.id][a.user_id] });
      }
    }
    for (const t of (tasksByC[c.id] || [])) {
      if (otherUserIds.has(t.assigned_to) && cloneIdMap[c.id][t.assigned_to]) {
        moveOps.push({ table: 'tasks', id: t.id, target: cloneIdMap[c.id][t.assigned_to] });
      }
    }
    for (const o of (oppsByC[c.id] || [])) {
      if (otherUserIds.has(o.assigned_to) && cloneIdMap[c.id][o.assigned_to]) {
        moveOps.push({ table: 'opportunities', id: o.id, target: cloneIdMap[c.id][o.assigned_to] });
      }
    }
    for (const d of (dealsByC[c.id] || [])) {
      if (otherUserIds.has(d.assigned_to) && cloneIdMap[c.id][d.assigned_to]) {
        moveOps.push({ table: 'deals', id: d.id, target: cloneIdMap[c.id][d.assigned_to] });
      }
    }

    const moveResults = await Promise.allSettled(moveOps.map(op =>
      withRetry(async () => {
        const { error } = await supabase.from(op.table).update({ contact_id: op.target }).eq('id', op.id);
        if (error) throw error;
      })
    ));
    for (let i = 0; i < moveResults.length; i++) {
      if (moveResults[i].status === 'fulfilled') childOk++;
      else { childFail++; errors.push({ ...moveOps[i], error: moveResults[i].reason?.message }); }
    }

    // Update primary
    const primarySlot = slotFor(primary);
    await withRetry(async () => {
      const { error } = await supabase.from('contacts').update({
        contact_status: primarySlot.contact_status,
        temperature: primarySlot.temperature,
        lead_score: primarySlot.lead_score,
        assigned_to_names: [primary.name],
        assigned_to_name: primary.name,
        assigned_to: primary.user_id,
        agent_statuses: { [primary.name]: primarySlot.contact_status },
        agent_temperatures: { [primary.name]: primarySlot.temperature },
        agent_scores: { [primary.name]: primarySlot.lead_score },
      }).eq('id', c.id);
      if (error) throw error;
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Process in parallel batches
async function runBatch(batch) {
  const results = await Promise.all(batch.map(c => migrateOne(c).then(r => ({ contact: c, ...r }))));
  for (const r of results) {
    if (r.ok) migrated++;
    else { failed++; errors.push({ contact_id: r.contact.id, contact_number: r.contact.contact_number, error: r.error }); }
  }
}

console.log(`Processing ${multi.length} contacts in batches of ${PARALLEL}...\n`);

for (let i = 0; i < multi.length; i += PARALLEL) {
  const batch = multi.slice(i, i + PARALLEL);
  await runBatch(batch);
  const done = migrated + failed;
  const pct = (done / multi.length * 100).toFixed(1);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const rate = (done / elapsed * 60).toFixed(0);
  process.stdout.write(`\r  ${done}/${multi.length} (${pct}%) | ok=${migrated} fail=${failed} | child ok=${childOk} fail=${childFail} | ${elapsed}s | ${rate}/min    `);

  // Save checkpoint every 200 contacts
  if (done % 200 < PARALLEL) {
    fs.writeFileSync(`${backupDir}/clone-id-map.json`, JSON.stringify(cloneIdMap, null, 2));
    fs.writeFileSync(`${backupDir}/new-records.json`, JSON.stringify(newRecords, null, 2));
    if (errors.length) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));
  }
}

// Final save
fs.writeFileSync(`${backupDir}/clone-id-map.json`, JSON.stringify(cloneIdMap, null, 2));
fs.writeFileSync(`${backupDir}/new-records.json`, JSON.stringify(newRecords, null, 2));
if (errors.length) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));

const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
console.log('\n');
console.log('=== MIGRATION COMPLETE ===');
console.log(`  Multi-contacts:       ${migrated + failed}/${multi.length}`);
console.log(`  Successful:           ${migrated}`);
console.log(`  Failed:               ${failed}`);
console.log(`  Clones created:       ${newRecords.length}`);
console.log(`  Child updates ok:     ${childOk}`);
console.log(`  Child updates fail:   ${childFail}`);
console.log(`  Errors:               ${errors.length}`);
console.log(`  Elapsed:              ${elapsed}s`);
console.log(`\n💾 Logs in: ${backupDir}`);
