import { syncToSupabase } from '../utils/supabaseSync';
/**
 * Heatmap Data Service
 * Aggregates activity data into {date, count} arrays for heatmap calendars.
 * Reads from localStorage keys used across the platform.
 */

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

/** Generate mock data for demo when real data is sparse */
function generateMockData(months) {
  const data = [];
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);

  const d = new Date(start);
  while (d <= now) {
    const rand = Math.random();
    let count = 0;
    if (rand > 0.3) count = Math.floor(Math.random() * 4) + 1;
    if (rand > 0.7) count = Math.floor(Math.random() * 6) + 3;
    if (rand > 0.92) count = Math.floor(Math.random() * 8) + 8;
    // weekends lighter
    const dow = d.getDay();
    if (dow === 5 || dow === 6) count = Math.max(0, count - 2);

    if (count > 0) {
      data.push({
        date: d.toISOString().slice(0, 10),
        count,
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return data;
}

function aggregateByDate(items, dateField, months) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setHours(0, 0, 0, 0);

  const counts = {};
  items.forEach(item => {
    const raw = item[dateField];
    if (!raw) return;
    const d = new Date(raw);
    if (d < cutoff) return;
    const key = d.toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

/**
 * All platform activities
 */
export function getActivityHeatmap(months = 6) {
  const activities = loadJSON('platform_activities');
  const result = aggregateByDate(activities, 'created_at', months);
  if (result.length < 10) return generateMockData(months);
  return result;
}

/**
 * Activities filtered to type=call
 */
export function getCallsHeatmap(months = 6) {
  const activities = loadJSON('platform_activities');
  const calls = activities.filter(a => a.type === 'call');
  const result = aggregateByDate(calls, 'created_at', months);
  if (result.length < 5) return generateMockData(months).map(d => ({ ...d, count: Math.max(1, Math.floor(d.count * 0.6)) }));
  return result;
}

/**
 * Won deals
 */
export function getDealsHeatmap(months = 6) {
  const deals = loadJSON('platform_won_deals');
  const result = aggregateByDate(deals, 'created_at', months);
  if (result.length < 5) return generateMockData(months).map(d => ({ ...d, count: Math.max(1, Math.floor(d.count * 0.3)) }));
  return result;
}

/**
 * Opportunities created
 */
export function getOpportunitiesHeatmap(months = 6) {
  const opps = loadJSON('platform_opportunities');
  const result = aggregateByDate(opps, 'created_at', months);
  if (result.length < 5) return generateMockData(months).map(d => ({ ...d, count: Math.max(1, Math.floor(d.count * 0.5)) }));
  return result;
}

/**
 * Contacts created
 */
export function getContactsHeatmap(months = 6) {
  const contacts = loadJSON('platform_contacts');
  const result = aggregateByDate(contacts, 'created_at', months);
  if (result.length < 5) return generateMockData(months).map(d => ({ ...d, count: Math.max(1, Math.floor(d.count * 0.4)) }));
  return result;
}

/**
 * Compute summary stats from heatmap data
 */
export function computeHeatmapStats(data) {
  if (!data || data.length === 0) {
    return { total: 0, busiestDay: null, busiestWeek: null, dailyAvg: 0, streak: 0 };
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const busiestDay = sorted[0] || null;

  // daily average
  const dateSet = new Set(data.map(d => d.date));
  // span from min to max date
  const dates = data.map(d => new Date(d.date)).sort((a, b) => a - b);
  const spanDays = dates.length > 1
    ? Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) + 1
    : 1;
  const dailyAvg = +(total / spanDays).toFixed(1);

  // busiest week (ISO week)
  const weekCounts = {};
  data.forEach(d => {
    const dt = new Date(d.date);
    const jan1 = new Date(dt.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    const key = dt.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
    weekCounts[key] = (weekCounts[key] || 0) + d.count;
  });
  const busiestWeek = Object.entries(weekCounts).sort((a, b) => b[1] - a[1])[0] || null;

  // streak: consecutive days with activity
  const allDates = new Set(data.filter(d => d.count > 0).map(d => d.date));
  let maxStreak = 0;
  let currentStreak = 0;
  const today = new Date();
  const checkDate = new Date(dates[0]);
  while (checkDate <= today) {
    const key = checkDate.toISOString().slice(0, 10);
    if (allDates.has(key)) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return {
    total,
    busiestDay,
    busiestWeek: busiestWeek ? { week: busiestWeek[0], count: busiestWeek[1] } : null,
    dailyAvg,
    streak: maxStreak,
  };
}
