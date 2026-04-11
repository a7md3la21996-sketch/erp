import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmployees, fetchDepartments } from '../../services/employeesService';
import { fetchAttendance } from '../../services/attendanceService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { useToast } from '../../contexts/ToastContext';
import { Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Upload, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Eraser, Search, Users, AlertTriangle } from 'lucide-react';
import { KpiCard, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton, ExportButton, Select, Button, Pagination, SmartFilter, applySmartFilters, Input } from '../../components/ui';
import ImportAttendanceModal from '../../components/hr/ImportAttendanceModal';
import supabase from '../../lib/supabase';

// ── Status Badge ─────────────────────────────────────────────

const STATUS_MAP = {
  present: { ar: 'حاضر', en: 'Present', cls: 'bg-green-500/15 text-green-600' },
  absent_no_notice: { ar: 'غياب بدون إذن', en: 'No Notice', cls: 'bg-red-500/15 text-red-500' },
  absent_prior_notice: { ar: 'غياب بإذن', en: 'With Notice', cls: 'bg-orange-500/15 text-orange-600' },
  absent: { ar: 'غائب', en: 'Absent', cls: 'bg-red-500/15 text-red-500' },
  late: { ar: 'متأخر', en: 'Late', cls: 'bg-yellow-500/15 text-yellow-600' },
  annual_leave: { ar: 'إجازة سنوية', en: 'Annual', cls: 'bg-blue-500/15 text-blue-600' },
  sick_leave: { ar: 'مرضية', en: 'Sick', cls: 'bg-blue-500/15 text-blue-600' },
  marriage_leave: { ar: 'زواج', en: 'Marriage', cls: 'bg-pink-500/15 text-pink-600' },
  maternity_leave: { ar: 'أمومة', en: 'Maternity', cls: 'bg-pink-500/15 text-pink-600' },
  unpaid_leave: { ar: 'بدون مرتب', en: 'Unpaid', cls: 'bg-purple-500/15 text-purple-600' },
  leave: { ar: 'إجازة', en: 'Leave', cls: 'bg-blue-500/15 text-blue-600' },
  exception: { ar: 'استثناء', en: 'Exception', cls: 'bg-gray-500/15 text-gray-600' },
  remote: { ar: 'من البيت', en: 'Remote', cls: 'bg-teal-500/15 text-teal-600' },
  field_work: { ar: 'ميداني', en: 'Field', cls: 'bg-amber-500/15 text-amber-600' },
  resigned: { ar: 'مستقيل', en: 'Resigned', cls: 'bg-gray-500/15 text-gray-500' },
};

