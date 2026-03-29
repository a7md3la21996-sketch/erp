import { syncToSupabase } from '../utils/supabaseSync';
/**
 * Comparison Reports Service
 * Compares performance metrics between two periods
 */

const LS_KEYS = {
  opportunities: 'platform_opportunities',
  contacts: 'platform_contacts',
  activities: 'platform_activities',
  wonDeals: 'platform_won_deals',
};

function readLS(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch { return []; }
}

/* ── Period helpers ────────────────────────────────────── */

export function getPeriodRange(periodId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);

  switch (periodId) {
    case 'this_month':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    case 'last_month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
    case 'this_quarter':
      return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0, 23, 59, 59) };
    case 'last_quarter':
      return { start: new Date(y, (q - 1) * 3, 1), end: new Date(y, q * 3, 0, 23, 59, 59) };
    case 'this_year':
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
    case 'last_year':
      return { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31, 23, 59, 59) };
    default:
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
  }
}

function filterByRange(records, range, dateField = 'created_at') {
  return records.filter(r => {
    const d = new Date(r[dateField]);
    return d >= range.start && d <= range.end;
  });
}

/* ── Mock data generator ──────────────────────────────── */

function generateMockData() {
  const agents = ['أحمد محمد', 'سارة أحمد', 'محمد علي', 'فاطمة حسن', 'عمر خالد'];
  const departments = ['المبيعات', 'التسويق', 'العمليات', 'خدمة العملاء'];
  const statuses = ['won', 'lost', 'open', 'negotiation'];
  const now = new Date();
  const records = [];

  // Generate 18 months of data
  for (let mOff = 0; mOff < 18; mOff++) {
    const base = new Date(now.getFullYear(), now.getMonth() - mOff, 1);
    const count = 15 + Math.floor(Math.random() * 25);
    for (let i = 0; i < count; i++) {
      const day = 1 + Math.floor(Math.random() * 28);
      const d = new Date(base.getFullYear(), base.getMonth(), day);
      const agent = agents[Math.floor(Math.random() * agents.length)];
      const dept = departments[Math.floor(Math.random() * departments.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const value = (50000 + Math.floor(Math.random() * 500000));
      records.push({
        id: `mock-${mOff}-${i}`,
        created_at: d.toISOString(),
        agent_name: agent,
        department: dept,
        status,
        value,
        type: 'opportunity',
      });
    }
  }
  return records;
}

let _mockCache = null;
function getMockData() {
  if (!_mockCache) _mockCache = generateMockData();
  return _mockCache;
}

function getAllRecords() {
  const opps = readLS(LS_KEYS.opportunities);
  const contacts = readLS(LS_KEYS.contacts);
  const activities = readLS(LS_KEYS.activities);
  const wonDeals = readLS(LS_KEYS.wonDeals);

  const hasSomeData = opps.length || contacts.length || activities.length || wonDeals.length;
  if (hasSomeData) {
    return { opps, contacts, activities, wonDeals, isMock: false };
  }
  // Generate mock
  const mock = getMockData();
  const mockContacts = mock.map(r => ({ ...r, type: 'contact' }));
  const mockActivities = mock.slice(0, Math.floor(mock.length * 0.7)).map(r => ({ ...r, type: 'activity' }));
  const mockWon = mock.filter(r => r.status === 'won');
  return { opps: mock, contacts: mockContacts, activities: mockActivities, wonDeals: mockWon, isMock: true };
}

/* ── Compute change ───────────────────────────────────── */

function calcChange(v1, v2) {
  if (v2 === 0 && v1 === 0) return { change: 0, changeDirection: 'same' };
  if (v2 === 0) return { change: 100, changeDirection: 'up' };
  const pct = ((v1 - v2) / v2) * 100;
  return {
    change: Math.round(Math.abs(pct) * 10) / 10,
    changeDirection: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same',
  };
}

/* ── Main comparison function ─────────────────────────── */

export function getComparisonData(period1Id, period2Id) {
  const r1 = getPeriodRange(period1Id);
  const r2 = getPeriodRange(period2Id);
  const { opps, contacts, activities, wonDeals } = getAllRecords();

  const p1Contacts = filterByRange(contacts, r1).length;
  const p2Contacts = filterByRange(contacts, r2).length;

  const p1Opps = filterByRange(opps, r1);
  const p2Opps = filterByRange(opps, r2);

  const p1Won = wonDeals.length ? filterByRange(wonDeals, r1) : p1Opps.filter(o => o.status === 'won');
  const p2Won = wonDeals.length ? filterByRange(wonDeals, r2) : p2Opps.filter(o => o.status === 'won');

  const p1Lost = p1Opps.filter(o => o.status === 'lost');
  const p2Lost = p2Opps.filter(o => o.status === 'lost');

  const p1Revenue = p1Won.reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
  const p2Revenue = p2Won.reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);

  const p1Activities = filterByRange(activities, r1).length;
  const p2Activities = filterByRange(activities, r2).length;

  const p1ConvRate = p1Opps.length ? Math.round((p1Won.length / p1Opps.length) * 100) : 0;
  const p2ConvRate = p2Opps.length ? Math.round((p2Won.length / p2Opps.length) * 100) : 0;

  const p1AvgDeal = p1Won.length ? Math.round(p1Revenue / p1Won.length) : 0;
  const p2AvgDeal = p2Won.length ? Math.round(p2Revenue / p2Won.length) : 0;

  const metrics = [
    { id: 'contacts', label: 'جهات الاتصال الجديدة', labelEn: 'New Contacts', period1Value: p1Contacts, period2Value: p2Contacts, ...calcChange(p1Contacts, p2Contacts) },
    { id: 'opportunities', label: 'الفرص الجديدة', labelEn: 'New Opportunities', period1Value: p1Opps.length, period2Value: p2Opps.length, ...calcChange(p1Opps.length, p2Opps.length) },
    { id: 'won_deals', label: 'الصفقات المكسوبة', labelEn: 'Won Deals', period1Value: p1Won.length, period2Value: p2Won.length, ...calcChange(p1Won.length, p2Won.length) },
    { id: 'revenue', label: 'الإيرادات', labelEn: 'Revenue', period1Value: p1Revenue, period2Value: p2Revenue, ...calcChange(p1Revenue, p2Revenue), isCurrency: true },
    { id: 'activities', label: 'الأنشطة', labelEn: 'Activities', period1Value: p1Activities, period2Value: p2Activities, ...calcChange(p1Activities, p2Activities) },
    { id: 'conversion_rate', label: 'معدل التحويل', labelEn: 'Conversion Rate', period1Value: p1ConvRate, period2Value: p2ConvRate, ...calcChange(p1ConvRate, p2ConvRate), isPercent: true },
    { id: 'avg_deal', label: 'متوسط حجم الصفقة', labelEn: 'Avg Deal Size', period1Value: p1AvgDeal, period2Value: p2AvgDeal, ...calcChange(p1AvgDeal, p2AvgDeal), isCurrency: true },
    { id: 'lost_deals', label: 'الصفقات الخاسرة', labelEn: 'Lost Deals', period1Value: p1Lost.length, period2Value: p2Lost.length, ...calcChange(p1Lost.length, p2Lost.length), invertColor: true },
  ];

  return metrics;
}

/* ── Monthly/Weekly breakdown for charts ──────────────── */

export function getMonthlyBreakdown(period1Id, period2Id) {
  const r1 = getPeriodRange(period1Id);
  const r2 = getPeriodRange(period2Id);
  const { opps, wonDeals } = getAllRecords();

  const p1Opps = filterByRange(opps, r1);
  const p2Opps = filterByRange(opps, r2);
  const p1Won = wonDeals.length ? filterByRange(wonDeals, r1) : p1Opps.filter(o => o.status === 'won');
  const p2Won = wonDeals.length ? filterByRange(wonDeals, r2) : p2Opps.filter(o => o.status === 'won');

  // Weekly breakdown (4 weeks)
  const weeks = [
    { label: 'الأسبوع 1', labelEn: 'Week 1' },
    { label: 'الأسبوع 2', labelEn: 'Week 2' },
    { label: 'الأسبوع 3', labelEn: 'Week 3' },
    { label: 'الأسبوع 4', labelEn: 'Week 4' },
  ];

  function weekOfMonth(d, rangeStart) {
    const diff = d.getTime() - rangeStart.getTime();
    return Math.min(3, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
  }

  const breakdown = weeks.map((w, i) => {
    const p1Count = p1Opps.filter(o => weekOfMonth(new Date(o.created_at), r1.start) === i).length;
    const p2Count = p2Opps.filter(o => weekOfMonth(new Date(o.created_at), r2.start) === i).length;
    const p1Rev = p1Won.filter(o => weekOfMonth(new Date(o.created_at), r1.start) === i)
      .reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
    const p2Rev = p2Won.filter(o => weekOfMonth(new Date(o.created_at), r2.start) === i)
      .reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
    return { ...w, period1Opps: p1Count, period2Opps: p2Count, period1Revenue: p1Rev, period2Revenue: p2Rev };
  });

  return breakdown;
}

/* ── Agent comparison ─────────────────────────────────── */

export function getAgentComparison(period1Id, period2Id) {
  const r1 = getPeriodRange(period1Id);
  const r2 = getPeriodRange(period2Id);
  const { opps, wonDeals } = getAllRecords();

  const p1Opps = filterByRange(opps, r1);
  const p2Opps = filterByRange(opps, r2);
  const p1Won = wonDeals.length ? filterByRange(wonDeals, r1) : p1Opps.filter(o => o.status === 'won');
  const p2Won = wonDeals.length ? filterByRange(wonDeals, r2) : p2Opps.filter(o => o.status === 'won');

  const agentField = 'agent_name';
  const allAgents = new Set();
  [...p1Opps, ...p2Opps, ...p1Won, ...p2Won].forEach(r => {
    const name = r[agentField] || r.assigned_to || r.owner || 'Unknown';
    allAgents.add(name);
  });

  const rows = Array.from(allAgents).map(agent => {
    const p1Rev = p1Won.filter(d => (d[agentField] || d.assigned_to || d.owner) === agent)
      .reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
    const p2Rev = p2Won.filter(d => (d[agentField] || d.assigned_to || d.owner) === agent)
      .reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
    const p1Deals = p1Won.filter(d => (d[agentField] || d.assigned_to || d.owner) === agent).length;
    const p2Deals = p2Won.filter(d => (d[agentField] || d.assigned_to || d.owner) === agent).length;
    const { change, changeDirection } = calcChange(p1Rev, p2Rev);
    return { agent, period1Revenue: p1Rev, period2Revenue: p2Rev, change, changeDirection, period1Deals: p1Deals, period2Deals: p2Deals };
  });

  return rows.sort((a, b) => {
    const aSign = a.changeDirection === 'up' ? a.change : a.changeDirection === 'down' ? -a.change : 0;
    const bSign = b.changeDirection === 'up' ? b.change : b.changeDirection === 'down' ? -b.change : 0;
    return bSign - aSign;
  });
}

/* ── Department comparison ────────────────────────────── */

export function getDepartmentComparison(period1Id, period2Id) {
  const r1 = getPeriodRange(period1Id);
  const r2 = getPeriodRange(period2Id);
  const { opps, wonDeals } = getAllRecords();

  const p1Opps = filterByRange(opps, r1);
  const p2Opps = filterByRange(opps, r2);
  const p1Won = wonDeals.length ? filterByRange(wonDeals, r1) : p1Opps.filter(o => o.status === 'won');
  const p2Won = wonDeals.length ? filterByRange(wonDeals, r2) : p2Opps.filter(o => o.status === 'won');

  const deptField = 'department';
  const allDepts = new Set();
  [...p1Opps, ...p2Opps].forEach(r => {
    allDepts.add(r[deptField] || 'أخرى');
  });

  return Array.from(allDepts).map(dept => {
    const p1Rev = p1Won.filter(d => (d[deptField] || 'أخرى') === dept)
      .reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
    const p2Rev = p2Won.filter(d => (d[deptField] || 'أخرى') === dept)
      .reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0);
    const p1Count = p1Opps.filter(d => (d[deptField] || 'أخرى') === dept).length;
    const p2Count = p2Opps.filter(d => (d[deptField] || 'أخرى') === dept).length;
    const { change, changeDirection } = calcChange(p1Rev, p2Rev);
    return { department: dept, period1Revenue: p1Rev, period2Revenue: p2Rev, period1Count: p1Count, period2Count: p2Count, change, changeDirection };
  });
}
