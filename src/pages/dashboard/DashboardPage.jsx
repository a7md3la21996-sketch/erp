import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchTodayReminders } from '../../services/remindersService';
import { fetchAllDashboardData, buildPipelineData, getDateRange, buildRevenueTrend, buildTopSellers, filterStatsByRange } from '../../services/dashboardService';
import { getWonDeals } from '../../services/dealsService';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Clock, AlertTriangle, Target, UserCheck, Briefcase, ArrowUpRight, ArrowDownRight, Star, Trophy, Building2, Activity, CalendarCheck, ShieldAlert, Wallet, BarChart2, Bell, Phone, MessageCircle, MapPin, Mail, CheckCircle } from 'lucide-react';
import { Card, KpiCard, Badge, DashboardSkeleton } from '../../components/ui';

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;
const MOCK_CRM = { totalLeads: 142, newLeadsThisMonth: 38, activeOpps: 24, closedDeals: 11, revenue: 1250000 };
const MOCK_SALES = { target: 1500000, achieved: 1250000, topSales: [{ name_ar: 'أحمد محمود', name_en: 'Ahmed Mahmoud', revenue: 310000, pct: 84 }, { name_ar: 'سارة خالد', name_en: 'Sara Khaled', revenue: 285000, pct: 77 }, { name_ar: 'محمد علي', name_en: 'Mohamed Ali', revenue: 195000, pct: 53 }, { name_ar: 'نورا حسن', name_en: 'Nora Hassan', revenue: 175000, pct: 47 }] };
const REVENUE_TREND = [{ label_ar: 'أكتوبر', label_en: 'Oct', value: 820000 }, { label_ar: 'نوفمبر', label_en: 'Nov', value: 950000 }, { label_ar: 'ديسمبر', label_en: 'Dec', value: 1100000 }, { label_ar: 'يناير', label_en: 'Jan', value: 880000 }, { label_ar: 'فبراير', label_en: 'Feb', value: 1050000 }, { label_ar: 'مارس', label_en: 'Mar', value: 1250000 }];
const PIPELINE_DATA = [{ stage_ar: 'ليد', stage_en: 'Lead', count: 45 }, { stage_ar: 'تواصل', stage_en: 'Contact', count: 32 }, { stage_ar: 'مهتم', stage_en: 'Interest', count: 24 }, { stage_ar: 'معاينة', stage_en: 'Visit', count: 18 }, { stage_ar: 'تفاوض', stage_en: 'Negot.', count: 12 }, { stage_ar: 'مغلق', stage_en: 'Closed', count: 11 }];
const EXPENSE_CATS = [{ name_ar: 'رواتب', name_en: 'Salaries', value: 180000, pct: 56 }, { name_ar: 'إعلانات', name_en: 'Marketing', value: 80000, pct: 25 }, { name_ar: 'إيجار', name_en: 'Rent', value: 35000, pct: 11 }, { name_ar: 'أخرى', name_en: 'Other', value: 25000, pct: 8 }];
const BRAND = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8', '#A8BFD5'];

function buildHRStats(attendance) {
  const presentDays = attendance.filter(r => r.check_in && !r.absent);
  const lateDays = presentDays.filter(r => { const [h, m] = (r.check_in || '').split(':').map(Number); return h > 10 || (h === 10 && m > 30); });
  const absentDays = attendance.filter(r => r.absent);
  const uniqueEmps = [...new Set(attendance.map(r => r.employee_id))].length;
  const attendanceRate = uniqueEmps > 0 ? Math.round((presentDays.length / (uniqueEmps * 22)) * 100) : 0;
  const today = new Date();
  const alerts = MOCK_EMPLOYEES.filter(emp => { if (!emp.contract_end) return false; const end = new Date(emp.contract_end); const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24)); return days > 0 && days <= 30; });
  const probation = MOCK_EMPLOYEES.filter(emp => emp.employment_type === 'probation');
  const deptCounts = DEPARTMENTS.map(d => ({ ...d, count: MOCK_EMPLOYEES.filter(e => e.department === d.id).length })).filter(d => d.count > 0);
  return { total: MOCK_EMPLOYEES.length, attendanceRate, lateCount: [...new Set(lateDays.map(r => r.employee_id))].length, absentCount: [...new Set(absentDays.map(r => r.employee_id))].length, contractAlerts: alerts.length, probationCount: probation.length, deptCounts, openPositions: 3, pendingLeaves: 4 };
}

