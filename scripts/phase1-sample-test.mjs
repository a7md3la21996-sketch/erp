import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { buildResolver } from './lib/nameResolver.mjs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const SAMPLE_SIZE = 10;

console.log(`🧪 Phase 1 SAMPLE TEST (${SAMPLE_SIZE} multi-contacts)\n`);

const { data: users } = await supabase.from('users').select('*');
const resolve = buildResolver(users);

// Pick a representative sample: mix of 2-assignee, 3-assignee, and edge cases
const { data: allMulti } = await supabase.from('contacts')
  .select('*')
  .eq('is_deleted', false)
  .not('assigned_to_names', 'is', null);
const multi = allMulti.filter(c => Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 1);
console.log(`📊 Total multi-contacts available: ${multi.length}`);

// Stratified sampling: 5 with 2 assignees, 3 with 3, 2 with 4+
const buckets = { 2: [], 3: [], 4: [] };
for (const c of multi) {
  const n = c.assigned_to_names.length;
  if (n === 2) buckets[2].push(c);
  else if (n === 3) buckets[3].push(c);
  else if (n >= 4) buckets[4].push(c);
}
const pickRandom = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const sample = [
  ...pickRandom(buckets[2], 5),
  ...pickRandom(buckets[3], 3),
  ...pickRandom(buckets[4], 2),
].slice(0, SAMPLE_SIZE);

console.log(`🎯 Sample: ${sample.length} contacts`);
sample.forEach((c, i) => console.log(`  ${i+1}. ${c.contact_number} | ${c.full_name?.slice(0,20).padEnd(20)} | assignees: ${c.assigned_to_names.length}`));

// Backup before any change
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/phase1-sample-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(`${backupDir}/sample-contacts-before.json`, JSON.stringify(sample, null, 2));

// Fetch related child records
const sampleIds = sample.map(c => c.id);
const { data: sampleActs } = await supabase.from('activities').select('*').in('contact_id', sampleIds);
const { data: sampleTasks } = await supabase.from('tasks').select('*').in('contact_id', sampleIds);
const { data: sampleOpps } = await supabase.from('opportunities').select('*').in('contact_id', sampleIds);
const { data: sampleDeals } = await supabase.from('deals').select('*').in('contact_id', sampleIds);
fs.writeFileSync(`${backupDir}/activities-before.json`, JSON.stringify(sampleActs, null, 2));
fs.writeFileSync(`${backupDir}/tasks-before.json`, JSON.stringify(sampleTasks, null, 2));
fs.writeFileSync(`${backupDir}/opportunities-before.json`, JSON.stringify(sampleOpps, null, 2));
fs.writeFileSync(`${backupDir}/deals-before.json`, JSON.stringify(sampleDeals, null, 2));
console.log(`💾 Backup saved: ${backupDir}/`);
console.log(`   Activities: ${sampleActs?.length || 0}, Tasks: ${sampleTasks?.length || 0}, Opps: ${sampleOpps?.length || 0}, Deals: ${sampleDeals?.length || 0}\n`);

// =============================================================
// EXECUTE MIGRATION on sample
// =============================================================
const cloneIdMap = {}; // {origContactId: {assigneeUserId: cloneContactId}}
const newRecords = [];
const errors = [];

console.log('🚀 Migrating sample contacts...\n');

