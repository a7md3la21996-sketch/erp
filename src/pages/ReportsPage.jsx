import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Users, DollarSign, Briefcase, BarChart3,
  TrendingUp, Calendar, Clock, PieChart, Activity,
  CreditCard, Building2, UserCheck, FileBarChart,
  ArrowDownToLine, Filter
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import KpiCard from '../components/ui/KpiCard';
import ExportButton from '../components/ui/ExportButton';
import { Table, Th, Td, Tr } from '../components/ui/Table';

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
    key: 'crm',
    ar: 'تقارير CRM',
    en: 'CRM Reports',
    icon: Users,
    color: '#4A7AAB',
    reports: [
      { key: 'contacts_by_source', ar: 'جهات الاتصال حسب المصدر', en: 'Contacts by Source', desc_ar: 'توزيع جهات الاتصال على مصادر الاستقطاب', desc_en: 'Distribution of contacts across acquisition sources', icon: PieChart, data: MOCK_CONTACTS_BY_SOURCE },
      { key: 'leads_conversion', ar: 'معدل تحويل الليدز', en: 'Leads Conversion Rate', desc_ar: 'تتبع تحويل الليدز عبر مراحل البيع', desc_en: 'Track lead conversion through sales stages', icon: TrendingUp, data: MOCK_LEADS_CONVERSION },
      { key: 'pipeline', ar: 'تحليل خط الأنابيب', en: 'Pipeline Analysis', desc_ar: 'قيمة وعدد الصفقات في كل مرحلة', desc_en: 'Deal count and value at each pipeline stage', icon: BarChart3, data: MOCK_PIPELINE },
      { key: 'activity_summary', ar: 'ملخص النشاط', en: 'Activity Summary', desc_ar: 'إجمالي الأنشطة: مكالمات، اجتماعات، متابعات', desc_en: 'Total activities: calls, meetings, follow-ups', icon: Activity, data: MOCK_ACTIVITY_SUMMARY },
    ],
  },
  {
    key: 'sales',
    ar: 'تقارير المبيعات',
    en: 'Sales Reports',
    icon: DollarSign,
    color: '#4A7AAB',
    reports: [
      { key: 'revenue_by_month', ar: 'الإيرادات الشهرية', en: 'Revenue by Month', desc_ar: 'مقارنة الإيرادات الفعلية مع المستهدف', desc_en: 'Compare actual revenue vs target by month', icon: BarChart3, data: MOCK_REVENUE_BY_MONTH },
      { key: 'target_achievement', ar: 'تحقيق الأهداف', en: 'Target Achievement', desc_ar: 'أداء أفضل البائعين مقابل الأهداف', desc_en: 'Top performers achievement against targets', icon: TrendingUp, data: MOCK_TOP_PERFORMERS },
      { key: 'top_performers', ar: 'أفضل البائعين', en: 'Top Performers', desc_ar: 'ترتيب البائعين حسب الإيرادات والصفقات', desc_en: 'Ranking of sellers by revenue and deals', icon: Users, data: MOCK_TOP_PERFORMERS },
      { key: 'deal_cycle', ar: 'دورة الصفقة', en: 'Deal Cycle Time', desc_ar: 'متوسط الوقت لإغلاق الصفقات', desc_en: 'Average time to close deals by range', icon: Clock, data: MOCK_DEAL_CYCLE },
    ],
  },
  {
    key: 'hr',
    ar: 'تقارير الموارد البشرية',
    en: 'HR Reports',
    icon: Briefcase,
    color: '#6B8DB5',
    reports: [
      { key: 'attendance', ar: 'ملخص الحضور', en: 'Attendance Summary', desc_ar: 'حضور وغياب وتأخير كل قسم', desc_en: 'Present, absent and late counts per department', icon: UserCheck, data: MOCK_ATTENDANCE },
      { key: 'leave_balance', ar: 'رصيد الإجازات', en: 'Leave Balance', desc_ar: 'الرصيد المتبقي والمستخدم لكل موظف', desc_en: 'Remaining and used leave per employee', icon: Calendar, data: MOCK_LEAVE_BALANCE },
      { key: 'payroll', ar: 'ملخص الرواتب', en: 'Payroll Summary', desc_ar: 'إجمالي ومستقطعات وصافي رواتب كل قسم', desc_en: 'Gross, deductions and net payroll per dept', icon: CreditCard, data: MOCK_PAYROLL },
      { key: 'headcount', ar: 'عدد الموظفين حسب القسم', en: 'Headcount by Department', desc_ar: 'توزيع الموظفين على الأقسام', desc_en: 'Employee distribution across departments', icon: Building2, data: MOCK_HEADCOUNT },
    ],
  },
  {
    key: 'finance',
    ar: 'التقارير المالية',
    en: 'Finance Reports',
    icon: FileBarChart,
    color: '#2B4C6F',
    reports: [
      { key: 'pnl', ar: 'قائمة الدخل', en: 'P&L Statement', desc_ar: 'الإيرادات والمصروفات وصافي الربح', desc_en: 'Revenue, expenses and net profit overview', icon: FileText, data: MOCK_PNL },
      { key: 'expense_breakdown', ar: 'تفصيل المصروفات', en: 'Expense Breakdown', desc_ar: 'توزيع المصروفات على الفئات', desc_en: 'Expense distribution across categories', icon: PieChart, data: MOCK_EXPENSES },
      { key: 'invoice_aging', ar: 'أعمار الفواتير', en: 'Invoice Aging', desc_ar: 'الفواتير المستحقة حسب فترة التأخير', desc_en: 'Outstanding invoices by aging period', icon: Clock, data: MOCK_INVOICE_AGING },
      { key: 'cashflow', ar: 'التدفق النقدي', en: 'Cash Flow', desc_ar: 'التدفقات النقدية الداخلة والخارجة', desc_en: 'Cash inflows and outflows by month', icon: TrendingUp, data: MOCK_CASHFLOW },
    ],
  },
];

