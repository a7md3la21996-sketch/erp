import { FEATURES } from '../config/features';
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';
import { getWonDeals } from './dealsService';

const _teamCache = { key: null, names: null, ts: 0 };
let _userNameCache = { id: null, name: null };

// Sentinel uuid no real row can match — used to force an empty result when a
// scoped role can't resolve a team. Returning the raw query here would
// silently surface ALL rows (fail-open), which was the May 17 incident:
// a freshly-created team_leader with no team_id saw every agent's data.
const DENY_SENTINEL = '00000000-0000-0000-0000-000000000000';

async function applyRoleFilter(query, field, { role, userId, teamId } = {}) {
  if (role === 'sales_agent' && userId) {
    return query.eq(field, userId);
  }
  if (role === 'team_leader' || role === 'sales_manager') {
    const ids = teamId ? await getTeamMemberIds(role, teamId) : [];
    // Always include the manager's own data, and fall back to own-only when the
    // team is unset / has no linked members — so a manager with an incomplete
    // team setup still sees THEIR numbers instead of an all-zero dashboard.
    const set = new Set(ids);
    if (userId) set.add(userId);
    if (set.size === 0) return query.in(field, [DENY_SENTINEL]);
    return query.in(field, Array.from(set));
  }
  // admin / operations / sales_director / hr / finance → unrestricted
  return query;
}

/**
 * Dashboard KPI service — fetches real-time stats from localStorage first,
 * then Supabase. Each function returns a safe fallback so the UI never breaks.
 */

