import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/nada-restore-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });
console.log(`🚀 Nada Restore by Original Worker\n💾 Backup dir: ${backupDir}\n`);

async function withRetry(fn, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < attempts - 1) await new Promise(r => setTimeout(r, 200 * 2**i)); }
  }
  throw last;
}

// Load users
const { data: users } = await supabase.from('users').select('id, full_name_en, full_name_ar, role, status');
const userById = Object.fromEntries(users.map(u => [u.id, u]));

// Load Nada records
let nada = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').eq('is_deleted', false).eq('assigned_to', NADA_ID).range(from, from + 999);
  if (!data?.length) break;
  nada = nada.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Nada records: ${nada.length}`);
fs.writeFileSync(`${backupDir}/nada-records-before.json`, JSON.stringify(nada, null, 2));

// Fetch activities to determine top contributor per record
console.log('Fetching activities...');
const ids = nada.map(n => n.id);
const actsByContact = {};
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { data } = await supabase.from('activities').select('contact_id, user_id').in('contact_id', chunk);
  for (const a of data || []) {
    if (!actsByContact[a.contact_id]) actsByContact[a.contact_id] = {};
    const uid = a.user_id;
    if (!uid) continue;
    actsByContact[a.contact_id][uid] = (actsByContact[a.contact_id][uid] || 0) + 1;
  }
}

// Determine restore plan
const updates = [];
const stayWithNada = [];
const errors = [];

for (const c of nada) {
  const acts = actsByContact[c.id] || {};
  // Top non-Nada contributor
  const sorted = Object.entries(acts)
    .filter(([uid]) => uid !== NADA_ID)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    stayWithNada.push({ id: c.id, full_name: c.full_name, reason: 'no-activity-or-only-nada' });
    continue;
  }

  const [topUid] = sorted[0];
  const u = userById[topUid];
  if (!u) {
    stayWithNada.push({ id: c.id, full_name: c.full_name, reason: `user-not-found:${topUid}` });
    continue;
  }

  const newName = u.full_name_en || u.full_name_ar;
  if (!newName) {
    stayWithNada.push({ id: c.id, full_name: c.full_name, reason: 'no-canonical-name' });
    continue;
  }

  updates.push({
    id: c.id,
    full_name: c.full_name,
    new_owner_id: u.id,
    new_owner_name: newName,
    new_owner_status: u.status,  // for reference
    contact_status: c.contact_status,  // preserved
  });
}

console.log(`\n📋 Plan:`);
console.log(`  Restore: ${updates.length}`);
console.log(`  Stay with Nada: ${stayWithNada.length}`);

// Group by new owner for visibility
const perOwner = {};
for (const u of updates) {
  const k = `${u.new_owner_name} (${u.new_owner_status})`;
  perOwner[k] = (perOwner[k] || 0) + 1;
}
console.log('\nRecipients (top 20):');
const sortedOwners = Object.entries(perOwner).sort((a, b) => b[1] - a[1]);
sortedOwners.slice(0, 20).forEach(([n, c]) => console.log(`  ${n.padEnd(40)} ${c}`));
if (sortedOwners.length > 20) console.log(`  ... +${sortedOwners.length - 20} more`);

// Save plan
fs.writeFileSync(`${backupDir}/restore-plan.json`, JSON.stringify({ updates, stayWithNada, perOwner }, null, 2));
console.log(`\n💾 Plan saved\n`);

// Execute updates
console.log('🚀 Applying updates...');
let ok = 0, fail = 0;
const BATCH = 8;
for (let i = 0; i < updates.length; i += BATCH) {
  const slice = updates.slice(i, i + BATCH);
  await Promise.all(slice.map(async u => {
    try {
      // Single-assignment write — keep agent_statuses as a single key for backward compat reads.
      const newAgentStatuses = u.contact_status ? { [u.new_owner_name]: u.contact_status } : null;
      await withRetry(async () => {
        const { error } = await supabase.from('contacts').update({
          assigned_to: u.new_owner_id,
          assigned_to_name: u.new_owner_name,
          assigned_to_names: [u.new_owner_name],
          ...(newAgentStatuses ? { agent_statuses: newAgentStatuses } : {}),
        }).eq('id', u.id);
        if (error) throw error;
      });
      ok++;
    } catch (err) {
      fail++;
      errors.push({ id: u.id, name: u.full_name, error: err.message });
    }
  }));
  process.stdout.write(`\r  ${Math.min(i + BATCH, updates.length)}/${updates.length} | ok=${ok} fail=${fail}    `);
}
console.log('\n');

if (errors.length) fs.writeFileSync(`${backupDir}/errors.json`, JSON.stringify(errors, null, 2));

console.log('=== DONE ===');
console.log(`Restored: ${ok} / ${updates.length}`);
console.log(`Failed: ${fail}`);
console.log(`Stayed with Nada: ${stayWithNada.length}`);
console.log(`\n💾 ${backupDir}`);
