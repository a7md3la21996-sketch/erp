#!/usr/bin/env node
/**
 * Pull missing timelines from 8X CRM API and import to Supabase
 * For leads that had 0 timeline items in the original export
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const TOKEN = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIyIiwianRpIjoiZWJiNzU3OTBiNjZhMzIxZDA3YTY4NWFkOGE5ZjBjYWI1ZDI0YmM5ZTE4OGNkNGNiMTNjMWU3MTMwMDhlZWU3Zjk1ZDAyNTlmYjc1OGU3MDgiLCJpYXQiOjE3NzQ3NDA0MDMsIm5iZiI6MTc3NDc0MDQwMywiZXhwIjoxNzc3MzMyNDAyLCJzdWIiOiIyIiwic2NvcGVzIjpbIioiXX0.vsfD4YQei1p5hUgaWaBzwRn6YBAll8vsQZfTRq3ahYa1628onyHYNjL_ojyLYsubmxlvdGvMYefSbiDJ9JiZs6A5EBx0iy6yAz8MbZ96H9MCYtNuLyjGAQdufwTu57i8DuRg359jK8hNWIM7QFR0lYvp6HTVR8G9QxPU6TH_PV86-bQKFwzty4E6n5cnAm8uC2nszGgd-88ktJWbVS0wfV1k7Xpm-iXuwS5QIBoZH1_sNEsYt-77RbgV-SpPv08CYoJvKPZawcxtIjP3kjtlcmRSFGwjNJgaMOA3QFBSy3UXY4MxdPE2fSFYOcTpSUuFrMoRymEWRs14h0k7BGNpav6uEbBbGEgh2tkwQhSkXwOttchcnnxTwNku-glnCMTJT_mrQo-9-ha2OWdCMC2h4cSSywVLnUdpNHG5duuhomtP9ARFvJOQf96fwuEoC--SiC8cYeUUxj_613brcUEdXOljqunQ_huMpOphmBat8qqBi6_DzeRFYj1JmBoXqu4xrDN8VmDyTUnUWfICLexUz_7gV9en0aWlUbwWptUrKw7rMdz0sSOTjBJbmh3j2DvM-3MWoTPiyaB_5qp98DegryoLGNmkTUUmZV6TZiCV2vRYoFo91WWF51VbM-etVxRkPBeOLC_vtmPuaZC3X6JF4QU7dv6lt1mGoxiWyofQQB4';
const BASE_URL = 'https://platform.8xcrm.com';
const TIMELINE_URL = `${BASE_URL}/api/v2/global/timeline`;

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const DATA_DIR = path.join(process.cwd(), 'scripts', '8x-data');

const userMapping = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'user-id-mapping.json')));
const usersData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
const contactIdMapping = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'contact-id-mapping.json')));

const ACTIVITY_TYPE_MAP = { 2: 'call', 3: 'call', 5: 'call', 6: 'whatsapp', 7: 'call', 9: 'meeting', 11: 'meeting', 12: 'meeting', 13: 'note', 15: 'note', 16: 'note', 17: 'whatsapp', 18: 'meeting' };
const CONCURRENT = 10;

function getUserName(id) { return usersData[String(id)]?.name || null; }
function getUserUUID(id) { return userMapping[String(id)] || null; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchTimeline(leadId) {
  try {
    const res = await fetch(TIMELINE_URL, {
      method: 'POST',
      headers: { 'Authorization': TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ timelinable_type: 'Modules\\Leads\\Lead', timelinable_id: leadId, filter: 'all', page: 1 }),
    });
    if (res.status === 429) { await sleep(5000); return fetchTimeline(leadId); }
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data?.data || [];
  } catch { return []; }
}

async function main() {
  console.log('\n========================================');
  console.log('  Pull Missing Timelines & Import');
  console.log('========================================\n');

  // Find leads with 0 timeline in export
  const leads = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leads-final.json')));
  const missingLeads = leads.filter(l => (l.timeline || []).length === 0);
  console.log(`  Leads with missing timelines: ${missingLeads.length}`);

  let totalFetched = 0;
  let activitiesInserted = 0;
  let tasksInserted = 0;
  let completed = 0;

  // Process in batches
  for (let i = 0; i < missingLeads.length; i += CONCURRENT) {
    const batch = missingLeads.slice(i, i + CONCURRENT);

    const results = await Promise.all(batch.map(async (lead) => {
      const items = await fetchTimeline(lead.id);
      return { leadId: lead.id, items };
    }));

    for (const { leadId, items } of results) {
      if (items.length === 0) continue;
      totalFetched += items.length;

      // Find contact_id in new system
      const newContactId = contactIdMapping[String(leadId)];
      if (!newContactId) continue;

      const activities = [];
      const tasks = [];

      for (const t of items) {
        const cls = t.class || '';
        const obj = t.object || {};
        const notes = (obj.notes || obj.description || '').trim();
        if (!notes) continue;

        const createdBy = obj.created_by;

        if (cls.includes('Task')) {
          tasks.push({
            title: (obj.subject || notes).slice(0, 200),
            type: 'followup',
            priority: 'medium',
            status: obj.status_id === 3 ? 'done' : 'pending',
            contact_id: newContactId,
            assigned_to: getUserUUID(createdBy),
            assigned_to_name_ar: getUserName(createdBy),
            assigned_to_name_en: getUserName(createdBy),
            dept: 'crm',
            notes,
            due_date: obj.due_date || obj.created_at,
            created_at: obj.created_at || new Date().toISOString(),
          });
        } else {
          activities.push({
            type: ACTIVITY_TYPE_MAP[obj.activity_type_id] || 'note',
            notes,
            entity_type: 'contact',
            contact_id: newContactId,
            user_id: getUserUUID(createdBy),
            user_name_ar: getUserName(createdBy),
            user_name_en: getUserName(createdBy),
            dept: 'crm',
            status: 'completed',
            created_at: obj.created_at || new Date().toISOString(),
          });
        }
      }

      // Insert
      if (activities.length) {
        const { error } = await supabase.from('activities').insert(activities);
        if (!error) activitiesInserted += activities.length;
      }
      if (tasks.length) {
        const { error } = await supabase.from('tasks').insert(tasks);
        if (!error) tasksInserted += tasks.length;
      }
    }

    completed += batch.length;
    const pct = Math.round((completed / missingLeads.length) * 100);
    process.stdout.write(`\r  Progress: ${completed}/${missingLeads.length} (${pct}%) — Fetched: ${totalFetched} | Activities: ${activitiesInserted} | Tasks: ${tasksInserted}`);
  }

  console.log('\n\n========================================');
  console.log(`  Total fetched: ${totalFetched}`);
  console.log(`  Activities inserted: ${activitiesInserted}`);
  console.log(`  Tasks inserted: ${tasksInserted}`);
  console.log('========================================\n');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
