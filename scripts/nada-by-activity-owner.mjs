import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';

console.log('🔍 Nada records — distribution by activity owner\n');

// All users
const { data: users } = await supabase.from('users').select('id, full_name_en, full_name_ar, role, status');
const userById = Object.fromEntries(users.map(u => [u.id, u]));

// Nada records (active, exclusive — but include all 4,366 for clarity)
let nada = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, full_name, contact_status, source').eq('is_deleted', false).eq('assigned_to', NADA_ID).range(from, from + 999);
  if (!data?.length) break;
  nada = nada.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Nada records: ${nada.length}\n`);

// Fetch all activities per Nada record
const ids = nada.map(n => n.id);
const actsByContact = {};  // contactId → {userId: count}
console.log('Fetching activities...');
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { data } = await supabase.from('activities').select('contact_id, user_id, user_name_en').in('contact_id', chunk);
  for (const a of data || []) {
    if (!actsByContact[a.contact_id]) actsByContact[a.contact_id] = {};
    const uid = a.user_id || `name:${a.user_name_en || 'unknown'}`;
    actsByContact[a.contact_id][uid] = (actsByContact[a.contact_id][uid] || 0) + 1;
  }
}

// For each Nada record, determine top contributor
const distributionPlan = {};  // ownerId → array of records
const flagged = {
  noActivity: [],
  topContributorIsNada: [],   // Nada herself was top? Then it's a real Nada lead
  topContributorInactive: [],  // top is inactive → needs fallback
  topContributorActive: [],    // top is active → assign to them
  unknownUser: [],             // no user_id, only name
};

for (const n of nada) {
  const acts = actsByContact[n.id] || {};
  const sorted = Object.entries(acts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    flagged.noActivity.push(n);
    continue;
  }
  const [topUid, topCount] = sorted[0];

  // Skip Nada herself
  if (topUid === NADA_ID) {
    // Find next non-Nada
    const next = sorted.find(([uid]) => uid !== NADA_ID);
    if (!next) {
      // Only Nada activities (shouldn't happen but)
      flagged.topContributorIsNada.push({ ...n, count: topCount });
      continue;
    }
    const [nextUid, nextCount] = next;
    if (nextUid.startsWith('name:')) { flagged.unknownUser.push({ ...n, name: nextUid.slice(5), count: nextCount }); continue; }
    const u = userById[nextUid];
    if (!u) { flagged.unknownUser.push({ ...n, uid: nextUid, count: nextCount }); continue; }
    if (u.status === 'active') {
      if (!distributionPlan[u.id]) distributionPlan[u.id] = [];
      distributionPlan[u.id].push({ ...n, count: nextCount, allActs: sorted });
      flagged.topContributorActive.push({ ...n, owner: u, count: nextCount });
    } else {
      flagged.topContributorInactive.push({ ...n, owner: u, count: nextCount });
    }
    continue;
  }

  // Top is name-based (no user_id)
  if (topUid.startsWith('name:')) {
    flagged.unknownUser.push({ ...n, name: topUid.slice(5), count: topCount });
    continue;
  }

  const u = userById[topUid];
  if (!u) { flagged.unknownUser.push({ ...n, uid: topUid, count: topCount }); continue; }

  if (u.status === 'active') {
    if (!distributionPlan[u.id]) distributionPlan[u.id] = [];
    distributionPlan[u.id].push({ ...n, count: topCount, allActs: sorted });
    flagged.topContributorActive.push({ ...n, owner: u, count: topCount });
  } else {
    flagged.topContributorInactive.push({ ...n, owner: u, count: topCount });
  }
}

console.log('=== CATEGORIZATION ===\n');
console.log(`📭 No activities at all: ${flagged.noActivity.length}`);
console.log(`👻 Only Nada activities (admin actions): ${flagged.topContributorIsNada.length}`);
console.log(`✅ Top contributor is ACTIVE — auto-assign: ${flagged.topContributorActive.length}`);
console.log(`💀 Top contributor INACTIVE (left company): ${flagged.topContributorInactive.length}`);
console.log(`❓ Unknown user (no user_id): ${flagged.unknownUser.length}`);

console.log('\n=== AUTO-ASSIGN PLAN (active recipients) ===\n');
const sortedPlan = Object.entries(distributionPlan).sort((a, b) => b[1].length - a[1].length);
for (const [uid, records] of sortedPlan) {
  const u = userById[uid];
  console.log(`  ${(u.full_name_en || '—').padEnd(25)} ${u.role.padEnd(15)} → ${records.length} records`);
}

console.log('\n=== INACTIVE TOP CONTRIBUTORS (need fallback) ===\n');
const inactiveBy = {};
for (const f of flagged.topContributorInactive) {
  const key = f.owner.full_name_en || '?';
  inactiveBy[key] = (inactiveBy[key] || 0) + 1;
}
for (const [name, count] of Object.entries(inactiveBy).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(25)} → ${count} records`);
}

console.log('\n=== UNKNOWN USERS ===');
const unknownBy = {};
for (const f of flagged.unknownUser) {
  const key = f.name || `id:${f.uid?.slice(0,8) || '?'}`;
  unknownBy[key] = (unknownBy[key] || 0) + 1;
}
for (const [name, count] of Object.entries(unknownBy).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${name.padEnd(30)} ${count}`);
}
if (Object.keys(unknownBy).length > 10) console.log(`  ... +${Object.keys(unknownBy).length - 10} more`);

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = `scripts/backups/nada-by-activity-${ts}.json`;
fs.writeFileSync(reportFile, JSON.stringify({
  totals: {
    nada: nada.length,
    noActivity: flagged.noActivity.length,
    onlyNada: flagged.topContributorIsNada.length,
    activeContributor: flagged.topContributorActive.length,
    inactiveContributor: flagged.topContributorInactive.length,
    unknownUser: flagged.unknownUser.length,
  },
  autoAssignPlan: Object.fromEntries(sortedPlan.map(([uid, recs]) => [
    userById[uid]?.full_name_en || uid,
    recs.length
  ])),
  inactiveBreakdown: inactiveBy,
  unknownBreakdown: unknownBy,
}, null, 2));
console.log(`\n💾 ${reportFile}`);
