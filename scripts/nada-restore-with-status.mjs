import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';

console.log('🔍 Nada — restore with original worker\'s status\n');

const { data: users } = await supabase.from('users').select('id, full_name_en, full_name_ar, role, status');
const userById = Object.fromEntries(users.map(u => [u.id, u]));

let nada = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, full_name, phone, contact_status').eq('is_deleted', false).eq('assigned_to', NADA_ID).range(from, from + 999);
  if (!data?.length) break;
  nada = nada.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Nada records: ${nada.length}\n`);

// Fetch activities per record (full details for status parsing)
const ids = nada.map(n => n.id);
const actsByContact = {};
console.log('Fetching activities (with description)...');
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { data } = await supabase.from('activities').select('id, contact_id, user_id, type, description, result, created_at').in('contact_id', chunk).order('created_at', { ascending: false });
  for (const a of data || []) {
    (actsByContact[a.contact_id] = actsByContact[a.contact_id] || []).push(a);
  }
}

// Status keywords (en + ar)
const statusMap = {
  'new': 'new',
  'contacted': 'contacted',
  'following': 'following',
  'follow': 'following',
  'has opportunity': 'has_opportunity',
  'has_opportunity': 'has_opportunity',
  'opportunity': 'has_opportunity',
  'disqualified': 'disqualified',
  'inactive': 'inactive',
  'مؤهل': 'has_opportunity',
  'متابعة': 'following',
  'تم التواصل': 'contacted',
  'جديد': 'new',
  'مرفوض': 'disqualified',
  'غير مؤهل': 'disqualified',
  'لديه فرصة': 'has_opportunity',
};

function parseStatusFromDescription(desc) {
  if (!desc) return null;
  // Format: "Old → New" or "Old → New (reason)"
  const arrow = desc.match(/(?:→|->|=>)\s*([^()]+?)(?:\s*\(|$)/);
  if (arrow) {
    const after = arrow[1].trim().toLowerCase();
    for (const [keyword, status] of Object.entries(statusMap)) {
      if (after.includes(keyword.toLowerCase())) return status;
    }
  }
  return null;
}

function inferStatusFromActivity(act) {
  // No status_change found — infer from activity type/result
  const t = act.type;
  const r = act.result;
  if (r === 'no_answer' || r === 'busy' || r === 'switched_off' || r === 'wrong_number') return 'contacted';
  if (r === 'answered') return 'following';
  if (r === 'not_interested') return 'disqualified';
  if (t === 'call' || t === 'whatsapp' || t === 'meeting') return 'contacted';
  return null;
}

const plan = {};  // userId → array of {record, status}
const noActivityRecords = [];
const onlyNadaActsRecords = [];

for (const n of nada) {
  const acts = actsByContact[n.id] || [];
  if (acts.length === 0) { noActivityRecords.push(n); continue; }

  // Top contributor (excluding Nada herself)
  const counts = {};
  for (const a of acts) if (a.user_id && a.user_id !== NADA_ID) counts[a.user_id] = (counts[a.user_id] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) { onlyNadaActsRecords.push(n); continue; }
  const [topUid] = sorted[0];

  // Find most recent status_change by top contributor
  const ownerActs = acts.filter(a => a.user_id === topUid);
  let restoredStatus = null;

  // Check status_change activities first
  const statusChange = ownerActs.find(a => a.type === 'status_change');
  if (statusChange) restoredStatus = parseStatusFromDescription(statusChange.description);

  // Fallback: infer from latest activity
  if (!restoredStatus) {
    const latestAct = ownerActs[0];  // sorted desc
    restoredStatus = inferStatusFromActivity(latestAct);
  }

  // Final fallback: keep current status
  if (!restoredStatus) restoredStatus = n.contact_status || 'new';

  if (!plan[topUid]) plan[topUid] = [];
  plan[topUid].push({ record_id: n.id, full_name: n.full_name, current_status: n.contact_status, new_status: restoredStatus });
}

// Summary per user
console.log('=== RESTORE PLAN ===\n');
const sortedPlan = Object.entries(plan).sort((a, b) => b[1].length - a[1].length);
console.log('Owner'.padEnd(28) + 'Role'.padEnd(15) + 'Active'.padEnd(8) + 'Records'.padEnd(10) + 'Status breakdown');
for (const [uid, recs] of sortedPlan) {
  const u = userById[uid];
  if (!u) continue;
  const stats = {};
  for (const r of recs) stats[r.new_status] = (stats[r.new_status] || 0) + 1;
  const statsStr = Object.entries(stats).sort((a,b)=>b[1]-a[1]).map(([s, c]) => `${s}=${c}`).join(', ');
  console.log((u.full_name_en || '—').padEnd(28) + u.role.padEnd(15) + (u.status === 'active' ? '✅'.padEnd(8) : '💀'.padEnd(8)) + String(recs.length).padEnd(10) + statsStr);
}

console.log(`\nNo activity records (stay at Nada): ${noActivityRecords.length}`);
console.log(`Only Nada activities (stay at Nada): ${onlyNadaActsRecords.length}`);

// Status change distribution
console.log('\n=== STATUS CHANGE STATS ===');
let unchanged = 0, changed = 0;
for (const recs of Object.values(plan)) {
  for (const r of recs) {
    if (r.current_status === r.new_status) unchanged++;
    else changed++;
  }
}
console.log(`Status will change: ${changed}`);
console.log(`Status stays same: ${unchanged}`);

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = `scripts/backups/nada-restore-plan-${ts}.json`;
fs.writeFileSync(reportFile, JSON.stringify({
  totalNada: nada.length,
  totalToRestore: Object.values(plan).reduce((s, r) => s + r.length, 0),
  stayAtNada: noActivityRecords.length + onlyNadaActsRecords.length,
  perUserPlan: Object.fromEntries(sortedPlan.map(([uid, recs]) => [
    userById[uid]?.full_name_en || uid,
    {
      role: userById[uid]?.role,
      status: userById[uid]?.status,
      count: recs.length,
      statusBreakdown: recs.reduce((m, r) => { m[r.new_status] = (m[r.new_status] || 0) + 1; return m; }, {}),
    }
  ])),
  changedCount: changed,
  unchangedCount: unchanged,
}, null, 2));
console.log(`\n💾 ${reportFile}`);
