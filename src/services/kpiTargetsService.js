import { reportError } from '../utils/errorReporter';
/**
 * KPI Targets Service — localStorage-based with Supabase-ready structure
 * Key: platform_kpi_targets
 */

import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_kpi_targets';

// ── Metric Configuration ─────────────────────────────────────────
export const METRIC_CONFIG = {
  calls:              { ar: 'مكالمات',        en: 'Calls',             icon: 'Phone',        color: '#10B981' },
  new_opportunities:  { ar: 'فرص جديدة',      en: 'New Opportunities', icon: 'Briefcase',    color: '#4A7AAB' },
  closed_deals:       { ar: 'صفقات مغلقة',    en: 'Closed Deals',      icon: 'Trophy',       color: '#2B4C6F' },
  revenue:            { ar: 'الإيرادات',       en: 'Revenue',           icon: 'DollarSign',   color: '#6B8DB5' },
  meetings:           { ar: 'اجتماعات',       en: 'Meetings',          icon: 'Users',        color: '#8B5CF6' },
  site_visits:        { ar: 'زيارات ميدانية',  en: 'Site Visits',       icon: 'MapPin',       color: '#F59E0B' },
};

export const METRICS = Object.keys(METRIC_CONFIG);

// ── Default Targets ──────────────────────────────────────────────
const DEFAULT_TARGETS = {
  calls: 60,
  new_opportunities: 15,
  closed_deals: 5,
  revenue: 500000,
  meetings: 12,
  site_visits: 8,
};

// Role-based defaults — sales directors get higher targets
const ROLE_DEFAULTS = {
  sales_director:  { calls: 30,  new_opportunities: 20, closed_deals: 10, revenue: 1500000, meetings: 20, site_visits: 10 },
  sales_manager:   { calls: 50,  new_opportunities: 18, closed_deals: 8,  revenue: 800000,  meetings: 16, site_visits: 10 },
  team_leader:     { calls: 60,  new_opportunities: 15, closed_deals: 6,  revenue: 600000,  meetings: 12, site_visits: 8 },
  sales_agent:     { calls: 80,  new_opportunities: 12, closed_deals: 4,  revenue: 400000,  meetings: 10, site_visits: 12 },
};

// ── Helpers ───────────────────────────────────────────────────────
function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (err) { reportError('kpiTargetsService', 'query', err);
    return [];
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId() {
  return 'kpi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Get all targets for a given month/year (all employees)
 */
export async function getTargets(month, year) {
  try {
    const { data, error } = await supabase.from('kpi_targets').select('*').eq('month', month).eq('year', year);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('kpiTargetsService', 'query', err);
    const all = loadAll();
    return all.filter(t => t.month === month && t.year === year);
  }
}

/**
 * Get targets for a specific employee in a specific month
 */
export async function getEmployeeTargets(employeeId, month, year) {
  try {
    const { data, error } = await supabase.from('kpi_targets').select('*').eq('employee_id', employeeId).eq('month', month).eq('year', year);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('kpiTargetsService', 'query', err);
    const all = loadAll();
    return all.filter(t => t.employee_id === employeeId && t.month === month && t.year === year);
  }
}

/**
 * Set targets for an employee in a given month.
 * targets is an object { calls: 60, ... } — only non-null values will be set.
 */
export async function setTargets(employeeId, month, year, targets) {
  // Update localStorage (optimistic)
  const all = loadAll();

  const upsertItems = [];
  METRICS.forEach(metric => {
    if (targets[metric] === undefined) return;
    const idx = all.findIndex(t =>
      t.employee_id === employeeId && t.month === month && t.year === year && t.metric === metric
    );
    if (idx >= 0) {
      all[idx].target_value = Number(targets[metric]);
      upsertItems.push(all[idx]);
    } else {
      const item = {
        id: generateId(),
        employee_id: employeeId,
        month,
        year,
        metric,
        target_value: Number(targets[metric]),
        current_value: 0,
      };
      all.push(item);
      upsertItems.push(item);
    }
  });

  saveAll(all);

  // Try Supabase
  try {
    if (upsertItems.length > 0) {
      const { error } = await supabase.from('kpi_targets').upsert(upsertItems, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) { reportError('kpiTargetsService', 'query', err);
    // localStorage already updated
  }

  return getEmployeeTargets(employeeId, month, year);
}

/**
 * Compute actuals for an employee from mock data (simulating Supabase queries on activities, opps, deals)
 */
export function computeActuals(employeeId, month, year) {
  return { calls: 0, new_opportunities: 0, closed_deals: 0, revenue: 0, meetings: 0, site_visits: 0 };
}

/**
 * Get defaults for a given employee role
 */
export function getDefaultTargets(role) {
  return ROLE_DEFAULTS[role] || DEFAULT_TARGETS;
}

/**
 * Ensure targets exist for an employee for a given month — create from defaults if missing
 */
export async function ensureTargets(employeeId, role, month, year) {
  const existing = await getEmployeeTargets(employeeId, month, year);
  if (existing.length > 0) return existing;

  const defaults = getDefaultTargets(role);
  return setTargets(employeeId, month, year, defaults);
}

/**
 * Get full KPI summary for all sales employees in a given month.
 * Returns array of { employee, metrics: [{ metric, target, actual, pct }], overallPct }
 */
export async function getTeamKPIs(employees, month, year) {
  const results = await Promise.all(employees.map(async emp => {
    await ensureTargets(emp.id, emp.role, month, year);
    const targets = await getEmployeeTargets(emp.id, month, year);
    const actuals = computeActuals(emp.id, month, year);

    const metrics = METRICS.map(metric => {
      const tgt = targets.find(t => t.metric === metric);
      const targetVal = tgt?.target_value || getDefaultTargets(emp.role)[metric] || 0;
      const actualVal = actuals[metric] || 0;
      const pct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 0;
      return { metric, target: targetVal, actual: actualVal, pct };
    });

    const avgPct = metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + m.pct, 0) / metrics.length)
      : 0;

    return { employee: emp, metrics, overallPct: avgPct };
  }));
  return results.sort((a, b) => b.overallPct - a.overallPct);
}

/**
 * Get top N performers for a given month
 */
export async function getTopPerformers(employees, month, year, count = 3) {
  const kpis = await getTeamKPIs(employees, month, year);
  return kpis.slice(0, count);
}

/**
 * Get team overall achievement % for a month
 */
export async function getTeamOverallPct(employees, month, year) {
  const kpis = await getTeamKPIs(employees, month, year);
  if (kpis.length === 0) return 0;
  return Math.round(kpis.reduce((s, k) => s + k.overallPct, 0) / kpis.length);
}
