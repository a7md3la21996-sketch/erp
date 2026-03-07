import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Clock, Users, AlertTriangle, CheckCircle, Upload,
  Plus, X, Save, ChevronLeft, ChevronRight,
  Wifi, WifiOff, Edit2, Download
} from 'lucide-react';
import {
  MOCK_EMPLOYEES, DEPARTMENTS, MOCK_HR_POLICIES
} from '../../data/hr_mock_data';
import { getAttendanceForMonth, updateAttendanceRecord, addAttendanceRecord } from '../../data/attendanceStore';

// ── Helpers ───────────────────────────────────────────────────
function getPol(key) {
  const p = MOCK_HR_POLICIES.find(p => p.key === key);
  return p ? p.value : null;
}

const WORK_START   = getPol('work_start_time')    || '10:00';
const LATE_THRESH  = getPol('late_threshold_time') || '10:30';
const WORK_HOURS   = parseFloat(getPol('work_hours_normal')) || 8;
const TOLERANCE    = parseFloat(getPol('tolerance_hours_monthly')) || 4;
const HOUR_DIVISOR = parseFloat(getPol('hourly_rate_divisor')) || 240;

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calcLateMinutes(checkIn) {
  if (!checkIn) return 0;
  const lateThreshMins = timeToMinutes(LATE_THRESH);
  const checkInMins    = timeToMinutes(checkIn);
  return Math.max(0, checkInMins - lateThreshMins);
}

function calcOTHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const worked = timeToMinutes(checkOut) - timeToMinutes(checkIn);
  const expected = WORK_HOURS * 60;
  return Math.max(0, (worked - expected) / 60);
}

function calcDeduction(lateMinutes, usedTolerance, toleranceCap, hourlyRate) {
  const lateHours = lateMinutes / 60;
  const remaining = Math.max(0, toleranceCap - usedTolerance);
  const coveredByTolerance = Math.min(lateHours, remaining);
  const overTolerance      = lateHours - coveredByTolerance;
  // within tolerance: 1x, over: 2x
  return (coveredByTolerance * hourlyRate) + (overTolerance * hourlyRate * 2);
}


const NOW   = new Date();
const INIT_YEAR  = NOW.getFullYear();
const INIT_MONTH = NOW.getMonth() + 1;

// ── Work Mode Badge ───────────────────────────────────────────
function ModeBadge({ mode, lang }) {
  const map = {
    normal:    { ar: 'مكتبي',   en: 'Office',  bg: '#3B82F620', color: '#3B82F6' },
    remote:    { ar: 'ريموت',   en: 'Remote',  bg: '#10B98120', color: '#10B981' },
    field:     { ar: 'ميداني',  en: 'Field',   bg: '#F59E0B20', color: '#F59E0B' },
    exception: { ar: 'استثناء', en: 'Exception', bg: '#8B5CF620', color: '#8B5CF6' },
  };
  const m = map[mode] || map.normal;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: m.bg, color: m.color }}>
      {lang === 'ar' ? m.ar : m.en}
    </span>
  );
}

// ── Source Badge ──────────────────────────────────────────────
function SourceBadge({ source, lang }) {
  if (source === 'fingerprint') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#6366F120', color: '#6366F1' }}>
      🖐️ {lang === 'ar' ? 'بصمة' : 'FP'}
    </span>
  );
  if (source === 'excel') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#10B98120', color: '#10B981' }}>
      📊 Excel
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#94A3B820', color: '#94A3B8' }}>
      ✍️ {lang === 'ar' ? 'يدوي' : 'Manual'}
    </span>
  );
}

