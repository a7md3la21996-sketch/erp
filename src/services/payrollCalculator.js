// Shared payroll calculation — extracted from PayrollPage so the Close
// page (and any future view) can reuse the same math without duplicating
// 200 lines of useMemo.
//
// Inputs are the same blocks PayrollPage already loads, so callers only
// need to fetch once and feed everything in.

import { calcEmployeeAttendance, calcProRatedSalary } from '../config/payrollConfig';
import { getActiveShift } from './employeeShiftsService';

/**
 * Calculate one employee's payroll line.
 *
 * @param {object} empRaw - row from employees table
 * @param {object} ctx - shared context for the run
 *   - month, year
 *   - attendanceByEmp: { [employee_id]: attendance[] }
 *   - configHistories: { [employee_id]: history[] }
 *   - salaryHistories: { [employee_id]: history[] }
 *   - shiftAssignments: { [employee_id]: assignment[] }
 *   - allShiftsDb, holidayDates, rulesMap, config
 *   - loans, adjustments (full arrays — filtered inside)
 */
export function calculatePayrollLine(empRaw, ctx) {
  const {
    month, year,
    attendanceByEmp = {}, configHistories = {}, salaryHistories = {}, shiftAssignments = {},
    allShiftsDb = [], holidayDates = new Set(),
    rulesMap = {}, config = {}, loans = [], adjustments = [],
  } = ctx;

  // Per-month config snapshot (handles mid-month changes via employee_config_history)
  const emp = getEmpConfigForMonth(empRaw, configHistories[empRaw.id], month, year);
  const empAttendance = attendanceByEmp[empRaw.id] || [];

  const empShiftAssignments = shiftAssignments[empRaw.id] || [];
  const midMonthDate = `${year}-${String(month).padStart(2, '0')}-15`;
  const assignedShift = getActiveShift(empShiftAssignments, midMonthDate);

  const shiftName = emp.shift_name || emp.shift || config.default_shift || 'فترة الدوام1';
  const globalShift = config.shifts?.[shiftName] || config.shifts?.['فترة الدوام1'] || Object.values(config.shifts || {})[0];
  const baseShift = assignedShift || globalShift;

  const shiftConfig = {
    ...baseShift,
    ...(emp.work_start && !assignedShift && { official_start: emp.work_start }),
    ...(emp.work_end && !assignedShift && { official_end: emp.work_end }),
    ...(emp.late_threshold && !assignedShift && { late_threshold: emp.late_threshold }),
  };

  const workMode = emp.work_mode || 'office';
  const isRemote = workMode === 'remote';
  const isFlexible = workMode === 'flexible' || workMode === 'field';

  const stats = calcEmployeeAttendance(empAttendance, shiftConfig, {
    holidayDates, month, year, allShifts: allShiftsDb, empShiftAssignments,
  });

  const empHistory = salaryHistories[empRaw.id] || [];
  const baseSalary = empHistory.length > 0
    ? calcProRatedSalary(empHistory, month, year, emp.salary)
    : (emp.salary || emp.base_salary || 0);

  const dailyRate = baseSalary / 30;
  const hoursPerDay = shiftConfig
    ? (parseInt(shiftConfig.official_end) || 18) - (parseInt(shiftConfig.official_start) || 10)
    : 8;
  const minuteRate = baseSalary / (30 * hoursPerDay * 60);

  const R = rulesMap;
  const defaultGrace = R.default_grace_minutes || 0;
  const graceMinutes = isFlexible
    ? Math.max((emp.monthly_grace_hours || 4) * 60, 240)
    : (emp.grace_hours_enabled ? (emp.monthly_grace_hours || 0) * 60 : defaultGrace);

  const lateMultiplier = R.late_multiplier || 2;
  let lateDeduction = 0;
  let effectiveLateMinutes = 0;
  if (!isRemote && stats.totalLateMinutes > 0) {
    effectiveLateMinutes = Math.max(0, stats.totalLateMinutes - graceMinutes);
    lateDeduction = Math.round(effectiveLateMinutes * lateMultiplier * minuteRate);
  }

  const absentNoNoticeX = R.absent_no_notice_multiplier || 2;
  const absentPriorX = R.absent_prior_notice_multiplier || 1;
  const unpaidLeaveX = R.unpaid_leave_multiplier || 1;
  let absentDeduction = 0;
  const absentFromLeave = stats.leaveDays;
  if (!isRemote) {
    absentDeduction = Math.round(
      (stats.absentNoNoticeDays * absentNoNoticeX * dailyRate) +
      (stats.absentPriorNoticeDays * absentPriorX * dailyRate) +
      (stats.unpaidLeaveDays * unpaidLeaveX * dailyRate)
    );
  }

  const halfDayX = R.single_punch_multiplier || 0.5;
  const halfDayDeduction = isRemote ? 0 : Math.round(stats.halfDayDeductions * dailyRate * halfDayX);

  const defaultAllowanceRate = (R.default_allowance_rate || 20) / 100;
  const empAllowanceRate = emp.allowance_rate != null ? emp.allowance_rate / 100 : null;
  const allowances = emp.allowance_fixed
    ? Math.round(Number(emp.allowance_fixed))
    : Math.round(baseSalary * (empAllowanceRate ?? defaultAllowanceRate));

  const defaultTaxRate = (R.default_tax_rate || 0) / 100;
  const defaultInsRate = (R.default_insurance_rate || 0) / 100;
  const tax = emp.tax_exempt ? 0
    : Math.round(baseSalary * ((emp.tax_rate != null ? emp.tax_rate / 100 : null) ?? defaultTaxRate));
  const socialInsurance = emp.insurance_exempt ? 0
    : Math.round(baseSalary * ((emp.insurance_rate != null ? emp.insurance_rate / 100 : null) ?? defaultInsRate));

  const empLoans = loans.filter(l => l.employee_id === empRaw.id);
  const loanDeduction = empLoans.reduce((s, l) => s + (Number(l.monthly_deduction) || 0), 0);

  const empAdj = adjustments.filter(a => a.employee_id === empRaw.id);
  const otherAdditionsBase = empAdj.filter(a => a.type === 'addition' || a.type === 'bonus' || a.type === 'commission').reduce((s, a) => s + Number(a.amount), 0);
  const otherDeductionsBase = empAdj.filter(a => a.type === 'deduction' || a.type === 'penalty').reduce((s, a) => s + Number(a.amount), 0);
  const adjustmentIds = empAdj.map(a => a.id).filter(Boolean);

  const defaultOTRate = R.default_overtime_rate || 1.5;
  const overtimeBonus = emp.overtime_enabled
    ? Math.round(stats.totalOvertimeMinutes * minuteRate * (emp.overtime_rate || defaultOTRate))
    : 0;

  // Auto early-leave deduction (mirrors PayrollPage)
  let earlyLeaveDeduction = 0;
  let totalEarlyMinutes = 0;
  const earlyEnabled = R.early_leave_enabled !== 0 && !emp.early_leave_exempt;
  if (earlyEnabled && !isRemote) {
    const earlyGrace = Number(R.early_leave_grace_minutes ?? 5);
    const earlyMult = Number(R.early_leave_multiplier ?? 1);
    const shiftEndStr = shiftConfig?.official_end || emp.work_end || '18:00';
    const [endH, endM] = String(shiftEndStr).split(':').map(Number);
    const endTotalMin = (endH || 0) * 60 + (endM || 0);
    for (const a of empAttendance) {
      if (!a.check_out || a.status === 'absent' || a.status === 'leave') continue;
      const [oh, om] = String(a.check_out).split(':').map(Number);
      if (isNaN(oh)) continue;
      const outMin = oh * 60 + (om || 0);
      const earlyBy = endTotalMin - outMin;
      if (earlyBy > earlyGrace) totalEarlyMinutes += earlyBy;
    }
    earlyLeaveDeduction = Math.round(totalEarlyMinutes * minuteRate * earlyMult);
  }

  const otherDeductions = otherDeductionsBase + earlyLeaveDeduction;
  const otherAdditions = otherAdditionsBase;

  const gross = baseSalary + allowances + overtimeBonus + otherAdditions;
  const rawDeductions = tax + socialInsurance + lateDeduction + absentDeduction + halfDayDeduction + loanDeduction + otherDeductions;
  const maxDeductionPercent = (R.max_deduction_percent || 70) / 100;
  const totalDeductions = Math.min(rawDeductions, Math.round(gross * maxDeductionPercent));
  const netSalary = Math.max(0, gross - totalDeductions);

  return {
    ...empRaw,
    ...emp,
    id: empRaw.id,
    stats,
    baseSalary,
    allowances,
    tax,
    socialInsurance,
    lateDeduction,
    absentDeduction,
    absentFromLeave,
    overtimeBonus,
    loanDeduction,
    otherAdditions,
    otherDeductions,
    earlyLeaveDeduction,
    totalEarlyMinutes,
    adjustmentIds,
    totalDeductions,
    netSalary,
    halfDayDeduction,
    effectiveLateMinutes,
    graceMinutes,
    hasAttendance: empAttendance.length > 0,
  };
}

function getEmpConfigForMonth(emp, history, m, y) {
  if (!history || history.length === 0) return emp;
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
  let activeConfig = null;
  for (const h of history) {
    if (h.effective_date <= monthEnd) activeConfig = h.config;
  }
  return activeConfig ? { ...emp, ...activeConfig } : emp;
}

// Group attendance rows by employee_id (cheap helper)
export function groupAttendanceByEmp(attendance) {
  const grouped = {};
  for (const r of attendance) {
    if (!grouped[r.employee_id]) grouped[r.employee_id] = [];
    grouped[r.employee_id].push(r);
  }
  return grouped;
}
