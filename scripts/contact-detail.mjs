import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const cid = '5b255389-7d8b-4d78-a1c1-3ad5fb2f0ab3';

const { data: acts } = await supabase.from('activities')
  .select('id, type, user_name_en, dept, status, created_at, notes, result')
  .eq('contact_id', cid).order('created_at');
console.log('=== Activities (', acts?.length, ') ===');
acts?.forEach(a => console.log(`  ${a.created_at?.slice(0,10)} | ${a.type} | by: ${a.user_name_en} (${a.dept}) | status=${a.status} | ${(a.notes||'').slice(0,60)}`));

const { data: tasks } = await supabase.from('tasks')
  .select('id, title, status, assigned_to_name_en, created_at')
  .eq('contact_id', cid).order('created_at');
console.log('\n=== Tasks (', tasks?.length, ') ===');
tasks?.forEach(t => console.log(`  ${t.created_at?.slice(0,10)} | ${t.title} | assigned: ${t.assigned_to_name_en} | status=${t.status}`));

const { data: opps } = await supabase.from('opportunities')
  .select('id, opp_number, assigned_to_name, agent_name, stage, created_by_name, created_at, deal_value')
  .eq('contact_id', cid).order('created_at');
console.log('\n=== Opportunities (', opps?.length, ') ===');
opps?.forEach(o => console.log(`  ${o.created_at?.slice(0,10)} | ${o.opp_number} | agent: ${o.agent_name} / assigned: ${o.assigned_to_name} | created_by: ${o.created_by_name} | stage=${o.stage} | value=${o.deal_value}`));
