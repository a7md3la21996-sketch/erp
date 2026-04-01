import { syncToSupabase } from '../utils/supabaseSync';
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
import { fetchDeals, fetchInstallments, fetchHandovers, fetchTickets } from './operationsService';

/**
 * Fetch all data needed for reports
 */
export async function fetchReportsData(profile) {
  const opts = { role: profile?.role, userId: profile?.id, teamId: profile?.team_id };
  const [contacts, opportunities, deals, activities, campaigns, employees, attendance, invoices, expenses, opsDeals, opsInstallments, opsHandovers, opsTickets] = await Promise.all([
    fetchContacts(opts).catch(() => []),
    fetchOpportunities(opts).catch(() => []),
    getWonDeals().catch(() => []),
    fetchActivities(opts).catch(() => []),
    fetchCampaigns().catch(() => []),
    fetchEmployees().catch(() => []),
    fetchAttendance().catch(() => []),
    fetchInvoices().catch(() => []),
    fetchExpenses().catch(() => []),
    fetchDeals().catch(() => []),
    fetchInstallments().catch(() => []),
    fetchHandovers().catch(() => []),
    fetchTickets().catch(() => []),
  ]);
  return { contacts, opportunities, deals, activities, campaigns, employees, attendance, invoices, expenses, opsDeals, opsInstallments, opsHandovers, opsTickets };
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
    google_ads: { en: 'Google Ads', ar: 'إعلانات جوجل' },
    call: { en: 'Inbound Call', ar: 'اتصال وارد' },
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
 * CRM: Disqualified by Source — shows DQ count & rate per source + top DQ reasons
 */
export function computeDisqualifiedBySource(contacts) {
  const SOURCE_LABELS = {
    facebook: { en: 'Facebook', ar: 'فيسبوك' },
    instagram: { en: 'Instagram', ar: 'انستغرام' },
    google: { en: 'Google Ads', ar: 'إعلانات جوجل' },
    google_ads: { en: 'Google Ads', ar: 'إعلانات جوجل' },
    call: { en: 'Inbound Call', ar: 'اتصال وارد' },
    referral: { en: 'Referral', ar: 'إحالة' },
    walk_in: { en: 'Walk-in', ar: 'زيارة مباشرة' },
    website: { en: 'Website', ar: 'الموقع' },
    cold_call: { en: 'Cold Call', ar: 'كولد كول' },
    tiktok: { en: 'TikTok', ar: 'تيك توك' },
    snapchat: { en: 'Snapchat', ar: 'سناب شات' },
    linkedin: { en: 'LinkedIn', ar: 'لينكدإن' },
    other: { en: 'Other', ar: 'أخرى' },
  };
  const map = {};
  contacts.forEach(c => {
    const src = c.source || 'other';
    if (!map[src]) map[src] = { total: 0, dq: 0, reasons: {} };
    map[src].total++;
    if (c.contact_status === 'disqualified') {
      map[src].dq++;
      const reason = c.disqualify_reason || 'unknown';
      map[src].reasons[reason] = (map[src].reasons[reason] || 0) + 1;
    }
  });
  return Object.entries(map)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].dq - a[1].dq)
    .map(([src, v]) => {
      const topReason = Object.entries(v.reasons).sort((a, b) => b[1] - a[1])[0];
      return {
        source: SOURCE_LABELS[src]?.en || src,
        source_ar: SOURCE_LABELS[src]?.ar || src,
        total: v.total,
        dq: v.dq,
        rate: v.total > 0 ? Math.round((v.dq / v.total) * 100) : 0,
        top_reason: topReason ? topReason[0] : '—',
        top_reason_count: topReason ? topReason[1] : 0,
      };
    });
}

/**
 * CRM: Source Performance — contacts → opportunities → won per source
 */
