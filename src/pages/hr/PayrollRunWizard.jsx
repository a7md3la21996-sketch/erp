import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import supabase from '../../lib/supabase';
import { fetchEmployees } from '../../services/employeesService';
import { fetchPayrollRun, lockPayrollRun, unlockPayrollRun } from '../../services/payrollService';
import { fetchAttendance } from '../../services/attendanceService';
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Users, DollarSign,
  TrendingUp, TrendingDown, ChevronRight, ChevronLeft, ArrowRight, ArrowLeft,
  Calendar, FileText, Lock, AlertCircle, Briefcase, CreditCard, Plus, Minus,
} from 'lucide-react';
import { Card, Button, KpiCard, PageSkeleton, Select, Modal, ModalFooter } from '../../components/ui';

/* ─────────────────────────────────────────────────────────────────────────
   Payroll Run Wizard — 4-step guided flow.
   Step 1: Pre-flight checks (data ready?)
   Step 2: Review changes since last run
   Step 3: Run payroll (delegates to existing /hr/payroll for actual compute)
   Step 4: Confirm & audit
───────────────────────────────────────────────────────────────────────── */

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayrollRunWizard() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  // Role gate — same as PayrollPage
  if (profile && !['admin', 'operations', 'finance', 'hr'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg font-bold text-content dark:text-content-dark">
          {isRTL ? 'غير مصرح' : 'Unauthorized'}
        </p>
      </div>
    );
  }

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [step, setStep] = useState(1);

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [previousRun, setPreviousRun] = useState(null);
  const [currentRun, setCurrentRun] = useState(null);
  const [recentSalaryChanges, setRecentSalaryChanges] = useState([]);
  const [newLoans, setNewLoans] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reload everything when month changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    Promise.all([
      fetchEmployees(),
      fetchAttendance({ month, year }),
      fetchPayrollRun(prevMonth, prevYear),
      fetchPayrollRun(month, year),
      supabase.from('salary_history').select('*, employees(full_name_ar, full_name_en, employee_id)')
        .gte('effective_date', monthStart).lte('effective_date', monthEnd),
      supabase.from('employee_loans').select('*, employees(full_name_ar, full_name_en, employee_id)')
        .gte('created_at', monthStart).eq('status', 'active'),
      supabase.from('payroll_adjustments').select('*, employees(full_name_ar, full_name_en, employee_id)')
        .eq('month', month).eq('year', year),
      supabase.from('holidays').select('date').gte('date', monthStart).lte('date', monthEnd),
    ]).then(([emps, att, prevRun, currRun, salRes, loansRes, adjRes, holRes]) => {
      if (cancelled) return;
      setEmployees(emps || []);
      setAttendance(att || []);
      setPreviousRun(prevRun);
      setCurrentRun(currRun);
      setRecentSalaryChanges(salRes.data || []);
      setNewLoans(loansRes.data || []);
      setAdjustments(adjRes.data || []);
      setHolidays(holRes.data || []);
    }).finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [month, year]);

  // ─── Pre-flight check results ───
  const preflight = useMemo(() => {
    const checks = [];
    const active = employees.filter(e => e.is_active !== false && !e.deleted_at);

    // Check 1: Active employees count
    checks.push({
      key: 'employees',
      severity: active.length > 0 ? 'ok' : 'error',
      label_ar: `عدد الموظفين النشطين: ${active.length}`,
      label_en: `Active employees: ${active.length}`,
      detail_ar: active.length === 0 ? 'لا يوجد موظفين لتشغيل المرتبات' : '',
      detail_en: active.length === 0 ? 'No active employees to run payroll for' : '',
    });

    // Check 2: Attendance coverage
    const expectedDays = new Date(year, month, 0).getDate();
    const empsWithoutAttendance = active.filter(e => !attendance.find(a => a.employee_id === e.id));
    const attendanceRatio = active.length > 0 ? (active.length - empsWithoutAttendance.length) / active.length : 0;
    checks.push({
      key: 'attendance',
      severity: empsWithoutAttendance.length === 0 ? 'ok' : empsWithoutAttendance.length > active.length / 4 ? 'error' : 'warn',
      label_ar: `تغطية الحضور: ${Math.round(attendanceRatio * 100)}%`,
      label_en: `Attendance coverage: ${Math.round(attendanceRatio * 100)}%`,
      detail_ar: empsWithoutAttendance.length > 0 ? `${empsWithoutAttendance.length} موظف بدون حضور هذا الشهر` : '',
      detail_en: empsWithoutAttendance.length > 0 ? `${empsWithoutAttendance.length} employees with no attendance recorded` : '',
      affectedEmployees: empsWithoutAttendance,
    });

    // Check 3: Already run?
    checks.push({
      key: 'duplicate',
      severity: currentRun ? 'warn' : 'ok',
      label_ar: currentRun ? 'تم تشغيل المرتبات لهذا الشهر مسبقاً' : 'لم يتم التشغيل بعد',
      label_en: currentRun ? 'Payroll already run for this month' : 'Not yet run for this month',
      detail_ar: currentRun ? `تم في ${currentRun.run_date?.slice(0, 10)} — تشغيله مرة أخرى سيستبدل البيانات` : '',
      detail_en: currentRun ? `Run on ${currentRun.run_date?.slice(0, 10)} — running again will replace data` : '',
    });

    // Check 4: Holidays configured
    checks.push({
      key: 'holidays',
      severity: holidays.length > 0 ? 'ok' : 'warn',
      label_ar: `الإجازات الرسمية: ${holidays.length} يوم`,
      label_en: `Official holidays: ${holidays.length} days`,
      detail_ar: holidays.length === 0 ? 'لم يتم إضافة إجازات لهذا الشهر — راجع صفحة الإجازات' : '',
      detail_en: holidays.length === 0 ? 'No holidays defined for this month — check Holidays page' : '',
    });

    // Check 5: Probation employees
    const probation = active.filter(e => e.employment_type === 'probation');
    checks.push({
      key: 'probation',
      severity: probation.length === 0 ? 'ok' : 'info',
      label_ar: `موظفين تحت التجربة: ${probation.length}`,
      label_en: `Employees on probation: ${probation.length}`,
      detail_ar: probation.length > 0 ? 'سيتم تشغيل مرتباتهم بشكل طبيعي' : '',
      detail_en: probation.length > 0 ? 'Their salaries will be processed normally' : '',
    });

    return checks;
  }, [employees, attendance, currentRun, holidays, month, year]);

  const hasErrors = preflight.some(c => c.severity === 'error');
  const hasWarnings = preflight.some(c => c.severity === 'warn');

  // ─── Changes summary for step 2 ───
  const changesSummary = useMemo(() => {
    const totalAdjAmount = adjustments.reduce((s, a) => {
      const sign = (a.type === 'penalty' || a.type === 'deduction') ? -1 : 1;
      return s + sign * (Number(a.amount) || 0);
    }, 0);
    const totalLoanDeduction = newLoans.reduce((s, l) => s + (Number(l.monthly_deduction) || 0), 0);
    return {
      salaryChanges: recentSalaryChanges.length,
      newLoans: newLoans.length,
      totalLoanDeduction,
      adjustments: adjustments.length,
      bonuses: adjustments.filter(a => a.type === 'addition' || a.type === 'bonus' || a.type === 'commission').length,
      penalties: adjustments.filter(a => a.type === 'penalty' || a.type === 'deduction').length,
      totalAdjAmount,
    };
  }, [recentSalaryChanges, newLoans, adjustments]);

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={4} /></div>;

  const monthName = lang === 'ar' ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <DollarSign size={22} className="text-brand-500" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'تشغيل المرتبات' : 'Run Payroll'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {monthName} {year}
            </p>
          </div>
        </div>
        <Select value={month} onChange={e => { setMonth(+e.target.value); setStep(1); }}>
          {(lang === 'ar' ? MONTHS_AR : MONTHS_EN).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </Select>
      </div>

      {/* Stepper */}
      <Stepper step={step} isRTL={isRTL} lang={lang} />

      {/* Step content */}
      <div className="mt-6">
        {step === 1 && (
          <Step1Preflight
            preflight={preflight}
            hasErrors={hasErrors}
            hasWarnings={hasWarnings}
            employees={employees}
            isRTL={isRTL}
            lang={lang}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Review
            previousRun={previousRun}
            recentSalaryChanges={recentSalaryChanges}
            newLoans={newLoans}
            adjustments={adjustments}
            summary={changesSummary}
            isRTL={isRTL}
            lang={lang}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Run
            month={month}
            year={year}
            currentRun={currentRun}
            isRTL={isRTL}
            lang={lang}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4Confirm
            month={month}
            year={year}
            currentRun={currentRun}
            profile={profile}
            isRTL={isRTL}
            lang={lang}
            onBack={() => setStep(3)}
            onDone={() => navigate('/hr')}
            onLockChange={async (locked) => {
              if (!currentRun?.id) return;
              try {
                const updated = locked
                  ? await lockPayrollRun(currentRun.id, profile?.id)
                  : await unlockPayrollRun(currentRun.id);
                setCurrentRun(updated);
                toast.success(
                  isRTL
                    ? (locked ? 'تم قفل المسير' : 'تم فتح المسير')
                    : (locked ? 'Payroll locked' : 'Payroll unlocked')
                );
              } catch (err) {
                toast.error(isRTL ? 'فشلت العملية' : 'Action failed');
                if (import.meta.env.DEV) console.error(err);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Stepper ─── */
function Stepper({ step, isRTL, lang }) {
  const steps = [
    { num: 1, label_ar: 'فحص أولي', label_en: 'Pre-flight' },
    { num: 2, label_ar: 'مراجعة التغييرات', label_en: 'Review' },
    { num: 3, label_ar: 'تشغيل', label_en: 'Run' },
    { num: 4, label_ar: 'تأكيد', label_en: 'Confirm' },
  ];
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  return (
    <div className={`flex items-center gap-1 md:gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {steps.map((s, i) => {
        const active = step === s.num;
        const done = step > s.num;
        return (
          <div key={s.num} className={`flex items-center gap-1 md:gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-brand-500 text-white scale-110' :
                  'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : s.num}
              </div>
              <span className={`hidden md:inline text-xs font-semibold ${active ? 'text-brand-500' : done ? 'text-green-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                {isRTL ? s.label_ar : s.label_en}
              </span>
            </div>
            {i < steps.length - 1 && (
              <Arrow size={14} className={`text-content-muted dark:text-content-muted-dark ${done ? 'text-green-500' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Step 1: Pre-flight Checks ─── */
function Step1Preflight({ preflight, hasErrors, hasWarnings, employees, isRTL, lang, onNext }) {
  const sevConfig = {
    ok: { color: '#10B981', icon: CheckCircle2 },
    warn: { color: '#F59E0B', icon: AlertTriangle },
    error: { color: '#EF4444', icon: XCircle },
    info: { color: '#4A7AAB', icon: AlertCircle },
  };

  return (
    <div>
      <Card className="mb-4">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CheckCircle2 size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'فحص ما قبل التشغيل' : 'Pre-flight Checks'}</p>
          </div>
          {hasErrors ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 border border-red-500/30">
              <XCircle size={11} /> {isRTL ? 'يجب الإصلاح' : 'Must fix'}
            </span>
          ) : hasWarnings ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-500/15 text-yellow-600 border border-yellow-500/30">
              <AlertTriangle size={11} /> {isRTL ? 'تحذيرات' : 'Warnings'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-600 border border-green-500/30">
              <CheckCircle2 size={11} /> {isRTL ? 'جاهز' : 'Ready'}
            </span>
          )}
        </div>
        <div className="px-5 py-3">
          {preflight.map(c => {
            const cfg = sevConfig[c.severity];
            const Icon = cfg.icon;
            return (
              <div key={c.key} className={`flex items-start gap-3 py-3 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${cfg.color}18` }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? c.label_ar : c.label_en}</p>
                  {(isRTL ? c.detail_ar : c.detail_en) && (
                    <p className="m-0 mt-0.5 text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? c.detail_ar : c.detail_en}</p>
                  )}
                  {c.affectedEmployees && c.affectedEmployees.length > 0 && c.affectedEmployees.length <= 5 && (
                    <div className={`flex flex-wrap gap-1 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {c.affectedEmployees.map(emp => (
                        <Link
                          key={emp.id}
                          to={`/hr/employee/${emp.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-edge dark:border-edge-dark hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                        >
                          {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}
                        </Link>
                      ))}
                    </div>
                  )}
                  {c.affectedEmployees && c.affectedEmployees.length > 5 && (
                    <Link to="/hr/attendance" className="text-[11px] font-semibold text-brand-500 hover:underline">
                      {isRTL ? `عرض الجميع (${c.affectedEmployees.length})` : `View all (${c.affectedEmployees.length})`}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className={`flex justify-end gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Button onClick={onNext} disabled={hasErrors}>
          {isRTL ? 'متابعة' : 'Continue'}
          <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
        </Button>
      </div>
      {hasErrors && (
        <p className="text-xs text-red-500 text-center mt-3">
          {isRTL ? 'لازم تصلح الأخطاء قبل ما تكمل' : 'Fix errors before continuing'}
        </p>
      )}
    </div>
  );
}

/* ─── Step 2: Review Changes ─── */
function Step2Review({ previousRun, recentSalaryChanges, newLoans, adjustments, summary, isRTL, lang, onBack, onNext }) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-4">
        <KpiCard icon={TrendingUp} label={isRTL ? 'تغيير راتب' : 'Salary Changes'} value={summary.salaryChanges} color="#4A7AAB" />
        <KpiCard icon={CreditCard} label={isRTL ? 'قروض جديدة' : 'New Loans'} value={summary.newLoans} sub={summary.totalLoanDeduction > 0 ? `${summary.totalLoanDeduction.toLocaleString()} ج.م` : ''} color="#F59E0B" />
        <KpiCard icon={Plus} label={isRTL ? 'بونص' : 'Bonuses'} value={summary.bonuses} color="#10B981" />
        <KpiCard icon={Minus} label={isRTL ? 'خصومات' : 'Penalties'} value={summary.penalties} color="#EF4444" />
      </div>

      {previousRun && (
        <Card className="mb-4">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Calendar size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الشهر السابق' : 'Previous Month'}</p>
          </div>
          <div className="px-5 py-3 grid grid-cols-3 gap-4">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي' : 'Gross'}</p>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{Number(previousRun.total_gross || 0).toLocaleString()} ج.م</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'خصومات' : 'Deductions'}</p>
              <p className="m-0 text-sm font-bold text-red-500">{Number(previousRun.total_deductions || 0).toLocaleString()} ج.م</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'صافي' : 'Net'}</p>
              <p className="m-0 text-sm font-bold text-brand-500">{Number(previousRun.total_net || 0).toLocaleString()} ج.م</p>
            </div>
          </div>
        </Card>
      )}

      {recentSalaryChanges.length > 0 && (
        <Card className="mb-4">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <TrendingUp size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'تغييرات الراتب' : 'Salary Changes'}</p>
          </div>
          <div className="px-5 py-2">
            {recentSalaryChanges.map(c => (
              <div key={c.id} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                    {(isRTL ? c.employees?.full_name_ar : c.employees?.full_name_en) || c.employees?.full_name_ar || '—'}
                  </p>
                  <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{c.effective_date} {c.note ? `· ${c.note}` : ''}</p>
                </div>
                <span className="text-sm font-bold text-brand-500 tabular-nums">{Number(c.salary).toLocaleString()} ج.م</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {newLoans.length > 0 && (
        <Card className="mb-4">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CreditCard size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'قروض ستُخصم هذا الشهر' : 'Loans Deducting This Month'}</p>
          </div>
          <div className="px-5 py-2">
            {newLoans.slice(0, 10).map(l => (
              <div key={l.id} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                    {(isRTL ? l.employees?.full_name_ar : l.employees?.full_name_en) || l.employees?.full_name_ar || '—'}
                  </p>
                  <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                    {l.reason || (isRTL ? 'قرض' : 'Loan')} · {Number(l.amount || 0).toLocaleString()} ج.م
                  </p>
                </div>
                <span className="text-sm font-bold text-red-500 tabular-nums">-{Number(l.monthly_deduction || 0).toLocaleString()} ج.م</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {adjustments.length > 0 && (
        <Card className="mb-4">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <AlertCircle size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'بونص وخصومات هذا الشهر' : 'This Month Bonuses & Penalties'}</p>
          </div>
          <div className="px-5 py-2">
            {adjustments.slice(0, 10).map(a => {
              const isPos = a.type === 'addition' || a.type === 'bonus' || a.type === 'commission';
              return (
                <div key={a.id} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                      {(isRTL ? a.employees?.full_name_ar : a.employees?.full_name_en) || a.employees?.full_name_ar || '—'}
                    </p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{a.reason || a.type}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                    {isPos ? '+' : '-'}{Number(a.amount || 0).toLocaleString()} ج.م
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
          {isRTL ? 'السابق' : 'Back'}
        </Button>
        <Button onClick={onNext}>
          {isRTL ? 'متابعة' : 'Continue'}
          <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 3: Run ─── */
function Step3Run({ month, year, currentRun, isRTL, lang, onBack, onNext }) {
  return (
    <div>
      <Card className="p-6 mb-4">
        <div className="text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <DollarSign size={28} className="text-brand-500" />
          </div>
          <p className="m-0 mb-2 text-lg font-bold text-content dark:text-content-dark">
            {isRTL ? 'جاهز لتشغيل المرتبات' : 'Ready to compute salaries'}
          </p>
          <p className="m-0 mb-5 text-xs text-content-muted dark:text-content-muted-dark leading-relaxed">
            {isRTL
              ? 'اضغط الزرار لتفتح صفحة المرتبات الكاملة. هتشوف كل موظف بـ breakdown كامل وتقدر تراجع قبل الحفظ النهائي.'
              : "Click below to open the full payroll page. You'll see every employee's breakdown and can review before final save."}
          </p>
          <Link
            to={`/hr/payroll?month=${month}&year=${year}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
          >
            <DollarSign size={16} />
            {isRTL ? 'فتح صفحة المرتبات' : 'Open Payroll Page'}
            <ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />
          </Link>
        </div>
      </Card>

      {currentRun && (
        <Card className="p-4 mb-4 bg-yellow-500/5 border-yellow-500/30">
          <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                {isRTL ? 'المرتبات تم تشغيلها مسبقاً' : 'Already run'}
              </p>
              <p className="m-0 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                {isRTL
                  ? `تم في ${currentRun.run_date?.slice(0, 10)} — لو شغلت تاني هتستبدل البيانات السابقة.`
                  : `Run on ${currentRun.run_date?.slice(0, 10)} — running again will replace the previous data.`}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
          {isRTL ? 'السابق' : 'Back'}
        </Button>
        <Button onClick={onNext}>
          {isRTL ? 'تم — تأكيد' : "Done — Confirm"}
          <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 4: Confirm ─── */
function Step4Confirm({ month, year, currentRun, profile, isRTL, lang, onBack, onDone, onLockChange }) {
  const isLocked = !!currentRun?.locked_at;
  const canLock = ['admin', 'hr', 'finance'].includes(profile?.role);
  const version = currentRun?.version || 1;
  return (
    <div>
      <Card className="p-8 mb-4 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isLocked ? 'bg-brand-500/15' : 'bg-green-500/15'}`}>
          {isLocked ? <Lock size={28} className="text-brand-500" /> : <CheckCircle2 size={28} className="text-green-500" />}
        </div>
        <p className="m-0 mb-2 text-lg font-bold text-content dark:text-content-dark">
          {isLocked
            ? (isRTL ? 'مسير المرتبات مُغلق' : 'Payroll Run Locked')
            : (isRTL ? 'مرتبات الشهر تم تشغيلها' : 'Payroll Run Complete')}
        </p>
        <p className="m-0 mb-5 text-xs text-content-muted dark:text-content-muted-dark">
          {(lang === 'ar' ? MONTHS_AR : MONTHS_EN)[month - 1]} {year}
          {version > 1 && ` · ${isRTL ? `الإصدار ${version}` : `version ${version}`}`}
        </p>

        {currentRun && (
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'موظفين' : 'Employees'}</p>
              <p className="m-0 text-base font-bold text-content dark:text-content-dark">{currentRun.total_employees || '—'}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي' : 'Gross'}</p>
              <p className="m-0 text-base font-bold text-brand-500">{Number(currentRun.total_gross || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'صافي' : 'Net'}</p>
              <p className="m-0 text-base font-bold text-green-500">{Number(currentRun.total_net || 0).toLocaleString()}</p>
            </div>
          </div>
        )}

        {isLocked && currentRun?.locked_at && (
          <p className="m-0 mb-4 text-[11px] text-content-muted dark:text-content-muted-dark">
            {isRTL ? `قُفل في ${currentRun.locked_at.slice(0, 16).replace('T', ' ')}` : `Locked at ${currentRun.locked_at.slice(0, 16).replace('T', ' ')}`}
          </p>
        )}

        <div className={`flex flex-wrap justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {canLock && currentRun?.id && (
            isLocked ? (
              <Button variant="secondary" onClick={() => onLockChange(false)}>
                <Lock size={13} />
                {isRTL ? 'فتح للتعديل' : 'Unlock for corrections'}
              </Button>
            ) : (
              <Button onClick={() => onLockChange(true)}>
                <Lock size={13} />
                {isRTL ? 'قفل المسير نهائياً' : 'Lock & Finalize'}
              </Button>
            )
          )}
          <Link
            to="/hr/payroll"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark text-xs font-semibold text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500"
          >
            <FileText size={13} />
            {isRTL ? 'عرض كشف الراتب' : 'View Payslips'}
          </Link>
          <Link
            to="/hr/reports"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark text-xs font-semibold text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500"
          >
            <Briefcase size={13} />
            {isRTL ? 'التقارير' : 'Reports'}
          </Link>
        </div>

        {!isLocked && currentRun?.id && (
          <p className="m-0 mt-4 text-[11px] text-content-muted dark:text-content-muted-dark max-w-md mx-auto">
            {isRTL
              ? 'القفل يمنع أي تعديل لاحق على هذا الشهر. ينصح بالقفل بعد التأكد من المرتبات وصرفها.'
              : 'Locking prevents any later modification of this month. Lock after payslips are verified and paid out.'}
          </p>
        )}
      </Card>

      <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
          {isRTL ? 'السابق' : 'Back'}
        </Button>
        <Button onClick={onDone}>
          {isRTL ? 'إنهاء' : 'Finish'}
        </Button>
      </div>
    </div>
  );
}
