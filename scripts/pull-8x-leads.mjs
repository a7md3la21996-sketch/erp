#!/usr/bin/env node
/**
 * 8X CRM Data Puller v3
 * Uses DataTables pagination: start/length (not page/per_page)
 * v4 with start/length returns phones + supports 100/request
 */

import fs from 'fs';
import path from 'path';

// ============ CONFIG ============
const TOKEN = process.env.CRM_TOKEN || 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIyIiwianRpIjoiZWJiNzU3OTBiNjZhMzIxZDA3YTY4NWFkOGE5ZjBjYWI1ZDI0YmM5ZTE4OGNkNGNiMTNjMWU3MTMwMDhlZWU3Zjk1ZDAyNTlmYjc1OGU3MDgiLCJpYXQiOjE3NzQ3NDA0MDMsIm5iZiI6MTc3NDc0MDQwMywiZXhwIjoxNzc3MzMyNDAyLCJzdWIiOiIyIiwic2NvcGVzIjpbIioiXX0.vsfD4YQei1p5hUgaWaBzwRn6YBAll8vsQZfTRq3ahYa1628onyHYNjL_ojyLYsubmxlvdGvMYefSbiDJ9JiZs6A5EBx0iy6yAz8MbZ96H9MCYtNuLyjGAQdufwTu57i8DuRg359jK8hNWIM7QFR0lYvp6HTVR8G9QxPU6TH_PV86-bQKFwzty4E6n5cnAm8uC2nszGgd-88ktJWbVS0wfV1k7Xpm-iXuwS5QIBoZH1_sNEsYt-77RbgV-SpPv08CYoJvKPZawcxtIjP3kjtlcmRSFGwjNJgaMOA3QFBSy3UXY4MxdPE2fSFYOcTpSUuFrMoRymEWRs14h0k7BGNpav6uEbBbGEgh2tkwQhSkXwOttchcnnxTwNku-glnCMTJT_mrQo-9-ha2OWdCMC2h4cSSywVLnUdpNHG5duuhomtP9ARFvJOQf96fwuEoC--SiC8cYeUUxj_613brcUEdXOljqunQ_huMpOphmBat8qqBi6_DzeRFYj1JmBoXqu4xrDN8VmDyTUnUWfICLexUz_7gV9en0aWlUbwWptUrKw7rMdz0sSOTjBJbmh3j2DvM-3MWoTPiyaB_5qp98DegryoLGNmkTUUmZV6TZiCV2vRYoFo91WWF51VbM-etVxRkPBeOLC_vtmPuaZC3X6JF4QU7dv6lt1mGoxiWyofQQB4';

const BASE_URL = 'https://platform.8xcrm.com';
const LEADS_V4_URL = `${BASE_URL}/api/v4/leads/leads`;
const TIMELINE_URL = `${BASE_URL}/api/v2/global/timeline`;
const BATCH_SIZE = 100;
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

// ============ STEP 1: Pull all leads with phones (v4 + start/length) ============
async function pullAllLeads() {
  console.log('\n========================================');
  console.log('  STEP 1: Pulling all leads + phones (v4)');
  console.log('========================================\n');

  // Get total count
  const first = await fetchJSON(LEADS_V4_URL, { start: 0, length: 1 });
  const total = first.data.recordsTotal;
  const totalBatches = Math.ceil(total / BATCH_SIZE);
  console.log(`  Total: ${total} leads, ${totalBatches} batches of ${BATCH_SIZE}\n`);

  ensureDir();
  const allLeads = [];
  let completed = 0;
  let phonesCount = 0;

  for (let batchStart = 0; batchStart < totalBatches; batchStart += CONCURRENT) {
    const offsets = [];
    for (let b = batchStart; b < batchStart + CONCURRENT && b < totalBatches; b++) {
      offsets.push(b * BATCH_SIZE);
    }

    const results = await Promise.all(
      offsets.map(start => fetchJSON(LEADS_V4_URL, { start, length: BATCH_SIZE }))
    );

    for (const result of results) {
      if (result?.data?.data) {
        for (const lead of result.data.data) {
          if (lead.phones?.length > 0) phonesCount++;
          allLeads.push(lead);
        }
      }
    }

    completed += offsets.length;
    const pct = Math.round((completed / totalBatches) * 100);
    process.stdout.write(`\r  Batches: ${completed}/${totalBatches} (${pct}%) — Leads: ${allLeads.length} — With phones: ${phonesCount}`);
  }

  // Save leads
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leads.json'), JSON.stringify(allLeads));
  console.log(`\n\n  Saved ${allLeads.length} leads (${phonesCount} with phones)\n`);

  return allLeads;
}

// ============ STEP 2: Pull timelines ============
async function pullTimelines(leads) {
  const leadsWithActivity = leads.filter(l => l.last_activity_id != null);

  console.log('========================================');
  console.log('  STEP 2: Pulling timelines');
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

    // Save progress
    if (completed % 500 === 0) {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'timelines-progress.json'), JSON.stringify(timelines));
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'timelines.json'), JSON.stringify(timelines));
  console.log(`\n  Saved ${Object.keys(timelines).length} timelines\n`);

  return timelines;
}

// ============ STEP 3: Export ============
function exportData(leads, timelines) {
  console.log('========================================');
  console.log('  STEP 3: Exporting');
  console.log('========================================\n');

  // Attach timelines to leads
  for (const lead of leads) {
    lead.timeline = timelines[lead.id] || [];
  }

  // Save complete data
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leads-complete.json'), JSON.stringify(leads));

  // CSV
  const BOM = '\uFEFF';
  const h = 'ID,Full Name,Phone,Phone Intl,WhatsApp,Country,City,Status ID,Source ID,Rating ID,Interests,Assignees,Created At,Activities Count\n';
  const rows = leads.map(l => {
    const ph = l.phones?.[0] || {};
    const name = (l.full_name || '').replace(/"/g, '""');
    return [
      l.id,
      `"${name}"`,
      `"${ph.phone || ''}"`,
      `"${ph.format_E164 || ''}"`,
      ph.has_whatsapp ? 'Yes' : 'No',
      `"${l.country_name || ''}"`,
      `"${l.city_name || ''}"`,
      l.status_id || '',
      l.source_id || '',
      l.rating_id || '',
      `"${(l.interests_ids || []).join(';')}"`,
      `"${(l.assignees_ids || []).join(';')}"`,
      l.created_at || '',
      l.timeline.length,
    ].join(',');
  }).join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'leads-complete.csv'), BOM + h + rows);

  // Stats
  const withPhones = leads.filter(l => l.phones?.length > 0).length;
  const withTimeline = leads.filter(l => l.timeline.length > 0).length;
  const totalActions = leads.reduce((s, l) => s + l.timeline.length, 0);

  console.log('  Files saved:');
  console.log(`    leads.json          — ${leads.length} leads`);
  console.log(`    timelines.json      — ${Object.keys(timelines).length} entries`);
  console.log(`    leads-complete.json — merged`);
  console.log(`    leads-complete.csv  — for Excel`);

  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`  Total leads:           ${leads.length}`);
  console.log(`  With phones:           ${withPhones}`);
  console.log(`  With timeline:         ${withTimeline}`);
  console.log(`  Total actions:         ${totalActions}`);
  console.log(`  Output:                ${OUTPUT_DIR}/`);
  console.log('========================================\n');
}

// ============ MAIN ============
async function main() {
  console.log('\n8X CRM Data Puller v3\n');
  const startTime = Date.now();

  const leads = await pullAllLeads();
  const timelines = await pullTimelines(leads);
  exportData(leads, timelines);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`Total time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s\n`);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
