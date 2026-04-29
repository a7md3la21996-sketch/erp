import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { buildResolver } from './lib/nameResolver.mjs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/phase1-full-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });
console.log(`🚀 PHASE 1 FULL MIGRATION\n`);
console.log(`💾 Backup dir: ${backupDir}\n`);

// Retry helper
async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

// Load users + resolver
const { data: users } = await supabase.from('users').select('*');
const resolve = buildResolver(users);

// Load all active multi-contacts (skip already-migrated)
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const multi = allContacts.filter(c =>
  !c.is_deleted &&
  Array.isArray(c.assigned_to_names) &&
  c.assigned_to_names.length > 1
);
console.log(`📊 Multi-contacts to migrate: ${multi.length}`);

// Backup before starting
fs.writeFileSync(`${backupDir}/multi-contacts-before.json`, JSON.stringify(multi, null, 2));
console.log(`💾 Backup written\n`);

// Pre-fetch all child records for these contacts (chunked)
console.log('📥 Fetching child records...');
const ids = multi.map(c => c.id);
const fetchChildren = async (table, fields) => {
  let result = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await supabase.from(table).select(fields).in('contact_id', chunk);
    if (data) result = result.concat(data);
  }
  return result;
};
const allActs = await fetchChildren('activities', 'id, contact_id, user_id, user_name_en, user_name_ar');
const allTasks = await fetchChildren('tasks', 'id, contact_id, assigned_to');
const allOpps = await fetchChildren('opportunities', 'id, contact_id, assigned_to');
const allDeals = await fetchChildren('deals', 'id, contact_id, assigned_to');
console.log(`  Activities: ${allActs.length} | Tasks: ${allTasks.length} | Opps: ${allOpps.length} | Deals: ${allDeals.length}\n`);

const groupBy = (arr, key) => arr.reduce((m, x) => { (m[x[key]] = m[x[key]] || []).push(x); return m; }, {});
const actsByC = groupBy(allActs, 'contact_id');
const tasksByC = groupBy(allTasks, 'contact_id');
const oppsByC = groupBy(allOpps, 'contact_id');
const dealsByC = groupBy(allDeals, 'contact_id');

// Migration tracking
const cloneIdMap = {};
const newRecords = [];
const errors = [];
let migratedCount = 0, failedCount = 0;
let totalChildUpdates = 0, failedChildUpdates = 0;

const startTime = Date.now();

