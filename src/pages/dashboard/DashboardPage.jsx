import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchTodayReminders } from '../../services/remindersService';
import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Clock, AlertTriangle, Target, UserCheck, Briefcase, ArrowUpRight, ArrowDownRight, Star, Trophy, Building2, Activity, CalendarCheck, ShieldAlert, Wallet, BarChart2 , Bell , Phone , MessageCircle , MapPin , Mail , CheckCircle } from 'lucide-react';

const YEAR = 2026;
const MONTH = 3;
const MOCK_CRM = { totalLeads: 142, newLeadsThisMonth: 38, activeOpps: 24, closedDeals: 11, revenue: 1250000 };
const MOCK_SALES = { target: 1500000, achieved: 1250000, topSales: [{ name_ar: 'أحمد محمود', name_en: 'Ahmed Mahmoud', revenue: 310000, pct: 84 }, { name_ar: 'سارة خالد', name_en: 'Sara Khaled', revenue: 285000, pct: 77 }, { name_ar: 'محمد علي', name_en: 'Mohamed Ali', revenue: 195000, pct: 53 }, { name_ar: 'نورا حسن', name_en: 'Nora Hassan', revenue: 175000, pct: 47 }] };
const REVENUE_TREND = [{ label_ar: 'أكتوبر', label_en: 'Oct', value: 820000 }, { label_ar: 'نوفمبر', label_en: 'Nov', value: 950000 }, { label_ar: 'ديسمبر', label_en: 'Dec', value: 1100000 }, { label_ar: 'يناير', label_en: 'Jan', value: 880000 }, { label_ar: 'فبراير', label_en: 'Feb', value: 1050000 }, { label_ar: 'مارس', label_en: 'Mar', value: 1250000 }];
const PIPELINE_DATA = [{ stage_ar: 'ليد', stage_en: 'Lead', count: 45 }, { stage_ar: 'تواصل', stage_en: 'Contact', count: 32 }, { stage_ar: 'مهتم', stage_en: 'Interest', count: 24 }, { stage_ar: 'معاينة', stage_en: 'Visit', count: 18 }, { stage_ar: 'تفاوض', stage_en: 'Negot.', count: 12 }, { stage_ar: 'مغلق', stage_en: 'Closed', count: 11 }];
const EXPENSE_CATS = [{ name_ar: 'رواتب', name_en: 'Salaries', value: 180000, pct: 56 }, { name_ar: 'إعلانات', name_en: 'Marketing', value: 80000, pct: 25 }, { name_ar: 'إيجار', name_en: 'Rent', value: 35000, pct: 11 }, { name_ar: 'أخرى', name_en: 'Other', value: 25000, pct: 8 }];
const BRAND = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8', '#A8BFD5'];

function buildHRStats(attendance) {
  const presentDays = attendance.filter(r => r.status === 'present' || r.status === 'late');
  const lateDays = attendance.filter(r => r.status === 'late');
  const absentDays = attendance.filter(r => r.status === 'absent');
  const uniqueEmps = [...new Set(attendance.map(r => r.employee_id))].length;
  const attendanceRate = uniqueEmps > 0 ? Math.round((presentDays.length / (uniqueEmps * 22)) * 100) : 0;
  const today = new Date(2026, 2, 8);
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
    <div style={{ background: isDark ? '#1a2234' : '#fff', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: 12, direction: isRTL ? 'rtl' : 'ltr' }}>
      <div style={{ color: isDark ? '#8BA8C8' : '#6b7280', marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: '#4A7AAB', fontWeight: 700 }}>{typeof p.value === 'number' && p.value >= 10000 ? (p.value / 1000).toFixed(0) + 'K EGP' : p.value}</div>)}
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

