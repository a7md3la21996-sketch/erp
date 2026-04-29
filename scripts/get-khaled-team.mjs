import { createClient } from '@supabase/supabase-js';
const s = createClient('https://mvdjynrjgsnjkytokbmo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4', { auth: { persistSession: false } });
const { data: k } = await s.from('users').select('id, full_name_en, role, team_id').eq('full_name_en', 'Khaled Abdelbaqy').single();
console.log('Khaled:', k);
const { data: teamMembers } = await s.from('users').select('id, full_name_en, role').eq('team_id', k.team_id);
console.log('Team members:', teamMembers);
