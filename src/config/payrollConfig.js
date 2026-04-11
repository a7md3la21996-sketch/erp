import supabase from '../lib/supabase';

// ── Default Payroll Configuration ────────────────────────────
// Supports multiple shifts, per-employee overrides, and configurable rates

export const DEFAULT_PAYROLL_CONFIG = {
  // Global rates (can be overridden per employee)
  tax_rate: 0,
  social_insurance_rate: 0,
  allowance_rate: 0.20,

  // Late penalty
  late_penalty_multiplier: 2, // each late minute = 2 minutes deduction

  // Deduction per minute (EGP) — calculated from salary if 0
  late_deduction_per_minute: 0,

  // Shifts
  shifts: {
    'فترة الدوام1': {
      name_ar: 'فترة الدوام 1',
      name_en: 'Shift 1',
      official_start: '10:00',
      official_end: '18:00',
      late_threshold: '10:30',
      working_days: [0, 1, 2, 3, 4, 6], // 0=Sun..6=Sat — Friday(5) off
    },
    'فترة الدوام2': {
      name_ar: 'فترة الدوام 2',
      name_en: 'Shift 2',
      official_start: '10:30',
      official_end: '18:30',
      late_threshold: '11:00',
      working_days: [0, 1, 2, 3, 4, 6],
    },
  },

  // Default shift for employees without one
  default_shift: 'فترة الدوام1',
};

// ── Load config from Supabase ────────────────────────────────

let _cachedConfig = null;

export async function loadPayrollConfig() {
  if (_cachedConfig) return _cachedConfig;
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'payroll_config')
      .single();
    if (error || !data?.value) throw error;
    _cachedConfig = { ...DEFAULT_PAYROLL_CONFIG, ...data.value };
    return _cachedConfig;
  } catch {
    _cachedConfig = { ...DEFAULT_PAYROLL_CONFIG };
    return _cachedConfig;
  }
}

// ── Save config to Supabase ──────────────────────────────────