for (const c of multi) {
  try {
    const names = c.assigned_to_names || [];
    const assignees = names.map(name => {
      const r = resolve(name);
      return r ? { name, user_id: r.user_id } : null;
    }).filter(Boolean);
    if (assignees.length !== names.length) throw new Error(`Names didn't resolve: ${names}`);

    let primary = assignees.find(a => a.name === c.assigned_to_name) || assignees[0];
    const others = assignees.filter(a => a.user_id !== primary.user_id);
    if (others.length === 0) {
      // Edge case: all names resolve to same user (e.g., Ahmed Maher / احمد ماهر duplicates in array)
      // Just collapse to single assignment
      const slot = {
        contact_status: (c.agent_statuses || {})[primary.name] || c.contact_status || 'new',
        temperature: (c.agent_temperatures || {})[primary.name] || c.temperature || 'cold',
        lead_score: (c.agent_scores || {})[primary.name] || c.lead_score || 0,
      };
      await withRetry(() => supabase.from('contacts').update({
        assigned_to_names: [primary.name],
        assigned_to_name: primary.name,
        assigned_to: primary.user_id,
        contact_status: slot.contact_status,
        temperature: slot.temperature,
        lead_score: slot.lead_score,
        agent_statuses: { [primary.name]: slot.contact_status },
        agent_temperatures: { [primary.name]: slot.temperature },
        agent_scores: { [primary.name]: slot.lead_score },
      }).eq('id', c.id).then(({ error }) => { if (error) throw error; }));
      migratedCount++;
      continue;
    }

    cloneIdMap[c.id] = {};
    const slotFor = (a) => ({
      contact_status: (c.agent_statuses || {})[a.name] || 'new',
      temperature: (c.agent_temperatures || {})[a.name] || 'cold',
      lead_score: (c.agent_scores || {})[a.name] || 0,
    });

    // Insert clones
    for (let idx = 0; idx < others.length; idx++) {
      const a = others[idx];
      const slot = slotFor(a);
      const clone = {
        full_name: c.full_name,
        phone: c.phone,
        phone2: c.phone2,
        email: c.email,
        contact_type: c.contact_type,
        source: c.source,
        department: c.department,
        platform: c.platform,
        campaign_name: c.campaign_name,
        campaign_id: c.campaign_id,
        campaign_interactions: c.campaign_interactions,
        preferred_location: c.preferred_location,
        interested_in_type: c.interested_in_type,
        budget_min: c.budget_min,
        budget_max: c.budget_max,
        company: c.company,
        job_title: c.job_title,
        gender: c.gender,
        nationality: c.nationality,
        birth_date: c.birth_date,
        prefix: c.prefix,
        extra_phones: c.extra_phones,
        referred_by: c.referred_by,
        notes: c.notes,
        contact_status: slot.contact_status,
        temperature: slot.temperature,
        lead_score: slot.lead_score,
        assigned_to_name: a.name,
        assigned_to: a.user_id,
        assigned_to_names: [a.name],
        agent_statuses: { [a.name]: slot.contact_status },
        agent_temperatures: { [a.name]: slot.temperature },
        agent_scores: { [a.name]: slot.lead_score },
        created_at: c.created_at,
        assigned_at: c.assigned_at || c.created_at,
        contact_number: c.contact_number ? `${c.contact_number}-${idx + 2}` : null,
      };
      const data = await withRetry(async () => {
        const { data, error } = await supabase.from('contacts').insert(clone).select('id').single();
        if (error) throw error;
        return data;
      });
      cloneIdMap[c.id][a.user_id] = data.id;
      newRecords.push({ original: c.id, clone: data.id, assignee: a.name });
    }

    // Redistribute children (with retry)
    const otherUserIds = new Set(others.map(a => a.user_id));
    const moveChild = async (table, row, userId) => {
      totalChildUpdates++;
      const cloneId = cloneIdMap[c.id][userId];
      if (!cloneId) return;
      try {
        await withRetry(async () => {
          const { error } = await supabase.from(table).update({ contact_id: cloneId }).eq('id', row.id);
          if (error) throw error;
        });
      } catch (err) {
        failedChildUpdates++;
        errors.push({ table, row_id: row.id, contact_id: c.id, target_clone: cloneId, error: err.message });
      }
    };

    for (const a of (actsByC[c.id] || [])) {
      if (otherUserIds.has(a.user_id)) await moveChild('activities', a, a.user_id);
    }
    for (const t of (tasksByC[c.id] || [])) {
      if (otherUserIds.has(t.assigned_to)) await moveChild('tasks', t, t.assigned_to);
    }
    for (const o of (oppsByC[c.id] || [])) {
      if (otherUserIds.has(o.assigned_to)) await moveChild('opportunities', o, o.assigned_to);
    }
    for (const d of (dealsByC[c.id] || [])) {
      if (otherUserIds.has(d.assigned_to)) await moveChild('deals', d, d.assigned_to);
    }

    // Update primary record
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

    migratedCount++;
  } catch (err) {
    failedCount++;
    errors.push({ contact_id: c.id, contact_number: c.contact_number, error: err.message });
  }

  // Progress every 50 + checkpoint save every 200
  if ((migratedCount + failedCount) % 50 === 0) {
    const pct = ((migratedCount + failedCount) / multi.length * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`\r  ${migratedCount + failedCount}/${multi.length} (${pct}%) | ok=${migratedCount} fail=${failedCount} | child fails=${failedChildUpdates} | ${elapsed}s    `);
  }
  if ((migratedCount + failedCount) % 200 === 0) {
    fs.writeFileSync(`${backupDir}/clone-id-map.json`, JSON.stringify(cloneIdMap, null, 2));
    fs.writeFileSync(`${backupDir}/new-records.json`, JSON.stringify(newRecords, null, 2));
    if (errors.length > 0) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));
  }
}

// Final save
fs.writeFileSync(`${backupDir}/clone-id-map.json`, JSON.stringify(cloneIdMap, null, 2));
fs.writeFileSync(`${backupDir}/new-records.json`, JSON.stringify(newRecords, null, 2));
if (errors.length > 0) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));

const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
console.log('\n');
console.log('=== MIGRATION COMPLETE ===');
console.log(`  Multi-contacts processed: ${migratedCount + failedCount}/${multi.length}`);
console.log(`  Successful migrations:    ${migratedCount}`);
console.log(`  Failed migrations:        ${failedCount}`);
console.log(`  New clones created:       ${newRecords.length}`);
console.log(`  Child updates total:      ${totalChildUpdates}`);
console.log(`  Child updates failed:     ${failedChildUpdates}`);
console.log(`  Total errors:             ${errors.length}`);
console.log(`  Elapsed:                  ${elapsed}s`);
console.log(`\n💾 Logs in: ${backupDir}`);