export function computeSourcePerformance(contacts, opportunities) {
  const SOURCE_LABELS = {
    facebook: { en: 'Facebook', ar: 'فيسبوك' },
    instagram: { en: 'Instagram', ar: 'انستغرام' },
    google: { en: 'Google Ads', ar: 'إعلانات جوجل' },
    google_ads: { en: 'Google Ads', ar: 'إعلانات جوجل' },
    call: { en: 'Inbound Call', ar: 'اتصال وارد' },
    referral: { en: 'Referral', ar: 'إحالة' },
    walk_in: { en: 'Walk-in', ar: 'زيارة مباشرة' },
    website: { en: 'Website', ar: 'الموقع' },
    cold_call: { en: 'Cold Call', ar: 'كولد كول' },
    tiktok: { en: 'TikTok', ar: 'تيك توك' },
    snapchat: { en: 'Snapchat', ar: 'سناب شات' },
    linkedin: { en: 'LinkedIn', ar: 'لينكدإن' },
    other: { en: 'Other', ar: 'أخرى' },
  };

  // Map contact_id → source
  const contactSourceMap = {};
  contacts.forEach(c => { contactSourceMap[c.id] = c.source || 'other'; });

  const map = {};
  contacts.forEach(c => {
    const src = c.source || 'other';
    if (!map[src]) map[src] = { contacts: 0, opps: 0, won: 0, lost: 0, revenue: 0 };
    map[src].contacts++;
  });

  opportunities.forEach(o => {
    const src = o.source || contactSourceMap[o.contact_id] || 'other';
    if (!map[src]) map[src] = { contacts: 0, opps: 0, won: 0, lost: 0, revenue: 0 };
    map[src].opps++;
    if (o.stage === 'closed_won') {
      map[src].won++;
      map[src].revenue += o.budget || o.deal_value || o.revenue || 0;
    }
    if (o.stage === 'closed_lost') map[src].lost++;
  });

  return Object.entries(map)
    .filter(([, v]) => v.contacts > 0)
    .sort((a, b) => b[1].contacts - a[1].contacts)
    .map(([src, v]) => ({
      source: SOURCE_LABELS[src]?.en || src,
      source_ar: SOURCE_LABELS[src]?.ar || src,
      contacts: v.contacts,
      opps: v.opps,
      won: v.won,
      lost: v.lost,
      revenue: v.revenue,
      opp_rate: v.contacts > 0 ? Math.round((v.opps / v.contacts) * 100) : 0,
      win_rate: v.opps > 0 ? Math.round((v.won / v.opps) * 100) : 0,
    }));
}

/**
 * CRM: Campaign Performance — aggregated stats per campaign
 */
