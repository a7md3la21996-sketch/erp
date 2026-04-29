import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 Checking UUID vs name coverage across all tables...\n');

// Sample one row to see all columns first
async function inspectSchema(table) {
  const { data } = await supabase.from(table).select('*').limit(1);
  if (data?.[0]) {
    const cols = Object.keys(data[0]);
    return cols;
  }
  return [];
}

// Check for NULL user_id but populated name
async function checkTable(table, idCol, nameCols) {
  const { count: total } = await supabase.from(table).select('*', { count: 'exact', head: true });
  const { count: nullId } = await supabase.from(table).select('*', { count: 'exact', head: true }).is(idCol, null);

  // Count rows where id is null but at least one name is set
  let allRows = [];
  let from = 0;
  while (true) {
    const sel = [idCol, ...nameCols].join(', ');
    const { data } = await supabase.from(table).select(sel).range(from, from + 999);
    if (!data?.length) break;
    allRows = allRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  let nullIdWithName = 0, hasIdNoName = 0, hasBoth = 0, hasNeither = 0;
  for (const r of allRows) {
    const hasId = !!r[idCol];
    const hasName = nameCols.some(c => r[c]);
    if (!hasId && hasName) nullIdWithName++;
    else if (hasId && !hasName) hasIdNoName++;
    else if (hasId && hasName) hasBoth++;
    else hasNeither++;
  }
  return { table, total, nullId, nullIdWithName, hasIdNoName, hasBoth, hasNeither };
}

console.log('=== contacts (assignment fields) ===');
const contactsCols = await inspectSchema('contacts');
console.log('Has assigned_to column:', contactsCols.includes('assigned_to'));
console.log('Has assigned_to_name column:', contactsCols.includes('assigned_to_name'));
console.log('Has assigned_to_names column:', contactsCols.includes('assigned_to_names'));
console.log('Has created_by column:', contactsCols.includes('created_by'));

const r1 = await checkTable('contacts', 'created_by', ['created_by_name']);
console.log('\ncontacts.created_by:');
console.log(`  Total: ${r1.total} | Null ID: ${r1.nullId} | Null ID + has name: ${r1.nullIdWithName}`);
console.log(`  Has both: ${r1.hasBoth} | Only ID: ${r1.hasIdNoName} | Neither: ${r1.hasNeither}`);

const r2 = await checkTable('activities', 'user_id', ['user_name_en', 'user_name_ar']);
console.log('\nactivities.user_id:');
console.log(`  Total: ${r2.total} | Null ID: ${r2.nullId} | Null ID + has name: ${r2.nullIdWithName}`);
console.log(`  Has both: ${r2.hasBoth} | Only ID: ${r2.hasIdNoName} | Neither: ${r2.hasNeither}`);

const r3 = await checkTable('tasks', 'assigned_to', ['assigned_to_name_en', 'assigned_to_name_ar']);
console.log('\ntasks.assigned_to:');
console.log(`  Total: ${r3.total} | Null ID: ${r3.nullId} | Null ID + has name: ${r3.nullIdWithName}`);
console.log(`  Has both: ${r3.hasBoth} | Only ID: ${r3.hasIdNoName} | Neither: ${r3.hasNeither}`);

const r4 = await checkTable('opportunities', 'assigned_to', ['assigned_to_name', 'agent_name']);
console.log('\nopportunities.assigned_to:');
console.log(`  Total: ${r4.total} | Null ID: ${r4.nullId} | Null ID + has name: ${r4.nullIdWithName}`);
console.log(`  Has both: ${r4.hasBoth} | Only ID: ${r4.hasIdNoName} | Neither: ${r4.hasNeither}`);

const r5 = await checkTable('deals', 'assigned_to', ['agent_en', 'agent_ar']);
console.log('\ndeals.assigned_to:');
console.log(`  Total: ${r5.total} | Null ID: ${r5.nullId} | Null ID + has name: ${r5.nullIdWithName}`);
console.log(`  Has both: ${r5.hasBoth} | Only ID: ${r5.hasIdNoName} | Neither: ${r5.hasNeither}`);

// Now check: of contacts, how many have null assigned_to (uuid) but populated assigned_to_name?
console.log('\n=== contacts.assigned_to (uuid) coverage ===');
const r6 = await checkTable('contacts', 'assigned_to', ['assigned_to_name']);
console.log(`Total: ${r6.total} | Null assigned_to: ${r6.nullId} | Null + has name: ${r6.nullIdWithName}`);
console.log(`Has both: ${r6.hasBoth} | Only UUID: ${r6.hasIdNoName} | Neither: ${r6.hasNeither}`);
