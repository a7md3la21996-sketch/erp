import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

console.log('Testing simple queries...');
const t1 = Date.now();
const { count, error } = await s.from('contacts').select('id', { count: 'exact', head: true });
console.log(`Total contacts (service role): ${count} | ${Date.now()-t1}ms | err: ${error?.message || 'none'}`);

const t2 = Date.now();
const { count: dq, error: e2 } = await s.from('contacts').select('id', { count: 'exact', head: true }).eq('contact_status', 'disqualified');
console.log(`Disqualified: ${dq} | ${Date.now()-t2}ms | err: ${e2?.message || 'none'}`);

const t3 = Date.now();
const { count: ld, error: e3 } = await s.from('contacts').select('id', { count: 'exact', head: true }).eq('contact_type', 'lead');
console.log(`Leads: ${ld} | ${Date.now()-t3}ms | err: ${e3?.message || 'none'}`);

// Try with is_deleted (matches likely default)
const t4 = Date.now();
const { count: act, error: e4 } = await s.from('contacts').select('id', { count: 'exact', head: true }).eq('is_deleted', false);
console.log(`Active: ${act} | ${Date.now()-t4}ms | err: ${e4?.message || 'none'}`);
