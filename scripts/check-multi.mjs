import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

let all = [];
let from = 0;
while (true) {
  const { data } = await s.from('contacts').select('id, full_name, phone, assigned_to_name, assigned_to_names, assigned_to').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const dist = {};
const multi = [];
for (const c of all) {
  const n = Array.isArray(c.assigned_to_names) ? c.assigned_to_names.length : 0;
  dist[n] = (dist[n] || 0) + 1;
  if (n > 1) multi.push(c);
}
console.log(`Total active: ${all.length}`);
console.log('Distribution:');
for (const [k, v] of Object.entries(dist).sort((a,b)=>+a[0]-+b[0])) console.log(`  ${k} assignees: ${v}`);

if (multi.length > 0) {
  console.log(`\n⚠️ Multi-assignment records (post-Phase 1): ${multi.length}`);
  multi.slice(0, 10).forEach(c => console.log(`  ${c.full_name} | ${c.phone} | names=${JSON.stringify(c.assigned_to_names)} | primary=${c.assigned_to_name}`));
}

// Check if any have null assigned_to (orphans?)
const noOwner = all.filter(c => !c.assigned_to);
console.log(`\nWithout assigned_to UUID: ${noOwner.length}`);