// ── Manual Entry Modal ────────────────────────────────────────
function ManualEntryModal({ record, employees, onClose, onSave, isDark, isRTL, lang, c }) {
  const isNew = !record?.employee_id;
  const [form, setForm] = useState(record || {
    employee_id: employees[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    work_mode: 'normal',
    check_in: '10:00', check_out: '18:00',
    absent: false, absent_with_notice: false,
    ot_hours: 0, note: '', source: 'manual',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const emp = employees.find(e => e.id === form.employee_id);

  const inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block', textAlign: isRTL ? 'right' : 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, direction: isRTL ? 'rtl' : 'ltr' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#fff" />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text }}>
              {isNew ? (lang === 'ar' ? 'تسجيل حضور يدوي' : 'Manual Check-in') : (lang === 'ar' ? 'تعديل السجل' : 'Edit Record')}
            </h3>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Employee */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>{lang === 'ar' ? 'الموظف' : 'Employee'}</label>
            <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} style={inp}>
              {employees.map(e => <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />
          </div>

          {/* Work Mode */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'نوع العمل' : 'Work Mode'}</label>
            <select value={form.work_mode} onChange={e => set('work_mode', e.target.value)} style={inp}>
              <option value="normal">{lang === 'ar' ? 'مكتبي' : 'Office'}</option>
              <option value="remote">{lang === 'ar' ? 'ريموت' : 'Remote'}</option>
              <option value="field">{lang === 'ar' ? 'ميداني' : 'Field'}</option>
              <option value="exception">{lang === 'ar' ? 'استثناء' : 'Exception'}</option>
            </select>
          </div>

          {/* Absent toggle */}
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <input type="checkbox" checked={form.absent} onChange={e => set('absent', e.target.checked)} />
              <span style={{ fontSize: 13, color: c.text }}>{lang === 'ar' ? 'غائب' : 'Absent'}</span>
            </label>
            {form.absent && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <input type="checkbox" checked={form.absent_with_notice} onChange={e => set('absent_with_notice', e.target.checked)} />
                <span style={{ fontSize: 13, color: c.text }}>{lang === 'ar' ? 'بإشعار مسبق' : 'With Notice'}</span>
              </label>
            )}
          </div>

          {!form.absent && (
            <>
              <div>
                <label style={lbl}>{lang === 'ar' ? 'وقت الحضور' : 'Check In'}</label>
                <input type="time" value={form.check_in || ''} onChange={e => set('check_in', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>{lang === 'ar' ? 'وقت الانصراف' : 'Check Out'}</label>
                <input type="time" value={form.check_out || ''} onChange={e => set('check_out', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>{lang === 'ar' ? 'ساعات إضافية' : 'OT Hours'}</label>
                <input type="number" step="0.5" min="0" value={form.ot_hours || 0} onChange={e => set('ot_hours', parseFloat(e.target.value))} style={inp} />
              </div>
            </>
          )}

          {/* Note */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>{lang === 'ar' ? 'ملاحظة' : 'Note'}</label>
            <input value={form.note} onChange={e => set('note', e.target.value)} style={inp} placeholder={lang === 'ar' ? 'اختياري...' : 'Optional...'} />
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => onSave({ ...form, id: form.id || `m-${Date.now()}` })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} />
            {lang === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AttendancePage() {
  const { theme }  = useTheme();
  const { i18n }   = useTranslation();
  const isDark = theme === 'dark';
  const isRTL  = i18n.language === 'ar';
  const lang   = i18n.language;

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover:  isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };

  const [tab, setTab]         = useState('monthly'); // monthly | daily
  const [year, setYear]       = useState(INIT_YEAR);
  const [month, setMonth]     = useState(INIT_MONTH);
  const [dayDate, setDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [deptFilter, setDept] = useState('all');
  const [empFilter, setEmp]   = useState('all');
  // ✅ بيجيب البيانات من الـ store المشترك — نفس البيانات اللي بيشوفها Payroll
  const [records, setRecords] = useState(() => getAttendanceForMonth(INIT_YEAR, INIT_MONTH));
  const [fpConnected]         = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [excelLoading, setExcelLoading] = useState(false);

  // month navigation — بيجيب الشهر من الـ store (أو بيولّده لو أول مرة)
  const prevMonth = () => {
    const [y, m] = month === 1 ? [year-1, 12] : [year, month-1];
    setYear(y); setMonth(m);
    setRecords(getAttendanceForMonth(y, m));
  };
  const nextMonth = () => {
    const [y, m] = month === 12 ? [year+1, 1] : [year, month+1];
    setYear(y); setMonth(m);
    setRecords(getAttendanceForMonth(y, m));
  };

  const monthNames = { ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'], en: ['January','February','March','April','May','June','July','August','September','October','November','December'] };

  const filteredEmps = useMemo(() => MOCK_EMPLOYEES.filter(e => deptFilter === 'all' || e.department === deptFilter), [deptFilter]);

  // ── Monthly Summary ──
  const monthlySummary = useMemo(() => {
    return filteredEmps.map(emp => {
      const empRecs = records.filter(r => r.employee_id === emp.id);
      const presentDays  = empRecs.filter(r => !r.absent && r.check_in).length;
      const absentDays   = empRecs.filter(r => r.absent).length;
      const remoteDays   = empRecs.filter(r => r.work_mode === 'remote').length;
      const fieldDays    = empRecs.filter(r => r.work_mode === 'field').length;
      const totalOT      = empRecs.reduce((s, r) => s + (r.ot_hours || 0), 0);
      const totalLateMins = empRecs.reduce((s, r) => s + calcLateMinutes(r.check_in), 0);
      const hourlyRate   = emp.base_salary / HOUR_DIVISOR;
      const toleranceCap = emp.tolerance_hours || TOLERANCE;

      // deduction calc
      let usedTolerance = 0;
      let totalDeduction = 0;
      empRecs.forEach(r => {
        if (r.absent) {
          const mult = r.absent_with_notice ? 1 : 2;
          totalDeduction += (emp.base_salary / 30) * mult;
        } else {
          const lateH = calcLateMinutes(r.check_in) / 60;
          const remaining = Math.max(0, toleranceCap - usedTolerance);
          const covered   = Math.min(lateH, remaining);
          const over      = lateH - covered;
          usedTolerance  += covered;
          totalDeduction += (covered * hourlyRate) + (over * hourlyRate * 2);
        }
      });

      return { emp, presentDays, absentDays, remoteDays, fieldDays, totalOT, totalLateMins, totalDeduction, toleranceCap, usedTolerance: Math.min(usedTolerance, toleranceCap) };
    });
  }, [filteredEmps, records]);

  // ── Daily Records ──
  const dailyRecords = useMemo(() => {
    const emps = empFilter === 'all' ? MOCK_EMPLOYEES : MOCK_EMPLOYEES.filter(e => e.id === empFilter);
    return emps.map(emp => {
      const rec = records.find(r => r.employee_id === emp.id && r.date === dayDate);
      return { emp, rec };
    });
  }, [records, dayDate, empFilter]);

  const saveRecord = (rec) => {
    // ✅ بيحدث الـ store المشترك عشان Payroll يشوف التعديل
    updateAttendanceRecord(year, month, rec);
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === rec.id);
      return idx >= 0 ? prev.map(r => r.id === rec.id ? rec : r) : [...prev, rec];
    });
    setShowManual(false);
    setEditRecord(null);
  };

  // stats cards
  const totalPresent = records.filter(r => !r.absent && r.check_in).length;
  const totalAbsent  = records.filter(r => r.absent).length;
  const totalLate    = records.filter(r => calcLateMinutes(r.check_in) > 0).length;
  const totalOT      = records.reduce((s, r) => s + (r.ot_hours || 0), 0);

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'الحضور والانصراف' : 'Attendance'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'متابعة حضور الموظفين وحساب الخصومات' : 'Track attendance & calculate deductions'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {/* Fingerprint Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (fpConnected ? '#10B98140' : c.border), background: fpConnected ? '#10B98110' : (isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC') }}>
            {fpConnected ? <Wifi size={14} color="#10B981" /> : <WifiOff size={14} color={c.textMuted} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: fpConnected ? '#10B981' : c.textMuted }}>
              {lang === 'ar' ? (fpConnected ? 'البصمة متصلة' : 'البصمة غير متصلة') : (fpConnected ? 'FP Connected' : 'FP Offline')}
            </span>
          </div>

          {/* Excel Upload */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: isDark ? 'rgba(74,122,171,0.1)' : '#F8FAFC', color: c.text, fontSize: 13, fontWeight: 500 }}>
            <Upload size={15} />
            {excelLoading ? (lang === 'ar' ? 'جاري...' : 'Loading...') : (lang === 'ar' ? 'رفع Excel' : 'Upload Excel')}
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={() => { setExcelLoading(true); setTimeout(() => setExcelLoading(false), 1500); }} />
          </label>

          {/* Manual Entry */}
          <button onClick={() => { setEditRecord(null); setShowManual(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Plus size={15} />
            {lang === 'ar' ? 'تسجيل يدوي' : 'Manual Entry'}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: lang === 'ar' ? 'أيام الحضور' : 'Present Days', value: totalPresent, icon: '✅', color: '#10B981' },
          { label: lang === 'ar' ? 'أيام الغياب' : 'Absent Days',  value: totalAbsent,  icon: '❌', color: '#EF4444' },
          { label: lang === 'ar' ? 'سجلات التأخير' : 'Late Records', value: totalLate,  icon: '⏰', color: '#F59E0B' },
          { label: lang === 'ar' ? 'إجمالي الأوفرتايم' : 'Total OT', value: `${totalOT.toFixed(1)}h`, icon: '⚡', color: '#6366F1' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>
              <span style={{ fontSize: 26 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isDark ? 'rgba(74,122,171,0.08)' : '#F1F5F9', padding: 4, borderRadius: 10, width: 'fit-content', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {[{ id: 'monthly', ar: 'الملخص الشهري', en: 'Monthly Summary' }, { id: 'daily', ar: 'اليومي', en: 'Daily View' }, { id: 'analytics', ar: 'التحليل', en: 'Analytics' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t.id ? (isDark ? '#1a2234' : '#fff') : 'transparent',
              color: tab === t.id ? c.accent : c.textMuted,
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* ── MONTHLY TAB ── */}
      {tab === 'monthly' && (
        <>
          {/* Month Nav + Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: c.text, minWidth: 140, textAlign: 'center' }}>
                {lang === 'ar' ? monthNames.ar[month-1] : monthNames.en[month-1]} {year}
              </span>
              <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>

            <select value={deptFilter} onChange={e => setDept(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
              {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}
            </select>

            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: 'transparent', color: c.textMuted, fontSize: 13, cursor: 'pointer' }}>
              <Download size={14} /> {lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}
            </button>
          </div>

          {/* Monthly Table */}
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[
                    { ar: 'الموظف',         en: 'Employee',     w: 'auto' },
                    { ar: 'أيام الحضور',   en: 'Present',      w: '100px' },
                    { ar: 'الغياب',         en: 'Absent',       w: '80px' },
                    { ar: 'ريموت/ميداني',  en: 'Remote/Field', w: '110px' },
                    { ar: 'إجمالي التأخير', en: 'Total Late',  w: '110px' },
                    { ar: 'الأوفرتايم',    en: 'OT Hours',     w: '100px' },
                    { ar: 'التسامح المستخدم', en: 'Tolerance', w: '120px' },
                    { ar: 'الخصم المحسوب', en: 'Deduction',    w: '120px' },
                  ].map((col, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w, whiteSpace: 'nowrap' }}>
                      {lang === 'ar' ? col.ar : col.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map(({ emp, presentDays, absentDays, remoteDays, fieldDays, totalOT, totalLateMins, totalDeduction, toleranceCap, usedTolerance }, idx) => {
                  const tolerancePct = Math.min(100, (usedTolerance / toleranceCap) * 100);
                  const lateColor = totalLateMins > toleranceCap * 60 ? '#EF4444' : totalLateMins > 0 ? '#F59E0B' : '#10B981';
                  return (
                    <tr key={emp.id} style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                      {/* Employee */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: emp.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {emp.full_name_ar.split(' ').slice(0,2).map(w=>w[0]).join('')}
                          </div>
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                            <div style={{ fontSize: 11, color: c.textMuted }}>{emp.employee_number}</div>
                          </div>
                        </div>
                      </td>

                      {/* Present */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>{presentDays}</span>
                        <span style={{ fontSize: 11, color: c.textMuted }}> {lang === 'ar' ? 'يوم' : 'd'}</span>
                      </td>

                      {/* Absent */}
                      <td style={{ padding: '12px 14px' }}>
                        {absentDays > 0
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#EF444420', color: '#EF4444' }}>{absentDays}</span>
                          : <span style={{ fontSize: 13, color: c.textMuted }}>—</span>}
                      </td>

                      {/* Remote/Field */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 12, color: c.textMuted }}>
                          🏠{remoteDays} / 🚗{fieldDays}
                        </span>
                      </td>

                      {/* Total Late */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: lateColor }}>
                          {totalLateMins > 0 ? minutesToTime(totalLateMins) : '—'}
                        </span>
                      </td>

                      {/* OT */}
                      <td style={{ padding: '12px 14px' }}>
                        {totalOT > 0
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#6366F120', color: '#6366F1' }}>{totalOT.toFixed(1)}h</span>
                          : <span style={{ fontSize: 13, color: c.textMuted }}>—</span>}
                      </td>

                      {/* Tolerance Bar */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 3 }}>
                          {usedTolerance.toFixed(1)} / {toleranceCap}h
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: isDark ? 'rgba(74,122,171,0.2)' : '#E5E7EB', width: 80 }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${tolerancePct}%`, background: tolerancePct >= 100 ? '#EF4444' : tolerancePct > 70 ? '#F59E0B' : '#10B981', transition: 'width 0.3s' }} />
                        </div>
                      </td>

                      {/* Deduction */}
                      <td style={{ padding: '12px 14px' }}>
                        {totalDeduction > 0
                          ? <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>-{Math.round(totalDeduction).toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                          : <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>✓</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── DAILY TAB ── */}
      {tab === 'daily' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none' }} />

            <select value={empFilter} onChange={e => setEmp(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الموظفين' : 'All Employees'}</option>
              {MOCK_EMPLOYEES.map(e => <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>)}
            </select>

            <div style={{ fontSize: 13, color: c.textMuted, marginInlineStart: 'auto' }}>
              ✅ {dailyRecords.filter(r => r.rec && !r.rec.absent).length} &nbsp;
              ❌ {dailyRecords.filter(r => r.rec?.absent).length} &nbsp;
              ⏳ {dailyRecords.filter(r => !r.rec).length} {lang === 'ar' ? `لم يُسجَّل` : 'unrecorded'}
            </div>
          </div>

          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[
                    { ar: 'الموظف', en: 'Employee', w: 'auto' },
                    { ar: 'نوع العمل', en: 'Mode', w: '100px' },
                    { ar: 'الحضور', en: 'Check In', w: '100px' },
                    { ar: 'الانصراف', en: 'Check Out', w: '100px' },
                    { ar: 'التأخير', en: 'Late', w: '90px' },
                    { ar: 'OT', en: 'OT', w: '80px' },
                    { ar: 'المصدر', en: 'Source', w: '90px' },
                    { ar: '', en: '', w: '50px' },
                  ].map((col, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w }}>
                      {lang === 'ar' ? col.ar : col.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyRecords.map(({ emp, rec }, idx) => {
                  const lateMin = rec ? calcLateMinutes(rec.check_in) : 0;
                  const ot      = rec ? (rec.ot_hours || 0) : 0;
                  return (
                    <tr key={emp.id} style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: emp.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                            {emp.full_name_ar.split(' ').slice(0,2).map(w=>w[0]).join('')}
                          </div>
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                            <div style={{ fontSize: 11, color: c.textMuted }}>{emp.employee_number}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {rec ? <ModeBadge mode={rec.work_mode} lang={lang} /> : <span style={{ fontSize: 12, color: c.textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {rec?.absent
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#EF444420', color: '#EF4444' }}>
                              {lang === 'ar' ? (rec.absent_with_notice ? 'غياب بإشعار' : 'غياب') : (rec.absent_with_notice ? 'Absent (notice)' : 'Absent')}
                            </span>
                          : rec?.check_in
                            ? <span style={{ fontSize: 13, fontWeight: 600, color: lateMin > 0 ? '#F59E0B' : c.text }}>{rec.check_in}</span>
                            : <span style={{ fontSize: 12, color: c.textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: c.text }}>{rec?.check_out || '—'}</span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {lateMin > 0
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: lateMin > 60 ? '#EF4444' : '#F59E0B' }}>+{minutesToTime(lateMin)}</span>
                          : <span style={{ fontSize: 12, color: '#10B981' }}>✓</span>}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {ot > 0
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: '#6366F1' }}>+{ot.toFixed(1)}h</span>
                          : <span style={{ fontSize: 12, color: c.textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {rec ? <SourceBadge source={rec.source} lang={lang} /> : <span style={{ fontSize: 12, color: c.textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <button
                          onClick={() => { setEditRecord(rec || { employee_id: emp.id, date: dayDate, work_mode: 'normal', check_in: '', check_out: '', absent: false, absent_with_notice: false, ot_hours: 0, note: '', source: 'manual' }); setShowManual(true); }}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                          <Edit2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}


      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Heatmap Calendar */}
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text, textAlign: isRTL ? 'right' : 'left' }}>
                  📅 {lang === 'ar' ? 'خريطة حرارية للحضور' : 'Attendance Heatmap'}
                </div>
                <div style={{ fontSize: 12, color: c.textMuted, textAlign: isRTL ? 'right' : 'left' }}>
                  {lang === 'ar' ? 'نسبة الحضور اليومي للشهر' : 'Daily attendance rate for the month'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: c.textMuted }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#10B981' }} />
                  <span>95%+</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#F59E0B' }} />
                  <span>80-95%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#EF4444' }} />
                  <span>{'<80%'}</span>
                </div>
              </div>
            </div>
            {(() => {
              const daysInMonth = new Date(year, month, 0).getDate();
              const firstDay    = new Date(year, month - 1, 1).getDay();
              const totalEmps   = MOCK_EMPLOYEES.length;
              const cells = [];
              // Empty cells
              for (let i = 0; i < firstDay; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dayRecs = records.filter(r => r.date === dateStr && !r.absent && r.check_in);
                const pct = totalEmps > 0 ? Math.round((dayRecs.length / totalEmps) * 100) : 0;
                cells.push({ d, pct, dateStr });
              }
              const DAY_LABELS = lang === 'ar'
                ? ['أح','إث','ثل','أر','خم','جم','سب']
                : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                    {DAY_LABELS.map((d,i) => (
                      <div key={i} style={{ textAlign: 'center', fontSize: 10, color: c.textMuted, fontWeight: 600, padding: '2px 0' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                    {cells.map((cell, i) => (
                      cell === null
                        ? <div key={i} />
                        : (
                          <div key={i} style={{
                            aspectRatio: '1',
                            borderRadius: 8,
                            background: cell.pct >= 95 ? '#10B98130' : cell.pct >= 80 ? '#F59E0B25' : cell.pct > 0 ? '#EF444420' : (isDark ? 'rgba(255,255,255,0.03)' : '#F3F4F6'),
                            border: `1px solid ${cell.pct >= 95 ? '#10B98140' : cell.pct >= 80 ? '#F59E0B40' : cell.pct > 0 ? '#EF444430' : c.border}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'default',
                            transition: 'transform 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{cell.d}</div>
                            {cell.pct > 0 && <div style={{ fontSize: 9, color: cell.pct >= 95 ? '#10B981' : cell.pct >= 80 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>{cell.pct}%</div>}
                          </div>
                        )
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Real-time Alerts + Dept Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Alerts */}
            <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                🔔 {lang === 'ar' ? 'تنبيهات الحضور' : 'Attendance Alerts'}
              </div>
              <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'تنبيهات تحتاج إجراء' : 'Alerts requiring action'}
              </div>
              {(() => {
                const highAbsent   = monthlySummary.filter(s => s.absentDays >= 3);
                const highLate     = monthlySummary.filter(s => s.totalLateMins > 180);
                const overTolerance = monthlySummary.filter(s => s.usedTolerance >= s.toleranceCap);
                const alerts = [
                  highAbsent.length > 0   && { icon: '🚨', color: '#EF4444', bg: '#EF444415', title: lang==='ar'?'غياب مرتفع':'High Absenteeism', desc: lang==='ar'?`${highAbsent.length} موظف غابوا 3+ أيام`:`${highAbsent.length} employees absent 3+ days` },
                  highLate.length > 0     && { icon: '⏰', color: '#F59E0B', bg: '#F59E0B15', title: lang==='ar'?'تأخير متكرر':'Repeated Late', desc: lang==='ar'?`${highLate.length} موظف تأخروا أكثر من 3 ساعات`:`${highLate.length} employees late more than 3h total` },
                  overTolerance.length > 0 && { icon: '⚠️', color: '#8B5CF6', bg: '#8B5CF615', title: lang==='ar'?'تجاوز الـ Tolerance':'Tolerance Exceeded', desc: lang==='ar'?`${overTolerance.length} موظف استنفدوا رصيد التسامح`:`${overTolerance.length} employees used all tolerance hours` },
                ].filter(Boolean);
                return alerts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {alerts.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '12px', borderRadius: 10, background: a.bg, border: `1px solid ${a.color}30`, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.title}</div>
                          <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{a.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: c.textMuted }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ fontSize: 13 }}>{lang === 'ar' ? 'لا توجد تنبيهات هذا الشهر' : 'No alerts this month'}</div>
                  </div>
                );
              })()}
            </div>

            {/* Dept Comparison */}
            <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                🏢 {lang === 'ar' ? 'مقارنة الأقسام' : 'Department Comparison'}
              </div>
              <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'نسبة الحضور والغياب لكل قسم' : 'Attendance rate per department'}
              </div>
              {(() => {
                const deptStats = DEPARTMENTS.map(dept => {
                  const emps    = MOCK_EMPLOYEES.filter(e => e.department === dept.id);
                  const empRecs = records.filter(r => emps.some(e => e.id === r.employee_id));
                  const present = empRecs.filter(r => !r.absent && r.check_in).length;
                  const total   = emps.length * new Date(year, month, 0).getDate();
                  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
                  return { dept, emps: emps.length, pct };
                }).sort((a,b) => b.pct - a.pct);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {deptStats.map(({ dept, emps, pct }, i) => (
                      <div key={dept.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: c.text, fontWeight: 600 }}>{lang==='ar'?dept.name_ar:dept.name_en}</span>
                            <span style={{ fontSize: 10, color: c.textMuted }}>({emps} {lang==='ar'?'موظف':'emp'})</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 95 ? '#10B981' : pct >= 80 ? '#F59E0B' : '#EF4444' }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: pct + '%', background: pct >= 95 ? '#10B981' : pct >= 80 ? '#F59E0B' : '#EF4444', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Fingerprint Info Banner ── */}
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(99,102,241,0.08)' : '#EEF2FF', border: '1px solid ' + (isDark ? 'rgba(99,102,241,0.2)' : '#C7D2FE'), display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <span style={{ fontSize: 18 }}>🖐️</span>
        <p style={{ margin: 0, fontSize: 13, color: isDark ? '#A5B4FC' : '#4338CA' }}>
          {lang === 'ar'
            ? 'البصمة جاهزة للربط — لما تربط الجهاز، بيانات الحضور هتيجي أوتوماتيك وتظهر هنا بالمصدر "بصمة"'
            : 'Fingerprint API ready — once connected, attendance data will sync automatically and appear here with source "FP"'}
        </p>
      </div>

      {/* ── Manual Entry Modal ── */}
      {showManual && (
        <ManualEntryModal
          record={editRecord}
          employees={MOCK_EMPLOYEES}
          onClose={() => { setShowManual(false); setEditRecord(null); }}
          onSave={saveRecord}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
    </div>
  );
}
