import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const id = 'd68b80cf-431b-412d-8e00-245cdf067e7b';
const isNada = (n) => typeof n === 'string' && /\bnada\b/i.test(n) && /kafafy/i.test(n);
const stripKey = (obj) => { if(!obj) return obj; const o={}; for(const[k,v] of Object.entries(obj)) if(!isNada(k)) o[k]=v; return o; };

const { data: c } = await supabase.from('contacts').select('*').eq('id', id).single();
const newNames = c.assigned_to_names.filter(n => !isNada(n));
const newPrimary = isNada(c.assigned_to_name) ? (newNames[0] || null) : c.assigned_to_name;
const { error } = await supabase.from('contacts').update({
  assigned_to_names: newNames,
  assigned_to_name: newPrimary,
  agent_statuses: stripKey(c.agent_statuses),
  agent_temperatures: stripKey(c.agent_temperatures),
  agent_scores: stripKey(c.agent_scores),
}).eq('id', id);
console.log('cleanup err:', error || 'OK');

const { data: after } = await supabase.from('contacts').select('assigned_to_names, assigned_to_name').eq('id', id).single();
console.log('after:', after);
