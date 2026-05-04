import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import supabase from '../../lib/supabase';
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, CreditCard,
  Plus, Minus, AlertCircle, ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/ui';

/* ─────────────────────────────────────────────────────────────────────────
   Compensation tab — the "calculation transparency" view.
   Goal: every salary number an employee sees should be traceable to its
   inputs (history, loans, adjustments, prior payslips).
───────────────────────────────────────────────────────────────────────── */

export default function EmployeeCompensationTab({ emp, isRTL, lang, canViewSalary }) {
  const [history, setHistory] = useState([]);
  const [loans, setLoans] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [recentPayslips, setRecentPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (!canViewSalary || !emp?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase.from('salary_history').select('*').eq('employee_id', emp.id).order('effective_date', { ascending: true }),
      supabase.from('employee_loans').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('payroll_adjustments').select('*').eq('employee_id', emp.id).eq('month', currentMonth).eq('year', currentYear),
      supabase.from('payroll_items').select('*, payroll_runs!inner(month, year)').eq('employee_id', emp.id).order('created_at', { ascending: false }).limit(3),
    ]).then(([histRes, loanRes, adjRes, payRes]) => {
      if (cancelled) return;
      setHistory(histRes.data || []);
      setLoans(loanRes.data || []);
      setAdjustments(adjRes.data || []);
      setRecentPayslips(payRes.data || []);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [emp?.id, canViewSalary, currentMonth, currentYear]);

  if (!canViewSalary) {
    return (
      <Card className="p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={26} className="text-red-500" />
        </div>
        <p className="m-0 mb-1.5 text-base font-bold text-content dark:text-content-dark">
          {isRTL ? 'غير مصرح' : 'Not allowed'}
        </p>
        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark max-w-md mx-auto">
          {isRTL ? 'بيانات الراتب متاحة فقط لـ HR والمالية والإدارة.' : 'Salary data is visible only to HR, Finance, and Admin.'}
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1,2,3,4].map(i => (
          <Card key={i} className="p-5 animate-pulse">
            <div className="h-4 bg-edge dark:bg-edge-dark rounded w-32 mb-4" />
            <div className="h-3 bg-edge dark:bg-edge-dark rounded w-full mb-2" />
            <div className="h-3 bg-edge dark:bg-edge-dark rounded w-3/4 mb-2" />
            <div className="h-3 bg-edge dark:bg-edge-dark rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <CurrentMonthBreakdown
        emp={emp}
        adjustments={adjustments}
        loans={loans}
        recentPayslips={recentPayslips}
        currentMonth={currentMonth}
        currentYear={currentYear}
        isRTL={isRTL}
        lang={lang}
      />
      <SalaryTimeline emp={emp} history={history} isRTL={isRTL} lang={lang} />
      <ActiveLoans loans={loans} isRTL={isRTL} lang={lang} />
      <RecentPayslips payslips={recentPayslips} isRTL={isRTL} lang={lang} />
    </div>
  );
}

/* ─────────────── Current month breakdown card ─────────────── */
function CurrentMonthBreakdown({ emp, adjustments, loans, recentPayslips, currentMonth, currentYear, isRTL, lang }) {
  // Try to find the actual payroll item for the current month — most accurate.
  const currentItem = recentPayslips.find(p =>
    p.payroll_runs?.month === currentMonth && p.payroll_runs?.year === currentYear
  );

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

  // If a payroll run exists for this month, show its actual line items.
  if (currentItem) {
    return (
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <DollarSign size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? `راتب ${monthName}` : `${monthName} salary`}
            </p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-600 border border-green-500/30">
            {isRTL ? 'تم التشغيل' : 'Run'}
          </span>
        </div>
        <BreakdownLines item={currentItem} isRTL={isRTL} lang={lang} />
      </Card>
    );
  }

  // Otherwise show a forecast based on what we know now.
  const baseSalary = Number(emp.salary) || 0;
  const monthlyLoanDeduction = loans
    .filter(l => l.status !== 'closed')
    .reduce((s, l) => s + (Number(l.monthly_deduction) || 0), 0);
  const totalAdjustments = adjustments.reduce((s, a) => {
    const sign = a.type === 'penalty' ? -1 : 1;
    return s + (sign * (Number(a.amount) || 0));
  }, 0);
  const forecastNet = baseSalary - monthlyLoanDeduction + totalAdjustments;

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <DollarSign size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? `توقع راتب ${monthName}` : `${monthName} forecast`}
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/15 text-yellow-600 border border-yellow-500/30">
          {isRTL ? 'لم يتم التشغيل' : 'Not run yet'}
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="m-0 mb-3 text-[11px] text-content-muted dark:text-content-muted-dark leading-relaxed">
          {isRTL
            ? 'الأرقام دي تقدير بناءً على الراتب والقروض والتعديلات الحالية. الخصومات الفعلية للتأخير والإجازات هتتحسب وقت تشغيل المرتبات.'
            : 'These numbers are an estimate based on salary, active loans, and adjustments. Actual deductions for tardiness/leave will be computed when payroll is run.'}
        </p>
        <BreakdownRow label={isRTL ? 'الراتب الأساسي' : 'Base Salary'} value={baseSalary} positive isRTL={isRTL} />
        {monthlyLoanDeduction > 0 && (
          <BreakdownRow label={isRTL ? 'قسط القروض' : 'Loan installment'} value={-monthlyLoanDeduction} isRTL={isRTL} />
        )}
        {adjustments.map(adj => (
          <BreakdownRow
            key={adj.id}
            label={`${adj.type === 'penalty' ? (isRTL ? 'خصم' : 'Penalty') : (isRTL ? 'بونص' : 'Bonus')}: ${adj.reason || '—'}`}
            value={(adj.type === 'penalty' ? -1 : 1) * (Number(adj.amount) || 0)}
            isRTL={isRTL}
          />
        ))}
        <div className={`mt-2 pt-3 border-t border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'صافي متوقع' : 'Forecast Net'}
          </span>
          <span className="text-base font-extrabold text-brand-500">
            {forecastNet.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
          </span>
        </div>
        <div className="mt-4 text-center">
          <Link
            to="/hr/payroll"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:underline"
          >
            {isRTL ? 'فتح صفحة المرتبات' : 'Open payroll page'}
            <ChevronRight size={13} className={isRTL ? 'rotate-180' : ''} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function BreakdownLines({ item, isRTL, lang }) {
  const lines = [
    { label_ar: 'الراتب الأساسي', label_en: 'Base Salary', value: Number(item.base_salary) || 0 },
    { label_ar: 'البدلات', label_en: 'Allowances', value: Number(item.total_allowances) || 0 },
    { label_ar: 'البونص', label_en: 'Bonuses', value: Number(item.total_bonuses) || 0 },
    { label_ar: 'تأمين اجتماعي', label_en: 'Insurance', value: -(Number(item.insurance_amount) || 0) },
    { label_ar: 'ضريبة الدخل', label_en: 'Tax', value: -(Number(item.tax_amount) || 0) },
    { label_ar: 'خصم تأخير', label_en: 'Late Deduction', value: -(Number(item.late_deduction) || 0) },
    { label_ar: 'خصم غياب', label_en: 'Absence Deduction', value: -(Number(item.absence_deduction) || 0) },
    { label_ar: 'قسط قرض', label_en: 'Loan Installment', value: -(Number(item.loan_deduction) || 0) },
    { label_ar: 'تعديلات أخرى', label_en: 'Other Adjustments', value: Number(item.other_adjustments) || 0 },
  ].filter(l => l.value !== 0);

  return (
    <div className="px-5 py-4">
      {lines.map((l, i) => (
        <BreakdownRow
          key={i}
          label={isRTL ? l.label_ar : l.label_en}
          value={l.value}
          isRTL={isRTL}
        />
      ))}
      <div className={`mt-2 pt-3 border-t border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'صافي الراتب' : 'Net Salary'}
        </span>
        <span className="text-base font-extrabold text-brand-500">
          {Number(item.net_salary || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
        </span>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, positive, isRTL }) {
  const isNeg = value < 0;
  const Icon = isNeg ? Minus : Plus;
  const color = isNeg ? '#EF4444' : positive ? '#1B3347' : '#10B981';
  return (
    <div className={`flex items-center justify-between py-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
      <span className={`inline-flex items-center gap-1.5 text-xs text-content dark:text-content-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
        {!positive && <Icon size={11} style={{ color }} />}
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: positive ? undefined : color }}>
        {Math.abs(value).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
      </span>
    </div>
  );
}

/* ─────────────── Salary timeline ─────────────── */
function SalaryTimeline({ emp, history, isRTL, lang }) {
  // Augment with the current row at the bottom (in case salary was updated
  // outside of salary_history).
  const items = useMemo(() => {
    const sorted = [...(history || [])].sort((a, b) => (a.effective_date || '').localeCompare(b.effective_date || ''));
    if (!sorted.length && emp.salary) {
      return [{ id: 'current', salary: emp.salary, effective_date: emp.hire_date || '—', synthetic: true }];
    }
    return sorted;
  }, [history, emp.salary, emp.hire_date]);

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Calendar size={16} className="text-brand-500" />
        <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'تاريخ الراتب' : 'Salary Timeline'}
        </p>
      </div>
      <div className="px-5 py-4">
        {items.length === 0 ? (
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-4">
            {isRTL ? 'لا يوجد سجل بعد' : 'No history yet'}
          </p>
        ) : (
          <div className={`relative ${isRTL ? 'pr-4' : 'pl-4'}`}>
            <div className={`absolute top-2 bottom-2 w-px bg-edge dark:bg-edge-dark ${isRTL ? 'right-1.5' : 'left-1.5'}`} />
            {items.map((item, i) => {
              const prev = items[i - 1];
              const change = prev ? Number(item.salary) - Number(prev.salary) : 0;
              const changePct = prev && prev.salary ? Math.round((change / Number(prev.salary)) * 100) : 0;
              const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : null;
              const trendColor = change > 0 ? '#10B981' : change < 0 ? '#EF4444' : '#6B8DB5';
              return (
                <div key={item.id} className={`relative mb-4 last:mb-0 ${isRTL ? 'pr-3' : 'pl-3'}`}>
                  <div
                    className={`absolute top-1 w-3 h-3 rounded-full bg-brand-500 border-2 border-surface-card dark:border-surface-card-dark ${isRTL ? '-right-[7px]' : '-left-[7px]'}`}
                  />
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                        {Number(item.salary).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                      </p>
                      <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                        {item.effective_date}
                        {item.note ? ` · ${item.note}` : ''}
                        {item.synthetic ? ` · ${isRTL ? 'الراتب الحالي' : 'Current'}` : ''}
                      </p>
                    </div>
                    {TrendIcon && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold"
                        style={{ color: trendColor }}
                      >
                        <TrendIcon size={11} />
                        {change > 0 ? '+' : ''}{changePct}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─────────────── Active loans ─────────────── */
function ActiveLoans({ loans, isRTL, lang }) {
  const active = loans.filter(l => l.status !== 'closed');

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <CreditCard size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'القروض النشطة' : 'Active Loans'}
          </p>
        </div>
        <Link to="/hr/loans" className="text-[11px] font-semibold text-brand-500 hover:underline">
          {isRTL ? 'إدارة' : 'Manage'}
        </Link>
      </div>
      <div className="px-5 py-4">
        {active.length === 0 ? (
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-4">
            {isRTL ? 'لا توجد قروض نشطة' : 'No active loans'}
          </p>
        ) : active.map(loan => {
          const total = Number(loan.amount) || 0;
          const paid = Number(loan.balance_paid) || 0;
          const remaining = Math.max(0, total - paid);
          const monthly = Number(loan.monthly_deduction) || 0;
          const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : 0;
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          return (
            <div key={loan.id} className="mb-4 last:mb-0">
              <div className={`flex items-center justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                  {loan.reason || (isRTL ? 'قرض شخصي' : 'Personal loan')}
                </p>
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark">
                  {pct}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={`flex items-center justify-between text-[10px] text-content-muted dark:text-content-muted-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span>
                  {isRTL ? `متبقي ${remaining.toLocaleString()} ج.م` : `${remaining.toLocaleString()} EGP left`}
                </span>
                <span>
                  {isRTL ? `${monthly.toLocaleString()} شهرياً` : `${monthly.toLocaleString()}/mo`}
                  {monthsLeft > 0 ? ` · ${monthsLeft} ${isRTL ? 'شهر' : 'mo'}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─────────────── Recent payslips ─────────────── */
function RecentPayslips({ payslips, isRTL, lang }) {
  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Calendar size={16} className="text-brand-500" />
        <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'كشوف الراتب الأخيرة' : 'Recent Payslips'}
        </p>
      </div>
      <div className="px-5 py-2">
        {payslips.length === 0 ? (
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
            {isRTL ? 'لم يتم تشغيل المرتبات بعد' : 'No payroll runs yet'}
          </p>
        ) : payslips.map(p => {
          const m = p.payroll_runs?.month;
          const y = p.payroll_runs?.year;
          const monthName = m && y
            ? new Date(y, m - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })
            : '—';
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{monthName}</p>
                <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                  {isRTL ? `قاعدة ${Number(p.base_salary || 0).toLocaleString()}` : `Base ${Number(p.base_salary || 0).toLocaleString()}`}
                </p>
              </div>
              <span className="text-sm font-extrabold text-brand-500 tabular-nums">
                {Number(p.net_salary || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
