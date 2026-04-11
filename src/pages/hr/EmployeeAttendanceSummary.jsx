import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { fetchAttendance } from '../../services/attendanceService';
import { fetchHolidays } from '../../services/holidaysService';
import { Clock, ArrowLeft, Printer, CheckCircle2, XCircle, Calendar, AlertCircle, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Th, Td, Tr, Select, PageSkeleton, ExportButton } from '../../components/ui';
import supabase from '../../lib/supabase';

// ── Status config ───────────────────────────────────────────
const STATUS_MAP = {
  present:            { ar: 'حاضر',          en: 'Present',        cls: 'bg-green-500/15 text-green-600',  rowCls: 'bg-green-500/5' },
  absent_no_notice:   { ar: 'غياب بدون إذن', en: 'No Notice',      cls: 'bg-red-500/15 text-red-500',      rowCls: 'bg-red-500/5' },
  absent_prior_notice:{ ar: 'غياب بإذن',     en: 'With Notice',    cls: 'bg-orange-500/15 text-orange-600', rowCls: 'bg-orange-500/5' },
  absent:             { ar: 'غائب',          en: 'Absent',         cls: 'bg-red-500/15 text-red-500',      rowCls: 'bg-red-500/5' },
  annual_leave:       { ar: 'إجازة سنوية',   en: 'Annual Leave',   cls: 'bg-blue-500/15 text-blue-600',    rowCls: 'bg-blue-500/5' },
  sick_leave:         { ar: 'مرضية',         en: 'Sick Leave',     cls: 'bg-blue-500/15 text-blue-600',    rowCls: 'bg-blue-500/5' },
  marriage_leave:     { ar: 'زواج',          en: 'Marriage Leave', cls: 'bg-blue-500/15 text-blue-600',    rowCls: 'bg-blue-500/5' },
  maternity_leave:    { ar: 'أمومة',         en: 'Maternity Leave',cls: 'bg-blue-500/15 text-blue-600',    rowCls: 'bg-blue-500/5' },
  unpaid_leave:       { ar: 'بدون مرتب',     en: 'Unpaid Leave',   cls: 'bg-purple-500/15 text-purple-600', rowCls: 'bg-purple-500/5' },
  leave:              { ar: 'إجازة',         en: 'Leave',          cls: 'bg-blue-500/15 text-blue-600',    rowCls: 'bg-blue-500/5' },
  exception:          { ar: 'استثناء',       en: 'Exception',      cls: 'bg-gray-500/15 text-gray-600',    rowCls: 'bg-gray-500/5' },
  remote:             { ar: 'من البيت',      en: 'Remote',         cls: 'bg-teal-500/15 text-teal-600',    rowCls: 'bg-teal-500/5' },
  field_work:         { ar: 'ميداني',        en: 'Field Work',     cls: 'bg-amber-500/15 text-amber-600',  rowCls: 'bg-amber-500/5' },
  resigned:           { ar: 'مستقيل',        en: 'Resigned',       cls: 'bg-gray-500/15 text-gray-500',    rowCls: 'bg-gray-500/5' },
  holiday:            { ar: 'عطلة رسمية',    en: 'Holiday',        cls: 'bg-gray-400/15 text-gray-500',    rowCls: 'bg-gray-400/10' },
  weekend:            { ar: 'عطلة أسبوعية',  en: 'Weekend',        cls: 'bg-gray-400/15 text-gray-500',    rowCls: 'bg-gray-400/10' },
};

function StatusBadge({ status, lang }) {
  const s = STATUS_MAP[status] || { ar: status, en: status, cls: 'bg-slate-500/15 text-slate-500' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>{lang === 'ar' ? s.ar : s.en}</span>;
}

// ── Day names ───────────────────────────────────────────────
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// ── Helpers ─────────────────────────────────────────────────
function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? diff / 60 : 0;
}

function calcLateMinutes(checkIn, shiftStart = '09:00') {
  if (!checkIn) return 0;
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = shiftStart.split(':').map(Number);
  const diff = (h1 * 60 + m1) - (h2 * 60 + m2);
  return diff > 0 ? diff : 0;
}

const LEAVE_STATUSES = ['annual_leave', 'sick_leave', 'marriage_leave', 'maternity_leave', 'unpaid_leave', 'leave'];

