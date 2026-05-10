import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import supabase from '../../lib/supabase';
import { fetchEmployees } from '../../services/employeesService';
import { fetchAttendance } from '../../services/attendanceService';
import { fetchHolidays } from '../../services/holidaysService';
import { fetchAllEmployeeShifts } from '../../services/employeeShiftsService';
import {
  fetchPayrollRun, savePayrollRun, fetchActiveLoans, fetchAdjustments,
  lockPayrollRun, unlockPayrollRun,
} from '../../services/payrollService';
import { loadRulesMap } from '../../services/payrollRulesService';
import { loadPayrollConfig, DEFAULT_PAYROLL_CONFIG } from '../../config/payrollConfig';
import { calculatePayrollLine, groupAttendanceByEmp } from '../../services/payrollCalculator';
import {
  CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronRight,
  Lock, Play, RefreshCw, DollarSign, Plus, Minus, Printer, Eye,
} from 'lucide-react';
import { Card, Button, KpiCard, PageSkeleton, Select, Modal, ModalFooter } from '../../components/ui';
import PayrollBreakdownModal from './PayrollBreakdownModal';
import { printPayslip } from '../../services/printService';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

/* ─────────────────────────────────────────────────────────────────────────
   Unified payroll close page — replaces multi-page workflow with a single
   view per month. Shows every employee as an expandable card with
   inline breakdown, quick adjustment, approve toggle, and print.
───────────────────────────────────────────────────────────────────────── */

