import { useState, useEffect, useMemo } from 'react';
import supabase from '../../lib/supabase';
import { fetchPayrollRun } from '../../services/payrollService';
import { fetchAttendance } from '../../services/attendanceService';
import {
  X, DollarSign, Calendar, Clock, AlertCircle, CheckCircle2,
  TrendingUp, TrendingDown, CreditCard, Plus, Minus, Printer, FileText,
} from 'lucide-react';
import { Button, Modal, ModalFooter } from '../../components/ui';
import { printPayslip } from '../../services/printService';

/* ─────────────────────────────────────────────────────────────────────────
   Detailed payroll breakdown — shows the math behind every deduction:
   per-day late minutes, per-day absences, salary-history pro-rating,
   active loans, and contributing adjustments. Pulls live data from DB.
───────────────────────────────────────────────────────────────────────── */

const SHIFT_DEFAULT_START = '10:00';
const SHIFT_DEFAULT_END = '18:00';
const SHIFT_DEFAULT_LATE = '10:30';

export default function PayrollBreakdownModal({
  emp,
  month,
  year,
  config,
  onClose,
  isRTL,
  lang,
}) {
  const [item, setItem] = useState(null);              // payroll_items row
  const [run, setRun] = useState(null);                // payroll_runs row
  const [attendance, setAttendance] = useState([]);    // monthly rows
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [loans, setLoans] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!emp?.id) return;
    let cancelled = false;
    (async () => {
      const runRow = await fetchPayrollRun(month, year);
      if (cancelled) return;
      setRun(runRow);

      const att = await fetchAttendance({ month, year, employeeId: emp.id });
      if (cancelled) return;
      setAttendance(att || []);

      // Get the payroll_item for this employee in this run (if any)
      let itemRow = null;
      if (runRow?.id) {
        const { data: it } = await supabase
          .from('payroll_items')
          .select('*')
          .eq('run_id', runRow.id)
          .eq('employee_id', emp.id)
          .maybeSingle();
        itemRow = it;
      }
      if (cancelled) return;
      setItem(itemRow);

      // Salary history (with optional new audit columns)
      const { data: sh } = await supabase
        .from('salary_history')
        .select('*')
        .eq('employee_id', emp.id)
        .order('effective_date', { ascending: true });
      if (cancelled) return;
      setSalaryHistory(sh || []);

      // Loans (only ones that contributed to this month — active or recently closed)
      const { data: ln } = await supabase
        .from('employee_loans')
        .select('*')
        .eq('employee_id', emp.id)
        .is('deleted_at', null);
      if (cancelled) return;
      setLoans(ln || []);

      // Adjustments — load from itemRow.adjustment_ids if present, else from month
      let adjRows = [];
      if (itemRow?.adjustment_ids?.length) {
        const { data } = await supabase
          .from('payroll_adjustments')
          .select('*')
          .in('id', itemRow.adjustment_ids);
        adjRows = data || [];
      } else {
        const { data } = await supabase
          .from('payroll_adjustments')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('month', month)
          .eq('year', year);
        adjRows = data || [];
      }
      if (cancelled) return;
      setAdjustments(adjRows);

      // Shift assignment
      const { data: sa } = await supabase
        .from('employee_shifts')
        .select('*, shifts(*)')
        .eq('employee_id', emp.id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setShift(sa?.shifts || null);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [emp?.id, month, year]);

  const monthName = useMemo(
    () => new Date(year, month - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
    [month, year, lang]
  );

  // Shift settings (with employee-level override fallbacks)
  const shiftStart = shift?.official_start || emp.work_start || SHIFT_DEFAULT_START;
  const shiftEnd = shift?.official_end || emp.work_end || SHIFT_DEFAULT_END;
  const lateThreshold = shift?.late_threshold || emp.late_threshold || SHIFT_DEFAULT_LATE;

  // Compute per-day attendance breakdown
  const daysBreakdown = useMemo(() => {
    return attendance.map(a => {
      const lateMinutes = computeLateMinutes(a.check_in, lateThreshold);
      const earlyMinutes = computeEarlyMinutes(a.check_out, shiftEnd);
      return {
        ...a,
        lateMinutes,
        earlyMinutes,
      };
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [attendance, lateThreshold, shiftEnd]);

  const lateDays = daysBreakdown.filter(d => d.lateMinutes > 0);
  const absentDays = daysBreakdown.filter(d => d.status === 'absent');
  const earlyDays = daysBreakdown.filter(d => d.earlyMinutes > 0);

  const totalLateMinutes = lateDays.reduce((s, d) => s + d.lateMinutes, 0);

  // Salary timeline within this month
  const salaryInMonth = useMemo(() => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    const relevant = salaryHistory.filter(s => s.effective_date <= monthEnd);
    return relevant.length > 0 ? relevant : [];
  }, [salaryHistory, month, year]);

  if (loading) {
    return (
      <Modal open={true} onClose={onClose} title={isRTL ? 'جاري تحميل التفاصيل...' : 'Loading details...'} width="max-w-4xl">
        <div className="py-12 text-center text-content-muted dark:text-content-muted-dark">
          <Clock size={32} className="mx-auto mb-3 animate-pulse" />
          <p>{isRTL ? 'جاري التحميل' : 'Loading'}</p>
        </div>
      </Modal>
    );
  }

  // Numbers from payroll_item if run exists; else from emp object
  const baseSalary = item?.base_salary ?? emp.baseSalary ?? (Number(emp.salary) || 0);
  const totalDeductions = item?.total_deductions ?? emp.totalDeductions ?? 0;
  const netSalary = item?.net_salary ?? emp.netSalary ?? 0;
  const lateDeduction = item?.late_deduction ?? emp.lateDeduction ?? 0;
  const absentDeduction = item?.absent_deduction ?? emp.absentDeduction ?? 0;
  const loanDeduction = item?.loan_deduction ?? emp.loanDeduction ?? 0;
  const otherDeductions = item?.other_deductions ?? emp.otherDeductions ?? 0;
  const otherAdditions = item?.other_additions ?? emp.otherAdditions ?? 0;
  const tax = item?.tax ?? emp.tax ?? 0;
  const insurance = item?.social_insurance ?? emp.socialInsurance ?? 0;
  const allowances = item?.allowances ?? emp.allowances ?? 0;
  const overtimeBonus = item?.overtime_bonus ?? emp.overtimeBonus ?? 0;

  const employeeName = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '—';

  return (
    <Modal open={true} onClose={onClose} title={isRTL ? `تفاصيل راتب — ${employeeName}` : `Salary Details — ${employeeName}`} width="max-w-4xl">
      <div className="space-y-4 text-sm">
        {/* ── Top: Summary card ── */}
        <div className={`p-4 rounded-xl bg-gradient-to-br from-brand-900/5 to-brand-500/5 border border-brand-500/20 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCell label={isRTL ? 'الراتب الأساسي' : 'Base'} value={baseSalary} color="#1B3347" />
            <SummaryCell label={isRTL ? 'إجمالي الإضافات' : 'Additions'} value={allowances + overtimeBonus + otherAdditions} color="#10B981" />
            <SummaryCell label={isRTL ? 'إجمالي الخصومات' : 'Deductions'} value={totalDeductions} color="#EF4444" negative />
            <SummaryCell label={isRTL ? 'الصافي' : 'Net'} value={netSalary} color="#4A7AAB" big />
          </div>
          <p className="m-0 mt-2 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `شهر ${monthName}` : `Period: ${monthName}`}
            {run?.locked_at && ` · 🔒 ${isRTL ? 'مُغلق' : 'Locked'}`}
            {run?.version > 1 && ` · v${run.version}`}
          </p>
        </div>

        {/* ── Salary timeline ── */}
        {salaryInMonth.length >= 1 && (
          <Section icon={Calendar} title={isRTL ? 'تاريخ الراتب' : 'Salary Timeline'} isRTL={isRTL}>
            {salaryInMonth.map((s, i) => {
              const prev = i > 0 ? salaryInMonth[i - 1] : null;
              const change = prev ? Number(s.salary) - Number(prev.salary) : 0;
              const changePct = prev?.salary ? Math.round((change / Number(prev.salary)) * 100) : 0;
              const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : null;
              return (
                <div key={s.id} className={`flex items-center justify-between py-1.5 border-b border-edge/40 dark:border-edge-dark/40 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                    <span className="text-xs text-content dark:text-content-dark font-semibold">{s.effective_date}</span>
                    {s.note && <span className="text-[10px] text-content-muted dark:text-content-muted-dark">· {s.note}</span>}
                  </div>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-bold text-content dark:text-content-dark">{Number(s.salary).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>
                    {TrendIcon && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <TrendIcon size={10} />{change > 0 ? '+' : ''}{changePct}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        {/* ── Late breakdown per day ── */}
        {lateDays.length > 0 && (
          <Section
            icon={Clock}
            title={isRTL ? 'التأخير اليومي' : 'Daily Late Breakdown'}
            isRTL={isRTL}
            badge={`${lateDays.length} ${isRTL ? 'يوم' : 'days'} · ${totalLateMinutes} ${isRTL ? 'دقيقة' : 'min'}`}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {lateDays.map(d => (
                <div key={d.id || d.date} className={`flex items-center justify-between px-2 py-1 rounded bg-yellow-500/5 border border-yellow-500/20 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-mono">{d.date}</span>
                  <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-500">+{d.lateMinutes}m</span>
                </div>
              ))}
            </div>
            {lateDeduction > 0 && (
              <p className="m-0 mt-2 text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'إجمالي خصم التأخير: ' : 'Total late deduction: '}
                <span className="font-bold text-red-600">-{Number(lateDeduction).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            )}
          </Section>
        )}

        {/* ── Absent days ── */}
        {absentDays.length > 0 && (
          <Section
            icon={X}
            title={isRTL ? 'أيام الغياب' : 'Absent Days'}
            isRTL={isRTL}
            badge={`${absentDays.length} ${isRTL ? 'يوم' : 'day(s)'}`}
          >
            <div className="space-y-1">
              {absentDays.map(d => (
                <div key={d.id || d.date} className={`flex items-center justify-between px-3 py-1.5 rounded bg-red-500/5 border border-red-500/20 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <X size={12} className="text-red-500" />
                    <span className="text-xs font-semibold">{d.date}</span>
                    {d.notes && <span className="text-[10px] text-content-muted dark:text-content-muted-dark">· {d.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
            {absentDeduction > 0 && (
              <p className="m-0 mt-2 text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'إجمالي خصم الغياب: ' : 'Total absence deduction: '}
                <span className="font-bold text-red-600">-{Number(absentDeduction).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            )}
          </Section>
        )}

        {/* ── Early checkout days ── */}
        {earlyDays.length > 0 && (
          <Section
            icon={Clock}
            title={isRTL ? 'الخروج المبكر' : 'Early Departures'}
            isRTL={isRTL}
            badge={`${earlyDays.length} ${isRTL ? 'يوم' : 'days'}`}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {earlyDays.map(d => (
                <div key={d.id || d.date} className={`flex items-center justify-between px-2 py-1 rounded bg-orange-500/5 border border-orange-500/20 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-mono">{d.date}</span>
                  <span className="text-[11px] font-bold text-orange-700 dark:text-orange-500">-{d.earlyMinutes}m</span>
                </div>
              ))}
            </div>
            <p className="m-0 mt-2 text-[11px] text-content-muted dark:text-content-muted-dark">
              {isRTL
                ? 'الخصم على الخروج المبكر يضاف يدوياً عبر تبويب البونص. السيستم لا يخصمه تلقائياً.'
                : 'Early-departure deductions are entered manually via the Bonuses tab. Not auto-deducted.'}
            </p>
          </Section>
        )}

        {/* ── Loans ── */}
        {loans.length > 0 && (
          <Section icon={CreditCard} title={isRTL ? 'القروض والسلف' : 'Loans & Advances'} isRTL={isRTL}>
            {loans.map(loan => {
              const total = Number(loan.amount) || 0;
              const paid = Number(loan.balance_paid) || 0;
              const remaining = Math.max(0, total - paid);
              const monthly = Number(loan.monthly_deduction) || 0;
              const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
              return (
                <div key={loan.id} className={`p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 mb-2 last:mb-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-bold">{loan.reason || (isRTL ? 'قرض' : 'Loan')}</span>
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                      {paid.toLocaleString()} / {total.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-purple-500/15 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className={`flex items-center justify-between text-[10px] text-content-muted dark:text-content-muted-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span>{isRTL ? `الخصم الشهري: ${monthly.toLocaleString()}` : `Monthly: ${monthly.toLocaleString()}`}</span>
                    <span>{isRTL ? `متبقي: ${remaining.toLocaleString()}` : `Remaining: ${remaining.toLocaleString()}`}</span>
                  </div>
                </div>
              );
            })}
            {loanDeduction > 0 && (
              <p className="m-0 mt-2 text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'خصم القروض هذا الشهر: ' : 'Loan deduction this month: '}
                <span className="font-bold text-red-600">-{Number(loanDeduction).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            )}
          </Section>
        )}

        {/* ── Adjustments (bonuses + penalties) ── */}
        {adjustments.length > 0 && (
          <Section icon={Plus} title={isRTL ? 'البونص والخصومات اليدوية' : 'Bonuses & Penalties'} isRTL={isRTL}>
            <div className="space-y-1">
              {adjustments.map(a => {
                const isPos = ['addition', 'bonus', 'commission'].includes(a.type);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between px-3 py-1.5 rounded ${isPos ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'} border ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {isPos ? <Plus size={12} className="text-green-500" /> : <Minus size={12} className="text-red-500" />}
                      <span className="text-xs font-semibold">{a.reason || a.type}</span>
                    </div>
                    <span className={`text-xs font-bold ${isPos ? 'text-green-600' : 'text-red-600'} tabular-nums`}>
                      {isPos ? '+' : '-'}{Number(a.amount).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Tax / Insurance (only if non-zero) ── */}
        {(tax > 0 || insurance > 0) && (
          <Section icon={DollarSign} title={isRTL ? 'الضرائب والتأمينات' : 'Tax & Insurance'} isRTL={isRTL}>
            {tax > 0 && (
              <Row label={isRTL ? 'ضريبة الدخل' : 'Income Tax'} value={-tax} isRTL={isRTL} />
            )}
            {insurance > 0 && (
              <Row label={isRTL ? 'تأمين اجتماعي' : 'Social Insurance'} value={-insurance} isRTL={isRTL} />
            )}
          </Section>
        )}

        {/* ── Final breakdown ── */}
        <div className="p-4 rounded-xl border-2 border-brand-500/30 bg-brand-500/5">
          <h4 className={`m-0 mb-3 text-sm font-bold text-content dark:text-content-dark ${isRTL ? 'text-right' : 'text-left'}`}>
            {isRTL ? 'الحساب النهائي' : 'Final Calculation'}
          </h4>
          <div className="space-y-1">
            <Row label={isRTL ? 'الراتب الأساسي' : 'Base Salary'} value={baseSalary} positive isRTL={isRTL} />
            {allowances > 0 && <Row label={isRTL ? 'البدلات' : 'Allowances'} value={allowances} isRTL={isRTL} />}
            {overtimeBonus > 0 && <Row label={isRTL ? 'بونص الأوفرتايم' : 'Overtime'} value={overtimeBonus} isRTL={isRTL} />}
            {otherAdditions > 0 && <Row label={isRTL ? 'إضافات أخرى' : 'Other Additions'} value={otherAdditions} isRTL={isRTL} />}
            {tax > 0 && <Row label={isRTL ? 'ضريبة' : 'Tax'} value={-tax} isRTL={isRTL} />}
            {insurance > 0 && <Row label={isRTL ? 'تأمين' : 'Insurance'} value={-insurance} isRTL={isRTL} />}
            {lateDeduction > 0 && <Row label={isRTL ? 'خصم تأخير' : 'Late Deduction'} value={-lateDeduction} isRTL={isRTL} />}
            {absentDeduction > 0 && <Row label={isRTL ? 'خصم غياب' : 'Absence'} value={-absentDeduction} isRTL={isRTL} />}
            {loanDeduction > 0 && <Row label={isRTL ? 'قسط القرض' : 'Loan'} value={-loanDeduction} isRTL={isRTL} />}
            {otherDeductions > 0 && <Row label={isRTL ? 'خصومات أخرى' : 'Other Deductions'} value={-otherDeductions} isRTL={isRTL} />}
          </div>
          <div className={`mt-3 pt-3 border-t-2 border-brand-500/30 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-base font-bold text-content dark:text-content-dark">
              {isRTL ? 'الصافي' : 'Net Salary'}
            </span>
            <span className="text-2xl font-extrabold text-brand-500 tabular-nums">
              {Number(netSalary).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
            </span>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button
          variant="secondary"
          onClick={() => printPayslip(item || makeFakeItem(emp), emp, { month, year }, lang)}
          disabled={!item && !emp.netSalary}
        >
          <Printer size={14} />
          {isRTL ? 'طباعة' : 'Print'}
        </Button>
        <Button onClick={onClose}>
          {isRTL ? 'إغلاق' : 'Close'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function computeLateMinutes(checkIn, lateThreshold) {
  if (!checkIn || !lateThreshold) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [th, tm] = lateThreshold.split(':').map(Number);
  if (isNaN(ih) || isNaN(th)) return 0;
  const inMin = ih * 60 + im;
  const thMin = th * 60 + tm;
  return Math.max(0, inMin - thMin);
}

function computeEarlyMinutes(checkOut, shiftEnd) {
  if (!checkOut || !shiftEnd) return 0;
  const [oh, om] = checkOut.split(':').map(Number);
  const [eh, em] = shiftEnd.split(':').map(Number);
  if (isNaN(oh) || isNaN(eh)) return 0;
  const outMin = oh * 60 + om;
  const endMin = eh * 60 + em;
  return Math.max(0, endMin - outMin);
}

function makeFakeItem(emp) {
  // For pre-run printing, build a payslip-shaped object from live calc state.
  return {
    base_salary: emp.baseSalary || emp.salary,
    allowances: emp.allowances,
    overtime_bonus: emp.overtimeBonus,
    tax: emp.tax,
    social_insurance: emp.socialInsurance,
    late_deduction: emp.lateDeduction,
    absent_deduction: emp.absentDeduction,
    loan_deduction: emp.loanDeduction,
    other_deductions: emp.otherDeductions,
    other_additions: emp.otherAdditions,
    total_deductions: emp.totalDeductions,
    net_salary: emp.netSalary,
    present_days: emp.stats?.presentDays,
    absent_days: emp.stats?.absentDays,
    late_minutes: emp.stats?.totalLateMinutes,
  };
}

/* ─── Section wrapper ────────────────────────────────────────────── */
function Section({ icon: Icon, title, isRTL, badge, children }) {
  return (
    <div className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden">
      <div className={`px-4 py-2.5 border-b border-edge/40 dark:border-edge-dark/40 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Icon size={14} className="text-brand-500" />
          <span className="text-xs font-bold text-content dark:text-content-dark">{title}</span>
        </div>
        {badge && <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{badge}</span>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({ label, value, positive, isRTL }) {
  const isNeg = value < 0;
  return (
    <div className={`flex items-center justify-between py-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
      <span className="text-xs text-content dark:text-content-dark">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${isNeg ? 'text-red-600' : positive ? 'text-content dark:text-content-dark' : 'text-green-600'}`}>
        {isNeg ? '-' : positive ? '' : '+'}{Math.abs(Number(value)).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
      </span>
    </div>
  );
}

function SummaryCell({ label, value, color, big, negative }) {
  return (
    <div>
      <p className="m-0 text-[10px] uppercase tracking-wide text-content-muted dark:text-content-muted-dark">{label}</p>
      <p className={`m-0 ${big ? 'text-2xl' : 'text-base'} font-extrabold tabular-nums`} style={{ color }}>
        {negative ? '-' : ''}{Math.abs(Number(value)).toLocaleString()}
      </p>
    </div>
  );
}
