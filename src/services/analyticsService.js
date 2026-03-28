/**
 * Advanced Analytics Computation Service
 * Reads from localStorage with mock data fallback for demo
 */

// ── localStorage keys ────────────────────────────────────────────
const KEYS = {
  opportunities: 'platform_opportunities',
  contacts: 'platform_contacts',
  deals: 'platform_won_deals',
  activities: 'platform_activities',
};

// ── Stage order for funnel ───────────────────────────────────────
const STAGE_ORDER = [
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost',
];

const STAGE_LABELS = {
  new:          { en: 'New',          ar: 'جديد' },
  contacted:    { en: 'Contacted',    ar: 'تم التواصل' },
  qualified:    { en: 'Qualified',    ar: 'مؤهل' },
  proposal:     { en: 'Proposal',     ar: 'عرض سعر' },
  negotiation:  { en: 'Negotiation',  ar: 'تفاوض' },
  closed_won:   { en: 'Closed Won',   ar: 'تم الإغلاق' },
  closed_lost:  { en: 'Closed Lost',  ar: 'خسارة' },
};

const SOURCES = ['Facebook', 'Google Ads', 'Referral', 'Walk-in', 'Website', 'Instagram', 'LinkedIn'];
const AGENTS = ['Ahmed Hassan', 'Sara Ali', 'Omar Khalil', 'Mona Ibrahim', 'Youssef Nabil', 'Laila Farouk'];
const LOST_REASONS = ['Price too high', 'Competitor won', 'No budget', 'Bad timing', 'No response', 'Requirements changed'];

// ── Helpers ──────────────────────────────────────────────────────
function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function daysBetween(a, b) {
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
}

// ── Mock data generators ─────────────────────────────────────────
function generateMockOpportunities(count = 300) {
  const opps = [];
  for (let i = 0; i < count; i++) {
    const stage = randomPick(STAGE_ORDER);
    const source = randomPick(SOURCES);
    const agent = randomPick(AGENTS);
    const createdDaysAgo = randomInt(1, 365);
    const created_at = daysAgo(createdDaysAgo);
    const value = randomInt(50000, 2000000);
    const opp = {
      id: `opp_${i}`,
      title: `Opportunity ${i + 1}`,
      stage,
      source,
      assigned_to: agent,
      agent_name: agent,
      value,
      created_at,
      updated_at: daysAgo(randomInt(0, createdDaysAgo)),
      contact_id: `contact_${randomInt(1, 100)}`,
      department: randomPick(['Sales', 'Marketing']),
    };
    if (stage === 'closed_won') {
      opp.won_date = daysAgo(randomInt(0, createdDaysAgo - 1));
      opp.revenue = value;
    }
    if (stage === 'closed_lost') {
      opp.lost_date = daysAgo(randomInt(0, createdDaysAgo - 1));
      opp.lost_reason = randomPick(LOST_REASONS);
    }
    // Stage transition timestamps for cycle analysis
    const stageIdx = STAGE_ORDER.indexOf(stage);
    opp.stage_history = [];
    let currentDate = new Date(created_at);
    for (let s = 0; s <= stageIdx && s < STAGE_ORDER.length; s++) {
      opp.stage_history.push({
        stage: STAGE_ORDER[s],
        entered_at: currentDate.toISOString(),
      });
      currentDate = new Date(currentDate.getTime() + randomInt(1, 14) * 86400000);
    }
    opps.push(opp);
  }
  return opps;
}

function generateMockContacts(count = 200) {
  const contacts = [];
  for (let i = 0; i < count; i++) {
    contacts.push({
      id: `contact_${i}`,
      name: `Contact ${i + 1}`,
      source: randomPick(SOURCES),
      created_at: daysAgo(randomInt(1, 365)),
      contact_type: randomPick(['lead', 'client', 'prospect']),
    });
  }
  return contacts;
}

function generateMockDeals(count = 50) {
  const deals = [];
  for (let i = 0; i < count; i++) {
    deals.push({
      id: `deal_${i}`,
      title: `Deal ${i + 1}`,
      value: randomInt(100000, 3000000),
      source: randomPick(SOURCES),
      agent_name: randomPick(AGENTS),
      closed_at: daysAgo(randomInt(1, 365)),
      created_at: daysAgo(randomInt(30, 400)),
    });
  }
  return deals;
}