function TodayReminders({ lang, isRTL, c, isDark }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayReminders().then(data => {
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
    <div style={{ background: c.card, borderRadius: 16, padding: 20, border: '1px solid ' + c.border, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={18} color="#4A7AAB" />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'متابعات اليوم' : "Today's Follow-ups"}</p>
            <p style={{ margin: 0, fontSize: 12, color: c.textMuted }}>{reminders.length > 0 ? (lang === 'ar' ? reminders.length + ' متابعة مجدولة' : reminders.length + ' scheduled') : (lang === 'ar' ? 'لا متابعات اليوم' : 'No follow-ups today')}</p>
          </div>
        </div>
        {reminders.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#EF4444', borderRadius: 20, padding: '2px 10px' }}>{reminders.length}</span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 64, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F8', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : reminders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircle size={32} color="#4A7AAB" style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'أنجزت كل متابعاتك اليوم!' : 'All caught up for today!'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reminders.slice(0, 5).map((r, i) => {
            const t = REMINDER_TYPES[r.type] || REMINDER_TYPES.call;
            const TIcon = t.Icon;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', border: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: t.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TIcon size={15} color={t.color} />
                </div>
                <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: c.text }}>{r.entity_name || (lang === 'ar' ? 'جهة اتصال' : 'Contact')}</p>
                  <p style={{ margin: 0, fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? t.ar : t.en}{r.notes ? ' · ' + r.notes : ''}</p>
                </div>
                <span style={{ fontSize: 11, color: c.textMuted, flexShrink: 0 }}>{formatTime(r.due_at)}</span>
              </div>
            );
          })}
          {reminders.length > 5 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: c.textMuted, textAlign: 'center' }}>
              {lang === 'ar' ? '+ ' + (reminders.length - 5) + ' متابعات أخرى' : '+ ' + (reminders.length - 5) + ' more'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}


