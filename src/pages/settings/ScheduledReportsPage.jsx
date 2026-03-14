import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarClock, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight,
  Play, Download, ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle,
  FileSpreadsheet, FileText, Mail, User,
} from 'lucide-react';
import {
  getSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule,
  generateReport, getReportHistory,
  REPORT_TYPES, FREQUENCY_OPTIONS, DAY_OF_WEEK,
} from '../../services/scheduledReportService';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import SmartFilter, { applySmartFilters } from '../../components/ui/SmartFilter';
import Pagination from '../../components/ui/Pagination';

// ── Format helpers ───────────────────────────────────────────────────
function fmtDate(iso, isRTL) {
  if (!iso) return isRTL ? '--' : '--';
  const d = new Date(iso);
  return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso, isRTL) {
  if (!iso) return isRTL ? 'لم يتم بعد' : 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyState({ isRTL, isDark, onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <CalendarClock size={28} color="#4A7AAB" />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
        {isRTL ? 'لا توجد تقارير مجدولة' : 'No Scheduled Reports'}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
        {isRTL ? 'أنشئ جدول زمني لإنشاء التقارير تلقائيا' : 'Create schedules to auto-generate reports'}
      </p>
      <button onClick={onAdd} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
      }}>
        <Plus size={15} />
        {isRTL ? 'إضافة جدول' : 'New Schedule'}
      </button>
    </div>
  );
}

