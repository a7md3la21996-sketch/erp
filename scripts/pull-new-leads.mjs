#!/usr/bin/env node
/**
 * Pull new leads added after original export + their timelines
 * Then import to Supabase
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const TOKEN = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIyIiwianRpIjoiZWJiNzU3OTBiNjZhMzIxZDA3YTY4NWFkOGE5ZjBjYWI1ZDI0YmM5ZTE4OGNkNGNiMTNjMWU3MTMwMDhlZWU3Zjk1ZDAyNTlmYjc1OGU3MDgiLCJpYXQiOjE3NzQ3NDA0MDMsIm5iZiI6MTc3NDc0MDQwMywiZXhwIjoxNzc3MzMyNDAyLCJzdWIiOiIyIiwic2NvcGVzIjpbIioiXX0.vsfD4YQei1p5hUgaWaBzwRn6YBAll8vsQZfTRq3ahYa1628onyHYNjL_ojyLYsubmxlvdGvMYefSbiDJ9JiZs6A5EBx0iy6yAz8MbZ96H9MCYtNuLyjGAQdufwTu57i8DuRg359jK8hNWIM7QFR0lYvp6HTVR8G9QxPU6TH_PV86-bQKFwzty4E6n5cnAm8uC2nszGgd-88ktJWbVS0wfV1k7Xpm-iXuwS5QIBoZH1_sNEsYt-77RbgV-SpPv08CYoJvKPZawcxtIjP3kjtlcmRSFGwjNJgaMOA3QFBSy3UXY4MxdPE2fSFYOcTpSUuFrMoRymEWRs14h0k7BGNpav6uEbBbGEgh2tkwQhSkXwOttchcnnxTwNku-glnCMTJT_mrQo-9-ha2OWdCMC2h4cSSywVLnUdpNHG5duuhomtP9ARFvJOQf96fwuEoC--SiC8cYeUUxj_613brcUEdXOljqunQ_huMpOphmBat8qqBi6_DzeRFYj1JmBoXqu4xrDN8VmDyTUnUWfICLexUz_7gV9en0aWlUbwWptUrKw7rMdz0sSOTjBJbmh3j2DvM-3MWoTPiyaB_5qp98DegryoLGNmkTUUmZV6TZiCV2vRYoFo91WWF51VbM-etVxRkPBeOLC_vtmPuaZC3X6JF4QU7dv6lt1mGoxiWyofQQB4';
const BASE_URL = 'https://platform.8xcrm.com';
const LEADS_URL = `${BASE_URL}/api/v4/leads/leads`;
const TIMELINE_URL = `${BASE_URL}/api/v2/global/timeline`;
const headers = { 'Authorization': TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json' };

const SUPABASE_URL = 'https://mvdjynrjgsnjkytokbmo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZGp5bnJqZ3Nuamt5dG9rYm1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1OTkyNiwiZXhwIjoyMDg5OTM1OTI2fQ.fIpmMMwRQy-BtKWRqI7mz9dczm9Egqp2gve5vCj7QW4';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DATA_DIR = path.join(process.cwd(), 'scripts', '8x-data');
const interests = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'interests.json')));
const userMapping = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'user-id-mapping.json')));
const usersData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
const existingLeads = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leads-final.json')));
const existingIds = new Set(existingLeads.map(l => l.id));

const SOURCE_MAP = { 'Hotline': 'google_ads', 'Google Ads': 'google_ads', 'Facebook Campaign': 'facebook', 'Platform Website': 'website', 'Employee Referral': 'referral', 'Web Form': 'google_ads', 'Tiktok': 'tiktok', 'Direct': 'walk_in', 'SMS Campaign': 'other', 'Customer Event': 'other', 'Phieg': 'facebook' };
const RATING_MAP = { 83: 'hot', 84: 'warm', 82: 'cold', 85: 'cold' };
const ACTIVITY_TYPE_MAP = { 2: 'call', 3: 'call', 5: 'call', 6: 'whatsapp', 7: 'call', 9: 'meeting', 11: 'meeting', 12: 'meeting', 13: 'note', 15: 'note', 16: 'note', 17: 'whatsapp', 18: 'meeting' };

function getUserName(id) { return usersData[String(id)]?.name || null; }
function getUserUUID(id) { return userMapping[String(id)] || null; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n========================================');
  console.log('  Pull New Leads + Timelines');
  console.log('========================================\n');

  // 1. Pull ALL leads from old CRM
  console.log('  Pulling leads from old CRM...');
  const allLeads = [];
  let start = 0;
  while (true) {
    const res = await fetch(LEADS_URL, { method: 'POST', headers, body: JSON.stringify({ start, length: 100 }) });
    const data = await res.json();
    const batch = data?.data?.data || [];
    if (batch.length === 0) break;
    allLeads.push(...batch);
    start += 100;
    process.stdout.write(`\r  Fetched: ${allLeads.length}`);
    if (batch.length < 100) break;
  }
  console.log(`\n  Total in old CRM: ${allLeads.length}`);

  // 2. Find new leads (not in our export)
  const newLeads = allLeads.filter(l => !existingIds.has(l.id));
  console.log(`  New leads: ${newLeads.length}`);

  if (newLeads.length === 0) { console.log('  Nothing to import!'); return; }

  // 3. Pull timelines for new leads
  console.log('\n  Pulling timelines...');
  for (let i = 0; i < newLeads.length; i++) {
    const lead = newLeads[i];
    try {
      const res = await fetch(TIMELINE_URL, {
        method: 'POST', headers,
        body: JSON.stringify({ timelinable_type: 'Modules\\Leads\\Lead', timelinable_id: lead.id, filter: 'all', page: 1 }),
      });
      if (res.ok) {
        const d = await res.json();
        lead.timeline = d?.data?.data || [];
      } else { lead.timeline = []; }
    } catch { lead.timeline = []; }
    process.stdout.write(`\r  Timelines: ${i + 1}/${newLeads.length}`);
    if (i % 10 === 0) await sleep(200); // Rate limit
  }
  console.log();

  // 4. Import contacts
  console.log('\n  Importing contacts...');
  let contactsInserted = 0;
  let activitiesInserted = 0;
  let tasksInserted = 0;
  const newContactMap = {};

  for (const lead of newLeads) {
    const ph = lead.phones?.[0];
    const phone = ph?.format_E164 || ph?.phone;
    if (!phone) continue;

    // Check duplicate in Supabase
    const digits = phone.replace(/\D/g, '').slice(-9);
    const { data: existing } = await supabase.from('contacts').select('id').ilike('phone', `%${digits}`).maybeSingle();
    if (existing) { newContactMap[lead.id] = existing.id; continue; }

    const interestNames = (lead.interests_ids || []).map(id => interests[String(id)]).filter(Boolean);
    const assigneeId = (lead.assignees_ids || [])[0];
    const sourceName = lead.source_name || '';

    const contact = {
      full_name: (lead.full_name || '').trim() || 'Unknown',
      phone,
      phone2: lead.phones?.[1]?.format_E164 || lead.phones?.[1]?.phone || null,
      email: null,
      company: lead.company || null,
      gender: lead.gender === 1 ? 'male' : lead.gender === 2 ? 'female' : null,
      nationality: lead.country_name || null,
      source: SOURCE_MAP[sourceName] || 'other',
      contact_type: 'lead',
      temperature: RATING_MAP[lead.rating_id] || 'warm',
      department: 'sales',
      campaign_name: interestNames[0] || 'Unknown',
      assigned_to_name: getUserName(assigneeId),
      notes: lead.description || null,
      contact_status: 'new',
      created_at: lead.created_at || new Date().toISOString(),
      updated_at: lead.updated_at || new Date().toISOString(),
      last_activity_at: lead.updated_at || lead.created_at || new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase.from('contacts').insert([contact]).select('id').single();
    if (error) { console.log(`\n  Error inserting ${lead.full_name}:`, error.message); continue; }
    newContactMap[lead.id] = inserted.id;
    contactsInserted++;

    // Import timeline
    for (const t of (lead.timeline || [])) {
      const obj = t.object || {};
      const notes = (obj.notes || obj.description || '').trim();
      if (!notes) continue;
      const cls = t.class || '';
      const createdBy = obj.created_by;

      if (cls.includes('Task')) {
        const { error: tErr } = await supabase.from('tasks').insert([{
          title: (obj.subject || notes).slice(0, 200),
          type: 'followup', priority: 'medium',
          status: obj.status_id === 3 ? 'done' : 'pending',
          contact_id: inserted.id,
          assigned_to: getUserUUID(createdBy),
          assigned_to_name_ar: getUserName(createdBy),
          assigned_to_name_en: getUserName(createdBy),
          dept: 'crm', notes,
          due_date: obj.due_date || obj.created_at,
          created_at: obj.created_at || new Date().toISOString(),
        }]);
        if (!tErr) tasksInserted++;
      } else {
        const { error: aErr } = await supabase.from('activities').insert([{
          type: ACTIVITY_TYPE_MAP[obj.activity_type_id] || 'note',
          notes, entity_type: 'contact', contact_id: inserted.id,
          user_id: getUserUUID(createdBy),
          user_name_ar: getUserName(createdBy),
          user_name_en: getUserName(createdBy),
          dept: 'crm', status: 'completed',
          created_at: obj.created_at || new Date().toISOString(),
        }]);
        if (!aErr) activitiesInserted++;
      }
    }
  }

  console.log('\n========================================');
  console.log(`  New contacts imported: ${contactsInserted}`);
  console.log(`  Activities imported: ${activitiesInserted}`);
  console.log(`  Tasks imported: ${tasksInserted}`);
  console.log(`  Duplicates skipped: ${newLeads.length - contactsInserted}`);
  console.log('========================================\n');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