export default function DashboardPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark'; const isRTL = i18n.language === 'ar'; const lang = i18n.language;
  const role = profile?.role || 'admin';
  const name = isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar);
  const roleLabel = ROLE_LABELS[role]?.[lang] || '';
  const sections = getSections(role);
  const attendance = getAttendanceForMonth(YEAR, MONTH);
  const hr = useMemo(() => buildHRStats(attendance), [attendance]);
  const c = { bg: isDark ? '#152232' : '#F0F4F8', cardBg: isDark ? '#1a2234' : '#ffffff', border: isDark ? 'rgba(74,122,171,0.2)' : '#E2E8F0', text: isDark ? '#E2EAF4' : '#1A2B3C', textMuted: isDark ? '#8BA8C8' : '#64748B', thBg: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', accent: '#4A7AAB', primary: '#2B4C6F' };
  const dateStr = new Date(2026, 2, 8).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = lang === 'ar' ? 'صباح الخير' : 'Good morning';
  const targetPct = Math.round((MOCK_SALES.achieved / MOCK_SALES.target) * 100);
  const chartData = REVENUE_TREND.map(d => ({ ...d, label: lang === 'ar' ? d.label_ar : d.label_en }));
  const pipeData = PIPELINE_DATA.map(d => ({ ...d, label: lang === 'ar' ? d.stage_ar : d.stage_en }));

  const KpiCard = ({ icon: Icon, label, value, sub, trend, trendUp, color = '#4A7AAB' }) => (
    <div style={{ background: c.cardBg, borderRadius: 14, border: '1px solid ' + c.border, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, [isRTL ? 'right' : 'left']: 0, width: 4, height: '100%', background: 'linear-gradient(180deg,' + color + ',transparent)', borderRadius: isRTL ? '0 14px 14px 0' : '14px 0 0 14px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: c.textMuted, fontWeight: 500 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: c.text, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: c.textMuted }}>{sub}</p>}
          {trend && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, flexDirection: isRTL ? 'row-reverse' : 'row' }}>{trendUp ? <ArrowUpRight size={12} color="#4A7AAB" /> : <ArrowDownRight size={12} color="#EF4444" />}<span style={{ fontSize: 11, color: trendUp ? '#4A7AAB' : '#EF4444', fontWeight: 600 }}>{trend}</span></div>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={20} color={color} /></div>
      </div>
    </div>
  );

  const CardTitle = ({ icon: Icon, title, sub }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={c.accent} /></div>
      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.text }}>{title}</p>
        {sub && <p style={{ margin: 0, fontSize: 11, color: c.textMuted }}>{sub}</p>}
      </div>
    </div>
  );

  const Box = ({ children, style = {} }) => <div style={{ background: c.cardBg, borderRadius: 14, border: '1px solid ' + c.border, padding: 20, ...style }}>{children}</div>;

  return (
    <div style={{ padding: '24px 28px', background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>
      <div style={{ background: 'linear-gradient(135deg, #1B3347 0%, #2B4C6F 55%, #4A7AAB 100%)', borderRadius: 16, padding: '22px 28px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: isRTL ? 'auto' : -20, left: isRTL ? -20 : 'auto', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#fff' }}>{greeting}، {name}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{roleLabel} · {dateStr}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row', position: 'relative' }}>
          {[{ l: lang === 'ar' ? 'ليد جديد' : 'New Leads', v: MOCK_CRM.newLeadsThisMonth }, { l: lang === 'ar' ? 'صفقة مغلقة' : 'Closed', v: MOCK_CRM.closedDeals }, { l: lang === 'ar' ? 'التارجت' : 'Target', v: targetPct + '%' }].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>{s.v}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {sections.showCRM && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={Users}      label={lang === 'ar' ? 'إجمالي الليدز' : 'Total Leads'}  value={MOCK_CRM.totalLeads}                        trend={lang === 'ar' ? '+12 هذا الشهر' : '+12 this month'} trendUp color="#4A7AAB" />
          <KpiCard icon={Activity}   label={lang === 'ar' ? 'فرص نشطة'      : 'Active Opps'}  value={MOCK_CRM.activeOpps}                        trend={lang === 'ar' ? 'vs الشهر الماضي' : 'vs last month'} trendUp color="#2B4C6F" />
          <KpiCard icon={Trophy}     label={lang === 'ar' ? 'صفقات مغلقة'   : 'Deals Closed'} value={MOCK_CRM.closedDeals}                       trend={lang === 'ar' ? '+3 هذا الشهر' : '+3 this month'} trendUp color="#6B8DB5" />
          <KpiCard icon={DollarSign} label={lang === 'ar' ? 'الإيرادات'     : 'Revenue'}      value={(MOCK_CRM.revenue / 1000).toFixed(0) + 'K'} sub="EGP" trend={lang === 'ar' ? '83% من التارجت' : '83% of target'} trendUp color="#4A7AAB" />
        </div>
      )}

      {sections.showCRM && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
          <Box>
            <CardTitle icon={TrendingUp} title={lang === 'ar' ? 'تطور الإيرادات' : 'Revenue Trend'} sub={lang === 'ar' ? 'آخر 6 أشهر' : 'Last 6 months'} />
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4A7AAB" stopOpacity={0.25} /><stop offset="95%" stopColor="#4A7AAB" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(74,122,171,0.1)' : 'rgba(0,0,0,0.06)'} />
                <XAxis dataKey="label" tick={{ fill: c.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: c.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000) + 'K'} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
                <Area type="monotone" dataKey="value" stroke="#4A7AAB" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#4A7AAB', r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <CardTitle icon={Wallet} title={lang === 'ar' ? 'توزيع المصروفات' : 'Expenses'} sub={lang === 'ar' ? 'مارس 2026' : 'March 2026'} />
            <ResponsiveContainer width="100%" height={120}>
              <PieChart><Pie data={EXPENSE_CATS} cx="50%" cy="50%" innerRadius={34} outerRadius={52} paddingAngle={3} dataKey="value">{EXPENSE_CATS.map((_, i) => <Cell key={i} fill={BRAND[i + 1]} />)}</Pie><Tooltip formatter={v => [(v / 1000).toFixed(0) + 'K EGP']} /></PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
              {EXPENSE_CATS.map((cat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: BRAND[i + 1] }} /><span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? cat.name_ar : cat.name_en}</span></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{cat.pct}%</span>
                </div>
              ))}
            </div>
          </Box>
        </div>
      )}

      {sections.showSales && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <Box>
            <CardTitle icon={Activity} title={lang === 'ar' ? 'خط الأنابيب' : 'Sales Pipeline'} sub={lang === 'ar' ? 'فرص لكل مرحلة' : 'Opps per stage'} />
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={pipeData} margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(74,122,171,0.08)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="label" tick={{ fill: c.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: c.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>{pipeData.map((_, i) => <Cell key={i} fill={'rgba(74,122,171,' + (0.35 + i * 0.13) + ')'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <CardTitle icon={Trophy} title={lang === 'ar' ? 'أفضل البائعين' : 'Top Performers'} sub={lang === 'ar' ? 'حسب الإيرادات' : 'By revenue'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MOCK_SALES.topSales.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: i === 0 ? '#1B3347' : i === 1 ? '#2B4C6F' : 'rgba(74,122,171,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 11, fontWeight: 700, color: i < 2 ? '#fff' : c.accent }}>{i + 1}</span></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{lang === 'ar' ? s.name_ar : s.name_en}</span>
                      <span style={{ fontSize: 11, color: c.accent, fontWeight: 700 }}>{(s.revenue / 1000).toFixed(0)}K</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}><div style={{ height: '100%', borderRadius: 2, width: s.pct + '%', background: i === 0 ? '#4A7AAB' : i === 1 ? '#6B8DB5' : '#8BA8C8' }} /></div>
                  </div>
                  <span style={{ fontSize: 10, color: c.textMuted, minWidth: 26, textAlign: 'center' }}>{s.pct}%</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid ' + c.border }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, flexDirection: isRTL ? 'row-reverse' : 'row' }}><span style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? 'التارجت الشهري' : 'Monthly Target'}</span><span style={{ fontSize: 12, fontWeight: 700, color: c.accent }}>{targetPct}%</span></div>
              <div style={{ height: 8, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, width: targetPct + '%', background: 'linear-gradient(90deg, #2B4C6F, #4A7AAB)' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, flexDirection: isRTL ? 'row-reverse' : 'row' }}><span style={{ fontSize: 10, color: c.textMuted }}>{(MOCK_SALES.achieved / 1000).toFixed(0)}K</span><span style={{ fontSize: 10, color: c.textMuted }}>{(MOCK_SALES.target / 1000).toFixed(0)}K EGP</span></div>
            </div>
          </Box>
        </div>
      )}

      {sections.showHR && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
            <KpiCard icon={Users}         label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={hr.total}                color="#1B3347" />
            <KpiCard icon={CalendarCheck} label={lang === 'ar' ? 'معدل الحضور'     : 'Attendance Rate'}  value={hr.attendanceRate + '%'} color="#2B4C6F" trend={lang === 'ar' ? 'هذا الشهر' : 'This month'} trendUp />
            <KpiCard icon={Briefcase}     label={lang === 'ar' ? 'وظائف مفتوحة'   : 'Open Positions'}   value={hr.openPositions}        color="#4A7AAB" />
            <KpiCard icon={UserCheck}     label={lang === 'ar' ? 'إجازات معلقة'   : 'Pending Leaves'}   value={hr.pendingLeaves}        color="#6B8DB5" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Box>
              <CardTitle icon={Building2} title={lang === 'ar' ? 'توزيع الأقسام' : 'Departments'} sub={lang === 'ar' ? 'عدد الموظفين' : 'Headcount'} />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hr.deptCounts} layout="vertical" margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? 'rgba(74,122,171,0.08)' : 'rgba(0,0,0,0.05)'} />
                  <XAxis type="number" tick={{ fill: c.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey={lang === 'ar' ? 'name_ar' : 'name_en'} tick={{ fill: c.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#4A7AAB" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <CardTitle icon={ShieldAlert} title={lang === 'ar' ? 'تنبيهات HR' : 'HR Alerts'} sub={lang === 'ar' ? 'تحتاج متابعة' : 'Needs attention'} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[{ I: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: lang === 'ar' ? hr.contractAlerts + ' عقد ينتهي قريباً' : hr.contractAlerts + ' contracts expiring', show: hr.contractAlerts > 0 }, { I: Clock, color: '#6B8DB5', bg: 'rgba(107,141,181,0.1)', label: lang === 'ar' ? hr.probationCount + ' موظف في فترة تجربة' : hr.probationCount + ' on probation', show: hr.probationCount > 0 }, { I: UserCheck, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: lang === 'ar' ? hr.absentCount + ' غائب اليوم' : hr.absentCount + ' absent today', show: hr.absentCount > 0 }, { I: Clock, color: '#4A7AAB', bg: 'rgba(74,122,171,0.08)', label: lang === 'ar' ? hr.lateCount + ' متأخر اليوم' : hr.lateCount + ' late today', show: hr.lateCount > 0 }].filter(a => a.show).map((a, i) => { const AI = a.I; return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: a.bg, flexDirection: isRTL ? 'row-reverse' : 'row' }}><AI size={14} color={a.color} /><span style={{ fontSize: 12, color: a.color, fontWeight: 500 }}>{a.label}</span></div>; })}
                {hr.contractAlerts === 0 && hr.absentCount === 0 && hr.lateCount === 0 && <div style={{ textAlign: 'center', padding: '16px 0' }}><p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{lang === 'ar' ? 'لا تنبيهات اليوم' : 'No alerts today'}</p></div>}
              </div>
            </Box>
          </div>
        </div>
      )}


      {/* ===== متابعات اليوم ===== */}
      <TodayReminders lang={lang} isRTL={isRTL} c={c} isDark={isDark} />

      <Box>
        <CardTitle icon={BarChart2} title={lang === 'ar' ? 'روابط سريعة' : 'Quick Links'} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {[{ l_ar: 'الموظفين', l_en: 'Employees', path: '/hr/employees', show: sections.showHR, icon: Users }, { l_ar: 'الحضور', l_en: 'Attendance', path: '/hr/attendance', show: sections.showHR, icon: CalendarCheck }, { l_ar: 'الرواتب', l_en: 'Payroll', path: '/hr/payroll', show: sections.showHR, icon: DollarSign }, { l_ar: 'التوظيف', l_en: 'Recruitment', path: '/hr/recruitment', show: sections.showHR, icon: Briefcase }, { l_ar: 'الفرص', l_en: 'Opportunities', path: '/crm/opportunities', show: sections.showCRM, icon: Star }, { l_ar: 'ليد بول', l_en: 'Lead Pool', path: '/crm/lead-pool', show: sections.showCRM, icon: Users }, { l_ar: 'الأداء', l_en: 'Performance', path: '/performance', show: true, icon: TrendingUp }, { l_ar: 'بوابة الموظف', l_en: 'Self-Service', path: '/hr/self-service', show: true, icon: UserCheck }, { l_ar: 'المالية', l_en: 'Finance', path: '/finance', show: sections.showFinance, icon: Wallet }, { l_ar: 'التارجت', l_en: 'Targets', path: '/sales/targets', show: sections.showSales, icon: Target }].filter(l => l.show).map((l, i) => { const LI = l.icon; return <a key={i} href={l.path} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.thBg, textDecoration: 'none', color: c.textMuted, fontSize: 12, fontWeight: 500, flexDirection: isRTL ? 'row-reverse' : 'row', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; e.currentTarget.style.background = 'rgba(74,122,171,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.background = c.thBg; }}><LI size={13} /><span>{lang === 'ar' ? l.l_ar : l.l_en}</span></a>; })}
        </div>
      </Box>
    </div>
  );
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        }
