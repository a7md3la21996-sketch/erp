import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const backupDir = process.argv[2] || 'scripts/backups/phase1-sample-2026-04-29T17-06-14-808Z';
console.log(`🔬 Comprehensive verification of: ${backupDir}\n`);

const before = JSON.parse(fs.readFileSync(path.join(backupDir, 'sample-contacts-before.json')));
const actsBefore = JSON.parse(fs.readFileSync(path.join(backupDir, 'activities-before.json')));
const tasksBefore = JSON.parse(fs.readFileSync(path.join(backupDir, 'tasks-before.json')));
const cloneMap = JSON.parse(fs.readFileSync(path.join(backupDir, 'clone-id-map.json')));

let pass = 0, fail = 0;
const issues = [];

// 1. Each original record has assigned_to_names.length === 1
for (const c of before) {
  const { data: after } = await supabase.from('contacts').select('*').eq('id', c.id).maybeSingle();
  if (!after) { fail++; issues.push(`Original ${c.contact_number} (${c.id}) missing!`); continue; }
  if (!after.assigned_to_names || after.assigned_to_names.length !== 1) {
    fail++; issues.push(`Original ${c.contact_number}: still has ${after.assigned_to_names?.length || 0} assignees`);
    continue;
  }
  pass++;
}
console.log(`1. Originals collapsed to single assignee: ${pass}/${before.length} ${fail===0?'✅':'❌'}`);

// 2. Each clone exists with correct assignee
let clonesPass = 0, clonesFail = 0;
const allCloneIds = [];
for (const [origId, cloneByUserId] of Object.entries(cloneMap)) {
  for (const [userId, cloneId] of Object.entries(cloneByUserId)) {
    allCloneIds.push(cloneId);
    const { data: clone } = await supabase.from('contacts').select('*').eq('id', cloneId).maybeSingle();
    if (!clone) { clonesFail++; issues.push(`Clone ${cloneId} missing`); continue; }
    if (clone.assigned_to !== userId) { clonesFail++; issues.push(`Clone ${cloneId}: assigned_to mismatch`); continue; }
    if (clone.assigned_to_names?.length !== 1) { clonesFail++; issues.push(`Clone ${cloneId}: assigned_to_names has ${clone.assigned_to_names?.length} entries`); continue; }
    clonesPass++;
  }
}
console.log(`2. Clones exist with correct assignment: ${clonesPass}/${clonesPass+clonesFail} ${clonesFail===0?'✅':'❌'}`);

// 3. Activities correctly distributed
console.log('\n3. Verifying activity distribution...');
const origIds = before.map(c => c.id);
const allRelevantContactIds = [...origIds, ...allCloneIds];
const { data: actsAfter } = await supabase.from('activities').select('id, contact_id, user_id').in('contact_id', allRelevantContactIds);
console.log(`   Activities total (before): ${actsBefore.length} | after: ${actsAfter?.length || 0}`);
const matchActs = actsBefore.length === (actsAfter?.length || 0);
console.log(`   Total preserved: ${matchActs ? '✅' : '❌'}`);

// Check for stragglers (activities still on origin that should have moved)
let activityIssues = 0;
for (const orig of before) {
  const cloneByUserId = cloneMap[orig.id] || {};
  const cloneUserIds = new Set(Object.keys(cloneByUserId));
  const actsOnThisOrig = actsAfter?.filter(a => a.contact_id === orig.id) || [];
  for (const a of actsOnThisOrig) {
    if (cloneUserIds.has(a.user_id)) {
      // This activity should have been moved to a clone
      activityIssues++;
      issues.push(`Activity ${a.id} on ${orig.contact_number} should be on clone for user ${a.user_id}`);
    }
  }
}
console.log(`   Stragglers (should have moved): ${activityIssues} ${activityIssues===0?'✅':'❌'}`);

// 4. Tasks
console.log('\n4. Verifying tasks distribution...');
const { data: tasksAfter } = await supabase.from('tasks').select('id, contact_id, assigned_to').in('contact_id', allRelevantContactIds);
console.log(`   Tasks total (before): ${tasksBefore.length} | after: ${tasksAfter?.length || 0}`);
const matchTasks = tasksBefore.length === (tasksAfter?.length || 0);
console.log(`   Total preserved: ${matchTasks ? '✅' : '❌'}`);

let taskIssues = 0;
for (const orig of before) {
  const cloneByUserId = cloneMap[orig.id] || {};
  const cloneUserIds = new Set(Object.keys(cloneByUserId));
  const tasksOnOrig = tasksAfter?.filter(t => t.contact_id === orig.id) || [];
  for (const t of tasksOnOrig) {
    if (cloneUserIds.has(t.assigned_to)) {
      taskIssues++;
      issues.push(`Task ${t.id} on ${orig.contact_number} should be on clone for user ${t.assigned_to}`);
    }
  }
}
console.log(`   Stragglers: ${taskIssues} ${taskIssues===0?'✅':'❌'}`);

// 5. Phone duplicates count (should match expected)
const phones = before.map(c => c.phone);
const { data: phoneDupes } = await supabase.from('contacts').select('phone, id').in('phone', phones);
const phoneCounts = phoneDupes.reduce((acc, c) => { acc[c.phone] = (acc[c.phone] || 0) + 1; return acc; }, {});
console.log('\n5. Phone records count per migrated contact:');
for (const c of before) {
  const expected = c.assigned_to_names.length;
  const got = phoneCounts[c.phone] || 0;
  const ok = got === expected;
  console.log(`   ${c.contact_number?.padEnd(8) || 'null'.padEnd(8)} | ${c.phone} | expected ${expected} got ${got} ${ok ? '✅' : '❌'}`);
}

console.log(`\n=== SUMMARY ===`);
if (issues.length === 0) {
  console.log('✅ ALL CHECKS PASSED');
} else {
  console.log(`⚠️ ${issues.length} issues found:`);
  issues.slice(0, 20).forEach(i => console.log(`  • ${i}`));
}
