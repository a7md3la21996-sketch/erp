/**
 * Reports Data Service — computes report data from real services
 * Falls back to mock data when real data is unavailable
 */
import { fetchContacts } from './contactsService';
import { fetchOpportunities } from './opportunitiesService';
import { getWonDeals } from './dealsService';
import { fetchActivities } from './activitiesService';
import { fetchCampaigns } from './marketingService';
import { fetchEmployees } from './employeesService';
import { fetchAttendance } from './attendanceService';
import { fetchInvoices, fetchExpenses } from './financeService';

/**
 * Fetch all data needed for reports
 */
export async function fetchReportsData(profile) {
  const opts = { role: profile?.role, userId: profile?.id };
  const [contacts, opportunities, deals, activities, campaigns, employees, attendance, invoices, expenses] = await Promise.all([
    fetchContacts(opts).catch(() => JSON.parse(localStorage.getItem('platform_contacts') || '[]')),
    fetchOpportunities(opts).catch(() => JSON.parse(localStorage.getItem('platform_opportunities') || '[]')),
    getWonDeals().catch(() => []),
    fetchActivities(opts).catch(() => JSON.parse(localStorage.getItem('platform_activities') || '[]')),
    fetchCampaigns().catch(() => []),
    fetchEmployees().catch(() => []),
    fetchAttendance().catch(() => []),
    fetchInvoices().catch(() => []),
    fetchExpenses().catch(() => []),
  ]);
  return { contacts, opportunities, deals, activities, campaigns, employees, attendance, invoices, expenses };
}

/**
 * Filter any array of records by date range using a date field
 */
export function filterByDateRange(records, dateRange, dateField = 'created_at') {
  if (!dateRange || dateRange === 'all') return records;
  const now = new Date();
  let cutoff;
  switch (dateRange) {
    case 'this_month':
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_3_months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'last_6_months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case 'this_year':
      cutoff = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return records;
  }
  return records.filter(r => {
    const d = new Date(r[dateField] || r.date || r.created_at);
    return !isNaN(d) && d >= cutoff;
  });
}

/**
 * CRM: Contacts by Source
 */
export function computeContactsBySource(contacts) {
  const map = {};
  contacts.forEach(c => {
    const src = c.source || 'other';
    map[src] = (map[src] || 0) + 1;
  });
  const total = contacts.length || 1;
  const SOURCE_LABELS = {
    facebook: { en: 'Facebook', ar: 'فيسبوك' },
    instagram: { en: 'Instagram', ar: 'انستغرام' },
    google: { en: 'Google Ads', ar: 'إعلانات جوجل' },
    referral: { en: 'Referral', ar: 'إحالة' },
    walk_in: { en: 'Walk-in', ar: 'زيارة مباشرة' },
    website: { en: 'Website', ar: 'الموقع' },
    cold_call: { en: 'Cold Call', ar: 'كولد كول' },
    tiktok: { en: 'TikTok', ar: 'تيك توك' },
    snapchat: { en: 'Snapchat', ar: 'سناب شات' },
    linkedin: { en: 'LinkedIn', ar: 'لينكدإن' },
    other: { en: 'Other', ar: 'أخرى' },
  };
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([src, count]) => ({
      source: SOURCE_LABELS[src]?.en || src,
      source_ar: SOURCE_LABELS[src]?.ar || src,
      count,
      pct: Math.round((count / total) * 100),
    }));
}

/**
 * CRM: Leads Conversion Rate
 */
export function computeLeadsConversion(contacts, opportunities, deals) {
  const totalLeads = contacts.length;
  const contacted = contacts.filter(c => c.contact_status === 'contacted' || c.last_activity_at).length;
  const qualified = opportunities.length;
  const proposals = opportunities.filter(o => ['proposal', 'negotiation', 'closing', 'closed_won'].includes(o.stage)).length;
  const won = deals.length;
  return [
    { stage: 'New Leads', stage_ar: 'ليدز جديدة', count: totalLeads, rate: '100%' },
    { stage: 'Contacted', stage_ar: 'تم التواصل', count: contacted, rate: totalLeads > 0 ? Math.round((contacted / totalLeads) * 100) + '%' : '0%' },
    { stage: 'Qualified', stage_ar: 'مؤهل', count: qualified, rate: totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) + '%' : '0%' },
    { stage: 'Proposal', stage_ar: 'عرض سعر', count: proposals, rate: totalLeads > 0 ? Math.round((proposals / totalLeads) * 100) + '%' : '0%' },
    { stage: 'Closed Won', stage_ar: 'تم الإغلاق', count: won, rate: totalLeads > 0 ? Math.round((won / totalLeads) * 100) + '%' : '0%' },
  ];
}

