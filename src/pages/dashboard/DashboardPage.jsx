import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchTodayReminders } from '../../services/remindersService';
import { fetchAllDashboardData, buildPipelineData, getDateRange, buildRevenueTrend, buildTopSellers, filterStatsByRange } from '../../services/dashboardService';
import { runTemperatureDecay } from '../../services/leadRecyclingService';
import { checkContactBirthdays } from '../../services/birthdayService';
import { getTopPerformers, getTeamOverallPct, METRIC_CONFIG } from '../../services/kpiTargetsService';
import { getWonDeals } from '../../services/dealsService';
import { Link, useNavigate } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Clock, AlertTriangle, Target, UserCheck, Briefcase, ArrowUpRight, ArrowDownRight, Star, Trophy, Building2, Activity, CalendarCheck, ShieldAlert, Wallet, BarChart2, Bell, Phone, MessageCircle, MapPin, Mail, CheckCircle, Repeat, Check, SkipForward, User, Settings, X, ChevronUp, ChevronDown, RotateCcw, Eye, EyeOff, Volume2, Pin } from 'lucide-react';
import { Card, KpiCard, Badge, DashboardSkeleton } from '../../components/ui';
import { generateDueInstances, getTodayInstances, completeInstance, skipInstance, PRIORITY_OPTIONS } from '../../services/recurringTaskService';
import { getLayout, saveLayout, resetLayout, getWidgetMeta, WIDGET_CATEGORIES, SIZE_OPTIONS } from '../../services/widgetService';
import SuggestionsPanel from '../../components/ui/SuggestionsPanel';
import { getQuarterSummary, computeObjectiveProgress } from '../../services/okrService';
import { getAnnouncements, isRead as isAnnRead, markAsRead as markAnnRead, CATEGORIES as ANN_CATEGORIES } from '../../services/announcementService';
import HeatmapCalendar from '../../components/ui/HeatmapCalendar';
import ErrorBoundary from '../../components/ErrorBoundary';
import { getActivityHeatmap } from '../../services/heatmapService';
import { useResponsive } from '../../hooks/useMediaQuery';
import { useToast } from '../../contexts/ToastContext';

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;
const EMPTY_CRM = { totalLeads: 0, newLeadsThisMonth: 0, activeOpps: 0, closedDeals: 0, revenue: 0 };
// Safety: ensure values are never objects when rendered as React children (error #310)
const safeChild = (v) => (v != null && typeof v === 'object') ? JSON.stringify(v) : v;
const DATE_RANGE_OPTIONS = [
  { value: 'this_week',     label_ar: 'هذا الأسبوع',    label_en: 'This Week' },
  { value: 'this_month',    label_ar: 'هذا الشهر',     label_en: 'This Month' },
  { value: 'last_3_months', label_ar: 'آخر 3 أشهر',    label_en: 'Last 3 Months' },
  { value: 'this_year',     label_ar: 'هذا العام',     label_en: 'This Year' },
];
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
      {payload.map((p, i) => <div key={i} className="text-brand-500 font-bold text-sm">{typeof p.value === 'number' && p.value >= 10000 ? Number((p.value / 1000).toFixed(0)).toLocaleString() + 'K EGP' : typeof p.value === 'number' ? p.value.toLocaleString() : safeChild(p.value)}</div>)}
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

