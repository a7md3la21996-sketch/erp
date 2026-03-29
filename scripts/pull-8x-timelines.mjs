#!/usr/bin/env node
/**
 * 8X CRM Timeline Puller
 * Pulls timelines for all leads with activities
 * Resumes from progress file if interrupted
 * Concurrency: 25 (safe with 250 rate limit)
 */

import fs from 'fs';
import path from 'path';

const TOKEN = process.env.CRM_TOKEN || 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIyIiwianRpIjoiZWJiNzU3OTBiNjZhMzIxZDA3YTY4NWFkOGE5ZjBjYWI1ZDI0YmM5ZTE4OGNkNGNiMTNjMWU3MTMwMDhlZWU3Zjk1ZDAyNTlmYjc1OGU3MDgiLCJpYXQiOjE3NzQ3NDA0MDMsIm5iZiI6MTc3NDc0MDQwMywiZXhwIjoxNzc3MzMyNDAyLCJzdWIiOiIyIiwic2NvcGVzIjpbIioiXX0.vsfD4YQei1p5hUgaWaBzwRn6YBAll8vsQZfTRq3ahYa1628onyHYNjL_ojyLYsubmxlvdGvMYefSbiDJ9JiZs6A5EBx0iy6yAz8MbZ96H9MCYtNuLyjGAQdufwTu57i8DuRg359jK8hNWIM7QFR0lYvp6HTVR8G9QxPU6TH_PV86-bQKFwzty4E6n5cnAm8uC2nszGgd-88ktJWbVS0wfV1k7Xpm-iXuwS5QIBoZH1_sNEsYt-77RbgV-SpPv08CYoJvKPZawcxtIjP3kjtlcmRSFGwjNJgaMOA3QFBSy3UXY4MxdPE2fSFYOcTpSUuFrMoRymEWRs14h0k7BGNpav6uEbBbGEgh2tkwQhSkXwOttchcnnxTwNku-glnCMTJT_mrQo-9-ha2OWdCMC2h4cSSywVLnUdpNHG5duuhomtP9ARFvJOQf96fwuEoC--SiC8cYeUUxj_613brcUEdXOljqunQ_huMpOphmBat8qqBi6_DzeRFYj1JmBoXqu4xrDN8VmDyTUnUWfICLexUz_7gV9en0aWlUbwWptUrKw7rMdz0sSOTjBJbmh3j2DvM-3MWoTPiyaB_5qp98DegryoLGNmkTUUmZV6TZiCV2vRYoFo91WWF51VbM-etVxRkPBeOLC_vtmPuaZC3X6JF4QU7dv6lt1mGoxiWyofQQB4';

const TIMELINE_URL = 'https://platform.8xcrm.com/api/v2/global/timeline';
const CONCURRENT = 50;
const DATA_DIR = path.join(process.cwd(), 'scripts', '8x-data');
const PROGRESS_FILE = path.join(DATA_DIR, 'timelines-progress.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'timelines.json');

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
        const wait = (i + 1) * 3000;
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) return null;
      await sleep(1000);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\nTimeline Puller — Loading lead IDs...\n');

  // Get lead IDs with activities from v2 data
  const v2Data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leads-v2.json'), 'utf8'));
  const leadIds = v2Data.filter(l => l.last_activity_id != null).map(l => l.id);
  console.log(`  Leads with activities: ${leadIds.length}\n`);

  // Load progress (resume support)
  let timelines = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    timelines = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`  Resuming from progress: ${Object.keys(timelines).length} already done\n`);
  }

  // Filter out already-done leads
  const doneSet = new Set(Object.keys(timelines).map(Number));
  const remaining = leadIds.filter(id => !doneSet.has(id));
  console.log(`  Remaining: ${remaining.length}\n`);

  const startTime = Date.now();
  let completed = 0;
  let totalItems = Object.values(timelines).reduce((s, t) => s + t.length, 0);

  for (let i = 0; i < remaining.length; i += CONCURRENT) {
    const batch = remaining.slice(i, i + CONCURRENT);

    const results = await Promise.all(
      batch.map(async (leadId) => {
        const items = [];
        let page = 1, lastPage = 1;
        do {
          const r = await fetchJSON(TIMELINE_URL, {
            timelinable_type: 'Modules\\Leads\\Lead',
            timelinable_id: leadId,
            filter: 'all',
            page,
          });
          if (r?.data?.data) {
            items.push(...r.data.data);
            lastPage = r.data.last_page;
          }
          page++;
        } while (page <= lastPage);
        return { id: leadId, items };
      })
    );

    for (const { id, items } of results) {
      if (items.length > 0) {
        timelines[id] = items;
        totalItems += items.length;
      }
    }

    completed += batch.length;
    const total = remaining.length;
    const pct = Math.round((completed / total) * 100);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const eta = Math.round((total - completed) / rate);
    const etaMin = Math.floor(eta / 60);
    const etaSec = eta % 60;

    process.stdout.write(`\r  ${completed}/${total} (${pct}%) — ${Object.keys(timelines).length} with data — ${totalItems} items — ETA: ${etaMin}m${etaSec}s   `);

    // Save progress every 250 leads
    if (completed % 250 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(timelines));
    }
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(timelines));
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(timelines));

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n  Done! ${Object.keys(timelines).length} leads with timelines, ${totalItems} total items`);
  console.log(`  Time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s\n`);
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
