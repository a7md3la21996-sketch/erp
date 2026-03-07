/**
 * attendanceStore.js
 * Single source of truth للحضور — بيشاركه AttendancePage و PayrollPage
 * استخدام: import { useAttendanceStore } from '../../data/attendanceStore'
 */

import { useState, useCallback } from 'react';
import { MOCK_EMPLOYEES, MOCK_HR_POLICIES } from './hr_mock_data';

// ── Helpers ────────────────────────────────────────────────────
function getPol(key) {
  const p = MOCK_HR_POLICIES.find(p => p.key === key);
  return p ? p.value : null;
}

const LATE_THRESH  = getPol('late_threshold_time') || '10:30';
const WORK_HOURS   = parseFloat(getPol('work_hours_normal')) || 8;

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcOTHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const worked   = timeToMinutes(checkOut) - timeToMinutes(checkIn);
  const expected = WORK_HOURS * 60;
  return Math.max(0, Math.round((worked - expected) / 60 * 10) / 10);
}

// ── Generate deterministic mock data (no Math.random — seed-based) ─
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generateMockMonth(employees, year, month) {
  const records = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const workModes   = ['normal', 'normal', 'normal', 'remote', 'field', 'normal', 'normal'];

  employees.forEach((emp, empIdx) => {
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow  = date.getDay();
      if (dow === 5 || dow === 6) continue;

      const seed = empIdx * 1000 + d;
      const mode = workModes[d % 7];
      let checkIn = null, checkOut = null, absent = false, absentNotice = false;

      if (mode === 'normal') {
        const rand = seededRand(seed);
        if (rand < 0.05) {
          absent      = true;
          absentNotice = seededRand(seed + 500) > 0.5;
        } else {
          const lateMin = Math.floor(seededRand(seed + 100) * 55);
          checkIn  = `10:${String(lateMin).padStart(2,'0')}`;
          const outH = 18 + Math.floor(seededRand(seed + 200) * 2);
          const outM = Math.floor(seededRand(seed + 300) * 60);
          checkOut = `${String(outH).padStart(2,'0')}:${String(outM).padStart(2,'0')}`;
        }
      }

      records.push({
        id: `${emp.id}-${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
        employee_id:       emp.id,
        date:              `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
        work_mode:         mode,
        check_in:          checkIn,
        check_out:         checkOut,
        absent,
        absent_with_notice: absentNotice,
        ot_hours:          checkIn && checkOut ? calcOTHours(checkIn, checkOut) : 0,
        note:              '',
        source:            seededRand(seed + 700) > 0.7 ? 'fingerprint' : 'manual',
      });
    }
  });
  return records;
}

// ── In-memory store (singleton) ────────────────────────────────
// خزّن بيانات الشهور اللي اتفتحت عشان مش نعيد generate كل مرة
const _cache = {};

export function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2,'0')}`;
}

export function getAttendanceForMonth(year, month) {
  const key = getMonthKey(year, month);
  if (!_cache[key]) {
    _cache[key] = generateMockMonth(MOCK_EMPLOYEES, year, month);
  }
  return _cache[key];
}

export function updateAttendanceRecord(year, month, updatedRecord) {
  const key = getMonthKey(year, month);
  if (!_cache[key]) {
    _cache[key] = generateMockMonth(MOCK_EMPLOYEES, year, month);
  }
  const idx = _cache[key].findIndex(r => r.id === updatedRecord.id);
  if (idx >= 0) {
    _cache[key][idx] = updatedRecord;
  } else {
    _cache[key].push(updatedRecord);
  }
}

export function addAttendanceRecord(year, month, record) {
  const key = getMonthKey(year, month);
  if (!_cache[key]) {
    _cache[key] = generateMockMonth(MOCK_EMPLOYEES, year, month);
  }
  const existing = _cache[key].findIndex(r => r.id === record.id);
  if (existing >= 0) {
    _cache[key][existing] = record;
  } else {
    _cache[key].push(record);
  }
}

// ── Payroll Calculator — uses real attendance ──────────────────
export function calcPayrollFromAttendance(emp, year, month) {
  const records  = getAttendanceForMonth(year, month);
  const empRecs  = records.filter(r => r.employee_id === emp.id);

  const toleranceCap = emp.tolerance_hours
    || parseFloat(getPol('tolerance_hours_monthly'))
    || 4;

  const hourlyRate = emp.base_salary / (parseFloat(getPol('hourly_rate_divisor')) || 240);
  const dailyRate  = emp.base_salary / (parseFloat(getPol('work_days_per_month')) || 30);
  const lateThreshMins = timeToMinutes(LATE_THRESH);

  let usedTolerance    = 0;
  let lateDeduction    = 0;
  let absenceDeduction = 0;
  let otEarnings       = 0;
  let presentDays      = 0;
  let absentDays       = 0;
  let lateDays         = 0;
  let otHours          = 0;
  let totalLateMinutes = 0;

  empRecs.forEach(rec => {
    if (rec.absent) {
      absentDays++;
      const mult = rec.absent_with_notice
        ? (parseFloat(getPol('absence_with_notice_mult')) || 1)
        : (parseFloat(getPol('absence_no_notice_mult'))   || 2);
      absenceDeduction += dailyRate * mult;
    } else if (rec.check_in) {
      presentDays++;
      const checkInMins = timeToMinutes(rec.check_in);
      const lateMin     = Math.max(0, checkInMins - lateThreshMins);

      if (lateMin > 0) {
        lateDays++;
        totalLateMinutes += lateMin;
        const lateH     = lateMin / 60;
        const remaining = Math.max(0, toleranceCap - usedTolerance);
        const covered   = Math.min(lateH, remaining);
        const over      = lateH - covered;
        usedTolerance  += covered;
        lateDeduction  += (covered * hourlyRate) + (over * hourlyRate * 2);
      }

      const ot = rec.ot_hours || 0;
      otHours += ot;
      const otMult = parseFloat((emp.ot_multiplier || '1x').replace('x', '')) || 1;
      otEarnings += ot * hourlyRate * otMult;
    }
    // remote/field: present, no deduction, no OT
    else if (rec.work_mode === 'remote' || rec.work_mode === 'field') {
      presentDays++;
    }
  });

  const totalDeductions = Math.round(lateDeduction + absenceDeduction);
  const netSalary       = Math.max(0, Math.round(emp.base_salary - totalDeductions + otEarnings));

  return {
    emp,
    baseSalary:       emp.base_salary,
    lateDeduction:    Math.round(lateDeduction),
    absenceDeduction: Math.round(absenceDeduction),
    otEarnings:       Math.round(otEarnings),
    totalDeductions,
    netSalary,
    presentDays,
    absentDays,
    lateDays,
    otHours:          Math.round(otHours * 10) / 10,
    totalLateMinutes: Math.round(totalLateMinutes),
    usedTolerance:    Math.round(usedTolerance * 10) / 10,
    toleranceCap,
    hourlyRate:       Math.round(hourlyRate * 100) / 100,
    dailyRate:        Math.round(dailyRate * 100) / 100,
    workingDays:      empRecs.length,
  };
}
