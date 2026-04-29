import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

// Get policies via the REST API
const { data, error } = await s.rpc('exec_sql', { query: "SELECT policyname, cmd FROM pg_policies WHERE tablename='contacts'" }).catch(() => ({ data: null, error: { message: 'no exec_sql function' } }));

if (error) {
  console.log('No exec_sql, trying direct policies query...');
  // Test specific scenarios
  // 1. Try a fresh count query (head)
  const tests = [
    { name: 'simple head count', q: () => s.from('contacts').select('id', { count: 'exact', head: true }).limit(1) },
    { name: 'select=id no filter', q: () => s.from('contacts').select('id').limit(1) },
    { name: 'select id with eq', q: () => s.from('contacts').select('id').eq('contact_status', 'disqualified').limit(1) },
    { name: 'count with eq', q: () => s.from('contacts').select('id', { count: 'exact', head: true }).eq('contact_status', 'disqualified') },
  ];
  for (const t of tests) {
    const start = Date.now();
    const res = await t.q();
    console.log(`  ${t.name}: ${Date.now()-start}ms | err: ${res.error?.message || 'none'} | count: ${res.count ?? '?'}`);
  }
}
