import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const FROM = 'Esraa Bakr';
const TO   = 'Nada Kafafy';
const isFrom = (n) => typeof n === 'string' && /\besraa\b/i.test(n) && /bakr/i.test(n);
const isTo   = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);

// Fetch all
let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('contacts')
    .select('id, full_name, phone, assigned_to_names, assigned_to_name, assigned_to, agent_statuses, agent_temperatures, agent_scores, is_deleted')
    .range(from, from + 999);
  if (error) { console.log(error); process.exit(1); }
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = all.filter(c => !c.is_deleted);

const target = active.filter(c =>
  Array.isArray(c.assigned_to_names) && c.assigned_to_names.some(isFrom)
);
const aloneList = [];
const sharedList = [];
for (const c of target) {
  const others = c.assigned_to_names.filter(n => !isFrom(n));
  if (others.length === 0) aloneList.push(c);
  else sharedList.push(c);
}
console.log(`Total Esraa contacts: ${target.length}`);
console.log(`  alone -> transfer to Nada: ${aloneList.length}`);
console.log(`  shared -> remove Esraa:    ${sharedList.length}`);

// Backup
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `scripts/backups/esraa-transfer-backup-${ts}.json`;
fs.writeFileSync(backupPath, JSON.stringify({ alone: aloneList, shared: sharedList }, null, 2));
console.log(`Backup: ${backupPath}\n`);

// Helper: rename key in jsonb obj (preserve value), don't overwrite if dest exists
const renameKey = (obj, fromMatch, toName) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  let fromVal;
  for (const [k, v] of Object.entries(obj)) {
    if (fromMatch(k)) fromVal = v;
    else out[k] = v;
  }
  if (fromVal !== undefined && out[toName] === undefined) out[toName] = fromVal;
  return out;
};
const stripKey = (obj, fromMatch) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (!fromMatch(k)) out[k] = v;
  return out;
};

// === SHARED: remove Esraa ===
const sharedUpdates = sharedList.map(c => {
  const newNames = c.assigned_to_names.filter(n => !isFrom(n));
  const newPrimary = isFrom(c.assigned_to_name) ? (newNames[0] || null) : c.assigned_to_name;
  return {
    id: c.id,
    assigned_to_names: newNames,
    assigned_to_name: newPrimary,
    agent_statuses: stripKey(c.agent_statuses, isFrom),
    agent_temperatures: stripKey(c.agent_temperatures, isFrom),
    agent_scores: stripKey(c.agent_scores, isFrom),
  };
});

// === ALONE: transfer Esraa -> Nada ===
const aloneUpdates = aloneList.map(c => {
  const newNames = c.assigned_to_names.map(n => isFrom(n) ? TO : n);
  const newPrimary = isFrom(c.assigned_to_name) ? TO : c.assigned_to_name;
  return {
    id: c.id,
    assigned_to_names: newNames,
    assigned_to_name: newPrimary,
    agent_statuses: renameKey(c.agent_statuses, isFrom, TO),
    agent_temperatures: renameKey(c.agent_temperatures, isFrom, TO),
    agent_scores: renameKey(c.agent_scores, isFrom, TO),
  };
});

const allUpdates = [...sharedUpdates, ...aloneUpdates];
console.log(`Total updates to apply: ${allUpdates.length}`);

const BATCH = 50;
let ok = 0, fail = 0;
const errors = [];
for (let i = 0; i < allUpdates.length; i += BATCH) {
  const slice = allUpdates.slice(i, i + BATCH);
  const results = await Promise.all(slice.map(async u => {
    const { id, ...patch } = u;
    const { error } = await supabase.from('contacts').update(patch).eq('id', id);
    return error ? { id, error: error.message } : { id, ok: true };
  }));
  for (const r of results) { if (r.ok) ok++; else { fail++; errors.push(r); } }
  console.log(`Progress: ${Math.min(i + BATCH, allUpdates.length)}/${allUpdates.length} | ok=${ok} fail=${fail}`);
}
console.log(`\n=== DONE === total=${allUpdates.length} ok=${ok} fail=${fail}`);
if (errors.length) {
  fs.writeFileSync(`scripts/backups/esraa-errors-${ts}.json`, JSON.stringify(errors, null, 2));
  console.log('Errors:', errors.slice(0, 5));
}