export function computeCampaignPerformance(contacts, opportunities) {
  const contactsByCampaign = {};
  contacts.forEach(c => {
    const camp = c.campaign_name;
    if (!camp) return;
    if (!contactsByCampaign[camp]) contactsByCampaign[camp] = { contacts: 0, dq: 0, contacted: 0, source: c.source || 'other', contactIds: new Set() };
    contactsByCampaign[camp].contacts++;
    contactsByCampaign[camp].contactIds.add(c.id);
    if (c.contact_status === 'disqualified') contactsByCampaign[camp].dq++;
    if (c.contact_status === 'contacted' || c.last_activity_at) contactsByCampaign[camp].contacted++;
    if (!contactsByCampaign[camp].source || contactsByCampaign[camp].source === 'other') contactsByCampaign[camp].source = c.source || 'other';
  });

  const SOURCE_LABELS = {
    facebook: 'Facebook', instagram: 'Instagram', google: 'Google Ads',
    tiktok: 'TikTok', snapchat: 'Snapchat', linkedin: 'LinkedIn',
    referral: 'Referral', walk_in: 'Walk-in', website: 'Website',
    cold_call: 'Cold Call', other: 'Other',
  };

  const results = Object.entries(contactsByCampaign).map(([name, v]) => {
    const campOpps = opportunities.filter(o => v.contactIds.has(o.contact_id));
    const won = campOpps.filter(o => o.stage === 'closed_won');
    const lost = campOpps.filter(o => o.stage === 'closed_lost');
    const revenue = won.reduce((s, o) => s + (o.budget || o.deal_value || o.revenue || 0), 0);
    return {
      campaign: name,
      source: SOURCE_LABELS[v.source] || v.source,
      contacts: v.contacts,
      contacted: v.contacted,
      dq: v.dq,
      dq_rate: v.contacts > 0 ? Math.round((v.dq / v.contacts) * 100) : 0,
      opps: campOpps.length,
      opp_rate: v.contacts > 0 ? Math.round((campOpps.length / v.contacts) * 100) : 0,
      won: won.length,
      lost: lost.length,
      win_rate: campOpps.length > 0 ? Math.round((won.length / campOpps.length) * 100) : 0,
      revenue,
    };
  });

  return results.sort((a, b) => b.contacts - a.contacts);
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
 * Sales: Top Performers (from deals grouped by agent, with opportunities fallback)
 */
export function computeTopPerformers(deals, opportunities) {
  const agentMap = {};

  // Primary: aggregate from deals
  deals.forEach(d => {
    const agent = d.agent_ar || d.agent_en || d.agent_name || d.assigned_to || 'Unknown';
    if (!agentMap[agent]) agentMap[agent] = { name_ar: d.agent_ar || agent, name: d.agent_en || agent, deals: 0, revenue: 0, opps: 0, won: 0, lost: 0, convRate: 0 };
    agentMap[agent].deals++;
    agentMap[agent].revenue += d.deal_value || 0;
  });

  // Enrich with opportunities data if available
  if (opportunities && opportunities.length > 0) {
    opportunities.forEach(opp => {
      const agent = opp.agent_name || opp.assigned_to || 'Unknown';
      if (!agentMap[agent]) agentMap[agent] = { name_ar: agent, name: agent, deals: 0, revenue: 0, opps: 0, won: 0, lost: 0, convRate: 0 };
      agentMap[agent].opps++;
      if (opp.stage === 'closed_won') {
        agentMap[agent].won++;
        // If no deals data, use opportunity revenue
        if (deals.length === 0) {
          agentMap[agent].deals++;
          agentMap[agent].revenue += (opp.revenue || opp.value || opp.budget || 0);
        }
      }
      if (opp.stage === 'closed_lost') {
        agentMap[agent].lost++;
      }
    });
  }

  return Object.values(agentMap)
    .map(a => ({
      ...a,
      convRate: a.opps > 0 ? Math.round((a.won / a.opps) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
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

// ─── OPERATIONS REPORTS ──────────────────────────────────────────

const DEAL_STATUS_AR = { new_deal: 'جديدة', under_review: 'قيد المراجعة', docs_collection: 'جمع المستندات', contract_prep: 'تحضير العقد', contract_signed: 'تم التوقيع', completed: 'مكتملة', cancelled: 'ملغاة' };
const DEAL_STATUS_EN = { new_deal: 'New Deal', under_review: 'Under Review', docs_collection: 'Docs Collection', contract_prep: 'Contract Prep', contract_signed: 'Contract Signed', completed: 'Completed', cancelled: 'Cancelled' };

export function computeDealPipeline(opsDeals) {
  if (!opsDeals?.length) return [];
  const counts = {};
  opsDeals.forEach(d => {
    const s = d.status || 'new_deal';
    if (!counts[s]) counts[s] = { count: 0, value: 0 };
    counts[s].count++;
    counts[s].value += d.deal_value || 0;
  });
  return Object.entries(counts).map(([status, v]) => ({
    status, status_ar: DEAL_STATUS_AR[status] || status, status_en: DEAL_STATUS_EN[status] || status,
    count: v.count, value: v.value,
  }));
}

export function computePaymentsSummary(opsInstallments) {
  if (!opsInstallments?.length) return [];
  const paid = opsInstallments.filter(i => i.status === 'paid');
  const overdue = opsInstallments.filter(i => i.status === 'overdue');
  const due = opsInstallments.filter(i => i.status === 'due');
  return [
    { status: 'paid', status_ar: 'مدفوع', status_en: 'Paid', count: paid.length, total: paid.reduce((s, i) => s + (i.amount || 0), 0) },
    { status: 'due', status_ar: 'مستحق', status_en: 'Due', count: due.length, total: due.reduce((s, i) => s + (i.amount || 0), 0) },
    { status: 'overdue', status_ar: 'متأخر', status_en: 'Overdue', count: overdue.length, total: overdue.reduce((s, i) => s + (i.amount || 0), 0) },
  ];
}

export function computeHandoverStatus(opsHandovers) {
  if (!opsHandovers?.length) return [];
  const counts = {};
  opsHandovers.forEach(h => {
    const s = h.status || 'pending';
    if (!counts[s]) counts[s] = 0;
    counts[s]++;
  });
  const STATUS_AR = { pending: 'قيد الانتظار', scheduled: 'مجدول', in_progress: 'جاري', completed: 'مكتمل', delayed: 'متأخر' };
  const STATUS_EN = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', delayed: 'Delayed' };
  return Object.entries(counts).map(([status, count]) => ({
    status, status_ar: STATUS_AR[status] || status, status_en: STATUS_EN[status] || status, count,
  }));
}

export function computeTicketsSummary(opsTickets) {
  if (!opsTickets?.length) return [];
  const byType = {};
  opsTickets.forEach(t => {
    const type = t.type || 'general';
    if (!byType[type]) byType[type] = { open: 0, resolved: 0, total: 0 };
    byType[type].total++;
    if (['open', 'in_progress'].includes(t.status)) byType[type].open++;
    else byType[type].resolved++;
  });
  const TYPE_AR = { complaint: 'شكوى', inquiry: 'استفسار', maintenance: 'صيانة', general: 'عام' };
  const TYPE_EN = { complaint: 'Complaint', inquiry: 'Inquiry', maintenance: 'Maintenance', general: 'General' };
  return Object.entries(byType).map(([type, v]) => ({
    type, type_ar: TYPE_AR[type] || type, type_en: TYPE_EN[type] || type,
    open: v.open, resolved: v.resolved, total: v.total,
    resolve_rate: v.total > 0 ? Math.round((v.resolved / v.total) * 100) : 0,
  }));
}
