import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { buildResolver } from './lib/nameResolver.mjs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 Phase 1 DRY-RUN: Multi-Assignment Migration\n');

// Load users + resolver
const { data: users } = await supabase.from('users').select('*');
const resolve = buildResolver(users);
const userById = Object.fromEntries(users.map(u => [u.id, u]));
console.log(`👤 Users loaded: ${users.length}`);

// Load all active contacts with multi-assignment
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = allContacts.filter(c => !c.is_deleted);
const multiContacts = active.filter(c => Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 1);
console.log(`📊 Active contacts: ${active.length} | Multi-assignment: ${multiContacts.length}\n`);

// Pre-fetch all activities/tasks/opps/deals for multi-contacts (in batches)
console.log('📥 Fetching child records for multi-contacts...');
const multiIds = multiContacts.map(c => c.id);
const fetchInBatches = async (table, fields) => {
  let result = [];
  for (let i = 0; i < multiIds.length; i += 100) {
    const ids = multiIds.slice(i, i + 100);
    const { data } = await supabase.from(table).select(fields).in('contact_id', ids);
    if (data) result = result.concat(data);
  }
  return result;
};

const allActivities = await fetchInBatches('activities', 'id, contact_id, user_id, user_name_en, user_name_ar');
const allTasks = await fetchInBatches('tasks', 'id, contact_id, assigned_to, assigned_to_name_en, assigned_to_name_ar');
const allOpps = await fetchInBatches('opportunities', 'id, contact_id, assigned_to, assigned_to_name, agent_name');
const allDeals = await fetchInBatches('deals', 'id, contact_id, assigned_to, agent_en, agent_ar');
console.log(`  Activities: ${allActivities.length}`);
console.log(`  Tasks:      ${allTasks.length}`);
console.log(`  Opps:       ${allOpps.length}`);
console.log(`  Deals:      ${allDeals.length}\n`);

// Group child records by contact_id
const groupBy = (arr, key) => arr.reduce((acc, x) => { (acc[x[key]] = acc[x[key]] || []).push(x); return acc; }, {});
const actsByContact = groupBy(allActivities, 'contact_id');
const tasksByContact = groupBy(allTasks, 'contact_id');
const oppsByContact = groupBy(allOpps, 'contact_id');
const dealsByContact = groupBy(allDeals, 'contact_id');

// Plan migration for each multi-contact
const plan = {
  primaryUpdates: [],   // updates to existing record (primary)
  clonesToInsert: [],   // new records for non-primary assignees
  childUpdates: {       // child record contact_id reassignments
    activities: [],
    tasks: [],
    opportunities: [],
    deals: [],
  },
  orphans: {
    activities: 0,
    tasks: 0,
    opportunities: 0,
    deals: 0,
  },
  errors: [],
};

let nameMismatchCount = 0;

for (const c of multiContacts) {
  const names = c.assigned_to_names || [];
  // Resolve each name → user
  const assignees = names.map(name => {
    const r = resolve(name);
    if (!r) return null;
    return { name, user_id: r.user_id, canonical_en: r.canonical_en, canonical_ar: r.canonical_ar };
  }).filter(Boolean);

  if (assignees.length !== names.length) {
    plan.errors.push({ contact_id: c.id, msg: 'Some names did not resolve', names, resolved_count: assignees.length });
    continue;
  }

  // Determine primary: prefer current assigned_to_name's resolved user, else first
  let primary = assignees.find(a => a.name === c.assigned_to_name);
  if (!primary) primary = assignees[0];
  const others = assignees.filter(a => a.user_id !== primary.user_id);

  // Helper: pick the slot from jsonb maps for a given name
  const slotFor = (a) => ({
    contact_status: (c.agent_statuses || {})[a.name] || 'new',
    temperature: (c.agent_temperatures || {})[a.name] || 'cold',
    lead_score: (c.agent_scores || {})[a.name] || 0,
  });

  // Update plan for the primary's existing record
  const primarySlot = slotFor(primary);
  plan.primaryUpdates.push({
    id: c.id,
    contact_status: primarySlot.contact_status,
    temperature: primarySlot.temperature,
    lead_score: primarySlot.lead_score,
    assigned_to_names: [primary.name],
    assigned_to_name: primary.name,
    assigned_to: primary.user_id,
    agent_statuses: { [primary.name]: primarySlot.contact_status },
    agent_temperatures: { [primary.name]: primarySlot.temperature },
    agent_scores: { [primary.name]: primarySlot.lead_score },
  });

  // Plan a clone for each non-primary assignee
  for (const a of others) {
    const slot = slotFor(a);
    plan.clonesToInsert.push({
      // Personal info — copied from original
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
      // Operational — sourced from this assignee's slot
      contact_status: slot.contact_status,
      temperature: slot.temperature,
      lead_score: slot.lead_score,
      assigned_to_name: a.name,
      assigned_to: a.user_id,
      assigned_to_names: [a.name],
      agent_statuses: { [a.name]: slot.contact_status },
      agent_temperatures: { [a.name]: slot.temperature },
      agent_scores: { [a.name]: slot.lead_score },
      // Timestamps
      created_at: c.created_at,
      assigned_at: c.assigned_at || c.created_at,
      // Internal — points back to source contact
      _origin_contact_id: c.id,
      _origin_contact_number: c.contact_number,
      // Notes preserved from original (optional — could be empty string instead)
      notes: c.notes,
      // Don't copy: id, contact_number (will be auto-gen), updated_at, last_activity_at, deleted fields
    });
  }

  // Plan child record redistribution
  const acts = actsByContact[c.id] || [];
  const tasks = tasksByContact[c.id] || [];
  const opps = oppsByContact[c.id] || [];
  const deals = dealsByContact[c.id] || [];
  const otherUserIds = new Set(others.map(a => a.user_id));

  // Activities — match by user_id
  for (const a of acts) {
    if (otherUserIds.has(a.user_id)) {
      plan.childUpdates.activities.push({
        id: a.id,
        old_contact_id: c.id,
        new_assignee_user_id: a.user_id, // will resolve to clone's contact_id during execution
      });
    } else {
      // user_id is primary OR orphan — stays on primary record (no change)
      if (!a.user_id || (a.user_id !== primary.user_id && !otherUserIds.has(a.user_id))) {
        plan.orphans.activities++;
      }
    }
  }
  // Tasks
  for (const t of tasks) {
    if (otherUserIds.has(t.assigned_to)) {
      plan.childUpdates.tasks.push({
        id: t.id,
        old_contact_id: c.id,
        new_assignee_user_id: t.assigned_to,
      });
    } else if (!t.assigned_to || (t.assigned_to !== primary.user_id && !otherUserIds.has(t.assigned_to))) {
      plan.orphans.tasks++;
    }
  }
  // Opportunities
  for (const o of opps) {
    if (otherUserIds.has(o.assigned_to)) {
      plan.childUpdates.opportunities.push({
        id: o.id,
        old_contact_id: c.id,
        new_assignee_user_id: o.assigned_to,
      });
    } else if (!o.assigned_to || (o.assigned_to !== primary.user_id && !otherUserIds.has(o.assigned_to))) {
      plan.orphans.opportunities++;
    }
  }
  // Deals
  for (const d of deals) {
    if (otherUserIds.has(d.assigned_to)) {
      plan.childUpdates.deals.push({
        id: d.id,
        old_contact_id: c.id,
        new_assignee_user_id: d.assigned_to,
      });
    } else if (!d.assigned_to || (d.assigned_to !== primary.user_id && !otherUserIds.has(d.assigned_to))) {
      plan.orphans.deals++;
    }
  }
}

