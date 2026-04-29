import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

let all = [];
let from = 0;
while (true) {
  const { data } = await s.from('contacts').select('id, assigned_to_names, is_deleted').range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = all.filter(c => !c.is_deleted);
const dist = {};
for (const c of active) {
  const n = Array.isArray(c.assigned_to_names) ? c.assigned_to_names.length : 0;
  dist[n] = (dist[n] || 0) + 1;
}
console.log(`Total active: ${active.length}`);
console.log('Distribution:');
for (const [k, v] of Object.entries(dist).sort((a,b)=>+a[0]-+b[0])) console.log(`  ${k} assignees: ${v}`);
const multiLeft = active.filter(c => Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 1).length;
console.log(`\nMulti-contacts remaining: ${multiLeft}`);
