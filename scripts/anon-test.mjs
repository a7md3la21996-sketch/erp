import { createClient } from '@supabase/supabase-js';
// anon key (what frontend uses for unauthenticated requests)
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTk5MjYsImV4cCI6MjA4OTkzNTkyNn0.pRiluwKMa34ggOT6NRJqZItY8c6DQkjGj0BCezzSzZA');

console.log('As anon (no auth):');
const t1 = Date.now();
const { count, error } = await s.from('contacts').select('id', { count: 'exact', head: true });
console.log(`  count=${count} | ${Date.now()-t1}ms | err: ${error?.message || 'none'} | code: ${error?.code}`);

const t2 = Date.now();
const { count: dq, error: e2 } = await s.from('contacts').select('id', { count: 'exact', head: true }).eq('contact_status', 'disqualified');
console.log(`  DQ count=${dq} | ${Date.now()-t2}ms | err: ${e2?.message || 'none'}`);
