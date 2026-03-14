/**
 * Sales Forecasting Service
 * Computes weighted pipeline forecasts from opportunity data
 */

// ── Stage Probabilities ────────────────────────────────────────────
export const STAGE_PROBABILITIES = {
  // Sales stages
  new: 0.10, initial: 0.10, qualification: 0.10,
  qualified: 0.20, contacted: 0.20,
  site_visit_scheduled: 0.30, site_visited: 0.35,
  proposal: 0.40,
  negotiation: 0.60, reserved: 0.70,
  closing: 0.80, contracted: 0.80,
  closed_won: 1.00,
  closed_lost: 0,
  // HR stages
  applied: 0.10, screening: 0.15,
  interview_1: 0.25, interview_2: 0.35, assessment: 0.45,
  offer: 0.65, hired: 1.0, rejected: 0,
  // Marketing stages
  nurturing: 0.25, converted: 0.60,
  // Operations stages
  request: 0.10, evaluation: 0.20,
  agreement: 0.50, execution: 0.70,
  // Finance stages
  pending: 0.15, under_review: 0.30, approved: 0.60,
  // Misc
  interested: 0.40, on_hold: 0.20,
};

function getStageProbability(stage) {
  return STAGE_PROBABILITIES[stage] ?? 0.10;
}

// ── Load opportunities from localStorage ───────────────────────────
export function loadOpportunities() {
  try {
    const data = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
    if (data.length > 0) return data;
  } catch { /* ignore */ }
  // Generate mock data if empty
  return generateMockOpportunities();
}

// ── Mock Data Generator ────────────────────────────────────────────
function generateMockOpportunities() {
  const stages = ['qualification', 'site_visit_scheduled', 'site_visited', 'proposal', 'negotiation', 'reserved', 'contracted', 'closed_won', 'closed_lost'];
  const departments = ['sales', 'marketing', 'operations'];
  const names = ['Ahmed', 'Mohamed', 'Sara', 'Nour', 'Hassan', 'Youssef', 'Fatma', 'Ali', 'Layla', 'Omar'];
  const projects = ['Sunrise Tower', 'Palm Hills', 'New Cairo Residence', 'Marina Bay', 'Green Valley'];
  const temperatures = ['hot', 'warm', 'cool', 'cold'];
  const opps = [];

  for (let i = 0; i < 30; i++) {
    const stage = stages[Math.floor(Math.random() * stages.length)];
    const month = Math.floor(Math.random() * 6); // Jan-Jun 2026
    const day = Math.floor(Math.random() * 28) + 1;
    const budget = Math.floor(Math.random() * 5000000) + 200000;
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const project = projects[Math.floor(Math.random() * projects.length)];

    opps.push({
      id: `mock_opp_${i + 1}`,
      title: `${name} - ${project}`,
      contact_name: name,
      budget: budget,
      stage: stage,
      department: dept,
      temperature: temperatures[Math.floor(Math.random() * temperatures.length)],
      project_name: project,
      created_at: `2026-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00:00Z`,
      updated_at: `2026-${String(month + 1).padStart(2, '0')}-${String(Math.min(day + 3, 28)).padStart(2, '0')}T10:00:00Z`,
      closed_at: (stage === 'closed_won' || stage === 'closed_lost')
        ? `2026-${String(month + 1).padStart(2, '0')}-${String(Math.min(day + 5, 28)).padStart(2, '0')}T10:00:00Z`
        : null,
    });
  }
  return opps;
}

// ── Date Range Helpers ─────────────────────────────────────────────
export function getDateRange(rangeKey) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3);

  switch (rangeKey) {
    case 'this_quarter': {
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59);
      return { start, end, label: `Q${quarter + 1} ${year}` };
    }
    case 'next_quarter': {
      const nq = quarter + 1;
      const ny = nq > 3 ? year + 1 : year;
      const nqMod = nq % 4;
      const start = new Date(ny, nqMod * 3, 1);
      const end = new Date(ny, nqMod * 3 + 3, 0, 23, 59, 59);
      return { start, end, label: `Q${nqMod + 1} ${ny}` };
    }
    case 'this_year': {
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59), label: String(year) };
    }
    case 'last_6_months': {
      const start = new Date(year, month - 5, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      return { start, end, label: 'Last 6 Months' };
    }
    default:
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59), label: String(year) };
  }
}