function generateMockActivities(count = 500) {
  const types = ['call', 'meeting', 'email', 'follow_up', 'site_visit'];
  const activities = [];
  for (let i = 0; i < count; i++) {
    activities.push({
      id: `act_${i}`,
      type: randomPick(types),
      agent_name: randomPick(AGENTS),
      created_at: daysAgo(randomInt(0, 180)),
      duration_minutes: randomInt(5, 120),
      opportunity_id: `opp_${randomInt(0, 299)}`,
    });
  }
  return activities;
}

// ── Data loading (real data only — no mock fallback) ─────────────
export function loadAnalyticsData() {
  const opportunities = readLS(KEYS.opportunities);
  const contacts = readLS(KEYS.contacts);
  const deals = readLS(KEYS.deals);
  const activities = readLS(KEYS.activities);

  const hasData = opportunities.length > 0 || contacts.length > 0 || deals.length > 0 || activities.length > 0;

  return { opportunities, contacts, deals, activities, useMock: false, hasData };
}

// ── Date range filter helper ─────────────────────────────────────
export function filterByRange(items, range, dateField = 'created_at') {
  if (!range || range === 'all') return items;
  const now = new Date();
  let start;
  switch (range) {
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_6':
      start = monthsAgo(6);
      break;
    default:
      return items;
  }
  return items.filter(item => {
    const d = new Date(item[dateField]);
    return d >= start && d <= now;
  });
}

// ══════════════════════════════════════════════════════════════════
// 1. CONVERSION FUNNEL
// ══════════════════════════════════════════════════════════════════
export function computeConversionFunnel(opportunities) {
  const funnelStages = STAGE_ORDER.filter(s => s !== 'closed_lost');
  const counts = {};

  // Count opps that reached each stage (cumulative)
  funnelStages.forEach(stage => { counts[stage] = 0; });

  opportunities.forEach(opp => {
    const stageIdx = STAGE_ORDER.indexOf(opp.stage);
    funnelStages.forEach((stage, idx) => {
      const targetIdx = STAGE_ORDER.indexOf(stage);
      if (stageIdx >= targetIdx) {
        counts[stage]++;
      }
    });
  });

  const total = counts[funnelStages[0]] || 1;
  return funnelStages.map((stage, i) => {
    const count = counts[stage];
    const prevCount = i > 0 ? counts[funnelStages[i - 1]] : count;
    const conversionRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    const overallRate = Math.round((count / total) * 100);
    const dropOff = i > 0 ? prevCount - count : 0;
    const dropOffPct = prevCount > 0 ? Math.round((dropOff / prevCount) * 100) : 0;
    return {
      stage,
      label: STAGE_LABELS[stage] || { en: stage, ar: stage },
      count,
      conversionRate,
      overallRate,
      dropOff,
      dropOffPct,
    };
  });
}

// ══════════════════════════════════════════════════════════════════
// 2. LEAD SOURCE ROI
// ══════════════════════════════════════════════════════════════════
export function computeLeadSourceROI(contacts, opportunities, deals) {
  const sources = {};

  // Count leads per source
  contacts.forEach(c => {
    const src = c.source || 'Unknown';
    if (!sources[src]) sources[src] = { source: src, leads: 0, opps: 0, deals: 0, revenue: 0, cost: 0 };
    sources[src].leads++;
  });

  // Count opps per source
  opportunities.forEach(o => {
    const src = o.source || 'Unknown';
    if (!sources[src]) sources[src] = { source: src, leads: 0, opps: 0, deals: 0, revenue: 0, cost: 0 };
    sources[src].opps++;
    if (o.stage === 'closed_won') {
      sources[src].deals++;
      sources[src].revenue += (o.revenue || o.value || 0);
    }
  });

  // Real cost from campaign spend data (no more hardcoded estimates)
  const campaignList = (() => {
    try { return JSON.parse(localStorage.getItem('platform_campaigns') || '[]'); } catch { return []; }
  })();
  const spentBySource = {};
  campaignList.forEach(c => {
    const platformMap = { meta: 'facebook', google: 'google_ads', tiktok: 'tiktok', organic: 'website', direct: 'referral' };
    const src = platformMap[c.platform] || c.platform || 'other';
    spentBySource[src] = (spentBySource[src] || 0) + (c.spent || 0);
  });

  return Object.values(sources).map(s => {
    const srcKey = s.source.toLowerCase().replace(/\s+/g, '_');
    const cost = spentBySource[srcKey] || spentBySource[s.source?.toLowerCase()] || 0;
    s.cost = cost;
    s.roi = cost > 0 ? Math.round(((s.revenue - cost) / cost) * 100) : 0;
    s.conversionRate = s.leads > 0 ? Math.round((s.deals / s.leads) * 100) : 0;
    return s;
  }).sort((a, b) => b.revenue - a.revenue);
}