for (const c of sample) {
  try {
    const names = c.assigned_to_names || [];
    const assignees = names.map(name => {
      const r = resolve(name);
      return r ? { name, user_id: r.user_id } : null;
    }).filter(Boolean);
    if (assignees.length !== names.length) throw new Error(`Some names didn't resolve: ${names}`);

    let primary = assignees.find(a => a.name === c.assigned_to_name) || assignees[0];
    const others = assignees.filter(a => a.user_id !== primary.user_id);

    const slotFor = (a) => ({
      contact_status: (c.agent_statuses || {})[a.name] || 'new',
      temperature: (c.agent_temperatures || {})[a.name] || 'cold',
      lead_score: (c.agent_scores || {})[a.name] || 0,
    });

    cloneIdMap[c.id] = {};

    // Step 1: Insert clones for each non-primary assignee
    for (const a of others) {
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
        contact_number: `${c.contact_number}-${others.indexOf(a) + 2}`,
      };
      const { data, error } = await supabase.from('contacts').insert(clone).select('id').single();
      if (error) throw new Error(`Insert clone failed for ${a.name}: ${error.message}`);
      cloneIdMap[c.id][a.user_id] = data.id;
      newRecords.push({ original: c.id, clone: data.id, assignee: a.name });
    }

    // Step 2: Redistribute child records to clones (by user_id match)
    const otherUserIds = new Set(others.map(a => a.user_id));

    // Activities
    for (const act of (sampleActs || []).filter(a => a.contact_id === c.id)) {
      if (otherUserIds.has(act.user_id)) {
        const cloneId = cloneIdMap[c.id][act.user_id];
        const { error } = await supabase.from('activities').update({ contact_id: cloneId }).eq('id', act.id);
        if (error) errors.push({ table: 'activities', id: act.id, error: error.message });
      }
    }
    // Tasks
    for (const t of (sampleTasks || []).filter(x => x.contact_id === c.id)) {
      if (otherUserIds.has(t.assigned_to)) {
        const cloneId = cloneIdMap[c.id][t.assigned_to];
        const { error } = await supabase.from('tasks').update({ contact_id: cloneId }).eq('id', t.id);
        if (error) errors.push({ table: 'tasks', id: t.id, error: error.message });
      }
    }
    // Opps
    for (const o of (sampleOpps || []).filter(x => x.contact_id === c.id)) {
      if (otherUserIds.has(o.assigned_to)) {
        const cloneId = cloneIdMap[c.id][o.assigned_to];
        const { error } = await supabase.from('opportunities').update({ contact_id: cloneId }).eq('id', o.id);
        if (error) errors.push({ table: 'opportunities', id: o.id, error: error.message });
      }
    }
    // Deals
    for (const d of (sampleDeals || []).filter(x => x.contact_id === c.id)) {
      if (otherUserIds.has(d.assigned_to)) {
        const cloneId = cloneIdMap[c.id][d.assigned_to];
        const { error } = await supabase.from('deals').update({ contact_id: cloneId }).eq('id', d.id);
        if (error) errors.push({ table: 'deals', id: d.id, error: error.message });
      }
    }

    // Step 3: Update primary record (collapse to single assignee)
    const primarySlot = slotFor(primary);
    const primaryUpdate = {
      contact_status: primarySlot.contact_status,
      temperature: primarySlot.temperature,
      lead_score: primarySlot.lead_score,
      assigned_to_names: [primary.name],
      assigned_to_name: primary.name,
      assigned_to: primary.user_id,
      agent_statuses: { [primary.name]: primarySlot.contact_status },
      agent_temperatures: { [primary.name]: primarySlot.temperature },
      agent_scores: { [primary.name]: primarySlot.lead_score },
    };
    const { error: upErr } = await supabase.from('contacts').update(primaryUpdate).eq('id', c.id);
    if (upErr) throw new Error(`Update primary failed: ${upErr.message}`);

    process.stdout.write(`\r  Migrated ${sample.indexOf(c) + 1}/${sample.length}    `);
  } catch (err) {
    errors.push({ contact_id: c.id, error: err.message });
    console.log(`\n  ❌ ${c.contact_number}: ${err.message}`);
  }
}
console.log('\n');

// Save mapping
fs.writeFileSync(`${backupDir}/clone-id-map.json`, JSON.stringify(cloneIdMap, null, 2));
fs.writeFileSync(`${backupDir}/new-records.json`, JSON.stringify(newRecords, null, 2));
if (errors.length > 0) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));

console.log(`📊 Sample test complete:`);
console.log(`  New records created: ${newRecords.length}`);
console.log(`  Errors: ${errors.length}`);
console.log(`  Backup dir: ${backupDir}`);

// =============================================================
// VERIFICATION
// =============================================================
console.log('\n🔬 VERIFICATION:\n');
let verifyOk = true;
for (const c of sample) {
  const { data: after } = await supabase.from('contacts').select('id, assigned_to_names, assigned_to_name, assigned_to, agent_statuses').eq('id', c.id).single();
  if (!after) { console.log(`  ❌ ${c.contact_number}: original record missing!`); verifyOk = false; continue; }
  if (after.assigned_to_names.length !== 1) { console.log(`  ❌ ${c.contact_number}: still has ${after.assigned_to_names.length} assignees`); verifyOk = false; continue; }

  // Check clones exist
  const cloneIds = Object.values(cloneIdMap[c.id] || {});
  for (const cid of cloneIds) {
    const { data: clone } = await supabase.from('contacts').select('id, assigned_to_names, assigned_to').eq('id', cid).single();
    if (!clone) { console.log(`  ❌ ${c.contact_number}: clone ${cid} missing!`); verifyOk = false; }
  }
  console.log(`  ✅ ${c.contact_number}: ${after.assigned_to_names[0]} | ${cloneIds.length} clone(s)`);
}

console.log(`\n${verifyOk ? '✅ ALL VERIFICATIONS PASSED' : '❌ SOME VERIFICATIONS FAILED'}`);
console.log(`\n💾 Backup for rollback: ${backupDir}/`);
console.log(`   To rollback: node scripts/phase1-sample-rollback.mjs ${backupDir}`);
