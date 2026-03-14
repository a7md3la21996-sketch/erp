/**
 * KPI Targets Service — localStorage-based with Supabase-ready structure
 * Key: platform_kpi_targets
 */

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

// ── Mock actuals by employee & month — simulates data from activities/opps/deals ──
const MOCK_ACTUALS = {
  e1: {
    '2026-3': { calls: 28, new_opportunities: 18, closed_deals: 9, revenue: 1250000, meetings: 18, site_visits: 8 },
    '2026-2': { calls: 32, new_opportunities: 22, closed_deals: 11, revenue: 1380000, meetings: 21, site_visits: 9 },
    '2026-1': { calls: 25, new_opportunities: 16, closed_deals: 7, revenue: 1100000, meetings: 15, site_visits: 7 },
  },
  e3: {
    '2026-3': { calls: 45, new_opportunities: 14, closed_deals: 5, revenue: 790000, meetings: 12, site_visits: 7 },
    '2026-2': { calls: 38, new_opportunities: 11, closed_deals: 4, revenue: 650000, meetings: 10, site_visits: 6 },
    '2026-1': { calls: 42, new_opportunities: 15, closed_deals: 5, revenue: 720000, meetings: 13, site_visits: 8 },
  },
  e5: {
    '2026-3': { calls: 52, new_opportunities: 10, closed_deals: 3, revenue: 480000, meetings: 9, site_visits: 6 },
    '2026-2': { calls: 60, new_opportunities: 15, closed_deals: 4, revenue: 600000, meetings: 12, site_visits: 8 },
    '2026-1': { calls: 35, new_opportunities: 8, closed_deals: 2, revenue: 310000, meetings: 7, site_visits: 4 },
  },
  e6: {
    '2026-3': { calls: 72, new_opportunities: 11, closed_deals: 4, revenue: 520000, meetings: 8, site_visits: 10 },
    '2026-2': { calls: 55, new_opportunities: 8, closed_deals: 3, revenue: 390000, meetings: 7, site_visits: 8 },
    '2026-1': { calls: 78, new_opportunities: 13, closed_deals: 4, revenue: 450000, meetings: 10, site_visits: 11 },
  },
  e8: {
    '2026-3': { calls: 65, new_opportunities: 6, closed_deals: 2, revenue: 210000, meetings: 5, site_visits: 9 },
    '2026-2': { calls: 70, new_opportunities: 9, closed_deals: 3, revenue: 440000, meetings: 8, site_visits: 11 },
    '2026-1': { calls: 40, new_opportunities: 4, closed_deals: 1, revenue: 180000, meetings: 3, site_visits: 5 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────
function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
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
export function getTargets(month, year) {
  const all = loadAll();
  return all.filter(t => t.month === month && t.year === year);
}

/**
 * Get targets for a specific employee in a specific month
 */
export function getEmployeeTargets(employeeId, month, year) {
  const all = loadAll();
  return all.filter(t => t.employee_id === employeeId && t.month === month && t.year === year);
}

/**
 * Set targets for an employee in a given month.
 * targets is an object { calls: 60, ... } — only non-null values will be set.
 */
export function setTargets(employeeId, month, year, targets) {
  const all = loadAll();

  METRICS.forEach(metric => {
    if (targets[metric] === undefined) return;
    const idx = all.findIndex(t =>
      t.employee_id === employeeId && t.month === month && t.year === year && t.metric === metric
    );
    if (idx >= 0) {
      all[idx].target_value = Number(targets[metric]);
    } else {
      all.push({
        id: generateId(),
        employee_id: employeeId,
        month,
        year,
        metric,
        target_value: Number(targets[metric]),
        current_value: 0,
      });
    }
  });

  saveAll(all);
  return getEmployeeTargets(employeeId, month, year);
}

/**
 * Compute actuals for an employee from mock data (simulating Supabase queries on activities, opps, deals)
 */
export function computeActuals(employeeId, month, year) {
  const key = `${year}-${month}`;
  return MOCK_ACTUALS[employeeId]?.[key] || {
    calls: 0, new_opportunities: 0, closed_deals: 0, revenue: 0, meetings: 0, site_visits: 0,
  };
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
export function ensureTargets(employeeId, role, month, year) {
  const existing = getEmployeeTargets(employeeId, month, year);
  if (existing.length > 0) return existing;

  const defaults = getDefaultTargets(role);
  return setTargets(employeeId, month, year, defaults);
}

/**
 * Get full KPI summary for all sales employees in a given month.
 * Returns array of { employee, metrics: [{ metric, target, actual, pct }], overallPct }
 */
export function getTeamKPIs(employees, month, year) {
  return employees.map(emp => {
    ensureTargets(emp.id, emp.role, month, year);
    const targets = getEmployeeTargets(emp.id, month, year);
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
  }).sort((a, b) => b.overallPct - a.overallPct);
}

/**
 * Get top N performers for a given month
 */
export function getTopPerformers(employees, month, year, count = 3) {
  return getTeamKPIs(employees, month, year).slice(0, count);
}

/**
 * Get team overall achievement % for a month
 */
export function getTeamOverallPct(employees, month, year) {
  const kpis = getTeamKPIs(employees, month, year);
  if (kpis.length === 0) return 0;
  return Math.round(kpis.reduce((s, k) => s + k.overallPct, 0) / kpis.length);
}
