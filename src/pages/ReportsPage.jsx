import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText, Users, DollarSign, Briefcase, BarChart3,
  TrendingUp, Calendar, Clock, PieChart, Activity,
  CreditCard, Building2, UserCheck, FileBarChart,
  ArrowDownToLine, Trophy, Target, Award, Star, Medal,
  ChevronUp, ChevronDown, Minus, Crown, Zap
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Modal, Input, Select, KpiCard, ExportButton, Table, Th, Td, Tr, FilterPill, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { MOCK_EMPLOYEES } from '../data/hr_mock_data';
import { getTeamKPIs, setTargets, METRIC_CONFIG, METRICS } from '../services/kpiTargetsService';
import {
  fetchReportsData, filterByDateRange,
  computeContactsBySource, computeLeadsConversion, computePipeline,
  computeActivitySummary, computeRevenueByMonth, computeTopPerformers, computeDealCycle,
  computeAttendance, computeLeaveBalance, computePayroll, computeHeadcount,
  computePnl, computeExpenseBreakdown, computeInvoiceAging, computeCashflow,
} from '../services/reportsDataService';

// ── Mock report data generators ──────────────────────────────────

const MOCK_CONTACTS_BY_SOURCE = [
  { source: 'Facebook', source_ar: 'فيسبوك', count: 142, pct: 35 },
  { source: 'Google Ads', source_ar: 'إعلانات جوجل', count: 98, pct: 24 },
  { source: 'Referral', source_ar: 'إحالة', count: 67, pct: 17 },
  { source: 'Walk-in', source_ar: 'زيارة مباشرة', count: 51, pct: 13 },
  { source: 'Website', source_ar: 'الموقع', count: 45, pct: 11 },
];

const MOCK_LEADS_CONVERSION = [
  { stage: 'New Leads', stage_ar: 'ليدز جديدة', count: 403, rate: '100%' },
  { stage: 'Contacted', stage_ar: 'تم التواصل', count: 312, rate: '77.4%' },
  { stage: 'Qualified', stage_ar: 'مؤهل', count: 189, rate: '46.9%' },
  { stage: 'Proposal', stage_ar: 'عرض سعر', count: 87, rate: '21.6%' },
  { stage: 'Closed Won', stage_ar: 'تم الإغلاق', count: 34, rate: '8.4%' },
];

const MOCK_PIPELINE = [
  { stage: 'Discovery', stage_ar: 'استكشاف', deals: 18, value: 540000 },
  { stage: 'Proposal', stage_ar: 'عرض سعر', deals: 12, value: 960000 },
  { stage: 'Negotiation', stage_ar: 'تفاوض', deals: 7, value: 1120000 },
  { stage: 'Closing', stage_ar: 'إغلاق', deals: 4, value: 680000 },
];

const MOCK_ACTIVITY_SUMMARY = [
  { type: 'Calls', type_ar: 'مكالمات', count: 234, trend: '+12%' },
  { type: 'Meetings', type_ar: 'اجتماعات', count: 56, trend: '+5%' },
  { type: 'Emails', type_ar: 'بريد إلكتروني', count: 189, trend: '-3%' },
  { type: 'Follow-ups', type_ar: 'متابعات', count: 145, trend: '+18%' },
];

const MOCK_REVENUE_BY_MONTH = [
  { month: 'Jan', month_ar: 'يناير', revenue: 385000, target: 400000 },
  { month: 'Feb', month_ar: 'فبراير', revenue: 420000, target: 400000 },
  { month: 'Mar', month_ar: 'مارس', revenue: 510000, target: 450000 },
  { month: 'Apr', month_ar: 'أبريل', revenue: 390000, target: 450000 },
  { month: 'May', month_ar: 'مايو', revenue: 475000, target: 500000 },
  { month: 'Jun', month_ar: 'يونيو', revenue: 530000, target: 500000 },
];

const MOCK_TOP_PERFORMERS = [
  { name: 'Ahmed Hassan', name_ar: 'أحمد حسن', deals: 8, revenue: 640000 },
  { name: 'Sara Ali', name_ar: 'سارة علي', deals: 6, revenue: 510000 },
  { name: 'Omar Khalil', name_ar: 'عمر خليل', deals: 5, revenue: 425000 },
  { name: 'Mona Ibrahim', name_ar: 'منى إبراهيم', deals: 4, revenue: 380000 },
];

const MOCK_DEAL_CYCLE = [
  { range: '0-15 days', range_ar: '0-15 يوم', count: 12, pct: 26 },
  { range: '16-30 days', range_ar: '16-30 يوم', count: 18, pct: 39 },
  { range: '31-60 days', range_ar: '31-60 يوم', count: 11, pct: 24 },
  { range: '60+ days', range_ar: '60+ يوم', count: 5, pct: 11 },
];

const MOCK_ATTENDANCE = [
  { dept: 'Sales', dept_ar: 'المبيعات', present: 22, absent: 2, late: 3 },
  { dept: 'Marketing', dept_ar: 'التسويق', present: 20, absent: 1, late: 2 },
  { dept: 'HR', dept_ar: 'الموارد البشرية', present: 18, absent: 0, late: 1 },
  { dept: 'Finance', dept_ar: 'المالية', present: 19, absent: 1, late: 2 },
];

const MOCK_LEAVE_BALANCE = [
  { name: 'Ahmed Hassan', name_ar: 'أحمد حسن', annual: 12, sick: 5, used: 8 },
  { name: 'Sara Ali', name_ar: 'سارة علي', annual: 15, sick: 5, used: 3 },
  { name: 'Omar Khalil', name_ar: 'عمر خليل', annual: 10, sick: 5, used: 10 },
  { name: 'Mona Ibrahim', name_ar: 'منى إبراهيم', annual: 14, sick: 5, used: 6 },
];

const MOCK_PAYROLL = [
  { dept: 'Sales', dept_ar: 'المبيعات', gross: 285000, deductions: 42000, net: 243000 },
  { dept: 'Marketing', dept_ar: 'التسويق', gross: 195000, deductions: 28000, net: 167000 },
  { dept: 'HR', dept_ar: 'الموارد البشرية', gross: 165000, deductions: 24000, net: 141000 },
  { dept: 'Finance', dept_ar: 'المالية', gross: 210000, deductions: 31000, net: 179000 },
];

const MOCK_HEADCOUNT = [
  { dept: 'Sales', dept_ar: 'المبيعات', count: 24, male: 15, female: 9 },
  { dept: 'Marketing', dept_ar: 'التسويق', count: 12, male: 5, female: 7 },
  { dept: 'HR', dept_ar: 'الموارد البشرية', count: 8, male: 3, female: 5 },
  { dept: 'Finance', dept_ar: 'المالية', count: 10, male: 6, female: 4 },
  { dept: 'Operations', dept_ar: 'العمليات', count: 16, male: 11, female: 5 },
];

