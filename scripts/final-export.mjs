#!/usr/bin/env node
/**
 * Final Export - Merge all 8X CRM data into clean files
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'scripts', '8x-data');

// Known mappings
const STATUS_MAP = {
  71: 'Interested',
  131: 'Trying to Reach',
  136: 'Pending interest clarification',
  137: 'Reservation & Done Deal',
  146: 'Resale',
  // Unknown - will use ID
  69: 'Status_69',
  70: 'Status_70',
  73: 'Status_73',
  119: 'Status_119',
  121: 'Unqualified',
  122: 'Status_122',
  129: 'Status_129',
};

const SOURCE_MAP = {
  90: 'Employee Referral',
  91: 'Hotline',
  92: 'Google Ads',
  93: 'Facebook Campaign',
  103: 'Web Form',
  125: 'Platform Website',
  130: 'Tiktok',
  101: 'Source_101',
  132: 'Source_132',
};

const RATING_MAP = {
  82: 'None',
  83: 'Hot',
  84: 'Warm',
  85: 'Cold',
};

console.log('\nFinal Export — Merging all data...\n');

// Load data
const leads = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leads.json'), 'utf8'));
const timelines = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'timelines.json'), 'utf8'));

console.log(`  Leads: ${leads.length}`);
console.log(`  Timelines: ${Object.keys(timelines).length} leads\n`);

// Merge timelines into leads
for (const lead of leads) {
  lead.timeline = timelines[lead.id] || [];
  lead.status_name = STATUS_MAP[lead.status_id] || `Status_${lead.status_id}`;
  lead.source_name = SOURCE_MAP[lead.source_id] || `Source_${lead.source_id}`;
  lead.rating_name = RATING_MAP[lead.rating_id] || `Rating_${lead.rating_id}`;
}

// Save complete JSON
fs.writeFileSync(path.join(DATA_DIR, 'leads-final.json'), JSON.stringify(leads));
console.log('  leads-final.json — complete merged data');

// ============ CSV 1: All leads ============
const BOM = '\uFEFF';
const csvH = [
  'ID', 'Full Name', 'Phone', 'Phone International', 'WhatsApp',
  'Country', 'City', 'Status', 'Source', 'Rating',
  'Interests IDs', 'Assignees IDs',
  'Created At', 'Updated At', 'Activities Count'
].join(',') + '\n';

const csvRows = leads.map(l => {
  const ph = l.phones?.[0] || {};
  return [
    l.id,
    `"${(l.full_name || '').replace(/"/g, '""')}"`,
    `"${ph.phone || ''}"`,
    `"${ph.format_E164 || ''}"`,
    ph.has_whatsapp ? 'Yes' : 'No',
    `"${l.country_name || ''}"`,
    `"${l.city_name || ''}"`,
    `"${l.status_name}"`,
    `"${l.source_name}"`,
    `"${l.rating_name}"`,
    `"${(l.interests_ids || []).join('; ')}"`,
    `"${(l.assignees_ids || []).join('; ')}"`,
    l.created_at || '',
    l.updated_at || '',
    l.timeline.length,
  ].join(',');
}).join('\n');

fs.writeFileSync(path.join(DATA_DIR, 'all-leads.csv'), BOM + csvH + csvRows);
console.log('  all-leads.csv — all 30,686 leads');

// ============ CSV 2: Leads WITHOUT Unqualified ============
const filteredLeads = leads.filter(l => l.status_id !== 121);
const csvFiltered = filteredLeads.map(l => {
  const ph = l.phones?.[0] || {};
  return [
    l.id,
    `"${(l.full_name || '').replace(/"/g, '""')}"`,
    `"${ph.phone || ''}"`,
    `"${ph.format_E164 || ''}"`,
    ph.has_whatsapp ? 'Yes' : 'No',
    `"${l.country_name || ''}"`,
    `"${l.city_name || ''}"`,
    `"${l.status_name}"`,
    `"${l.source_name}"`,
    `"${l.rating_name}"`,
    `"${(l.interests_ids || []).join('; ')}"`,
    `"${(l.assignees_ids || []).join('; ')}"`,
    l.created_at || '',
    l.updated_at || '',
    l.timeline.length,
  ].join(',');
}).join('\n');

fs.writeFileSync(path.join(DATA_DIR, 'active-leads.csv'), BOM + csvH + csvFiltered);
console.log(`  active-leads.csv — ${filteredLeads.length} leads (excl. Unqualified)`);

// ============ CSV 3: Activities/Timeline ============
const actH = [
  'Lead ID', 'Lead Name', 'Lead Status', 'Lead Phone',
  'Activity Type', 'Activity ID', 'Notes', 'Outcome ID',
  'Created At', 'Created By'
].join(',') + '\n';

const actRows = [];
for (const lead of leads) {
  for (const item of lead.timeline) {
    const obj = item.object || {};
    const type = item.class?.includes('Activity') ? 'Activity' :
                 item.class?.includes('Task') ? 'Task' :
                 item.class?.includes('Note') ? 'Note' :
                 item.class?.includes('StatusChange') ? 'StatusChange' : item.class || 'Unknown';
    const ph = lead.phones?.[0]?.format_E164 || '';
    const notes = (obj.notes || obj.description || obj.subject || '').replace(/"/g, '""').replace(/\n/g, ' ');
    actRows.push([
      lead.id,
      `"${(lead.full_name || '').replace(/"/g, '""')}"`,
      `"${lead.status_name}"`,
      `"${ph}"`,
      `"${type}"`,
      obj.id || '',
      `"${notes}"`,
      obj.outcome_id || obj.status_id || '',
      obj.created_at || '',
      obj.created_by || '',
    ].join(','));
  }
}

fs.writeFileSync(path.join(DATA_DIR, 'all-activities.csv'), BOM + actH + actRows.join('\n'));
console.log(`  all-activities.csv — ${actRows.length} activities/tasks`);

// ============ Stats ============
const stats = {
  total_leads: leads.length,
  with_phones: leads.filter(l => l.phones?.length > 0).length,
  with_timeline: leads.filter(l => l.timeline.length > 0).length,
  total_activities: actRows.length,
  by_status: {},
  by_source: {},
  by_rating: {},
};

for (const l of leads) {
  const s = l.status_name;
  stats.by_status[s] = (stats.by_status[s] || 0) + 1;
  const src = l.source_name;
  stats.by_source[src] = (stats.by_source[src] || 0) + 1;
  const r = l.rating_name;
  stats.by_rating[r] = (stats.by_rating[r] || 0) + 1;
}

fs.writeFileSync(path.join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

console.log('\n========================================');
console.log('  FINAL SUMMARY');
console.log('========================================');
console.log(`  Total leads:         ${stats.total_leads}`);
console.log(`  With phones:         ${stats.with_phones}`);
console.log(`  Active (non-Unq):    ${filteredLeads.length}`);
console.log(`  With timeline:       ${stats.with_timeline}`);
console.log(`  Total activities:    ${stats.total_activities}`);
console.log('\n  By Status:');
for (const [k, v] of Object.entries(stats.by_status).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k}: ${v}`);
}
console.log('\n  By Source:');
for (const [k, v] of Object.entries(stats.by_source).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k}: ${v}`);
}
console.log('\n  By Rating:');
for (const [k, v] of Object.entries(stats.by_rating).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k}: ${v}`);
}
console.log('\n========================================');
console.log(`  Output: ${DATA_DIR}/`);
console.log('========================================\n');
