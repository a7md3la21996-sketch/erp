import { FEATURES } from '../config/features';
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';

const _teamCache = { key: null, names: null, ts: 0 };
let _userNameCache = { id: null, name: null };

async function applyRoleFilter(query, field, { role, userId, teamId } = {}) {
  if (role === 'sales_agent' && userId) {
    return query.eq(field, userId);
  } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
    const ids = await getTeamMemberIds(role, teamId);
    if (ids.length) return query.in(field, ids);
  }
  return query;
}

/**
 * Dashboard KPI service — fetches real-time stats from localStorage first,
 * then Supabase. Each function returns a safe fallback so the UI never breaks.
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

// ── localStorage helpers with per-session cache ──────────────────────────────
// Avoids re-parsing large JSON arrays on every call within the same page load.
const _cache = { contacts: null, opps: null, activities: null, _ts: 0 };
const CACHE_TTL = 30_000; // 30 seconds

function _invalidateIfStale() {
  if (Date.now() - _cache._ts > CACHE_TTL) {
    _cache.contacts = null;
    _cache.opps = null;
    _cache.activities = null;
  }
}

function getLocalContacts() { return []; }
function getLocalOpportunities() { return []; }
function getLocalActivities() { return []; }

// ── Contacts KPIs ────────────────────────────────────────────────────────────
export async function fetchContactStats({ role, userId, teamId } = {}) {
  try {
    // Apply role filter to contacts query. RLS handles team-level scope
    // for managers/leaders; we only add a narrow client-side filter for
    // sales_agent so the count reflects their own contacts. The previous
    // OR of assigned_to_names.cs.[...] for managers caused 500s on teams
    // with 6+ members.
    const applyContactRoleFilter = (q) => {
      if (role === 'sales_agent' && userId) {
        // After Phase 1 (single-assignment): filter by UUID — much faster
        // than jsonb @> and avoids the 500s seen with cs.[name] on heavy users.
        return q.eq('assigned_to', userId);
      }
      // Managers/leaders/director/admin/operations: rely on RLS.
      return q;
    };

    let q1 = supabase.from('contacts').select('*', { count: 'exact', head: true });
    q1 = applyContactRoleFilter(q1);
    const { count: totalLeads, error: e1 } = await q1;
    if (e1) throw e1;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let q2 = supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString());
    q2 = applyContactRoleFilter(q2);
    const { count: newLeadsThisMonth, error: e2 } = await q2;
    if (e2) throw e2;

    return { totalLeads: totalLeads || 0, newLeadsThisMonth: newLeadsThisMonth || 0 };
  } catch {
    return { totalLeads: 0, newLeadsThisMonth: 0 };
  }
}

// ── Opportunities KPIs ───────────────────────────────────────────────────────
export async function fetchOpportunityStats({ role, userId, teamId } = {}) {
  try {
    let query = supabase
      .from('opportunities')
      .select('id, stage, budget, created_at, stage_changed_at, assigned_to');
    query = await applyRoleFilter(query, 'assigned_to', { role, userId, teamId });
    const { data, error } = await query;
    if (error) throw error;
    if (data?.length) {
      return computeOppStats(data);
    }
  } catch { /* fallback */ }

  return { activeOpps: 0, closedDeals: 0, revenue: 0, closedThisMonth: 0, stageCounts: {}, totalOpps: 0, rawOpps: [] };
}

function computeOppStats(opps) {
  const activeOpps = opps.filter(o => !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage)).length;
  const closedDeals = opps.filter(o => o.stage === 'closed_won').length;
  const revenue = opps
    .filter(o => o.stage === 'closed_won')
    .reduce((sum, o) => sum + (parseFloat(o.deal_value || o.budget) || 0), 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const closedThisMonth = opps.filter(o =>
    o.stage === 'closed_won' && new Date(o.stage_changed_at || o.created_at) >= monthStart
  ).length;

  const stageCounts = {};
  opps.forEach(o => {
    stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1;
  });

  return { activeOpps, closedDeals, revenue, closedThisMonth, stageCounts, totalOpps: opps.length, rawOpps: opps };
}

