import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const SHAHD_NAME = 'Shahd';

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `scripts/backups/clone-shahd-${ts}`;
fs.mkdirSync(backupDir, { recursive: true });

// Get Shahd's user record
const { data: shahd } = await supabase.from('users')
  .select('id, full_name_en, full_name_ar')
  .eq('full_name_en', SHAHD_NAME)
  .single();
console.log('Shahd:', shahd);

// Find the 3 multi-assignment records
let all = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').eq('is_deleted', false).range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
const multi = all.filter(c =>
  Array.isArray(c.assigned_to_names) &&
  c.assigned_to_names.length > 1 &&
  c.assigned_to_names.includes(SHAHD_NAME)
);
console.log(`\nMulti-assignment records with Shahd: ${multi.length}`);
fs.writeFileSync(`${backupDir}/multi-before.json`, JSON.stringify(multi, null, 2));

for (const c of multi) {
  console.log(`\n--- ${c.full_name} | ${c.phone} ---`);
  console.log(`  Original primary: ${c.assigned_to_name}`);

  // 1. Create a clone for Shahd (similar to Phase 1 migration pattern)
  const slot = {
    contact_status: (c.agent_statuses || {})[SHAHD_NAME] || 'new',
    temperature: (c.agent_temperatures || {})[SHAHD_NAME] || 'cold',
    lead_score: (c.agent_scores || {})[SHAHD_NAME] || 0,
  };
  const clone = {
    full_name: c.full_name,
    phone: c.phone,
    phone2: c.phone2,
    email: c.email,
    contact_type: c.contact_type,
    source: c.source,
    department: c.department,
    platform: c.platform,
    campaign_name: c.campaign_name,
    campaign_id: c.campaign_id,
    campaign_interactions: c.campaign_interactions,
    preferred_location: c.preferred_location,
    interested_in_type: c.interested_in_type,
    budget_min: c.budget_min,
    budget_max: c.budget_max,
    company: c.company,
    job_title: c.job_title,
    gender: c.gender,
    nationality: c.nationality,
    birth_date: c.birth_date,
    prefix: c.prefix,
    extra_phones: c.extra_phones,
    referred_by: c.referred_by,
    notes: c.notes,
    contact_status: slot.contact_status,
    temperature: slot.temperature,
    lead_score: slot.lead_score,
    assigned_to_name: SHAHD_NAME,
    assigned_to: shahd.id,
    assigned_to_names: [SHAHD_NAME],
    agent_statuses: { [SHAHD_NAME]: slot.contact_status },
    agent_temperatures: { [SHAHD_NAME]: slot.temperature },
    agent_scores: { [SHAHD_NAME]: slot.lead_score },
    created_at: c.created_at,
    assigned_at: new Date().toISOString(),
    contact_number: c.contact_number ? `${c.contact_number}-S` : null,
  };
  const { data: cloneData, error: cloneErr } = await supabase.from('contacts').insert(clone).select('id').single();
  if (cloneErr) { console.log(`  ❌ Clone error: ${cloneErr.message}`); continue; }
  console.log(`  ✅ Clone created: ${cloneData.id}`);

  // 2. Move Shahd's activities to clone
  const { data: actsToMove } = await supabase.from('activities').select('id').eq('contact_id', c.id).eq('user_id', shahd.id);
  if (actsToMove?.length) {
    await supabase.from('activities').update({ contact_id: cloneData.id }).in('id', actsToMove.map(a => a.id));
    console.log(`  ✅ Moved ${actsToMove.length} activities to clone`);
  }

  // 3. Move Shahd's tasks to clone
  const { data: tasksToMove } = await supabase.from('tasks').select('id').eq('contact_id', c.id).eq('assigned_to', shahd.id);
  if (tasksToMove?.length) {
    await supabase.from('tasks').update({ contact_id: cloneData.id }).in('id', tasksToMove.map(t => t.id));
    console.log(`  ✅ Moved ${tasksToMove.length} tasks to clone`);
  }

  // 4. Update original: remove Shahd from arrays, clean jsonb maps
  const newNames = c.assigned_to_names.filter(n => n !== SHAHD_NAME);
  const newStatuses = { ...(c.agent_statuses || {}) };  delete newStatuses[SHAHD_NAME];
  const newTemps    = { ...(c.agent_temperatures || {}) }; delete newTemps[SHAHD_NAME];
  const newScores   = { ...(c.agent_scores || {}) };       delete newScores[SHAHD_NAME];
  const { error: upErr } = await supabase.from('contacts').update({
    assigned_to_names: newNames,
    agent_statuses: newStatuses,
    agent_temperatures: newTemps,
    agent_scores: newScores,
  }).eq('id', c.id);
  if (upErr) console.log(`  ❌ Update original failed: ${upErr.message}`);
  else console.log(`  ✅ Original now single-assignment to ${c.assigned_to_name}`);
}

console.log('\n✅ Done.');
