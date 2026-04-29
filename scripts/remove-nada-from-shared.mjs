import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const isNada = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);

// 1) Fetch all
let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('contacts')
    .select('id, full_name, phone, assigned_to_names, assigned_to_name, assigned_to, agent_statuses, agent_temperatures, agent_scores, is_deleted')
    .range(from, from + 999);
  if (error) { console.log('fetch err:', error); process.exit(1); }
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = all.filter(c => !c.is_deleted);

// 2) Find shared
const shared = active.filter(c => {
  const arr = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : [];
  const hasNada = arr.some(isNada);
  const others = arr.filter(n => !isNada(n));
  return hasNada && others.length > 0;
});
console.log(`Total shared (Nada + others): ${shared.length}`);

// 3) Backup
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `scripts/backups/nada-removal-backup-${ts}.json`;
fs.writeFileSync(backupPath, JSON.stringify(shared, null, 2));
console.log(`Backup saved: ${backupPath}`);

// 4) Build updates
const updates = shared.map(c => {
  const arr = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : [];
  const newNames = arr.filter(n => !isNada(n));
  const newPrimary = isNada(c.assigned_to_name) ? (newNames[0] || null) : c.assigned_to_name;
  const stripObj = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (!isNada(k)) out[k] = v;
    return out;
  };
  return {
    id: c.id,
    assigned_to_names: newNames,
    assigned_to_name: newPrimary,
    agent_statuses: stripObj(c.agent_statuses),
    agent_temperatures: stripObj(c.agent_temperatures),
    agent_scores: stripObj(c.agent_scores),
  };
});

// 5) Apply in batches
const BATCH = 50;
let ok = 0, fail = 0;
const errors = [];
for (let i = 0; i < updates.length; i += BATCH) {
  const slice = updates.slice(i, i + BATCH);
  const results = await Promise.all(slice.map(async u => {
    const { id, ...patch } = u;
    const { error } = await supabase.from('contacts').update(patch).eq('id', id);
    if (error) return { id, error: error.message };
    return { id, ok: true };
  }));
  for (const r of results) {
    if (r.ok) ok++;
    else { fail++; errors.push(r); }
  }
  console.log(`Progress: ${Math.min(i + BATCH, updates.length)}/${updates.length} | ok=${ok} fail=${fail}`);
}

console.log(`\n=== DONE ===`);
console.log(`Total: ${updates.length} | success: ${ok} | failed: ${fail}`);
if (errors.length) {
  fs.writeFileSync(`scripts/backups/nada-removal-errors-${ts}.json`, JSON.stringify(errors, null, 2));
  console.log(`Errors saved: scripts/backups/nada-removal-errors-${ts}.json`);
  console.log('First 5 errors:', errors.slice(0, 5));
}
