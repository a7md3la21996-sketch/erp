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

// ── Calculate attendance stats for one employee in a month ───

export function calcEmployeeAttendance(records, shiftConfig, options = {}) {
  if (!shiftConfig) shiftConfig = DEFAULT_PAYROLL_CONFIG.shifts['فترة الدوام1'];

  const lateThreshold = timeToMinutes(shiftConfig.late_threshold || shiftConfig.official_start);
  const officialStart = timeToMinutes(shiftConfig.official_start);
  const officialEnd = timeToMinutes(shiftConfig.official_end);
  const officialHours = officialEnd - officialStart;
  const breakMinutes = shiftConfig.break_minutes || 0;

  const { holidayDates, month, year, workingDays } = options;
  const shiftWorkingDays = workingDays || shiftConfig.working_days || [0,1,2,3,4,6];

  let presentDays = 0;
  let absentDays = 0;
  let holidayDaysOff = 0;
  let totalLateMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalWorkedMinutes = 0;

  // Build set of dates employee was present
  const presentDatesSet = new Set();

  for (const rec of records) {
    const checkIn = timeToMinutes(rec.check_in);
    const checkOut = timeToMinutes(rec.check_out);

    if (checkIn == null && checkOut == null) {
      if (rec.absent) absentDays++;
      continue;
    }

    presentDays++;
    if (rec.date) presentDatesSet.add(rec.date);

    if (checkIn != null && checkOut != null) {
      const worked = Math.max(0, checkOut - checkIn - breakMinutes);
      totalWorkedMinutes += worked;

      if (checkIn > lateThreshold) {
        totalLateMinutes += checkIn - lateThreshold;
      }

      if (checkOut > officialEnd) {
        totalOvertimeMinutes += checkOut - officialEnd;
      }
    }
  }

  // Calculate absent days: working days in month - present days - holidays
  if (month && year) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();

      // Skip non-working days
      if (!shiftWorkingDays.includes(dayOfWeek)) continue;

      // Skip holidays
      if (holidayDates && holidayDates.has(dateStr)) {
        holidayDaysOff++;
        continue;
      }

      // If not present and not already counted as absent from records
      if (!presentDatesSet.has(dateStr)) {
        absentDays++;
      }
    }
    // Reset absentDays to calculated value (override the one from records)
    // absentDays is already calculated above
  }

  return {
    presentDays,
    absentDays,
    holidayDaysOff,
    totalLateMinutes,
    totalOvertimeMinutes,
    totalWorkedMinutes,
    totalWorkedHours: Math.round(totalWorkedMinutes / 60 * 10) / 10,
    officialHoursPerDay: (officialHours - breakMinutes) / 60,
  };
}
