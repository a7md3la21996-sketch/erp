import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useDebouncedSearch from '../hooks/useDebouncedSearch';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  CheckSquare, Plus, X, Clock, Phone, PhoneCall,
  Users, Mail, MessageCircle, Trash2, Check,
  User, CloudOff, Repeat, ToggleLeft, ToggleRight,
  Edit3, SkipForward, Calendar, AlertCircle
} from 'lucide-react';
import { fetchTasks, createTask, updateTask, deleteTask, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../services/tasksService';
import { Button, Card, Input, Select, Textarea, Badge, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';
import { logAction } from '../services/auditService';
import { notifyTaskAssigned } from '../services/notificationsService';
import {
  getRecurringTasks, createRecurringTask, updateRecurringTask, deleteRecurringTask,
  toggleRecurringTask, generateDueInstances, getTodayInstances, completeInstance,
  skipInstance, getNextDueDate, FREQUENCIES, PRIORITY_OPTIONS, DAY_NAMES
} from '../services/recurringTaskService';

const ICONS = { Phone, PhoneCall, Users, Mail, MessageCircle, CheckSquare };

function formatDue(dateStr, lang) {
  const diff = Math.floor((new Date(dateStr) - Date.now()) / 60000);
  const abs  = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60)    return { label: past ? (lang==='ar'?`تأخر ${abs}د`:`${abs}m overdue`) : (lang==='ar'?`خلال ${abs}د`:`in ${abs}m`), overdue: past };
  if (abs < 1440)  return { label: past ? (lang==='ar'?`تأخر ${Math.floor(abs/60)}س`:`${Math.floor(abs/60)}h overdue`) : (lang==='ar'?`خلال ${Math.floor(abs/60)}س`:`in ${Math.floor(abs/60)}h`), overdue: past };
  return { label: new Date(dateStr).toLocaleDateString(lang==='ar'?'ar-EG':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}), overdue: past };
}

