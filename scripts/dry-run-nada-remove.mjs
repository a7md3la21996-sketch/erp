import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';
const NADA_NAME = 'Nada Kafafy';

let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('contacts')
    .select('id, full_name, phone, assigned_to_names, assigned_to_name, assigned_to, agent_statuses, agent_temperatures, agent_scores, is_deleted')
    .range(from, from + 999);
  if (error) { console.log(error); break; }
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const active = all.filter(c => !c.is_deleted);

const isNada = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);

const shared = active.filter(c => {
  const arr = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : [];
  const hasNada = arr.some(isNada);
  const others = arr.filter(n => !isNada(n));
  return hasNada && others.length > 0;
});

// What columns are populated for shared?
let cnt_names = 0, cnt_name_singular = 0, cnt_assigned_to = 0, cnt_statuses = 0, cnt_temps = 0, cnt_scores = 0;
let primaryIsNada = 0;
const sampleBefore = [];

for (const c of shared) {
  if (Array.isArray(c.assigned_to_names) && c.assigned_to_names.some(isNada)) cnt_names++;
  if (isNada(c.assigned_to_name)) { cnt_name_singular++; primaryIsNada++; }
  if (Array.isArray(c.assigned_to) && c.assigned_to.includes(NADA_ID)) cnt_assigned_to++;
  if (c.agent_statuses && Object.keys(c.agent_statuses).some(isNada)) cnt_statuses++;
  if (c.agent_temperatures && Object.keys(c.agent_temperatures).some(isNada)) cnt_temps++;
  if (c.agent_scores && Object.keys(c.agent_scores).some(isNada)) cnt_scores++;
  if (sampleBefore.length < 5) sampleBefore.push(c);
}

console.log('=== SHARED contacts (Nada + others):', shared.length, '===');
console.log('  in assigned_to_names (jsonb array):', cnt_names);
console.log('  primary assigned_to_name = Nada:', cnt_name_singular);
console.log('  in assigned_to (uuid array):     ', cnt_assigned_to);
console.log('  in agent_statuses (jsonb keys):  ', cnt_statuses);
console.log('  in agent_temperatures:           ', cnt_temps);
console.log('  in agent_scores:                 ', cnt_scores);

console.log('\n=== Sample BEFORE (5 contacts) ===');
for (const c of sampleBefore) {
  console.log({
    id: c.id, name: c.full_name, phone: c.phone,
    assigned_to_names: c.assigned_to_names,
    assigned_to_name: c.assigned_to_name,
    assigned_to: c.assigned_to,
    agent_statuses: c.agent_statuses,
    agent_temperatures: c.agent_temperatures,
    agent_scores: c.agent_scores
  });
}
