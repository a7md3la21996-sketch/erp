import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { fetchAttendance } from '../../services/attendanceService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { useToast } from '../../contexts/ToastContext';
import { Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Upload, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Eraser } from 'lucide-react';
import { KpiCard, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton, ExportButton, Select, Button, Pagination, SmartFilter, applySmartFilters } from '../../components/ui';
import ImportAttendanceModal from '../../components/hr/ImportAttendanceModal';
import supabase from '../../lib/supabase';

// ── Add/Edit Attendance Modal ────────────────────────────────

function AttendanceFormModal({ open, onClose, onSaved, employees, record, lang, isRTL }) {
  const isEdit = !!record;
  const [employeeId, setEmployeeId] = useState(record?.employee_id || '');
  const [date, setDate] = useState(record?.date || new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState(record?.check_in || '');
  const [checkOut, setCheckOut] = useState(record?.check_out || '');
  const [status, setStatus] = useState(record?.status || 'present');
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
              { value: 'absent', label: lang === 'ar' ? 'غائب' : 'Absent', color: 'bg-red-500/15 text-red-600 border-red-500/30' },
              { value: 'late', label: lang === 'ar' ? 'متأخر' : 'Late', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
              { value: 'leave', label: lang === 'ar' ? 'إجازة' : 'Leave', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
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

function EmployeeDetailRows({ emp, records, isRTL, lang, onEdit, onDelete }) {
  if (!records.length) {
    return (
      <Tr>
        <td colSpan={7} className="px-6 py-4 text-center text-xs text-content-muted dark:text-content-muted-dark bg-surface-bg dark:bg-surface-bg-dark">
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
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
          rec.status === 'present' ? 'bg-green-500/15 text-green-600' :
          rec.status === 'absent' ? 'bg-red-500/15 text-red-500' :
          rec.status === 'late' ? 'bg-yellow-500/15 text-yellow-600' :
          rec.status === 'leave' ? 'bg-blue-500/15 text-blue-600' :
          'bg-slate-500/15 text-slate-500'
        }`}>
          {rec.status === 'present' ? (lang === 'ar' ? 'حاضر' : 'Present') :
           rec.status === 'absent' ? (lang === 'ar' ? 'غائب' : 'Absent') :
           rec.status === 'late' ? (lang === 'ar' ? 'متأخر' : 'Late') :
           rec.status === 'leave' ? (lang === 'ar' ? 'إجازة' : 'Leave') :
           rec.status}
        </span>
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

function AttendanceRow({ emp, attendance, isRTL, lang, expanded, onToggle, onEdit, onDelete }) {
  const recs = attendance[emp.id] || attendance[emp.employee_id] || [];
  const p = recs.filter(r => r.status === 'present' || (r.check_in && r.status !== 'absent' && r.status !== 'leave')).length;
  const a = recs.filter(r => r.status === 'absent' || r.absent).length;
  const l = recs.filter(r => {
    if (r.status === 'late') return true;
    if (!r.check_in || r.status === 'absent') return false;
    const [h, m] = (r.check_in || '').split(':').map(Number);
    return h > 10 || (h === 10 && m > 30);
  }).length;
  const total = recs.length || 1;
  const rate = Math.round((p / total) * 100);
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
  const ini = name.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || '??';

  return (
    <>
      <Tr className="cursor-pointer hover:bg-brand-500/5 transition-colors" onClick={onToggle}>
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
        <Td>
          {expanded ? <ChevronUp size={14} className="text-content-muted" /> : <ChevronDown size={14} className="text-content-muted" />}
        </Td>
      </Tr>
      {expanded && (
        <EmployeeDetailRows emp={emp} records={recs} isRTL={isRTL} lang={lang} onEdit={onEdit} onDelete={onDelete} />
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AttendancePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year] = useState(() => new Date().getFullYear());
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
  const { showToast } = useToast();

  const { auditFields, applyAuditFilters } = useAuditFilter('attendance');

  const refreshData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchEmployees(),
      fetchAttendance({ month, year }),
    ]).then(([empData, attData]) => {
      setEmployees(empData);
      setAllRecords(attData);
      setLoading(false);
    });
  }, [month, year]);

  useEffect(() => { refreshData(); }, [refreshData]);

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
    return result;
  }, [employees, smartFilters, SMART_FIELDS]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [month]);

  const handleEdit = (rec) => {
    setEditRecord(rec);
    setShowForm(true);
  };

  const handleDelete = async (rec) => {
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

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const handleClearMonth = async () => {
    const monthName = MONTHS_AR[month - 1];
    const msg = lang === 'ar'
      ? `متأكد إنك عايز تمسح كل سجلات حضور شهر ${monthName} ${year}؟\n\nعدد السجلات: ${allRecords.length}\n\nالعملية دي مش ممكن التراجع عنها!`
      : `Are you sure you want to delete all attendance records for ${monthName} ${year}?\n\nRecords: ${allRecords.length}\n\nThis cannot be undone!`;
    if (!window.confirm(msg)) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);
      if (error) throw error;
      showToast(lang === 'ar' ? `تم مسح سجلات ${monthName}` : `${monthName} records cleared`, 'success');
      refreshData();
    } catch {
      showToast(lang === 'ar' ? 'فشل في المسح' : 'Clear failed', 'error');
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={7} />
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
          <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />
          <Select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </Select>
          {allRecords.length > 0 && (
            <Button variant="secondary" size="md" onClick={handleClearMonth} className="!text-red-500 !border-red-500/30 hover:!bg-red-500/10">
              <Eraser size={14} />{lang === 'ar' ? 'مسح الشهر' : 'Clear Month'}
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={() => { setEditRecord(null); setShowForm(true); }}>
            <Plus size={14} />{lang === 'ar' ? 'إضافة سجل' : 'Add Record'}
          </Button>
          <Button size="md" onClick={() => setShowImport(true)}>
            <Upload size={14} />{lang === 'ar' ? 'استيراد البصمة' : 'Import'}
          </Button>
          <ExportButton
            data={allRecords}
            filename={isRTL ? 'الحضور' : 'attendance'}
            title={isRTL ? 'الحضور والغياب' : 'Attendance'}
            columns={[
              { header: isRTL ? 'رقم الموظف' : 'Employee ID', key: 'employee_id' },
              { header: isRTL ? 'التاريخ' : 'Date', key: 'date' },
              { header: isRTL ? 'وقت الحضور' : 'Check In', key: 'check_in' },
              { header: isRTL ? 'وقت الانصراف' : 'Check Out', key: 'check_out' },
              { header: isRTL ? 'الحالة' : 'Status', key: 'status' },
            ]}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={CheckCircle2} label={lang === 'ar' ? 'حاضر' : 'Present'} value={stats.present} color="#4A7AAB" />
        <KpiCard icon={XCircle} label={lang === 'ar' ? 'غائب' : 'Absent'} value={stats.absent} color="#EF4444" />
        <KpiCard icon={AlertCircle} label={lang === 'ar' ? 'متأخر' : 'Late'} value={stats.late} color="#6B8DB5" />
        <KpiCard icon={Calendar} label={lang === 'ar' ? 'إجازة' : 'Leave'} value={stats.leave} color="#8BA8C8" />
      </div>

      {/* Attendance Table */}
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
                '',
              ].map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {(employees || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 px-5">
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
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>

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
    </div>
  );
}