// ── Tasks KPIs ───────────────────────────────────────────────────────────────
export async function fetchTaskStats({ role, userId, teamId } = {}) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let q1 = supabase.from('tasks').select('*', { count: 'exact', head: true })
      .gte('due_date', today.toISOString()).lte('due_date', todayEnd.toISOString()).neq('status', 'done');
    q1 = await applyRoleFilter(q1, 'assigned_to', { role, userId, teamId });
    const { count: dueToday, error: e1 } = await q1;
    if (e1) throw e1;

    let q2 = supabase.from('tasks').select('*', { count: 'exact', head: true })
      .lt('due_date', today.toISOString()).neq('status', 'done').neq('status', 'cancelled');
    q2 = await applyRoleFilter(q2, 'assigned_to', { role, userId, teamId });
    const { count: overdue, error: e2 } = await q2;
    if (e2) throw e2;

    return { dueToday: dueToday || 0, overdue: overdue || 0 };
  } catch {
    return { dueToday: 0, overdue: 0 };
  }
}

// ── Activities KPIs ──────────────────────────────────────────────────────────
export async function fetchActivityStats({ role, userId, teamId } = {}) {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    let query = supabase.from('activities').select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());
    query = await applyRoleFilter(query, 'user_id', { role, userId, teamId });
    const { count: thisWeek, error } = await query;
    if (error) throw error;

    return { activitiesThisWeek: thisWeek || 0 };
  } catch {
    return { activitiesThisWeek: 0 };
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
  } catch (err) { /* silent */;
    return { totalEmployees: 0 };
  }
}

// ── Pipeline data for chart ──────────────────────────────────────────────────
const STAGE_LABELS = {
  qualification:        { ar: 'تأهيل',          en: 'Qualification' },
  site_visit_scheduled: { ar: 'موعد معاينة',    en: 'Visit Scheduled' },
  site_visited:         { ar: 'تمت المعاينة',   en: 'Site Visited' },
  proposal:             { ar: 'عرض سعر',        en: 'Proposal' },
  negotiation:          { ar: 'تفاوض',          en: 'Negotiation' },
  reserved:             { ar: 'محجوز',          en: 'Reserved' },
  contracted:           { ar: 'تعاقد',          en: 'Contracted' },
  closed_won:           { ar: 'تم الإغلاق',     en: 'Closed Won' },
  closed_lost:          { ar: 'خسارة',          en: 'Closed Lost' },
};

export function buildPipelineData(stageCounts) {
  if (!stageCounts || Object.keys(stageCounts).length === 0) return null;
  const orderedStages = ['qualification', 'site_visit_scheduled', 'site_visited', 'proposal', 'negotiation', 'reserved', 'contracted', 'closed_won'];
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
export async function fetchAllDashboardData({ role, userId, teamId } = {}) {
  try {
    const rp = { role, userId, teamId };
    const [contacts, opportunities, tasks, activities, employees] = await Promise.all([
      fetchContactStats(rp),
      fetchOpportunityStats(rp),
      fetchTaskStats(rp),
      fetchActivityStats(rp),
      fetchEmployeeStats(),
    ]);
    return { contacts, opportunities, tasks, activities, employees };
  } catch (err) { /* silent */;
    return {
      contacts: { totalLeads: 0, newLeadsThisMonth: 0 },
      opportunities: { activeOpps: 0, closedDeals: 0, revenue: 0, closedThisMonth: 0, stageCounts: {}, totalOpps: 0, rawOpps: [] },
      tasks: { dueToday: 0, overdue: 0 },
      activities: { activitiesThisWeek: 0 },
      employees: { totalEmployees: 0 },
    };
  }
}