function getSections(role) {
  const isAdmin = role === 'admin'; const isSales = ['sales_director','sales_manager','team_leader','sales_agent'].includes(role); const isHR = role === 'hr'; const isFinance = role === 'finance'; const isMkt = role === 'marketing';
  return { showHR: isAdmin || isHR, showSales: isAdmin || isSales, showFinance: isAdmin || isFinance, showCRM: isAdmin || isSales || isMkt };
}

function ChartTooltip({ active, payload, label, isDark, isRTL }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-lg px-3.5 py-2.5 shadow-xl text-xs border border-brand-500/20 backdrop-blur-sm ${isDark ? 'bg-surface-card-dark/95' : 'bg-white/95'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-1 text-content-muted dark:text-content-muted-dark font-medium">{label}</div>
      {payload.map((p, i) => <div key={i} className="text-brand-500 font-bold text-sm">{typeof p.value === 'number' && p.value >= 10000 ? Number((p.value / 1000).toFixed(0)).toLocaleString() + 'K EGP' : typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</div>)}
    </div>
  );
}

const REMINDER_TYPES = {
  call:     { ar: 'مكالمة',    en: 'Call',       color: '#10B981', Icon: Phone },
  whatsapp: { ar: 'واتساب',   en: 'WhatsApp',    color: '#25D366', Icon: MessageCircle },
  visit:    { ar: 'زيارة موقع',en: 'Site Visit',  color: '#4A7AAB', Icon: MapPin },
  meeting:  { ar: 'اجتماع',   en: 'Meeting',     color: '#8B5CF6', Icon: Users },
  email:    { ar: 'بريد',     en: 'Email',       color: '#F59E0B', Icon: Mail },
};

function TodayReminders({ lang, isRTL, isDark, userId }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayReminders(userId).then(data => {
      setReminders(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="p-5 mb-5">
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-9 h-9 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Bell size={18} className="text-brand-500" />
          </div>
          <div className="text-start">
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'متابعات اليوم' : "Today's Follow-ups"}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{reminders.length > 0 ? (lang === 'ar' ? reminders.length + ' متابعة مجدولة' : reminders.length + ' scheduled') : (lang === 'ar' ? 'لا متابعات اليوم' : 'No follow-ups today')}</p>
          </div>
        </div>
        {reminders.length > 0 && (
          <Badge variant="danger" size="sm" className="bg-red-500 text-white rounded-full px-2.5 py-0.5">{reminders.length}</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex gap-2.5">
          {[1,2,3].map(i => <div key={i} className="flex-1 h-16 rounded-xl bg-surface-bg dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle size={32} className="text-brand-500 opacity-40 mb-2 mx-auto" />
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'أنجزت كل متابعاتك اليوم!' : 'All caught up for today!'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reminders.slice(0, 5).map((r, i) => {
            const t = REMINDER_TYPES[r.type] || REMINDER_TYPES.call;
            const TIcon = t.Icon;
            return (
              <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-bg dark:bg-white/[0.04] border border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.color + '18' }}>
                  <TIcon size={15} color={t.color} />
                </div>
                <div className={`flex-1 text-start`}>
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{r.entity_name || (lang === 'ar' ? 'جهة اتصال' : 'Contact')}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? t.ar : t.en}{r.notes ? ' · ' + r.notes : ''}</p>
                </div>
                <span className="text-xs text-content-muted dark:text-content-muted-dark shrink-0">{formatTime(r.due_at)}</span>
              </div>
            );
          })}
          {reminders.length > 5 && (
            <p className="mt-1 mb-0 text-xs text-content-muted dark:text-content-muted-dark text-center">
              {lang === 'ar' ? '+ ' + (reminders.length - 5) + ' متابعات أخرى' : '+ ' + (reminders.length - 5) + ' more'}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}


export default function DashboardPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar'; const lang = i18n.language;
  const role = profile?.role || 'admin';
  const name = isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar);
  const roleLabel = ROLE_LABELS[role]?.[lang] || '';
  const navigate = useNavigate();
  const sections = getSections(role);
  const attendance = getAttendanceForMonth(YEAR, MONTH);

  // ── Date range filter ────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState('this_year');
  const DATE_RANGE_OPTIONS = [
    { value: 'this_week',     label_ar: 'هذا الأسبوع',    label_en: 'This Week' },
    { value: 'this_month',    label_ar: 'هذا الشهر',     label_en: 'This Month' },
    { value: 'last_3_months', label_ar: 'آخر 3 أشهر',    label_en: 'Last 3 Months' },
    { value: 'this_year',     label_ar: 'هذا العام',     label_en: 'This Year' },
  ];
  const activeDateRange = getDateRange(dateRange);
  const hr = useMemo(() => buildHRStats(attendance), [attendance]);
  const dateStr = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = new Date().getHours();
  const greeting = lang === 'ar'
    ? (hour < 12 ? 'صباح الخير' : 'مساء الخير')
    : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

  // ── Real Supabase data ──────────────────────────────────────────────────
  const [dashData, setDashData] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    fetchAllDashboardData().then(data => {
      setDashData(data);
      setDashLoading(false);
    }).catch(() => setDashLoading(false));
  }, []);

  // Derive CRM KPIs — use real data when available, fallback to MOCK_CRM
  const crm = useMemo(() => {
    const c = dashData?.contacts;
    const o = dashData?.opportunities;
    if (c && o) {
      return {
        totalLeads: c.totalLeads,
        newLeadsThisMonth: c.newLeadsThisMonth,
        activeOpps: o.activeOpps,
        closedDeals: o.closedDeals,
        revenue: o.revenue,
        closedThisMonth: o.closedThisMonth,
      };
    }
    return MOCK_CRM;
  }, [dashData]);

  // Task & Activity stats
  const taskStats = dashData?.tasks;
  const activityStats = dashData?.activities;

  // ── Revenue trend & top sellers from real opportunities (with date range) ──
  const rawOpps = dashData?.opportunities?.rawOpps;

  // Also fetch won deals for agent names (deals have agent_ar/agent_en)
  const [wonDeals, setWonDeals] = useState([]);
  useEffect(() => { getWonDeals().then(d => setWonDeals(d || [])).catch(() => {}); }, []);

  // Date-range filtered stats from raw opportunities
  const rangeStats = useMemo(() => {
    if (!rawOpps?.length) return null;
    return filterStatsByRange(rawOpps, activeDateRange);
  }, [rawOpps, activeDateRange]);

  // Override CRM KPIs with date-range filtered data when available
  const filteredCrm = useMemo(() => {
    if (rangeStats) {
      return {
        ...crm,
        activeOpps: rangeStats.activeOpps,
        closedDeals: rangeStats.closedDeals,
        revenue: rangeStats.revenue,
      };
    }
    return crm;
  }, [crm, rangeStats]);

  const realRevenueTrend = useMemo(() => {
    if (!rawOpps?.length) return null;
    return buildRevenueTrend(rawOpps, activeDateRange);
  }, [rawOpps, activeDateRange]);

  const realTopSellers = useMemo(() => {
    if (!wonDeals.length) return null;
    const { start, end } = activeDateRange || {};
    const filtered = wonDeals.filter(d => {
      if (start && new Date(d.created_at) < start) return false;
      if (end && new Date(d.created_at) > end) return false;
      return true;
    });
    if (!filtered.length) return null;
    const map = {};
    filtered.forEach(d => {
      const key = d.agent_ar || d.agent_en || 'Unknown';
      if (!map[key]) map[key] = { name_ar: d.agent_ar || key, name_en: d.agent_en || key, revenue: 0 };
      map[key].revenue += d.deal_value || 0;
    });
    const arr = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 4);
    const maxRev = arr[0]?.revenue || 1;
    return arr.map(a => ({ ...a, pct: Math.round((a.revenue / maxRev) * 100) }));
  }, [wonDeals, activeDateRange]);

  const salesData = realTopSellers || MOCK_SALES.topSales;
  const targetPct = filteredCrm.revenue > 0 && MOCK_SALES.target > 0
    ? Math.round((filteredCrm.revenue / MOCK_SALES.target) * 100)
    : Math.round((MOCK_SALES.achieved / MOCK_SALES.target) * 100);
  const chartData = useMemo(() => (realRevenueTrend || REVENUE_TREND).map(d => ({ ...d, label: lang === 'ar' ? d.label_ar : d.label_en })), [lang, realRevenueTrend]);

  // Pipeline chart — real data filtered by date range if available
  const realPipeline = useMemo(() => {
    const stageCounts = rangeStats?.stageCounts || dashData?.opportunities?.stageCounts;
    if (stageCounts) {
      const built = buildPipelineData(stageCounts);
      if (built && built.length > 0) return built;
    }
    return null;
  }, [dashData, rangeStats]);
  const pipeData = useMemo(() => (realPipeline || PIPELINE_DATA).map(d => ({ ...d, label: lang === 'ar' ? d.stage_ar : d.stage_en })), [realPipeline, lang]);

  // Employee count from real data
  const employeeCount = dashData?.employees?.totalEmployees ?? hr.total;

  // Recharts needs raw color strings for tick fills
  const mutedColor = isDark ? '#8BA8C8' : '#64748B';

  const DashKpiCard = ({ icon: Icon, label, value, sub, trend, trendUp, color = '#4A7AAB', onClick }) => (
    <Card className={`relative overflow-hidden px-5 py-[18px] ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''}`} onClick={onClick}>
      <div className="absolute top-0 start-0 w-1 h-full rounded-s-xl" style={{ background: 'linear-gradient(180deg,' + color + ',transparent)' }} />
      <div className={`flex justify-between items-start ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="text-start">
          <p className="m-0 mb-1.5 text-xs text-content-muted dark:text-content-muted-dark font-medium">{label}</p>
          <p className="m-0 text-2xl font-bold text-content dark:text-content-dark leading-none">{value}</p>
          {sub && <p className="m-0 mt-1 text-xs text-content-muted dark:text-content-muted-dark">{sub}</p>}
          {trend && <div className={`flex items-center gap-1 mt-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>{trendUp ? <ArrowUpRight size={12} className="text-brand-500" /> : <ArrowDownRight size={12} className="text-red-500" />}<span className={`text-xs font-semibold ${trendUp ? 'text-brand-500' : 'text-red-500'}`}>{trend}</span></div>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18' }}><Icon size={20} color={color} /></div>
      </div>
    </Card>
  );

  const CardTitle = ({ icon: Icon, title, sub }) => (
    <div className={`flex items-center gap-2.5 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="w-[34px] h-[34px] rounded-[9px] bg-brand-500/[0.12] flex items-center justify-center"><Icon size={16} className="text-brand-500" /></div>
      <div className="text-start">
        <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{title}</p>
        {sub && <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{sub}</p>}
      </div>
    </div>
  );

  const Box = ({ children, className: cn = '' }) => <Card className={`p-5 ${cn}`}>{children}</Card>;

  if (dashLoading) return <DashboardSkeleton />;

  return (
    <div className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero banner */}
      <div className={`bg-gradient-to-br from-brand-900 via-brand-800 to-brand-500 rounded-2xl px-4 py-4 md:px-7 md:py-6 mb-5 flex flex-wrap md:flex-nowrap justify-between items-center gap-4 relative overflow-hidden ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`absolute w-40 h-40 rounded-full bg-white/[0.04] pointer-events-none ${isRTL ? '-left-5 top-[-40px]' : '-right-5 top-[-40px]'}`} />
        <div className="relative">
          <p className="m-0 mb-1 text-xl font-bold text-white">{greeting}، {name}</p>
          <p className="m-0 text-xs text-white/65">{roleLabel} · {dateStr}</p>
        </div>
        <div className={`flex gap-3 relative ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          {[{ l: lang === 'ar' ? 'ليد جديد' : 'New Leads', v: crm.newLeadsThisMonth }, { l: lang === 'ar' ? 'صفقة مغلقة' : 'Closed', v: filteredCrm.closedDeals }, { l: lang === 'ar' ? 'التارجت' : 'Target', v: targetPct + '%' }].map((s, i) => (
            <div key={i} className="text-center px-4 py-2 bg-white/10 rounded-xl">
              <p className="m-0 text-xl font-bold text-white">{s.v}</p>
              <p className="m-0 text-xs text-white/65">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Date range filter */}
      {sections.showCRM && (
        <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Clock size={14} className="text-content-muted dark:text-content-muted-dark" />
          <div className={`flex gap-1.5 flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            {DATE_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                  dateRange === opt.value
                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                    : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark border-edge dark:border-edge-dark hover:border-brand-500 hover:text-brand-500'
                }`}
              >
                {lang === 'ar' ? opt.label_ar : opt.label_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {sections.showCRM && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
          <DashKpiCard icon={Users}      label={lang === 'ar' ? 'إجمالي الليدز' : 'Total Leads'}  value={dashLoading ? '...' : crm.totalLeads}                        trend={crm.newLeadsThisMonth > 0 ? (lang === 'ar' ? '+' + crm.newLeadsThisMonth + ' هذا الشهر' : '+' + crm.newLeadsThisMonth + ' this month') : undefined} trendUp color="#4A7AAB" onClick={() => navigate('/crm/contacts')} />
          <DashKpiCard icon={Activity}   label={lang === 'ar' ? 'فرص نشطة'      : 'Active Opps'}  value={dashLoading ? '...' : filteredCrm.activeOpps}                        trend={lang === 'ar' ? 'vs الشهر الماضي' : 'vs last month'} trendUp color="#2B4C6F" onClick={() => navigate('/crm/opportunities')} />
          <DashKpiCard icon={Trophy}     label={lang === 'ar' ? 'صفقات مغلقة'   : 'Deals Closed'} value={dashLoading ? '...' : filteredCrm.closedDeals}                       trend={crm.closedThisMonth > 0 ? (lang === 'ar' ? '+' + crm.closedThisMonth + ' هذا الشهر' : '+' + crm.closedThisMonth + ' this month') : undefined} trendUp color="#6B8DB5" onClick={() => navigate('/crm/opportunities')} />
          <DashKpiCard icon={DollarSign} label={lang === 'ar' ? 'الإيرادات'     : 'Revenue'}      value={dashLoading ? '...' : (filteredCrm.revenue / 1000).toFixed(0) + 'K'} sub="EGP" trend={targetPct > 0 ? (lang === 'ar' ? targetPct + '% من التارجت' : targetPct + '% of target') : undefined} trendUp color="#4A7AAB" onClick={() => navigate('/finance')} />
        </div>
      )}

      {/* Tasks & Activities Row */}
      {sections.showCRM && (taskStats || activityStats) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
          {taskStats && (
            <>
              <DashKpiCard icon={Clock} label={lang === 'ar' ? 'مهام اليوم' : 'Due Today'} value={taskStats.dueToday} color="#F59E0B" onClick={() => navigate('/crm/opportunities')} />
              <DashKpiCard icon={AlertTriangle} label={lang === 'ar' ? 'مهام متأخرة' : 'Overdue'} value={taskStats.overdue} color={taskStats.overdue > 0 ? '#EF4444' : '#10B981'} trend={taskStats.overdue > 0 ? (lang === 'ar' ? 'تحتاج متابعة' : 'Needs attention') : undefined} onClick={() => navigate('/crm/opportunities')} />
            </>
          )}
          {activityStats && (
            <DashKpiCard icon={Activity} label={lang === 'ar' ? 'أنشطة الأسبوع' : 'Activities/Week'} value={activityStats.activitiesThisWeek} color="#8B5CF6" trendUp onClick={() => navigate('/crm/opportunities')} />
          )}
          <DashKpiCard icon={Target} label={lang === 'ar' ? 'معدل التحويل' : 'Conv. Rate'} value={filteredCrm.closedDeals > 0 && crm.totalLeads > 0 ? Math.round((filteredCrm.closedDeals / crm.totalLeads) * 100) + '%' : '0%'} color="#10B981" onClick={() => navigate('/crm/opportunities')} />
        </div>
      )}

      {sections.showCRM && (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 mb-5">
          <Box>
            <CardTitle icon={TrendingUp} title={lang === 'ar' ? 'تطور الإيرادات' : 'Revenue Trend'} sub={lang === 'ar' ? DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label_ar : DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label_en} />
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4A7AAB" stopOpacity={0.25} /><stop offset="95%" stopColor="#4A7AAB" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(74,122,171,0.1)' : 'rgba(0,0,0,0.06)'} />
                <XAxis dataKey="label" tick={{ fill: mutedColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: mutedColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000) + 'K'} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} cursor={{ stroke: isDark ? 'rgba(74,122,171,0.3)' : 'rgba(74,122,171,0.2)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="value" stroke="#4A7AAB" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#4A7AAB', r: 3 }} activeDot={{ r: 6, stroke: '#4A7AAB', strokeWidth: 2, fill: isDark ? '#1B3347' : '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <CardTitle icon={Wallet} title={lang === 'ar' ? 'توزيع المصروفات' : 'Expenses'} sub={new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })} />
            <ResponsiveContainer width="100%" height={120}>
              <PieChart><Pie data={EXPENSE_CATS} cx="50%" cy="50%" innerRadius={34} outerRadius={52} paddingAngle={3} dataKey="value">{EXPENSE_CATS.map((_, i) => <Cell key={i} fill={BRAND[i]} />)}</Pie><Tooltip formatter={v => [(v / 1000).toFixed(0) + 'K EGP']} /></PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {EXPENSE_CATS.map((cat, i) => (
                <div key={i} className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><div className="w-[7px] h-[7px] rounded-full" style={{ background: BRAND[i] }} /><span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? cat.name_ar : cat.name_en}</span></div>
                  <span className="text-xs font-bold text-content dark:text-content-dark">{cat.pct}%</span>
                </div>
              ))}
            </div>
          </Box>
        </div>
      )}

      {sections.showSales && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Box>
            <CardTitle icon={Activity} title={lang === 'ar' ? 'خط الأنابيب' : 'Sales Pipeline'} sub={lang === 'ar' ? 'فرص لكل مرحلة' : 'Opps per stage'} />
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={pipeData} margin={{ top: 0, right: 10, left: -25, bottom: 0 }} style={{ cursor: 'pointer' }}
                onClick={(e) => { if (e?.activePayload?.[0]?.payload?.stage_key) navigate('/crm/opportunities', { state: { initialStage: e.activePayload[0].payload.stage_key } }); }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(74,122,171,0.08)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="label" tick={{ fill: mutedColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: mutedColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} cursor={{ fill: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} className="cursor-pointer">{pipeData.map((_, i) => <Cell key={i} fill={'rgba(74,122,171,' + (0.35 + i * 0.13) + ')'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <CardTitle icon={Trophy} title={lang === 'ar' ? 'أفضل البائعين' : 'Top Performers'} sub={lang === 'ar' ? 'حسب الإيرادات' : 'By revenue'} />
            <div className="flex flex-col gap-2.5">
              {salesData.map((s, i) => (
                <div key={i} className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center" style={{ background: i === 0 ? '#1B3347' : i === 1 ? '#2B4C6F' : 'rgba(74,122,171,0.15)' }}><span className={`text-xs font-bold ${i < 2 ? 'text-white' : 'text-brand-500'}`}>{i + 1}</span></div>
                  <div className="flex-1 min-w-0">
                    <div className={`flex justify-between mb-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? s.name_ar : s.name_en}</span>
                      <span className="text-xs text-brand-500 font-bold">{(s.revenue / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="h-1 rounded-sm bg-gray-200 dark:bg-white/[0.08]"><div className="h-full rounded-sm" style={{ width: s.pct + '%', background: i === 0 ? '#4A7AAB' : i === 1 ? '#6B8DB5' : '#8BA8C8' }} /></div>
                  </div>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark min-w-[26px] text-center">{s.pct}%</span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 pt-3 border-t border-edge dark:border-edge-dark">
              <div className={`flex justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'التارجت الشهري' : 'Monthly Target'}</span><span className="text-xs font-bold text-brand-500">{targetPct}%</span></div>
              <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.08] overflow-hidden"><div className="h-full rounded" style={{ width: targetPct + '%', background: 'linear-gradient(90deg, #2B4C6F, #4A7AAB)' }} /></div>
              <div className={`flex justify-between mt-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{(filteredCrm.revenue / 1000).toFixed(0)}K</span><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{(MOCK_SALES.target / 1000).toFixed(0)}K EGP</span></div>
            </div>
          </Box>
        </div>
      )}

      {sections.showHR && (
        <div className="mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-4">
            <KpiCard icon={Users}         label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={dashLoading ? '...' : employeeCount}                color="#1B3347" onClick={() => navigate('/hr/employees')} className="cursor-pointer hover:shadow-md transition-shadow" />
            <KpiCard icon={CalendarCheck} label={lang === 'ar' ? 'معدل الحضور'     : 'Attendance Rate'}  value={hr.attendanceRate + '%'} color="#2B4C6F" onClick={() => navigate('/hr/attendance')} className="cursor-pointer hover:shadow-md transition-shadow" />
            <KpiCard icon={Briefcase}     label={lang === 'ar' ? 'وظائف مفتوحة'   : 'Open Positions'}   value={hr.openPositions}        color="#4A7AAB" onClick={() => navigate('/hr/recruitment')} className="cursor-pointer hover:shadow-md transition-shadow" />
            <KpiCard icon={UserCheck}     label={lang === 'ar' ? 'إجازات معلقة'   : 'Pending Leaves'}   value={hr.pendingLeaves}        color="#6B8DB5" onClick={() => navigate('/hr/self-service')} className="cursor-pointer hover:shadow-md transition-shadow" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Box>
              <CardTitle icon={Building2} title={lang === 'ar' ? 'توزيع الأقسام' : 'Departments'} sub={lang === 'ar' ? 'عدد الموظفين' : 'Headcount'} />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hr.deptCounts} layout="vertical" margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? 'rgba(74,122,171,0.08)' : 'rgba(0,0,0,0.05)'} />
                  <XAxis type="number" tick={{ fill: mutedColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey={lang === 'ar' ? 'name_ar' : 'name_en'} tick={{ fill: mutedColor, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#4A7AAB" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <CardTitle icon={ShieldAlert} title={lang === 'ar' ? 'تنبيهات HR' : 'HR Alerts'} sub={lang === 'ar' ? 'تحتاج متابعة' : 'Needs attention'} />
              <div className="flex flex-col gap-2">
                {[{ I: AlertTriangle, color: '#EF4444', bgClass: 'bg-red-500/[0.08]', label: lang === 'ar' ? hr.contractAlerts + ' عقد ينتهي قريباً' : hr.contractAlerts + ' contracts expiring', show: hr.contractAlerts > 0 }, { I: Clock, color: '#6B8DB5', bgClass: 'bg-brand-400/10', label: lang === 'ar' ? hr.probationCount + ' موظف في فترة تجربة' : hr.probationCount + ' on probation', show: hr.probationCount > 0 }, { I: UserCheck, color: '#EF4444', bgClass: 'bg-red-500/[0.08]', label: lang === 'ar' ? hr.absentCount + ' غائب اليوم' : hr.absentCount + ' absent today', show: hr.absentCount > 0 }, { I: Clock, color: '#4A7AAB', bgClass: 'bg-brand-500/[0.08]', label: lang === 'ar' ? hr.lateCount + ' متأخر اليوم' : hr.lateCount + ' late today', show: hr.lateCount > 0 }].filter(a => a.show).map((a, i) => { const AI = a.I; return <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${a.bgClass} ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><AI size={14} color={a.color} /><span className="text-xs font-medium" style={{ color: a.color }}>{a.label}</span></div>; })}
                {hr.contractAlerts === 0 && hr.absentCount === 0 && hr.lateCount === 0 && <div className="text-center py-4"><p className="text-xs text-content-muted dark:text-content-muted-dark m-0">{lang === 'ar' ? 'لا تنبيهات اليوم' : 'No alerts today'}</p></div>}
              </div>
            </Box>
          </div>
        </div>
      )}


      {/* ===== متابعات اليوم ===== */}
      <TodayReminders lang={lang} isRTL={isRTL} isDark={isDark} userId={profile?.id} />

      <Box>
        <CardTitle icon={BarChart2} title={lang === 'ar' ? 'روابط سريعة' : 'Quick Links'} />
        <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          {[{ l_ar: 'الموظفين', l_en: 'Employees', path: '/hr/employees', show: sections.showHR, icon: Users }, { l_ar: 'الحضور', l_en: 'Attendance', path: '/hr/attendance', show: sections.showHR, icon: CalendarCheck }, { l_ar: 'الرواتب', l_en: 'Payroll', path: '/hr/payroll', show: sections.showHR, icon: DollarSign }, { l_ar: 'التوظيف', l_en: 'Recruitment', path: '/hr/recruitment', show: sections.showHR, icon: Briefcase }, { l_ar: 'الفرص', l_en: 'Opportunities', path: '/crm/opportunities', show: sections.showCRM, icon: Star }, { l_ar: 'ليد بول', l_en: 'Lead Pool', path: '/crm/lead-pool', show: sections.showCRM, icon: Users }, { l_ar: 'الأداء', l_en: 'Performance', path: '/performance', show: true, icon: TrendingUp }, { l_ar: 'بوابة الموظف', l_en: 'Self-Service', path: '/hr/self-service', show: true, icon: UserCheck }, { l_ar: 'المالية', l_en: 'Finance', path: '/finance', show: sections.showFinance, icon: Wallet }, { l_ar: 'التارجت', l_en: 'Targets', path: '/sales/targets', show: sections.showSales, icon: Target }].filter(l => l.show).map((l, i) => { const LI = l.icon; return <Link key={i} to={l.path} className={`flex items-center gap-[7px] px-3.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-bg dark:bg-brand-500/[0.08] no-underline text-content-muted dark:text-content-muted-dark text-xs font-medium transition-all duration-150 hover:border-brand-500 hover:text-brand-500 hover:bg-brand-500/[0.08] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><LI size={13} /><span>{lang === 'ar' ? l.l_ar : l.l_en}</span></Link>; })}
        </div>
      </Box>
    </div>
  );
}