// ══════════════════════════════════════════════════════════════════
// 3. SALES CYCLE DURATION
// ══════════════════════════════════════════════════════════════════
export function computeSalesCycleDuration(opportunities) {
  // Average days at each stage
  const stageDurations = {};
  const agentCycles = {};
  const sourceCycles = {};

  opportunities.forEach(opp => {
    if (!opp.stage_history || opp.stage_history.length < 2) return;

    for (let i = 0; i < opp.stage_history.length - 1; i++) {
      const stage = opp.stage_history[i].stage;
      const days = daysBetween(opp.stage_history[i].entered_at, opp.stage_history[i + 1].entered_at);
      if (!stageDurations[stage]) stageDurations[stage] = [];
      stageDurations[stage].push(days);
    }

    // Total cycle for closed deals
    if (opp.stage === 'closed_won' || opp.stage === 'closed_lost') {
      const totalDays = daysBetween(opp.created_at, opp.won_date || opp.lost_date || opp.updated_at);
      const agent = opp.agent_name || 'Unknown';
      const source = opp.source || 'Unknown';

      if (!agentCycles[agent]) agentCycles[agent] = [];
      agentCycles[agent].push(totalDays);

      if (!sourceCycles[source]) sourceCycles[source] = [];
      sourceCycles[source].push(totalDays);
    }
  });

  const stageAvg = Object.entries(stageDurations).map(([stage, days]) => ({
    stage,
    label: STAGE_LABELS[stage] || { en: stage, ar: stage },
    avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    count: days.length,
  })).sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const agentAvg = Object.entries(agentCycles).map(([agent, days]) => ({
    agent,
    avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    minDays: Math.min(...days),
    maxDays: Math.max(...days),
    totalDeals: days.length,
  })).sort((a, b) => a.avgDays - b.avgDays);

  const sourceAvg = Object.entries(sourceCycles).map(([source, days]) => ({
    source,
    avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    count: days.length,
  })).sort((a, b) => a.avgDays - b.avgDays);

  // Monthly trend of average cycle
  const monthlyBuckets = {};
  opportunities.forEach(opp => {
    if (opp.stage !== 'closed_won') return;
    const date = new Date(opp.won_date || opp.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const totalDays = daysBetween(opp.created_at, opp.won_date || opp.updated_at);
    if (!monthlyBuckets[key]) monthlyBuckets[key] = [];
    monthlyBuckets[key].push(totalDays);
  });

  const cycleTrend = Object.entries(monthlyBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, days]) => ({
      month,
      avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      count: days.length,
    }));

  const allCycles = Object.values(agentCycles).flat();
  const overallAvg = allCycles.length > 0
    ? Math.round(allCycles.reduce((a, b) => a + b, 0) / allCycles.length)
    : 0;

  return { stageAvg, agentAvg, sourceAvg, cycleTrend, overallAvg };
}

// ══════════════════════════════════════════════════════════════════
// 4. AGENT PERFORMANCE
// ══════════════════════════════════════════════════════════════════
export function computeAgentPerformance(opportunities, activities) {
  const agents = {};

  const initAgent = (name) => ({
    agent: name, calls: 0, meetings: 0, emails: 0, opps: 0,
    deals: 0, lost: 0, revenue: 0, totalCycleDays: 0, closedCount: 0,
    activitiesTotal: 0,
  });

  // Aggregate from opportunities
  opportunities.forEach(opp => {
    const name = opp.agent_name || opp.assigned_to || 'Unknown';
    if (!agents[name]) agents[name] = initAgent(name);
    agents[name].opps++;
    if (opp.stage === 'closed_won') {
      agents[name].deals++;
      agents[name].revenue += (opp.revenue || opp.value || opp.budget || 0);
      const closeDate = opp.won_date || opp.stage_changed_at || opp.updated_at;
      const cycle = daysBetween(opp.created_at, closeDate);
      agents[name].totalCycleDays += cycle;
      agents[name].closedCount++;
    }
    if (opp.stage === 'closed_lost') {
      agents[name].lost++;
    }
  });

  // Aggregate from activities
  activities.forEach(act => {
    const name = act.agent_name || act.assigned_to || 'Unknown';
    if (!agents[name]) agents[name] = initAgent(name);
    agents[name].activitiesTotal++;
    if (act.type === 'call') agents[name].calls++;
    else if (act.type === 'meeting') agents[name].meetings++;
    else if (act.type === 'email') agents[name].emails++;
  });

  return Object.values(agents).map(a => ({
    ...a,
    conversionRate: a.opps > 0 ? Math.round((a.deals / a.opps) * 100) : 0,
    avgCycleDays: a.closedCount > 0 ? Math.round(a.totalCycleDays / a.closedCount) : 0,
    avgDealSize: a.deals > 0 ? Math.round(a.revenue / a.deals) : 0,
    totalActivities: a.activitiesTotal || (a.calls + a.meetings + a.emails),
  })).sort((a, b) => b.revenue - a.revenue);
}

