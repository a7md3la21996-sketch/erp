import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });

// 1. All distinct assigned_to UUIDs
const { data: contacts } = await s.from('contacts').select('assigned_to').eq('is_deleted', false).not('assigned_to', 'is', null);
const uniqueIds = [...new Set(contacts.map(c => c.assigned_to))];
console.log(`Unique assigned_to UUIDs in contacts: ${uniqueIds.length}`);

// 2. Check each exists in users
const { data: users } = await s.from('users').select('id');
const validIds = new Set(users.map(u => u.id));
const invalid = uniqueIds.filter(id => !validIds.has(id));
console.log(`Invalid (orphan) UUIDs: ${invalid.length}`);
if (invalid.length) console.log('  Sample:', invalid.slice(0, 5));

// 3. Test get_team_member_ids RPC
console.log('\nTesting get_team_member_ids RPC...');
try {
  const { data, error } = await s.rpc('get_team_member_ids');
  console.log('  result:', error ? `ERROR: ${error.message}` : `array of ${data?.length || 0} ids`);
} catch (e) { console.log('  exception:', e.message); }

// 4. Test get_team_member_names RPC
try {
  const { data, error } = await s.rpc('get_team_member_names');
  console.log('  get_team_member_names:', error ? `ERROR: ${error.message}` : `array of ${data?.length || 0} names`);
} catch (e) { console.log('  exception:', e.message); }