// ── Recurring Task Modal ─────────────────────────────────────────────
function RecurringTaskModal({ open, onClose, onSave, editTask, lang, isRTL, isDark }) {
  const emptyForm = {
    title: '', titleAr: '', description: '', frequency: 'daily', interval: 1,
    daysOfWeek: [], dayOfMonth: 1, time: '09:00',
    assigneeName: '', priority: 'medium', reminderMinutes: 30,
    entity: '', entityName: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title || '',
        titleAr: editTask.titleAr || '',
        description: editTask.description || '',
        frequency: editTask.frequency || 'daily',
        interval: editTask.interval || 1,
        daysOfWeek: editTask.daysOfWeek || [],
        dayOfMonth: editTask.dayOfMonth || 1,
        time: editTask.time || '09:00',
        assigneeName: editTask.assigneeName || '',
        priority: editTask.priority || 'medium',
        reminderMinutes: editTask.reminderMinutes ?? 30,
        entity: editTask.entity || '',
        entityName: editTask.entityName || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editTask, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { onSave(form); }
    finally { setSaving(false); onClose(); }
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter(d => d !== day)
        : [...f.daysOfWeek, day],
    }));
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  };
  const backdropStyle = {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
  };
  const modalStyle = {
    position: 'relative', width: '100%', maxWidth: 560, margin: '0 16px',
    maxHeight: '85vh', overflowY: 'auto', zIndex: 1,
    background: isDark ? '#1a2332' : '#ffffff',
    borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
  };
  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };
  const bodyStyle = { padding: '20px 24px' };
  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6,
    color: isDark ? '#94a3b8' : '#64748b',
  };
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    background: isDark ? '#0a1929' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none', boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, appearance: 'auto' };
  const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 };
  const footerStyle = {
    display: 'flex', gap: 8, justifyContent: isRTL ? 'flex-start' : 'flex-end',
    padding: '16px 24px', borderTop: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  return (
    <div style={overlayStyle} dir={isRTL ? 'rtl' : 'ltr'}>
      <div style={backdropStyle} onClick={onClose} />
      <div style={modalStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {editTask
              ? (lang === 'ar' ? 'تعديل مهمة متكررة' : 'Edit Recurring Task')
              : (lang === 'ar' ? 'إضافة مهمة متكررة' : 'Add Recurring Task')}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isDark ? '#94a3b8' : '#64748b' }}>
            <X size={18} />
          </button>
        </div>
        <div style={bodyStyle}>
          {/* Title EN */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{lang === 'ar' ? 'العنوان (English)' : 'Title (English)'}</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={lang === 'ar' ? 'عنوان المهمة بالإنجليزية...' : 'Task title...'} />
          </div>
          {/* Title AR */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{lang === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
            <input style={{ ...inputStyle, direction: 'rtl' }} value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))}
              placeholder={lang === 'ar' ? 'عنوان المهمة...' : 'Task title in Arabic...'} />
          </div>
          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{lang === 'ar' ? 'الوصف' : 'Description'}</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={lang === 'ar' ? 'وصف المهمة...' : 'Task description...'} />
          </div>
          {/* Frequency + Interval */}
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'التكرار' : 'Frequency'}</label>
              <select style={selectStyle} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {Object.entries(FREQUENCIES).map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'كل (فاصل)' : 'Interval'}</label>
              <input style={inputStyle} type="number" min={1} max={12} value={form.interval}
                onChange={e => setForm(f => ({ ...f, interval: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          {/* Days of week for weekly */}
          {form.frequency === 'weekly' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{lang === 'ar' ? 'أيام الأسبوع' : 'Days of Week'}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {Object.entries(DAY_NAMES).map(([k, v]) => {
                  const day = parseInt(k);
                  const selected = form.daysOfWeek.includes(day);
                  return (
                    <button key={k} onClick={() => toggleDay(day)} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: selected ? '2px solid #4A7AAB' : `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
                      background: selected ? (isDark ? '#4A7AAB22' : '#4A7AAB14') : 'transparent',
                      color: selected ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                    }}>
                      {lang === 'ar' ? v.ar : v.en}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Day of month for monthly/quarterly/yearly */}
          {['monthly', 'quarterly', 'yearly'].includes(form.frequency) && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{lang === 'ar' ? 'يوم في الشهر' : 'Day of Month'}</label>
              <input style={inputStyle} type="number" min={1} max={28} value={form.dayOfMonth}
                onChange={e => setForm(f => ({ ...f, dayOfMonth: parseInt(e.target.value) || 1 }))} />
            </div>
          )}
          {/* Time + Priority */}
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'الوقت' : 'Time'}</label>
              <input style={inputStyle} type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'الأولوية' : 'Priority'}</label>
              <select style={selectStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {Object.entries(PRIORITY_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Assignee + Reminder */}
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'المسؤول' : 'Assignee'}</label>
              <input style={inputStyle} value={form.assigneeName}
                onChange={e => setForm(f => ({ ...f, assigneeName: e.target.value }))}
                placeholder={lang === 'ar' ? 'اسم المسؤول...' : 'Assignee name...'} />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'تذكير (دقائق قبل)' : 'Reminder (min before)'}</label>
              <input style={inputStyle} type="number" min={0} max={1440} value={form.reminderMinutes}
                onChange={e => setForm(f => ({ ...f, reminderMinutes: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          {/* Entity link */}
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'نوع الكيان (اختياري)' : 'Entity Type (optional)'}</label>
              <select style={selectStyle} value={form.entity || ''} onChange={e => setForm(f => ({ ...f, entity: e.target.value }))}>
                <option value="">{lang === 'ar' ? '-- بدون --' : '-- None --'}</option>
                <option value="contact">{lang === 'ar' ? 'جهة اتصال' : 'Contact'}</option>
                <option value="opportunity">{lang === 'ar' ? 'فرصة' : 'Opportunity'}</option>
                <option value="deal">{lang === 'ar' ? 'صفقة' : 'Deal'}</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'اسم الكيان' : 'Entity Name'}</label>
              <input style={inputStyle} value={form.entityName}
                onChange={e => setForm(f => ({ ...f, entityName: e.target.value }))}
                placeholder={lang === 'ar' ? 'اختياري...' : 'Optional...'} />
            </div>
          </div>
        </div>
        <div style={footerStyle}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
            background: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
          }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', background: '#4A7AAB', color: '#fff',
            opacity: (!form.title.trim() || saving) ? 0.5 : 1,
          }}>
            {saving ? '...' : (lang === 'ar' ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring Tab Content ────────────────────────────────────────────
function RecurringTab({ lang, isRTL, isDark, profile }) {
  const [recTasks, setRecTasks] = useState([]);
  const [instances, setInstances] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const loadData = useCallback(() => {
    generateDueInstances();
    setRecTasks(getRecurringTasks());
    setInstances(getTodayInstances());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const userName = profile?.full_name_ar || profile?.full_name_en || '';

  const handleSave = (formData) => {
    if (editingTask) {
      updateRecurringTask(editingTask.id, formData);
      logAction({ action: 'update', entity: 'recurring_task', entityId: editingTask.id, entityName: formData.title, description: 'Updated recurring task', userName });
    } else {
      const t = createRecurringTask(formData);
      logAction({ action: 'create', entity: 'recurring_task', entityId: t.id, entityName: formData.title, description: 'Created recurring task', userName });
    }
    setEditingTask(null);
    loadData();
  };

  const handleDelete = (id) => {
    const task = recTasks.find(t => t.id === id);
    deleteRecurringTask(id);
    logAction({ action: 'delete', entity: 'recurring_task', entityId: id, entityName: task?.title || '', description: 'Deleted recurring task', userName });
    loadData();
  };

  const handleToggle = (id) => {
    toggleRecurringTask(id);
    loadData();
  };

  const handleComplete = (instanceId) => {
    completeInstance(instanceId);
    loadData();
  };

  const handleSkip = (instanceId) => {
    skipInstance(instanceId);
    loadData();
  };

  const formatNextDue = (task) => {
    const next = getNextDueDate(task);
    if (!next) return lang === 'ar' ? 'غير محدد' : 'N/A';
    return next.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const freqBadgeColor = (freq) => {
    switch (freq) {
      case 'daily': return '#10B981';
      case 'weekly': return '#4A7AAB';
      case 'monthly': return '#8B5CF6';
      case 'quarterly': return '#F59E0B';
      case 'yearly': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const pendingInstances = instances.filter(i => i.status === 'pending');
  const completedInstances = instances.filter(i => i.status === 'completed' || i.status === 'skipped');

  const tableHeaderStyle = {
    textAlign: isRTL ? 'right' : 'left', padding: '10px 14px', fontSize: 11,
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
    color: isDark ? '#94a3b8' : '#64748b',
    borderBottom: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    background: isDark ? '#132337' : '#f8fafc',
  };
  const tableCellStyle = {
    padding: '12px 14px', fontSize: 13,
    color: isDark ? '#e2e8f0' : '#1e293b',
    borderBottom: `1px solid ${isDark ? '#1a2332' : '#f1f5f9'}`,
  };

  return (
    <div>
      {/* Today's Instances */}
      {pendingInstances.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          <div style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#F59E0B18',
            }}>
              <AlertCircle size={16} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {lang === 'ar' ? 'مهام اليوم المتكررة' : "Today's Recurring Tasks"}
              </div>
              <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                {pendingInstances.length} {lang === 'ar' ? 'مهمة مستحقة' : 'due'}
              </div>
            </div>
          </div>
          {pendingInstances.map((inst, idx) => {
            const priColor = PRIORITY_OPTIONS[inst.priority]?.color || '#4A7AAB';
            return (
              <div key={inst.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                borderBottom: idx < pendingInstances.length - 1 ? `1px solid ${isDark ? '#1a2332' : '#f1f5f9'}` : 'none',
                flexDirection: isRTL ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: priColor + '18',
                }}>
                  <Repeat size={14} color={priColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                    {lang === 'ar' ? (inst.titleAr || inst.title) : inst.title}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', display: 'flex', gap: 8, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {inst.dueTime}
                    </span>
                    {inst.assigneeName && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <User size={10} /> {inst.assigneeName}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <button onClick={() => handleComplete(inst.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
                    border: 'none', background: '#10B98118', color: '#10B981', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                  }}>
                    <Check size={13} /> {lang === 'ar' ? 'تم' : 'Done'}
                  </button>
                  <button onClick={() => handleSkip(inst.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
                    border: 'none', background: isDark ? '#ffffff0a' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <SkipForward size={13} /> {lang === 'ar' ? 'تخطي' : 'Skip'}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Completed today */}
      {completedInstances.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Check size={12} />
          {completedInstances.length} {lang === 'ar' ? 'مهمة مكتملة/متخطاة اليوم' : 'completed/skipped today'}
        </div>
      )}

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end', marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <Button variant="primary" size="sm" onClick={() => { setEditingTask(null); setShowModal(true); }} className={isRTL ? 'flex-row-reverse' : ''}>
          <Plus size={15} />
          {lang === 'ar' ? 'مهمة متكررة جديدة' : 'New Recurring Task'}
        </Button>
      </div>

      {/* Templates table */}
      <Card className="overflow-hidden">
        {recTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#4A7AAB18', margin: '0 auto 14px',
            }}>
              <Repeat size={24} color="#4A7AAB" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 6 }}>
              {lang === 'ar' ? 'لا توجد مهام متكررة' : 'No Recurring Tasks'}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {lang === 'ar' ? 'أضف مهمة متكررة لجدولة عمل تلقائي' : 'Add a recurring task to automate your schedule'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>{lang === 'ar' ? 'المهمة' : 'Task'}</th>
                  <th style={tableHeaderStyle}>{lang === 'ar' ? 'التكرار' : 'Frequency'}</th>
                  <th style={tableHeaderStyle}>{lang === 'ar' ? 'المسؤول' : 'Assignee'}</th>
                  <th style={tableHeaderStyle}>{lang === 'ar' ? 'القادم' : 'Next Due'}</th>
                  <th style={tableHeaderStyle}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {recTasks.map(task => {
                  const priColor = PRIORITY_OPTIONS[task.priority]?.color || '#4A7AAB';
                  const fColor = freqBadgeColor(task.frequency);
                  return (
                    <tr key={task.id} style={{ opacity: task.enabled ? 1 : 0.5 }}>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: priColor + '18', flexShrink: 0,
                          }}>
                            <Repeat size={13} color={priColor} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              {lang === 'ar' ? (task.titleAr || task.title) : task.title}
                            </div>
                            {task.description && (
                              <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                                {task.description.length > 50 ? task.description.slice(0, 50) + '...' : task.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: fColor + '18', color: fColor,
                        }}>
                          {lang === 'ar' ? FREQUENCIES[task.frequency]?.ar : FREQUENCIES[task.frequency]?.en}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <User size={11} color={isDark ? '#94a3b8' : '#64748b'} />
                          {task.assigneeName || (lang === 'ar' ? 'غير محدد' : 'Unassigned')}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <Calendar size={11} color={isDark ? '#94a3b8' : '#64748b'} />
                          {formatNextDue(task)}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <button onClick={() => handleToggle(task.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
                          cursor: 'pointer', padding: 0,
                          color: task.enabled ? '#10B981' : (isDark ? '#94a3b8' : '#64748b'),
                        }}>
                          {task.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          <span style={{ fontSize: 11, fontWeight: 600 }}>
                            {task.enabled ? (lang === 'ar' ? 'مفعّل' : 'Active') : (lang === 'ar' ? 'معطّل' : 'Disabled')}
                          </span>
                        </button>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                          <button onClick={() => { setEditingTask(task); setShowModal(true); }} style={{
                            padding: '4px 7px', borderRadius: 6, border: 'none', background: 'transparent',
                            color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', opacity: 0.7,
                          }}>
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => handleDelete(task.id)} style={{
                            padding: '4px 7px', borderRadius: 6, border: 'none', background: 'transparent',
                            color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', opacity: 0.7,
                          }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RecurringTaskModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
        onSave={handleSave}
        editTask={editingTask}
        lang={lang}
        isRTL={isRTL}
        isDark={isDark}
      />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function TasksPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const lang   = i18n.language;
  const isRTL   = lang === 'ar';

  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [smartFilters, setSmartFilters] = useState([]);
  const [searchInput, setSearchInput, search] = useDebouncedSearch(300);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'crm', due_date: '', notes: '', contact_name: '' });
  const [saving, setSaving]         = useState(false);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('task');
  const globalFilter = useGlobalFilter();

  const assignedToOptions = useMemo(() =>
    [...new Set(tasks.map(t => t.assigned_to_name_en).filter(Boolean))].map(name => {
      const match = tasks.find(t => t.assigned_to_name_en === name);
      return { value: name, label: match?.assigned_to_name_ar || name, labelEn: name };
    }),
  [tasks]);

  const SMART_FIELDS = useMemo(() => [
    { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: Object.entries(TASK_STATUSES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'priority', label: 'الأولوية', labelEn: 'Priority', type: 'select', options: Object.entries(TASK_PRIORITIES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'dept', label: 'القسم', labelEn: 'Department', type: 'select', options: [
      { value: 'crm', label: 'CRM', labelEn: 'CRM' },
      { value: 'hr', label: 'HR', labelEn: 'HR' },
      { value: 'finance', label: 'المالية', labelEn: 'Finance' },
      { value: 'general', label: 'عام', labelEn: 'General' },
    ]},
    { id: 'assigned_to_name_en', label: 'المسؤول', labelEn: 'Assigned To', type: 'select', options: assignedToOptions },
    { id: 'title', label: 'العنوان', labelEn: 'Title', type: 'text' },
    { id: 'contact_name', label: 'العميل', labelEn: 'Contact', type: 'text' },
    { id: 'due_date', label: 'تاريخ الاستحقاق', labelEn: 'Due Date', type: 'date' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created At', type: 'date' },
    ...auditFields,
  ], [assignedToOptions, auditFields]);

  const SORT_OPTIONS = useMemo(() => [
    { value: 'due_date_asc', label: 'الاستحقاق (الأقرب)', labelEn: 'Due Date (soonest)' },
    { value: 'due_date_desc', label: 'الاستحقاق (الأبعد)', labelEn: 'Due Date (latest)' },
    { value: 'created_at_desc', label: 'الأحدث', labelEn: 'Newest' },
    { value: 'created_at_asc', label: 'الأقدم', labelEn: 'Oldest' },
    { value: 'priority_desc', label: 'الأولوية (الأعلى)', labelEn: 'Priority (highest)' },
  ], []);

  const [sortBy, setSortBy] = useState('due_date_asc');

  const load = async () => {
    setLoading(true);
    try { setTasks(await fetchTasks()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = applySmartFilters(tasks, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => t.title?.toLowerCase().includes(s) || t.contact_name?.toLowerCase().includes(s));
    }
    // Global filter
    if (globalFilter?.agentName && globalFilter.agentName !== 'all') {
      result = result.filter(t => t.assigned_to_name_en === globalFilter.agentName || t.assigned_to_name_ar === globalFilter.agentName);
    }
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'due_date_asc': return new Date(a.due_date) - new Date(b.due_date);
        case 'due_date_desc': return new Date(b.due_date) - new Date(a.due_date);
        case 'created_at_desc': return new Date(b.created_at) - new Date(a.created_at);
        case 'created_at_asc': return new Date(a.created_at) - new Date(b.created_at);
        case 'priority_desc': return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        default: return 0;
      }
    });
    return result;
  }, [tasks, smartFilters, SMART_FIELDS, search, sortBy, globalFilter?.agentName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters, sortBy]);

  const stats = useMemo(() => ({
    total:   tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    overdue: tasks.filter(t => t.status !== 'done' && new Date(t.due_date) < new Date()).length,
    done:    tasks.filter(t => t.status === 'done').length,
  }), [tasks]);

  const handleAdd = async () => {
    if (!form.title.trim() || !form.due_date) return;
    setSaving(true);
    try {
      const t = await createTask({ ...form, assigned_to_name_ar: 'أنت', assigned_to_name_en: 'You' });
      logAction({ action: 'create', entity: 'task', entityId: t.id, entityName: t.title || '', description: 'Created task', userName: profile?.full_name_ar || profile?.full_name_en || '' });
      notifyTaskAssigned({ taskTitle: t.title, assigneeId: t.assigned_to || profile?.id || 'all', assignedBy: profile?.full_name_ar || profile?.full_name_en || '' });
      setTasks(prev => [t, ...prev]);
      setForm({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'crm', due_date: '', notes: '', contact_name: '' });
      setShowAdd(false);
    } finally { setSaving(false); }
  };

  const handleStatus = async (task, newStatus) => {
    const oldStatus = task.status;
    await updateTask(task.id, { status: newStatus });
    logAction({ action: 'status_change', entity: 'task', entityId: task.id, entityName: task.title || '', description: `Changed task status from ${oldStatus} to ${newStatus}`, oldValue: oldStatus, newValue: newStatus, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const handleDelete = async (id) => {
    const task = tasks.find(t => t.id === id);
    await deleteTask(id);
    logAction({ action: 'delete', entity: 'task', entityId: id, entityName: task?.title || '', description: 'Deleted task', userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <PageSkeleton hasKpis={false} tableRows={6} tableCols={5} variant="list" />;

  const tabStyle = (active) => ({
    padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    borderRadius: '10px 10px 0 0', border: 'none',
    background: active ? (isDark ? '#1a2332' : '#ffffff') : 'transparent',
    color: active ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
    borderBottom: active ? '2px solid #4A7AAB' : '2px solid transparent',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.15s',
  });

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <CheckSquare size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'المهام' : 'Tasks'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'كل المهام والمتابعات' : 'All tasks & follow-ups'}</p>
          </div>
        </div>
        {activeTab === 'tasks' && (
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <ExportButton
              data={filtered}
              filename={isRTL ? 'المهام' : 'tasks'}
              title={isRTL ? 'المهام' : 'Tasks'}
              columns={[
                { header: isRTL ? 'العنوان' : 'Title', key: 'title' },
                { header: isRTL ? 'النوع' : 'Type', key: r => isRTL ? TASK_TYPES[r.type]?.ar : TASK_TYPES[r.type]?.en },
                { header: isRTL ? 'الأولوية' : 'Priority', key: r => isRTL ? TASK_PRIORITIES[r.priority]?.ar : TASK_PRIORITIES[r.priority]?.en },
                { header: isRTL ? 'الحالة' : 'Status', key: r => isRTL ? TASK_STATUSES[r.status]?.ar : TASK_STATUSES[r.status]?.en },
                { header: isRTL ? 'تاريخ الاستحقاق' : 'Due Date', key: 'due_date' },
                { header: isRTL ? 'العميل' : 'Contact', key: 'contact_name' },
              ]}
            />
            <Button
              variant={showAdd ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowAdd(!showAdd)}
              className={isRTL ? 'flex-row-reverse' : ''}
            >
              {showAdd ? <X size={15} /> : <Plus size={15} />}
              {showAdd ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? 'مهمة جديدة' : 'New Task')}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        borderBottom: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}>
        <button style={tabStyle(activeTab === 'tasks')} onClick={() => setActiveTab('tasks')}>
          <CheckSquare size={14} />
          {lang === 'ar' ? 'المهام' : 'Tasks'}
        </button>
        <button style={tabStyle(activeTab === 'recurring')} onClick={() => setActiveTab('recurring')}>
          <Repeat size={14} />
          {lang === 'ar' ? 'متكررة' : 'Recurring'}
        </button>
      </div>

      {activeTab === 'recurring' ? (
        <RecurringTab lang={lang} isRTL={isRTL} isDark={isDark} profile={profile} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            {[
              { label: lang==='ar'?'الكل':'Total',    value: stats.total,   color: '#4A7AAB'  },
              { label: lang==='ar'?'معلقة':'Pending', value: stats.pending, color: '#F97316' },
              { label: lang==='ar'?'متأخرة':'Overdue',value: stats.overdue, color: '#EF4444' },
              { label: lang==='ar'?'مكتملة':'Done',   value: stats.done,    color: '#4A7AAB' },
            ].map((s,i) => (
              <Card key={i} className="px-4 py-3">
                <div className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{s.label}</div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Add Form */}
          {showAdd && (
            <Card className="p-5 mb-3.5">
              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <div className="col-span-2">
                  <Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
                    placeholder={lang==='ar'?'عنوان المهمة...':'Task title...'} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
                </div>
                <Select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
                  {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
                </Select>
                <Select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
                  {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
                </Select>
                <Select value={form.dept} onChange={e => setForm(f=>({...f,dept:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
                  {[['crm','CRM'],['hr','HR'],['finance',lang==='ar'?'المالية':'Finance'],['general',lang==='ar'?'عام':'General']].map(([k,v])=>(
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
                <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
                <Input value={form.contact_name} onChange={e => setForm(f=>({...f,contact_name:e.target.value}))}
                  placeholder={lang==='ar'?'اسم العميل (اختياري)':'Contact name (optional)'} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
                <Textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
                  placeholder={lang==='ar'?'ملاحظات...':'Notes...'} rows={2}
                  className={`col-span-2 ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} />
              </div>
              <div className={`flex gap-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                <Button variant="secondary" size="sm" onClick={()=>setShowAdd(false)}>
                  {lang==='ar'?'إلغاء':'Cancel'}
                </Button>
                <Button variant="primary" size="sm" onClick={handleAdd} disabled={saving||!form.title.trim()||!form.due_date}>
                  {saving?'...':(lang==='ar'?'حفظ':'Save')}
                </Button>
              </div>
            </Card>
          )}

          {/* Filters */}
          <SmartFilter
            fields={SMART_FIELDS}
            filters={smartFilters}
            onFiltersChange={setSmartFilters}
            search={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder={lang === 'ar' ? 'بحث بالعنوان أو العميل...' : 'Search by title or contact...'}
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            onSortChange={setSortBy}
            resultsCount={filtered.length}
          />

          {/* Tasks List */}
          <Card className="overflow-hidden">
            {loading ? (
              <div className="text-center p-12 text-content-muted dark:text-content-muted-dark">{lang==='ar'?'جاري التحميل...':'Loading...'}</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-[60px] px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckSquare size={24} className="text-brand-500" />
                    </div>
                    <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد مهام':'No Tasks Found'}</p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي مهام بعد أو جرّب تغيير الفلتر':'No tasks found, try changing the filter'}</p>
                  </div>
                ) : paged.map((task, idx) => {
              const typeDef = TASK_TYPES[task.type] || TASK_TYPES.general;
              const Ic = ICONS[typeDef.icon] || CheckSquare;
              const priDef = TASK_PRIORITIES[task.priority];
              const stDef  = TASK_STATUSES[task.status];
              const due    = formatDue(task.due_date, lang);
              const isDone = task.status === 'done';

              return (
                <div key={task.id} className={`
                  flex items-start gap-3 px-4 py-3
                  ${idx < paged.length-1 ? 'border-b border-edge dark:border-edge-dark' : ''}
                  ${isRTL ? 'flex-row-reverse' : 'flex-row'}
                  ${isDone ? 'opacity-65' : 'opacity-100'}
                  transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-brand-500/[0.06]
                `}>
                  {/* Done toggle */}
                  <button onClick={() => handleStatus(task, isDone ? 'pending' : 'done')} className={`
                    w-5 h-5 rounded-[5px] border-2 flex items-center justify-center cursor-pointer shrink-0 mt-0.5
                    ${isDone
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-edge dark:border-edge-dark bg-transparent'}
                  `}>
                    {isDone && <Check size={11} color="#fff" />}
                  </button>

                  {/* Type icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: (priDef?.color||'#4A7AAB')+'18' }}>
                    <Ic size={14} color={priDef?.color||'#4A7AAB'} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-[7px] flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className={`text-sm font-semibold text-content dark:text-content-dark ${isDone ? 'line-through' : ''}`}>{task.title}</span>
                      <Badge size="sm" style={{ background: (priDef?.color||'#4A7AAB')+'18', color: priDef?.color||'#4A7AAB' }}>
                        {lang==='ar'?priDef?.ar:priDef?.en}
                      </Badge>
                      <Badge size="sm" style={{ background: (stDef?.color||'#4A7AAB')+'18', color: stDef?.color||'#4A7AAB' }}>
                        {lang==='ar'?stDef?.ar:stDef?.en}
                      </Badge>
                      {task.contact_name && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(task.contact_id ? `/contacts?highlight=${task.contact_id}` : `/contacts?q=${encodeURIComponent(task.contact_name)}`); }}
                          className="text-xs text-brand-500 flex items-center gap-[3px] bg-transparent border-none cursor-pointer hover:underline p-0 font-inherit"
                        >
                          <User size={10} /> {task.contact_name}
                        </button>
                      )}
                      {task._offline && (
                        <Badge size="sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', gap: '3px', display: 'inline-flex', alignItems: 'center' }}>
                          <CloudOff size={9} /> {lang === 'ar' ? 'غير متزامن' : 'Offline'}
                        </Badge>
                      )}
                    </div>
                    <div className={`flex items-center gap-2.5 mt-[3px] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className={`text-xs flex items-center gap-[3px] ${
                        due.overdue && !isDone
                          ? 'text-red-500 font-semibold'
                          : 'text-content-muted dark:text-content-muted-dark font-normal'
                      }`}>
                        <Clock size={10} /> {due.label}
                      </span>
                      {task.assigned_to_name_ar && (
                        <span className="text-xs text-content-muted dark:text-content-muted-dark">
                          {lang==='ar'?task.assigned_to_name_ar:task.assigned_to_name_en}
                        </span>
                      )}
                      {task.dept && (
                        <Badge size="sm" variant="default" className="!text-[10px]">
                          {task.dept.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    {task.notes && <div className="text-xs text-content-muted dark:text-content-muted-dark mt-[3px]">{task.notes}</div>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {task.status !== 'in_progress' && task.status !== 'done' && (
                      <Button variant="secondary" size="sm" onClick={() => handleStatus(task, 'in_progress')} className="!text-xs !px-[9px] !py-1">
                        {lang==='ar'?'جارية':'Start'}
                      </Button>
                    )}
                    <button onClick={() => handleDelete(task.id)} className="p-[4px_7px] rounded-md border-none bg-transparent text-content-muted dark:text-content-muted-dark cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={v => { setPageSize(v); setPage(1); }}
            totalItems={filtered.length}
            safePage={safePage}
          />
        </>
      )}
    </div>
  );
}
