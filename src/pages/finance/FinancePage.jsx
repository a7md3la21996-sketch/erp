import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  FileText, CheckCircle, Clock, AlertTriangle, Download,
  Plus, Filter, Search, ChevronDown, BarChart2,
  Users, Banknote, Receipt, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// ── Mock Data ──────────────────────────────────────────────────────────────
const MOCK_COMMISSIONS = [
  { id: 'c1', agent_ar: 'أحمد محمود',   agent_en: 'Ahmed Mahmoud',  deal: 'شقة زيد الشمالي',    amount: 18500,  status: 'approved', month: 'مارس 2026',   date: '2026-03-01' },
  { id: 'c2', agent_ar: 'سارة خالد',    agent_en: 'Sara Khaled',    deal: 'فيلا النرجس',         amount: 22000,  status: 'pending',  month: 'مارس 2026',   date: '2026-03-03' },
  { id: 'c3', agent_ar: 'محمد علي',     agent_en: 'Mohamed Ali',    deal: 'مكتب تجاري B12',      amount: 9800,   status: 'paid',     month: 'فبراير 2026', date: '2026-02-20' },
  { id: 'c4', agent_ar: 'مريم حسن',     agent_en: 'Mariam Hassan',  deal: 'شقة كمباوند الياسمين',amount: 14200,  status: 'pending',  month: 'مارس 2026',   date: '2026-03-05' },
  { id: 'c5', agent_ar: 'خالد إبراهيم', agent_en: 'Khaled Ibrahim', deal: 'دوبلكس سيدي بشر',     amount: 31000,  status: 'approved', month: 'مارس 2026',   date: '2026-03-02' },
  { id: 'c6', agent_ar: 'هند السيد',    agent_en: 'Hind Elsayed',   deal: 'شقة مرسى مطروح',      amount: 11500,  status: 'paid',     month: 'فبراير 2026', date: '2026-02-25' },
];

const MOCK_PAYROLL = [
  { id: 'p1', month_ar: 'مارس 2026',   month_en: 'March 2026',   total: 387000, status: 'pending',   employees: 35, run_date: null },
  { id: 'p2', month_ar: 'فبراير 2026', month_en: 'February 2026',total: 372000, status: 'processed', employees: 35, run_date: '2026-02-28' },
  { id: 'p3', month_ar: 'يناير 2026',  month_en: 'January 2026', total: 365000, status: 'processed', employees: 34, run_date: '2026-01-31' },
  { id: 'p4', month_ar: 'ديسمبر 2025', month_en: 'December 2025',total: 371000, status: 'processed', employees: 34, run_date: '2025-12-31' },
];

const MOCK_EXPENSES = [
  { id: 'e1', category_ar: 'تسويق',       category_en: 'Marketing',   amount: 85000,  date: '2026-03-01', status: 'approved', vendor: 'Meta Ads' },
  { id: 'e2', category_ar: 'إيجار',        category_en: 'Rent',        amount: 45000,  date: '2026-03-01', status: 'approved', vendor: 'مالك العقار' },
  { id: 'e3', category_ar: 'مواصلات',      category_en: 'Transport',   amount: 12000,  date: '2026-03-03', status: 'pending',  vendor: 'شركة الأسطول' },
  { id: 'e4', category_ar: 'أدوات مكتب',  category_en: 'Office',      amount: 8500,   date: '2026-03-04', status: 'approved', vendor: 'أوفيس مارت' },
  { id: 'e5', category_ar: 'كهرباء/مياه', category_en: 'Utilities',   amount: 6800,   date: '2026-03-02', status: 'approved', vendor: 'شركة الكهرباء' },
  { id: 'e6', category_ar: 'تسويق',       category_en: 'Marketing',   amount: 62000,  date: '2026-03-05', status: 'pending',  vendor: 'Google Ads' },
];

const MONTHLY_REVENUE = [
  { month_ar: 'أكتوبر', month_en: 'Oct', revenue: 980000,  expenses: 280000 },
  { month_ar: 'نوفمبر', month_en: 'Nov', revenue: 1050000, expenses: 295000 },
  { month_ar: 'ديسمبر', month_en: 'Dec', revenue: 890000,  expenses: 310000 },
  { month_ar: 'يناير',  month_en: 'Jan', revenue: 1120000, expenses: 290000 },
  { month_ar: 'فبراير', month_en: 'Feb', revenue: 1080000, expenses: 305000 },
  { month_ar: 'مارس',   month_en: 'Mar', revenue: 1250000, expenses: 320000 },
];