// ── Main Component ──────────────────────────────────────────
export default function EmployeeAttendanceSummary() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prevAttendance, setPrevAttendance] = useState([]);
  const [prevHolidays, setPrevHolidays] = useState([]);

  // Fetch employee data
  useEffect(() => {
    async function loadEmployee() {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*, departments(name_ar, name_en)')
          .eq('id', employeeId)
          .single();
        if (error) throw error;
        setEmployee(data);
      } catch (err) {
        console.error('Failed to load employee:', err);
        showToast(isRTL ? 'فشل تحميل بيانات الموظف' : 'Failed to load employee data', 'error');
      }
    }
    loadEmployee();
  }, [employeeId]);

  // Fetch attendance + holidays + leave balances
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Compute previous month
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        const [attData, holData, prevAttData, prevHolData] = await Promise.all([
          fetchAttendance({ month, year, employeeId }),
          fetchHolidays(year, month),
          fetchAttendance({ month: prevMonth, year: prevYear, employeeId }),
          fetchHolidays(prevYear, prevMonth),
        ]);
        setAttendance(attData);
        setHolidays(holData);
        setPrevAttendance(prevAttData);
        setPrevHolidays(prevHolData);

        // Fetch leave balances
        const { data: lb } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('year', year)
          .maybeSingle();
        setLeaveBalances(lb);
      } catch (err) {
        console.error('Failed to load attendance data:', err);
        showToast(isRTL ? 'فشل تحميل بيانات الحضور' : 'Failed to load attendance data', 'error');
      }
      setLoading(false);
    }
    loadData();
  }, [month, year, employeeId]);

  // Build daily rows for the month
  const dailyRows = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const holidayMap = {};
    holidays.forEach(h => { holidayMap[h.date] = h; });
    const attMap = {};
    attendance.forEach(a => { attMap[a.date] = a; });

    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay(); // 0=Sun
      const isFriday = dayOfWeek === 5;
      const holiday = holidayMap[dateStr];
      const rec = attMap[dateStr];

      let status = rec?.status || null;
      let holidayName = null;

      if (holiday) {
        holidayName = isRTL ? (holiday.name_ar || holiday.name) : (holiday.name_en || holiday.name);
        if (!status) status = 'holiday';
      } else if (isFriday && !status) {
        status = 'weekend';
      }

      const checkIn = rec?.check_in || null;
      const checkOut = rec?.check_out || null;
      const hours = calcHours(checkIn, checkOut);
      const late = status === 'present' || status === 'remote' || status === 'field_work' ? calcLateMinutes(checkIn) : 0;

      rows.push({
        day: d,
        dateStr,
        dayOfWeek,
        dayName: isRTL ? DAY_NAMES_AR[dayOfWeek] : DAY_NAMES_EN[dayOfWeek],
        isFriday,
        isHoliday: !!holiday,
        holidayName,
        status,
        checkIn,
        checkOut,
        hours,
        lateMinutes: late,
        notes: rec?.notes || holidayName || '',
      });
    }
    return rows;
  }, [attendance, holidays, month, year, isRTL]);

  // KPI computations
  const kpis = useMemo(() => {
    const workingDays = dailyRows.filter(r => !r.isFriday && !r.isHoliday);
    const presentDays = dailyRows.filter(r => r.status === 'present' || r.status === 'remote' || r.status === 'field_work').length;
    const absentDays = dailyRows.filter(r => r.status === 'absent' || r.status === 'absent_no_notice' || r.status === 'absent_prior_notice').length;
    const leaveDays = dailyRows.filter(r => LEAVE_STATUSES.includes(r.status)).length;
    const totalLateMinutes = dailyRows.reduce((sum, r) => sum + r.lateMinutes, 0);
    const totalHours = dailyRows.reduce((sum, r) => sum + r.hours, 0);
    const rate = workingDays.length > 0 ? Math.round((presentDays / workingDays.length) * 100) : 0;

    return {
      presentDays,
      absentDays,
      leaveDays,
      totalLateMinutes,
      totalHours: totalHours.toFixed(1),
      rate,
      workingDays: workingDays.length,
    };
  }, [dailyRows]);

  // Summary section computations
  const summary = useMemo(() => {
    const absentNoNotice = dailyRows.filter(r => r.status === 'absent_no_notice').length;
    const absentPriorNotice = dailyRows.filter(r => r.status === 'absent_prior_notice').length;
    const remoteDays = dailyRows.filter(r => r.status === 'remote').length;
    const exceptionDays = dailyRows.filter(r => r.status === 'exception').length;
    const fieldDays = dailyRows.filter(r => r.status === 'field_work').length;
    const totalLateMinutes = dailyRows.reduce((sum, r) => sum + r.lateMinutes, 0);

    // Calculate deficit hours (days worked < 8 hours)
    const workedDays = dailyRows.filter(r => r.status === 'present' || r.status === 'remote' || r.status === 'field_work');
    const totalDeficitHours = workedDays.reduce((sum, r) => {
      const deficit = 8 - r.hours;
      return sum + (deficit > 0 ? deficit : 0);
    }, 0);

    // Deduction estimations (based on daily salary - salary/30)
    const salary = employee?.salary || 0;
    const dailyRate = salary / 30;
    const hourlyRate = dailyRate / 8;

    return {
      absentNoNotice,
      absentPriorNotice,
      remoteDays,
      exceptionDays,
      fieldDays,
      totalLateMinutes,
      totalDeficitHours: totalDeficitHours.toFixed(1),
      lateDeduction: Math.round((totalLateMinutes / 60) * hourlyRate),
      deficitDeduction: Math.round(totalDeficitHours * hourlyRate),
      absentNoNoticeDeduction: Math.round(absentNoNotice * dailyRate * 2),
      absentPriorNoticeDeduction: Math.round(absentPriorNotice * dailyRate),
      leaveDays: dailyRows.filter(r => LEAVE_STATUSES.includes(r.status)).length,
    };
  }, [dailyRows, employee]);

  // Leave balance section
  const leaveInfo = useMemo(() => {
    if (!leaveBalances) return null;
    const annualTotal = leaveBalances.annual_total || 21;
    const annualUsed = leaveBalances.annual_used || 0;
    const annualRemaining = annualTotal - annualUsed;

    // Leave types used this month
    const monthLeave = {};
    dailyRows.forEach(r => {
      if (LEAVE_STATUSES.includes(r.status)) {
        monthLeave[r.status] = (monthLeave[r.status] || 0) + 1;
      }
    });

    return { annualTotal, annualUsed, annualRemaining, monthLeave };
  }, [leaveBalances, dailyRows]);

  // Build previous month rows for comparison
  const prevDailyRows = useMemo(() => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const daysInMonth = new Date(prevYear, prevMonth, 0).getDate();
    const holidayMap = {};
    prevHolidays.forEach(h => { holidayMap[h.date] = h; });
    const attMap = {};
    prevAttendance.forEach(a => { attMap[a.date] = a; });

    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(prevYear, prevMonth - 1, d);
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay();
      const isFriday = dayOfWeek === 5;
      const holiday = holidayMap[dateStr];
      const rec = attMap[dateStr];
      let status = rec?.status || null;
      if (holiday && !status) status = 'holiday';
      else if (isFriday && !status) status = 'weekend';
      const checkIn = rec?.check_in || null;
      const checkOut = rec?.check_out || null;
      const hours = calcHours(checkIn, checkOut);
      const late = status === 'present' || status === 'remote' || status === 'field_work' ? calcLateMinutes(checkIn) : 0;
      rows.push({ day: d, dateStr, dayOfWeek, isFriday, isHoliday: !!holiday, status, checkIn, checkOut, hours, lateMinutes: late });
    }
    return rows;
  }, [prevAttendance, prevHolidays, month, year]);

  // Previous month KPIs for comparison
  const prevKpis = useMemo(() => {
    const workingDays = prevDailyRows.filter(r => !r.isFriday && !r.isHoliday);
    const presentDays = prevDailyRows.filter(r => r.status === 'present' || r.status === 'remote' || r.status === 'field_work').length;
    const absentDays = prevDailyRows.filter(r => r.status === 'absent' || r.status === 'absent_no_notice' || r.status === 'absent_prior_notice').length;
    const leaveDays = prevDailyRows.filter(r => LEAVE_STATUSES.includes(r.status)).length;
    const totalLateMinutes = prevDailyRows.reduce((sum, r) => sum + r.lateMinutes, 0);
    const totalHours = prevDailyRows.reduce((sum, r) => sum + r.hours, 0);
    return { presentDays, absentDays, leaveDays, totalLateMinutes, totalHours: totalHours.toFixed(1), workingDays: workingDays.length };
  }, [prevDailyRows]);

  // Hours summary
  const hoursSummary = useMemo(() => {
    const shiftHours = 8;
    const requiredHours = kpis.workingDays * shiftHours;
    const actualHours = parseFloat(kpis.totalHours);
    const difference = actualHours - requiredHours;
    const percentage = requiredHours > 0 ? Math.min(100, Math.round((actualHours / requiredHours) * 100)) : 0;
    return { requiredHours, actualHours, difference, percentage };
  }, [kpis]);

  // Export data for ExportButton
  const exportData = useMemo(() => {
    return dailyRows.map(row => ({
      [isRTL ? '#' : '#']: row.day,
      [isRTL ? 'اليوم' : 'Day']: row.dayName,
      [isRTL ? 'التاريخ' : 'Date']: row.dateStr,
      [isRTL ? 'الحضور' : 'Check In']: row.checkIn || '—',
      [isRTL ? 'الانصراف' : 'Check Out']: row.checkOut || '—',
      [isRTL ? 'الساعات' : 'Hours']: row.hours > 0 ? row.hours.toFixed(1) : '—',
      [isRTL ? 'تأخير (د)' : 'Late (m)']: row.lateMinutes > 0 ? row.lateMinutes : '—',
      [isRTL ? 'الحالة' : 'Status']: row.status ? (STATUS_MAP[row.status] ? (isRTL ? STATUS_MAP[row.status].ar : STATUS_MAP[row.status].en) : row.status) : '—',
      [isRTL ? 'ملاحظات' : 'Notes']: row.notes || '',
    }));
  }, [dailyRows, isRTL]);

  // Month/Year options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'long' }),
  }));
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  // Print handler — opens a formatted report in a new window
  const handlePrint = () => {
    const monthLabel = new Date(year, month - 1).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    const dir = isRTL ? 'rtl' : 'ltr';
    const statusLabel = (s) => STATUS_MAP[s] ? (isRTL ? STATUS_MAP[s].ar : STATUS_MAP[s].en) : s || '—';

    const tableRows = dailyRows.map(r => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:4px 8px;font-size:12px;text-align:center;">${r.day}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;">${r.dayName}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;font-family:monospace;">${r.dateStr}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;font-family:monospace;">${r.checkIn || '—'}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;font-family:monospace;">${r.checkOut || '—'}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;font-family:monospace;">${r.hours > 0 ? r.hours.toFixed(1) : '—'}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;font-family:monospace;">${r.lateMinutes > 0 ? r.lateMinutes : '—'}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;">${statusLabel(r.status)}</td>
        <td style="padding:4px 8px;font-size:11px;">${r.notes || ''}</td>
      </tr>
    `).join('');

    const leaveSection = leaveInfo ? `
      <div style="margin-top:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
        <h3 style="margin:0 0 8px;font-size:14px;">${isRTL ? 'رصيد الإجازات' : 'Leave Balance'}</h3>
        <p style="font-size:12px;margin:4px 0;">${isRTL ? 'الإجازة السنوية:' : 'Annual Leave:'} ${leaveInfo.annualUsed} / ${leaveInfo.annualTotal} ${isRTL ? 'مستخدمة' : 'used'} — ${leaveInfo.annualRemaining} ${isRTL ? 'متبقية' : 'remaining'}</p>
      </div>
    ` : '';

    const html = `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>${isRTL ? 'تقرير الحضور' : 'Attendance Report'}</title>
      <style>body{font-family:system-ui,-apple-system,sans-serif;margin:20px;color:#1a1a1a;font-size:13px;}
      table{width:100%;border-collapse:collapse;margin-top:12px;}
      th{background:#f3f4f6;padding:6px 8px;font-size:11px;text-align:center;border-bottom:2px solid #d1d5db;}
      .kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:16px 0;}
      .kpi-box{padding:10px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;}
      .kpi-box .val{font-size:20px;font-weight:700;margin:4px 0;}
      .kpi-box .lbl{font-size:10px;color:#6b7280;}
      @media print{body{margin:10px;} .kpi-grid{grid-template-columns:repeat(6,1fr);}}</style></head><body>
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px;">
        <div>
          <h1 style="margin:0;font-size:18px;">${empName}</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${deptName}${employee?.employee_number ? ` — ${employee.employee_number}` : ''}</p>
        </div>
        <div style="text-align:${isRTL ? 'left' : 'right'};">
          <p style="margin:0;font-size:14px;font-weight:600;">${isRTL ? 'تقرير الحضور والغياب' : 'Attendance Report'}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${monthLabel}</p>
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="val" style="color:#22c55e;">${kpis.presentDays}</div><div class="lbl">${isRTL ? 'أيام الحضور' : 'Present Days'}</div></div>
        <div class="kpi-box"><div class="val" style="color:#ef4444;">${kpis.absentDays}</div><div class="lbl">${isRTL ? 'أيام الغياب' : 'Absent Days'}</div></div>
        <div class="kpi-box"><div class="val" style="color:#3b82f6;">${kpis.leaveDays}</div><div class="lbl">${isRTL ? 'أيام الإجازة' : 'Leave Days'}</div></div>
        <div class="kpi-box"><div class="val" style="color:#f59e0b;">${kpis.totalLateMinutes}</div><div class="lbl">${isRTL ? 'دقائق التأخير' : 'Late Minutes'}</div></div>
        <div class="kpi-box"><div class="val" style="color:#4a7aab;">${kpis.totalHours}</div><div class="lbl">${isRTL ? 'إجمالي الساعات' : 'Total Hours'}</div></div>
        <div class="kpi-box"><div class="val" style="color:#22c55e;">${kpis.rate}%</div><div class="lbl">${isRTL ? 'نسبة الحضور' : 'Attendance %'}</div></div>
      </div>
      <h3 style="font-size:14px;margin:16px 0 4px;">${isRTL ? 'سجل الحضور اليومي' : 'Daily Attendance Record'}</h3>
      <table>
        <thead><tr>
          <th>#</th><th>${isRTL ? 'اليوم' : 'Day'}</th><th>${isRTL ? 'التاريخ' : 'Date'}</th><th>${isRTL ? 'الحضور' : 'Check In'}</th><th>${isRTL ? 'الانصراف' : 'Check Out'}</th><th>${isRTL ? 'الساعات' : 'Hours'}</th><th>${isRTL ? 'تأخير' : 'Late'}</th><th>${isRTL ? 'الحالة' : 'Status'}</th><th>${isRTL ? 'ملاحظات' : 'Notes'}</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
          <h3 style="margin:0 0 8px;font-size:14px;">${isRTL ? 'ملخص الشهر' : 'Monthly Summary'}</h3>
          <p style="font-size:12px;margin:4px 0;">${isRTL ? 'أيام الحضور / أيام العمل:' : 'Present / Working Days:'} ${kpis.presentDays} / ${kpis.workingDays}</p>
          <p style="font-size:12px;margin:4px 0;">${isRTL ? 'إجمالي التأخير:' : 'Total Late:'} ${summary.totalLateMinutes} ${isRTL ? 'دقيقة' : 'min'}</p>
          <p style="font-size:12px;margin:4px 0;">${isRTL ? 'عجز الساعات:' : 'Deficit Hours:'} ${summary.totalDeficitHours} ${isRTL ? 'ساعة' : 'h'}</p>
          <p style="font-size:12px;margin:4px 0;">${isRTL ? 'الساعات المطلوبة:' : 'Required Hours:'} ${hoursSummary.requiredHours}h — ${isRTL ? 'الفعلية:' : 'Actual:'} ${hoursSummary.actualHours.toFixed(1)}h</p>
        </div>
        ${leaveSection}
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  // Employee display
  const empName = employee ? (isRTL ? employee.full_name_ar : (employee.full_name_en || employee.full_name_ar)) : '';
  const empInitials = empName ? empName.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() : '??';
  const deptName = employee?.departments
    ? (isRTL ? employee.departments.name_ar : (employee.departments.name_en || employee.departments.name_ar))
    : '';

  if (loading && !employee) {
    return <PageSkeleton hasKpis tableRows={10} tableCols={9} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hr/attendance')} className="print:hidden">
            <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} />
          </Button>
          <div className="w-12 h-12 rounded-full bg-brand-500/15 text-brand-500 flex items-center justify-center text-lg font-bold">
            {empInitials}
          </div>
          <div>
            <h1 className="text-lg font-bold text-content dark:text-content-dark m-0">{empName}</h1>
            <p className="text-xs text-content-muted dark:text-content-muted-dark m-0">
              {deptName}{employee?.employee_number ? ` — ${employee.employee_number}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <Select value={String(month)} onChange={e => setMonth(Number(e.target.value))}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Select value={String(year)} onChange={e => setYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </Select>
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <Printer size={14} className={isRTL ? 'ml-1' : 'mr-1'} />
            {isRTL ? 'طباعة' : 'Print'}
          </Button>
          <ExportButton
            data={exportData}
            filename={isRTL ? `حضور_${empName}` : `attendance_${empName}`}
            title={isRTL ? 'سجل الحضور' : 'Attendance Record'}
          />
        </div>
      </div>

      {loading ? (
        <PageSkeleton hasKpis tableRows={10} tableCols={9} />
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={CheckCircle2} label={isRTL ? 'أيام الحضور' : 'Present Days'} value={String(kpis.presentDays || 0)} color="#22C55E" />
            <KpiCard icon={XCircle} label={isRTL ? 'أيام الغياب' : 'Absent Days'} value={String(kpis.absentDays || 0)} color="#EF4444" />
            <KpiCard icon={Calendar} label={isRTL ? 'أيام الإجازة' : 'Leave Days'} value={String(kpis.leaveDays || 0)} color="#3B82F6" />
            <KpiCard icon={AlertCircle} label={isRTL ? 'دقائق التأخير' : 'Late Minutes'} value={String(kpis.totalLateMinutes || 0)} color="#F59E0B" />
            <KpiCard icon={Clock} label={isRTL ? 'إجمالي الساعات' : 'Total Hours'} value={String(kpis.totalHours || 0)} color="#4A7AAB" />
            <KpiCard icon={CheckCircle2} label={isRTL ? 'نسبة الحضور' : 'Attendance %'} value={String(kpis.rate || 0) + '%'} color="#22C55E" />
          </div>

          {/* ── Attendance Chart ─────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-brand-500" />
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'رسم بياني للحضور اليومي' : 'Daily Attendance Chart'}</p>
              </div>
            </CardHeader>
            <div className="p-4">
              <div className="flex items-end gap-0.5 h-32">
                {dailyRows.map(day => {
                  const isPresent = day.status === 'present' || day.status === 'remote' || day.status === 'field_work';
                  const isAbsent = day.status === 'absent' || day.status === 'absent_no_notice' || day.status === 'absent_prior_notice';
                  const isLeave = LEAVE_STATUSES.includes(day.status);
                  const isOff = day.status === 'weekend' || day.status === 'holiday';
                  const colorClass = isPresent ? 'bg-green-500' : isAbsent ? 'bg-red-500' : isLeave ? 'bg-blue-500' : isOff ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700';
                  const barHeight = isPresent && day.hours > 0 ? `${Math.min(100, (day.hours / 10) * 100)}%` : isAbsent ? '15%' : isLeave ? '30%' : isOff ? '10%' : '5%';
                  return (
                    <div key={day.dateStr} className="flex-1 flex flex-col items-center group relative" title={`${day.dateStr}: ${day.hours.toFixed(1)}h`}>
                      <div
                        style={{ height: barHeight }}
                        className={`w-full min-h-[2px] rounded-t ${colorClass} transition-all hover:opacity-80`}
                      />
                      <span className="text-[8px] mt-1 text-content-muted dark:text-content-muted-dark">{day.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-content-muted dark:text-content-muted-dark">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> {isRTL ? 'حاضر' : 'Present'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> {isRTL ? 'غائب' : 'Absent'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> {isRTL ? 'إجازة' : 'Leave'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 dark:bg-gray-600 inline-block" /> {isRTL ? 'عطلة' : 'Off'}</span>
              </div>
            </div>
          </Card>

          {/* ── Section 1: Daily Attendance Table ──────────────── */}
          <Card>
            <CardHeader><p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'سجل الحضور اليومي' : 'Daily Attendance Record'}</p></CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>{isRTL ? '#' : '#'}</Th>
                    <Th>{isRTL ? 'اليوم' : 'Day'}</Th>
                    <Th>{isRTL ? 'التاريخ' : 'Date'}</Th>
                    <Th>{isRTL ? 'الحضور' : 'Check In'}</Th>
                    <Th>{isRTL ? 'الانصراف' : 'Check Out'}</Th>
                    <Th>{isRTL ? 'الساعات' : 'Hours'}</Th>
                    <Th>{isRTL ? 'تأخير (د)' : 'Late (m)'}</Th>
                    <Th>{isRTL ? 'الحالة' : 'Status'}</Th>
                    <Th>{isRTL ? 'ملاحظات' : 'Notes'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map(row => {
                    const sm = STATUS_MAP[row.status] || {};
                    const rowBg = sm.rowCls || '';
                    return (
                      <Tr key={row.day} className={rowBg}>
                        <Td className="text-xs font-medium text-content dark:text-content-dark">{row.day}</Td>
                        <Td className="text-xs text-content dark:text-content-dark">{row.dayName}</Td>
                        <Td className="text-xs text-content dark:text-content-dark font-mono">{row.dateStr}</Td>
                        <Td className="text-xs text-content dark:text-content-dark font-mono">{row.checkIn || '—'}</Td>
                        <Td className="text-xs text-content dark:text-content-dark font-mono">{row.checkOut || '—'}</Td>
                        <Td className="text-xs text-content dark:text-content-dark font-mono">
                          {row.hours > 0 ? row.hours.toFixed(1) : '—'}
                        </Td>
                        <Td className="text-xs text-content dark:text-content-dark font-mono">
                          {row.lateMinutes > 0 ? row.lateMinutes : '—'}
                        </Td>
                        <Td>
                          {row.status ? <StatusBadge status={row.status} lang={lang} /> : <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>}
                        </Td>
                        <Td className="text-xs text-content-muted dark:text-content-muted-dark max-w-[200px] truncate">
                          {row.notes || ''}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card>

          {/* ── Section 2: Summary Cards ──────────────────────── */}
          <Card>
            <CardHeader><p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'ملخص الشهر' : 'Monthly Summary'}</p></CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              {/* Present / Working Days */}
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'أيام الحضور / أيام العمل' : 'Present / Working Days'}
                </p>
                <p className="text-xl font-bold text-green-600">{kpis.presentDays} / {kpis.workingDays}</p>
              </div>

              {/* Late → Deduction */}
              <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'إجمالي التأخير → خصم' : 'Total Late → Deduction'}
                </p>
                <p className="text-xl font-bold text-yellow-600">
                  {summary.totalLateMinutes} {isRTL ? 'د' : 'm'}
                  <span className="text-sm font-normal ms-2 text-content-muted dark:text-content-muted-dark">
                    → {summary.lateDeduction.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </span>
                </p>
              </div>

              {/* Deficit Hours → Deduction */}
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'عجز الساعات → خصم' : 'Deficit Hours → Deduction'}
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {summary.totalDeficitHours} {isRTL ? 'س' : 'h'}
                  <span className="text-sm font-normal ms-2 text-content-muted dark:text-content-muted-dark">
                    → {summary.deficitDeduction.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </span>
                </p>
              </div>

              {/* Absent No Notice (×2) */}
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'غياب بدون إذن (×2)' : 'Absent No Notice (×2)'}
                </p>
                <p className="text-xl font-bold text-red-600">
                  {summary.absentNoNotice} {isRTL ? 'يوم' : 'days'}
                  <span className="text-sm font-normal ms-2 text-content-muted dark:text-content-muted-dark">
                    → {summary.absentNoNoticeDeduction.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </span>
                </p>
              </div>

              {/* Absent Prior Notice (×1) */}
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'غياب بإذن (×1)' : 'Absent Prior Notice (×1)'}
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {summary.absentPriorNotice} {isRTL ? 'يوم' : 'days'}
                  <span className="text-sm font-normal ms-2 text-content-muted dark:text-content-muted-dark">
                    → {summary.absentPriorNoticeDeduction.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </span>
                </p>
              </div>

              {/* Leave Days */}
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'أيام الإجازة (من الرصيد)' : 'Leave Days (from balance)'}
                </p>
                <p className="text-xl font-bold text-blue-600">{summary.leaveDays} {isRTL ? 'يوم' : 'days'}</p>
              </div>

              {/* Remote Days */}
              <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'أيام العمل عن بعد' : 'Remote Days'}
                </p>
                <p className="text-xl font-bold text-teal-600">{summary.remoteDays} {isRTL ? 'يوم' : 'days'}</p>
              </div>

              {/* Exception Days */}
              <div className="p-4 rounded-xl bg-gray-500/5 border border-gray-500/20">
                <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">
                  {isRTL ? 'أيام الاستثناء' : 'Exception Days'}
                </p>
                <p className="text-xl font-bold text-gray-600">{summary.exceptionDays} {isRTL ? 'يوم' : 'days'}</p>
              </div>
            </div>
          </Card>

          {/* ── Hours Summary ────────────────────────────────── */}
          <Card>
            <CardHeader><p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'ملخص الساعات' : 'Hours Summary'}</p></CardHeader>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الساعات المطلوبة' : 'Required Hours'}</p>
                  <p className="text-2xl font-bold text-content dark:text-content-dark">{hoursSummary.requiredHours}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الساعات الفعلية' : 'Actual Hours'}</p>
                  <p className="text-2xl font-bold text-brand-500">{hoursSummary.actualHours.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الفرق' : 'Difference'}</p>
                  <p className={`text-2xl font-bold ${hoursSummary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {hoursSummary.difference >= 0 ? '+' : ''}{hoursSummary.difference.toFixed(1)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النسبة المئوية' : 'Percentage'}</p>
                  <p className="text-2xl font-bold text-content dark:text-content-dark">{hoursSummary.percentage}%</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">
                    {hoursSummary.actualHours.toFixed(1)} / {hoursSummary.requiredHours} {isRTL ? 'ساعة' : 'hours'}
                  </span>
                  <span className={`text-xs font-semibold ${hoursSummary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {hoursSummary.difference >= 0 ? (isRTL ? 'فائض' : 'Surplus') : (isRTL ? 'عجز' : 'Deficit')}
                  </span>
                </div>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${hoursSummary.percentage >= 90 ? 'bg-green-500' : hoursSummary.percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${hoursSummary.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── Month Comparison ──────────────────────────────── */}
          <Card>
            <CardHeader><p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'مقارنة بالشهر السابق' : 'Previous Month Comparison'}</p></CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              {/* Present Days comparison */}
              {(() => {
                const diff = kpis.presentDays - prevKpis.presentDays;
                const isUp = diff > 0;
                const isDown = diff < 0;
                return (
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                    <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'أيام الحضور' : 'Present Days'}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-green-600">{kpis.presentDays}</p>
                      <span className="text-sm text-content-muted dark:text-content-muted-dark">vs {prevKpis.presentDays}</span>
                    </div>
                    {diff !== 0 && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isUp
                          ? (isRTL ? `↑ ${diff} أيام حضور أكثر` : `↑ ${diff} more present days`)
                          : (isRTL ? `↓ ${Math.abs(diff)} أيام حضور أقل` : `↓ ${Math.abs(diff)} fewer present days`)}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Absent Days comparison */}
              {(() => {
                const diff = kpis.absentDays - prevKpis.absentDays;
                const isUp = diff > 0;
                return (
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'أيام الغياب' : 'Absent Days'}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-red-600">{kpis.absentDays}</p>
                      <span className="text-sm text-content-muted dark:text-content-muted-dark">vs {prevKpis.absentDays}</span>
                    </div>
                    {diff !== 0 && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isUp
                          ? (isRTL ? `↑ ${diff} أيام غياب أكثر` : `↑ ${diff} more absent days`)
                          : (isRTL ? `↓ ${Math.abs(diff)} أيام غياب أقل` : `↓ ${Math.abs(diff)} fewer absent days`)}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Late Minutes comparison */}
              {(() => {
                const diff = kpis.totalLateMinutes - prevKpis.totalLateMinutes;
                const isUp = diff > 0;
                return (
                  <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                    <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'دقائق التأخير' : 'Late Minutes'}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-yellow-600">{kpis.totalLateMinutes}</p>
                      <span className="text-sm text-content-muted dark:text-content-muted-dark">vs {prevKpis.totalLateMinutes}</span>
                    </div>
                    {diff !== 0 && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isUp
                          ? (isRTL ? `↑ ${diff} دقيقة تأخير أكثر` : `↑ ${diff} more late minutes`)
                          : (isRTL ? `↓ ${Math.abs(diff)} دقيقة تأخير أقل` : `↓ ${Math.abs(diff)} fewer late minutes`)}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Hours comparison */}
              {(() => {
                const curr = parseFloat(kpis.totalHours);
                const prev = parseFloat(prevKpis.totalHours);
                const diff = curr - prev;
                const isUp = diff > 0;
                return (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <p className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'ساعات العمل' : 'Hours Worked'}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-blue-600">{kpis.totalHours}</p>
                      <span className="text-sm text-content-muted dark:text-content-muted-dark">vs {prevKpis.totalHours}</span>
                    </div>
                    {Math.abs(diff) > 0.1 && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isUp
                          ? (isRTL ? `↑ ${diff.toFixed(1)} ساعات أكثر` : `↑ ${diff.toFixed(1)} more hours`)
                          : (isRTL ? `↓ ${Math.abs(diff).toFixed(1)} ساعات أقل` : `↓ ${Math.abs(diff).toFixed(1)} fewer hours`)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </Card>

          {/* ── Section 3: Leave Balance ──────────────────────── */}
          <Card>
            <CardHeader><p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'رصيد الإجازات' : 'Leave Balance'}</p></CardHeader>
            <div className="p-4">
              {leaveInfo ? (
                <div className="space-y-4">
                  {/* Annual leave bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-content dark:text-content-dark">
                        {isRTL ? 'الإجازة السنوية' : 'Annual Leave'}
                      </span>
                      <span className="text-xs text-content-muted dark:text-content-muted-dark">
                        {leaveInfo.annualUsed} / {leaveInfo.annualTotal} {isRTL ? 'مستخدمة' : 'used'}
                        {' — '}
                        <span className="font-semibold text-content dark:text-content-dark">
                          {leaveInfo.annualRemaining} {isRTL ? 'متبقية' : 'remaining'}
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (leaveInfo.annualUsed / leaveInfo.annualTotal) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Leave types used this month */}
                  {Object.keys(leaveInfo.monthLeave).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-content-muted dark:text-content-muted-dark mb-2">
                        {isRTL ? 'الإجازات المستخدمة هذا الشهر' : 'Leave types used this month'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(leaveInfo.monthLeave).map(([type, count]) => {
                          const sm = STATUS_MAP[type] || {};
                          return (
                            <span key={type} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${sm.cls || 'bg-gray-500/15 text-gray-500'}`}>
                              {lang === 'ar' ? sm.ar : sm.en}: {count} {isRTL ? 'يوم' : 'days'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-content-muted dark:text-content-muted-dark text-center py-4">
                  {isRTL ? 'لا يوجد رصيد إجازات لهذا العام' : 'No leave balance data for this year'}
                </p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