// ── Report table renderers ───────────────────────────────────────

function renderReportTable(reportKey, data, lang) {
  const isAr = lang === 'ar';
  const fmt = (v) => typeof v === 'number' && v >= 1000 ? v.toLocaleString() : v;

  switch (reportKey) {
    case 'contacts_by_source':
      return { headers: [isAr ? 'المصدر' : 'Source', isAr ? 'العدد' : 'Count', isAr ? 'النسبة' : '%'], rows: data.map(d => [isAr ? d.source_ar : d.source, d.count, d.pct + '%']) };
    case 'leads_conversion':
      return { headers: [isAr ? 'المرحلة' : 'Stage', isAr ? 'العدد' : 'Count', isAr ? 'المعدل' : 'Rate'], rows: data.map(d => [isAr ? d.stage_ar : d.stage, d.count, d.rate]) };
    case 'pipeline':
      return { headers: [isAr ? 'المرحلة' : 'Stage', isAr ? 'الصفقات' : 'Deals', isAr ? 'القيمة' : 'Value (EGP)'], rows: data.map(d => [isAr ? d.stage_ar : d.stage, d.deals, fmt(d.value)]) };
    case 'activity_summary':
      return { headers: [isAr ? 'النوع' : 'Type', isAr ? 'العدد' : 'Count', isAr ? 'الاتجاه' : 'Trend'], rows: data.map(d => [isAr ? d.type_ar : d.type, d.count, d.trend]) };
    case 'revenue_by_month':
      return { headers: [isAr ? 'الشهر' : 'Month', isAr ? 'الإيرادات' : 'Revenue', isAr ? 'المستهدف' : 'Target', isAr ? 'التحقيق' : 'Ach.%'], rows: data.map(d => [isAr ? d.month_ar : d.month, fmt(d.revenue), fmt(d.target), Math.round((d.revenue / d.target) * 100) + '%']) };
    case 'target_achievement':
    case 'top_performers':
      return { headers: [isAr ? 'الاسم' : 'Name', isAr ? 'الصفقات' : 'Deals', isAr ? 'الإيرادات' : 'Revenue (EGP)'], rows: data.map(d => [isAr ? d.name_ar : d.name, d.deals, fmt(d.revenue)]) };
    case 'deal_cycle':
      return { headers: [isAr ? 'الفترة' : 'Range', isAr ? 'العدد' : 'Count', isAr ? 'النسبة' : '%'], rows: data.map(d => [isAr ? d.range_ar : d.range, d.count, d.pct + '%']) };
    case 'attendance':
      return { headers: [isAr ? 'القسم' : 'Department', isAr ? 'حضور' : 'Present', isAr ? 'غياب' : 'Absent', isAr ? 'تأخير' : 'Late'], rows: data.map(d => [isAr ? d.dept_ar : d.dept, d.present, d.absent, d.late]) };
    case 'leave_balance':
      return { headers: [isAr ? 'الاسم' : 'Name', isAr ? 'سنوية' : 'Annual', isAr ? 'مرضية' : 'Sick', isAr ? 'مستخدمة' : 'Used'], rows: data.map(d => [isAr ? d.name_ar : d.name, d.annual, d.sick, d.used]) };
    case 'payroll':
      return { headers: [isAr ? 'القسم' : 'Department', isAr ? 'إجمالي' : 'Gross', isAr ? 'مستقطعات' : 'Deductions', isAr ? 'صافي' : 'Net'], rows: data.map(d => [isAr ? d.dept_ar : d.dept, fmt(d.gross), fmt(d.deductions), fmt(d.net)]) };
    case 'headcount':
      return { headers: [isAr ? 'القسم' : 'Department', isAr ? 'العدد' : 'Count', isAr ? 'ذكور' : 'Male', isAr ? 'إناث' : 'Female'], rows: data.map(d => [isAr ? d.dept_ar : d.dept, d.count, d.male, d.female]) };
    case 'pnl':
      return { headers: [isAr ? 'البند' : 'Item', isAr ? 'المبلغ (EGP)' : 'Amount (EGP)'], rows: data.map(d => [isAr ? d.item_ar : d.item, fmt(d.amount)]) };
    case 'expense_breakdown':
      return { headers: [isAr ? 'الفئة' : 'Category', isAr ? 'المبلغ' : 'Amount (EGP)', isAr ? 'النسبة' : '%'], rows: data.map(d => [isAr ? d.category_ar : d.category, fmt(d.amount), d.pct + '%']) };
    case 'invoice_aging':
      return { headers: [isAr ? 'الفترة' : 'Period', isAr ? 'العدد' : 'Count', isAr ? 'المبلغ' : 'Amount (EGP)'], rows: data.map(d => [isAr ? d.range_ar : d.range, d.count, fmt(d.amount)]) };
    case 'cashflow':
      return { headers: [isAr ? 'الشهر' : 'Month', isAr ? 'وارد' : 'Inflow', isAr ? 'صادر' : 'Outflow', isAr ? 'صافي' : 'Net'], rows: data.map(d => [isAr ? d.month_ar : d.month, fmt(d.inflow), fmt(d.outflow), fmt(d.inflow - d.outflow)]) };
    default:
      return { headers: [], rows: [] };
  }
}