const MOCK_PNL = [
  { item: 'Revenue', item_ar: 'الإيرادات', amount: 3_210_000, type: 'income' },
  { item: 'Cost of Sales', item_ar: 'تكلفة المبيعات', amount: 1_284_000, type: 'expense' },
  { item: 'Gross Profit', item_ar: 'مجمل الربح', amount: 1_926_000, type: 'subtotal' },
  { item: 'Salaries', item_ar: 'الرواتب', amount: 855_000, type: 'expense' },
  { item: 'Marketing', item_ar: 'التسويق', amount: 210_000, type: 'expense' },
  { item: 'Rent & Utilities', item_ar: 'إيجار ومرافق', amount: 180_000, type: 'expense' },
  { item: 'Net Profit', item_ar: 'صافي الربح', amount: 681_000, type: 'total' },
];

const MOCK_EXPENSES = [
  { category: 'Salaries', category_ar: 'الرواتب', amount: 855_000, pct: 56 },
  { category: 'Marketing', category_ar: 'التسويق', amount: 210_000, pct: 14 },
  { category: 'Rent', category_ar: 'الإيجار', amount: 180_000, pct: 12 },
  { category: 'IT & Software', category_ar: 'تكنولوجيا', amount: 95_000, pct: 6 },
  { category: 'Travel', category_ar: 'السفر', amount: 75_000, pct: 5 },
  { category: 'Other', category_ar: 'أخرى', amount: 110_000, pct: 7 },
];

const MOCK_INVOICE_AGING = [
  { range: '0-30 days', range_ar: '0-30 يوم', count: 45, amount: 890_000 },
  { range: '31-60 days', range_ar: '31-60 يوم', count: 18, amount: 420_000 },
  { range: '61-90 days', range_ar: '61-90 يوم', count: 8, amount: 195_000 },
  { range: '90+ days', range_ar: '90+ يوم', count: 5, amount: 310_000 },
];

const MOCK_CASHFLOW = [
  { month: 'Jan', month_ar: 'يناير', inflow: 410_000, outflow: 320_000 },
  { month: 'Feb', month_ar: 'فبراير', inflow: 380_000, outflow: 350_000 },
  { month: 'Mar', month_ar: 'مارس', inflow: 520_000, outflow: 390_000 },
  { month: 'Apr', month_ar: 'أبريل', inflow: 450_000, outflow: 410_000 },
  { month: 'May', month_ar: 'مايو', inflow: 490_000, outflow: 370_000 },
  { month: 'Jun', month_ar: 'يونيو', inflow: 560_000, outflow: 420_000 },
];

// ── Report definitions ───────────────────────────────────────────

const REPORT_CATEGORIES = [
  {
    key: 'crm', ar: 'تقارير CRM', en: 'CRM Reports', icon: Users, color: '#4A7AAB',
    reports: [
      { key: 'contacts_by_source', ar: 'جهات الاتصال حسب المصدر', en: 'Contacts by Source', desc_ar: 'توزيع جهات الاتصال على مصادر الاستقطاب', desc_en: 'Distribution of contacts across acquisition sources', icon: PieChart, data: MOCK_CONTACTS_BY_SOURCE },
      { key: 'leads_conversion', ar: 'معدل تحويل الليدز', en: 'Leads Conversion Rate', desc_ar: 'تتبع تحويل الليدز عبر مراحل البيع', desc_en: 'Track lead conversion through sales stages', icon: TrendingUp, data: MOCK_LEADS_CONVERSION },
      { key: 'pipeline', ar: 'تحليل خط الأنابيب', en: 'Pipeline Analysis', desc_ar: 'قيمة وعدد الصفقات في كل مرحلة', desc_en: 'Deal count and value at each pipeline stage', icon: BarChart3, data: MOCK_PIPELINE },
      { key: 'activity_summary', ar: 'ملخص النشاط', en: 'Activity Summary', desc_ar: 'إجمالي الأنشطة: مكالمات، اجتماعات، متابعات', desc_en: 'Total activities: calls, meetings, follow-ups', icon: Activity, data: MOCK_ACTIVITY_SUMMARY },
    ],
  },
  {
    key: 'sales', ar: 'تقارير المبيعات', en: 'Sales Reports', icon: DollarSign, color: '#4A7AAB',
    reports: [
      { key: 'revenue_by_month', ar: 'الإيرادات الشهرية', en: 'Revenue by Month', desc_ar: 'مقارنة الإيرادات الفعلية مع المستهدف', desc_en: 'Compare actual revenue vs target by month', icon: BarChart3, data: MOCK_REVENUE_BY_MONTH },
      { key: 'target_achievement', ar: 'تحقيق الأهداف', en: 'Target Achievement', desc_ar: 'أداء أفضل البائعين مقابل الأهداف', desc_en: 'Top performers achievement against targets', icon: TrendingUp, data: MOCK_TOP_PERFORMERS },
      { key: 'top_performers', ar: 'أفضل البائعين', en: 'Top Performers', desc_ar: 'ترتيب البائعين حسب الإيرادات والصفقات', desc_en: 'Ranking of sellers by revenue and deals', icon: Users, data: MOCK_TOP_PERFORMERS },
      { key: 'deal_cycle', ar: 'دورة الصفقة', en: 'Deal Cycle Time', desc_ar: 'متوسط الوقت لإغلاق الصفقات', desc_en: 'Average time to close deals by range', icon: Clock, data: MOCK_DEAL_CYCLE },
    ],
  },
  {
    key: 'hr', ar: 'تقارير الموارد البشرية', en: 'HR Reports', icon: Briefcase, color: '#6B8DB5',
    reports: [
      { key: 'attendance', ar: 'ملخص الحضور', en: 'Attendance Summary', desc_ar: 'حضور وغياب وتأخير كل قسم', desc_en: 'Present, absent and late counts per department', icon: UserCheck, data: MOCK_ATTENDANCE },
      { key: 'leave_balance', ar: 'رصيد الإجازات', en: 'Leave Balance', desc_ar: 'الرصيد المتبقي والمستخدم لكل موظف', desc_en: 'Remaining and used leave per employee', icon: Calendar, data: MOCK_LEAVE_BALANCE },
      { key: 'payroll', ar: 'ملخص الرواتب', en: 'Payroll Summary', desc_ar: 'إجمالي ومستقطعات وصافي رواتب كل قسم', desc_en: 'Gross, deductions and net payroll per dept', icon: CreditCard, data: MOCK_PAYROLL },
      { key: 'headcount', ar: 'عدد الموظفين حسب القسم', en: 'Headcount by Department', desc_ar: 'توزيع الموظفين على الأقسام', desc_en: 'Employee distribution across departments', icon: Building2, data: MOCK_HEADCOUNT },
    ],
  },
  {
    key: 'finance', ar: 'التقارير المالية', en: 'Finance Reports', icon: FileBarChart, color: '#2B4C6F',
    reports: [
      { key: 'pnl', ar: 'قائمة الدخل', en: 'P&L Statement', desc_ar: 'الإيرادات والمصروفات وصافي الربح', desc_en: 'Revenue, expenses and net profit overview', icon: FileText, data: MOCK_PNL },
      { key: 'expense_breakdown', ar: 'تفصيل المصروفات', en: 'Expense Breakdown', desc_ar: 'توزيع المصروفات على الفئات', desc_en: 'Expense distribution across categories', icon: PieChart, data: MOCK_EXPENSES },
      { key: 'invoice_aging', ar: 'أعمار الفواتير', en: 'Invoice Aging', desc_ar: 'الفواتير المستحقة حسب فترة التأخير', desc_en: 'Outstanding invoices by aging period', icon: Clock, data: MOCK_INVOICE_AGING },
      { key: 'cashflow', ar: 'التدفق النقدي', en: 'Cash Flow', desc_ar: 'التدفقات النقدية الداخلة والخارجة', desc_en: 'Cash inflows and outflows by month', icon: TrendingUp, data: MOCK_CASHFLOW },
    ],
  },
];