// ── Date range helpers ────────────────────────────────────────────────────────
// Returns the same-length window immediately before `rangeKey`. Used by KPI
// cards to compute "+/-X% vs previous period" deltas. Calendar-aligned where
// the original range is calendar-aligned (week/month/year), otherwise just
// shifts by the duration so the comparison window matches in length.
export function getPreviousDateRange(rangeKey) {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  switch (rangeKey) {
    case 'this_week':
      start.setDate(now.getDate() - now.getDay() - 7);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - now.getDay());
      end.setHours(0, 0, 0, 0);
      end.setMilliseconds(-1);
      return { start, end };
    case 'this_month':
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(1);
      end.setHours(0, 0, 0, 0);
      end.setMilliseconds(-1);
      return { start, end };
    case 'last_3_months':
      start.setMonth(now.getMonth() - 6, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() - 3, 1);
      end.setHours(0, 0, 0, 0);
      end.setMilliseconds(-1);
      return { start, end };
    case 'this_year':
    default:
      start.setFullYear(now.getFullYear() - 1, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear(), 0, 1);
      end.setHours(0, 0, 0, 0);
      end.setMilliseconds(-1);
      return { start, end };
  }
}

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
export async function fetchContactStats({ role, userId, teamId } = {}, scopeAgentIds = null) {
  try {
    const applyContactRoleFilter = (q) => {
      // Exclude soft-deleted — match the Leads list EXACTLY (it uses the same
      // predicate), otherwise the dashboard total overcounts hidden contacts
      // (this is what made it read 32k while the list showed 28k).
      let qq = q.or('is_deleted.is.null,is_deleted.eq.false');
      // Honour the dashboard's selected scope (view-as agent/team) so the total
      // actually narrows. Without this, managers/admin fell back to RLS and the
      // number stayed fixed regardless of the chosen team/agent.
      if (Array.isArray(scopeAgentIds) && scopeAgentIds.length) return qq.in('assigned_to', scopeAgentIds);
      if (role === 'sales_agent' && userId) return qq.eq('assigned_to', userId);
      // Managers/leaders/director/admin/operations with no explicit scope: RLS.
      return qq;
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
    // Opportunities are retired — the pipeline now lives in `deals`. Map deal
    // statuses onto the same shape the dashboard already consumes.
    let query = supabase
      .from('deals')
      .select('id, status, deal_value, created_at, updated_at, assigned_to');
    query = await applyRoleFilter(query, 'assigned_to', { role, userId, teamId });
    const { data, error } = await query;
    if (error) throw error;
    if (data?.length) {
      return computeOppStats(data);
    }
  } catch { /* fallback */ }

  return { activeOpps: 0, closedDeals: 0, revenue: 0, closedThisMonth: 0, stageCounts: {}, totalOpps: 0, rawOpps: [] };
}

// Works on `deals` rows (status: new_deal/reserved/contracted/won/lost).
// active = still in the pipeline; closed = won.
function computeOppStats(deals) {
  const activeOpps = deals.filter(d => ['new_deal', 'reserved', 'contracted'].includes(d.status)).length;
  const closedDeals = deals.filter(d => d.status === 'won').length;
  const revenue = deals
    .filter(d => d.status === 'won')
    .reduce((sum, d) => sum + (parseFloat(d.deal_value) || 0), 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const closedThisMonth = deals.filter(d =>
    d.status === 'won' && new Date(d.updated_at || d.created_at) >= monthStart
  ).length;

  const stageCounts = {};
  deals.forEach(d => {
    stageCounts[d.status] = (stageCounts[d.status] || 0) + 1;
  });

  return { activeOpps, closedDeals, revenue, closedThisMonth, stageCounts, totalOpps: deals.length, rawOpps: deals };
}

// ── Deal KPIs (Phase B revenue source) ───────────────────────────────────────
// Revenue/wins now come from DEALS (the artifact created when a lead closes),
// not opportunities. getWonDeals returns CRM deals role-scoped by agent name
// (and excludes Operations' manual deals). Deals carry agent names rather than
// user ids, so we resolve the scoped user's name from their id first.
// Note: getWonDeals caps at 500 rows — fine for the dashboard's recent windows.
export async function fetchDealStats({ role, userId, teamId } = {}, scopeAgentIds = null) {
  try {
    let userName = null;
    if (userId) {
      if (_userNameCache.id === userId) {
        userName = _userNameCache.name;
      } else {
        const { data: u } = await supabase.from('users').select('full_name_en, full_name_ar').eq('id', userId).maybeSingle();
        userName = u?.full_name_en || u?.full_name_ar || null;
        _userNameCache = { id: userId, name: userName };
      }
    }
    // Scope deals to the SAME set the rest of the dashboard uses. Deals carry
    // agent NAMES (not user ids), so an explicit scope selection (agent/team,
    // passed as uuids) is resolved to names here. Priority:
    //   1. explicit scopeAgentIds (the CRM scope selector) → those users' names
    //   2. else manager/leader on a team → the team-member names
    //   3. else null → getWonDeals falls back to role/RLS scoping
    // A scope that resolves to NO names must show NOTHING (never fall open to the
    // whole team) — mirrors the NO_MATCH sentinel the other panels use.
    let agentNames = null;
    if (Array.isArray(scopeAgentIds) && scopeAgentIds.length) {
      const { data: us } = await supabase.from('users').select('full_name_en, full_name_ar').in('id', scopeAgentIds);
      agentNames = (us || []).flatMap(u => [u.full_name_en, u.full_name_ar].filter(Boolean));
      if (!agentNames.length) agentNames = [' __no_match__']; // never-match: show nothing
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      agentNames = await getTeamMemberNames(role, teamId);
    }
    // getWonDeals returns ALL CRM deals (any status) despite its name. Under the
    // deal-events model a deal has a status (new_deal/reserved/contracted/won/
    // lost), so "wins"/revenue must count status='won' ONLY — otherwise reserved/
    // contracted/lost deals inflate the win count and revenue.
    const allDeals = await getWonDeals({ role, userId, teamId, userName, agentNames, slim: true });
    const wonDeals = allDeals.filter(d => d.status === 'won');
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    // A win belongs to the month it CLOSED, not the month the deal opened — so
    // bucket won deals by their close timestamp (updated_at, set when status
    // flipped to 'won'), matching computeOppStats. "Opened this month" is the
    // funnel's open step and correctly keys on created_at.
    const closedInMonth = d => new Date(d.updated_at || d.created_at) >= monthStart;
    const openedInMonth = d => new Date(d.created_at) >= monthStart;
    const sumValue = list => list.reduce((s, d) => s + (parseFloat(d.deal_value) || 0), 0);
    return {
      rawDeals: wonDeals,               // won deals only — feeds the revenue trend
      revenue: sumValue(wonDeals),
      revenueThisMonth: sumValue(wonDeals.filter(closedInMonth)),
      wonThisMonth: wonDeals.filter(closedInMonth).length,
      wonCount: wonDeals.length,
      // ALL deals opened this month (any status) — the conversion funnel needs
      // the "opened" step, which must be ≥ wins. Deriving it from wonDeals would
      // make opened == wins (a bogus ~100% opp→win rate).
      openedThisMonth: allDeals.filter(openedInMonth).length,
    };
  } catch (err) {
    reportError('dashboardService', 'fetchDealStats', err);
    return { rawDeals: [], revenue: 0, revenueThisMonth: 0, wonThisMonth: 0, wonCount: 0, openedThisMonth: 0 };
  }
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

// stageCounts is now keyed by DEAL status (deal-events model).
const DEAL_STAGE_LABELS = {
  new_deal:   { ar: 'جديدة',  en: 'New' },
  reserved:   { ar: 'محجوز',  en: 'Reserved' },
  contracted: { ar: 'متعاقد', en: 'Contracted' },
  won:        { ar: 'مكسوبة', en: 'Won' },
  lost:       { ar: 'خسارة',  en: 'Lost' },
};
export function buildPipelineData(stageCounts) {
  if (!stageCounts || Object.keys(stageCounts).length === 0) return null;
  const orderedStages = ['new_deal', 'reserved', 'contracted', 'won'];
  return orderedStages
    .filter(s => stageCounts[s] > 0)
    .map(s => ({
      stage_key: s,
      stage_ar: DEAL_STAGE_LABELS[s]?.ar || s,
      stage_en: DEAL_STAGE_LABELS[s]?.en || s,
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
    if (o.status !== 'won') return false;
    if (start && new Date(o.created_at) < start) return false;
    if (end && new Date(o.created_at) > end) return false;
    return true;
  });
  if (!won.length) return null;
  const map = {};
  won.forEach(o => {
    const d = new Date(o.created_at);
    const key = d.getFullYear() + '-' + String(d.getMonth()).padStart(2, '0');
    map[key] = (map[key] || 0) + (parseFloat(o.deal_value) || 0);
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
    if (o.status !== 'won') return false;
    if (start && new Date(o.created_at) < start) return false;
    if (end && new Date(o.created_at) > end) return false;
    return true;
  });
  if (!won.length) return null;
  const map = {};
  won.forEach(o => {
    const key = o.assigned_to || 'unknown';
    if (!map[key]) map[key] = { id: key, revenue: 0, count: 0 };
    map[key].revenue += parseFloat(o.deal_value) || 0;
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
  const activeOpps = filtered.filter(o => ['new_deal', 'reserved', 'contracted'].includes(o.status)).length;
  const closedDeals = filtered.filter(o => o.status === 'won').length;
  const revenue = filtered.filter(o => o.status === 'won').reduce((s, o) => s + (parseFloat(o.deal_value) || 0), 0);
  const stageCounts = {};
  filtered.forEach(o => { stageCounts[o.status] = (stageCounts[o.status] || 0) + 1; });
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
