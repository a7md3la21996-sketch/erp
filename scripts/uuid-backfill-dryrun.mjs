import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { buildResolver } from './lib/nameResolver.mjs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 UUID Backfill DRY-RUN Starting (NO WRITES)...\n');

// Load all users
const { data: users } = await supabase.from('users').select('*');
const resolve = buildResolver(users);
console.log(`👤 Users loaded: ${users.length}`);

const stats = {
  contacts_assigned_to: { matched: 0, unmatched: 0, alreadySet: 0, noName: 0 },
  contacts_created_by: { matched: 0, unmatched: 0, alreadySet: 0, noName: 0 },
  activities_user_id: { matched: 0, unmatched: 0, alreadySet: 0, noName: 0 },
  tasks_assigned_to: { matched: 0, unmatched: 0, alreadySet: 0, noName: 0 },
  opportunities_assigned_to: { matched: 0, unmatched: 0, alreadySet: 0, noName: 0 },
  deals_assigned_to: { matched: 0, unmatched: 0, alreadySet: 0, noName: 0 },
};
const unmatchedNames = {};
const proposedUpdates = {
  contacts: [],
  activities: [],
  tasks: [],
  opportunities: [],
  deals: [],
};

function track(scope, name, hasId) {
  if (hasId) { stats[scope].alreadySet++; return null; }
  if (!name) { stats[scope].noName++; return null; }
  const r = resolve(name);
  if (!r) {
    stats[scope].unmatched++;
    unmatchedNames[name] = (unmatchedNames[name] || 0) + 1;
    return null;
  }
  stats[scope].matched++;
  return r;
}

async function fetchAll(table, columns) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) { console.log(`  ❌ ${table}: ${error.message}`); break; }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

// --- contacts (skip deleted per Ahmed's decision) ---
console.log('\n=== contacts ===');
const contacts = await fetchAll('contacts', 'id, assigned_to, assigned_to_name, created_by, created_by_name, is_deleted');
const activeContacts = contacts.filter(c => !c.is_deleted);
console.log(`  Active contacts: ${activeContacts.length} (deleted skipped: ${contacts.length - activeContacts.length})`);
for (const c of activeContacts) {
  const a = track('contacts_assigned_to', c.assigned_to_name, !!c.assigned_to);
  const cr = track('contacts_created_by', c.created_by_name, !!c.created_by);
  if (a || cr) {
    proposedUpdates.contacts.push({
      id: c.id,
      ...(a && { assigned_to: a.user_id, assigned_to_via: a.matched_via }),
      ...(cr && { created_by: cr.user_id, created_by_via: cr.matched_via }),
    });
  }
}
console.log('  contacts.assigned_to:', stats.contacts_assigned_to);
console.log('  contacts.created_by: ', stats.contacts_created_by);

// --- activities ---
console.log('\n=== activities ===');
const activities = await fetchAll('activities', 'id, user_id, user_name_en, user_name_ar');
console.log(`  Total: ${activities.length}`);
for (const a of activities) {
  const name = a.user_name_en || a.user_name_ar;
  const r = track('activities_user_id', name, !!a.user_id);
  if (r) {
    proposedUpdates.activities.push({ id: a.id, user_id: r.user_id, matched_via: r.matched_via });
  }
}
console.log('  activities.user_id:', stats.activities_user_id);

// --- tasks ---
console.log('\n=== tasks ===');
const tasks = await fetchAll('tasks', 'id, assigned_to, assigned_to_name_en, assigned_to_name_ar');
console.log(`  Total: ${tasks.length}`);
for (const t of tasks) {
  const name = t.assigned_to_name_en || t.assigned_to_name_ar;
  const r = track('tasks_assigned_to', name, !!t.assigned_to);
  if (r) {
    proposedUpdates.tasks.push({ id: t.id, assigned_to: r.user_id, matched_via: r.matched_via });
  }
}
console.log('  tasks.assigned_to:', stats.tasks_assigned_to);

// --- opportunities ---
console.log('\n=== opportunities ===');
const opps = await fetchAll('opportunities', 'id, assigned_to, assigned_to_name, agent_name');
console.log(`  Total: ${opps.length}`);
for (const o of opps) {
  const name = o.assigned_to_name || o.agent_name;
  const r = track('opportunities_assigned_to', name, !!o.assigned_to);
  if (r) {
    proposedUpdates.opportunities.push({ id: o.id, assigned_to: r.user_id, matched_via: r.matched_via });
  }
}
console.log('  opportunities.assigned_to:', stats.opportunities_assigned_to);

// --- deals ---
console.log('\n=== deals ===');
const deals = await fetchAll('deals', 'id, assigned_to, agent_en, agent_ar');
console.log(`  Total: ${deals.length}`);
for (const d of deals) {
  const name = d.agent_en || d.agent_ar;
  const r = track('deals_assigned_to', name, !!d.assigned_to);
  if (r) {
    proposedUpdates.deals.push({ id: d.id, assigned_to: r.user_id, matched_via: r.matched_via });
  }
}
console.log('  deals.assigned_to:', stats.deals_assigned_to);

// --- Unmatched names report ---
console.log('\n👻 Unmatched names (top 20):');
const sortedUnmatched = Object.entries(unmatchedNames).sort((a,b)=>b[1]-a[1]);
sortedUnmatched.slice(0, 20).forEach(([n, c]) => console.log(`  "${n}": ${c} occurrences`));
console.log(`  Total unique unmatched names: ${sortedUnmatched.length}`);

// --- Save report ---
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = `scripts/backups/uuid-backfill-dryrun-${ts}.json`;
fs.writeFileSync(reportFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  stats,
  unmatchedNames: sortedUnmatched,
  proposedUpdates: {
    contacts: proposedUpdates.contacts.length,
    activities: proposedUpdates.activities.length,
    tasks: proposedUpdates.tasks.length,
    opportunities: proposedUpdates.opportunities.length,
    deals: proposedUpdates.deals.length,
  },
}, null, 2));
const updatesFile = `scripts/backups/uuid-backfill-updates-${ts}.json`;
fs.writeFileSync(updatesFile, JSON.stringify(proposedUpdates, null, 2));

console.log(`\n💾 Summary: ${reportFile}`);
console.log(`💾 Proposed updates: ${updatesFile}`);
console.log(`\n📊 Total proposed UPDATEs:`);
console.log(`  contacts:      ${proposedUpdates.contacts.length}`);
console.log(`  activities:    ${proposedUpdates.activities.length}`);
console.log(`  tasks:         ${proposedUpdates.tasks.length}`);
console.log(`  opportunities: ${proposedUpdates.opportunities.length}`);
console.log(`  deals:         ${proposedUpdates.deals.length}`);
console.log(`\n✅ DRY-RUN COMPLETE. NO WRITES PERFORMED.`);
