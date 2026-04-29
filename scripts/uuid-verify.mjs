import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 Verification: UUID coverage AFTER backfill\n');

async function check(table, idCol, nameCols, where = null) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (where) q = where(q);
  const { count: total } = await q;

  let q2 = supabase.from(table).select('*', { count: 'exact', head: true }).is(idCol, null);
  if (where) q2 = where(q2);
  const { count: nullCount } = await q2;

  return { total, nullCount, filled: total - nullCount, coverage: ((1 - nullCount / total) * 100).toFixed(2) + '%' };
}

const r1 = await check('contacts', 'assigned_to', null, q => q.eq('is_deleted', false));
console.log(`contacts.assigned_to (active):  ${r1.filled}/${r1.total} = ${r1.coverage} | NULL: ${r1.nullCount}`);

const r2 = await check('contacts', 'created_by', null);
console.log(`contacts.created_by:            ${r2.filled}/${r2.total} = ${r2.coverage} | NULL: ${r2.nullCount}`);

const r3 = await check('activities', 'user_id');
console.log(`activities.user_id:             ${r3.filled}/${r3.total} = ${r3.coverage} | NULL: ${r3.nullCount}`);

const r4 = await check('tasks', 'assigned_to');
console.log(`tasks.assigned_to:              ${r4.filled}/${r4.total} = ${r4.coverage} | NULL: ${r4.nullCount}`);

const r5 = await check('opportunities', 'assigned_to');
console.log(`opportunities.assigned_to:      ${r5.filled}/${r5.total} = ${r5.coverage} | NULL: ${r5.nullCount}`);

const r6 = await check('deals', 'assigned_to');
console.log(`deals.assigned_to:              ${r6.filled}/${r6.total} = ${r6.coverage} | NULL: ${r6.nullCount}`);

// Sanity check: verify a sample
console.log('\n🔬 Sanity sample (5 contacts):');
const { data: sample } = await supabase.from('contacts')
  .select('id, full_name, assigned_to_name, assigned_to')
  .eq('is_deleted', false)
  .not('assigned_to_name', 'is', null)
  .limit(5);
for (const c of sample) {
  const { data: u } = await supabase.from('users').select('full_name_en').eq('id', c.assigned_to).single();
  const match = u?.full_name_en === c.assigned_to_name || u?.full_name_en;
  console.log(`  ${c.full_name?.slice(0, 20).padEnd(20)} | name="${c.assigned_to_name}" | UUID→user="${u?.full_name_en || '?'}" ${match ? '✅' : '⚠️'}`);
}

// Check NULL assigned_to remaining
console.log('\n👻 Active contacts WITHOUT assigned_to (UUID null):');
const { data: nullies } = await supabase.from('contacts')
  .select('id, full_name, phone, assigned_to_name, assigned_to_names')
  .eq('is_deleted', false)
  .is('assigned_to', null)
  .limit(20);
console.log(`  Count: ${nullies?.length || 0}`);
nullies?.forEach(c => console.log(`  - ${c.full_name} | name="${c.assigned_to_name||'—'}" | names=${JSON.stringify(c.assigned_to_names)}`));