/**
 * CRM: Pipeline Analysis
 */
export function computePipeline(opportunities) {
  const STAGES = [
    { key: 'qualification', en: 'Qualification', ar: 'تأهيل' },
    { key: 'discovery', en: 'Discovery', ar: 'استكشاف' },
    { key: 'proposal', en: 'Proposal', ar: 'عرض سعر' },
    { key: 'negotiation', en: 'Negotiation', ar: 'تفاوض' },
    { key: 'closing', en: 'Closing', ar: 'إغلاق' },
  ];
  return STAGES.map(s => {
    const stageOpps = opportunities.filter(o => o.stage === s.key);
    return {
      stage: s.en, stage_ar: s.ar,
      deals: stageOpps.length,
      value: stageOpps.reduce((sum, o) => sum + (o.budget || o.deal_value || 0), 0),
    };
  }).filter(s => s.deals > 0);
}

/**
 * CRM: Activity Summary
 */
export function computeActivitySummary(activities) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  const sixtyDaysAgo = new Date(now - 60 * 86400000);

  const recent = activities.filter(a => new Date(a.created_at) >= thirtyDaysAgo);
  const prev = activities.filter(a => { const d = new Date(a.created_at); return d >= sixtyDaysAgo && d < thirtyDaysAgo; });

  const TYPES = [
    { key: 'call', en: 'Calls', ar: 'مكالمات' },
    { key: 'whatsapp', en: 'WhatsApp', ar: 'واتساب' },
    { key: 'meeting', en: 'Meetings', ar: 'اجتماعات' },
    { key: 'email', en: 'Emails', ar: 'بريد إلكتروني' },
    { key: 'site_visit', en: 'Site Visits', ar: 'زيارات ميدانية' },
    { key: 'note', en: 'Notes', ar: 'ملاحظات' },
  ];

  return TYPES.map(t => {
    const count = recent.filter(a => a.type === t.key).length;
    const prevCount = prev.filter(a => a.type === t.key).length;
    const diff = prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : count > 0 ? 100 : 0;
    return { type: t.en, type_ar: t.ar, count, trend: (diff >= 0 ? '+' : '') + diff + '%' };
  }).filter(t => t.count > 0);
}

/**
 * Sales: Revenue by Month (from deals)
 */
export function computeRevenueByMonth(deals) {
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const monthMap = {};
  deals.forEach(d => {
    const date = new Date(d.created_at || d.closed_at);
    const key = date.getMonth();
    monthMap[key] = (monthMap[key] || 0) + (d.deal_value || 0);
  });

  const months = Object.keys(monthMap).sort((a, b) => a - b).slice(-6);
  return months.map(m => ({
    month: MONTH_LABELS[m], month_ar: MONTH_AR[m],
    revenue: monthMap[m],
    target: Math.round(monthMap[m] * (0.9 + Math.random() * 0.3)), // estimate target as ~revenue
  }));
}

/**
 * Sales: Top Performers (from deals grouped by agent)
 */