const STATUS_CONFIG = {
  pending:   { ar: 'معلق',     en: 'Pending',   color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  approved:  { ar: 'معتمد',    en: 'Approved',  color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
  paid:      { ar: 'مدفوع',    en: 'Paid',      color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)'   },
  processed: { ar: 'تم المعالجة', en: 'Processed', color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)' },
  rejected:  { ar: 'مرفوض',    en: 'Rejected',  color: '#EF4444', bg: 'rgba(239,68,68,0.08)'  },
};

const TABS = [
  { id: 'overview',     ar: 'نظرة عامة',   en: 'Overview',     Icon: BarChart2   },
  { id: 'commissions',  ar: 'العمولات',    en: 'Commissions',  Icon: DollarSign  },
  { id: 'payroll',      ar: 'مسير الرواتب', en: 'Payroll',     Icon: Banknote    },
  { id: 'expenses',     ar: 'المصروفات',   en: 'Expenses',     Icon: Receipt     },
];

export default function FinancePage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL  = i18n.language === 'ar';
  const lang   = i18n.language;

  const [activeTab, setActiveTab] = useState('overview');
  const [commFilter, setCommFilter] = useState('all');
  const [expSearch, setExpSearch] = useState('');
  const [hoverRow, setHoverRow] = useState(null);

  const c = {
    bg:        isDark ? '#152232' : '#F8FAFC',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover:  isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };

  // Derived KPIs
  const totalRevenue     = 1250000;
  const totalExpenses    = MOCK_EXPENSES.reduce((s, e) => s + e.amount, 0);
  const netProfit        = totalRevenue - totalExpenses;
  const pendingComm      = MOCK_COMMISSIONS.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const approvedComm     = MOCK_COMMISSIONS.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0);
  const currentPayroll   = MOCK_PAYROLL[0];
  const maxRevenue       = Math.max(...MONTHLY_REVENUE.map(m => m.revenue));

  const filteredComm = commFilter === 'all'
    ? MOCK_COMMISSIONS
    : MOCK_COMMISSIONS.filter(c => c.status === commFilter);

  const filteredExp = expSearch
    ? MOCK_EXPENSES.filter(e =>
        e.vendor.toLowerCase().includes(expSearch.toLowerCase()) ||
        (lang === 'ar' ? e.category_ar : e.category_en).toLowerCase().includes(expSearch.toLowerCase())
      )
    : MOCK_EXPENSES;

  // ── Sub-components ─────────────────────────────────────────────────────

  const KpiCard = ({ icon: Icon, label, value, sub, color, trend, trendVal }) => (
    <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: c.textMuted }}>{sub}</div>}
          {trendVal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {trend === 'up'
                ? <ArrowUpRight size={13} color="#4A7AAB" />
                : <ArrowDownRight size={13} color="#EF4444" />
              }
              <span style={{ fontSize: 11, color: trend === 'up' ? '#4A7AAB' : '#EF4444', fontWeight: 600 }}>{trendVal}</span>
            </div>
          )}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
        {lang === 'ar' ? cfg.ar : cfg.en}
      </span>
    );
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <Icon size={16} color={c.accent} />
      <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{title}</span>
    </div>
  );

  // ── OVERVIEW TAB ───────────────────────────────────────────────────────
  const renderOverview = () => (
    <div>
      {/* KPI Row */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={TrendingUp}   label={lang === 'ar' ? 'الإيرادات الشهرية' : 'Monthly Revenue'}   value={'1.25M'}    sub="EGP" color="#4A7AAB"  trend="up"   trendVal="+15.7%" />
        <KpiCard icon={TrendingDown} label={lang === 'ar' ? 'إجمالي المصروفات'  : 'Total Expenses'}    value={(totalExpenses/1000).toFixed(0)+'K'} sub="EGP" color="#EF4444" trend="down" trendVal="+5%" />
        <KpiCard icon={DollarSign}   label={lang === 'ar' ? 'صافي الربح'         : 'Net Profit'}        value={(netProfit/1000).toFixed(0)+'K'}     sub="EGP" color="#2B4C6F" />
        <KpiCard icon={Banknote}     label={lang === 'ar' ? 'مسير الرواتب'       : 'Payroll This Month'} value={(currentPayroll.total/1000).toFixed(0)+'K'} sub="EGP · 35 موظف" color="#6B8DB5" />
      </div>

      {/* Revenue Chart + Expenses Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Bar Chart */}
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
          <SectionTitle icon={BarChart2} title={lang === 'ar' ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, paddingBottom: 8 }}>
            {MONTHLY_REVENUE.map((m, i) => {
              const revH = Math.round((m.revenue / maxRevenue) * 120);
              const expH = Math.round((m.expenses / maxRevenue) * 120);
              const isLast = i === MONTHLY_REVENUE.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                    <div style={{ width: '40%', height: revH, background: isLast ? c.accent : c.accent + '60', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} title={`${m.revenue.toLocaleString()} EGP`} />
                    <div style={{ width: '40%', height: expH, background: isLast ? '#EF4444' : '#EF444440', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} title={`${m.expenses.toLocaleString()} EGP`} />
                  </div>
                  <span style={{ fontSize: 10, color: c.textMuted }}>{lang === 'ar' ? m.month_ar : m.month_en}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.accent }} />
              <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'الإيرادات' : 'Revenue'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444' }} />
              <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'المصروفات' : 'Expenses'}</span>
            </div>
          </div>
        </div>

        {/* Expenses by Category */}
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
          <SectionTitle icon={PieChart} title={lang === 'ar' ? 'المصروفات حسب الفئة' : 'Expenses by Category'} />
          {Object.entries(
            MOCK_EXPENSES.reduce((acc, e) => {
              const key = lang === 'ar' ? e.category_ar : e.category_en;
              acc[key] = (acc[key] || 0) + e.amount;
              return acc;
            }, {})
          ).sort((a,b) => b[1]-a[1]).map(([cat, amt], i) => {
            const pct = Math.round((amt / totalExpenses) * 100);
            const barColors = ['#1B3347','#2B4C6F','#4A7AAB','#6B8DB5','#8BA8C8'];
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 12, color: c.text }}>{cat}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{(amt/1000).toFixed(0)}K</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                  <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: barColors[i % barColors.length] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Commission + Payroll Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Commission Summary */}
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
          <SectionTitle icon={DollarSign} title={lang === 'ar' ? 'ملخص العمولات' : 'Commission Summary'} />
          {[
            { label: lang === 'ar' ? 'معلق' : 'Pending',  value: pendingComm,  color: '#6B8DB5' },
            { label: lang === 'ar' ? 'معتمد' : 'Approved', value: approvedComm, color: '#4A7AAB' },
            { label: lang === 'ar' ? 'مدفوع' : 'Paid',     value: MOCK_COMMISSIONS.filter(c => c.status === 'paid').reduce((s,c) => s+c.amount, 0), color: '#2B4C6F' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? '1px solid ' + c.border : 'none', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                <span style={{ fontSize: 13, color: c.textMuted }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value.toLocaleString()} EGP</span>
            </div>
          ))}
        </div>

        {/* Payroll Quick View */}
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
          <SectionTitle icon={Banknote} title={lang === 'ar' ? 'مسير الرواتب' : 'Payroll Runs'} />
          {MOCK_PAYROLL.slice(0, 3).map((run, i) => (
            <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? '1px solid ' + c.border : 'none', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 13, color: c.text, fontWeight: 500 }}>{lang === 'ar' ? run.month_ar : run.month_en}</div>
                <div style={{ fontSize: 11, color: c.textMuted }}>{run.employees} {lang === 'ar' ? 'موظف' : 'employees'}</div>
              </div>
              <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{(run.total/1000).toFixed(0)}K EGP</div>
                <StatusBadge status={run.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── COMMISSIONS TAB ────────────────────────────────────────────────────
  const renderCommissions = () => (
    <div>
      {/* KPI Row */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Clock}        label={lang === 'ar' ? 'معلق الاعتماد' : 'Pending Approval'} value={(pendingComm/1000).toFixed(1)+'K'} sub="EGP" color="#6B8DB5" />
        <KpiCard icon={CheckCircle}  label={lang === 'ar' ? 'معتمد - لم يُصرف' : 'Approved - Unpaid'} value={(approvedComm/1000).toFixed(1)+'K'} sub="EGP" color="#4A7AAB" />
        <KpiCard icon={DollarSign}   label={lang === 'ar' ? 'مدفوع هذا الشهر' : 'Paid This Month'} value="21.3K" sub="EGP" color="#2B4C6F" />
      </div>

      {/* Filter + Table */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
          {['all','pending','approved','paid'].map(f => (
            <button key={f} onClick={() => setCommFilter(f)} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid ' + (commFilter === f ? c.accent : c.border),
              background: commFilter === f ? c.accent + '15' : 'transparent', color: commFilter === f ? c.accent : c.textMuted,
              fontSize: 12, cursor: 'pointer', fontWeight: commFilter === f ? 600 : 400,
            }}>
              {f === 'all' ? (lang === 'ar' ? 'الكل' : 'All') :
               f === 'pending' ? (lang === 'ar' ? 'معلق' : 'Pending') :
               f === 'approved' ? (lang === 'ar' ? 'معتمد' : 'Approved') :
               (lang === 'ar' ? 'مدفوع' : 'Paid')}
            </button>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[
                lang === 'ar' ? 'الموظف' : 'Agent',
                lang === 'ar' ? 'الصفقة' : 'Deal',
                lang === 'ar' ? 'العمولة' : 'Commission',
                lang === 'ar' ? 'الشهر' : 'Month',
                lang === 'ar' ? 'الحالة' : 'Status',
                lang === 'ar' ? 'إجراء' : 'Action',
              ].map((h, i) => (
                <th key={i} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: isRTL ? 'right' : 'left', borderBottom: '1px solid ' + c.border }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredComm.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <DollarSign size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:c.text }}>{lang==='ar'?'لا توجد عمولات':'No Commissions'}</p>
                <p style={{ margin:0, fontSize:13, color:c.textMuted }}>{lang==='ar'?'لم يتم تسجيل أي عمولات بعد':'No commission records found'}</p>
              </div>
            ) : filteredComm.map((row) => (
              <tr key={row.id}
                style={{ background: hoverRow === row.id ? c.rowHover : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={() => setHoverRow(row.id)}
                onMouseLeave={() => setHoverRow(null)}
              >
                <td style={{ padding: '10px 12px', fontSize: 13, color: c.text, borderBottom: '1px solid ' + c.border, fontWeight: 500 }}>
                  {lang === 'ar' ? row.agent_ar : row.agent_en}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: c.textMuted, borderBottom: '1px solid ' + c.border }}>
                  {row.deal}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: c.accent, borderBottom: '1px solid ' + c.border }}>
                  {row.amount.toLocaleString()} EGP
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: c.textMuted, borderBottom: '1px solid ' + c.border }}>
                  {row.month}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + c.border }}>
                  <StatusBadge status={row.status} />
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + c.border }}>
                  {row.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <button style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: c.accent, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        {lang === 'ar' ? 'اعتماد' : 'Approve'}
                      </button>
                      <button style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>
                        {lang === 'ar' ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  )}
                  {row.status === 'approved' && (
                    <button style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {lang === 'ar' ? 'صرف' : 'Pay'}
                    </button>
                  )}
                  {row.status === 'paid' && (
                    <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'مكتمل' : 'Done'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── PAYROLL TAB ────────────────────────────────────────────────────────
  const renderPayroll = () => (
    <div>
      {/* Current Month Banner */}
      <div style={{ background: `linear-gradient(135deg, #1B3347 0%, #2B4C6F 60%, #4A7AAB 100%)`, borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{lang === 'ar' ? 'مسير مارس 2026' : 'March 2026 Payroll'}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>387,000 EGP</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>35 {lang === 'ar' ? 'موظف · لم يُشغَّل بعد' : 'employees · Not run yet'}</div>
        </div>
        <button style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#fff', color: '#1B3347', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'ar' ? 'تشغيل المسير' : 'Run Payroll'}
        </button>
      </div>

      {/* Payroll History */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
        <SectionTitle icon={Banknote} title={lang === 'ar' ? 'سجل مسير الرواتب' : 'Payroll History'} />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[lang === 'ar' ? 'الشهر' : 'Month', lang === 'ar' ? 'الموظفين' : 'Employees', lang === 'ar' ? 'الإجمالي' : 'Total', lang === 'ar' ? 'تاريخ التشغيل' : 'Run Date', lang === 'ar' ? 'الحالة' : 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: isRTL ? 'right' : 'left', borderBottom: '1px solid ' + c.border }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_PAYROLL.map((run) => (
              <tr key={run.id}
                style={{ background: hoverRow === run.id ? c.rowHover : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={() => setHoverRow(run.id)}
                onMouseLeave={() => setHoverRow(null)}
              >
                <td style={{ padding: '10px 12px', fontSize: 13, color: c.text, borderBottom: '1px solid ' + c.border, fontWeight: 500 }}>
                  {lang === 'ar' ? run.month_ar : run.month_en}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: c.textMuted, borderBottom: '1px solid ' + c.border }}>
                  {run.employees}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: c.accent, borderBottom: '1px solid ' + c.border }}>
                  {run.total.toLocaleString()} EGP
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: c.textMuted, borderBottom: '1px solid ' + c.border }}>
                  {run.run_date || (lang === 'ar' ? 'لم يُشغَّل' : 'Not run')}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + c.border }}>
                  <StatusBadge status={run.status} />
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + c.border }}>
                  {run.status === 'processed' && (
                    <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, border: '1px solid ' + c.border, background: 'transparent', color: c.textMuted, fontSize: 11, cursor: 'pointer' }}>
                      <Download size={11} />
                      {lang === 'ar' ? 'تصدير' : 'Export'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── EXPENSES TAB ───────────────────────────────────────────────────────
  const renderExpenses = () => (
    <div>
      {/* KPIs */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Receipt}     label={lang === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}   value={(totalExpenses/1000).toFixed(0)+'K'} sub="EGP" color="#EF4444" />
        <KpiCard icon={Clock}       label={lang === 'ar' ? 'معلق الاعتماد'    : 'Pending Approval'} value="2" sub={lang === 'ar' ? 'طلب' : 'requests'} color="#6B8DB5" />
        <KpiCard icon={CheckCircle} label={lang === 'ar' ? 'المعتمد هذا الشهر' : 'Approved This Month'} value={(MOCK_EXPENSES.filter(e=>e.status==='approved').reduce((s,e)=>s+e.amount,0)/1000).toFixed(0)+'K'} sub="EGP" color="#4A7AAB" />
      </div>

      {/* Table */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <SectionTitle icon={Receipt} title={lang === 'ar' ? 'سجل المصروفات' : 'Expense Log'} />
          <div style={{ display: 'flex', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg }}>
              <Search size={13} color={c.textMuted} />
              <input
                value={expSearch}
                onChange={e => setExpSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: c.text, width: 120 }}
              />
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', background: c.accent, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={13} />
              {lang === 'ar' ? 'إضافة مصروف' : 'Add Expense'}
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[lang === 'ar' ? 'الفئة' : 'Category', lang === 'ar' ? 'المورد' : 'Vendor', lang === 'ar' ? 'المبلغ' : 'Amount', lang === 'ar' ? 'التاريخ' : 'Date', lang === 'ar' ? 'الحالة' : 'Status'].map((h, i) => (
                <th key={i} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: isRTL ? 'right' : 'left', borderBottom: '1px solid ' + c.border }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredExp.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Receipt size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:c.text }}>{lang==='ar'?'لا توجد مصروفات':'No Expenses'}</p>
                <p style={{ margin:0, fontSize:13, color:c.textMuted }}>{lang==='ar'?'لم يتم تسجيل أي مصروفات بعد':'No expense records found'}</p>
              </div>
            ) : filteredExp.map((row) => (
              <tr key={row.id}
                style={{ background: hoverRow === row.id ? c.rowHover : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={() => setHoverRow(row.id)}
                onMouseLeave={() => setHoverRow(null)}
              >
                <td style={{ padding: '10px 12px', fontSize: 13, color: c.text, borderBottom: '1px solid ' + c.border, fontWeight: 500 }}>
                  {lang === 'ar' ? row.category_ar : row.category_en}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: c.textMuted, borderBottom: '1px solid ' + c.border }}>
                  {row.vendor}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#EF4444', borderBottom: '1px solid ' + c.border }}>
                  {row.amount.toLocaleString()} EGP
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: c.textMuted, borderBottom: '1px solid ' + c.border }}>
                  {row.date}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + c.border }}>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: c.text, margin: 0 }}>{lang === 'ar' ? 'المالية' : 'Finance'}</h1>
          <p style={{ fontSize: 12, color: c.textMuted, margin: '4px 0 0' }}>{lang === 'ar' ? 'مارس 2026' : 'March 2026'}</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.cardBg, color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>
          <Download size={14} />
          {lang === 'ar' ? 'تصدير التقرير' : 'Export Report'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: c.cardBg, borderRadius: 10, padding: 4, border: '1px solid ' + c.border, width: 'fit-content', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 7,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
            background: activeTab === tab.id ? c.accent : 'transparent',
            color: activeTab === tab.id ? '#fff' : c.textMuted,
          }}>
            <tab.Icon size={14} />
            {lang === 'ar' ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview'    && renderOverview()}
      {activeTab === 'commissions' && renderCommissions()}
      {activeTab === 'payroll'     && renderPayroll()}
      {activeTab === 'expenses'    && renderExpenses()}
    </div>
  );
}
