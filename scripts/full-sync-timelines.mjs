#!/usr/bin/env node
/**
 * Full timeline sync: pull ALL pages of ALL leads from old CRM
 * Import everything including empty notes
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const TOKEN = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIyIiwianRpIjoiZWJiNzU3OTBiNjZhMzIxZDA3YTY4NWFkOGE5ZjBjYWI1ZDI0YmM5ZTE4OGNkNGNiMTNjMWU3MTMwMDhlZWU3Zjk1ZDAyNTlmYjc1OGU3MDgiLCJpYXQiOjE3NzQ3NDA0MDMsIm5iZiI6MTc3NDc0MDQwMywiZXhwIjoxNzc3MzMyNDAyLCJzdWIiOiIyIiwic2NvcGVzIjpbIioiXX0.vsfD4YQei1p5hUgaWaBzwRn6YBAll8vsQZfTRq3ahYa1628onyHYNjL_ojyLYsubmxlvdGvMYefSbiDJ9JiZs6A5EBx0iy6yAz8MbZ96H9MCYtNuLyjGAQdufwTu57i8DuRg359jK8hNWIM7QFR0lYvp6HTVR8G9QxPU6TH_PV86-bQKFwzty4E6n5cnAm8uC2nszGgd-88ktJWbVS0wfV1k7Xpm-iXuwS5QIBoZH1_sNEsYt-77RbgV-SpPv08CYoJvKPZawcxtIjP3kjtlcmRSFGwjNJgaMOA3QFBSy3UXY4MxdPE2fSFYOcTpSUuFrMoRymEWRs14h0k7BGNpav6uEbBbGEgh2tkwQhSkXwOttchcnnxTwNku-glnCMTJT_mrQo-9-ha2OWdCMC2h4cSSywVLnUdpNHG5duuhomtP9ARFvJOQf96fwuEoC--SiC8cYeUUxj_613brcUEdXOljqunQ_huMpOphmBat8qqBi6_DzeRFYj1JmBoXqu4xrDN8VmDyTUnUWfICLexUz_7gV9en0aWlUbwWptUrKw7rMdz0sSOTjBJbmh3j2DvM-3MWoTPiyaB_5qp98DegryoLGNmkTUUmZV6TZiCV2vRYoFo91WWF51VbM-etVxRkPBeOLC_vtmPuaZC3X6JF4QU7dv6lt1mGoxiWyofQQB4';
const BASE_URL = 'https://platform.8xcrm.com';
const h = { 'Authorization': TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json' };

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DATA_DIR = path.join(process.cwd(), 'scripts', '8x-data');
const userMapping = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'user-id-mapping.json')));
const usersData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));

const ACTIVITY_TYPE_MAP = { 2: 'call', 3: 'call', 5: 'call', 6: 'whatsapp', 7: 'call', 9: 'meeting', 11: 'meeting', 12: 'meeting', 13: 'note', 15: 'note', 16: 'note', 17: 'whatsapp', 18: 'meeting' };

function getUserName(id) { return usersData[String(id)]?.name || null; }
function getUserUUID(id) { return userMapping[String(id)] || null; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllTimeline(leadId) {
  const items = [];
  let page = 1, lastPage = 1;
  do {
    try {
      const res = await fetch(`${BASE_URL}/api/v2/global/timeline`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ timelinable_type: 'Modules\\Leads\\Lead', timelinable_id: leadId, filter: 'all', page }),
      });
      if (res.status === 429) { await sleep(5000); continue; }
      if (!res.ok) break;
      const data = await res.json();
      if (data?.data?.data) items.push(...data.data.data);
      lastPage = data?.data?.last_page || 1;
    } catch { break; }
    page++;
  } while (page <= lastPage);
  return items;
}

async function main() {
  console.log('\n========================================');
  console.log('  Full Timeline Sync');
  console.log('========================================\n');

  // 1. Get all existing activity IDs to avoid duplicates
  console.log('Step 1: Getting existing activity dates...');
  let existingDates = new Set();
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('activities').select('contact_id, created_at').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    data.forEach(a => existingDates.add(`${a.contact_id}_${a.created_at}`));
    if (data.length < 1000) break;
    offset += 1000;
  }
  offset = 0;
  while (true) {
    const { data } = await supabase.from('tasks').select('contact_id, created_at').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    data.forEach(t => existingDates.add(`${t.contact_id}_${t.created_at}`));
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log('  Existing records:', existingDates.size);

  // 2. Get all contacts with their phones
  console.log('\nStep 2: Building phone → contact_id map...');
  const phoneToContactId = {};
  offset = 0;
  while (true) {
    const { data } = await supabase.from('contacts').select('id, phone').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    data.forEach(c => {
      if (c.phone) phoneToContactId[c.phone.replace(/\D/g, '').slice(-9)] = c.id;
    });
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log('  Contacts mapped:', Object.keys(phoneToContactId).length);

  // 3. Pull all leads from old CRM
  console.log('\nStep 3: Pulling leads from old CRM...');
  const allLeads = [];
  let start = 0;
  while (true) {
    try {
      const res = await fetch(`${BASE_URL}/api/v4/leads/leads`, {
        method: 'POST', headers: h, body: JSON.stringify({ start, length: 100 })
      });
      if (!res.ok) { await sleep(3000); continue; }
      const data = await res.json();
      const batch = data?.data?.data || [];
      if (batch.length === 0) break;
      allLeads.push(...batch);
      start += 100;
      if (start % 1000 === 0) process.stdout.write(`\r  ${allLeads.length} leads...`);
      if (batch.length < 100) break;
    } catch (e) {
      console.log('\n  API error, retrying in 5s...', e.message);
      await sleep(5000);
    }
  }
  console.log(`\n  Total leads: ${allLeads.length}`);

  // 4. Pull timelines and import
  console.log('\nStep 4: Pulling timelines (all pages) and importing...');
  let totalFetched = 0, actsInserted = 0, tasksInserted = 0, skipped = 0;

  for (let i = 0; i < allLeads.length; i++) {
    const lead = allLeads[i];
    const ph = lead.phones?.[0]?.format_E164 || lead.phones?.[0]?.phone || '';
    const digits = ph.replace(/\D/g, '').slice(-9);
    const contactId = phoneToContactId[digits];
    if (!contactId) continue;

    const items = await fetchAllTimeline(lead.id);
    totalFetched += items.length;

    const actsBatch = [];
    const tasksBatch = [];

    for (const t of items) {
      const obj = t.object || {};
      const cls = t.class || '';
      const notes = (obj.notes || obj.description || '').trim();
      const createdBy = obj.created_by;
      const createdAt = obj.created_at || new Date().toISOString();

      // Skip if already exists
      const key = `${contactId}_${createdAt}`;
      if (existingDates.has(key)) { skipped++; continue; }
      existingDates.add(key);

      if (cls.includes('Task')) {
        tasksBatch.push({
          title: (obj.subject || notes || 'Follow-up').slice(0, 200),
          type: 'followup', priority: 'medium',
          status: obj.status_id === 3 ? 'done' : 'pending',
          contact_id: contactId,
          assigned_to: getUserUUID(createdBy),
          assigned_to_name_ar: getUserName(createdBy),
          assigned_to_name_en: getUserName(createdBy),
          dept: 'crm', notes: notes || null,
          due_date: obj.due_date || createdAt,
          created_at: createdAt,
        });
      } else {
        actsBatch.push({
          type: ACTIVITY_TYPE_MAP[obj.activity_type_id] || 'note',
          notes: notes || null,
          entity_type: 'contact', contact_id: contactId,
          user_id: getUserUUID(createdBy),
          user_name_ar: getUserName(createdBy),
          user_name_en: getUserName(createdBy),
          dept: 'crm', status: 'completed',
          created_at: createdAt,
        });
      }
    }

    // Batch insert
    if (actsBatch.length) {
      const { error } = await supabase.from('activities').insert(actsBatch);
      if (!error) actsInserted += actsBatch.length;
    }
    if (tasksBatch.length) {
      const { error } = await supabase.from('tasks').insert(tasksBatch);
      if (!error) tasksInserted += tasksBatch.length;
    }

    if (i % 10 === 0) {
      process.stdout.write(`\r  ${i + 1}/${allLeads.length} | Fetched: ${totalFetched} | Acts: ${actsInserted} | Tasks: ${tasksInserted} | Skipped: ${skipped}`);
    }

    // Rate limit protection
    if (i % 50 === 0 && i > 0) await sleep(500);
  }

  console.log('\n\n========================================');
  console.log(`  Total timeline items fetched: ${totalFetched}`);
  console.log(`  New activities inserted: ${actsInserted}`);
  console.log(`  New tasks inserted: ${tasksInserted}`);
  console.log(`  Skipped (already existed): ${skipped}`);
  console.log('========================================\n');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