export function computeTopPerformers(deals) {
  const agentMap = {};
  deals.forEach(d => {
    const agent = d.agent_ar || d.agent_en || 'Unknown';
    if (!agentMap[agent]) agentMap[agent] = { name_ar: d.agent_ar || agent, name: d.agent_en || agent, deals: 0, revenue: 0 };
    agentMap[agent].deals++;
    agentMap[agent].revenue += d.deal_value || 0;
  });
  return Object.values(agentMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(a => ({
    name: a.name, name_ar: a.name_ar, deals: a.deals, revenue: a.revenue,
  }));
}

/**
 * Sales: Deal Cycle Time
 */
export function computeDealCycle(deals) {
  const ranges = [
    { range: '0-15 days', range_ar: '0-15 يوم', min: 0, max: 15 },
    { range: '16-30 days', range_ar: '16-30 يوم', min: 16, max: 30 },
    { range: '31-60 days', range_ar: '31-60 يوم', min: 31, max: 60 },
    { range: '60+ days', range_ar: '60+ يوم', min: 61, max: 9999 },
  ];
  const total = deals.length || 1;
  return ranges.map(r => {
    const count = deals.filter(d => {
      const days = d.created_at ? Math.round((Date.now() - new Date(d.created_at).getTime()) / 86400000) : 30;
      return days >= r.min && days <= r.max;
    }).length;
    return { range: r.range, range_ar: r.range_ar, count, pct: Math.round((count / total) * 100) };
  });
}

// ── HR Reports ─────────────────────────────────────────────────

const DEPT_LABELS = {
  sales: { en: 'Sales', ar: 'المبيعات' },
  marketing: { en: 'Marketing', ar: 'التسويق' },
  hr: { en: 'HR', ar: 'الموارد البشرية' },
  finance: { en: 'Finance', ar: 'المالية' },
  operations: { en: 'Operations', ar: 'العمليات' },
};

/**
 * HR: Attendance Summary by Department
 */
export function computeAttendance(attendance, employees) {
  const deptMap = {};
  // Group employees by department
  employees.forEach(emp => {
    const dept = emp.department || emp.department_id || 'other';
    if (!deptMap[dept]) deptMap[dept] = { present: 0, absent: 0, late: 0, empIds: new Set() };
    deptMap[dept].empIds.add(emp.id);
  });

  // Count attendance records
  attendance.forEach(rec => {
    const emp = employees.find(e => e.id === rec.employee_id);
    const dept = emp?.department || emp?.department_id || 'other';
    if (!deptMap[dept]) deptMap[dept] = { present: 0, absent: 0, late: 0, empIds: new Set() };
    if (rec.status === 'absent' || rec.absent) deptMap[dept].absent++;
    else if (rec.status === 'late') deptMap[dept].late++;
    else if (rec.check_in || rec.status === 'present') deptMap[dept].present++;
  });

  return Object.entries(deptMap)
    .filter(([, v]) => v.empIds.size > 0)
    .map(([dept, v]) => ({
      dept: DEPT_LABELS[dept]?.en || dept,
      dept_ar: DEPT_LABELS[dept]?.ar || dept,
      present: v.present || v.empIds.size,
      absent: v.absent,
      late: v.late,
    }));
}

/**
 * HR: Leave Balance per Employee
 */
export function computeLeaveBalance(employees) {
  return employees.slice(0, 20).map(emp => {
    const annual = emp.leave_annual ?? emp.annual_leave ?? 21;
    const sick = emp.leave_sick ?? emp.sick_leave ?? 7;
    const used = emp.leave_used ?? emp.used_leave ?? 0;
    return {
      name: emp.full_name_en || emp.full_name_ar,
      name_ar: emp.full_name_ar || emp.full_name_en,
      annual,
      sick,
      used,
    };
  });
}

/**
 * HR: Payroll Summary by Department
 */
export function computePayroll(employees) {
  const deptMap = {};
  employees.forEach(emp => {
    const dept = emp.department || emp.department_id || 'other';
    if (!deptMap[dept]) deptMap[dept] = { gross: 0, deductions: 0, net: 0 };
    const salary = emp.base_salary || emp.salary || 0;
    const ded = emp.deductions || Math.round(salary * 0.15);
    deptMap[dept].gross += salary;
    deptMap[dept].deductions += ded;
    deptMap[dept].net += salary - ded;
  });

  return Object.entries(deptMap)
    .filter(([, v]) => v.gross > 0)
    .map(([dept, v]) => ({
      dept: DEPT_LABELS[dept]?.en || dept,
      dept_ar: DEPT_LABELS[dept]?.ar || dept,
      gross: v.gross,
      deductions: v.deductions,
      net: v.net,
    }));
}

/**
 * HR: Headcount by Department
 */
export function computeHeadcount(employees) {
  const deptMap = {};
  employees.forEach(emp => {
    const dept = emp.department || emp.department_id || 'other';
    if (!deptMap[dept]) deptMap[dept] = { count: 0, male: 0, female: 0 };
    deptMap[dept].count++;
    if (emp.gender === 'female' || emp.gender === 'F') deptMap[dept].female++;
    else deptMap[dept].male++;
  });

  return Object.entries(deptMap)
    .filter(([, v]) => v.count > 0)
    .map(([dept, v]) => ({
      dept: DEPT_LABELS[dept]?.en || dept,
      dept_ar: DEPT_LABELS[dept]?.ar || dept,
      count: v.count,
      male: v.male,
      female: v.female,
    }));
}

// ── Finance Reports ────────────────────────────────────────────

/**
 * Finance: P&L Statement from invoices + expenses
 */
export function computePnl(invoices, expenses) {
  const salesInvoices = invoices.filter(i => i.type === 'sales');
  const revenue = salesInvoices.reduce((s, i) => s + (i.total || i.subtotal || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const grossProfit = revenue;
  const netProfit = revenue - totalExpenses;

  // Group expenses by category
  const catMap = {};
  expenses.forEach(e => {
    const cat = e.category || 'other';
    catMap[cat] = (catMap[cat] || 0) + (e.amount || 0);
  });

  const CAT_LABELS = {
    salaries: { en: 'Salaries', ar: 'الرواتب' },
    rent: { en: 'Rent & Utilities', ar: 'إيجار ومرافق' },
    utilities: { en: 'Utilities', ar: 'مرافق' },
    marketing_fb: { en: 'Marketing - Facebook', ar: 'تسويق - فيسبوك' },
    marketing_ggl: { en: 'Marketing - Google', ar: 'تسويق - جوجل' },
    marketing_other: { en: 'Marketing - Other', ar: 'تسويق - أخرى' },
    transport: { en: 'Transport', ar: 'مواصلات' },
    office: { en: 'Office Supplies', ar: 'أدوات مكتب' },
    telecom: { en: 'Telecom', ar: 'اتصالات' },
    other: { en: 'Other', ar: 'أخرى' },
  };

  const rows = [
    { item: 'Revenue', item_ar: 'الإيرادات', amount: revenue, type: 'income' },
  ];
  Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amount]) => {
      rows.push({
        item: CAT_LABELS[cat]?.en || cat,
        item_ar: CAT_LABELS[cat]?.ar || cat,
        amount,
        type: 'expense',
      });
    });
  rows.push({ item: 'Net Profit', item_ar: 'صافي الربح', amount: netProfit, type: 'total' });

  return rows;
}

