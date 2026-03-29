/**
 * Platform ERP — Supabase Operations Test Suite
 * Tests every critical CRUD operation against the live database.
 * Run: node scripts/test-supabase-operations.mjs
 */

import { createClient } from '@supabase/supabase-js';

const URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTk5MjYsImV4cCI6MjA4OTkzNTkyNn0.pRiluwKMa34ggOT6NRJqZItY8c6DQkjGj0BCezzSzZA';

const supabase = createClient(URL, KEY);
const results = [];
const testIds = {}; // track created IDs for cleanup

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ test, status, detail });
  console.log(`${icon} ${test}${detail ? ' — ' + detail : ''}`);
}

// ════════════════════════════════════════════
// 1. CONTACTS
// ════════════════════════════════════════════
async function testContacts() {
  console.log('\n══ CONTACTS ══');

  // CREATE
  const { data: created, error: createErr } = await supabase
    .from('contacts')
    .insert([{
      full_name: 'TEST_CONTACT_' + Date.now(),
      phone: '+20100' + Math.floor(Math.random() * 10000000),
      contact_type: 'lead',
      department: 'sales',
      source: 'website',
      temperature: 'warm',
      last_activity_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (createErr) { log('Contact CREATE', 'FAIL', createErr.message); return; }
  log('Contact CREATE', 'PASS', `id: ${created.id}`);
  testIds.contact = created.id;

  // READ
  const { data: read, error: readErr } = await supabase
    .from('contacts')
    .select('id, full_name, phone')
    .eq('id', created.id)
    .single();

  if (readErr || !read) { log('Contact READ', 'FAIL', readErr?.message); }
  else log('Contact READ', 'PASS', read.full_name);

  // UPDATE
  const { data: updated, error: updateErr } = await supabase
    .from('contacts')
    .update({ notes: 'Updated by test script', updated_at: new Date().toISOString() })
    .eq('id', created.id)
    .select('notes')
    .single();

  if (updateErr) { log('Contact UPDATE', 'FAIL', updateErr.message); }
  else log('Contact UPDATE', 'PASS', `notes: "${updated.notes}"`);

  // DELETE
  const { error: delErr } = await supabase
    .from('contacts')
    .delete()
    .eq('id', created.id);

  if (delErr) { log('Contact DELETE', 'FAIL', delErr.message); }
  else log('Contact DELETE', 'PASS');

  // Verify deleted
  const { data: check } = await supabase.from('contacts').select('id').eq('id', created.id).maybeSingle();
  if (check) { log('Contact DELETE verify', 'FAIL', 'still exists!'); }
  else log('Contact DELETE verify', 'PASS', 'confirmed deleted');
}

// ════════════════════════════════════════════
// 2. OPPORTUNITIES
// ════════════════════════════════════════════
async function testOpportunities() {
  console.log('\n══ OPPORTUNITIES ══');

  // Need a contact first
  const { data: contact } = await supabase.from('contacts')
    .insert([{ full_name: 'TEST_OPP_CONTACT', phone: '+20111' + Math.floor(Math.random() * 10000000), contact_type: 'lead', department: 'sales', last_activity_at: new Date().toISOString() }])
    .select('id').single();

  if (!contact) { log('Opportunity prereq', 'FAIL', 'cannot create contact'); return; }

  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .insert([{
      contact_id: contact.id,
      contact_name: 'TEST_OPP_CONTACT',
      stage: 'qualification',
      priority: 'medium',
      budget: 1500000,
      source: 'website',
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (oppErr) { log('Opportunity CREATE', 'FAIL', oppErr.message); }
  else { log('Opportunity CREATE', 'PASS', `id: ${opp.id}`); testIds.opportunity = opp.id; }

  // UPDATE stage
  if (opp) {
    const { error: stageErr } = await supabase
      .from('opportunities')
      .update({ stage: 'proposal', stage_changed_at: new Date().toISOString() })
      .eq('id', opp.id);
    if (stageErr) log('Opportunity UPDATE stage', 'FAIL', stageErr.message);
    else log('Opportunity UPDATE stage', 'PASS', 'qualification → proposal');
  }

  // Cleanup
  if (opp) await supabase.from('opportunities').delete().eq('id', opp.id);
  await supabase.from('contacts').delete().eq('id', contact.id);
  log('Opportunity CLEANUP', 'PASS');
}

// ════════════════════════════════════════════
// 3. ACTIVITIES
// ════════════════════════════════════════════
async function testActivities() {
  console.log('\n══ ACTIVITIES ══');

  const { data: act, error: actErr } = await supabase
    .from('activities')
    .insert([{
      type: 'call',
      entity_type: 'contact',
      notes: 'Test call from script',
      status: 'completed',
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (actErr) { log('Activity CREATE', 'FAIL', actErr.message); }
  else { log('Activity CREATE', 'PASS', `id: ${act.id}`); }

  // Cleanup
  if (act) await supabase.from('activities').delete().eq('id', act.id);
}

// ════════════════════════════════════════════
// 4. DEALS
// ════════════════════════════════════════════
async function testDeals() {
  console.log('\n══ DEALS ══');

  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .insert([{
      deal_number: 'TEST-D-' + Date.now(),
      client_ar: 'عميل تجريبي',
      client_en: 'Test Client',
      agent_ar: 'تست',
      agent_en: 'Test',
      deal_value: 2000000,
      status: 'new_deal',
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (dealErr) { log('Deal CREATE', 'FAIL', dealErr.message); }
  else { log('Deal CREATE', 'PASS', `${deal.deal_number}`); }

  if (deal) await supabase.from('deals').delete().eq('id', deal.id);
}

// ════════════════════════════════════════════
// 5. TASKS
// ════════════════════════════════════════════
async function testTasks() {
  console.log('\n══ TASKS ══');

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert([{
      title: 'Test Task ' + Date.now(),
      status: 'pending',
      priority: 'medium',
      due_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (taskErr) { log('Task CREATE', 'FAIL', taskErr.message); }
  else { log('Task CREATE', 'PASS', task.title); }

  if (task) await supabase.from('tasks').delete().eq('id', task.id);
}

// ════════════════════════════════════════════
// 6. REMINDERS
// ════════════════════════════════════════════
async function testReminders() {
  console.log('\n══ REMINDERS ══');

  const { data: rem, error: remErr } = await supabase
    .from('reminders')
    .insert([{
      entity_type: 'contact',
      entity_name: 'Test Reminder',
      type: 'call',
      due_at: new Date(Date.now() + 86400000).toISOString(),
      is_done: false,
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (remErr) { log('Reminder CREATE', 'FAIL', remErr.message); }
  else { log('Reminder CREATE', 'PASS', rem.entity_name); }

  if (rem) await supabase.from('reminders').delete().eq('id', rem.id);
}

// ════════════════════════════════════════════
// 7. CAMPAIGNS
// ════════════════════════════════════════════
async function testCampaigns() {
  console.log('\n══ CAMPAIGNS ══');

  const { data: camp, error: campErr } = await supabase
    .from('campaigns')
    .insert([{
      name_ar: 'حملة تجريبية',
      name_en: 'Test Campaign',
      platform: 'meta',
      status: 'active',
      budget: 10000,
      spent: 0,
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (campErr) { log('Campaign CREATE', 'FAIL', campErr.message); }
  else { log('Campaign CREATE', 'PASS', camp.name_en); }

  if (camp) await supabase.from('campaigns').delete().eq('id', camp.id);
}

// ════════════════════════════════════════════
// 8. TABLE EXISTENCE CHECK
// ════════════════════════════════════════════
async function testTables() {
  console.log('\n══ TABLE CHECK ══');

  const tables = [
    'users', 'contacts', 'opportunities', 'activities', 'deals',
    'tasks', 'reminders', 'campaigns', 'projects', 'resale_units',
    'audit_logs', 'sessions', 'departments', 'employees', 'attendance',
    'leave_requests', 'leave_balances', 'notifications', 'approvals',
    'kpi_targets', 'system_config', 'announcements',
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(0);
    if (error) log(`Table ${t}`, 'FAIL', error.message);
    else log(`Table ${t}`, 'PASS');
  }
}

// ════════════════════════════════════════════
// RUN ALL TESTS
// ════════════════════════════════════════════
console.log('🧪 Platform ERP — Supabase Operations Test');
console.log('=' .repeat(50));
console.log(`URL: ${URL}`);
console.log(`Time: ${new Date().toISOString()}\n`);

await testTables();
await testContacts();
await testOpportunities();
await testActivities();
await testDeals();
await testTasks();
await testReminders();
await testCampaigns();

// Summary
console.log('\n' + '='.repeat(50));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`\n📊 Results: ${passed} PASS / ${failed} FAIL / ${results.length} total`);

if (failed > 0) {
  console.log('\n❌ FAILURES:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`   - ${r.test}: ${r.detail}`);
  });
}

process.exit(failed > 0 ? 1 : 0);
