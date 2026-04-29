import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

// Sample status_change activities
const { data: sample } = await s.from('activities').select('type, description, result, user_name_en').eq('type', 'status_change').limit(20);
console.log(`Sample status_change activities:`);
sample?.forEach(a => console.log(`  by ${a.user_name_en}: "${a.description?.slice(0, 100)}"`));

// Count types
const { count: scCount } = await s.from('activities').select('*', { count: 'exact', head: true }).eq('type', 'status_change');
console.log(`\nTotal status_change activities: ${scCount}`);

// On Nada records specifically
const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';
const { data: nadaContacts } = await s.from('contacts').select('id').eq('assigned_to', NADA_ID).eq('is_deleted', false).limit(1000);
const ids = nadaContacts.map(c => c.id);
let count = 0;
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { count: c } = await s.from('activities').select('*', { count: 'exact', head: true }).in('contact_id', chunk).eq('type', 'status_change');
  count += c || 0;
}
console.log(`status_change on Nada records (sampled 1000): ${count}`);