function StatusBadge({ status, lang }) {
  const s = STATUS_MAP[status] || { ar: status, en: status, cls: 'bg-slate-500/15 text-slate-500' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{lang === 'ar' ? s.ar : s.en}</span>;
}

// ── Add/Edit Attendance Modal ────────────────────────────────

function AttendanceFormModal({ open, onClose, onSaved, employees, record, lang, isRTL }) {
  const isEdit = !!record;
  const [employeeId, setEmployeeId] = useState(record?.employee_id || '');
  const [date, setDate] = useState(record?.date || new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState(record?.check_in || '');
  const [checkOut, setCheckOut] = useState(record?.check_out || '');
  const [status, setStatus] = useState(record?.status || 'present');
  const [notes, setNotes] = useState(record?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!employeeId || !date) return;
    setSaving(true);

    const payload = {
      employee_id: employeeId,
      date,
      check_in: status === 'absent' ? null : (checkIn || null),
      check_out: status === 'absent' ? null : (checkOut || null),
      status,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (isEdit && record?.id) {
        const { error } = await supabase
          .from('attendance')
          .update(payload)
          .eq('id', record.id);
        if (error) throw error;
      } else {
        payload.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('attendance')
          .upsert(payload, { onConflict: 'employee_id,date' });
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save attendance:', err);
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? (lang === 'ar' ? 'تعديل سجل حضور' : 'Edit Attendance') : (lang === 'ar' ? 'إضافة سجل حضور' : 'Add Attendance')} size="md">
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">
        {/* Employee select */}
        {!isEdit && (
          <div>
            <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الموظف' : 'Employee'}
            </label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
            >
              <option value="">{lang === 'ar' ? 'اختر موظف...' : 'Select employee...'}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar} — {emp.employee_number || emp.employee_id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
            {lang === 'ar' ? 'التاريخ' : 'Date'}
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
            {lang === 'ar' ? 'الحالة' : 'Status'}
          </label>
          <div className="flex gap-2">
            {[
              { value: 'present', label: lang === 'ar' ? 'حاضر' : 'Present', color: 'bg-green-500/15 text-green-600 border-green-500/30' },
              { value: 'absent_no_notice', label: lang === 'ar' ? 'غياب بدون إذن' : 'Absent (No Notice)', color: 'bg-red-500/15 text-red-600 border-red-500/30' },
              { value: 'absent_prior_notice', label: lang === 'ar' ? 'غياب بإذن' : 'Absent (Notice)', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
              { value: 'annual_leave', label: lang === 'ar' ? 'إجازة سنوية' : 'Annual Leave', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
              { value: 'sick_leave', label: lang === 'ar' ? 'إجازة مرضية' : 'Sick Leave', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
              { value: 'unpaid_leave', label: lang === 'ar' ? 'بدون مرتب' : 'Unpaid Leave', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
              { value: 'exception', label: lang === 'ar' ? 'استثناء' : 'Exception', color: 'bg-gray-500/15 text-gray-600 border-gray-500/30' },
              { value: 'remote', label: lang === 'ar' ? 'من البيت' : 'Remote', color: 'bg-teal-500/15 text-teal-600 border-teal-500/30' },
              { value: 'field_work', label: lang === 'ar' ? 'عمل ميداني' : 'Field Work', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
              { value: 'marriage_leave', label: lang === 'ar' ? 'إجازة زواج' : 'Marriage', color: 'bg-pink-500/15 text-pink-600 border-pink-500/30' },
              { value: 'maternity_leave', label: lang === 'ar' ? 'إجازة أمومة' : 'Maternity', color: 'bg-pink-500/15 text-pink-600 border-pink-500/30' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  status === opt.value ? opt.color : 'bg-surface dark:bg-surface-dark text-content-muted dark:text-content-muted-dark border-edge dark:border-edge-dark'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Times (hidden if absent) */}
        {status !== 'absent' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
                {lang === 'ar' ? 'وقت الحضور' : 'Check In'}
              </label>
              <input
                type="time"
                value={checkIn}
                onChange={e => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
                {lang === 'ar' ? 'وقت الانصراف' : 'Check Out'}
              </label>
              <input
                type="time"
                value={checkOut}
                onChange={e => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
            {lang === 'ar' ? 'ملاحظات' : 'Notes'}
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark resize-none"
            placeholder={lang === 'ar' ? 'أضف ملاحظات...' : 'Add notes...'}
          />
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={handleSave} disabled={saving || !employeeId || !date}>
          {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── Employee Detail Panel (inline expand) ────────────────────

function EmployeeDetailRows({ emp, records, isRTL, lang, onEdit, onDelete, onQuickStatus }) {
  if (!records.length) {
    return (
      <Tr>
        <td colSpan={9} className="px-6 py-4 text-center text-xs text-content-muted dark:text-content-muted-dark bg-surface-bg dark:bg-surface-bg-dark">
          {lang === 'ar' ? 'لا توجد سجلات حضور لهذا الشهر' : 'No attendance records this month'}
        </td>
      </Tr>
    );
  }

  return records.map(rec => (
    <Tr key={rec.id || rec.date} className="bg-surface-bg/50 dark:bg-surface-bg-dark/50">
      <td className="px-4 py-2" />
      <Td className="text-xs text-content dark:text-content-dark">{rec.date}</Td>
      <Td className="text-xs font-mono text-content dark:text-content-dark">{rec.check_in || '—'}</Td>
      <Td className="text-xs font-mono text-content dark:text-content-dark">{rec.check_out || '—'}</Td>
      <Td>
        <select
          value={rec.status}
          onChange={e => onQuickStatus(rec, e.target.value)}
          className="text-xs px-1.5 py-0.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-content dark:text-content-dark cursor-pointer"
        >
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <option key={key} value={key}>{lang === 'ar' ? val.ar : val.en}</option>
          ))}
        </select>
      </Td>
      <Td>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(rec)} className="p-1 rounded hover:bg-brand-500/10 text-content-muted hover:text-brand-500 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(rec)} className="p-1 rounded hover:bg-red-500/10 text-content-muted hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </Td>
    </Tr>
  ));
}

// ── Attendance Row (with expand) ─────────────────────────────

function AttendanceRow({ emp, attendance, isRTL, lang, expanded, onToggle, onEdit, onDelete, onQuickStatus }) {
  const recs = attendance[emp.id] || attendance[emp.employee_id] || [];
  const p = recs.filter(r => r.status === 'present' || (r.check_in && r.status !== 'absent' && r.status !== 'leave')).length;
  const a = recs.filter(r => r.status === 'absent' || r.absent).length;
  const l = recs.filter(r => {
    if (r.status === 'late') return true;
    if (!r.check_in || r.status === 'absent') return false;
    const [h, m] = (r.check_in || '').split(':').map(Number);
    return h > 10 || (h === 10 && m > 30);
  }).length;
  // Calculate total hours worked
  const totalHours = recs.reduce((sum, r) => {
    if (r.check_in && r.check_out) {
      const [inH, inM] = r.check_in.split(':').map(Number);
      const [outH, outM] = r.check_out.split(':').map(Number);
      const hours = (outH + outM / 60) - (inH + inM / 60);
      return sum + (hours > 0 ? hours : 0);
    }
    return sum;
  }, 0);
  const total = recs.length || 1;
  const rate = Math.round((p / total) * 100);
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
  const workMode = emp.work_mode || '';
  const ini = name.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || '??';

  const rowBg = rate < 70 ? 'bg-red-500/5' : rate < 90 ? 'bg-yellow-500/5' : '';

  return (
    <>
      <Tr className={`cursor-pointer hover:bg-brand-500/5 transition-colors ${rowBg}`} onClick={onToggle}>
        <Td>
          <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-[9px] bg-[#2B4C6F] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{ini}</span>
            </div>
            <div className="text-start">
              <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{name}</p>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{emp.employee_number || emp.employee_id}</p>
            </div>
          </div>
        </Td>
        <Td className="text-content-muted dark:text-content-muted-dark">{emp.department_ar || emp.department}</Td>
        <Td className="font-bold text-[#4A7AAB]">{p}</Td>
        <Td className="font-bold text-red-500">{a}</Td>
        <Td className="font-bold text-[#6B8DB5]">{l}</Td>
        <Td>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-sm bg-slate-200 dark:bg-white/[0.08]">
              <div className="h-full rounded-sm transition-[width] duration-400" style={{ width: rate + '%', background: rate >= 80 ? '#4A7AAB' : rate >= 60 ? '#6B8DB5' : '#EF4444' }} />
            </div>
            <span className="text-xs font-bold text-content dark:text-content-dark min-w-[32px]">{rate}%</span>
          </div>
        </Td>
        <Td className="text-xs font-mono text-content dark:text-content-dark">{totalHours.toFixed(1)}h</Td>
        <Td>
          {workMode && (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              workMode === 'remote' ? 'bg-teal-500/15 text-teal-600' :
              workMode === 'flexible' ? 'bg-purple-500/15 text-purple-600' :
              workMode === 'field' ? 'bg-amber-500/15 text-amber-600' :
              'bg-gray-500/15 text-gray-600'
            }`}>
              {workMode === 'remote' ? (lang === 'ar' ? 'عن بعد' : 'Remote') :
               workMode === 'flexible' ? (lang === 'ar' ? 'مرن' : 'Flexible') :
               workMode === 'field' ? (lang === 'ar' ? 'ميداني' : 'Field') : workMode}
            </span>
          )}
        </Td>
        <Td>
          <div className="flex items-center gap-1">
            <Link to={`/hr/attendance/${emp.id}`} onClick={e => e.stopPropagation()} className="text-xs text-brand-500 hover:underline no-underline font-medium">
              {lang === 'ar' ? 'ملخص' : 'Summary'}
            </Link>
            {expanded ? <ChevronUp size={14} className="text-content-muted" /> : <ChevronDown size={14} className="text-content-muted" />}
          </div>
        </Td>
      </Tr>
      {expanded && (
        <EmployeeDetailRows emp={emp} records={recs} isRTL={isRTL} lang={lang} onEdit={onEdit} onDelete={onDelete} onQuickStatus={onQuickStatus} />
      )}
    </>
  );
}

// ── Bulk Mark Today Modal ───────────────────────────────────

function BulkMarkTodayModal({ open, onClose, employees, onSaved, lang, isRTL }) {
  const [checked, setChecked] = useState(() => employees.map(e => e.id));
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setChecked(prev => prev.length === employees.length ? [] : employees.map(e => e.id));
  };

  const handleSave = async () => {
    if (!checked.length) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    const rows = checked.map(empId => ({
      employee_id: empId,
      date: today,
      check_in: now,
      status: 'present',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'employee_id,date' });
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      console.error('Bulk mark failed:', err);
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={lang === 'ar' ? 'تسجيل حضور اليوم' : 'Mark Today\'s Attendance'} size="md">
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={checked.length === employees.length} onChange={toggleAll} className="rounded" />
          <span className="text-xs font-bold text-content dark:text-content-dark">
            {lang === 'ar' ? `تحديد الكل (${checked.length}/${employees.length})` : `Select All (${checked.length}/${employees.length})`}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {employees.map(emp => {
            const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
            return (
              <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-500/5 cursor-pointer">
                <input type="checkbox" checked={checked.includes(emp.id)} onChange={() => toggle(emp.id)} className="rounded" />
                <span className="text-xs text-content dark:text-content-dark">{name}</span>
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-auto">{emp.employee_number || ''}</span>
              </label>
            );
          })}
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={handleSave} disabled={saving || !checked.length}>
          {saving ? (lang === 'ar' ? 'جاري التسجيل...' : 'Saving...') : (lang === 'ar' ? `تسجيل حضور ${checked.length} موظف` : `Mark ${checked.length} Present`)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AttendancePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [employees, setEmployees] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'weekly'
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const { showToast } = useToast();

  const { auditFields, applyAuditFilters } = useAuditFilter('attendance');

  const refreshData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchEmployees(),
      fetchAttendance({ month, year }),
      fetchDepartments(),
    ]).then(([empData, attData, deptData]) => {
      setEmployees(empData);
      setAllRecords(attData);
      setDepartments(deptData);
      setLoading(false);
    });
  }, [month, year]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Auto-detect last month with data: if current month has no records, try previous month
  useEffect(() => {
    if (!loading && allRecords.length === 0 && month === new Date().getMonth() + 1 && year === new Date().getFullYear()) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      setMonth(prevMonth);
      if (month === 1) setYear(prevYear);
    }
  }, [loading, allRecords.length]);

  const attendance = useMemo(() => {
    const grouped = {};
    allRecords.forEach(r => {
      const key = r.employee_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
    return grouped;
  }, [allRecords]);

  const stats = useMemo(() => {
    let present = 0, absent = 0, late = 0, leave = 0;
    allRecords.forEach(r => {
      if (r.status === 'leave') { leave++; return; }
      if (r.status === 'absent' || r.absent) { absent++; return; }
      if (r.status === 'late') { late++; return; }
      if (r.check_in) {
        const [h, m] = r.check_in.split(':').map(Number);
        if (h > 10 || (h === 10 && m > 30)) late++;
        else present++;
      }
    });
    return { present, absent, late, leave };
  }, [allRecords]);

  const SMART_FIELDS = useMemo(() => [...auditFields], [auditFields]);

  const filtered = useMemo(() => {
    let result = employees;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    // Search by name
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(emp =>
        (emp.full_name_ar || '').toLowerCase().includes(q) ||
        (emp.full_name_en || '').toLowerCase().includes(q) ||
        (emp.employee_number || '').toLowerCase().includes(q)
      );
    }
    // Department filter
    if (deptFilter) {
      result = result.filter(emp => String(emp.department_id) === String(deptFilter));
    }
    // Status filter (filter employees by their dominant status this month)
    if (statusFilter) {
      result = result.filter(emp => {
        const recs = attendance[emp.id] || attendance[emp.employee_id] || [];
        if (statusFilter === 'present') return recs.some(r => r.status === 'present');
        if (statusFilter === 'absent') return recs.some(r => r.status === 'absent' || r.status === 'absent_no_notice' || r.status === 'absent_prior_notice');
        if (statusFilter === 'late') return recs.some(r => r.status === 'late');
        if (statusFilter === 'leave') return recs.some(r => r.status?.includes('leave'));
        if (statusFilter === 'remote') return recs.some(r => r.status === 'remote');
        return true;
      });
    }
    return result;
  }, [employees, smartFilters, SMART_FIELDS, searchTerm, deptFilter, statusFilter, attendance]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [month]);

  const handleEdit = (rec) => {
    setEditRecord(rec);
    setShowForm(true);
  };

  const handleDeleteRecord = async (rec) => {
    if (!rec.id) return;
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', rec.id);
      if (error) throw error;
      showToast(lang === 'ar' ? 'تم حذف السجل' : 'Record deleted', 'success');
      refreshData();
    } catch {
      showToast(lang === 'ar' ? 'فشل حذف السجل' : 'Delete failed', 'error');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditRecord(null);
  };

  const handleQuickStatus = async (rec, newStatus) => {
    if (!rec.id) return;
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', rec.id);
      if (error) throw error;
      showToast(lang === 'ar' ? 'تم تحديث الحالة' : 'Status updated', 'success');
      refreshData();
    } catch {
      showToast(lang === 'ar' ? 'فشل التحديث' : 'Update failed', 'error');
    }
  };

  // Alerts: consecutive absences & low leave balance
  const alerts = useMemo(() => {
    const items = [];
    employees.forEach(emp => {
      const recs = (attendance[emp.id] || attendance[emp.employee_id] || [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
      // Check consecutive absences
      let maxConsec = 0, consec = 0;
      recs.forEach(r => {
        if (r.status === 'absent' || r.status === 'absent_no_notice' || r.status === 'absent_prior_notice') {
          consec++;
          if (consec > maxConsec) maxConsec = consec;
        } else {
          consec = 0;
        }
      });
      if (maxConsec >= 3) {
        const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
        items.push({
          type: 'danger',
          message: lang === 'ar'
            ? `${name} غائب ${maxConsec} أيام متتالية`
            : `${name} absent ${maxConsec} consecutive days`,
        });
      }
      // Check low leave balance
      if (emp.leave_balance !== undefined && emp.leave_balance !== null && emp.leave_balance < 3) {
        const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
        items.push({
          type: 'warning',
          message: lang === 'ar'
            ? `${name} رصيد إجازاته ${emp.leave_balance} يوم فقط`
            : `${name} has only ${emp.leave_balance} leave days remaining`,
        });
      }
      // Check new hire this month
      if (emp.hire_date) {
        const hireMonth = parseInt(emp.hire_date.split('-')[1]);
        const hireYear = parseInt(emp.hire_date.split('-')[0]);
        if (hireMonth === month && hireYear === year) {
          const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
          items.push({
            type: 'info',
            message: lang === 'ar' ? `${name} موظف جديد بدأ هذا الشهر` : `${name} is a new hire this month`,
          });
        }
      }
    });
    return items;
  }, [employees, attendance, isRTL, lang, month, year]);

  // Weekly view helpers
  const weekDays = useMemo(() => {
    if (viewMode !== 'weekly') return [];
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (selectedWeek - 1) * 7;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() + startOffset + i);
      if (d.getMonth() === month - 1) {
        days.push(d.toISOString().slice(0, 10));
      }
    }
    return days;
  }, [viewMode, selectedWeek, month, year]);

  const DAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const handleDelete = async (type, empId) => {
    setShowDeleteMenu(false);
    const monthName = MONTHS_AR[month - 1];

    let msg, startDate, endDate;
    const empName = empId ? ((employees.find(e => e.id === empId)?.full_name_ar) || '') : '';

    if (type === 'month') {
      msg = lang === 'ar'
        ? `مسح كل سجلات شهر ${monthName} ${year}؟ (${allRecords.length} سجل)`
        : `Delete all ${monthName} ${year} records? (${allRecords.length})`;
    } else if (type === 'all') {
      msg = lang === 'ar'
        ? 'مسح كل سجلات الحضور بالكامل؟\n\nالعملية دي مش ممكن التراجع عنها!'
        : 'Delete ALL attendance records?\n\nThis cannot be undone!';
    } else if (type === 'employee') {
      const empRecords = (attendance[empId] || []).length;
      msg = lang === 'ar'
        ? `مسح سجلات ${empName} لشهر ${monthName}؟ (${empRecords} سجل)`
        : `Delete ${empName}'s ${monthName} records? (${empRecords})`;
    }

    if (!window.confirm(msg)) return;

    try {
      let query = supabase.from('attendance').delete();

      if (type === 'month') {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        query = query.gte('date', startDate).lte('date', endDate);
      } else if (type === 'all') {
        query = query.gte('date', '2000-01-01');
      } else if (type === 'employee') {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        query = query.eq('employee_id', empId).gte('date', startDate).lte('date', endDate);
      }

      const { error } = await query;
      if (error) throw error;
      showToast(lang === 'ar' ? 'تم المسح بنجاح' : 'Deleted successfully', 'success');
      refreshData();
    } catch {
      showToast(lang === 'ar' ? 'فشل في المسح' : 'Delete failed', 'error');
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={7} tableRows={6} tableCols={9} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen pb-16">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center mb-5 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Clock size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الحضور والغياب' : 'Attendance'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{MONTHS_AR[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-content-muted pointer-events-none" />
            <input
              type="text"
              placeholder={lang === 'ar' ? 'بحث بالاسم...' : 'Search name...'}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="ps-8 pe-3 py-1.5 text-xs rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-content dark:text-content-dark w-36"
            />
          </div>
          {/* Department Filter */}
          <Select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
            <option value="">{lang === 'ar' ? 'كل الأقسام' : 'All Depts'}</option>
            {departments.map(d => <option key={d.id} value={d.id}>{isRTL ? d.name_ar : (d.name_en || d.name_ar)}</option>)}
          </Select>
          {/* Status Filter */}
          <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="present">{lang === 'ar' ? 'حاضر' : 'Present'}</option>
            <option value="absent">{lang === 'ar' ? 'غائب' : 'Absent'}</option>
            <option value="late">{lang === 'ar' ? 'متأخر' : 'Late'}</option>
            <option value="leave">{lang === 'ar' ? 'إجازة' : 'Leave'}</option>
            <option value="remote">{lang === 'ar' ? 'عن بعد' : 'Remote'}</option>
          </Select>
          {/* View Toggle */}
          <div className="flex rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'monthly' ? 'bg-brand-500 text-white' : 'bg-surface dark:bg-surface-dark text-content dark:text-content-dark hover:bg-brand-500/10'}`}
            >
              {lang === 'ar' ? 'شهري' : 'Monthly'}
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'weekly' ? 'bg-brand-500 text-white' : 'bg-surface dark:bg-surface-dark text-content dark:text-content-dark hover:bg-brand-500/10'}`}
            >
              {lang === 'ar' ? 'أسبوعي' : 'Weekly'}
            </button>
          </div>
          {viewMode === 'weekly' && (
            <Select value={selectedWeek} onChange={e => setSelectedWeek(+e.target.value)}>
              {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{lang === 'ar' ? `أسبوع ${w}` : `Week ${w}`}</option>)}
            </Select>
          )}
          <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />
          <Select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </Select>
          {allRecords.length > 0 && (
            <div className="relative">
              <Button variant="secondary" size="md" onClick={() => setShowDeleteMenu(!showDeleteMenu)} className="!text-red-500 !border-red-500/30 hover:!bg-red-500/10">
                <Trash2 size={14} />{lang === 'ar' ? 'مسح' : 'Delete'}<ChevronDown size={12} />
              </Button>
              {showDeleteMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDeleteMenu(false)} />
                  <div className={`absolute top-full mt-1 ${isRTL ? 'right-0' : 'left-0'} z-50 w-56 bg-surface dark:bg-surface-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg py-1 overflow-hidden`}>
                    <button
                      onClick={() => handleDelete('month')}
                      className="w-full px-4 py-2.5 text-start text-sm hover:bg-red-500/10 text-content dark:text-content-dark flex items-center gap-2"
                    >
                      <Calendar size={14} className="text-red-500" />
                      {lang === 'ar' ? `مسح شهر ${MONTHS_AR[month - 1]}` : `Clear ${MONTHS_AR[month - 1]}`}
                      <span className="ms-auto text-xs text-content-muted dark:text-content-muted-dark">{allRecords.length}</span>
                    </button>
                    {expandedEmp && (
                      <button
                        onClick={() => handleDelete('employee', expandedEmp)}
                        className="w-full px-4 py-2.5 text-start text-sm hover:bg-red-500/10 text-content dark:text-content-dark flex items-center gap-2"
                      >
                        <Users size={14} className="text-red-500" />
                        {lang === 'ar'
                          ? `مسح ${(employees.find(e => e.id === expandedEmp)?.full_name_ar || '').split(' ')[0]}`
                          : `Clear ${(employees.find(e => e.id === expandedEmp)?.full_name_en || '').split(' ')[0]}`}
                        <span className="ms-auto text-xs text-content-muted dark:text-content-muted-dark">{(attendance[expandedEmp] || []).length}</span>
                      </button>
                    )}
                    <div className="border-t border-edge dark:border-edge-dark my-1" />
                    <button
                      onClick={() => handleDelete('all')}
                      className="w-full px-4 py-2.5 text-start text-sm hover:bg-red-500/10 text-red-500 font-semibold flex items-center gap-2"
                    >
                      <Eraser size={14} />
                      {lang === 'ar' ? 'مسح الكل' : 'Clear All'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <Button variant="secondary" size="md" onClick={() => setShowBulkModal(true)}>
            <CheckCircle2 size={14} />{lang === 'ar' ? 'تسجيل حضور اليوم' : 'Mark Today'}
          </Button>
          <Button variant="secondary" size="md" onClick={() => { setEditRecord(null); setShowForm(true); }}>
            <Plus size={14} />{lang === 'ar' ? 'إضافة سجل' : 'Add Record'}
          </Button>
          <Button size="md" onClick={() => setShowImport(true)}>
            <Upload size={14} />{lang === 'ar' ? 'استيراد البصمة' : 'Import'}
          </Button>
          <ExportButton
            data={employees.map(emp => {
              const recs = attendance[emp.id] || attendance[emp.employee_id] || [];
              const present = recs.filter(r => r.status === 'present' || (r.check_in && r.status !== 'absent' && r.status !== 'leave')).length;
              const absent = recs.filter(r => r.status === 'absent' || r.absent).length;
              const lateRecs = recs.filter(r => {
                if (r.status === 'late') return true;
                if (!r.check_in || r.status === 'absent') return false;
                const [h, m] = r.check_in.split(':').map(Number);
                return h > 10 || (h === 10 && m > 30);
              });
              const lateMins = lateRecs.reduce((sum, r) => {
                if (!r.check_in) return sum;
                const [h, m] = r.check_in.split(':').map(Number);
                const minsLate = (h * 60 + m) - (10 * 60 + 30);
                return sum + (minsLate > 0 ? minsLate : 0);
              }, 0);
              const hours = recs.reduce((sum, r) => {
                if (r.check_in && r.check_out) {
                  const [inH, inM] = r.check_in.split(':').map(Number);
                  const [outH, outM] = r.check_out.split(':').map(Number);
                  const h = (outH + outM / 60) - (inH + inM / 60);
                  return sum + (h > 0 ? h : 0);
                }
                return sum;
              }, 0);
              const rate = recs.length ? Math.round((present / recs.length) * 100) : 0;
              return {
                name: (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '',
                department: emp.department_ar || emp.department || '',
                present_days: present,
                absent_days: absent,
                late_days: lateRecs.length,
                late_minutes: lateMins,
                total_hours: hours.toFixed(1),
                attendance_rate: rate + '%',
                work_mode: emp.work_mode || '',
              };
            })}
            filename={isRTL ? 'الحضور' : 'attendance'}
            title={isRTL ? 'الحضور والغياب' : 'Attendance'}
            columns={[
              { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
              { header: isRTL ? 'القسم' : 'Department', key: 'department' },
              { header: isRTL ? 'أيام الحضور' : 'Present Days', key: 'present_days' },
              { header: isRTL ? 'أيام الغياب' : 'Absent Days', key: 'absent_days' },
              { header: isRTL ? 'أيام التأخير' : 'Late Days', key: 'late_days' },
              { header: isRTL ? 'دقائق التأخير' : 'Late Minutes', key: 'late_minutes' },
              { header: isRTL ? 'إجمالي الساعات' : 'Total Hours', key: 'total_hours' },
              { header: isRTL ? 'نسبة الحضور' : 'Attendance Rate', key: 'attendance_rate' },
              { header: isRTL ? 'نمط العمل' : 'Work Mode', key: 'work_mode' },
            ]}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 mb-5">
        <KpiCard icon={CheckCircle2} label={lang === 'ar' ? 'حاضر' : 'Present'} value={stats.present} color="#4A7AAB" />
        <KpiCard icon={XCircle} label={lang === 'ar' ? 'غائب' : 'Absent'} value={stats.absent} color="#EF4444" />
        <KpiCard icon={AlertCircle} label={lang === 'ar' ? 'متأخر' : 'Late'} value={stats.late} color="#6B8DB5" />
        <KpiCard icon={Calendar} label={lang === 'ar' ? 'إجازة' : 'Leave'} value={stats.leave} color="#8BA8C8" />
        <KpiCard icon={Users} label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={employees.length} color="#6366F1" />
        <KpiCard icon={Users} label={lang === 'ar' ? 'عن بعد' : 'Remote'} value={employees.filter(e => e.work_mode === 'remote').length} color="#14B8A6" />
        <KpiCard icon={CheckCircle2} label={lang === 'ar' ? 'متوسط الحضور' : 'Avg Rate'} value={(() => {
          if (!employees.length) return '0%';
          const rates = employees.map(emp => {
            const recs = attendance[emp.id] || attendance[emp.employee_id] || [];
            const present = recs.filter(r => r.status === 'present' || (r.check_in && r.status !== 'absent' && r.status !== 'leave')).length;
            return recs.length ? (present / recs.length) * 100 : 0;
          });
          return Math.round(rates.reduce((a, b) => a + b, 0) / employees.length) + '%';
        })()} color="#F59E0B" />
      </div>

      {/* Mini Daily Attendance Chart */}
      <div className="flex items-end gap-[2px] h-16 mb-5">
        {Array.from({length: new Date(year, month, 0).getDate()}, (_, i) => i + 1).map(day => {
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dayRecords = allRecords.filter(r => r.date === dateStr && r.status === 'present');
          const pct = employees.length ? (dayRecords.length / employees.length) * 100 : 0;
          const dow = new Date(year, month-1, day).getDay();
          const isFri = dow === 5;
          return (
            <div key={day} className="flex-1 flex flex-col items-center" title={`${day}: ${dayRecords.length} present`}>
              <div style={{height: `${Math.max(pct, 4)}%`}} className={`w-full rounded-t-sm ${isFri ? 'bg-gray-300' : pct > 70 ? 'bg-green-400' : pct > 40 ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span className="text-[7px] text-content-muted mt-0.5">{day}</span>
            </div>
          );
        })}
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium ${
              alert.type === 'danger'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                : alert.type === 'info'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20'
            }`}>
              {alert.type === 'info' ? <Users size={14} /> : <AlertTriangle size={14} />}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Weekly View */}
      {viewMode === 'weekly' && (
        <Card className="overflow-hidden mb-5">
          <CardHeader>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? `أسبوع ${selectedWeek} - ${MONTHS_AR[month - 1]}` : `Week ${selectedWeek} - ${MONTHS_AR[month - 1]}`}
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                  {weekDays.map((d, i) => {
                    const dayOfWeek = new Date(d).getDay();
                    return (
                      <Th key={d} className="text-center min-w-[80px]">
                        <div className="text-xs">{isRTL ? DAY_NAMES_AR[dayOfWeek] : DAY_NAMES_EN[dayOfWeek]}</div>
                        <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{d.slice(8)}</div>
                      </Th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map(emp => {
                  const recs = attendance[emp.id] || attendance[emp.employee_id] || [];
                  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
                  return (
                    <Tr key={emp.id}>
                      <Td className="text-xs font-bold text-content dark:text-content-dark whitespace-nowrap">{name}</Td>
                      {weekDays.map(d => {
                        const rec = recs.find(r => r.date === d);
                        return (
                          <Td key={d} className="text-center">
                            {rec ? (
                              <div>
                                {rec.check_in && <div className="text-[10px] font-mono text-content-muted dark:text-content-muted-dark">{rec.check_in}</div>}
                                <StatusBadge status={rec.status} lang={lang} />
                              </div>
                            ) : (
                              <span className="text-[10px] text-content-muted dark:text-content-muted-dark">—</span>
                            )}
                          </Td>
                        );
                      })}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
        </Card>
      )}

      {/* Attendance Table (Monthly) */}
      {viewMode === 'monthly' && (
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? `حضور ${MONTHS_AR[month - 1]}` : `${MONTHS_AR[month - 1]} Attendance`}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'القسم' : 'Dept',
                lang === 'ar' ? 'حاضر' : 'Present',
                lang === 'ar' ? 'غائب' : 'Absent',
                lang === 'ar' ? 'متأخر' : 'Late',
                lang === 'ar' ? 'نسبة' : 'Rate',
                lang === 'ar' ? 'ساعات' : 'Hours',
                lang === 'ar' ? 'نمط العمل' : 'Work Mode',
                '',
              ].map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {(employees || []).length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Clock size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد بيانات حضور' : 'No Attendance Data'}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لم يتم تسجيل أي بيانات حضور بعد' : 'No attendance records yet'}</p>
                </td>
              </tr>
            ) : paged.map(emp => (
              <AttendanceRow
                key={emp.id}
                emp={emp}
                attendance={attendance}
                isRTL={isRTL}
                lang={lang}
                expanded={expandedEmp === emp.id}
                onToggle={() => setExpandedEmp(expandedEmp === emp.id ? null : emp.id)}
                onEdit={handleEdit}
                onDelete={handleDeleteRecord}
                onQuickStatus={handleQuickStatus}
              />
            ))}
          </tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>
      )}

      {/* Import Modal */}
      <ImportAttendanceModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={refreshData}
      />

      {/* Add/Edit Modal */}
      <AttendanceFormModal
        open={showForm}
        onClose={handleFormClose}
        onSaved={() => { refreshData(); showToast(lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully', 'success'); }}
        employees={employees}
        record={editRecord}
        lang={lang}
        isRTL={isRTL}
      />

      {/* Bulk Mark Today Modal */}
      {showBulkModal && (
        <BulkMarkTodayModal
          open={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          employees={employees}
          onSaved={() => { refreshData(); showToast(lang === 'ar' ? 'تم تسجيل الحضور' : 'Attendance marked', 'success'); }}
          lang={lang}
          isRTL={isRTL}
        />
      )}
    </div>
  );
}
