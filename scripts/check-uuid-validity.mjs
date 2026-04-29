import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

let all = [];
let from = 0;
while (true) {
  const { data } = await s.from('contacts').select('id, assigned_to, is_deleted').range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Total: ${all.length}`);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let nullCount = 0, emptyCount = 0, invalidCount = 0, validCount = 0;
const invalidSamples = [];
for (const c of all) {
  if (c.assigned_to === null || c.assigned_to === undefined) nullCount++;
  else if (c.assigned_to === '') emptyCount++;
  else if (!uuidPattern.test(c.assigned_to)) {
    invalidCount++;
    if (invalidSamples.length < 5) invalidSamples.push({ id: c.id, value: c.assigned_to });
  }
  else validCount++;
}
console.log(`Valid UUIDs: ${validCount}`);
console.log(`NULL: ${nullCount}`);
console.log(`Empty string: ${emptyCount}`);
console.log(`Invalid format: ${invalidCount}`);
if (invalidSamples.length) console.log('Samples:', invalidSamples);
