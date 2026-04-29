import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

console.log('🔍 Analyzing manager/leader phantom records...\n');

// Get all users with management roles
const { data: managers } = await supabase.from('users')
  .select('id, full_name_en, full_name_ar, role, team_id, status')
  .in('role', ['sales_manager', 'team_leader', 'sales_director', 'admin', 'operations']);

console.log(`Managers/leaders/admins: ${managers.length}\n`);
managers.forEach(m => console.log(`  ${m.role.padEnd(16)} | ${(m.full_name_en || '—').padEnd(25)} | status=${m.status} | id=${m.id.slice(0,8)}`));

// Get all sales agents (team members)
const { data: agents } = await supabase.from('users')
  .select('id, full_name_en, team_id')
  .eq('role', 'sales_agent');
const agentsByTeam = {};
for (const a of agents) {
  if (!a.team_id) continue;
  if (!agentsByTeam[a.team_id]) agentsByTeam[a.team_id] = [];
  agentsByTeam[a.team_id].push(a);
}

// Fetch all active contacts
let allContacts = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts')
    .select('id, phone, full_name, assigned_to, assigned_to_name, contact_status, created_at')
    .eq('is_deleted', false)
    .range(from, from + 999);
  if (!data?.length) break;
  allContacts = allContacts.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`\nActive contacts: ${allContacts.length}\n`);

// Group by phone
const byPhone = {};
for (const c of allContacts) {
  if (!c.phone) continue;
  if (!byPhone[c.phone]) byPhone[c.phone] = [];
  byPhone[c.phone].push(c);
}

// Per-manager analysis
console.log('=== MANAGER PHANTOM ANALYSIS ===\n');
let grandTotalPhantom = 0;
let grandTotalExclusive = 0;

for (const m of managers) {
  if (m.status !== 'active' && !['Hussien Soliman', 'General Manager'].includes(m.full_name_en)) {
    // Skip inactive but still check Hussien (who has 2,860 records) and General Manager
    continue;
  }
  const myContacts = allContacts.filter(c => c.assigned_to === m.id);
  if (myContacts.length === 0) continue;

  // For each of my contacts, check siblings on same phone
  let phantom = 0;  // has sibling record owned by my team
  let exclusive = 0;  // no sibling
  let siblingOutsideTeam = 0;  // sibling exists but not in my team
  const myTeamId = m.team_id;
  const myTeamMembers = (myTeamId && agentsByTeam[myTeamId]) ? agentsByTeam[myTeamId].map(a => a.id) : [];

  for (const c of myContacts) {
    const siblings = byPhone[c.phone].filter(s => s.id !== c.id);
    if (siblings.length === 0) {
      exclusive++;
    } else {
      // Check if any sibling is owned by someone in my team
      const teamSibling = siblings.find(s => myTeamMembers.includes(s.assigned_to));
      if (teamSibling) phantom++;
      else siblingOutsideTeam++;
    }
  }
  grandTotalPhantom += phantom;
  grandTotalExclusive += exclusive;

  console.log(`${m.role.padEnd(16)} | ${(m.full_name_en || '—').padEnd(25)} | total=${myContacts.length}`);
  console.log(`  ✂️  Phantom (team has it): ${phantom}`);
  console.log(`  ✋ Exclusive (no sibling): ${exclusive}`);
  console.log(`  ⚠️  Sibling outside team:  ${siblingOutsideTeam}`);
  console.log();
}

console.log('=== GRAND TOTALS ===');
console.log(`Phantom records (safe to delete): ${grandTotalPhantom}`);
console.log(`Exclusive records (manual review): ${grandTotalExclusive}`);
