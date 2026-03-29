#!/usr/bin/env node
/**
 * 8X CRM Data Puller
 * - v2 returns ALL leads in one call (no real pagination)
 * - v4 returns 5/page with phone numbers
 * - Timeline for leads with activities
 * Saves incrementally to avoid OOM
 */

import fs from 'fs';
import path from 'path';

// ============ CONFIG ============
const TOKEN = process.env.CRM_TOKEN || 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIyIiwianRpIjoiZWJiNzU3OTBiNjZhMzIxZDA3YTY4NWFkOGE5ZjBjYWI1ZDI0YmM5ZTE4OGNkNGNiMTNjMWU3MTMwMDhlZWU3Zjk1ZDAyNTlmYjc1OGU3MDgiLCJpYXQiOjE3NzQ3NDA0MDMsIm5iZiI6MTc3NDc0MDQwMywiZXhwIjoxNzc3MzMyNDAyLCJzdWIiOiIyIiwic2NvcGVzIjpbIioiXX0.vsfD4YQei1p5hUgaWaBzwRn6YBAll8vsQZfTRq3ahYa1628onyHYNjL_ojyLYsubmxlvdGvMYefSbiDJ9JiZs6A5EBx0iy6yAz8MbZ96H9MCYtNuLyjGAQdufwTu57i8DuRg359jK8hNWIM7QFR0lYvp6HTVR8G9QxPU6TH_PV86-bQKFwzty4E6n5cnAm8uC2nszGgd-88ktJWbVS0wfV1k7Xpm-iXuwS5QIBoZH1_sNEsYt-77RbgV-SpPv08CYoJvKPZawcxtIjP3kjtlcmRSFGwjNJgaMOA3QFBSy3UXY4MxdPE2fSFYOcTpSUuFrMoRymEWRs14h0k7BGNpav6uEbBbGEgh2tkwQhSkXwOttchcnnxTwNku-glnCMTJT_mrQo-9-ha2OWdCMC2h4cSSywVLnUdpNHG5duuhomtP9ARFvJOQf96fwuEoC--SiC8cYeUUxj_613brcUEdXOljqunQ_huMpOphmBat8qqBi6_DzeRFYj1JmBoXqu4xrDN8VmDyTUnUWfICLexUz_7gV9en0aWlUbwWptUrKw7rMdz0sSOTjBJbmh3j2DvM-3MWoTPiyaB_5qp98DegryoLGNmkTUUmZV6TZiCV2vRYoFo91WWF51VbM-etVxRkPBeOLC_vtmPuaZC3X6JF4QU7dv6lt1mGoxiWyofQQB4';

const BASE_URL = 'https://platform.8xcrm.com';
const LEADS_V2_URL = `${BASE_URL}/api/v2/leads/leads`;
const LEADS_V4_URL = `${BASE_URL}/api/v4/leads/leads`;
const TIMELINE_URL = `${BASE_URL}/api/v2/global/timeline`;
const V4_PER_PAGE = 5;
const CONCURRENT = 5;
const TIMELINE_CONCURRENT = 10;
const OUTPUT_DIR = path.join(process.cwd(), 'scripts', '8x-data');

