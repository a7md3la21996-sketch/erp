import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

let all = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts')
    .select('id, full_name, phone, assigned_to_names, assigned_to_name, agent_statuses, agent_temperatures, agent_scores, is_deleted, updated_at')
    .range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const isNada = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);
const sharedNada = all.filter(c => !c.is_deleted && Array.isArray(c.assigned_to_names)
  && c.assigned_to_names.some(isNada)
  && c.assigned_to_names.filter(n => !isNada(n)).length > 0);
console.log(JSON.stringify(sharedNada, null, 2));
