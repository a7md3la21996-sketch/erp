import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS, ROLES } from '../../config/roles';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';
import {
  Users, TrendingUp, DollarSign, Clock, AlertTriangle,
  Award, Target, UserCheck, UserX, Calendar, Briefcase,
  ChevronRight, ArrowUpRight, Star, Bell,
  Building2, BarChart2, FileText, CreditCard,
  Link as LinkIcon, Settings, Activity
} from 'lucide-react';

const YEAR = 2026;
const MONTH = 3;

const MOCK_CRM = {
  totalLeads: 142, newLeadsThisMonth: 38, activeOpps: 24,
  closedDeals: 11, revenue: 1250000, conversionRate: 7.7,
};
const MOCK_SALES = {
  target: 1500000, achieved: 1250000,
  topSales: [
    { name_ar: 'أحمد محمود', name_en: 'Ahmed Mahmoud', deals: 3, revenue: 310000 },
    { name_ar: 'سارة خالد',  name_en: 'Sara Khaled',   deals: 3, revenue: 285000 },
    { name_ar: 'محمد علي',   name_en: 'Mohamed Ali',   deals: 2, revenue: 195000 },
  ],
};
const MOCK_FINANCE = { totalExpenses: 320000, pendingInvoices: 5, budget: 500000 };

function buildHRStats(attendance) {
  const presentDays = attendance.filter(r => r.status === 'present' || r.status === 'late');
  const lateDays    = attendance.filter(r => r.status === 'late');
  const absentDays  = attendance.filter(r => r.status === 'absent');
  const uniqueEmps  = [...new Set(attendance.map(r => r.employee_id))].length;
  const attendanceRate = uniqueEmps > 0
    ? Math.round((presentDays.length / (uniqueEmps * 22)) * 100)
    : 0;

  const today = new Date(2026, 2, 7);
  const alerts = MOCK_EMPLOYEES.filter(emp => {
    if (!emp.contract_end) return false;
    const end = new Date(emp.contract_end);
    const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  });

  const probation = MOCK_EMPLOYEES.filter(emp => emp.employment_type === 'probation');
  const deptCounts = DEPARTMENTS.map(d => ({
    ...d,
    count: MOCK_EMPLOYEES.filter(e => e.department === d.id).length,
  })).filter(d => d.count > 0);

  return {
    total: MOCK_EMPLOYEES.length,
    attendanceRate,
    lateCount: [...new Set(lateDays.map(r => r.employee_id))].length,
    absentCount: [...new Set(absentDays.map(r => r.employee_id))].length,
    contractAlerts: alerts.length,
    probationCount: probation.length,
    deptCounts,
    openPositions: 3,
    pendingLeaves: 4,
  };
}