const headers = {
  'Authorization': TOKEN,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function fetchJSON(url, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.status === 429) {
        console.log(`\n  Rate limited, waiting ${(i + 1) * 5}s...`);
        await sleep((i + 1) * 5000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(2000);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============ STEP 1: Pull all leads via v2 (single call) ============
async function pullAllLeadsV2() {
  console.log('\n========================================');
  console.log('  STEP 1: Pulling all leads (v2 - single call)');
  console.log('========================================\n');

  const result = await fetchJSON(LEADS_V2_URL, { page: 1, per_page: 100 });
  const leads = result.data.data;
  console.log(`  Got ${leads.length} leads\n`);

  // Save immediately
  ensureDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leads-v2.json'), JSON.stringify(leads));
  console.log('  Saved leads-v2.json\n');

  return leads;
}

// ============ STEP 2: Pull phones via v4 (5/page) ============
async function pullPhones(total) {
  console.log('========================================');
  console.log('  STEP 2: Pulling phones (v4, 5/page)');
  console.log('========================================\n');

  const totalPages = Math.ceil(total / V4_PER_PAGE);
  console.log(`  ${total} leads / ${V4_PER_PAGE} per page = ${totalPages} pages\n`);

  ensureDir();
  const phonesMap = {};
  let completed = 0;

  for (let batchStart = 1; batchStart <= totalPages; batchStart += CONCURRENT) {
    const pages = [];
    for (let p = batchStart; p < batchStart + CONCURRENT && p <= totalPages; p++) {
      pages.push(p);
    }

    const results = await Promise.all(
      pages.map(page => fetchJSON(LEADS_V4_URL, { page, per_page: V4_PER_PAGE }))
    );

    for (const result of results) {
      if (result?.data?.data) {
        for (const lead of result.data.data) {
          if (lead.phones?.length > 0) {
            phonesMap[lead.id] = lead.phones.map(p => ({
              phone: p.phone,
              country_code: p.country_code,
              format_E164: p.format_E164,
              format_international: p.format_international,
              has_whatsapp: p.has_whatsapp,
              type: p.type,
            }));
          }
        }
      }
    }

    completed += pages.length;
    const pct = Math.round((completed / totalPages) * 100);
    process.stdout.write(`\r  Pages: ${completed}/${totalPages} (${pct}%) — Phones: ${Object.keys(phonesMap).length}`);

    // Save progress every 500 pages
    if (completed % 500 === 0) {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'phones-progress.json'), JSON.stringify(phonesMap));
    }
  }

  // Final save
  fs.writeFileSync(path.join(OUTPUT_DIR, 'phones.json'), JSON.stringify(phonesMap));
  console.log(`\n  Done! ${Object.keys(phonesMap).length} leads with phones\n`);

  return phonesMap;
}

// ============ STEP 3: Pull timelines ============
async function pullTimelines(leads) {
  const leadsWithActivity = leads.filter(l => l.last_activity_id != null);

  console.log('========================================');
  console.log('  STEP 3: Pulling timelines');
  console.log('========================================\n');
  console.log(`  Leads with activities: ${leadsWithActivity.length}/${leads.length}\n`);

  if (leadsWithActivity.length === 0) {
    console.log('  Skipping.\n');
    return {};
  }

  ensureDir();
  const timelines = {};
  let completed = 0;

  for (let i = 0; i < leadsWithActivity.length; i += TIMELINE_CONCURRENT) {
    const batch = leadsWithActivity.slice(i, i + TIMELINE_CONCURRENT);

    const results = await Promise.all(
      batch.map(async (lead) => {
        const items = [];
        let page = 1, lastPage = 1;
        do {
          const r = await fetchJSON(TIMELINE_URL, {
            timelinable_type: 'Modules\\Leads\\Lead',
            timelinable_id: lead.id,
            filter: 'all',
            page,
          });
          if (r?.data?.data) {
            items.push(...r.data.data);
            lastPage = r.data.last_page;
          }
          page++;
        } while (page <= lastPage);
        return { id: lead.id, items };
      })
    );

    for (const { id, items } of results) {
      if (items.length > 0) timelines[id] = items;
    }

    completed += batch.length;
    const pct = Math.round((completed / leadsWithActivity.length) * 100);
    process.stdout.write(`\r  Timelines: ${completed}/${leadsWithActivity.length} (${pct}%) — With data: ${Object.keys(timelines).length}`);

    // Save progress every 200
    if (completed % 200 === 0) {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'timelines-progress.json'), JSON.stringify(timelines));
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'timelines.json'), JSON.stringify(timelines));
  console.log(`\n  Done! ${Object.keys(timelines).length} leads with timeline data\n`);

  return timelines;
}

// ============ STEP 4: Merge & export ============
function mergeAndExport(leads, phonesMap, timelines) {
  console.log('========================================');
  console.log('  STEP 4: Merging & Exporting');
  console.log('========================================\n');

  ensureDir();

  // Merge phones into leads
  for (const lead of leads) {
    lead.phones = phonesMap[lead.id] || [];
    lead.timeline = timelines[lead.id] || [];
  }

  // Save complete merged data
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leads-complete.json'), JSON.stringify(leads));
  console.log(`  leads-complete.json — ${leads.length} records`);

  // CSV export
  const BOM = '\uFEFF';
  const csvHeader = 'ID,Full Name,Phone,Phone International,WhatsApp,Status ID,Source ID,Rating ID,Interests,Assignees,Created At,Activities Count\n';
  const csvRows = leads.map(l => {
    const phone = l.phones[0]?.phone || '';
    const phoneIntl = l.phones[0]?.format_E164 || '';
    const whatsapp = l.phones[0]?.has_whatsapp ? 'Yes' : 'No';
    const name = (l.full_name || '').replace(/"/g, '""');
    const interests = (l.interests_ids || []).join(';');
    const assignees = (l.assignees_ids || []).join(';');
    const actCount = l.timeline.length;
    return `${l.id},"${name}","${phone}","${phoneIntl}",${whatsapp},${l.status_id || ''},${l.source_id || ''},${l.rating_id || ''},"${interests}","${assignees}",${l.created_at || ''},${actCount}`;
  }).join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leads-complete.csv'), BOM + csvHeader + csvRows);
  console.log('  leads-complete.csv');

  // Stats
  const withPhones = leads.filter(l => l.phones.length > 0).length;
  const withTimeline = leads.filter(l => l.timeline.length > 0).length;
  const totalActions = leads.reduce((s, l) => s + l.timeline.length, 0);

  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`  Total leads:           ${leads.length}`);
  console.log(`  With phones:           ${withPhones}`);
  console.log(`  With timeline/actions: ${withTimeline}`);
  console.log(`  Total actions:         ${totalActions}`);
  console.log(`  Output:                ${OUTPUT_DIR}/`);
  console.log('========================================\n');
}

// ============ MAIN ============
async function main() {
  console.log('\n8X CRM Data Puller v2\n');
  const startTime = Date.now();

  const leads = await pullAllLeadsV2();
  const phonesMap = await pullPhones(leads.length);
  const timelines = await pullTimelines(leads);
  mergeAndExport(leads, phonesMap, timelines);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`Total time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s\n`);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
