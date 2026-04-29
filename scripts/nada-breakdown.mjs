import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const NADA_ID = '9778b748-bb58-4506-b179-214200944da0';

console.log('🔍 Nada Breakdown — Detailed slicing\n');

// All Nada records
let nada = [];
let from = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('*').eq('is_deleted', false).eq('assigned_to', NADA_ID).range(from, from + 999);
  if (!data?.length) break;
  nada = nada.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

// Identify exclusive (no sibling)
let allActive = [];
let f2 = 0;
while (true) {
  const { data } = await supabase.from('contacts').select('id, phone, assigned_to').eq('is_deleted', false).range(f2, f2 + 999);
  if (!data?.length) break;
  allActive = allActive.concat(data);
  if (data.length < 1000) break;
  f2 += 1000;
}
const phoneCount = {};
for (const c of allActive) { if (c.phone) phoneCount[c.phone] = (phoneCount[c.phone] || 0) + 1; }
const exclusive = nada.filter(n => phoneCount[n.phone] === 1);
const withSibling = nada.filter(n => phoneCount[n.phone] > 1);

console.log(`Total Nada: ${nada.length}`);
console.log(`Exclusive: ${exclusive.length}`);
console.log(`With sibling: ${withSibling.length}\n`);

// Slice 1: by department
console.log('=== BY DEPARTMENT ===');
const deptMap = {};
for (const c of exclusive) deptMap[c.department || 'null'] = (deptMap[c.department || 'null'] || 0) + 1;
for (const [k, v] of Object.entries(deptMap).sort((a,b) => b[1]-a[1])) console.log(`  ${k.padEnd(20)} ${v}`);

// Slice 2: by contact_type
console.log('\n=== BY CONTACT TYPE ===');
const typeMap = {};
for (const c of exclusive) typeMap[c.contact_type || 'null'] = (typeMap[c.contact_type || 'null'] || 0) + 1;
for (const [k, v] of Object.entries(typeMap).sort((a,b) => b[1]-a[1])) console.log(`  ${k.padEnd(20)} ${v}`);

// Slice 3: by status
console.log('\n=== BY STATUS ===');
const statusMap = {};
for (const c of exclusive) statusMap[c.contact_status || 'null'] = (statusMap[c.contact_status || 'null'] || 0) + 1;
for (const [k, v] of Object.entries(statusMap).sort((a,b) => b[1]-a[1])) console.log(`  ${k.padEnd(20)} ${v}`);

// Slice 4: by source
console.log('\n=== BY SOURCE ===');
const sourceMap = {};
for (const c of exclusive) sourceMap[c.source || 'null'] = (sourceMap[c.source || 'null'] || 0) + 1;
for (const [k, v] of Object.entries(sourceMap).sort((a,b) => b[1]-a[1])) console.log(`  ${k.padEnd(20)} ${v}`);

// Slice 5: by campaign_name (top 20)
console.log('\n=== BY CAMPAIGN (Top 20) ===');
const campMap = {};
for (const c of exclusive) campMap[c.campaign_name || 'no_campaign'] = (campMap[c.campaign_name || 'no_campaign'] || 0) + 1;
const sortedCamps = Object.entries(campMap).sort((a,b) => b[1]-a[1]);
sortedCamps.slice(0, 20).forEach(([k, v]) => console.log(`  ${k.padEnd(35)} ${v}`));
console.log(`  ... +${sortedCamps.length - 20} more campaigns`);

// Slice 6: by age
console.log('\n=== BY AGE ===');
const now = Date.now();
const ageMap = { '< 30 days': 0, '30-90 days': 0, '90-180 days': 0, '180-365 days': 0, '1-2 years': 0, '> 2 years': 0 };
for (const c of exclusive) {
  const days = (now - new Date(c.created_at).getTime()) / 86400000;
  if (days < 30) ageMap['< 30 days']++;
  else if (days < 90) ageMap['30-90 days']++;
  else if (days < 180) ageMap['90-180 days']++;
  else if (days < 365) ageMap['180-365 days']++;
  else if (days < 730) ageMap['1-2 years']++;
  else ageMap['> 2 years']++;
}
for (const [k, v] of Object.entries(ageMap)) console.log(`  ${k.padEnd(20)} ${v}`);

// Slice 7: status × source matrix
console.log('\n=== STATUS × SOURCE MATRIX (active only — new/contacted/following/has_opp) ===');
const active = exclusive.filter(c => ['new', 'contacted', 'following', 'has_opportunity'].includes(c.contact_status));
const matrix = {};
for (const c of active) {
  const s = c.source || 'null';
  const st = c.contact_status;
  if (!matrix[s]) matrix[s] = {};
  matrix[s][st] = (matrix[s][st] || 0) + 1;
}
const statuses = ['new', 'contacted', 'following', 'has_opportunity'];
console.log('  Source'.padEnd(20) + statuses.map(s => s.padEnd(15)).join('') + 'Total');
for (const [src, sts] of Object.entries(matrix).sort((a,b) => Object.values(b[1]).reduce((s,n)=>s+n,0) - Object.values(a[1]).reduce((s,n)=>s+n,0))) {
  const total = Object.values(sts).reduce((s,n)=>s+n,0);
  const row = src.padEnd(20) + statuses.map(s => String(sts[s] || 0).padEnd(15)).join('') + total;
  console.log('  ' + row);
}

// Slice 8: temperature
console.log('\n=== BY TEMPERATURE ===');
const tempMap = {};
for (const c of exclusive) tempMap[c.temperature || 'null'] = (tempMap[c.temperature || 'null'] || 0) + 1;
for (const [k, v] of Object.entries(tempMap).sort((a,b) => b[1]-a[1])) console.log(`  ${k.padEnd(20)} ${v}`);

// Save full breakdown
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = `scripts/backups/nada-breakdown-${ts}.json`;
fs.writeFileSync(reportFile, JSON.stringify({
  totals: { nada: nada.length, exclusive: exclusive.length, withSibling: withSibling.length },
  byDepartment: deptMap,
  byContactType: typeMap,
  byStatus: statusMap,
  bySource: sourceMap,
  byCampaign: Object.fromEntries(sortedCamps),
  byAge: ageMap,
  statusSourceMatrix: matrix,
  byTemperature: tempMap,
}, null, 2));
console.log(`\n💾 ${reportFile}`);