function renderReportTable(reportKey, data, lang) {
  const isAr = lang === 'ar';
  const fmt = (v) => typeof v === 'number' && v >= 1000 ? v.toLocaleString() : v;
  switch (reportKey) {
    case 'contacts_by_source': return { headers: [isAr?'المصدر':'Source',isAr?'العدد':'Count',isAr?'النسبة':'%'], rows: data.map(d=>[isAr?d.source_ar:d.source,d.count,d.pct+'%']) };
    case 'leads_conversion': return { headers: [isAr?'المرحلة':'Stage',isAr?'العدد':'Count',isAr?'المعدل':'Rate'], rows: data.map(d=>[isAr?d.stage_ar:d.stage,d.count,d.rate]) };
    case 'pipeline': return { headers: [isAr?'المرحلة':'Stage',isAr?'الصفقات':'Deals',isAr?'القيمة':'Value (EGP)'], rows: data.map(d=>[isAr?d.stage_ar:d.stage,d.deals,fmt(d.value)]) };
    case 'activity_summary': return { headers: [isAr?'النوع':'Type',isAr?'العدد':'Count',isAr?'الاتجاه':'Trend'], rows: data.map(d=>[isAr?d.type_ar:d.type,d.count,d.trend]) };
    case 'revenue_by_month': return { headers: [isAr?'الشهر':'Month',isAr?'الإيرادات':'Revenue',isAr?'المستهدف':'Target',isAr?'التحقيق':'Ach.%'], rows: data.map(d=>[isAr?d.month_ar:d.month,fmt(d.revenue),fmt(d.target),Math.round((d.revenue/d.target)*100)+'%']) };
    case 'target_achievement': case 'top_performers': return { headers: [isAr?'الاسم':'Name',isAr?'الصفقات':'Deals',isAr?'الإيرادات':'Revenue (EGP)'], rows: data.map(d=>[isAr?d.name_ar:d.name,d.deals,fmt(d.revenue)]) };
    case 'deal_cycle': return { headers: [isAr?'الفترة':'Range',isAr?'العدد':'Count',isAr?'النسبة':'%'], rows: data.map(d=>[isAr?d.range_ar:d.range,d.count,d.pct+'%']) };
    case 'attendance': return { headers: [isAr?'القسم':'Department',isAr?'حضور':'Present',isAr?'غياب':'Absent',isAr?'تأخير':'Late'], rows: data.map(d=>[isAr?d.dept_ar:d.dept,d.present,d.absent,d.late]) };
    case 'leave_balance': return { headers: [isAr?'الاسم':'Name',isAr?'سنوية':'Annual',isAr?'مرضية':'Sick',isAr?'مستخدمة':'Used'], rows: data.map(d=>[isAr?d.name_ar:d.name,d.annual,d.sick,d.used]) };
    case 'payroll': return { headers: [isAr?'القسم':'Department',isAr?'إجمالي':'Gross',isAr?'مستقطعات':'Deductions',isAr?'صافي':'Net'], rows: data.map(d=>[isAr?d.dept_ar:d.dept,fmt(d.gross),fmt(d.deductions),fmt(d.net)]) };
    case 'headcount': return { headers: [isAr?'القسم':'Department',isAr?'العدد':'Count',isAr?'ذكور':'Male',isAr?'إناث':'Female'], rows: data.map(d=>[isAr?d.dept_ar:d.dept,d.count,d.male,d.female]) };
    case 'pnl': return { headers: [isAr?'البند':'Item',isAr?'المبلغ (EGP)':'Amount (EGP)'], rows: data.map(d=>[isAr?d.item_ar:d.item,fmt(d.amount)]) };
    case 'expense_breakdown': return { headers: [isAr?'الفئة':'Category',isAr?'المبلغ':'Amount (EGP)',isAr?'النسبة':'%'], rows: data.map(d=>[isAr?d.category_ar:d.category,fmt(d.amount),d.pct+'%']) };
    case 'invoice_aging': return { headers: [isAr?'الفترة':'Period',isAr?'العدد':'Count',isAr?'المبلغ':'Amount (EGP)'], rows: data.map(d=>[isAr?d.range_ar:d.range,d.count,fmt(d.amount)]) };
    case 'cashflow': return { headers: [isAr?'الشهر':'Month',isAr?'وارد':'Inflow',isAr?'صادر':'Outflow',isAr?'صافي':'Net'], rows: data.map(d=>[isAr?d.month_ar:d.month,fmt(d.inflow),fmt(d.outflow),fmt(d.inflow-d.outflow)]) };
    default: return { headers: [], rows: [] };
  }
}

const DEPARTMENTS = [
  { id: 'all', ar: 'كل الأقسام', en: 'All Departments' },
  { id: 'sales', ar: 'المبيعات', en: 'Sales' },
  { id: 'marketing', ar: 'التسويق', en: 'Marketing' },
  { id: 'hr', ar: 'الموارد البشرية', en: 'HR' },
  { id: 'finance', ar: 'المالية', en: 'Finance' },
];

const DEPT_TO_CATEGORY = { sales: 'sales', marketing: 'crm', hr: 'hr', finance: 'finance' };

const DATE_RANGES = [
  { id: 'all', ar: 'كل الوقت', en: 'All Time' },
  { id: 'this_month', ar: 'هذا الشهر', en: 'This Month' },
  { id: 'last_3_months', ar: 'آخر 3 أشهر', en: 'Last 3 Months' },
  { id: 'last_6_months', ar: 'آخر 6 أشهر', en: 'Last 6 Months' },
  { id: 'this_year', ar: 'هذه السنة', en: 'This Year' },
];