function TodayRecurringTasks({ lang, isRTL, isDark }) {
  const [instances, setInstances] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { generateDueInstances(); } catch { /* ignore */ }
    setInstances(getTodayInstances());
    setLoaded(true);
  }, []);

  const handleComplete = (id) => {
    completeInstance(id);
    setInstances(getTodayInstances());
  };
  const handleSkip = (id) => {
    skipInstance(id);
    setInstances(getTodayInstances());
  };

  const pending = instances.filter(i => i.status === 'pending');
  const doneCount = instances.filter(i => i.status === 'completed' || i.status === 'skipped').length;

  if (!loaded) return null;

  return (
    <div>
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-9 h-9 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Repeat size={18} className="text-brand-500" />
          </div>
          <div className="text-start">
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'مهام اليوم المتكررة' : "Today's Recurring Tasks"}
            </p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {pending.length > 0
                ? (lang === 'ar' ? pending.length + ' مهمة مستحقة' : pending.length + ' due')
                : (lang === 'ar' ? 'لا مهام متكررة اليوم' : 'No recurring tasks today')}
            </p>
          </div>
        </div>
        {pending.length > 0 && (
          <Badge variant="danger" size="sm" className="bg-red-500 text-white rounded-full px-2.5 py-0.5">
            {pending.length}
          </Badge>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle size={32} className="text-brand-500 opacity-40 mb-2 mx-auto" />
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mb-3">
            {doneCount > 0
              ? (lang === 'ar' ? 'أنجزت كل مهامك المتكررة!' : 'All recurring tasks done!')
              : (lang === 'ar' ? 'لا مهام متكررة مجدولة اليوم' : 'No recurring tasks scheduled today')}
          </p>
          <Link to="/tasks" className="text-xs font-semibold text-brand-500 px-3 py-1.5 rounded-lg bg-brand-500/[0.08] hover:bg-brand-500/[0.15] transition-all no-underline">
            {lang === 'ar' ? 'عرض كل المهام' : 'View all tasks'}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.slice(0, 5).map((inst) => {
            const priColor = PRIORITY_OPTIONS[inst.priority]?.color || '#4A7AAB';
            return (
              <div key={inst.id} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-bg dark:bg-white/[0.04] border border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: priColor + '18' }}>
                  <Repeat size={15} color={priColor} />
                </div>
                <div className="flex-1 text-start min-w-0">
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                    {lang === 'ar' ? (inst.titleAr || inst.title) : inst.title}
                  </p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark" style={{ display: 'flex', gap: 6, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <Clock size={9} /> {inst.dueTime}
                    </span>
                    {inst.assigneeName && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <User size={9} /> {inst.assigneeName}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <button onClick={() => handleComplete(inst.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 7,
                    border: 'none', background: '#10B98118', color: '#10B981', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer',
                  }}>
                    <Check size={12} /> {lang === 'ar' ? 'تم' : 'Done'}
                  </button>
                  <button onClick={() => handleSkip(inst.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 7,
                    border: 'none', background: isDark ? '#ffffff0a' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <SkipForward size={12} /> {lang === 'ar' ? 'تخطي' : 'Skip'}
                  </button>
                </div>
              </div>
            );
          })}
          {pending.length > 5 && (
            <p className="mt-1 mb-0 text-xs text-content-muted dark:text-content-muted-dark text-center">
              {lang === 'ar' ? '+ ' + (pending.length - 5) + ' مهام أخرى' : '+ ' + (pending.length - 5) + ' more'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
    <div>
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
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mb-3">{lang === 'ar' ? 'أنجزت كل متابعاتك اليوم!' : 'All caught up for today!'}</p>
          <div className="flex gap-2 justify-center">
            <Link to="/contacts" className="text-xs font-semibold text-brand-500 px-3 py-1.5 rounded-lg bg-brand-500/[0.08] hover:bg-brand-500/[0.15] transition-all no-underline">
              {lang === 'ar' ? 'اتصل بليدز جديدة' : 'Call new leads'}
            </Link>
            <Link to="/tasks" className="text-xs font-semibold text-brand-500 px-3 py-1.5 rounded-lg bg-brand-500/[0.08] hover:bg-brand-500/[0.15] transition-all no-underline">
              {lang === 'ar' ? 'أنشئ مهمة' : 'Create task'}
            </Link>
          </div>
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
            <Link to="/contacts" className="mt-1 mb-0 text-xs text-brand-500 font-semibold text-center block hover:underline">
              {lang === 'ar' ? '+ ' + (reminders.length - 5) + ' متابعات أخرى — عرض الكل' : '+ ' + (reminders.length - 5) + ' more — View All'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Widget Wrapper ─────────────────────────────────────────────────── */
function WidgetCard({ title, children, isDark, isRTL, lang, collapsed, onToggleCollapse }) {
  return (
    <Card className="p-5">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: collapsed ? 0 : 12,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: isDark ? '#e2e8f0' : '#1e293b',
        }}>{safeChild(title)}</span>
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            color: isDark ? '#94a3b8' : '#64748b',
          }}
          title={collapsed ? (lang === 'ar' ? 'توسيع' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && children}
    </Card>
  );
}

/* ─── Customize Panel ────────────────────────────────────────────────── */
function CustomizePanel({ layout, onUpdate, onReset, onClose, isDark, isRTL, lang }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const moveWidget = (index, direction) => {
    const newLayout = [...layout];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newLayout.length) return;
    const temp = { ...newLayout[index] };
    newLayout[index] = { ...newLayout[targetIdx] };
    newLayout[targetIdx] = temp;
    newLayout.forEach((item, i) => { item.order = i; });
    onUpdate(newLayout);
  };

  const toggleVisibility = (widgetId) => {
    const newLayout = layout.map(item =>
      item.widgetId === widgetId ? { ...item, visible: !item.visible } : item
    );
    onUpdate(newLayout);
  };

  const changeSize = (widgetId, newSize) => {
    const newLayout = layout.map(item =>
      item.widgetId === widgetId ? { ...item, size: newSize } : item
    );
    onUpdate(newLayout);
  };

  const filteredLayout = activeCategory === 'all'
    ? layout
    : layout.filter(item => {
        const meta = getWidgetMeta(item.widgetId);
        return meta?.category === activeCategory;
      });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: isDark ? '#1a2332' : '#ffffff',
        borderRadius: 16,
        width: '90%',
        maxWidth: 600,
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid ' + (isDark ? '#ffffff12' : '#e2e8f0'),
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Settings size={18} color="#4A7AAB" />
            <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {lang === 'ar' ? 'تخصيص الويدجت' : 'Customize Widgets'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button
              onClick={onReset}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: isDark ? '#ffffff0a' : '#f1f5f9',
                color: isDark ? '#94a3b8' : '#64748b',
              }}
            >
              <RotateCcw size={12} />
              {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 6, display: 'flex',
              color: isDark ? '#94a3b8' : '#64748b',
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Category filter tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: '12px 24px',
          borderBottom: '1px solid ' + (isDark ? '#ffffff08' : '#f1f5f9'),
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
        }}>
          <button
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeCategory === 'all' ? '#4A7AAB' : (isDark ? '#ffffff0a' : '#f1f5f9'),
              color: activeCategory === 'all' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
              transition: 'all 0.15s',
            }}
            onClick={() => setActiveCategory('all')}
          >
            {lang === 'ar' ? 'الكل' : 'All'}
          </button>
          {WIDGET_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeCategory === cat.id ? '#4A7AAB' : (isDark ? '#ffffff0a' : '#f1f5f9'),
                color: activeCategory === cat.id ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                transition: 'all 0.15s',
              }}
              onClick={() => setActiveCategory(cat.id)}
            >
              {lang === 'ar' ? cat.label_ar : cat.label_en}
            </button>
          ))}
        </div>

        {/* Widget list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filteredLayout.map((item) => {
            const meta = getWidgetMeta(item.widgetId);
            if (!meta) return null;
            const globalIdx = layout.findIndex(l => l.widgetId === item.widgetId);
            return (
              <div key={item.widgetId} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 10,
                background: isDark
                  ? (item.visible ? '#4A7AAB12' : '#ffffff06')
                  : (item.visible ? '#4A7AAB08' : '#f8fafc'),
                border: '1px solid ' + (isDark ? '#ffffff0a' : '#e2e8f0'),
                marginBottom: 8,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: item.visible ? 1 : 0.6,
              }}>
                {/* Arrows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={() => moveWidget(globalIdx, -1)}
                    disabled={globalIdx === 0}
                    style={{
                      background: 'none', border: 'none', cursor: globalIdx === 0 ? 'default' : 'pointer',
                      padding: 2, opacity: globalIdx === 0 ? 0.3 : 1,
                      color: isDark ? '#94a3b8' : '#64748b',
                    }}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveWidget(globalIdx, 1)}
                    disabled={globalIdx === layout.length - 1}
                    style={{
                      background: 'none', border: 'none', cursor: globalIdx === layout.length - 1 ? 'default' : 'pointer',
                      padding: 2, opacity: globalIdx === layout.length - 1 ? 0.3 : 1,
                      color: isDark ? '#94a3b8' : '#64748b',
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Widget info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    marginBottom: 2,
                  }}>
                    {lang === 'ar' ? meta.title_ar : meta.title_en}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: isDark ? '#94a3b8' : '#64748b',
                  }}>
                    {lang === 'ar' ? meta.description_ar : meta.description_en}
                  </div>
                  {/* Size selector */}
                  <div style={{
                    display: 'flex', gap: 4, marginTop: 6,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }}>
                    {SIZE_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        style={{
                          padding: '2px 8px', borderRadius: 5,
                          border: '1px solid ' + (item.size === s.value ? '#4A7AAB' : (isDark ? '#ffffff15' : '#e2e8f0')),
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          background: item.size === s.value ? '#4A7AAB22' : 'transparent',
                          color: item.size === s.value ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                        }}
                        onClick={() => changeSize(item.widgetId, s.value)}
                      >
                        {lang === 'ar' ? s.label_ar : s.label_en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle visibility */}
                <button
                  onClick={() => toggleVisibility(item.widgetId)}
                  style={{
                    background: item.visible ? '#4A7AAB22' : (isDark ? '#ffffff0a' : '#f1f5f9'),
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: item.visible ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                  }}
                  title={item.visible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}
                >
                  {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function MyDayWidget({ lang, isRTL, isDark, userId, navigate }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayReminders(userId).then(data => {
      setReminders(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const todayTasks = useMemo(() => {
    try { generateDueInstances(); } catch {}
    return getTodayInstances().filter(i => i.status === 'pending');
  }, []);

  const overdueTasks = useMemo(() => [], []);
  const newLeadsToday = useMemo(() => [], []);

  const sections = [
    { icon: Bell, label: lang === 'ar' ? 'متابعات اليوم' : "Today's Follow-ups", count: reminders.length, color: '#4A7AAB', link: '/contacts', loading },
    { icon: AlertTriangle, label: lang === 'ar' ? 'فرص متأخرة' : 'Overdue Opps', count: overdueTasks.length, color: overdueTasks.length > 0 ? '#EF4444' : '#10B981', link: '/crm/opportunities' },
    { icon: Repeat, label: lang === 'ar' ? 'مهام متكررة' : 'Recurring Tasks', count: todayTasks.length, color: '#F59E0B', link: '/tasks' },
    { icon: UserCheck, label: lang === 'ar' ? 'ليدز جديدة اليوم' : 'New Leads Today', count: newLeadsToday.length, color: '#8B5CF6', link: '/contacts' },
  ];

  const quickActions = [
    { icon: Phone, label: lang === 'ar' ? 'سجل مكالمة' : 'Log Call', link: '/contacts', color: '#10B981' },
    { icon: Users, label: lang === 'ar' ? 'ليد جديد' : 'New Lead', link: '/contacts?action=add', color: '#4A7AAB' },
    { icon: Activity, label: lang === 'ar' ? 'الفرص' : 'Opportunities', link: '/crm/opportunities', color: '#2B4C6F' },
  ];

  return (
    <div>
      <div className={`flex items-center gap-2.5 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="w-9 h-9 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <Star size={18} className="text-brand-500" />
        </div>
        <div className="text-start">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {lang === 'ar' ? 'يومي' : 'My Day'}
          </p>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {lang === 'ar' ? 'كل اللي محتاج تعمله النهاردة' : 'Everything you need to do today'}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        {sections.map((s, i) => {
          const SIcon = s.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(s.link)}
              className="cursor-pointer rounded-xl p-3 bg-surface-bg dark:bg-white/[0.04] border border-edge dark:border-edge-dark hover:border-brand-500/40 transition-all duration-150"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <div className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.color + '18' }}>
                  <SIcon size={14} color={s.color} />
                </div>
              </div>
              <p className="m-0 text-xl font-bold text-content dark:text-content-dark">
                {s.loading ? '...' : s.count}
              </p>
              <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark leading-tight mt-0.5">
                {s.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {quickActions.map((a, i) => {
          const AIcon = a.icon;
          return (
            <button
              key={i}
              onClick={() => navigate(a.link)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark hover:border-brand-500/40 transition-all duration-150 cursor-pointer"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <AIcon size={14} color={a.color} />
              <span className="text-xs font-semibold text-content dark:text-content-dark">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isMobile: isMobileView } = useResponsive();
  const toast = useToast();
  const isRTL = i18n.language === 'ar'; const lang = i18n.language;
  const role = profile?.role || 'admin';
  const userId = profile?.id || profile?.email || '';
  const name = isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar);
  const roleLabel = ROLE_LABELS[role]?.[lang] || '';
  const navigate = useNavigate();
  const sections = useMemo(() => getSections(role), [role]);
  const attendance = useMemo(() => getAttendanceForMonth(YEAR, MONTH), []);

  // ── Widget layout state ────────────────────────────────────────────────
  const [widgetLayout, setWidgetLayout] = useState(() => getLayout(role));
  const [collapsedWidgets, setCollapsedWidgets] = useState({});
  const [showCustomize, setShowCustomize] = useState(false);

  const handleUpdateLayout = useCallback((newLayout) => {
    setWidgetLayout(newLayout);
    saveLayout(newLayout);
  }, []);

  const handleResetLayout = useCallback(() => {
    const defaults = resetLayout(role);
    setWidgetLayout(defaults);
  }, [role]);

  const toggleCollapse = useCallback((widgetId) => {
    setCollapsedWidgets(prev => ({ ...prev, [widgetId]: !prev[widgetId] }));
  }, []);

  // ── Date range filter ────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState('this_year');
  const activeDateRange = getDateRange(dateRange);
  const hr = useMemo(() => buildHRStats(attendance), [attendance]);
  const dateStr = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = new Date().getHours();
  const greeting = lang === 'ar'
    ? (hour < 12 ? 'صباح الخير' : 'مساء الخير')
    : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

  // ── Pre-loaded async data for widgets ──────────────────────────────────
  const [dashAnnouncements, setDashAnnouncements] = useState([]);
  const [dashQuarterSummary, setDashQuarterSummary] = useState({ total: 0, avgProgress: 0, onTrack: 0, atRisk: 0, behind: 0 });
  const [dashTeamPerf, setDashTeamPerf] = useState({ topPerformers: [], teamPct: 0 });
  useEffect(() => {
    const loadAsync = async () => {
      try { const annResult = await getAnnouncements(); setDashAnnouncements(Array.isArray(annResult) ? annResult.slice(0, 3) : []); } catch {}
      try {
        const currentMonth = new Date().getMonth();
        const cq = currentMonth < 3 ? 'Q1' : currentMonth < 6 ? 'Q2' : currentMonth < 9 ? 'Q3' : 'Q4';
        const cy = new Date().getFullYear();
        const gsResult = await getQuarterSummary(cq, cy);
        setDashQuarterSummary(gsResult && typeof gsResult === 'object' ? gsResult : { total: 0, avgProgress: 0, onTrack: 0, atRisk: 0, behind: 0 });
      } catch {}
      try {
        const salesEmps = MOCK_EMPLOYEES.filter(e => ['sales_director','sales_manager','team_leader','sales_agent'].includes(e.role));
        const tp = await getTopPerformers(salesEmps, MONTH, YEAR, 3);
        const pct = await getTeamOverallPct(salesEmps, MONTH, YEAR);
        setDashTeamPerf({ topPerformers: Array.isArray(tp) ? tp : [], teamPct: typeof pct === 'number' ? pct : 0 });
      } catch {}
    };
    loadAsync();
  }, []);

  // ── Real Supabase data ──────────────────────────────────────────────────
  const [dashData, setDashData] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    // Run lead temperature decay + birthday checks on dashboard load (non-blocking)
    runTemperatureDecay().catch(() => {});
    checkContactBirthdays(userId).catch(() => {});

    fetchAllDashboardData().then(data => {
      setDashData(data);
      setDashLoading(false);
    }).catch(() => {
      setDashLoading(false);
      toast.error(lang === 'ar' ? 'فشل تحميل بيانات لوحة التحكم' : 'Failed to load dashboard data');
    });
  }, []);

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
    return EMPTY_CRM;
  }, [dashData]);

  const taskStats = dashData?.tasks;
  const activityStats = dashData?.activities;

  const rawOpps = dashData?.opportunities?.rawOpps;

  const [wonDeals, setWonDeals] = useState([]);
  useEffect(() => { getWonDeals().then(d => setWonDeals(d || [])).catch(() => {
    toast.error(lang === 'ar' ? 'فشل تحميل الصفقات' : 'Failed to load deals');
  }); }, []);

  const rangeStats = useMemo(() => {
    if (!rawOpps?.length) return null;
    return filterStatsByRange(rawOpps, activeDateRange);
  }, [rawOpps, activeDateRange]);

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

  const salesData = realTopSellers || [];
  // Sales target: from localStorage config (set in Settings), or 0 = no target configured
  const salesTarget = (() => {
    try { return Number(JSON.parse(localStorage.getItem('platform_system_config') || '{}').monthly_sales_target) || 0; } catch { return 0; }
  })();
  const targetPct = salesTarget > 0 ? Math.min(Math.round((filteredCrm.revenue / salesTarget) * 100), 100) : 0;
  const chartData = useMemo(() => (realRevenueTrend || []).map(d => ({ ...d, label: lang === 'ar' ? d.label_ar : d.label_en })), [lang, realRevenueTrend]);

  const realPipeline = useMemo(() => {
    const stageCounts = rangeStats?.stageCounts || dashData?.opportunities?.stageCounts;
    if (stageCounts) {
      const built = buildPipelineData(stageCounts);
      if (built && built.length > 0) return built;
    }
    return null;
  }, [dashData, rangeStats]);
  const pipeData = useMemo(() => (realPipeline || []).map(d => ({ ...d, label: lang === 'ar' ? d.stage_ar : d.stage_en })), [realPipeline, lang]);

  const employeeCount = dashData?.employees?.totalEmployees ?? hr.total;

  const mutedColor = isDark ? '#8BA8C8' : '#64748B';

  const DashKpiCard = ({ icon: Icon, label, value, sub, trend, trendUp, color = '#4A7AAB', onClick }) => (
    <Card className={`relative overflow-hidden px-5 py-[18px] ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''}`} onClick={onClick}>
      <div className="absolute top-0 start-0 w-1 h-full rounded-s-xl" style={{ background: 'linear-gradient(180deg,' + color + ',transparent)' }} />
      <div className={`flex justify-between items-start ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="text-start">
          <p className="m-0 mb-1.5 text-xs text-content-muted dark:text-content-muted-dark font-medium">{safeChild(label)}</p>
          <p className="m-0 text-2xl font-bold text-content dark:text-content-dark leading-none">{safeChild(value)}</p>
          {sub && <p className="m-0 mt-1 text-xs text-content-muted dark:text-content-muted-dark">{safeChild(sub)}</p>}
          {trend && <div className={`flex items-center gap-1 mt-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>{trendUp ? <ArrowUpRight size={12} className="text-brand-500" /> : <ArrowDownRight size={12} className="text-red-500" />}<span className={`text-xs font-semibold ${trendUp ? 'text-brand-500' : 'text-red-500'}`}>{safeChild(trend)}</span></div>}
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

  // ── Widget render map ─────────────────────────────────────────────────
  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'kpi_overview':
        if (!sections.showCRM) return null;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <DashKpiCard icon={Users}      label={lang === 'ar' ? 'إجمالي الليدز' : 'Total Leads'}  value={dashLoading ? '...' : crm.totalLeads}                        trend={crm.newLeadsThisMonth > 0 ? (lang === 'ar' ? '+' + crm.newLeadsThisMonth + ' هذا الشهر' : '+' + crm.newLeadsThisMonth + ' this month') : undefined} trendUp color="#4A7AAB" onClick={() => navigate('/crm/contacts')} />
            <DashKpiCard icon={Activity}   label={lang === 'ar' ? 'فرص نشطة'      : 'Active Opps'}  value={dashLoading ? '...' : filteredCrm.activeOpps}                        trend={lang === 'ar' ? 'vs الشهر الماضي' : 'vs last month'} trendUp color="#2B4C6F" onClick={() => navigate('/crm/opportunities')} />
            <DashKpiCard icon={Trophy}     label={lang === 'ar' ? 'صفقات مغلقة'   : 'Deals Closed'} value={dashLoading ? '...' : filteredCrm.closedDeals}                       trend={crm.closedThisMonth > 0 ? (lang === 'ar' ? '+' + crm.closedThisMonth + ' هذا الشهر' : '+' + crm.closedThisMonth + ' this month') : undefined} trendUp color="#6B8DB5" onClick={() => navigate('/crm/opportunities')} />
            <DashKpiCard icon={DollarSign} label={lang === 'ar' ? 'الإيرادات'     : 'Revenue'}      value={dashLoading ? '...' : (filteredCrm.revenue ? (filteredCrm.revenue / 1000).toFixed(0) + 'K' : '0')} sub="EGP" trend={targetPct > 0 ? (lang === 'ar' ? targetPct + '% من التارجت' : targetPct + '% of target') : undefined} trendUp color="#4A7AAB" onClick={() => navigate('/finance')} />
            <DashKpiCard icon={TrendingUp} label={lang === 'ar' ? 'قيمة الـ Pipeline' : 'Pipeline Value'} value={dashLoading ? '...' : (() => { const pv = (rawOpps || []).filter(o => !['closed_won','closed_lost'].includes(o.stage)).reduce((s, o) => s + (o.budget || 0), 0); return pv ? (pv / 1000).toFixed(0) + 'K' : '0'; })()} sub="EGP" color="#2B4C6F" onClick={() => navigate('/crm/opportunities')} />
          </div>
        );

      case 'recent_activities':
        if (!sections.showCRM || !(taskStats || activityStats)) return null;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
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
        );

      case 'revenue_trend':
        if (!sections.showCRM) return null;
        return (
          <div>
            <CardTitle icon={TrendingUp} title={lang === 'ar' ? 'تطور الإيرادات' : 'Revenue Trend'} sub={lang === 'ar' ? DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label_ar : DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label_en} />
            {chartData.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp size={32} className="text-brand-500 opacity-30 mb-2 mx-auto" />
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لا بيانات إيرادات حتى الآن' : 'No revenue data yet'}</p>
              </div>
            ) : (
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
            )}
          </div>
        );

      case 'expense_summary':
        if (!sections.showCRM) return null;
        return (
          <div>
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
          </div>
        );

      case 'pipeline_chart':
        if (!sections.showSales) return null;
        return (
          <div>
            <CardTitle icon={Activity} title={lang === 'ar' ? 'خط الأنابيب' : 'Sales Pipeline'} sub={lang === 'ar' ? 'فرص لكل مرحلة' : 'Opps per stage'} />
            {pipeData.length === 0 ? (
              <div className="text-center py-8">
                <Activity size={32} className="text-brand-500 opacity-30 mb-2 mx-auto" />
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لا فرص في الأنابيب حتى الآن' : 'No pipeline data yet'}</p>
              </div>
            ) : (
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
            )}
          </div>
        );

      case 'top_sellers':
        if (!sections.showSales) return null;
        return (
          <div>
            <CardTitle icon={Trophy} title={lang === 'ar' ? 'أفضل البائعين' : 'Top Performers'} sub={lang === 'ar' ? 'حسب الإيرادات' : 'By revenue'} />
            {salesData.length === 0 ? (
              <div className="text-center py-6">
                <Trophy size={32} className="text-brand-500 opacity-30 mb-2 mx-auto" />
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لا بيانات مبيعات حتى الآن' : 'No sales data yet'}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {salesData.map((s, i) => (
                    <div key={i} className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center" style={{ background: i === 0 ? '#1B3347' : i === 1 ? '#2B4C6F' : 'rgba(74,122,171,0.15)' }}><span className={`text-xs font-bold ${i < 2 ? 'text-white' : 'text-brand-500'}`}>{i + 1}</span></div>
                      <div className="flex-1 min-w-0">
                        <div className={`flex justify-between mb-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-xs font-semibold text-content dark:text-content-dark">{safeChild(lang === 'ar' ? s.name_ar : s.name_en)}</span>
                          <span className="text-xs text-brand-500 font-bold">{((s.revenue || 0) / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="h-1 rounded-sm bg-gray-200 dark:bg-white/[0.08]"><div className="h-full rounded-sm" style={{ width: (s.pct || 0) + '%', background: i === 0 ? '#4A7AAB' : i === 1 ? '#6B8DB5' : '#8BA8C8' }} /></div>
                      </div>
                      <span className="text-[10px] text-content-muted dark:text-content-muted-dark min-w-[26px] text-center">{s.pct || 0}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 pt-3 border-t border-edge dark:border-edge-dark">
                  <div className={`flex justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'التارجت الشهري' : 'Monthly Target'}</span><span className="text-xs font-bold text-brand-500">{targetPct}%</span></div>
                  <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.08] overflow-hidden"><div className="h-full rounded" style={{ width: targetPct + '%', background: 'linear-gradient(90deg, #2B4C6F, #4A7AAB)' }} /></div>
                  <div className={`flex justify-between mt-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{((filteredCrm.revenue || 0) / 1000).toFixed(0)}K</span><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{((salesTarget || 0) / 1000).toFixed(0)}K EGP</span></div>
                </div>
              </>
            )}
          </div>
        );

      case 'hr_overview':
        if (!sections.showHR) return null;
        return (
          <div>
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
        );

      case 'team_performance': {
        if (!sections.showSales) return null;
        const salesEmps = MOCK_EMPLOYEES.filter(e => ['sales_director','sales_manager','team_leader','sales_agent'].includes(e.role));
        const topPerformers = dashTeamPerf?.topPerformers || [];
        const teamPct = dashTeamPerf?.teamPct || 0;
        const teamColor = teamPct >= 80 ? '#10B981' : teamPct >= 50 ? '#F59E0B' : '#EF4444';
        return (
          <div>
            <CardTitle icon={Target} title={lang === 'ar' ? 'أداء الفريق — KPI' : 'Team Performance — KPI'} sub={lang === 'ar' ? 'تحقيق أهداف الشهر الحالي' : 'Current month target achievement'} />
            <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="flex-1">
                <div className={`flex items-center justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'أداء الفريق الكلي' : 'Overall Team Achievement'}</span>
                  <span className="text-sm font-extrabold" style={{ color: teamColor }}>{teamPct}%</span>
                </div>
                <div className="h-2.5 rounded bg-gray-200 dark:bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded transition-all duration-500" style={{ width: Math.min(teamPct, 100) + '%', background: 'linear-gradient(90deg, ' + teamColor + 'cc, ' + teamColor + ')' }} />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {topPerformers.map((p, i) => {
                const pColor = p.overallPct >= 80 ? '#10B981' : p.overallPct >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={p.employee.id} className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center" style={{ background: i === 0 ? '#FFD700' + '22' : i === 1 ? '#C0C0C0' + '22' : '#CD7F32' + '22', border: '2px solid ' + (i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32') }}>
                      <span className="text-xs font-bold" style={{ color: i === 0 ? '#B8860B' : i === 1 ? '#808080' : '#CD7F32' }}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`flex justify-between mb-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs font-semibold text-content dark:text-content-dark">{safeChild(lang === 'ar' ? p.employee?.full_name_ar : p.employee?.full_name_en)}</span>
                        <span className="text-xs font-bold" style={{ color: pColor }}>{p.overallPct}%</span>
                      </div>
                      <div className="h-1.5 rounded bg-gray-200 dark:bg-white/[0.08]">
                        <div className="h-full rounded transition-all duration-300" style={{ width: Math.min(p.overallPct, 100) + '%', background: pColor }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`mt-3.5 pt-3 border-t border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'المقاييس: مكالمات، فرص، صفقات، إيرادات، اجتماعات، زيارات' : 'Metrics: Calls, Opps, Deals, Revenue, Meetings, Visits'}</span>
              <Link to="/reports" className="text-[11px] font-semibold text-brand-500 no-underline hover:underline">{lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}</Link>
            </div>
          </div>
        );
      }

      case 'my_day':
        return <MyDayWidget lang={lang} isRTL={isRTL} isDark={isDark} userId={profile?.id} navigate={navigate} />;

      case 'today_tasks':
        return <TodayRecurringTasks lang={lang} isRTL={isRTL} isDark={isDark} />;

      case 'today_followups':
        return <TodayReminders lang={lang} isRTL={isRTL} isDark={isDark} userId={profile?.id} />;

      case 'quick_stats':
        return (
          <div>
            <CardTitle icon={BarChart2} title={lang === 'ar' ? 'إحصائيات سريعة' : 'Quick Stats'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: lang === 'ar' ? 'جهات الاتصال' : 'Contacts', value: crm.totalLeads, color: '#4A7AAB' },
                { label: lang === 'ar' ? 'الفرص النشطة' : 'Active Opps', value: filteredCrm.activeOpps, color: '#2B4C6F' },
                { label: lang === 'ar' ? 'الصفقات المغلقة' : 'Closed Deals', value: filteredCrm.closedDeals, color: '#6B8DB5' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isDark ? '#ffffff06' : '#f8fafc',
                  border: '1px solid ' + (isDark ? '#ffffff0a' : '#e2e8f0'),
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}>
                  <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{safeChild(item.label)}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{safeChild(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'pending_approvals':
        if (!sections.showHR) return null;
        return (
          <div>
            <CardTitle icon={ShieldAlert} title={lang === 'ar' ? 'موافقات معلقة' : 'Pending Approvals'} />
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#4A7AAB', lineHeight: 1 }}>
                {safeChild(hr.pendingLeaves)}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'ar' ? 'طلب يحتاج موافقة' : 'requests pending'}
              </p>
            </div>
          </div>
        );

      case 'leave_summary':
        if (!sections.showHR) return null;
        return (
          <div>
            <CardTitle icon={CalendarCheck} title={lang === 'ar' ? 'ملخص الإجازات' : 'Leave Summary'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: lang === 'ar' ? 'معلقة' : 'Pending', value: hr.pendingLeaves, color: '#F59E0B' },
                { label: lang === 'ar' ? 'غائب اليوم' : 'Absent Today', value: hr.absentCount, color: '#EF4444' },
                { label: lang === 'ar' ? 'معدل الحضور' : 'Attendance', value: hr.attendanceRate + '%', color: '#10B981' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isDark ? '#ffffff06' : '#f8fafc',
                  border: '1px solid ' + (isDark ? '#ffffff0a' : '#e2e8f0'),
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}>
                  <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{safeChild(item.label)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{safeChild(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'recent_comments':
        return (
          <div>
            <CardTitle icon={MessageCircle} title={lang === 'ar' ? 'آخر التعليقات' : 'Recent Comments'} />
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <MessageCircle size={32} style={{ color: '#4A7AAB', opacity: 0.3, margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'ar' ? 'لا تعليقات جديدة' : 'No new comments'}
              </p>
            </div>
          </div>
        );

      case 'announcements': {
        const annList = dashAnnouncements;
        if (annList.length === 0) return null;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#4A7AAB1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Volume2 size={16} color="#4A7AAB" />
                </div>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                    {lang === 'ar' ? 'الإعلانات' : 'Announcements'}
                  </p>
                </div>
              </div>
              <Link to="/announcements" style={{ fontSize: 12, color: '#4A7AAB', textDecoration: 'none', fontWeight: 600 }}>
                {lang === 'ar' ? 'عرض الكل' : 'View All'}
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {annList.map(ann => {
                const cat = ANN_CATEGORIES[ann.category] || ANN_CATEGORIES.general;
                const read = isAnnRead(ann.id, userId);
                const title = lang === 'ar' ? (ann.titleAr || ann.title) : ann.title;
                const body = lang === 'ar' ? (ann.bodyAr || ann.body) : ann.body;
                return (
                  <Link
                    key={ann.id}
                    to="/announcements"
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                      borderRadius: 10, textDecoration: 'none',
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                      border: `1px solid ${isDark ? '#1e3a5f30' : '#e2e8f0'}`,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      position: 'relative',
                    }}
                  >
                    {!read && (
                      <div style={{ position: 'absolute', top: 8, [isRTL ? 'left' : 'right']: 8, width: 7, height: 7, borderRadius: '50%', background: '#4A7AAB' }} />
                    )}
                    {ann.pinned && <Pin size={12} color="#4A7AAB" style={{ marginTop: 3, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeChild(title)}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: cat.color + '18', color: cat.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {safeChild(lang === 'ar' ? cat.ar : cat.en)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeChild(body)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      }

      case 'activity_heatmap': {
        const heatData = getActivityHeatmap(3);
        return (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#4A7AAB1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={16} color="#4A7AAB" />
                </div>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                    {lang === 'ar' ? 'خريطة النشاط' : 'Activity Heatmap'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {lang === 'ar' ? 'آخر 3 أشهر' : 'Last 3 months'}
                  </p>
                </div>
              </div>
              <Link to="/heatmap" style={{ fontSize: 12, color: '#4A7AAB', textDecoration: 'none', fontWeight: 600 }}>
                {lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
              </Link>
            </div>
            <HeatmapCalendar data={heatData} months={3} compact />
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Build ordered visible widgets — MUST be before any conditional return to respect Rules of Hooks
  const visibleWidgets = useMemo(() => widgetLayout.filter(w => w.visible).sort((a, b) => a.order - b.order), [widgetLayout]);

  const getGridStyle = useCallback((size) => {
    if (isMobileView) {
      return { gridColumn: 'span 1' };
    }
    const spans = { sm: 1, md: 2, lg: 2, full: 4 };
    const span = spans[size] || 2;
    return { gridColumn: 'span ' + span };
  }, [isMobileView]);

  if (dashLoading) return <DashboardSkeleton />;

  // Widgets that contain their own grid of cards (no outer Card wrapper needed)
  const noCardWidgets = ['kpi_overview', 'recent_activities', 'hr_overview'];

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
              <p className="m-0 text-xl font-bold text-white">{safeChild(s.v)}</p>
              <p className="m-0 text-xs text-white/65">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Suggestions Panel */}
      <SuggestionsPanel />

      {/* Dashboard controls: Date range + Customize button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {sections.showCRM ? (
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
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
        ) : <div />}

        <button
          onClick={() => setShowCustomize(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 10,
            border: '1px solid ' + (isDark ? '#ffffff15' : '#e2e8f0'),
            background: isDark ? '#1a2332' : '#ffffff',
            color: '#4A7AAB',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          <Settings size={14} />
          {lang === 'ar' ? 'تخصيص' : 'Customize'}
        </button>
      </div>

      {/* Q Goals summary */}
      {(() => {
        const currentMonth = new Date().getMonth();
        const cq = currentMonth < 3 ? 'Q1' : currentMonth < 6 ? 'Q2' : currentMonth < 9 ? 'Q3' : 'Q4';
        const cy = new Date().getFullYear();
        const gs = dashQuarterSummary;
        if (gs.total === 0) return null;
        const pColor = gs.avgProgress >= 70 ? '#10B981' : gs.avgProgress >= 40 ? '#F59E0B' : '#EF4444';
        return (
          <div
            onClick={() => navigate('/hr/goals')}
            style={{
              marginBottom: 16, padding: '14px 20px', borderRadius: 14, cursor: 'pointer',
              background: isDark ? '#1a2332' : '#ffffff',
              border: '1px solid ' + (isDark ? '#ffffff12' : '#e2e8f0'),
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexDirection: isRTL ? 'row-reverse' : 'row', gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={18} color="#4A7AAB" />
              </div>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {lang === 'ar' ? `أهداف ${cq}` : `${cq} Goals`}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                  {safeChild(gs.total)} {lang === 'ar' ? 'هدف' : 'objectives'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ width: 120 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>{lang === 'ar' ? 'التقدم' : 'Progress'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pColor }}>{safeChild(gs.avgProgress)}%</span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 3, background: isDark ? 'rgba(74,122,171,0.12)' : '#f1f5f9' }}>
                  <div style={{ width: `${Math.min(gs.avgProgress, 100)}%`, height: '100%', borderRadius: 3, background: pColor, transition: 'width 0.4s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981' }}>{safeChild(gs.onTrack)} {lang === 'ar' ? 'على المسار' : 'on track'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B' }}>{safeChild(gs.atRisk)} {lang === 'ar' ? 'في خطر' : 'at risk'}</span>
                {gs.behind > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#EF4444' }}>{safeChild(gs.behind)} {lang === 'ar' ? 'متأخر' : 'behind'}</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Widget grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobileView ? '1fr' : 'repeat(4, 1fr)',
        gap: isMobileView ? 12 : 16,
      }}>
        {visibleWidgets.map((item) => {
          const meta = getWidgetMeta(item.widgetId);
          if (!meta) return null;
          let content;
          try { content = renderWidget(item.widgetId); } catch (err) { content = <div className="p-4 text-xs text-red-500">Widget error ({item.widgetId}): {String(err?.message || err)}</div>; }
          if (content === null) return null;
          const title = lang === 'ar' ? meta.title_ar : meta.title_en;
          const isCollapsed = !!collapsedWidgets[item.widgetId];
          const needsCard = !noCardWidgets.includes(item.widgetId);

          return (
            <div key={item.widgetId} style={getGridStyle(item.size)}>
              <ErrorBoundary compact fallback={({ error }) => <Card className="p-4"><p className="text-xs text-red-500 m-0">⚠ {item.widgetId}: {error?.message?.slice(0, 120)}</p></Card>}>
              {needsCard ? (
                <WidgetCard
                  title={title}
                  isDark={isDark}
                  isRTL={isRTL}
                  lang={lang}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => toggleCollapse(item.widgetId)}
                >
                  {content}
                </WidgetCard>
              ) : (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: isCollapsed ? 0 : 8,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isDark ? '#e2e8f0' : '#1e293b',
                    }}>{safeChild(title)}</span>
                    <button
                      onClick={() => toggleCollapse(item.widgetId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        color: isDark ? '#94a3b8' : '#64748b',
                      }}
                    >
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                  {!isCollapsed && content}
                </div>
              )}
              </ErrorBoundary>
            </div>
          );
        })}
      </div>

      {/* Customize panel modal */}
      {showCustomize && (
        <CustomizePanel
          layout={widgetLayout}
          onUpdate={handleUpdateLayout}
          onReset={handleResetLayout}
          onClose={() => setShowCustomize(false)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
        />
      )}
    </div>
  );
}