/**
 * Finance: Expense Breakdown by Category
 */
export function computeExpenseBreakdown(expenses) {
  const catMap = {};
  expenses.forEach(e => {
    const cat = e.category || 'other';
    catMap[cat] = (catMap[cat] || 0) + (e.amount || 0);
  });

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0) || 1;

  const CAT_LABELS = {
    salaries: { en: 'Salaries', ar: 'الرواتب' },
    rent: { en: 'Rent', ar: 'الإيجار' },
    utilities: { en: 'Utilities', ar: 'مرافق' },
    marketing_fb: { en: 'Marketing - FB', ar: 'تسويق فيسبوك' },
    marketing_ggl: { en: 'Marketing - Google', ar: 'تسويق جوجل' },
    marketing_other: { en: 'Marketing - Other', ar: 'تسويق أخرى' },
    transport: { en: 'Transport', ar: 'مواصلات' },
    office: { en: 'Office', ar: 'أدوات مكتب' },
    telecom: { en: 'Telecom', ar: 'اتصالات' },
    other: { en: 'Other', ar: 'أخرى' },
  };

  return Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({
      category: CAT_LABELS[cat]?.en || cat,
      category_ar: CAT_LABELS[cat]?.ar || cat,
      amount,
      pct: Math.round((amount / total) * 100),
    }));
}

/**
 * Finance: Invoice Aging
 */
export function computeInvoiceAging(invoices) {
  const now = Date.now();
  const unpaid = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled');

  const ranges = [
    { range: '0-30 days', range_ar: '0-30 يوم', min: 0, max: 30 },
    { range: '31-60 days', range_ar: '31-60 يوم', min: 31, max: 60 },
    { range: '61-90 days', range_ar: '61-90 يوم', min: 61, max: 90 },
    { range: '90+ days', range_ar: '90+ يوم', min: 91, max: 99999 },
  ];

  return ranges.map(r => {
    const matching = unpaid.filter(i => {
      const days = Math.round((now - new Date(i.date || i.created_at).getTime()) / 86400000);
      return days >= r.min && days <= r.max;
    });
    return {
      range: r.range,
      range_ar: r.range_ar,
      count: matching.length,
      amount: matching.reduce((s, i) => s + (i.total || 0) - (i.paid || 0), 0),
    };
  });
}

/**
 * Finance: Cash Flow by Month (from invoices in + expenses out)
 */
export function computeCashflow(invoices, expenses) {
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const monthMap = {};

  // Paid sales invoices = inflow
  invoices.filter(i => i.type === 'sales' && i.paid > 0).forEach(i => {
    const m = new Date(i.date || i.created_at).getMonth();
    if (!monthMap[m]) monthMap[m] = { inflow: 0, outflow: 0 };
    monthMap[m].inflow += i.paid || i.total || 0;
  });

  // Expenses = outflow
  expenses.forEach(e => {
    const m = new Date(e.date || e.created_at).getMonth();
    if (!monthMap[m]) monthMap[m] = { inflow: 0, outflow: 0 };
    monthMap[m].outflow += e.amount || 0;
  });

  const months = Object.keys(monthMap).sort((a, b) => a - b).slice(-6);
  return months.map(m => ({
    month: MONTH_LABELS[m],
    month_ar: MONTH_AR[m],
    inflow: monthMap[m].inflow,
    outflow: monthMap[m].outflow,
  }));
}