// ── Target Tracker Data ──────────────────────────────────────────

const MONTHS = [
  { id: 'jan', ar: 'يناير', en: 'January' },
  { id: 'feb', ar: 'فبراير', en: 'February' },
  { id: 'mar', ar: 'مارس', en: 'March' },
  { id: 'apr', ar: 'أبريل', en: 'April' },
  { id: 'may', ar: 'مايو', en: 'May' },
  { id: 'jun', ar: 'يونيو', en: 'June' },
];

const MOCK_TARGETS = [
  { emp_id: 'e1', dept: 'sales', month: 'mar', target: 1500000, achieved: 1250000, deals: 8, units: 3 },
  { emp_id: 'e3', dept: 'sales', month: 'mar', target: 800000,  achieved: 790000,  deals: 5, units: 2 },
  { emp_id: 'e5', dept: 'sales', month: 'mar', target: 600000,  achieved: 480000,  deals: 3, units: 1 },
  { emp_id: 'e6', dept: 'sales', month: 'mar', target: 500000,  achieved: 520000,  deals: 4, units: 2 },
  { emp_id: 'e8', dept: 'sales', month: 'mar', target: 400000,  achieved: 210000,  deals: 2, units: 1 },
  { emp_id: 'e1', dept: 'sales', month: 'feb', target: 1500000, achieved: 1380000, deals: 9, units: 4 },
  { emp_id: 'e3', dept: 'sales', month: 'feb', target: 800000,  achieved: 650000,  deals: 4, units: 2 },
  { emp_id: 'e5', dept: 'sales', month: 'feb', target: 600000,  achieved: 600000,  deals: 4, units: 1 },
  { emp_id: 'e6', dept: 'sales', month: 'feb', target: 500000,  achieved: 390000,  deals: 3, units: 1 },
  { emp_id: 'e8', dept: 'sales', month: 'feb', target: 400000,  achieved: 440000,  deals: 3, units: 2 },
  { emp_id: 'e1', dept: 'sales', month: 'jan', target: 1200000, achieved: 1100000, deals: 7, units: 3 },
  { emp_id: 'e3', dept: 'sales', month: 'jan', target: 700000,  achieved: 720000,  deals: 5, units: 2 },
  { emp_id: 'e5', dept: 'sales', month: 'jan', target: 500000,  achieved: 310000,  deals: 2, units: 1 },
  { emp_id: 'e6', dept: 'sales', month: 'jan', target: 400000,  achieved: 450000,  deals: 4, units: 2 },
  { emp_id: 'e8', dept: 'sales', month: 'jan', target: 350000,  achieved: 180000,  deals: 1, units: 0 },
];

const fmt = (n) => { if (n >= 1000000) return (n/1000000).toFixed(1)+'M'; if (n >= 1000) return (n/1000).toFixed(0)+'K'; return n; };
const getRankIcon = (rank) => {
  if (rank === 1) return <Crown size={18} style={{ color: '#FFD700' }} />;
  if (rank === 2) return <Medal size={18} style={{ color: '#C0C0C0' }} />;
  if (rank === 3) return <Award size={18} style={{ color: '#CD7F32' }} />;
  return <span className="inline-block w-[18px] text-center text-xs font-bold text-content-muted dark:text-content-muted-dark">{rank}</span>;
};

// ── Target Tracker Tab Component ─────────────────────────────────