function getSections(role) {
  const isAdmin   = role === 'admin';
  const isSales   = ['sales_director','sales_manager','team_leader','sales_agent'].includes(role);
  const isHR      = role === 'hr';
  const isFinance = role === 'finance';
  const isMkt     = role === 'marketing';
  return {
    showHR:      isAdmin || isHR,
    showSales:   isAdmin || isSales,
    showFinance: isAdmin || isFinance,
    showCRM:     isAdmin || isSales || isMkt,
    showAlerts:  isAdmin || isHR,
  };
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { profile }  = useAuth();
  const { theme }    = useTheme();
  const isDark = theme === 'dark';
  const isRTL  = i18n.language === 'ar';
  const lang   = i18n.language;

  const role      = profile?.role || 'sales_agent';
  const name      = isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar);
  const roleLabel = ROLE_LABELS[role]?.[lang] || '';
  const sections  = getSections(role);

  const attendance = getAttendanceForMonth(YEAR, MONTH);
  const hr = useMemo(() => buildHRStats(attendance), [attendance]);

  const c = {
    bg:        isDark ? '#152232' : '#F8FAFC',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
  };

  const today = new Date(2026, 2, 7);
  const dateStr = today.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const hour = 9;
  const greeting = lang === 'ar'
    ? (hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور')
    : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

  const KpiBar = ({ label, value, target, color, unit = '' }) => {
    const pct = Math.min(Math.round((value / target) * 100), 100);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: 12, color: c.textMuted }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{value.toLocaleString()}{unit} <span style={{ fontWeight: 400, color: c.textMuted }}>/ {target.toLocaleString()}{unit}</span></span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
          <div style={{ height: '100%', borderRadius: 3, width: pct + '%', background: color, transition: 'width 0.6s ease' }} />
        </div>
      </div>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color, sub }) => (
    <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
          <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  );

  const SectionHeader = ({ icon: Icon, title, sub, iconColor }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: (iconColor || c.primary) + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color={iconColor || c.primary} />
      </div>
      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: c.textMuted }}>{sub}</div>}
      </div>
    </div>
  );

  const QUICK_LINKS = [
    { label: { ar: 'الموظفين',     en: 'Employees' },    path: '/hr/employees',     show: sections.showHR,      Icon: Users },
    { label: { ar: 'الحضور',       en: 'Attendance' },   path: '/hr/attendance',    show: sections.showHR,      Icon: Clock },
    { label: { ar: 'الرواتب',      en: 'Payroll' },      path: '/hr/payroll',       show: sections.showHR,      Icon: CreditCard },
    { label: { ar: 'التوظيف',      en: 'Recruitment' },  path: '/hr/recruitment',   show: sections.showHR,      Icon: UserCheck },
    { label: { ar: 'الفرص',        en: 'Opportunities'}, path: '/crm/opportunities',show: sections.showCRM,     Icon: TrendingUp },
    { label: { ar: 'الأداء',       en: 'Performance' },  path: '/performance',      show: true,                 Icon: BarChart2 },
    { label: { ar: 'بوابة الموظف', en: 'Self-Service' }, path: '/hr/self-service',  show: true,                 Icon: Settings },
  ];

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Welcome Header */}
      <div style={{ background: 'linear-gradient(135deg, #1B3347 0%, #2B4C6F 50%, #4A7AAB 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: isRTL ? 'auto' : -20, left: isRTL ? -20 : 'auto', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: isRTL ? 'auto' : 40, left: isRTL ? 40 : 'auto', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {greeting}، {name}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            {roleLabel} · {dateStr}
          </div>
        </div>
      </div>

      {/* HR Section */}
      {sections.showHR && (
        <div style={{ background: c.cardBg, borderRadius: 14, border: '1px solid ' + c.border, padding: 20, marginBottom: 20 }}>
          <SectionHeader icon={Users} title={lang === 'ar' ? 'الموارد البشرية' : 'Human Resources'} sub={lang === 'ar' ? 'مارس 2026' : 'March 2026'} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard icon={Users}     label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={hr.total}                color={c.accent} />
            <StatCard icon={UserCheck} label={lang === 'ar' ? 'معدل الحضور'     : 'Attendance Rate'} value={hr.attendanceRate + '%'} color="#4A7AAB" />
            <StatCard icon={Calendar}  label={lang === 'ar' ? 'إجازات معلقة'    : 'Pending Leaves'}  value={hr.pendingLeaves}        color="#6B8DB5" />
            <StatCard icon={Briefcase} label={lang === 'ar' ? 'وظائف مفتوحة'    : 'Open Positions'}  value={hr.openPositions}        color="#4A7AAB" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Departments */}
            <div style={{ padding: '14px 16px', borderRadius: 10, background: c.thBg, border: '1px solid ' + c.border }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'توزيع الأقسام' : 'Departments'}
              </div>
              {hr.deptCounts.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? d.name_ar : d.name_en}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: Math.round((d.count / hr.total) * 100) + '%', background: c.accent }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.text, minWidth: 20 }}>{d.count}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            <div style={{ padding: '14px 16px', borderRadius: 10, background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.05)', border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <AlertTriangle size={14} color="#EF4444" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444' }}>{lang === 'ar' ? 'تنبيهات' : 'Alerts'}</span>
              </div>
              {[
                { Icon: FileText, label: lang === 'ar' ? `${hr.contractAlerts} عقد ينتهي قريباً` : `${hr.contractAlerts} contracts expiring soon`, show: hr.contractAlerts > 0 },
                { Icon: Clock,    label: lang === 'ar' ? `${hr.probationCount} موظف في فترة تجربة` : `${hr.probationCount} on probation`, show: hr.probationCount > 0 },
                { Icon: UserX,    label: lang === 'ar' ? `${hr.absentCount} غائب اليوم` : `${hr.absentCount} absent today`, show: hr.absentCount > 0 },
                { Icon: Clock,    label: lang === 'ar' ? `${hr.lateCount} متأخر اليوم` : `${hr.lateCount} late today`, show: hr.lateCount > 0 },
              ].filter(a => a.show).map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, color: '#EF4444', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <a.Icon size={12} color="#EF4444" />
                  <span>{a.label}</span>
                </div>
              ))}
              {hr.contractAlerts === 0 && hr.absentCount === 0 && (
                <div style={{ fontSize: 12, color: '#4A7AAB', textAlign: 'center', padding: '8px 0' }}>
                  {lang === 'ar' ? 'لا تنبيهات' : 'No alerts'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CRM + Sales Section */}
      {sections.showCRM && (
        <div style={{ background: c.cardBg, borderRadius: 14, border: '1px solid ' + c.border, padding: 20, marginBottom: 20 }}>
          <SectionHeader icon={TrendingUp} title={lang === 'ar' ? 'المبيعات والعملاء' : 'Sales & CRM'} sub={lang === 'ar' ? 'مارس 2026' : 'March 2026'} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard icon={Users}      label={lang === 'ar' ? 'إجمالي الليدز' : 'Total Leads'}   value={MOCK_CRM.totalLeads}                                   color={c.accent} />
            <StatCard icon={Activity}   label={lang === 'ar' ? 'فرص نشطة'      : 'Active Opps'}   value={MOCK_CRM.activeOpps}                                   color="#4A7AAB" />
            <StatCard icon={Award}      label={lang === 'ar' ? 'صفقات مغلقة'   : 'Deals Closed'}  value={MOCK_CRM.closedDeals}                                  color="#4A7AAB" />
            <StatCard icon={DollarSign} label={lang === 'ar' ? 'الإيرادات'      : 'Revenue'}       value={(MOCK_CRM.revenue / 1000).toFixed(0) + 'K'}            color="#6B8DB5" />
          </div>

          {sections.showSales && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Target */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: c.thBg, border: '1px solid ' + c.border }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
                  {lang === 'ar' ? 'التارجت الشهري' : 'Monthly Target'}
                </div>
                <KpiBar
                  label={lang === 'ar' ? 'الإيرادات' : 'Revenue'}
                  value={MOCK_SALES.achieved} target={MOCK_SALES.target}
                  color="#4A7AAB" unit="EGP"
                />
                <div style={{ fontSize: 12, color: c.textMuted, textAlign: isRTL ? 'right' : 'left' }}>
                  {Math.round((MOCK_SALES.achieved / MOCK_SALES.target) * 100)}% {lang === 'ar' ? 'من التارجت' : 'of target'}
                </div>
              </div>

              {/* Top performers */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: c.thBg, border: '1px solid ' + c.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <Star size={14} color={c.accent} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? 'أفضل البائعين' : 'Top Performers'}</span>
                </div>
                {MOCK_SALES.topSales.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ['#4A7AAB','#6B8DB5','#8BA8C8'][i], minWidth: 18 }}>#{i + 1}</span>
                      <span style={{ fontSize: 12, color: c.text }}>{lang === 'ar' ? s.name_ar : s.name_en}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4A7AAB' }}>{(s.revenue / 1000).toFixed(0)}K</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Finance Section */}
      {sections.showFinance && (
        <div style={{ background: c.cardBg, borderRadius: 14, border: '1px solid ' + c.border, padding: 20, marginBottom: 20 }}>
          <SectionHeader icon={DollarSign} title={lang === 'ar' ? 'المالية' : 'Finance'} sub={lang === 'ar' ? 'مارس 2026' : 'March 2026'} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard icon={TrendingUp}  label={lang === 'ar' ? 'المصروفات'          : 'Expenses'}          value={(MOCK_FINANCE.totalExpenses / 1000).toFixed(0) + 'K'} color="#EF4444" />
            <StatCard icon={Bell}        label={lang === 'ar' ? 'فواتير معلقة'       : 'Pending Invoices'}   value={MOCK_FINANCE.pendingInvoices}                          color="#6B8DB5" />
            <StatCard icon={DollarSign}  label={lang === 'ar' ? 'الميزانية المتبقية'  : 'Budget Remaining'}   value={((MOCK_FINANCE.budget - MOCK_FINANCE.totalExpenses) / 1000).toFixed(0) + 'K'} color="#4A7AAB" />
          </div>
          <KpiBar
            label={lang === 'ar' ? 'استهلاك الميزانية' : 'Budget Usage'}
            value={MOCK_FINANCE.totalExpenses} target={MOCK_FINANCE.budget}
            color="#6B8DB5" unit="EGP"
          />
        </div>
      )}

      {/* Quick Links */}
      <div style={{ background: c.cardBg, borderRadius: 14, border: '1px solid ' + c.border, padding: 20 }}>
        <SectionHeader icon={LinkIcon} title={lang === 'ar' ? 'روابط سريعة' : 'Quick Links'} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {QUICK_LINKS.filter(l => l.show).map((l, i) => (
            <a key={i} href={l.path} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: '1px solid ' + c.border, background: c.thBg,
              textDecoration: 'none', color: c.text, fontSize: 13, fontWeight: 500,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.text; }}
            >
              <l.Icon size={14} />
              <span>{l.label[lang]}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