export async function savePayrollConfig(config) {
  _cachedConfig = { ...config };
  try {
    const { error } = await supabase
      .from('system_config')
      .upsert(
        { key: 'payroll_config', value: config, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to save payroll config:', err);
    return false;
  }
}

// ── Fetch salary history for an employee ─────────────────────

export async function fetchSalaryHistory(employeeId) {
  try {
    const { data, error } = await supabase
      .from('salary_history')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// ── Calculate pro-rated salary for a month ───────────────────
// If salary changed mid-month, calculates weighted average

export function calcProRatedSalary(salaryHistory, month, year, currentSalary) {
  if (!salaryHistory || salaryHistory.length === 0) return currentSalary || 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

  // Get salary changes relevant to this month
  // Sort by effective_date ascending
  const sorted = [...salaryHistory].sort((a, b) => a.effective_date.localeCompare(b.effective_date));

  // Find what salary was active at month start
  let activeSalary = 0;
  for (const rec of sorted) {
    if (rec.effective_date <= monthStart) {
      activeSalary = Number(rec.salary);
    }
  }

  // Get changes within this month
  const midMonthChanges = sorted.filter(r => r.effective_date > monthStart && r.effective_date <= monthEnd);

  if (midMonthChanges.length === 0) {
    // No changes during the month — use the active salary
    return activeSalary || currentSalary || 0;
  }

  // Pro-rate: calculate weighted average
  let totalWeighted = 0;
  let prevDay = 1;
  let prevSalary = activeSalary;

  for (const change of midMonthChanges) {
    const changeDay = parseInt(change.effective_date.split('-')[2]);
    const daysAtPrev = changeDay - prevDay;
    totalWeighted += prevSalary * daysAtPrev;
    prevDay = changeDay;
    prevSalary = Number(change.salary);
  }

  // Remaining days at last salary
  totalWeighted += prevSalary * (daysInMonth - prevDay + 1);

  return Math.round(totalWeighted / daysInMonth);
}

// ── Helper: parse "HH:MM" to minutes since midnight ─────────

export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

// ── Attendance Status Types ──────────────────────────────────

export const ATTENDANCE_STATUSES = [
  { value: 'present', ar: 'حاضر', en: 'Present', deduction: 0 },
  { value: 'absent_no_notice', ar: 'غياب بدون إذن', en: 'Absent (No Notice)', deduction: 2 },
  { value: 'absent_prior_notice', ar: 'غياب بإذن', en: 'Absent (Prior Notice)', deduction: 1 },
  { value: 'annual_leave', ar: 'إجازة سنوية', en: 'Annual Leave', deduction: 0, fromBalance: true },
  { value: 'sick_leave', ar: 'إجازة مرضية', en: 'Sick Leave', deduction: 0, fromBalance: true },
  { value: 'marriage_leave', ar: 'إجازة زواج', en: 'Marriage Leave', deduction: 0, fromBalance: true },
  { value: 'maternity_leave', ar: 'إجازة أمومة', en: 'Maternity Leave', deduction: 0, fromBalance: true },
  { value: 'unpaid_leave', ar: 'إجازة بدون مرتب', en: 'Unpaid Leave', deduction: 1 },
  { value: 'exception', ar: 'استثناء', en: 'Exception', deduction: 0 },
  { value: 'remote', ar: 'من البيت', en: 'Remote', deduction: 0 },
  { value: 'field_work', ar: 'عمل ميداني', en: 'Field Work', deduction: 0 },
  { value: 'resigned', ar: 'مستقيل', en: 'Resigned', deduction: 0, skipDay: true },
  // Legacy statuses
  { value: 'present', ar: 'حاضر', en: 'Present', deduction: 0 },
  { value: 'absent', ar: 'غائب', en: 'Absent', deduction: 2 },
  { value: 'late', ar: 'متأخر', en: 'Late', deduction: 0 },
  { value: 'leave', ar: 'إجازة', en: 'Leave', deduction: 0, fromBalance: true },
];

export function getStatusConfig(status) {
  return ATTENDANCE_STATUSES.find(s => s.value === status) || { deduction: 0 };
}

// ── Calculate attendance stats for one employee in a month ───

export function calcEmployeeAttendance(records, shiftConfig, options = {}) {
  if (!shiftConfig) shiftConfig = DEFAULT_PAYROLL_CONFIG.shifts['فترة الدوام1'];

  const lateThreshold = timeToMinutes(shiftConfig.late_threshold || shiftConfig.official_start);
  const officialStart = timeToMinutes(shiftConfig.official_start);
  const officialEnd = timeToMinutes(shiftConfig.official_end);
  const officialHours = officialEnd - officialStart;
  const breakMinutes = shiftConfig.break_minutes || 0;
  const requiredMinutes = (shiftConfig.required_hours || (officialHours / 60)) * 60 - breakMinutes;

  const { holidayDates, month, year, workingDays } = options;
  const shiftWorkingDays = workingDays || shiftConfig.working_days || [0,1,2,3,4,6];

  let presentDays = 0;
  let absentNoNoticeDays = 0;
  let absentPriorNoticeDays = 0;
  let leaveDays = 0;
  let unpaidLeaveDays = 0;
  let exceptionDays = 0;
  let remoteDays = 0;
  let fieldWorkDays = 0;
  let holidayDaysOff = 0;
  let totalLateMinutes = 0;
  let totalLateMinutesInTolerance = 0;
  let totalLateMinutesBeyond = 0;
  let totalOvertimeMinutes = 0;
  let totalWorkedMinutes = 0;
  let totalDeficitMinutes = 0;

  const presentDatesSet = new Set();
  const statusByDate = {};

  // Process attendance records
  for (const rec of records) {
    if (rec.date) statusByDate[rec.date] = rec.status;
    const status = rec.status || 'present';
    const statusCfg = getStatusConfig(status);

    // Non-present statuses
    if (['annual_leave', 'sick_leave', 'marriage_leave', 'maternity_leave', 'leave'].includes(status)) {
      leaveDays++;
      if (rec.date) presentDatesSet.add(rec.date); // Don't count as absent
      continue;
    }
    if (status === 'unpaid_leave') { unpaidLeaveDays++; if (rec.date) presentDatesSet.add(rec.date); continue; }
    if (status === 'exception') { exceptionDays++; if (rec.date) presentDatesSet.add(rec.date); continue; }
    if (status === 'remote') { remoteDays++; if (rec.date) presentDatesSet.add(rec.date); continue; }
    if (status === 'field_work') { fieldWorkDays++; if (rec.date) presentDatesSet.add(rec.date); continue; }
    if (status === 'resigned') { if (rec.date) presentDatesSet.add(rec.date); continue; }
    if (status === 'absent_no_notice') { absentNoNoticeDays++; if (rec.date) presentDatesSet.add(rec.date); continue; }
    if (status === 'absent_prior_notice' || status === 'absent') { absentPriorNoticeDays++; if (rec.date) presentDatesSet.add(rec.date); continue; }

    const checkIn = timeToMinutes(rec.check_in);
    const checkOut = timeToMinutes(rec.check_out);

    if (checkIn == null && checkOut == null) continue;

    presentDays++;
    if (rec.date) presentDatesSet.add(rec.date);

    if (checkIn != null && checkOut != null) {
      const worked = Math.max(0, checkOut - checkIn - breakMinutes);
      totalWorkedMinutes += worked;

      // Late calculation — tiered
      if (checkIn > lateThreshold) {
        const lateMin = checkIn - lateThreshold;
        // Within tolerance (grace hours handled in PayrollPage)
        totalLateMinutes += lateMin;
      }

      // Incomplete hours (deficit)
      if (worked < requiredMinutes) {
        totalDeficitMinutes += requiredMinutes - worked;
      }

      // Overtime
      if (checkOut > officialEnd) {
        totalOvertimeMinutes += checkOut - officialEnd;
      }
    }
  }

  // Calculate unrecorded absent days
  if (month && year) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();

      if (!shiftWorkingDays.includes(dayOfWeek)) continue;

      if (holidayDates && holidayDates.has(dateStr)) {
        holidayDaysOff++;
        continue;
      }

      // Days with no record at all = absent without notice
      if (!presentDatesSet.has(dateStr)) {
        absentNoNoticeDays++;
      }
    }
  }

  return {
    presentDays,
    absentNoNoticeDays,
    absentPriorNoticeDays,
    absentDays: absentNoNoticeDays + absentPriorNoticeDays, // total for backward compat
    leaveDays,
    unpaidLeaveDays,
    exceptionDays,
    remoteDays,
    fieldWorkDays,
    holidayDaysOff,
    totalLateMinutes,
    totalDeficitMinutes,
    totalOvertimeMinutes,
    totalWorkedMinutes,
    totalWorkedHours: Math.round(totalWorkedMinutes / 60 * 10) / 10,
    officialHoursPerDay: (officialHours - breakMinutes) / 60,
    requiredMinutesPerDay: requiredMinutes,
  };
}