function TargetTrackerTab({ lang, isRTL }) {
  const [selectedMonth, setSelectedMonth] = useState('mar');
  const [sortBy, setSortBy] = useState('pct');
  const [targetDept, setTargetDept] = useState('all');

  const allEmps = useMemo(() => MOCK_EMPLOYEES, []);

  const monthData = useMemo(() => {
    return allEmps.map(emp => {
      const t = MOCK_TARGETS.find(t => t.emp_id === emp.id && t.month === selectedMonth);
      if (!t) return null;
      if (targetDept !== 'all' && t.dept !== targetDept) return null;
      const pct = Math.round((t.achieved / t.target) * 100);
      return { ...emp, ...t, pct };
    }).filter(Boolean).sort((a, b) => sortBy === 'pct' ? b.pct - a.pct : sortBy === 'achieved' ? b.achieved - a.achieved : b.deals - a.deals);
  }, [allEmps, selectedMonth, sortBy, targetDept]);

  const totalTarget = monthData.reduce((s, e) => s + e.target, 0);
  const totalAchieved = monthData.reduce((s, e) => s + e.achieved, 0);
  const totalPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const topPerformer = monthData[0];
  const aboveTarget = monthData.filter(e => e.pct >= 100).length;
  const monthLabel = (id) => { const m = MONTHS.find(m => m.id === id); return m ? (lang === 'ar' ? m.ar : m.en) : id; };
  const getPctColor = (pct) => pct >= 100 ? '#4A7AAB' : pct >= 80 ? '#6B8DB5' : pct >= 60 ? '#8BA8C8' : '#EF4444';
  const getTrend = (empId, currentPct) => {
    const prevMonth = selectedMonth === 'mar' ? 'feb' : selectedMonth === 'feb' ? 'jan' : null;
    if (!prevMonth) return 0;
    const prev = MOCK_TARGETS.find(t => t.emp_id === empId && t.month === prevMonth);
    if (!prev) return 0;
    return currentPct - Math.round((prev.achieved / prev.target) * 100);
  };

  return (
    <>
      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="flex gap-1.5 flex-wrap">
          {MONTHS.map(m => (
            <FilterPill key={m.id} active={selectedMonth === m.id} onClick={() => setSelectedMonth(m.id)} label={lang === 'ar' ? m.ar : m.en} />
          ))}
        </div>
        <Select value={targetDept} onChange={e => setTargetDept(e.target.value)} className="w-auto min-w-[130px]">
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.ar : d.en}</option>)}
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5">
        <KpiCard icon={Target} label={lang === 'ar' ? 'إجمالي التارجت' : 'Total Target'} value={fmt(totalTarget) + ' EGP'} sub={monthLabel(selectedMonth)} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang === 'ar' ? 'إجمالي المحقق' : 'Total Achieved'} value={fmt(totalAchieved) + ' EGP'} sub={`${totalPct}% ${lang === 'ar' ? 'من التارجت' : 'of target'}`} color={totalPct >= 100 ? '#4A7AAB' : '#EF4444'} />
        <KpiCard icon={Crown} label={lang === 'ar' ? 'الأول هذا الشهر' : 'Top Performer'} value={topPerformer ? (lang === 'ar' ? topPerformer.full_name_ar : topPerformer.full_name_en) : '—'} sub={topPerformer ? `${topPerformer.pct}%` : ''} color="#FFD700" />
        <KpiCard icon={Zap} label={lang === 'ar' ? 'حققوا التارجت' : 'Hit Target'} value={`${aboveTarget} / ${monthData.length}`} sub={lang === 'ar' ? 'موظف' : 'agents'} color="#4A7AAB" />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* Team Ranking Table */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-content dark:text-content-dark flex items-center gap-1.5">
              <BarChart3 size={16} className="text-brand-500" />
              {lang === 'ar' ? 'ترتيب الفريق' : 'Team Ranking'}
            </span>
            <div className="flex gap-1.5">
              {[{ key: 'pct', ar: 'بالنسبة', en: '% Target' }, { key: 'achieved', ar: 'بالمبلغ', en: 'Amount' }, { key: 'deals', ar: 'بالصفقات', en: 'Deals' }].map(s => (
                <FilterPill key={s.key} active={sortBy === s.key} onClick={() => setSortBy(s.key)} label={lang === 'ar' ? s.ar : s.en} />
              ))}
            </div>
          </CardHeader>
          {monthData.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'لا توجد بيانات تارجت لهذا القسم' : 'No target data for this department'}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[600px]">
              <thead>
                <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
                  {[{ ar: '#', en: '#', w: 'w-10' }, { ar: 'الموظف', en: 'Agent' }, { ar: 'التارجت', en: 'Target', w: 'w-[100px]' }, { ar: 'المحقق', en: 'Achieved', w: 'w-[100px]' }, { ar: 'النسبة', en: '% Done', w: 'w-[140px]' }, { ar: 'الصفقات', en: 'Deals', w: 'w-[70px]' }, { ar: 'التغيير', en: 'vs Last', w: 'w-[80px]' }].map((h, i) => (
                    <Th key={i} className={`whitespace-nowrap ${h.w || ''}`}>{lang === 'ar' ? h.ar : h.en}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthData.map((emp, idx) => {
                  const trend = getTrend(emp.id, emp.pct);
                  const pctColor = getPctColor(emp.pct);
                  return (
                    <Tr key={emp.id}>
                      <Td className="text-center">{getRankIcon(idx + 1)}</Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: emp.avatar_color || '#4A7AAB' }}>
                            {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                            <div className="text-xs text-content-muted dark:text-content-muted-dark mt-px">{emp.department || emp.role}</div>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-xs text-content-muted dark:text-content-muted-dark font-medium">{fmt(emp.target)}</Td>
                      <Td className="text-xs font-bold text-content dark:text-content-dark">{fmt(emp.achieved)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12] min-w-[60px]">
                            <div className="h-full rounded" style={{ width: `${Math.min(emp.pct, 100)}%`, background: pctColor }} />
                          </div>
                          <span className="text-xs font-bold min-w-[36px] text-center" style={{ color: pctColor }}>{emp.pct}%</span>
                        </div>
                      </Td>
                      <Td className="text-center text-xs font-semibold text-content dark:text-content-dark">{emp.deals}</Td>
                      <Td className="text-center">
                        {trend > 0 ? <span className="inline-flex items-center gap-0.5 text-brand-500 text-xs font-bold"><ChevronUp size={14} />+{trend}%</span>
                          : trend < 0 ? <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-bold"><ChevronDown size={14} />{trend}%</span>
                          : <span className="inline-flex items-center gap-0.5 text-content-muted dark:text-content-muted-dark text-xs"><Minus size={14} />—</span>}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Podium */}
          <Card className="p-5">
            <div className="text-xs font-semibold text-content dark:text-content-dark mb-4 flex items-center gap-1.5">
              <Trophy size={15} style={{ color: '#FFD700' }} /> {lang === 'ar' ? 'البودييم' : 'Podium'}
            </div>
            <div className="flex items-end justify-center gap-2 mb-5 h-[100px]">
              {[1, 0, 2].map((idx) => {
                const emp = monthData[idx];
                if (!emp) return null;
                const heights = [80, 100, 65];
                const podiumColors = ['#C0C0C0', '#FFD700', '#CD7F32'];
                return (
                  <div key={idx} className="flex flex-col items-center w-20">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white mb-1.5" style={{ background: emp.avatar_color || '#4A7AAB', border: `2px solid ${podiumColors[idx]}` }}>
                      {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                    </div>
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1 text-center">
                      {lang === 'ar' ? emp.full_name_ar.split(' ')[0] : emp.full_name_en.split(' ')[0]}
                    </div>
                    <div className="w-[72px] rounded-t-md flex items-center justify-center text-xs font-bold" style={{ height: heights[idx], background: `${podiumColors[idx]}22`, border: `1px solid ${podiumColors[idx]}`, color: podiumColors[idx] }}>
                      {idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
            {monthData.slice(0, 3).map((emp, idx) => (
              <div key={emp.id} className={`flex items-center gap-2.5 py-2 ${idx < 2 ? 'border-b border-edge dark:border-edge-dark' : ''}`}>
                <div className="w-5 text-center">{getRankIcon(idx + 1)}</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark">{fmt(emp.achieved)} EGP</div>
                </div>
                <Badge size="sm" className="font-bold rounded-md" style={{ color: getPctColor(emp.pct), background: `${getPctColor(emp.pct)}15` }}>{emp.pct}%</Badge>
              </div>
            ))}
          </Card>

          {/* Team Trend */}
          <Card className="p-5">
            <div className="text-xs font-semibold text-content dark:text-content-dark mb-3.5 flex items-center gap-1.5">
              <TrendingUp size={15} className="text-brand-500" /> {lang === 'ar' ? 'اتجاه الفريق (آخر 3 أشهر)' : 'Team Trend (Last 3M)'}
            </div>
            {['mar', 'feb', 'jan'].map((m) => {
              const mData = MOCK_TARGETS.filter(t => t.month === m && (targetDept === 'all' || t.dept === targetDept));
              if (!mData.length) return null;
              const mPct = Math.round((mData.reduce((s,t)=>s+t.achieved,0) / mData.reduce((s,t)=>s+t.target,0)) * 100);
              const mLabel = MONTHS.find(mo => mo.id === m);
              return (
                <div key={m} className="mb-2.5">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? mLabel.ar : mLabel.en}</span>
                    <span className="text-xs font-bold" style={{ color: getPctColor(mPct) }}>{mPct}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12]">
                    <div className="h-full rounded" style={{ width: `${Math.min(mPct,100)}%`, background: m === selectedMonth ? '#4A7AAB' : '#6B8DB5' }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────

// ── KPI Performance Tab ──────────────────────────────────────────

const KPI_MONTHS = [
  { id: 1, ar: 'يناير', en: 'January' },
  { id: 2, ar: 'فبراير', en: 'February' },
  { id: 3, ar: 'مارس', en: 'March' },
  { id: 4, ar: 'أبريل', en: 'April' },
  { id: 5, ar: 'مايو', en: 'May' },
  { id: 6, ar: 'يونيو', en: 'June' },
  { id: 7, ar: 'يوليو', en: 'July' },
  { id: 8, ar: 'أغسطس', en: 'August' },
  { id: 9, ar: 'سبتمبر', en: 'September' },
  { id: 10, ar: 'أكتوبر', en: 'October' },
  { id: 11, ar: 'نوفمبر', en: 'November' },
  { id: 12, ar: 'ديسمبر', en: 'December' },
];

function KpiPerformanceTab({ lang, isRTL }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear] = useState(new Date().getFullYear());
  const [editingCell, setEditingCell] = useState(null); // { empId, metric }
  const [editValue, setEditValue] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const salesEmployees = useMemo(() =>
    MOCK_EMPLOYEES.filter(e => ['sales_director','sales_manager','team_leader','sales_agent'].includes(e.role)),
  []);

  const teamKpis = useMemo(() =>
    getTeamKPIs(salesEmployees, selectedMonth, selectedYear),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [salesEmployees, selectedMonth, selectedYear, refreshKey]);

  const teamOverall = teamKpis.length > 0
    ? Math.round(teamKpis.reduce((s, k) => s + k.overallPct, 0) / teamKpis.length)
    : 0;

  const aboveTarget = teamKpis.filter(k => k.overallPct >= 80).length;

  const getPctColor = (pct) => pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  const fmtVal = (metric, val) => metric === 'revenue' ? (val >= 1000000 ? (val/1000000).toFixed(1)+'M' : val >= 1000 ? (val/1000).toFixed(0)+'K' : val) : val;

  const handleSaveEdit = (empId, metric) => {
    const val = Number(editValue);
    if (!isNaN(val) && val >= 0) {
      setTargets(empId, selectedMonth, selectedYear, { [metric]: val });
      setRefreshKey(k => k + 1);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const monthLabel = KPI_MONTHS.find(m => m.id === selectedMonth);

  // Pick 4 key metrics to show in table (space-efficient)
  const TABLE_METRICS = ['calls', 'new_opportunities', 'closed_deals', 'revenue'];

  return (
    <>
      {/* Month selector */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {KPI_MONTHS.filter(m => m.id <= new Date().getMonth() + 1).map(m => (
          <FilterPill key={m.id} active={selectedMonth === m.id} onClick={() => setSelectedMonth(m.id)} label={lang === 'ar' ? m.ar : m.en} />
        ))}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5">
        <KpiCard icon={Target} label={lang === 'ar' ? 'أداء الفريق' : 'Team Performance'} value={`${teamOverall}%`} sub={lang === 'ar' ? monthLabel?.ar : monthLabel?.en} color={getPctColor(teamOverall)} />
        <KpiCard icon={Users} label={lang === 'ar' ? 'أعضاء الفريق' : 'Team Members'} value={teamKpis.length} sub={lang === 'ar' ? 'موظف مبيعات' : 'sales agents'} color="#4A7AAB" />
        <KpiCard icon={Award} label={lang === 'ar' ? 'فوق 80%' : 'Above 80%'} value={`${aboveTarget} / ${teamKpis.length}`} sub={lang === 'ar' ? 'حققوا الهدف' : 'hit target'} color="#10B981" />
        <KpiCard icon={Trophy} label={lang === 'ar' ? 'الأفضل' : 'Top Performer'} value={teamKpis[0] ? (lang === 'ar' ? teamKpis[0].employee.full_name_ar.split(' ')[0] : teamKpis[0].employee.full_name_en.split(' ')[0]) : '—'} sub={teamKpis[0] ? `${teamKpis[0].overallPct}%` : ''} color="#FFD700" />
      </div>

      {/* Main KPI Table */}
      <Card className="overflow-hidden mb-5">
        <CardHeader className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-content dark:text-content-dark flex items-center gap-1.5">
            <BarChart3 size={16} className="text-brand-500" />
            {lang === 'ar' ? 'أداء الفريق — ' + (monthLabel?.ar || '') : 'Team Performance — ' + (monthLabel?.en || '')}
          </span>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {lang === 'ar' ? 'اضغط على الرقم المستهدف للتعديل' : 'Click target value to edit'}
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[800px]">
            <thead>
              <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
                <Th className="w-10">#</Th>
                <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                {TABLE_METRICS.map(m => (
                  <Th key={m} className="text-center w-[130px]">
                    <div className="text-center">
                      <div className="text-[10px]">{lang === 'ar' ? METRIC_CONFIG[m].ar : METRIC_CONFIG[m].en}</div>
                      <div className="text-[9px] text-content-muted dark:text-content-muted-dark mt-0.5">{lang === 'ar' ? 'هدف / فعلي' : 'Target / Actual'}</div>
                    </div>
                  </Th>
                ))}
                <Th className="w-[100px] text-center">{lang === 'ar' ? 'الإجمالي' : 'Overall %'}</Th>
              </tr>
            </thead>
            <tbody>
              {teamKpis.map((row, idx) => {
                const pctColor = getPctColor(row.overallPct);
                return (
                  <Tr key={row.employee.id}>
                    <Td className="text-center">{getRankIcon(idx + 1)}</Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: row.employee.avatar_color || '#4A7AAB' }}>
                          {(lang === 'ar' ? row.employee.full_name_ar : row.employee.full_name_en).charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? row.employee.full_name_ar : row.employee.full_name_en}</div>
                          <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-px">{lang === 'ar' ? row.employee.job_title_ar : row.employee.job_title_en}</div>
                        </div>
                      </div>
                    </Td>
                    {TABLE_METRICS.map(metric => {
                      const m = row.metrics.find(x => x.metric === metric);
                      if (!m) return <Td key={metric} />;
                      const mColor = getPctColor(m.pct);
                      const isEditing = editingCell?.empId === row.employee.id && editingCell?.metric === metric;
                      return (
                        <Td key={metric} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1 text-xs">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="w-16 px-1 py-0.5 rounded border border-brand-500 text-center text-xs bg-surface-bg dark:bg-surface-bg-dark text-content dark:text-content-dark outline-none"
                                  value={editValue}
                                  autoFocus
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(row.employee.id, metric); if (e.key === 'Escape') setEditingCell(null); }}
                                  onBlur={() => handleSaveEdit(row.employee.id, metric)}
                                />
                              ) : (
                                <span
                                  className="text-content-muted dark:text-content-muted-dark cursor-pointer hover:text-brand-500 transition-colors"
                                  title={lang === 'ar' ? 'اضغط للتعديل' : 'Click to edit'}
                                  onClick={() => { setEditingCell({ empId: row.employee.id, metric }); setEditValue(String(m.target)); }}
                                >
                                  {fmtVal(metric, m.target)}
                                </span>
                              )}
                              <span className="text-content-muted dark:text-content-muted-dark">/</span>
                              <span className="font-bold" style={{ color: mColor }}>{fmtVal(metric, m.actual)}</span>
                            </div>
                            <div className="w-full h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12] max-w-[80px]">
                              <div className="h-full rounded" style={{ width: `${Math.min(m.pct, 100)}%`, background: mColor }} />
                            </div>
                            <span className="text-[10px] font-bold" style={{ color: mColor }}>{m.pct}%</span>
                          </div>
                        </Td>
                      );
                    })}
                    <Td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-extrabold" style={{ color: pctColor }}>{row.overallPct}%</span>
                        <div className="w-full h-2 rounded bg-gray-200 dark:bg-brand-500/[0.12] max-w-[60px]">
                          <div className="h-full rounded" style={{ width: `${Math.min(row.overallPct, 100)}%`, background: pctColor }} />
                        </div>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* All Metrics Detail — expandable cards per employee */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamKpis.map(row => {
          const pctColor = getPctColor(row.overallPct);
          return (
            <Card key={row.employee.id} className="p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: row.employee.avatar_color || '#4A7AAB' }}>
                  {(lang === 'ar' ? row.employee.full_name_ar : row.employee.full_name_en).charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-content dark:text-content-dark">{lang === 'ar' ? row.employee.full_name_ar : row.employee.full_name_en}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? row.employee.job_title_ar : row.employee.job_title_en}</div>
                </div>
                <Badge size="sm" className="font-bold rounded-md" style={{ color: pctColor, background: `${pctColor}15` }}>{row.overallPct}%</Badge>
              </div>
              {row.metrics.map(m => {
                const cfg = METRIC_CONFIG[m.metric];
                const mColor = getPctColor(m.pct);
                return (
                  <div key={m.metric} className="mb-2.5 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? cfg.ar : cfg.en}</span>
                      <span className="text-[11px]"><span className="text-content-muted dark:text-content-muted-dark">{fmtVal(m.metric, m.actual)}</span> <span className="mx-0.5 text-content-muted dark:text-content-muted-dark">/</span> <span className="text-content dark:text-content-dark font-medium">{fmtVal(m.metric, m.target)}</span></span>
                    </div>
                    <div className="w-full h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12]">
                      <div className="h-full rounded transition-all duration-300" style={{ width: `${Math.min(m.pct, 100)}%`, background: mColor }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </>
  );
}

const TABS = [
  { id: 'reports', ar: 'التقارير', en: 'Reports', icon: FileText },
  { id: 'targets', ar: 'التارجت', en: 'Targets', icon: Trophy },
  { id: 'kpi', ar: 'أداء الفريق', en: 'Team Performance', icon: Target },
];

export default function ReportsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [activeTab, setActiveTab] = useState('reports');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [activeReport, setActiveReport] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('report');

  // Flatten all reports with category info for SmartFilter
  const allReports = useMemo(() => {
    return REPORT_CATEGORIES.flatMap(cat =>
      cat.reports.map(r => ({
        ...r,
        category_key: cat.key,
        category_label_ar: cat.ar,
        category_label_en: cat.en,
        name_en: r.en,
        name_ar: r.ar,
      }))
    );
  }, []);

  const SMART_FIELDS = useMemo(() => [
    { id: 'category_key', label: 'الفئة', labelEn: 'Category', type: 'select', options: REPORT_CATEGORIES.map(c => ({ value: c.key, label: c.ar, labelEn: c.en })) },
    { id: 'name_en', label: 'اسم التقرير', labelEn: 'Report Name', type: 'text' },
    { id: 'name_ar', label: 'اسم التقرير (عربي)', labelEn: 'Report Name (AR)', type: 'text' },
    ...auditFields,
  ], [auditFields]);

  // Load real data for reports
  useEffect(() => {
    setLoading(true);
    fetchReportsData(profile).then(data => {
      setLiveData(data);
    }).finally(() => setLoading(false));
  }, [profile]);

  // Compute live report data with date range filtering
  const liveReports = useMemo(() => {
    if (!liveData) return {};
    const contacts = filterByDateRange(liveData.contacts, dateRange);
    const opportunities = filterByDateRange(liveData.opportunities, dateRange);
    const deals = filterByDateRange(liveData.deals, dateRange);
    const activities = filterByDateRange(liveData.activities, dateRange);
    const employees = liveData.employees || [];
    const attendance = filterByDateRange(liveData.attendance || [], dateRange, 'date');
    const invoices = filterByDateRange(liveData.invoices || [], dateRange, 'date');
    const expenses = filterByDateRange(liveData.expenses || [], dateRange, 'date');

    return {
      // CRM
      contacts_by_source: computeContactsBySource(contacts),
      leads_conversion: computeLeadsConversion(contacts, opportunities, deals),
      pipeline: computePipeline(opportunities),
      activity_summary: computeActivitySummary(activities),
      // Sales
      revenue_by_month: computeRevenueByMonth(deals),
      target_achievement: computeTopPerformers(deals),
      top_performers: computeTopPerformers(deals),
      deal_cycle: computeDealCycle(deals),
      // HR
      attendance: computeAttendance(attendance, employees),
      leave_balance: computeLeaveBalance(employees),
      payroll: computePayroll(employees),
      headcount: computeHeadcount(employees),
      // Finance
      pnl: computePnl(invoices, expenses),
      expense_breakdown: computeExpenseBreakdown(expenses),
      invoice_aging: computeInvoiceAging(invoices),
      cashflow: computeCashflow(invoices, expenses),
    };
  }, [liveData, dateRange]);

  // Get report data — use live if available, fallback to mock
  const getReportData = (reportKey, mockData) => {
    return liveReports[reportKey] && liveReports[reportKey].length > 0 ? liveReports[reportKey] : mockData;
  };

  // Apply SmartFilter + audit filters on flat reports
  const smartFiltered = useMemo(() => {
    let result = applySmartFilters(allReports, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [allReports, smartFilters, SMART_FIELDS, applyAuditFilters]);

  // Rebuild categories from filtered reports, also respect deptFilter
  const filteredCategories = useMemo(() => {
    const smartKeys = new Set(smartFiltered.map(r => r.key));
    const hasSmartFilter = smartFilters.length > 0;

    let cats = REPORT_CATEGORIES.map(cat => ({
      ...cat,
      reports: cat.reports.filter(r => !hasSmartFilter || smartKeys.has(r.key)),
    })).filter(cat => cat.reports.length > 0);

    if (deptFilter !== 'all') {
      const catKey = DEPT_TO_CATEGORY[deptFilter];
      cats = cats.filter(c => c.key === catKey || (deptFilter === 'sales' && c.key === 'crm'));
    }
    return cats;
  }, [deptFilter, smartFiltered, smartFilters]);

  // Flatten filtered reports for pagination
  const allFilteredReports = useMemo(() =>
    filteredCategories.flatMap(cat => cat.reports.map(r => ({ ...r, _cat: cat }))),
  [filteredCategories]);

  const totalFilteredReports = allFilteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredReports / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedReports = allFilteredReports.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Rebuild paged categories from paged reports
  const pagedCategories = useMemo(() => {
    const catMap = new Map();
    pagedReports.forEach(r => {
      if (!catMap.has(r._cat.key)) catMap.set(r._cat.key, { ...r._cat, reports: [] });
      catMap.get(r._cat.key).reports.push(r);
    });
    return [...catMap.values()];
  }, [pagedReports]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [smartFilters, deptFilter, dateRange]);

  const totalReports = REPORT_CATEGORIES.reduce((s, c) => s + c.reports.length, 0);

  function handleGenerate(report, category) {
    const data = getReportData(report.key, report.data);
    setActiveReport({ report: { ...report, data }, category, liveData: data });
    setModalOpen(true);
  }

  const reportTable = activeReport ? renderReportTable(activeReport.report.key, activeReport.liveData || activeReport.report.data, lang) : null;
  const exportData = reportTable ? reportTable.rows.map(row => { const obj = {}; reportTable.headers.forEach((h, i) => { obj[h] = row[i]; }); return obj; }) : [];
  const exportColumns = reportTable ? reportTable.headers.map(h => ({ header: h, key: h })) : [];

  return (
    <div className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <FileText size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'مركز التقارير' : 'Reports Hub'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'تقارير جاهزة ومتابعة التارجت' : 'Reports & Target Tracking'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-edge dark:border-edge-dark">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors bg-transparent border-x-0 border-t-0 ${
                isActive
                  ? 'border-brand-500 text-brand-500'
                  : 'border-transparent text-content-muted dark:text-content-muted-dark hover:text-content dark:hover:text-content-dark'
              }`}
            >
              <Icon size={16} />
              {lang === 'ar' ? tab.ar : tab.en}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'kpi' ? (
        <KpiPerformanceTab lang={lang} isRTL={isRTL} />
      ) : activeTab === 'targets' ? (
        <TargetTrackerTab lang={lang} isRTL={isRTL} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
            <KpiCard icon={FileText} label={lang === 'ar' ? 'إجمالي التقارير' : 'Total Reports'} value={totalReports} color="#4A7AAB" />
            <KpiCard icon={Users} label={lang === 'ar' ? 'تقارير CRM' : 'CRM Reports'} value={4} color="#4A7AAB" />
            <KpiCard icon={DollarSign} label={lang === 'ar' ? 'تقارير مالية' : 'Finance Reports'} value={4} color="#2B4C6F" />
            <KpiCard icon={Briefcase} label={lang === 'ar' ? 'تقارير HR' : 'HR Reports'} value={4} color="#6B8DB5" />
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الفترة' : 'Period'}</label>
              <Select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-auto min-w-[160px]">
                {DATE_RANGES.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.ar : d.en}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'من تاريخ' : 'From'}</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'إلى تاريخ' : 'To'}</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'القسم' : 'Department'}</label>
              <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-auto min-w-[160px]">
                {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.ar : d.en}</option>)}
              </Select>
            </div>
          </div>

          {/* SmartFilter */}
          <SmartFilter
            fields={SMART_FIELDS}
            filters={smartFilters}
            onFiltersChange={setSmartFilters}
            resultsCount={totalFilteredReports}
          />

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-content-muted dark:text-content-muted-dark">
                  {lang === 'ar' ? 'جاري تحميل البيانات...' : 'Loading report data...'}
                </span>
              </div>
            </div>
          )}

          {/* Report Categories */}
          {pagedCategories.map(category => {
            const CatIcon = category.icon;
            return (
              <div key={category.key} className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <CatIcon size={18} style={{ color: category.color }} />
                  <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">{lang === 'ar' ? category.ar : category.en}</h2>
                  <Badge size="sm" className="rounded-full" style={{ background: category.color + '20', color: category.color }}>{category.reports.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {category.reports.map(report => {
                    const RIcon = report.icon;
                    return (
                      <Card key={report.key} hover className="px-5 py-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: category.color + '15' }}>
                            <RIcon size={18} style={{ color: category.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="m-0 text-sm font-semibold text-content dark:text-content-dark mb-0.5">{lang === 'ar' ? report.ar : report.en}</h3>
                            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark leading-relaxed">{lang === 'ar' ? report.desc_ar : report.desc_en}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Button size="sm" variant="secondary" onClick={() => handleGenerate(report, category)}>
                              <ArrowDownToLine size={14} /> {lang === 'ar' ? 'إنشاء' : 'Generate'}
                            </Button>
                            {liveReports[report.key]?.length > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {lang === 'ar' ? 'بيانات حية' : 'Live data'}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={v => { setPageSize(v); setPage(1); }}
            totalItems={totalFilteredReports}
            safePage={safePage}
          />
        </>
      )}

      {/* Generated Report Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={activeReport ? (lang === 'ar' ? activeReport.report.ar : activeReport.report.en) : ''} width="max-w-3xl">
        {reportTable && (
          <div>
            <div className="flex justify-end mb-4">
              <ExportButton data={exportData} filename={activeReport?.report.key || 'report'} title={lang === 'ar' ? activeReport?.report.ar : activeReport?.report.en} columns={exportColumns} />
            </div>
            {(dateRange !== 'all' || dateFrom || dateTo) && (
              <div className="text-xs text-content-muted dark:text-content-muted-dark mb-3">
                {lang === 'ar' ? 'الفترة:' : 'Period:'}{' '}
                {dateRange !== 'all'
                  ? (lang === 'ar' ? DATE_RANGES.find(d => d.id === dateRange)?.ar : DATE_RANGES.find(d => d.id === dateRange)?.en)
                  : `${dateFrom || '—'} → ${dateTo || '—'}`}
              </div>
            )}
            <Table>
              <thead><tr>{reportTable.headers.map((h, i) => <Th key={i}>{h}</Th>)}</tr></thead>
              <tbody>{reportTable.rows.map((row, ri) => <Tr key={ri}>{row.map((cell, ci) => <Td key={ci} className={ci === 0 ? 'font-semibold' : ''}>{cell}</Td>)}</Tr>)}</tbody>
            </Table>
            {activeReport && liveReports[activeReport.report.key]?.length > 0 ? (
              <div className="mt-4 px-4 py-3 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-xs text-emerald-700 dark:text-emerald-400 text-start">
                {lang === 'ar' ? 'بيانات حقيقية من النظام' : 'Live data from system'}
              </div>
            ) : (
              <div className="mt-4 px-4 py-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15] text-xs text-amber-700 dark:text-amber-400 text-start">
                {lang === 'ar' ? 'بيانات تجريبية — لا توجد بيانات حقيقية كافية' : 'Sample data — not enough live data available'}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
