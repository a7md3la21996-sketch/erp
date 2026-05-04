import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../lib/supabase';
import { fetchEmployees } from '../../services/employeesService';
import {
  Users, Briefcase, CalendarOff, Receipt, AlertTriangle, PartyPopper,
  Cake, Plus, DollarSign, FileText, BarChart3, Clock,
  ChevronRight, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';

export default function HRHomePage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [employees, setEmployees] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStr = String(today.getMonth() + 1).padStart(2, '0');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchEmployees({ includeDeleted: true }),
      supabase.from('leave_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      supabase.from('expense_claims').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      supabase.from('holidays').select('*').gte('date', todayStr).order('date', { ascending: true }).limit(5),
    ]).then(([emps, leaves, claims, hols]) => {
      if (cancelled) return;
      setEmployees(emps || []);
      setPendingLeaves(leaves.data || []);
      setPendingClaims(claims.data || []);
      setHolidays(hols.data || []);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [todayStr]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.is_active !== false && !e.deleted_at);
    const probation = active.filter(e => e.employment_type === 'probation').length;
    const tenuredYears = active
      .filter(e => e.hire_date)
      .map(e => (Date.now() - new Date(e.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const avgTenure = tenuredYears.length ? (tenuredYears.reduce((a, b) => a + b, 0) / tenuredYears.length).toFixed(1) : 0;

    // Contracts expiring in next 30 days
    const thirty = new Date();
    thirty.setDate(thirty.getDate() + 30);
    const expiringContracts = active.filter(e => {
      if (!e.contract_end) return false;
      const end = new Date(e.contract_end);
      return end >= today && end <= thirty;
    });

    // Birthdays this month (approx — uses date_of_birth if present)
    const birthdaysThisMonth = active.filter(e => {
      if (!e.date_of_birth) return false;
      return e.date_of_birth.slice(5, 7) === monthStr;
    });

    return { activeCount: active.length, probation, avgTenure, expiringContracts, birthdaysThisMonth };
  }, [employees, monthStr]);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={3} />
    </div>
  );

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'نهارك سعيد' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Greeting */}
      <div className={`mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        <h1 className="m-0 text-2xl md:text-3xl font-bold text-content dark:text-content-dark">
          {greeting}{profile?.full_name_ar ? `، ${isRTL ? profile.full_name_ar : (profile.full_name_en || profile.full_name_ar)}` : ''}
        </h1>
        <p className="m-0 mt-1 text-sm text-content-muted dark:text-content-muted-dark">
          {isRTL ? `اليوم ${todayStr} · إدارة الموارد البشرية` : `Today ${todayStr} · HR Operations`}
        </p>
      </div>

      {/* Workforce KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <KpiCard icon={Users} label={isRTL ? 'الموظفين النشطين' : 'Active Headcount'} value={stats.activeCount} color="#1B3347" />
        <KpiCard icon={Clock} label={isRTL ? 'في فترة التجربة' : 'On Probation'} value={stats.probation} color="#F59E0B" />
        <KpiCard icon={TrendingUp} label={isRTL ? 'متوسط مدة العمل' : 'Avg Tenure'} value={`${stats.avgTenure} ${isRTL ? 'سنة' : 'yrs'}`} color="#4A7AAB" />
        <KpiCard icon={AlertTriangle} label={isRTL ? 'عقود تنتهي قريباً' : 'Expiring Soon'} value={stats.expiringContracts.length} color="#EF4444" />
      </div>

      {/* Two-column layout: Pending Actions + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Pending Actions (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <AlertTriangle size={16} className="text-brand-500" />
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {isRTL ? 'بانتظار إجراء' : 'Pending Actions'}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-500">
                {pendingLeaves.length + pendingClaims.length} {isRTL ? 'معلق' : 'open'}
              </span>
            </div>
            <div className="px-5 py-3">
              <ActionRow
                icon={CalendarOff}
                color="#4A7AAB"
                count={pendingLeaves.length}
                label={isRTL ? 'طلبات إجازة للموافقة' : 'Leave requests pending'}
                to="/hr/leave"
                isRTL={isRTL}
              />
              <ActionRow
                icon={Receipt}
                color="#10B981"
                count={pendingClaims.length}
                label={isRTL ? 'طلبات مصروفات للموافقة' : 'Expense claims pending'}
                to="/hr/expense-claims"
                isRTL={isRTL}
              />
              <ActionRow
                icon={DollarSign}
                color="#F59E0B"
                count={null}
                label={isRTL ? 'تشغيل المرتبات للشهر الحالي' : 'Run payroll for this month'}
                to="/hr/payroll/run"
                isRTL={isRTL}
              />
              <ActionRow
                icon={Briefcase}
                color="#EF4444"
                count={stats.expiringContracts.length}
                label={isRTL ? 'عقود تنتهي خلال 30 يوم' : 'Contracts expiring in 30 days'}
                to="/hr/contracts"
                isRTL={isRTL}
                lastRow
              />
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Plus size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4">
              <QuickAction icon={Users} label_ar="موظف جديد" label_en="Add Employee" isRTL={isRTL} onClick={() => navigate('/hr/employees')} />
              <QuickAction icon={DollarSign} label_ar="تشغيل المرتبات" label_en="Run Payroll" isRTL={isRTL} onClick={() => navigate('/hr/payroll/run')} />
              <QuickAction icon={CalendarOff} label_ar="إجازات" label_en="Approve Leaves" isRTL={isRTL} onClick={() => navigate('/hr/leave')} />
              <QuickAction icon={BarChart3} label_ar="تقارير" label_en="Reports" isRTL={isRTL} onClick={() => navigate('/hr/reports')} />
              <QuickAction icon={Briefcase} label_ar="العقود" label_en="Contracts" isRTL={isRTL} onClick={() => navigate('/hr/contracts')} />
              <QuickAction icon={FileText} label_ar="المستندات" label_en="Documents" isRTL={isRTL} onClick={() => navigate('/hr/documents')} />
              <QuickAction icon={Clock} label_ar="الحضور" label_en="Attendance" isRTL={isRTL} onClick={() => navigate('/hr/attendance')} />
              <QuickAction icon={Briefcase} label_ar="التوظيف" label_en="Recruitment" isRTL={isRTL} onClick={() => navigate('/hr/recruitment')} />
            </div>
          </Card>
        </div>

        {/* Upcoming */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <PartyPopper size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'القادم' : 'Upcoming'}</p>
            </div>
            <div className="px-5 py-3">
              {holidays.length === 0 ? (
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-3">{isRTL ? 'لا توجد إجازات قادمة' : 'No upcoming holidays'}</p>
              ) : holidays.map(h => (
                <UpcomingItem
                  key={h.id}
                  icon={PartyPopper}
                  label={isRTL ? (h.name_ar || h.name) : (h.name || h.name_ar)}
                  date={h.date}
                  isRTL={isRTL}
                />
              ))}
              {stats.birthdaysThisMonth.slice(0, 3).map(emp => (
                <UpcomingItem
                  key={emp.id}
                  icon={Cake}
                  label={isRTL ? (emp.full_name_ar || emp.full_name_en) : (emp.full_name_en || emp.full_name_ar)}
                  date={`${emp.date_of_birth?.slice(5)} (${isRTL ? 'عيد ميلاد' : 'birthday'})`}
                  isRTL={isRTL}
                />
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Briefcase size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'عقود قريبة الانتهاء' : 'Expiring Contracts'}</p>
            </div>
            <div className="px-5 py-3">
              {stats.expiringContracts.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle2 size={20} className="text-green-500 mx-auto mb-2" />
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا يوجد عقود قريبة الانتهاء' : 'No contracts expiring soon'}</p>
                </div>
              ) : stats.expiringContracts.slice(0, 5).map(emp => (
                <Link
                  key={emp.id}
                  to={`/hr/employee/${emp.id}`}
                  className={`flex items-center justify-between py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 hover:bg-brand-500/5 -mx-2 px-2 rounded transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark truncate">
                      {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}
                    </p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{emp.contract_end}</p>
                  </div>
                  <ChevronRight size={13} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, color, count, label, to, isRTL, lastRow }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between py-2.5 ${lastRow ? '' : 'border-b border-edge/50 dark:border-edge-dark/50'} hover:bg-brand-500/5 -mx-2 px-2 rounded transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-content dark:text-content-dark">{label}</span>
      </div>
      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {count !== null && count !== undefined && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold" style={{ background: `${color}20`, color }}>
            {count}
          </span>
        )}
        <ChevronRight size={13} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
      </div>
    </Link>
  );
}

function QuickAction({ icon: Icon, label_ar, label_en, isRTL, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark hover:border-brand-500/40 hover:bg-brand-500/5 cursor-pointer transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center">
        <Icon size={16} className="text-brand-500" />
      </div>
      <span className="text-[11px] font-semibold text-content dark:text-content-dark text-center">
        {isRTL ? label_ar : label_en}
      </span>
    </button>
  );
}

function UpcomingItem({ icon: Icon, label, date, isRTL }) {
  return (
    <div className={`flex items-center gap-3 py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-brand-500" />
      </div>
      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark truncate">{label}</p>
        <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{date}</p>
      </div>
    </div>
  );
}
