import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 Phantom Cleanup — Step 1: ANALYSIS (read-only)\n');

// Get managers with phantom records
const { data: managers } = await supabase.from('users')
  .select('id, full_name_en, full_name_ar, role, team_id, status')
  .in('role', ['sales_manager', 'team_leader']);

// Get sales agents grouped by team
const { data: agents } = await supabase.from('users')
  .select('id, full_name_en, team_id')
  .eq('role', 'sales_agent');
const agentsByTeam = {};
for (const a of agents) {
  if (!a.team_id) continue;
  if (!agentsByTeam[a.team_id]) agentsByTeam[a.team_id] = [];
  agentsByTeam[a.team_id].push(a);
}

// Fetch all active contacts
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

// Group by phone
const byPhone = {};
for (const c of allContacts) {
  if (!c.phone) continue;
  if (!byPhone[c.phone]) byPhone[c.phone] = [];
  byPhone[c.phone].push(c);
}

// Find phantoms: manager records that have a team-mate sibling on same phone
const phantoms = [];
for (const m of managers) {
  if (m.status !== 'active') continue;  // only active managers
  const myTeamId = m.team_id;
  const myTeamMembers = (myTeamId && agentsByTeam[myTeamId]) ? agentsByTeam[myTeamId].map(a => a.id) : [];
  if (myTeamMembers.length === 0) continue;

  const myContacts = allContacts.filter(c => c.assigned_to === m.id);
  for (const c of myContacts) {
    const siblings = (byPhone[c.phone] || []).filter(s => s.id !== c.id);
    const teamSibling = siblings.find(s => myTeamMembers.includes(s.assigned_to));
    if (teamSibling) {
      phantoms.push({
        manager: m,
        manager_record: c,
        team_sibling: teamSibling,
      });
    }
  }
}

console.log(`📊 Found ${phantoms.length} phantom records\n`);

// Now check each: any deals/opps on the manager record?
console.log('🔍 Checking for deals/opportunities on phantom records...\n');
const ids = phantoms.map(p => p.manager_record.id);

let dealsByContact = {};
let oppsByContact = {};
let actsByContact = {};
let tasksByContact = {};

for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const [dRes, oRes, aRes, tRes] = await Promise.all([
    supabase.from('deals').select('id, contact_id, status, deal_number').in('contact_id', chunk),
    supabase.from('opportunities').select('id, contact_id, stage, opp_number').in('contact_id', chunk),
    supabase.from('activities').select('id, contact_id').in('contact_id', chunk),
    supabase.from('tasks').select('id, contact_id, status').in('contact_id', chunk),
  ]);
  for (const d of dRes.data || []) (dealsByContact[d.contact_id] = dealsByContact[d.contact_id] || []).push(d);
  for (const o of oRes.data || []) (oppsByContact[o.contact_id] = oppsByContact[o.contact_id] || []).push(o);
  for (const a of aRes.data || []) (actsByContact[a.contact_id] = actsByContact[a.contact_id] || []).push(a);
  for (const t of tRes.data || []) (tasksByContact[t.contact_id] = tasksByContact[t.contact_id] || []).push(t);
}

// Categorize
const safeToDelete = [];      // no deals, no open opps
const hasOpps = [];           // has opportunity (open or closed-won)
const hasDeals = [];          // has deal (any status)
const hasActivities = [];     // has activities (will need migration to sibling)

for (const p of phantoms) {
  const cid = p.manager_record.id;
  const deals = dealsByContact[cid] || [];
  const opps = oppsByContact[cid] || [];
  const acts = actsByContact[cid] || [];
  const tasks = tasksByContact[cid] || [];

  if (deals.length > 0) {
    hasDeals.push({ ...p, deals, opps, acts: acts.length, tasks: tasks.length });
  } else if (opps.length > 0) {
    hasOpps.push({ ...p, opps, acts: acts.length, tasks: tasks.length });
  } else {
    safeToDelete.push({ ...p, acts: acts.length, tasks: tasks.length });
    if (acts.length > 0 || tasks.length > 0) hasActivities.push({ ...p, acts: acts.length, tasks: tasks.length });
  }
}

console.log('=== CATEGORIZATION ===\n');
console.log(`🟢 Safe to delete (no deals/opps): ${safeToDelete.length}`);
console.log(`   ↳ With activities to migrate to sibling: ${hasActivities.length}`);
console.log(`🟡 Has open/closed opportunities (needs review): ${hasOpps.length}`);
console.log(`🔴 Has deals (DO NOT DELETE — commission risk): ${hasDeals.length}`);

if (hasDeals.length > 0) {
  console.log('\n=== Records WITH DEALS (will skip) ===');
  hasDeals.slice(0, 10).forEach(p => {
    console.log(`  - ${p.manager.full_name_en} | ${p.manager_record.full_name} | ${p.manager_record.phone}`);
    console.log(`    deals: ${p.deals.map(d => `${d.deal_number || d.id.slice(0,8)} (${d.status})`).join(', ')}`);
  });
}

if (hasOpps.length > 0) {
  console.log('\n=== Records WITH OPPORTUNITIES (will skip) ===');
  hasOpps.slice(0, 10).forEach(p => {
    console.log(`  - ${p.manager.full_name_en} | ${p.manager_record.full_name} | ${p.manager_record.phone}`);
    console.log(`    opps: ${p.opps.map(o => `${o.opp_number || o.id.slice(0,8)} (${o.stage})`).join(', ')}`);
  });
}

if (hasActivities.length > 0) {
  console.log('\n=== Records WITH ACTIVITIES/TASKS (will migrate to sibling before delete) ===');
  hasActivities.slice(0, 10).forEach(p => {
    console.log(`  - ${p.manager.full_name_en} | ${p.manager_record.full_name} | acts=${p.acts} tasks=${p.tasks}`);
  });
  if (hasActivities.length > 10) console.log(`  ... +${hasActivities.length - 10} more`);
}

// Save analysis
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const analysisFile = `scripts/backups/phantom-analysis-${ts}.json`;
fs.writeFileSync(analysisFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  totals: {
    phantoms: phantoms.length,
    safeToDelete: safeToDelete.length,
    withActivities: hasActivities.length,
    withOpps: hasOpps.length,
    withDeals: hasDeals.length,
  },
  safeToDelete,
  hasOpps,
  hasDeals,
}, null, 2));

console.log(`\n💾 Analysis saved: ${analysisFile}`);
console.log('\n✅ READ-ONLY ANALYSIS COMPLETE. NO WRITES PERFORMED.');
console.log('\nNext: review the categorization above. If happy, run phantom-execute.mjs');