export default function PayrollClose() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState({});
  const [allShifts, setAllShifts] = useState([]);
  const [salaryHistories, setSalaryHistories] = useState({});
  const [configHistories, setConfigHistories] = useState({});
  const [loans, setLoans] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [rulesMap, setRulesMap] = useState({});
  const [config, setConfig] = useState(DEFAULT_PAYROLL_CONFIG);
  const [run, setRun] = useState(null);

  // UI state
  const [expandedId, setExpandedId] = useState(null);
  const [approvedIds, setApprovedIds] = useState(new Set());
  const [breakdownEmp, setBreakdownEmp] = useState(null);
  const [adjModal, setAdjModal] = useState(null);  // employee being adjusted
  const [running, setRunning] = useState(false);

  // Load everything
  const loadAll = async () => {
    setLoading(true);
    try {
      const [emps, att, hols, shifts, rules, cfg, runRow, loanRows, adjRows] = await Promise.all([
        fetchEmployees(),
        fetchAttendance({ month, year }),
        fetchHolidays(year, month),
        supabase.from('shifts').select('*').then(r => r.data || []),
        loadRulesMap(),
        loadPayrollConfig(),
        fetchPayrollRun(month, year),
        fetchActiveLoans(),
        fetchAdjustments(month, year),
      ]);
      setEmployees(emps);
      setAttendance(att);
      setHolidays(hols);
      setAllShifts(shifts);
      setRulesMap(rules);
      setConfig(cfg);
      setRun(runRow);
      setLoans(loanRows);
      setAdjustments(adjRows);

      // Per-employee histories — fetch in parallel
      const histPromises = emps.map(e =>
        Promise.all([
          supabase.from('salary_history').select('*').eq('employee_id', e.id).order('effective_date'),
          supabase.from('employee_config_history').select('*').eq('employee_id', e.id).order('effective_date'),
          fetchAllEmployeeShifts(e.id).catch(() => []),
        ])
      );
      const hists = await Promise.all(histPromises);
      const sh = {}, ch = {}, sa = {};
      emps.forEach((e, i) => {
        sh[e.id] = hists[i][0]?.data || [];
        ch[e.id] = hists[i][1]?.data || [];
        sa[e.id] = hists[i][2] || [];
      });
      setSalaryHistories(sh);
      setConfigHistories(ch);
      setShiftAssignments(sa);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [month, year]);

  const holidayDates = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  const attendanceByEmp = useMemo(() => groupAttendanceByEmp(attendance), [attendance]);

  // Calc for every employee
  const calculated = useMemo(() => {
    return employees
      .filter(e => e.status !== 'inactive' && e.is_active !== false)
      .map(emp => calculatePayrollLine(emp, {
        month, year, attendanceByEmp, configHistories, salaryHistories, shiftAssignments,
        allShiftsDb: allShifts, holidayDates, rulesMap, config, loans, adjustments,
      }));
  }, [employees, month, year, attendanceByEmp, configHistories, salaryHistories,
      shiftAssignments, allShifts, holidayDates, rulesMap, config, loans, adjustments]);

  const totals = useMemo(() => ({
    employees: calculated.length,
    gross: calculated.reduce((s, e) => s + e.baseSalary + e.allowances + e.overtimeBonus + e.otherAdditions, 0),
    deductions: calculated.reduce((s, e) => s + e.totalDeductions, 0),
    net: calculated.reduce((s, e) => s + e.netSalary, 0),
    approved: calculated.filter(e => approvedIds.has(e.id)).length,
  }), [calculated, approvedIds]);

  const allApproved = calculated.length > 0 && totals.approved === calculated.length;
  const isLocked = !!run?.locked_at;

  const toggleApproved = (id) => {
    if (isLocked) return;
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approveAll = () => {
    if (isLocked) return;
    setApprovedIds(new Set(calculated.map(e => e.id)));
  };

  const handleRunPayroll = async () => {
    if (calculated.length === 0) return;
    setRunning(true);
    try {
      const runData = {
        month, year,
        total_employees: totals.employees,
        total_gross: totals.gross,
        total_deductions: totals.deductions,
        total_net: totals.net,
        created_by: profile?.id || null,
      };
      const items = calculated.map(e => ({
        employee_id: e.id,
        employee_name: (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar,
        department: e.department,
        base_salary: e.baseSalary,
        allowances: e.allowances,
        tax: e.tax,
        social_insurance: e.socialInsurance,
        late_deduction: e.lateDeduction,
        absent_deduction: e.absentDeduction,
        overtime_bonus: e.overtimeBonus,
        loan_deduction: e.loanDeduction,
        other_additions: e.otherAdditions,
        other_deductions: e.otherDeductions,
        adjustment_ids: e.adjustmentIds || [],
        total_deductions: e.totalDeductions,
        net_salary: e.netSalary,
        present_days: e.stats.presentDays,
        absent_days: e.stats.absentDays,
        late_minutes: e.stats.totalLateMinutes,
        overtime_minutes: e.stats.totalOvertimeMinutes,
        absent_from_leave: e.absentFromLeave || 0,
      }));
      await savePayrollRun(runData, items);
      toast.success(isRTL ? `تم تشغيل ${MONTHS_AR[month - 1]} (${calculated.length} موظف)` : `Payroll for ${MONTHS_AR[month - 1]} run (${calculated.length} employees)`);
      await loadAll();
    } catch (err) {
      const msg = err?.code === 'PAYROLL_LOCKED'
        ? (isRTL ? 'الشهر مقفل. افتحه أولاً' : 'Locked. Unlock first')
        : (isRTL ? 'فشل تشغيل المسير' : 'Run failed');
      toast.error(msg);
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleLock = async () => {
    if (!run?.id) {
      toast.error(isRTL ? 'شغّل المرتبات أولاً' : 'Run payroll first');
      return;
    }
    try {
      const updated = await lockPayrollRun(run.id, profile?.id);
      setRun(updated);
      toast.success(isRTL ? 'تم قفل المسير' : 'Locked');
    } catch (err) {
      toast.error(isRTL ? 'فشل القفل' : 'Lock failed');
      if (import.meta.env.DEV) console.error(err);
    }
  };

  const handleUnlock = async () => {
    if (!run?.id) return;
    try {
      const updated = await unlockPayrollRun(run.id);
      setRun(updated);
      toast.success(isRTL ? 'تم فتح المسير' : 'Unlocked');
    } catch (err) {
      toast.error(isRTL ? 'فشل الفتح' : 'Unlock failed');
    }
  };

  if (loading) return <PageSkeleton hasKpis kpiCount={4} tableRows={6} />;

  const monthName = `${MONTHS_AR[month - 1]} ${year}`;

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Select value={month} onChange={e => { setMonth(+e.target.value); setApprovedIds(new Set()); }}>
            {MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </Select>
          <span className="text-sm text-content-muted dark:text-content-muted-dark">{year}</span>
          {isLocked && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-brand-500/15 text-brand-500 border border-brand-500/30">
              <Lock size={11} />
              {isRTL ? 'مُقفل' : 'Locked'}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="secondary" size="md" onClick={loadAll}>
            <RefreshCw size={14} />
            {isRTL ? 'تحديث' : 'Refresh'}
          </Button>
          {!isLocked && (
            <Button size="md" onClick={handleRunPayroll} disabled={running || calculated.length === 0}>
              <Play size={14} />
              {running ? (isRTL ? 'جاري...' : 'Running...') : run ? (isRTL ? 'إعادة تشغيل' : 'Re-run') : (isRTL ? 'تشغيل المسير' : 'Run Payroll')}
            </Button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard icon={DollarSign} label={isRTL ? 'موظفين' : 'Employees'} value={totals.employees} color="#1B3347" />
        <KpiCard icon={DollarSign} label={isRTL ? 'إجمالي' : 'Gross'} value={`${Math.round(totals.gross / 1000)}k`} sub={isRTL ? 'ج.م' : 'EGP'} color="#4A7AAB" />
        <KpiCard icon={Minus} label={isRTL ? 'خصومات' : 'Deductions'} value={`${Math.round(totals.deductions / 1000)}k`} sub={isRTL ? 'ج.م' : 'EGP'} color="#EF4444" />
        <KpiCard icon={CheckCircle2} label={isRTL ? 'صافي' : 'Net'} value={`${Math.round(totals.net / 1000)}k`} sub={isRTL ? 'ج.م' : 'EGP'} color="#10B981" />
      </div>

      {/* Progress + actions */}
      <Card className="p-4">
        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? `موافقة: ${totals.approved}/${totals.employees}` : `Approved: ${totals.approved}/${totals.employees}`}
            </p>
            <div className="w-48 h-1.5 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: totals.employees ? `${(totals.approved / totals.employees) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {!isLocked && (
              <>
                <Button variant="secondary" size="sm" onClick={approveAll} disabled={!run}>
                  <CheckCircle2 size={13} />
                  {isRTL ? 'موافقة على الكل' : 'Approve All'}
                </Button>
                <Button size="sm" onClick={handleLock} disabled={!run || !allApproved}>
                  <Lock size={13} />
                  {isRTL ? 'قفل الشهر' : 'Lock Month'}
                </Button>
              </>
            )}
            {isLocked && profile?.role === 'admin' && (
              <Button variant="secondary" size="sm" onClick={handleUnlock}>
                <Lock size={13} />
                {isRTL ? 'فتح للتعديل' : 'Unlock'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Employee cards */}
      <div className="space-y-2">
        {calculated.length === 0 && (
          <Card className="p-8 text-center">
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'لا يوجد موظفين نشطين' : 'No active employees'}
            </p>
          </Card>
        )}
        {calculated.map(e => (
          <EmployeeCard
            key={e.id}
            emp={e}
            expanded={expandedId === e.id}
            approved={approvedIds.has(e.id)}
            locked={isLocked}
            onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
            onApprove={() => toggleApproved(e.id)}
            onAdjust={() => setAdjModal(e)}
            onBreakdown={() => setBreakdownEmp(e)}
            onPrint={() => printPayslip(e, e, { month, year }, lang)}
            isRTL={isRTL}
            lang={lang}
          />
        ))}
      </div>

      {/* Modals */}
      {breakdownEmp && (
        <PayrollBreakdownModal
          emp={breakdownEmp}
          config={config}
          month={month}
          year={year}
          isRTL={isRTL}
          lang={lang}
          onClose={() => setBreakdownEmp(null)}
        />
      )}

      {adjModal && (
        <QuickAdjustmentModal
          emp={adjModal}
          month={month}
          year={year}
          onClose={() => setAdjModal(null)}
          onSaved={async () => { setAdjModal(null); await loadAll(); }}
          isRTL={isRTL}
          lang={lang}
        />
      )}
    </div>
  );
}

/* ─── Employee Card ───────────────────────────────────────────── */
function EmployeeCard({ emp, expanded, approved, locked, onToggle, onApprove, onAdjust, onBreakdown, onPrint, isRTL, lang }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '—';
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const ChevronIcon = expanded ? ChevronDown : (isRTL ? ChevronDown : ChevronRight);

  return (
    <Card className={`overflow-hidden transition-all ${approved ? 'border-green-500/40 bg-green-500/5' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-500/5 transition-colors ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
      >
        <ChevronIcon size={16} className="text-content-muted shrink-0" />
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white">{initials}</span>
        </div>
        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">{name}</p>
          <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
            {emp.stats.presentDays} {isRTL ? 'يوم' : 'd'} · {emp.stats.totalLateMinutes}m {isRTL ? 'تأخير' : 'late'} · {emp.stats.absentDays} {isRTL ? 'غياب' : 'abs'}
            {emp.totalEarlyMinutes > 0 && ` · ${emp.totalEarlyMinutes}m ${isRTL ? 'بدري' : 'early'}`}
          </p>
        </div>
        <div className={`hidden md:flex items-center gap-3 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{emp.baseSalary.toLocaleString()}</span>
          <span className="text-[10px] text-red-500">-{emp.totalDeductions.toLocaleString()}</span>
        </div>
        <div className="text-base font-extrabold text-brand-500 tabular-nums shrink-0">
          {emp.netSalary.toLocaleString()}
          <span className="text-[10px] font-normal text-content-muted ms-1">{isRTL ? 'ج.م' : 'EGP'}</span>
        </div>
        <div onClick={(ev) => { ev.stopPropagation(); onApprove(); }} className="shrink-0">
          <input
            type="checkbox"
            checked={approved}
            disabled={locked}
            onChange={() => {}}
            onClick={(ev) => ev.stopPropagation()}
            className="w-5 h-5 rounded border-edge cursor-pointer accent-green-500"
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-edge dark:border-edge-dark bg-surface-bg/40 dark:bg-surface-bg-dark/40">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <BreakdownStat label={isRTL ? 'الأساسي' : 'Base'} value={emp.baseSalary} positive />
            {emp.allowances > 0 && <BreakdownStat label={isRTL ? 'بدلات' : 'Allowances'} value={emp.allowances} positive />}
            {emp.lateDeduction > 0 && <BreakdownStat label={isRTL ? 'تأخير' : 'Late'} value={-emp.lateDeduction} />}
            {emp.absentDeduction > 0 && <BreakdownStat label={isRTL ? 'غياب' : 'Absence'} value={-emp.absentDeduction} />}
            {emp.earlyLeaveDeduction > 0 && <BreakdownStat label={isRTL ? 'خروج بدري' : 'Early Leave'} value={-emp.earlyLeaveDeduction} />}
            {emp.loanDeduction > 0 && <BreakdownStat label={isRTL ? 'قسط قرض' : 'Loan'} value={-emp.loanDeduction} />}
            {emp.otherAdditions > 0 && <BreakdownStat label={isRTL ? 'بونص' : 'Bonus'} value={emp.otherAdditions} positive />}
            {emp.tax > 0 && <BreakdownStat label={isRTL ? 'ضريبة' : 'Tax'} value={-emp.tax} />}
            {emp.socialInsurance > 0 && <BreakdownStat label={isRTL ? 'تأمين' : 'Insurance'} value={-emp.socialInsurance} />}
          </div>

          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button size="sm" variant="secondary" onClick={onBreakdown}>
              <Eye size={12} />
              {isRTL ? 'تفاصيل كاملة' : 'Full Details'}
            </Button>
            {!locked && (
              <Button size="sm" variant="secondary" onClick={onAdjust}>
                <Plus size={12} />
                {isRTL ? 'بونص / خصم' : 'Adjust'}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onPrint}>
              <Printer size={12} />
              {isRTL ? 'طباعة' : 'Print'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function BreakdownStat({ label, value, positive }) {
  const isNeg = value < 0;
  return (
    <div className="px-2 py-1.5 rounded-lg bg-surface-card dark:bg-surface-card-dark border border-edge/40 dark:border-edge-dark/40">
      <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{label}</p>
      <p className={`m-0 text-sm font-bold tabular-nums ${isNeg ? 'text-red-600' : positive ? 'text-content dark:text-content-dark' : 'text-green-600'}`}>
        {isNeg ? '-' : positive ? '' : '+'}{Math.abs(value).toLocaleString()}
      </p>
    </div>
  );
}

/* ─── Quick Adjustment Modal ──────────────────────────────────── */
function QuickAdjustmentModal({ emp, month, year, onClose, onSaved, isRTL, lang }) {
  const toast = useToast();
  const [type, setType] = useState('bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error(isRTL ? 'أدخل مبلغ صحيح' : 'Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('payroll_adjustments').insert({
        employee_id: emp.id,
        type,
        amount: Number(amount),
        reason: reason || null,
        month, year,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      onSaved();
    } catch (err) {
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const empName = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;

  return (
    <Modal open={true} onClose={onClose} title={isRTL ? `بونص / خصم — ${empName}` : `Adjustment — ${empName}`}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النوع' : 'Type'}</label>
          <Select value={type} onChange={e => setType(e.target.value)}>
            <option value="bonus">{isRTL ? 'بونص' : 'Bonus'}</option>
            <option value="commission">{isRTL ? 'عمولة' : 'Commission'}</option>
            <option value="addition">{isRTL ? 'إضافة' : 'Addition'}</option>
            <option value="deduction">{isRTL ? 'خصم' : 'Deduction'}</option>
            <option value="penalty">{isRTL ? 'عقوبة' : 'Penalty'}</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المبلغ' : 'Amount'}</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'السبب' : 'Reason'}</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            placeholder={isRTL ? 'مثلاً: بونص عيد' : 'e.g. Eid bonus'}
          />
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={submit} disabled={saving || !amount}>
          {saving ? (isRTL ? 'جاري...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
