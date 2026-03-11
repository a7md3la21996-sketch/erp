import supabase from '../lib/supabase';

/**
 * Dashboard KPI service — fetches real-time stats from Supabase.
 * Each function returns a safe fallback on error so the UI never breaks.
 */

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
      .select('id, stage, deal_value, created_at');
    if (error) throw error;

    const opps = data || [];
    const activeOpps = opps.filter(o => !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage)).length;
    const closedDeals = opps.filter(o => o.stage === 'closed_won').length;
    const revenue = opps
      .filter(o => o.stage === 'closed_won')
      .reduce((sum, o) => sum + (parseFloat(o.deal_value) || 0), 0);

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

    return { activeOpps, closedDeals, revenue, closedThisMonth, stageCounts, totalOpps: opps.length };
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
      stage_ar: STAGE_LABELS[s]?.ar || s,
      stage_en: STAGE_LABELS[s]?.en || s,
      count: stageCounts[s] || 0,
    }));
}

// ── Fetch all dashboard data in parallel ─────────────────────────────────────
export async function fetchAllDashboardData() {
  const [contacts, opportunities, tasks, activities, employees] = await Promise.all([
    fetchContactStats(),
    fetchOpportunityStats(),
    fetchTaskStats(),
    fetchActivityStats(),
    fetchEmployeeStats(),
  ]);
  return { contacts, opportunities, tasks, activities, employees };
}
