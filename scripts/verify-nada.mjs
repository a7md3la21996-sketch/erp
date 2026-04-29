import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('contacts')
    .select('id, full_name, assigned_to_names, assigned_to_name, agent_statuses, agent_temperatures, agent_scores, is_deleted')
    .range(from, from + 999);
  if (error) { console.log(error); break; }
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = all.filter(c => !c.is_deleted);
const isNada = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);

let alone = 0, shared = 0, ghostStatus = 0, ghostTemp = 0, ghostScore = 0, ghostPrimary = 0;
for (const c of active) {
  const arr = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : [];
  const hasNada = arr.some(isNada);
  if (hasNada) {
    const others = arr.filter(n => !isNada(n));
    if (others.length === 0) alone++;
    else shared++;
  }
  if (isNada(c.assigned_to_name) && !hasNada) ghostPrimary++;
  if (c.agent_statuses && Object.keys(c.agent_statuses).some(isNada) && !hasNada) ghostStatus++;
  if (c.agent_temperatures && Object.keys(c.agent_temperatures).some(isNada) && !hasNada) ghostTemp++;
  if (c.agent_scores && Object.keys(c.agent_scores).some(isNada) && !hasNada) ghostScore++;
}

console.log('=== AFTER ===');
console.log('Nada alone:', alone);
console.log('Nada shared:', shared, '(should be 0)');
console.log('Ghost primary (name set but not in array):', ghostPrimary);
console.log('Ghost status key:', ghostStatus);
console.log('Ghost temp key:', ghostTemp);
console.log('Ghost score key:', ghostScore);