// ══════════════════════════════════════════════════════════════════
// 5. WIN/LOSS ANALYSIS
// ══════════════════════════════════════════════════════════════════
export function computeWinLossAnalysis(opportunities) {
  const closed = opportunities.filter(o => o.stage === 'closed_won' || o.stage === 'closed_lost');
  const won = closed.filter(o => o.stage === 'closed_won');
  const lost = closed.filter(o => o.stage === 'closed_lost');

  const overallWinRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0;

  // Win rate by source
  const bySource = {};
  closed.forEach(o => {
    const src = o.source || 'Unknown';
    if (!bySource[src]) bySource[src] = { source: src, won: 0, lost: 0, total: 0 };
    bySource[src].total++;
    if (o.stage === 'closed_won') bySource[src].won++;
    else bySource[src].lost++;
  });
  const winRateBySource = Object.values(bySource).map(s => ({
    ...s,
    winRate: s.total > 0 ? Math.round((s.won / s.total) * 100) : 0,
  })).sort((a, b) => b.winRate - a.winRate);

  // Win rate by agent
  const byAgent = {};
  closed.forEach(o => {
    const agent = o.agent_name || 'Unknown';
    if (!byAgent[agent]) byAgent[agent] = { agent, won: 0, lost: 0, total: 0 };
    byAgent[agent].total++;
    if (o.stage === 'closed_won') byAgent[agent].won++;
    else byAgent[agent].lost++;
  });
  const winRateByAgent = Object.values(byAgent).map(a => ({
    ...a,
    winRate: a.total > 0 ? Math.round((a.won / a.total) * 100) : 0,
  })).sort((a, b) => b.winRate - a.winRate);

  // Win rate by month
  const byMonth = {};
  closed.forEach(o => {
    const date = new Date(o.won_date || o.lost_date || o.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { month: key, won: 0, lost: 0, total: 0 };
    byMonth[key].total++;
    if (o.stage === 'closed_won') byMonth[key].won++;
    else byMonth[key].lost++;
  });
  const winRateByMonth = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => ({
      ...m,
      winRate: m.total > 0 ? Math.round((m.won / m.total) * 100) : 0,
    }));

  // Lost reasons breakdown
  const reasons = {};
  lost.forEach(o => {
    const reason = o.lost_reason || 'Unknown';
    reasons[reason] = (reasons[reason] || 0) + 1;
  });
  const lostReasons = Object.entries(reasons)
    .map(([reason, count]) => ({ reason, count, pct: lost.length > 0 ? Math.round((count / lost.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { overallWinRate, winRateBySource, winRateByAgent, winRateByMonth, lostReasons, totalWon: won.length, totalLost: lost.length };
}

// ══════════════════════════════════════════════════════════════════
// 6. TREND ANALYSIS
// ══════════════════════════════════════════════════════════════════
export function computeTrendAnalysis(opportunities, months = 12) {
  const buckets = {};
  const now = new Date();

  // Initialize last N months
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { month: key, newOpps: 0, conversions: 0, revenue: 0, totalValue: 0 };
  }

  opportunities.forEach(opp => {
    const created = new Date(opp.created_at);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) {
      buckets[key].newOpps++;
      buckets[key].totalValue += (opp.value || 0);
    }

    if (opp.stage === 'closed_won') {
      const wonDate = new Date(opp.won_date || opp.created_at);
      const wonKey = `${wonDate.getFullYear()}-${String(wonDate.getMonth() + 1).padStart(2, '0')}`;
      if (buckets[wonKey]) {
        buckets[wonKey].conversions++;
        buckets[wonKey].revenue += (opp.revenue || opp.value || 0);
      }
    }
  });

  return Object.values(buckets).map(b => ({
    ...b,
    avgDealSize: b.conversions > 0 ? Math.round(b.revenue / b.conversions) : 0,
    conversionRate: b.newOpps > 0 ? Math.round((b.conversions / b.newOpps) * 100) : 0,
  }));
}