// Output report
console.log('📊 PHASE 1 PLAN:\n');
console.log(`  Multi-contacts to migrate:     ${multiContacts.length}`);
console.log(`  Primary records to update:     ${plan.primaryUpdates.length}`);
console.log(`  New clone records to insert:   ${plan.clonesToInsert.length}`);
console.log(`  Activities to redistribute:    ${plan.childUpdates.activities.length}`);
console.log(`  Tasks to redistribute:         ${plan.childUpdates.tasks.length}`);
console.log(`  Opps to redistribute:          ${plan.childUpdates.opportunities.length}`);
console.log(`  Deals to redistribute:         ${plan.childUpdates.deals.length}`);
console.log(`\n  Orphan activities (stay on primary):    ${plan.orphans.activities}`);
console.log(`  Orphan tasks (stay on primary):         ${plan.orphans.tasks}`);
console.log(`  Orphan opps (stay on primary):          ${plan.orphans.opportunities}`);
console.log(`  Orphan deals (stay on primary):         ${plan.orphans.deals}`);
console.log(`\n  Errors (unresolved names): ${plan.errors.length}`);
if (plan.errors.length > 0) {
  console.log('\n  Sample errors (first 5):');
  plan.errors.slice(0, 5).forEach(e => console.log(`    contact ${e.contact_id}: ${e.msg} | names=${JSON.stringify(e.names)}`));
}

// Per-agent record count after migration
const newAgentCounts = {};
for (const u of plan.primaryUpdates) newAgentCounts[u.assigned_to_name] = (newAgentCounts[u.assigned_to_name] || 0) + 1;
for (const c of plan.clonesToInsert) newAgentCounts[c.assigned_to_name] = (newAgentCounts[c.assigned_to_name] || 0) + 1;

console.log('\n👥 NEW records to be assigned per agent (Top 20):');
const sorted = Object.entries(newAgentCounts).sort((a,b)=>b[1]-a[1]);
sorted.slice(0, 20).forEach(([n, c], i) => console.log(`  ${(i+1).toString().padStart(2)}. ${n.padEnd(25)} ${c}`));

// Save plan
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `scripts/backups/phase1-plan-${ts}.json`;
fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
const summaryFile = `scripts/backups/phase1-summary-${ts}.json`;
fs.writeFileSync(summaryFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  multiContacts: multiContacts.length,
  primaryUpdates: plan.primaryUpdates.length,
  clonesToInsert: plan.clonesToInsert.length,
  childRedistribution: {
    activities: plan.childUpdates.activities.length,
    tasks: plan.childUpdates.tasks.length,
    opportunities: plan.childUpdates.opportunities.length,
    deals: plan.childUpdates.deals.length,
  },
  orphans: plan.orphans,
  errors: plan.errors.length,
  newAgentCounts,
}, null, 2));

console.log(`\n💾 Full plan: ${planFile}`);
console.log(`💾 Summary:   ${summaryFile}`);
console.log('\n✅ DRY-RUN COMPLETE. NO WRITES PERFORMED.');
