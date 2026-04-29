import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dir = `scripts/backups/full-backup-${ts}`;
fs.mkdirSync(dir, { recursive: true });
console.log(`📦 Backup directory: ${dir}\n`);

async function dumpTable(table) {
  console.log(`Dumping ${table}...`);
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) { console.log(`  ❌ Error: ${error.message}`); return null; }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const file = path.join(dir, `${table}.json`);
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
  const size = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`  ✅ ${all.length} rows | ${size} MB → ${file}`);
  return all.length;
}

const tables = ['users', 'contacts', 'activities', 'tasks', 'opportunities', 'deals', 'notes', 'comments', 'audit_logs', 'stage_history'];
const counts = {};
for (const t of tables) counts[t] = await dumpTable(t);

const summary = {
  timestamp: new Date().toISOString(),
  directory: dir,
  rowCounts: counts,
  totalRows: Object.values(counts).filter(Boolean).reduce((a, b) => a + b, 0),
};
fs.writeFileSync(path.join(dir, '_summary.json'), JSON.stringify(summary, null, 2));
console.log(`\n✅ Backup complete: ${summary.totalRows} total rows`);
console.log(`📂 ${dir}`);
