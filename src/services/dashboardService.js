import supabase from '../lib/supabase';

/**
 * Dashboard KPI service — fetches real-time stats from Supabase.
 * Each function returns a safe fallback on error so the UI never breaks.
 */

// ── Date range helpers ────────────────────────────────────────────────────────
export function getDateRange(rangeKey) {
  const now = new Date();
  const start = new Date();
  switch (rangeKey) {
    case 'this_week':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'this_month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last_3_months':
      start.setMonth(now.getMonth() - 3);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'this_year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
  }
  return { start, end: now };
}

// ── Contacts KPIs ────────────────────────────────────────────────────────────
export async function fetchContactStats() {
  try {
    // Total contacts
    const { count: totalLeads, error: e1 } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });
    if (e1) throw e1;

    // New contacts this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: newLeadsThisMonth, error: e2 } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString());
    if (e2) throw e2;

    return { totalLeads: totalLeads || 0, newLeadsThisMonth: newLeadsThisMonth || 0 };
  } catch {
    return null; // signal to caller to keep mock
  }
}

// ── Opportunities KPIs ───────────────────────────────────────────────────────
export async function fetchOpportunityStats() {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, stage, budget, created_at');
    if (error) throw error;

    const opps = data || [];
    const activeOpps = opps.filter(o => !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage)).length;
    const closedDeals = opps.filter(o => o.stage === 'closed_won').length;
    const revenue = opps
      .filter(o => o.stage === 'closed_won')
      .reduce((sum, o) => sum + (parseFloat(o.budget) || 0), 0);

    // New closed deals this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const closedThisMonth = opps.filter(o =>
      o.stage === 'closed_won' && new Date(o.created_at) >= monthStart
    ).length;

    // Pipeline: group by stage
    const stageCounts = {};
    opps.forEach(o => {
      stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1;
    });

    return { activeOpps, closedDeals, revenue, closedThisMonth, stageCounts, totalOpps: opps.length, rawOpps: opps };
  } catch {
    return null;
  }
}

// ── Tasks KPIs ───────────────────────────────────────────────────────────────
export async function fetchTaskStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Tasks due today
    const { count: dueToday, error: e1 } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .gte('due_date', today.toISOString())
      .lte('due_date', todayEnd.toISOString())
      .neq('status', 'done');
    if (e1) throw e1;

    // Overdue tasks
    const { count: overdue, error: e2 } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', today.toISOString())
      .neq('status', 'done')
      .neq('status', 'cancelled');
    if (e2) throw e2;

    return { dueToday: dueToday || 0, overdue: overdue || 0 };
  } catch {
    return null;
  }
}

// ── Activities KPIs ──────────────────────────────────────────────────────────
export async function fetchActivityStats() {
  try {
    // Activities this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const { count: thisWeek, error } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());
    if (error) throw error;

    return { activitiesThisWeek: thisWeek || 0 };
  } catch {
    return null;
  }
}

// ── Employees KPIs ───────────────────────────────────────────────────────────
export async function fetchEmployeeStats() {
  try {
    const { count: total, error } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;

    return { totalEmployees: total || 0 };
  } catch {
    return null;
  }
}

// ── Pipeline data for chart ──────────────────────────────────────────────────
const STAGE_LABELS = {
  new:          { ar: 'جديد',    en: 'New' },
  lead:         { ar: 'ليد',     en: 'Lead' },
  contacted:    { ar: 'تواصل',   en: 'Contacted' },
  interested:   { ar: 'مهتم',    en: 'Interested' },
  site_visit:   { ar: 'معاينة',  en: 'Site Visit' },
  negotiation:  { ar: 'تفاوض',   en: 'Negotiation' },
  proposal:     { ar: 'عرض سعر', en: 'Proposal' },
  closed_won:   { ar: 'مغلق ربح',en: 'Closed Won' },
  closed_lost:  { ar: 'مغلق خسر',en: 'Closed Lost' },
};