// ── Filter opportunities by date range ────────────────────────────
function filterByDateRange(opportunities, dateRange) {
  if (!dateRange) return opportunities;
  const { start, end } = dateRange;
  return opportunities.filter(opp => {
    const d = new Date(opp.created_at || opp.updated_at);
    return d >= start && d <= end;
  });
}

// ── Compute Forecast KPIs ──────────────────────────────────────────
export function computeForecast(opportunities, dateRange) {
  const filtered = filterByDateRange(opportunities, dateRange);

  let totalPipeline = 0;
  let weightedRevenue = 0;
  let actualRevenue = 0;
  let totalDeals = filtered.length;
  let closedWon = 0;
  let closedLost = 0;

  filtered.forEach(opp => {
    const value = Number(opp.budget) || 0;
    const prob = getStageProbability(opp.stage);

    if (opp.stage !== 'closed_won' && opp.stage !== 'closed_lost') {
      totalPipeline += value;
    }
    weightedRevenue += value * prob;

    if (opp.stage === 'closed_won') {
      actualRevenue += value;
      closedWon++;
    }
    if (opp.stage === 'closed_lost') {
      closedLost++;
    }
  });

  const totalClosed = closedWon + closedLost;
  const winRate = totalClosed > 0 ? Math.round((closedWon / totalClosed) * 100) : 0;
  const avgDealSize = totalDeals > 0 ? Math.round(totalPipeline / Math.max(totalDeals - closedWon - closedLost, 1)) : 0;

  return {
    totalPipeline,
    weightedRevenue,
    actualRevenue,
    totalDeals,
    winRate,
    avgDealSize,
    closedWon,
    closedLost,
  };
}

// ── Monthly Forecast for Charts ────────────────────────────────────
const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LABELS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function computeMonthlyForecast(opportunities, dateRange, isRTL = false) {
  const filtered = filterByDateRange(opportunities, dateRange);
  const monthMap = {};

  filtered.forEach(opp => {
    const d = new Date(opp.created_at || opp.updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) {
      monthMap[key] = {
        month: d.getMonth(),
        year: d.getFullYear(),
        label: isRTL ? MONTH_LABELS_AR[d.getMonth()] : MONTH_LABELS_EN[d.getMonth()],
        pipeline: 0,
        weighted: 0,
        actual: 0,
        deals: 0,
      };
    }
    const value = Number(opp.budget) || 0;
    const prob = getStageProbability(opp.stage);

    monthMap[key].deals++;
    if (opp.stage === 'closed_won') {
      monthMap[key].actual += value;
    }
    if (opp.stage !== 'closed_lost') {
      monthMap[key].pipeline += value;
    }
    monthMap[key].weighted += value * prob;
  });

  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ── Stage Funnel ───────────────────────────────────────────────────
export function computeStageFunnel(opportunities) {
  const stageMap = {};

  opportunities.forEach(opp => {
    const stage = opp.stage || 'unknown';
    if (!stageMap[stage]) {
      stageMap[stage] = { stage, count: 0, value: 0, weightedValue: 0, probability: getStageProbability(stage) };
    }
    const value = Number(opp.budget) || 0;
    stageMap[stage].count++;
    stageMap[stage].value += value;
    stageMap[stage].weightedValue += value * getStageProbability(stage);
  });

  // Sort by probability ascending (funnel top to bottom)
  return Object.values(stageMap).sort((a, b) => a.probability - b.probability);
}

// ── Forecast Accuracy ──────────────────────────────────────────────
export function computeAccuracy(opportunities) {
  const monthMap = {};

  opportunities.forEach(opp => {
    const d = new Date(opp.created_at || opp.updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) {
      monthMap[key] = { forecast: 0, actual: 0 };
    }
    const value = Number(opp.budget) || 0;
    const prob = getStageProbability(opp.stage);
    monthMap[key].forecast += value * prob;

    if (opp.stage === 'closed_won') {
      monthMap[key].actual += value;
    }
  });

  return Object.entries(monthMap).map(([key, v]) => {
    const accuracy = v.forecast > 0
      ? Math.min(Math.round((v.actual / v.forecast) * 100), 200)
      : (v.actual > 0 ? 0 : 100);
    return { month: key, forecast: v.forecast, actual: v.actual, accuracy };
  }).sort((a, b) => a.month.localeCompare(b.month));
}

// ── Get unique departments from opportunities ──────────────────────
export function getDepartments(opportunities) {
  const depts = new Set();
  opportunities.forEach(opp => {
    if (opp.department) depts.add(opp.department);
  });
  return [...depts].sort();
}