// ── Departments for filter ───────────────────────────────────────

const DEPARTMENTS = [
  { id: 'all', ar: 'كل الأقسام', en: 'All Departments' },
  { id: 'sales', ar: 'المبيعات', en: 'Sales' },
  { id: 'marketing', ar: 'التسويق', en: 'Marketing' },
  { id: 'hr', ar: 'الموارد البشرية', en: 'HR' },
  { id: 'finance', ar: 'المالية', en: 'Finance' },
];

const DEPT_TO_CATEGORY = { sales: 'sales', marketing: 'crm', hr: 'hr', finance: 'finance' };

// ── Main Component ───────────────────────────────────────────────

export default function ReportsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [activeReport, setActiveReport] = useState(null); // { report, category }
  const [modalOpen, setModalOpen] = useState(false);

  const filteredCategories = useMemo(() => {
    if (deptFilter === 'all') return REPORT_CATEGORIES;
    const catKey = DEPT_TO_CATEGORY[deptFilter];
    return REPORT_CATEGORIES.filter(c => c.key === catKey || (deptFilter === 'sales' && c.key === 'crm'));
  }, [deptFilter]);

  const totalReports = REPORT_CATEGORIES.reduce((s, c) => s + c.reports.length, 0);

  function handleGenerate(report, category) {
    setActiveReport({ report, category });
    setModalOpen(true);
  }

  const reportTable = activeReport ? renderReportTable(activeReport.report.key, activeReport.report.data, lang) : null;

  const exportData = reportTable ? reportTable.rows.map(row => {
    const obj = {};
    reportTable.headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }) : [];

  const exportColumns = reportTable ? reportTable.headers.map(h => ({ header: h, key: h })) : [];

  return (
    <div className={`p-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-[10px] bg-brand-800 flex items-center justify-center">
            <FileText size={20} color="#fff" />
          </div>
          <div>
            <h1 className="m-0 text-[22px] font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'مركز التقارير' : 'Reports Hub'}
            </h1>
            <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'تقارير جاهزة للتحليل والتصدير' : 'Pre-built reports ready to generate & export'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <KpiCard icon={FileText} label={lang === 'ar' ? 'إجمالي التقارير' : 'Total Reports'} value={totalReports} color="#4A7AAB" />
        <KpiCard icon={Users} label={lang === 'ar' ? 'تقارير CRM' : 'CRM Reports'} value={4} color="#4A7AAB" />
        <KpiCard icon={DollarSign} label={lang === 'ar' ? 'تقارير مالية' : 'Finance Reports'} value={4} color="#2B4C6F" />
        <KpiCard icon={Briefcase} label={lang === 'ar' ? 'تقارير HR' : 'HR Reports'} value={4} color="#6B8DB5" />
      </div>

      {/* Filter bar */}
      <div className={`flex flex-wrap gap-3 mb-6 items-end ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
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

      {/* Report Categories & Cards */}
      {filteredCategories.map(category => {
        const CatIcon = category.icon;
        return (
          <div key={category.key} className="mb-8">
            {/* Category Header */}
            <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <CatIcon size={18} style={{ color: category.color }} />
              <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">
                {lang === 'ar' ? category.ar : category.en}
              </h2>
              <Badge size="sm" className="rounded-full" style={{ background: category.color + '20', color: category.color }}>
                {category.reports.length}
              </Badge>
            </div>

            {/* Report Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {category.reports.map(report => {
                const RIcon = report.icon;
                return (
                  <Card key={report.key} hover className="px-5 py-4">
                    <div className={`flex items-start gap-3.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: category.color + '15' }}
                      >
                        <RIcon size={18} style={{ color: category.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="m-0 text-sm font-semibold text-content dark:text-content-dark mb-0.5">
                          {lang === 'ar' ? report.ar : report.en}
                        </h3>
                        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark leading-relaxed">
                          {lang === 'ar' ? report.desc_ar : report.desc_en}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => handleGenerate(report, category)} className="shrink-0">
                        <ArrowDownToLine size={14} />
                        {lang === 'ar' ? 'إنشاء' : 'Generate'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Generated Report Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={activeReport ? (lang === 'ar' ? activeReport.report.ar : activeReport.report.en) : ''} width="max-w-3xl">
        {reportTable && (
          <div>
            {/* Export inside modal */}
            <div className={`flex justify-end mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <ExportButton
                data={exportData}
                filename={activeReport?.report.key || 'report'}
                title={lang === 'ar' ? activeReport?.report.ar : activeReport?.report.en}
                columns={exportColumns}
              />
            </div>

            {/* Date range note */}
            {(dateFrom || dateTo) && (
              <div className="text-xs text-content-muted dark:text-content-muted-dark mb-3">
                {lang === 'ar' ? 'الفترة:' : 'Period:'} {dateFrom || '—'} → {dateTo || '—'}
              </div>
            )}

            <Table>
              <thead>
                <tr>
                  {reportTable.headers.map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportTable.rows.map((row, ri) => (
                  <Tr key={ri}>
                    {row.map((cell, ci) => (
                      <Td key={ci} className={ci === 0 ? 'font-semibold' : ''}>{cell}</Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </Table>

            {/* Summary note */}
            <div className={`mt-4 px-4 py-3 rounded-lg bg-brand-500/[0.06] border border-brand-500/[0.15] text-xs text-brand-800 dark:text-brand-300 text-start`}>
              {lang === 'ar' ? 'هذه البيانات تجريبية — سيتم ربطها بالبيانات الحقيقية قريبًا' : 'This is mock data — will be connected to live data soon'}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