export function buildPipelineData(stageCounts) {
  if (!stageCounts) return null;
  // Exclude closed_lost from pipeline visual, keep meaningful stages
  const orderedStages = ['new', 'lead', 'contacted', 'interested', 'site_visit', 'negotiation', 'proposal', 'closed_won'];
  return orderedStages
    .filter(s => stageCounts[s] > 0)
    .map(s => ({
      stage_key: s,
      stage_ar: STAGE_LABELS[s]?.ar || s,
      stage_en: STAGE_LABELS[s]?.en || s,
      count: stageCounts[s] || 0,
    }));
}

// ── Revenue trend from opportunities ─────────────────────────────────────────
const MONTH_LABELS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LABELS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export function buildRevenueTrend(rawOpps, dateRange) {
  if (!rawOpps?.length) return null;
  const { start, end } = dateRange || {};
  const won = rawOpps.filter(o => {
    if (o.stage !== 'closed_won') return false;
    if (start && new Date(o.created_at) < start) return false;
    if (end && new Date(o.created_at) > end) return false;
    return true;
  });
  if (!won.length) return null;
  const map = {};
  won.forEach(o => {
    const d = new Date(o.created_at);
    const key = d.getFullYear() + '-' + String(d.getMonth()).padStart(2, '0');
    map[key] = (map[key] || 0) + (parseFloat(o.budget) || 0);
  });
  const sortedKeys = Object.keys(map).sort();
  if (sortedKeys.length < 1) return null;
  return sortedKeys.map(k => {
    const m = parseInt(k.split('-')[1], 10);
    return { label_ar: MONTH_LABELS_AR[m], label_en: MONTH_LABELS_EN[m], value: map[k] };
  });
}

export function buildTopSellers(rawOpps, dateRange) {
  if (!rawOpps?.length) return null;
  const { start, end } = dateRange || {};
  const won = rawOpps.filter(o => {
    if (o.stage !== 'closed_won') return false;
    if (start && new Date(o.created_at) < start) return false;
    if (end && new Date(o.created_at) > end) return false;
    return true;
  });
  if (!won.length) return null;
  // Group by assigned_to (agent)
  // We don't have agent names here, just IDs — return IDs & amounts
  const map = {};
  won.forEach(o => {
    const key = o.assigned_to || 'unknown';
    if (!map[key]) map[key] = { id: key, revenue: 0, count: 0 };
    map[key].revenue += parseFloat(o.budget) || 0;
    map[key].count += 1;
  });
  const arr = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxRev = arr[0]?.revenue || 1;
  return arr.map(a => ({ ...a, pct: Math.round((a.revenue / maxRev) * 100) }));
}

export function filterStatsByRange(rawOpps, dateRange) {
  if (!rawOpps?.length) return null;
  const { start, end } = dateRange || {};
  const filtered = rawOpps.filter(o => {
    if (start && new Date(o.created_at) < start) return false;
    if (end && new Date(o.created_at) > end) return false;
    return true;
  });
  const activeOpps = filtered.filter(o => !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage)).length;
  const closedDeals = filtered.filter(o => o.stage === 'closed_won').length;
  const revenue = filtered.filter(o => o.stage === 'closed_won').reduce((s, o) => s + (parseFloat(o.budget) || 0), 0);
  const stageCounts = {};
  filtered.forEach(o => { stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1; });
  return { activeOpps, closedDeals, revenue, stageCounts, totalOpps: filtered.length };
}

// ── Fetch all dashboard data in parallel ─────────────────────────────────────
export async function fetchAllDashboardData() {
  try {
    const [contacts, opportunities, tasks, activities, employees] = await Promise.all([
      fetchContactStats(),
      fetchOpportunityStats(),
      fetchTaskStats(),
      fetchActivityStats(),
      fetchEmployeeStats(),
    ]);
    return { contacts, opportunities, tasks, activities, employees };
  } catch {
    return { contacts: null, opportunities: null, tasks: null, activities: null, employees: null };
  }
}
