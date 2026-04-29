import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';

console.log('🔍 Nada Kafafy Deep Analysis\n');

// Fetch all Nada records with phone
let nadaRecords = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts')
    .select('id, phone, full_name, contact_status, contact_type, source, created_at, last_activity_at, lead_score, temperature')
    .eq('is_deleted', false)
    .eq('assigned_to', NADA_ID)
    .range(from, from + 999);
  if (!data?.length) break;
  nadaRecords = nadaRecords.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Nada total active records: ${nadaRecords.length}\n`);

// Fetch activity counts per Nada record
const ids = nadaRecords.map(r => r.id);
const actsByContact = {};
const actsByMe = {};  // activities BY Nada (user_id = NADA_ID)
console.log('Fetching activities...');
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { data: acts } = await supabase.from('activities')
    .select('contact_id, user_id, type, created_at')
    .in('contact_id', chunk);
  for (const a of acts || []) {
    actsByContact[a.contact_id] = (actsByContact[a.contact_id] || 0) + 1;
    if (a.user_id === NADA_ID) actsByMe[a.contact_id] = (actsByMe[a.contact_id] || 0) + 1;
  }
}

// Categorize each record by activity
const noActivity = [];        // 0 activities — totally untouched
const onlyOldImportData = []; // has acts but 0 by Nada — orphan acts from migration
const nadaActiveLow = [];     // Nada did 1-3 acts (light touch)
const nadaActiveMedium = [];  // Nada did 4-10 acts
const nadaActiveHeavy = [];   // Nada did 11+ acts (real worker)

for (const r of nadaRecords) {
  const total = actsByContact[r.id] || 0;
  const byMe = actsByMe[r.id] || 0;
  const item = { ...r, total, byMe };
  if (total === 0) noActivity.push(item);
  else if (byMe === 0) onlyOldImportData.push(item);
  else if (byMe <= 3) nadaActiveLow.push(item);
  else if (byMe <= 10) nadaActiveMedium.push(item);
  else nadaActiveHeavy.push(item);
}

console.log('\n=== ACTIVITY ANALYSIS ===\n');
console.log(`📭 Zero activities (totally untouched): ${noActivity.length}`);
console.log(`👻 Activities exist but ZERO by Nada (orphan history): ${onlyOldImportData.length}`);
console.log(`🟡 Nada did 1-3 acts (light touch): ${nadaActiveLow.length}`);
console.log(`🟢 Nada did 4-10 acts (real engagement): ${nadaActiveMedium.length}`);
console.log(`🟢🟢 Nada did 11+ acts (heavy worker): ${nadaActiveHeavy.length}`);

const totalActuallyWorked = nadaActiveLow.length + nadaActiveMedium.length + nadaActiveHeavy.length;
const totalIdle = noActivity.length + onlyOldImportData.length;
console.log(`\n  Total Nada actually worked: ${totalActuallyWorked} (${(totalActuallyWorked/nadaRecords.length*100).toFixed(1)}%)`);
console.log(`  Total IDLE (no Nada activity): ${totalIdle} (${(totalIdle/nadaRecords.length*100).toFixed(1)}%)`);

// Status breakdown for the IDLE records
console.log('\n=== IDLE RECORDS BY STATUS ===');
const idle = [...noActivity, ...onlyOldImportData];
const statusMap = {};
for (const r of idle) statusMap[r.contact_status || 'null'] = (statusMap[r.contact_status || 'null'] || 0) + 1;
for (const [s, c] of Object.entries(statusMap).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${s.padEnd(20)} ${c}`);
}

// Source breakdown
console.log('\n=== IDLE RECORDS BY SOURCE (Top 10) ===');
const sourceMap = {};
for (const r of idle) sourceMap[r.source || 'null'] = (sourceMap[r.source || 'null'] || 0) + 1;
const sortedSources = Object.entries(sourceMap).sort((a,b) => b[1]-a[1]);
sortedSources.slice(0, 10).forEach(([s, c]) => console.log(`  ${s.padEnd(20)} ${c}`));

// Created_at — how old?
console.log('\n=== IDLE RECORDS — AGE ===');
const now = Date.now();
let lt30 = 0, lt90 = 0, lt365 = 0, gt365 = 0;
for (const r of idle) {
  const days = (now - new Date(r.created_at).getTime()) / 86400000;
  if (days < 30) lt30++;
  else if (days < 90) lt90++;
  else if (days < 365) lt365++;
  else gt365++;
}
console.log(`  < 30 days:  ${lt30}`);
console.log(`  < 90 days:  ${lt90}`);
console.log(`  < 365 days: ${lt365}`);
console.log(`  > 365 days: ${gt365}`);

console.log('\n=== SUMMARY ===');
console.log(`Total Nada records: ${nadaRecords.length}`);
console.log(`✅ Truly worked by Nada: ${totalActuallyWorked}`);
console.log(`💤 Idle (no Nada activity): ${totalIdle}`);
console.log(`   → Candidates for redistribution if she's not actually working CRM`);