// ── Schedule Modal ───────────────────────────────────────────────────
function ScheduleModal({ schedule, onClose, onSave, isRTL, isDark }) {
  const isEdit = !!schedule?.id;
  const [form, setForm] = useState({
    name: schedule?.name || '',
    reportType: schedule?.reportType || 'sales_summary',
    frequency: schedule?.frequency || 'weekly',
    dayOfWeek: schedule?.dayOfWeek ?? 0,
    dayOfMonth: schedule?.dayOfMonth ?? 1,
    time: schedule?.time || '09:00',
    format: schedule?.format || 'excel',
    recipients: schedule?.recipients || [],
    filters: schedule?.filters || {},
    enabled: schedule?.enabled !== false,
  });

  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' });

  const addRecipient = () => {
    if (!newRecipient.name.trim() || !newRecipient.email.trim()) return;
    setForm(f => ({ ...f, recipients: [...f.recipients, { ...newRecipient }] }));
    setNewRecipient({ name: '', email: '' });
  };

  const removeRecipient = (i) => {
    setForm(f => ({ ...f, recipients: f.recipients.filter((_, idx) => idx !== i) }));
  };

  const canSave = form.name.trim() && form.reportType && form.frequency;

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
    background: isDark ? '#0f2440' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'auto' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1a2332' : '#ffffff',
          borderRadius: 16, width: '100%', maxWidth: 600,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarClock size={18} color="#4A7AAB" />
            <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isEdit ? (isRTL ? 'تعديل الجدول' : 'Edit Schedule') : (isRTL ? 'جدول تقرير جديد' : 'New Report Schedule')}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Name */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{isRTL ? 'اسم الجدول' : 'Schedule Name'}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle}
              placeholder={isRTL ? 'مثال: تقرير المبيعات الأسبوعي' : 'e.g. Weekly Sales Report'} />
          </div>

          {/* Report Type + Format */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'نوع التقرير' : 'Report Type'}</label>
              <select value={form.reportType} onChange={e => setForm(f => ({ ...f, reportType: e.target.value }))} style={selectStyle}>
                {Object.entries(REPORT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'صيغة الملف' : 'Format'}</label>
              <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} style={selectStyle}>
                <option value="excel">{isRTL ? 'إكسل (.xlsx)' : 'Excel (.xlsx)'}</option>
                <option value="csv">{isRTL ? 'CSV' : 'CSV'}</option>
              </select>
            </div>
          </div>

          {/* Frequency + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'التكرار' : 'Frequency'}</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} style={selectStyle}>
                {Object.entries(FREQUENCY_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الوقت' : 'Time'}</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Day of week (if weekly) */}
          {form.frequency === 'weekly' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{isRTL ? 'يوم الأسبوع' : 'Day of Week'}</label>
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))} style={selectStyle}>
                {DAY_OF_WEEK.map(d => (
                  <option key={d.value} value={d.value}>{isRTL ? d.ar : d.en}</option>
                ))}
              </select>
            </div>
          )}

          {/* Day of month (if monthly) */}
          {form.frequency === 'monthly' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{isRTL ? 'يوم الشهر' : 'Day of Month'}</label>
              <select value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))} style={selectStyle}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Enabled toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              {form.enabled
                ? <ToggleRight size={28} color="#4A7AAB" />
                : <ToggleLeft size={28} color={isDark ? '#475569' : '#94a3b8'} />
              }
            </button>
            <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {form.enabled ? (isRTL ? 'مفعّل' : 'Enabled') : (isRTL ? 'معطّل' : 'Disabled')}
            </span>
          </div>

          {/* Filters: date range */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4A7AAB', marginBottom: 8 }}>
            {isRTL ? 'الفلاتر' : 'Filters'}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{isRTL ? 'نطاق التاريخ' : 'Date Range'}</label>
            <select value={form.filters.dateRange || 'all'} onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, dateRange: e.target.value } }))} style={selectStyle}>
              <option value="all">{isRTL ? 'الكل' : 'All Time'}</option>
              <option value="this_month">{isRTL ? 'هذا الشهر' : 'This Month'}</option>
              <option value="last_3_months">{isRTL ? 'آخر 3 أشهر' : 'Last 3 Months'}</option>
              <option value="last_6_months">{isRTL ? 'آخر 6 أشهر' : 'Last 6 Months'}</option>
              <option value="this_year">{isRTL ? 'هذه السنة' : 'This Year'}</option>
            </select>
          </div>

          {/* Recipients */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4A7AAB', marginBottom: 8 }}>
            {isRTL ? 'المستلمين' : 'Recipients'}
          </div>
          {form.recipients.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              padding: '6px 10px', borderRadius: 8,
              background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)',
              border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            }}>
              <User size={14} color={isDark ? '#94a3b8' : '#64748b'} />
              <span style={{ flex: 1, fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {r.name} ({r.email})
              </span>
              <button onClick={() => removeRecipient(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={newRecipient.name} onChange={e => setNewRecipient(r => ({ ...r, name: e.target.value }))}
              placeholder={isRTL ? 'الاسم' : 'Name'} style={{ ...inputStyle, flex: 1 }} />
            <input value={newRecipient.email} onChange={e => setNewRecipient(r => ({ ...r, email: e.target.value }))}
              placeholder={isRTL ? 'البريد' : 'Email'} style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }} />
            <button onClick={addRecipient} style={{
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isDark ? '#1e3a5f' : '#e2e8f0', color: isDark ? '#e2e8f0' : '#1e293b',
              fontSize: 12, fontWeight: 600, flexShrink: 0,
            }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'none', cursor: 'pointer',
            border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            color: isDark ? '#94a3b8' : '#64748b',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => onSave(form)} disabled={!canSave} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: canSave ? '#4A7AAB' : (isDark ? '#1e3a5f' : '#e2e8f0'),
            color: canSave ? '#fff' : (isDark ? '#475569' : '#94a3b8'),
            border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
          }}>
            {isEdit ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء الجدول' : 'Create Schedule')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────
function DeleteModal({ schedule, onClose, onConfirm, isRTL, isDark }) {
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: isDark ? '#1a2332' : '#ffffff', borderRadius: 16, width: '100%', maxWidth: 400,
        padding: 24, border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
          {isRTL ? 'حذف الجدول' : 'Delete Schedule'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
          {isRTL
            ? `هل أنت متأكد من حذف "${schedule.name}"؟ سيتم حذف كل السجلات المرتبطة.`
            : `Are you sure you want to delete "${schedule.name}"? All related history will be removed.`}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            color: isDark ? '#94a3b8' : '#64748b',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: '#ef4444', color: '#fff', border: 'none',
          }}>
            {isRTL ? 'حذف' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History Row ──────────────────────────────────────────────────────
function HistoryRow({ entry, isRTL, isDark, onDownload }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 8, marginBottom: 4,
      background: isDark ? 'rgba(74,122,171,0.04)' : 'rgba(74,122,171,0.02)',
      border: `1px solid ${isDark ? '#1e3a5f22' : '#e2e8f022'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {entry.status === 'success'
          ? <CheckCircle size={14} color="#10B981" />
          : <AlertCircle size={14} color="#ef4444" />
        }
        <span style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b' }}>
          {fmtDate(entry.generatedAt, isRTL)}
        </span>
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 4,
          background: entry.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: entry.status === 'success' ? '#10B981' : '#ef4444',
          fontWeight: 600,
        }}>
          {entry.status === 'success' ? (isRTL ? 'ناجح' : 'Success') : (isRTL ? 'خطأ' : 'Error')}
        </span>
      </div>
      {entry.status === 'success' && (
        <button onClick={() => onDownload(entry)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: isDark ? '#1e3a5f' : '#e2e8f0', color: isDark ? '#e2e8f0' : '#1e293b',
          border: 'none', cursor: 'pointer',
        }}>
          <Download size={12} />
          {isRTL ? 'تحميل' : 'Download'}
        </button>
      )}
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────
export default function ScheduledReportsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [schedules, setSchedules] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState({});
  const [runningId, setRunningId] = useState(null);
  const [toast, setToast] = useState(null);

  // SmartFilter state
  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('scheduled_report');

  const reload = useCallback(() => {
    setSchedules(getSchedules());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Show toast
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── SmartFilter fields ─────────────────────────────────────────────
  const SMART_FIELDS = useMemo(() => [
    {
      id: 'reportType', label: 'نوع التقرير', labelEn: 'Report Type', type: 'select',
      options: Object.entries(REPORT_TYPES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
    },
    {
      id: 'frequency', label: 'التكرار', labelEn: 'Frequency', type: 'select',
      options: Object.entries(FREQUENCY_OPTIONS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
    },
    {
      id: 'enabled', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'true', label: 'مفعّل', labelEn: 'Active' },
        { value: 'false', label: 'معطّل', labelEn: 'Inactive' },
      ],
    },
    ...auditFields,
  ], [auditFields]);

  // ── Filter & paginate ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...schedules];

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (REPORT_TYPES[s.reportType]?.en || '').toLowerCase().includes(q) ||
        (REPORT_TYPES[s.reportType]?.ar || '').includes(q)
      );
    }

    // Convert enabled to string for smart filter matching
    const withStringEnabled = data.map(s => ({ ...s, enabled_str: String(s.enabled) }));

    // Map smart filters: remap 'enabled' field to 'enabled_str'
    const mappedFilters = smartFilters.map(f =>
      f.field === 'enabled' ? { ...f, field: 'enabled_str' } : f
    );

    data = applySmartFilters(withStringEnabled, mappedFilters, SMART_FIELDS.map(f =>
      f.id === 'enabled' ? { ...f, id: 'enabled_str' } : f
    ));

    // Restore original objects
    data = data.map(d => schedules.find(s => s.id === d.id)).filter(Boolean);

    // audit filters
    data = applyAuditFilters(data, smartFilters);

    return data;
  }, [schedules, search, smartFilters, SMART_FIELDS, applyAuditFilters]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── KPI stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = schedules.length;
    const active = schedules.filter(s => s.enabled).length;
    const lastGen = schedules
      .filter(s => s.lastRun)
      .sort((a, b) => new Date(b.lastRun) - new Date(a.lastRun))[0];
    const nextDue = schedules
      .filter(s => s.enabled && s.nextRun)
      .sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun))[0];
    return { total, active, lastGen, nextDue };
  }, [schedules]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleSave = (form) => {
    if (editSchedule?.id) {
      updateSchedule(editSchedule.id, form);
      logAction({ action: 'update', entity: 'scheduled_report', entityId: editSchedule.id, entityName: form.name, description: `Updated scheduled report: ${form.name}`, userName: profile?.full_name || 'User' });
      showToast(isRTL ? 'تم تحديث الجدول' : 'Schedule updated');
    } else {
      const created = createSchedule({ ...form, created_by: profile?.full_name || 'User' });
      logAction({ action: 'create', entity: 'scheduled_report', entityId: created.id, entityName: form.name, description: `Created scheduled report: ${form.name}`, userName: profile?.full_name || 'User' });
      showToast(isRTL ? 'تم إنشاء الجدول' : 'Schedule created');
    }
    setModalOpen(false);
    setEditSchedule(null);
    reload();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    logAction({ action: 'delete', entity: 'scheduled_report', entityId: deleteTarget.id, entityName: deleteTarget.name, description: `Deleted scheduled report: ${deleteTarget.name}`, userName: profile?.full_name || 'User' });
    deleteSchedule(deleteTarget.id);
    setDeleteTarget(null);
    showToast(isRTL ? 'تم حذف الجدول' : 'Schedule deleted');
    reload();
  };

  const handleToggle = (id) => {
    const result = toggleSchedule(id);
    if (result) {
      logAction({ action: 'update', entity: 'scheduled_report', entityId: id, entityName: result.name, description: `${result.enabled ? 'Enabled' : 'Disabled'} scheduled report: ${result.name}`, userName: profile?.full_name || 'User' });
    }
    reload();
  };

  const handleRunNow = async (schedule) => {
    setRunningId(schedule.id);
    try {
      await generateReport(schedule.id);
      logAction({ action: 'create', entity: 'scheduled_report', entityId: schedule.id, entityName: schedule.name, description: `Generated report: ${schedule.name}`, userName: profile?.full_name || 'User' });
      showToast(isRTL ? 'تم إنشاء التقرير بنجاح' : 'Report generated successfully');
    } catch {
      showToast(isRTL ? 'خطأ في إنشاء التقرير' : 'Error generating report');
    }
    setRunningId(null);
    reload();
  };

  const handleDownload = async (entry) => {
    if (!entry.data || entry.data.length === 0) {
      showToast(isRTL ? 'لا توجد بيانات للتحميل' : 'No data to download');
      return;
    }
    const filename = `${entry.reportName || 'report'}_${new Date(entry.generatedAt).toISOString().slice(0, 10)}`;
    if (entry.format === 'csv') {
      exportToCSV(entry.data, filename);
    } else {
      await exportToExcel(entry.data, filename, entry.reportName || 'Report');
    }
  };

  const toggleHistory = (id) => {
    setExpandedHistory(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Styles ─────────────────────────────────────────────────────────
  const cardStyle = {
    background: isDark ? '#1a2332' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
    padding: '16px 20px',
  };

  const kpiCardStyle = (accent) => ({
    ...cardStyle,
    borderTop: `3px solid ${accent}`,
    flex: '1 1 200px',
    minWidth: 180,
  });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 28px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'التقارير المجدولة' : 'Scheduled Reports'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
            {isRTL ? 'إدارة التقارير المجدولة والتاريخ' : 'Manage report schedules and history'}
          </p>
        </div>
        <button onClick={() => { setEditSchedule(null); setModalOpen(true); }} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={16} />
          {isRTL ? 'جدول جديد' : 'New Schedule'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={kpiCardStyle('#4A7AAB')}>
          <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
            {isRTL ? 'إجمالي الجداول' : 'Total Schedules'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: isDark ? '#e2e8f0' : '#1e293b' }}>{stats.total}</div>
        </div>
        <div style={kpiCardStyle('#10B981')}>
          <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
            {isRTL ? 'نشط' : 'Active'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>{stats.active}</div>
        </div>
        <div style={kpiCardStyle('#F59E0B')}>
          <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
            {isRTL ? 'آخر إنشاء' : 'Last Generated'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginTop: 4 }}>
            {stats.lastGen ? timeAgo(stats.lastGen.lastRun, isRTL) : (isRTL ? 'لا يوجد' : 'None')}
          </div>
        </div>
        <div style={kpiCardStyle('#8B5CF6')}>
          <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
            {isRTL ? 'التالي' : 'Next Due'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginTop: 4 }}>
            {stats.nextDue ? timeAgo(stats.nextDue.nextRun, isRTL) : (isRTL ? 'لا يوجد' : 'None')}
          </div>
        </div>
      </div>

      {/* Smart Filter */}
      <div style={{ marginBottom: 16 }}>
        <SmartFilter
          fields={SMART_FIELDS}
          filters={smartFilters}
          onFiltersChange={f => { setSmartFilters(f); setPage(1); }}
          search={search}
          onSearchChange={v => { setSearch(v); setPage(1); }}
          searchPlaceholder={isRTL ? 'بحث في الجداول...' : 'Search schedules...'}
          resultsCount={filtered.length}
        />
      </div>

      {/* Table or empty */}
      {paginated.length === 0 ? (
        <EmptyState isRTL={isRTL} isDark={isDark} onAdd={() => { setEditSchedule(null); setModalOpen(true); }} />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1.2fr 80px 120px',
            gap: 8, padding: '12px 16px',
            borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            background: isDark ? '#132337' : '#f8fafc',
            fontSize: 11, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b',
          }}>
            <span>{isRTL ? 'الاسم' : 'Name'}</span>
            <span>{isRTL ? 'نوع التقرير' : 'Report Type'}</span>
            <span>{isRTL ? 'التكرار' : 'Frequency'}</span>
            <span>{isRTL ? 'التالي' : 'Next Run'}</span>
            <span>{isRTL ? 'آخر تشغيل' : 'Last Run'}</span>
            <span>{isRTL ? 'الحالة' : 'Status'}</span>
            <span style={{ textAlign: 'center' }}>{isRTL ? 'إجراءات' : 'Actions'}</span>
          </div>

          {/* Rows */}
          {paginated.map(schedule => {
            const rt = REPORT_TYPES[schedule.reportType] || {};
            const freq = FREQUENCY_OPTIONS[schedule.frequency] || {};
            const history = expandedHistory[schedule.id] ? getReportHistory(schedule.id) : [];
            const isRunning = runningId === schedule.id;

            return (
              <div key={schedule.id}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1.2fr 80px 120px',
                  gap: 8, padding: '12px 16px', alignItems: 'center',
                  borderBottom: `1px solid ${isDark ? '#1e3a5f22' : '#e2e8f022'}`,
                  transition: 'background 0.15s',
                }}>
                  {/* Name */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {schedule.name}
                    </div>
                    {schedule.recipients.length > 0 && (
                      <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={10} />
                        {schedule.recipients.length} {isRTL ? 'مستلم' : 'recipient(s)'}
                      </div>
                    )}
                  </div>

                  {/* Report Type Badge */}
                  <div>
                    <span style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 600,
                      padding: '3px 8px', borderRadius: 6,
                      background: `${rt.color || '#4A7AAB'}18`,
                      color: rt.color || '#4A7AAB',
                    }}>
                      {isRTL ? rt.ar : rt.en}
                    </span>
                  </div>

                  {/* Frequency Badge */}
                  <div>
                    <span style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 600,
                      padding: '3px 8px', borderRadius: 6,
                      background: `${freq.color || '#3B82F6'}18`,
                      color: freq.color || '#3B82F6',
                    }}>
                      {isRTL ? freq.ar : freq.en}
                    </span>
                  </div>

                  {/* Next Run */}
                  <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {schedule.enabled ? fmtDate(schedule.nextRun, isRTL) : (isRTL ? 'معطّل' : 'Disabled')}
                  </div>

                  {/* Last Run */}
                  <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {timeAgo(schedule.lastRun, isRTL)}
                  </div>

                  {/* Toggle */}
                  <div>
                    <button onClick={() => handleToggle(schedule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      {schedule.enabled
                        ? <ToggleRight size={24} color="#10B981" />
                        : <ToggleLeft size={24} color={isDark ? '#475569' : '#94a3b8'} />
                      }
                    </button>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button
                      onClick={() => handleRunNow(schedule)}
                      disabled={isRunning}
                      title={isRTL ? 'تشغيل الآن' : 'Run Now'}
                      style={{
                        background: 'none', border: 'none', cursor: isRunning ? 'wait' : 'pointer',
                        padding: 4, color: '#10B981', opacity: isRunning ? 0.5 : 1,
                      }}
                    >
                      <Play size={15} />
                    </button>
                    <button
                      onClick={() => { setEditSchedule(schedule); setModalOpen(true); }}
                      title={isRTL ? 'تعديل' : 'Edit'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#4A7AAB' }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(schedule)}
                      title={isRTL ? 'حذف' : 'Delete'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#ef4444' }}
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => toggleHistory(schedule.id)}
                      title={isRTL ? 'السجل' : 'History'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isDark ? '#94a3b8' : '#64748b' }}
                    >
                      {expandedHistory[schedule.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded History */}
                {expandedHistory[schedule.id] && (
                  <div style={{
                    padding: '8px 16px 12px',
                    background: isDark ? '#0f1d2e' : '#f1f5f9',
                    borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>
                      {isRTL ? 'سجل التقارير' : 'Report History'}
                    </div>
                    {history.length === 0 ? (
                      <div style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', padding: '8px 0' }}>
                        {isRTL ? 'لا يوجد سجل' : 'No history yet'}
                      </div>
                    ) : (
                      history.slice(0, 10).map(entry => (
                        <HistoryRow key={entry.id} entry={entry} isRTL={isRTL} isDark={isDark} onDownload={handleDownload} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={v => { setPageSize(v); setPage(1); }}
            totalItems={filtered.length}
          />
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ScheduleModal
          schedule={editSchedule}
          onClose={() => { setModalOpen(false); setEditSchedule(null); }}
          onSave={handleSave}
          isRTL={isRTL}
          isDark={isDark}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteModal
          schedule={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isRTL={isRTL}
          isDark={isDark}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24,
          left: '50%', transform: 'translateX(-50%)',
          padding: '10px 24px', borderRadius: 10,
          background: isDark ? '#1a2332' : '#1e293b',
          color: '#fff', fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          border: '1px solid rgba(74,122,171,0.3)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
