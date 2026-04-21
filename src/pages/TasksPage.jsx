import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
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
import { fetchTasks, createTask, updateTask, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../services/tasksService';
import { createActivity } from '../services/contactsService';
import { Button, Card, Input, Select, Textarea, Badge, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';
import { logAction } from '../services/auditService';
import { notifyTaskAssigned } from '../services/notificationsService';
import { useToast } from '../contexts/ToastContext';
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

  const [loadingRec, setLoadingRec] = useState(true);

  const loadData = useCallback(async () => {
    setLoadingRec(true);
    try {
      await generateDueInstances();
      const tasks = await getRecurringTasks();
      setRecTasks(tasks);
      setInstances([]); // instances now created as real tasks
    } catch { setRecTasks([]); }
    finally { setLoadingRec(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const userName = profile?.full_name_ar || profile?.full_name_en || '';

  const handleSave = async (formData) => {
    try {
      if (editingTask) {
        await updateRecurringTask(editingTask.id, formData);
        logAction({ action: 'update', entity: 'recurring_task', entityId: editingTask.id, entityName: formData.title, description: 'Updated recurring task', userName });
      } else {
        const t = await createRecurringTask(formData);
        logAction({ action: 'create', entity: 'recurring_task', entityId: t.id, entityName: formData.title, description: 'Created recurring task', userName });
      }
    } catch { /* error reported in service */ }
    setEditingTask(null);
    loadData();
  };

  const handleDelete = async (id) => {
    const task = recTasks.find(t => t.id === id);
    await deleteRecurringTask(id);
    logAction({ action: 'delete', entity: 'recurring_task', entityId: id, entityName: task?.title || '', description: 'Deleted recurring task', userName });
    loadData();
  };

  const handleToggle = async (id) => {
    await toggleRecurringTask(id);
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

// ── Calendar View ───────────────────────────────────────────────────
function CalendarView({ tasks, lang, isRTL, isDark, onTaskClick }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const startOfWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayTasks = (tasks || []).filter(t => t.due_date?.slice(0, 10) === dateStr && t.status !== 'done');
      arr.push({ date: d, dateStr, tasks: dayTasks });
    }
    return arr;
  }, [startOfWeek, tasks]);

  const isToday = (d) => d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  const dayNames = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset(w => w - 1)}
          className="px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark text-xs cursor-pointer">
          {isRTL ? '→' : '←'} {lang === 'ar' ? 'الأسبوع السابق' : 'Prev Week'}
        </button>
        <span className="text-sm font-bold text-content dark:text-content-dark">
          {startOfWeek.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
          {' — '}
          {new Date(startOfWeek.getTime() + 6 * 86400000).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
        </span>
        <div className="flex gap-2">
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-500 text-xs font-semibold cursor-pointer border-none">
              {lang === 'ar' ? 'اليوم' : 'Today'}
            </button>
          )}
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark text-xs cursor-pointer">
            {lang === 'ar' ? 'الأسبوع التالي' : 'Next Week'} {isRTL ? '←' : '→'}
          </button>
        </div>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => (
          <div key={day.dateStr} className={`min-h-[120px] rounded-xl border p-2 ${
            isToday(day.date)
              ? 'border-brand-500 bg-brand-500/[0.04]'
              : 'border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark'
          }`}>
            {/* Day header */}
            <div className="text-center mb-2">
              <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{dayNames[day.date.getDay()]}</div>
              <div className={`text-sm font-bold ${isToday(day.date) ? 'text-brand-500' : 'text-content dark:text-content-dark'}`}>
                {day.date.getDate()}
              </div>
            </div>
            {/* Tasks */}
            <div className="flex flex-col gap-1">
              {day.tasks.slice(0, 4).map(t => {
                const pri = TASK_PRIORITIES[t.priority];
                const overdue = new Date(t.due_date) < new Date();
                return (
                  <button key={t.id} onClick={() => onTaskClick(t)}
                    className={`w-full text-start px-1.5 py-1 rounded-md text-[10px] border-none cursor-pointer truncate font-medium transition-colors ${
                      overdue ? 'bg-red-500/10 text-red-500' : 'bg-surface-bg dark:bg-surface-bg-dark text-content dark:text-content-dark hover:bg-brand-500/10'
                    }`}
                    style={{ borderInlineStart: `2px solid ${pri?.color || '#4A7AAB'}` }}
                    title={`${t.title}${t.contact_name ? ' · ' + t.contact_name : ''}`}
                  >
                    {t.title}
                  </button>
                );
              })}
              {day.tasks.length > 4 && (
                <span className="text-[9px] text-content-muted dark:text-content-muted-dark text-center">
                  +{day.tasks.length - 4} {lang === 'ar' ? 'أخرى' : 'more'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Complete Task Modal ──────────────────────────────────────────────
function CompleteTaskModal({ task, onClose, onComplete, lang, isRTL, profile }) {
  const [actType, setActType] = useState('call');
  const [actResult, setActResult] = useState('');
  const [actNotes, setActNotes] = useState('');
  const [addFollowUp, setAddFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [changeContactStatus, setChangeContactStatus] = useState(false);
  const [newContactStatus, setNewContactStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const ACT_TYPES = [
    { key: 'call', ar: 'مكالمة', en: 'Call' },
    { key: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
    { key: 'email', ar: 'إيميل', en: 'Email' },
    { key: 'meeting', ar: 'مقابلة', en: 'Meeting' },
    { key: 'note', ar: 'ملاحظة', en: 'Note' },
  ];

  const RESULTS = {
    call: [
      { value: 'answered', ar: 'رد', en: 'Answered', color: '#10B981' },
      { value: 'no_answer', ar: 'لم يرد', en: 'No Answer', color: '#F59E0B' },
      { value: 'busy', ar: 'مشغول', en: 'Busy', color: '#EF4444' },
      { value: 'switched_off', ar: 'مغلق', en: 'Switched Off', color: '#6b7280' },
    ],
    whatsapp: [
      { value: 'replied', ar: 'رد', en: 'Replied', color: '#10B981' },
      { value: 'seen', ar: 'شاف', en: 'Seen', color: '#3B82F6' },
      { value: 'delivered', ar: 'وصلت', en: 'Delivered', color: '#F59E0B' },
    ],
    email: [
      { value: 'replied', ar: 'رد', en: 'Replied', color: '#10B981' },
      { value: 'sent', ar: 'تم الإرسال', en: 'Sent', color: '#4A7AAB' },
    ],
  };
  const currentResults = RESULTS[actType] || [];
  const resultRequired = currentResults.length > 0;
  const canSave = (!resultRequired || actResult) && (actNotes.trim() || actResult);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const resultLabel = currentResults.find(r => r.value === actResult);
      const desc = resultLabel ? `${isRTL ? resultLabel.ar : resultLabel.en}${actNotes ? ' — ' + actNotes : ''}` : actNotes;
      await onComplete({
        activity: {
          type: actType,
          description: desc,
          notes: actNotes,
          result: actResult || null,
          contact_id: task.contact_id || null,
          user_id: profile?.id || null,
          user_name_ar: profile?.full_name_ar || '',
          user_name_en: profile?.full_name_en || '',
          dept: 'sales',
          created_at: new Date().toISOString(),
        },
        followUp: addFollowUp && followUpDate ? {
          title: task.title ? `${isRTL ? 'متابعة' : 'Follow-up'}: ${task.title}` : (isRTL ? 'متابعة' : 'Follow-up'),
          due_date: followUpDate,
          notes: followUpNotes,
          contact_id: task.contact_id || null,
          contact_name: task.contact_name || null,
          dept: 'sales',
          priority: 'medium',
          status: 'pending',
          assigned_to: profile?.id || null,
          assigned_to_name_ar: profile?.full_name_ar || '',
          assigned_to_name_en: profile?.full_name_en || '',
        } : null,
        contactStatus: changeContactStatus && newContactStatus ? newContactStatus : null,
      });
    } finally { setSaving(false); }
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[460px] max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge dark:border-edge-dark">
          <div>
            <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'إنهاء المهمة' : 'Complete Task'}</h3>
            <p className="m-0 mt-0.5 text-[11px] text-content-muted dark:text-content-muted-dark truncate max-w-[300px]">{task.title}</p>
            {task.contact_name && <p className="m-0 mt-0.5 text-[11px] text-brand-500 font-medium">{task.contact_name}</p>}
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer p-1 text-content-muted dark:text-content-muted-dark hover:text-red-500"><X size={16} /></button>
        </div>

        <div className="px-5 py-4">
          {/* Activity Type */}
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 block">{isRTL ? 'نوع النشاط' : 'Activity Type'} <span className="text-red-500">*</span></label>
            <div className="flex gap-1.5 flex-wrap">
              {ACT_TYPES.map(t => (
                <button key={t.key} onClick={() => { setActType(t.key); setActResult(''); }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                    actType === t.key ? 'bg-brand-500 text-white border-brand-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                  }`}>
                  {isRTL ? t.ar : t.en}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {currentResults.length > 0 && (
            <div className="mb-3">
              <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 block">{isRTL ? 'النتيجة' : 'Result'}</label>
              <div className="flex gap-1.5 flex-wrap">
                {currentResults.map(r => (
                  <button key={r.value} onClick={() => setActResult(actResult === r.value ? '' : r.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                      actResult === r.value ? 'font-bold text-white border-transparent' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                    }`}
                    style={actResult === r.value ? { background: r.color } : {}}>
                    {isRTL ? r.ar : r.en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 block">{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <Textarea value={actNotes} onChange={e => setActNotes(e.target.value)} rows={2} size="sm"
              placeholder={isRTL ? 'ملاحظات عن النشاط...' : 'Activity notes...'} dir={isRTL ? 'rtl' : 'ltr'} />
          </div>

          {/* Follow-up toggle */}
          <div className="border-t border-edge dark:border-edge-dark pt-3 mt-3">
            <button onClick={() => setAddFollowUp(!addFollowUp)}
              className={`flex items-center gap-2 text-xs font-semibold cursor-pointer bg-transparent border-none p-0 transition-colors ${
                addFollowUp ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'
              }`}>
              <Calendar size={13} />
              {isRTL ? (addFollowUp ? 'إلغاء المتابعة' : '+ إضافة مهمة متابعة') : (addFollowUp ? 'Cancel follow-up' : '+ Add follow-up task')}
            </button>
            {addFollowUp && (
              <div className="mt-2.5 p-3 bg-brand-500/[0.04] border border-brand-500/10 rounded-xl">
                <div className="mb-2">
                  <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'تاريخ المتابعة' : 'Follow-up date'} <span className="text-red-500">*</span></label>
                  <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'ملاحظة المتابعة' : 'Follow-up note'}</label>
                  <input type="text" value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}
                    placeholder={isRTL ? 'اختياري...' : 'Optional...'}
                    className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Contact Status Change */}
          <div className="border-t border-edge dark:border-edge-dark pt-3 mt-3">
            <button onClick={() => setChangeContactStatus(!changeContactStatus)}
              className={`flex items-center gap-2 text-xs font-semibold cursor-pointer bg-transparent border-none p-0 transition-colors ${
                changeContactStatus ? 'text-purple-500' : 'text-content-muted dark:text-content-muted-dark'
              }`}>
              <User size={13} />
              {isRTL ? (changeContactStatus ? 'إلغاء تغيير الحالة' : '+ تغيير حالة العميل') : (changeContactStatus ? 'Cancel status change' : '+ Change lead status')}
            </button>
            {changeContactStatus && (
              <div className="mt-2.5 flex gap-1.5 flex-wrap">
                {[
                  { value: 'new', ar: 'جديد', en: 'New', color: '#4A7AAB' },
                  { value: 'following', ar: 'متابعة', en: 'Following', color: '#10B981' },
                  { value: 'contacted', ar: 'تم التواصل', en: 'Contacted', color: '#F59E0B' },
                  { value: 'has_opportunity', ar: 'لديه فرصة', en: 'Has Opp', color: '#059669' },
                  { value: 'disqualified', ar: 'غير مؤهل', en: 'Disqualified', color: '#EF4444' },
                ].map(s => (
                  <button key={s.value} onClick={() => setNewContactStatus(newContactStatus === s.value ? '' : s.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                      newContactStatus === s.value ? 'text-white border-transparent' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                    }`}
                    style={newContactStatus === s.value ? { background: s.color } : {}}>
                    {isRTL ? s.ar : s.en}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 py-4 border-t border-edge dark:border-edge-dark ${isRTL ? 'justify-start' : 'justify-end'}`}>
          <Button variant="secondary" size="sm" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !canSave}>
            <Check size={13} /> {saving ? '...' : (isRTL ? 'إنهاء المهمة' : 'Complete Task')}
          </Button>
        </div>
      </div>
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

  const toast = useToast();
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [completeTask, setCompleteTask] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [smartFilters, setSmartFilters] = useState([]);
  const [searchInput, setSearchInput, search] = useDebouncedSearch(300);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'sales', due_date: '', notes: '', contact_name: '', opportunity_name: '' });
  const [saving, setSaving]         = useState(false);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('task');
  const globalFilter = useGlobalFilter();

  const [allAgentsList, setAllAgentsList] = useState([]);
  useEffect(() => {
    import('../services/opportunitiesService').then(({ fetchSalesAgents }) => {
      fetchSalesAgents().then(data => {
        setAllAgentsList((data || []).map(a => ({ value: a.full_name_en || a.full_name_ar, label: a.full_name_ar || a.full_name_en, labelEn: a.full_name_en || a.full_name_ar })).filter(o => o.value));
      }).catch(() => {});
    });
  }, []);

  const assignedToOptions = allAgentsList.length > 0 ? allAgentsList :
    [...new Set(tasks.map(t => t.assigned_to_name_en).filter(Boolean))].map(name => {
      const match = (tasks || []).find(t => t.assigned_to_name_en === name);
      return { value: name, label: match?.assigned_to_name_ar || name, labelEn: name };
    });

  const [agentFilter, setAgentFilter] = useState('all');

  const SMART_FIELDS = useMemo(() => [
    { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: Object.entries(TASK_STATUSES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'priority', label: 'الأولوية', labelEn: 'Priority', type: 'select', options: Object.entries(TASK_PRIORITIES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'dept', label: 'القسم', labelEn: 'Department', type: 'select', options: [
      { value: 'sales', label: 'المبيعات', labelEn: 'Sales' },
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
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, pending: 0, overdue: 0, done: 0 });

  // Extract server-side filters from smartFilters
  const serverFilters = useMemo(() => {
    const statusF = smartFilters.find(f => f.field === 'status' && f.operator === 'is');
    const priorityF = smartFilters.find(f => f.field === 'priority' && f.operator === 'is');
    const deptF = smartFilters.find(f => f.field === 'dept' && f.operator === 'is');
    const agentF = smartFilters.find(f => f.field === 'assigned_to_name_en' && f.operator === 'is');
    return { status: statusF?.value, priority: priorityF?.value, dept: deptF?.value, agentName: agentF?.value };
  }, [smartFilters]);

  const loadTasks = useCallback(async (pg) => {
    setLoading(true);
    try {
      const currentPage = pg || page || 1;
      const agentValue = serverFilters.agentName || (agentFilter !== 'all' ? agentFilter : undefined) || ((globalFilter?.agentName && globalFilter.agentName !== 'all') ? globalFilter.agentName : undefined);
      const deptValue = serverFilters.dept || ((globalFilter?.department && globalFilter.department !== 'all') ? globalFilter.department : undefined);
      const result = await fetchTasks({
        page: currentPage, pageSize, sortBy,
        role: profile?.role, userId: profile?.id, teamId: profile?.team_id,
        search: search || undefined,
        status: serverFilters.status || (statusFilter !== 'all' ? statusFilter : undefined),
        priority: serverFilters.priority || (priorityFilter !== 'all' ? priorityFilter : undefined),
        dept: deptValue,
        agentName: agentValue,
        ...(dateFilter === 'today' ? { dueDateFrom: new Date().toISOString().slice(0, 10) + 'T00:00:00', dueDateTo: new Date().toISOString().slice(0, 10) + 'T23:59:59' } : {}),
        ...(dateFilter === 'week' ? { dueDateFrom: new Date().toISOString().slice(0, 10) + 'T00:00:00', dueDateTo: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) + 'T23:59:59' } : {}),
        ...(dateFilter === 'overdue' ? { overdueOnly: true } : {}),
      });
      setTasks(result?.data || []);
      setTotalCount(result?.count || 0);
    } catch (err) {
      console.error('Tasks load error:', err);
      setTasks([]);
    } finally { setLoading(false); }
  }, [page, pageSize, sortBy, profile?.role, profile?.id, profile?.team_id, search, serverFilters, globalFilter?.agentName, globalFilter?.department, statusFilter, priorityFilter, dateFilter, agentFilter]);

  useEffect(() => { if (profile) loadTasks(); }, [profile, loadTasks]);

  // Realtime
  useRealtimeSubscription('tasks', useCallback((payload) => {
    if (payload?.eventType) {
      setTasks(prev => {
        if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== payload.old?.id);
        if (payload.eventType === 'INSERT') return [payload.new, ...prev];
        if (payload.eventType === 'UPDATE') return prev.map(t => t.id === payload.new?.id ? { ...t, ...payload.new } : t);
        return prev;
      });
    }
  }, []));

  // Stats — from server
  const loadStats = useCallback(async () => {
    try {
      const baseArgs = { role: profile?.role, userId: profile?.id, teamId: profile?.team_id, page: 1, pageSize: 1 };
      const todayStr = new Date().toISOString().slice(0, 10);
      const nowISO = new Date().toISOString();
      const [totalRes, pendingRes, doneRes, overdueRes, todayRes, doneTodayRes] = await Promise.all([
        fetchTasks({ ...baseArgs }),
        fetchTasks({ ...baseArgs, status: 'pending' }),
        fetchTasks({ ...baseArgs, status: 'done' }),
        // Overdue = pending + due_date < now (need custom query)
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('due_date', nowISO),
        // Today = due_date starts with today
        supabase.from('tasks').select('id', { count: 'exact', head: true }).gte('due_date', todayStr + 'T00:00:00').lte('due_date', todayStr + 'T23:59:59'),
        // Done today
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('updated_at', todayStr + 'T00:00:00'),
      ]);
      setStats({
        total: totalRes?.count || 0,
        pending: pendingRes?.count || 0,
        done: doneRes?.count || 0,
        overdue: overdueRes?.count || 0,
        today: todayRes?.count || 0,
        doneToday: doneTodayRes?.count || 0,
      });
    } catch { /* ignore */ }
  }, [profile?.role, profile?.id, profile?.team_id]);

  useEffect(() => { if (profile) loadStats(); }, [profile, loadStats]);

  // #4: Notify user about overdue tasks (once per session)
  const overdueNotified = useRef(false);
  useEffect(() => {
    if (overdueNotified.current || !stats.overdue || stats.overdue === 0) return;
    overdueNotified.current = true;
    toast.warning(
      lang === 'ar'
        ? `عندك ${stats.overdue} مهمة متأخرة — تحتاج متابعة فوراً`
        : `You have ${stats.overdue} overdue tasks — follow up now`
    );
  }, [stats.overdue]);

  // Client-only filters (exclude server-filtered fields)
  const SERVER_FILTERED_FIELDS = ['status', 'priority', 'dept', 'assigned_to_name_en'];
  const filtered = useMemo(() => {
    let result = tasks || [];
    const clientFilters = smartFilters.filter(f => !SERVER_FILTERED_FIELDS.includes(f.field));
    result = applySmartFilters(result, clientFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [tasks, smartFilters, SMART_FIELDS]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered;
  useEffect(() => { if (page > totalPages && totalPages > 0) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters, sortBy]);

  const handleAdd = async () => {
    if (!form.title.trim() || !form.due_date) return;
    setSaving(true);
    try {
      const t = await createTask({ ...form, assigned_to: profile?.id || null, assigned_to_name_ar: profile?.full_name_ar || '', assigned_to_name_en: profile?.full_name_en || '' });
      logAction({ action: 'create', entity: 'task', entityId: t.id, entityName: t.title || '', description: 'Created task', userName: profile?.full_name_ar || profile?.full_name_en || '' });
      notifyTaskAssigned({ taskTitle: t.title, assigneeId: t.assigned_to || profile?.id || 'all', assignedBy: profile?.full_name_ar || profile?.full_name_en || '' });
      setTasks(prev => [t, ...prev]);
      setForm({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'sales', due_date: '', notes: '', contact_name: '', opportunity_name: '' });
      setShowAdd(false);
    } finally { setSaving(false); }
  };

  const handleStatus = async (task, newStatus) => {
    const oldStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await updateTask(task.id, { status: newStatus });
      logAction({ action: 'status_change', entity: 'task', entityId: task.id, entityName: task.title || '', description: `Changed task status from ${oldStatus} to ${newStatus}`, oldValue: oldStatus, newValue: newStatus, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    } catch (err) {
      console.error('Task status update failed:', err);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: oldStatus } : t));
    }
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
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen pb-16 ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

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
        <button style={tabStyle(activeTab === 'calendar')} onClick={() => setActiveTab('calendar')}>
          <Calendar size={14} />
          {lang === 'ar' ? 'تقويم' : 'Calendar'}
        </button>
        <button style={tabStyle(activeTab === 'recurring')} onClick={() => setActiveTab('recurring')}>
          <Repeat size={14} />
          {lang === 'ar' ? 'متكررة' : 'Recurring'}
        </button>
      </div>

      {activeTab === 'calendar' ? (
        <CalendarView tasks={tasks} lang={lang} isRTL={isRTL} isDark={isDark} onTaskClick={(task) => setCompleteTask(task)} />
      ) : activeTab === 'recurring' ? (
        <RecurringTab lang={lang} isRTL={isRTL} isDark={isDark} profile={profile} />
      ) : (
        <>
          {/* Overdue Banner */}
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl bg-red-500/[0.08] border border-red-500/20">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span className="text-sm font-bold text-red-500">
                {lang==='ar' ? `${stats.overdue} مهمة متأخرة` : `${stats.overdue} overdue tasks`}
              </span>
              <button onClick={() => { setStatusFilter('pending'); setSortBy('due_date_asc'); setPage(1); }}
                className="text-xs font-semibold text-red-500 bg-red-500/10 px-2.5 py-1 rounded-lg border-none cursor-pointer hover:bg-red-500/20 transition-colors ms-auto">
                {lang==='ar' ? 'عرض المتأخرة' : 'View Overdue'}
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {[
              { label: lang==='ar'?'الكل':'Total',          value: stats.total,     color: '#4A7AAB' },
              { label: lang==='ar'?'معلقة':'Pending',       value: stats.pending,   color: '#F97316' },
              { label: lang==='ar'?'متأخرة':'Overdue',      value: stats.overdue,   color: '#EF4444' },
              { label: lang==='ar'?'اليوم':'Today',         value: stats.today,     color: '#2B4C6F' },
              { label: lang==='ar'?'مكتملة اليوم':'Done Today', value: stats.doneToday, color: '#10B981' },
              { label: lang==='ar'?'مكتملة':'Done',         value: stats.done,      color: '#6B8DB5' },
            ].map((s,i) => (
              <Card key={i} className="px-3 py-2.5 text-center">
                <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-0.5">{s.label}</div>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
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
                  {[['sales',lang==='ar'?'المبيعات':'Sales'],['hr','HR'],['finance',lang==='ar'?'المالية':'Finance'],['general',lang==='ar'?'عام':'General']].map(([k,v])=>(
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
                <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
                <Input value={form.contact_name} onChange={e => setForm(f=>({...f,contact_name:e.target.value}))}
                  placeholder={lang==='ar'?'اسم العميل (اختياري)':'Contact name (optional)'} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
                <Input value={form.opportunity_name} onChange={e => setForm(f=>({...f,opportunity_name:e.target.value}))}
                  placeholder={lang==='ar'?'اسم الفرصة (اختياري)':'Opportunity (optional)'} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
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

          {/* Status + Priority Chips */}
          <div className="flex gap-2 mb-2 flex-wrap">
            {[
              { value: 'pending', label: lang==='ar'?'معلقة':'Pending', color: '#F97316' },
              { value: 'in_progress', label: lang==='ar'?'جارية':'In Progress', color: '#4A7AAB' },
              { value: 'done', label: lang==='ar'?'مكتملة':'Done', color: '#10B981' },
              { value: 'all', label: lang==='ar'?'الكل':'All', color: '#6B8DB5' },
            ].map(s => {
              const active = statusFilter === s.value;
              return (
                <button key={s.value} onClick={() => { setStatusFilter(s.value); setPage(1); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={active ? { border: `1px solid ${s.color}`, background: `${s.color}15`, color: s.color } : undefined}>
                  {s.label}
                </button>
              );
            })}
            <div className="w-px h-6 bg-edge dark:bg-edge-dark self-center mx-1" />
            {[
              { value: 'all', label: lang==='ar'?'كل الأولويات':'All Priorities', color: '#6B8DB5' },
              { value: 'high', label: lang==='ar'?'عالية':'High', color: '#EF4444' },
              { value: 'medium', label: lang==='ar'?'متوسطة':'Medium', color: '#F97316' },
              { value: 'low', label: lang==='ar'?'منخفضة':'Low', color: '#6B8DB5' },
            ].map(p => {
              const active = priorityFilter === p.value;
              return (
                <button key={p.value} onClick={() => { setPriorityFilter(p.value); setPage(1); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={active ? { border: `1px solid ${p.color}`, background: `${p.color}15`, color: p.color } : undefined}>
                  {p.label}
                </button>
              );
            })}
            <div className="w-px h-6 bg-edge dark:bg-edge-dark self-center mx-1" />
            {[
              { value: 'all', label: lang==='ar'?'كل المواعيد':'All Dates', color: '#6B8DB5' },
              { value: 'today', label: lang==='ar'?'اليوم':'Today', color: '#2B4C6F' },
              { value: 'week', label: lang==='ar'?'هذا الأسبوع':'This Week', color: '#4A7AAB' },
              { value: 'overdue', label: lang==='ar'?'متأخرة':'Overdue', color: '#EF4444' },
            ].map(d => {
              const active = dateFilter === d.value;
              return (
                <button key={d.value} onClick={() => { setDateFilter(d.value); setPage(1); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={active ? { border: `1px solid ${d.color}`, background: `${d.color}15`, color: d.color } : undefined}>
                  {d.label}
                </button>
              );
            })}
            <div className="w-px h-6 bg-edge dark:bg-edge-dark self-center mx-1" />
            <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 rounded-full text-xs bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark cursor-pointer"
              style={agentFilter !== 'all' ? { borderColor: '#4A7AAB', color: '#4A7AAB', background: '#4A7AAB15' } : {}}>
              <option value="all">{lang==='ar'?'كل الموظفين':'All Agents'}</option>
              {assignedToOptions.map(a => <option key={a.value} value={a.value}>{lang==='ar' ? a.label : a.labelEn}</option>)}
            </select>
          </div>

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
            resultsCount={totalCount}
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
                  {/* Checkbox */}
                  <input type="checkbox" checked={selectedTaskIds.has(task.id)} onChange={(e) => {
                    e.stopPropagation();
                    setSelectedTaskIds(prev => { const n = new Set(prev); if (n.has(task.id)) n.delete(task.id); else n.add(task.id); return n; });
                  }} className="w-4 h-4 cursor-pointer shrink-0 mt-0.5" />

                  {/* Status indicator */}
                  <div className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center shrink-0 mt-0.5
                    ${isDone ? 'border-brand-500 bg-brand-500' : 'border-edge dark:border-edge-dark bg-transparent'}
                  `}>
                    {isDone && <Check size={11} color="#fff" />}
                  </div>

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
                      {task._offline && (
                        <Badge size="sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', gap: '3px', display: 'inline-flex', alignItems: 'center' }}>
                          <CloudOff size={9} /> {lang === 'ar' ? 'غير متزامن' : 'Offline'}
                        </Badge>
                      )}
                    </div>
                    <div className={`flex items-center gap-2.5 mt-[3px] flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className={`text-xs flex items-center gap-[3px] ${
                        due.overdue && !isDone
                          ? 'text-red-500 font-semibold'
                          : 'text-content-muted dark:text-content-muted-dark font-normal'
                      }`}>
                        <Clock size={10} /> {due.label}
                      </span>
                      {(task.assigned_to_name_ar || task.assigned_to_name_en) && (
                        <span className="text-xs text-brand-500 flex items-center gap-[3px] font-medium">
                          <User size={10} />
                          {lang==='ar' ? (task.assigned_to_name_ar || task.assigned_to_name_en) : (task.assigned_to_name_en || task.assigned_to_name_ar)}
                        </span>
                      )}
                      {task.contact_name && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(task.contact_id ? `/contacts?highlight=${task.contact_id}` : `/contacts?q=${encodeURIComponent(task.contact_name)}`); }}
                          className="text-xs text-emerald-500 flex items-center gap-[3px] bg-transparent border-none cursor-pointer hover:underline p-0 font-inherit font-medium"
                        >
                          <Phone size={10} /> {task.contact_name}
                        </button>
                      )}
                      {task.opportunity_name && (
                        <span className="text-xs text-purple-500 flex items-center gap-[3px] font-medium">
                          <Star size={10} /> {task.opportunity_name}
                        </span>
                      )}
                      {task.dept && (
                        <Badge size="sm" variant="default" className="!text-[10px]">
                          {({ sales: lang==='ar'?'المبيعات':'Sales', hr: 'HR', finance: lang==='ar'?'المالية':'Finance', marketing: lang==='ar'?'التسويق':'Marketing', operations: lang==='ar'?'العمليات':'Operations', general: lang==='ar'?'عام':'General' })[task.dept] || task.dept}
                        </Badge>
                      )}
                    </div>
                    {task.notes && <div className="text-xs text-content-muted dark:text-content-muted-dark mt-[3px]">{task.notes}</div>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {task.contact_phone && (
                      <>
                        <a href={`tel:${task.contact_phone}`} onClick={e => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 no-underline hover:bg-emerald-500/20 transition-colors">
                          <Phone size={12} />
                        </a>
                        <a href={`https://wa.me/${task.contact_phone.replace(/[^+\d]/g, '').replace('+', '')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center bg-[#25D366]/10 border border-[#25D366]/20 rounded-lg text-[#25D366] no-underline hover:bg-[#25D366]/20 transition-colors">
                          <MessageCircle size={12} />
                        </a>
                      </>
                    )}
                    {task.status !== 'done' && (
                      <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); setCompleteTask(task); }} className="!text-xs !px-[9px] !py-1">
                        <Check size={11} /> {lang==='ar'?'تم':'Done'}
                      </Button>
                    )}
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
            totalItems={totalCount}
            safePage={safePage}
          />
        </>
      )}

      {/* Bulk Done Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[300] bg-gradient-to-r from-brand-900 to-brand-500 px-5 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-bold text-white">{selectedTaskIds.size} {isRTL ? 'مهمة محددة' : 'tasks selected'}</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedTaskIds(new Set())}
              className="px-3 py-1.5 rounded-lg border border-white/30 bg-transparent text-white text-xs font-semibold cursor-pointer">
              {isRTL ? 'إلغاء' : 'Clear'}
            </button>
            <button onClick={async () => {
              const ids = [...selectedTaskIds];
              try {
                await Promise.all(ids.map(id => updateTask(id, { status: 'done' })));
                setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'done' } : t));
                toast.success(isRTL ? `تم إنهاء ${ids.length} مهمة` : `${ids.length} tasks completed`);
                setSelectedTaskIds(new Set());
              } catch { toast.error(isRTL ? 'حدث خطأ' : 'Error'); }
            }}
              className="px-4 py-1.5 rounded-lg border-none bg-white text-brand-500 text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <Check size={13} /> {isRTL ? 'إنهاء الكل' : 'Done All'}
            </button>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      {completeTask && (
        <CompleteTaskModal
          task={completeTask}
          lang={lang}
          isRTL={isRTL}
          profile={profile}
          onClose={() => setCompleteTask(null)}
          onComplete={async ({ activity, followUp, contactStatus }) => {
            try {
              // 1. Create activity
              await createActivity(activity);
              // 2. Mark task as done
              await updateTask(completeTask.id, { status: 'done' });
              setTasks(prev => prev.map(t => t.id === completeTask.id ? { ...t, status: 'done' } : t));
              // 3. Create follow-up task if requested
              if (followUp) {
                const newTask = await createTask(followUp);
                setTasks(prev => [newTask, ...prev]);
                toast.success(isRTL ? 'تم إنهاء المهمة وإنشاء متابعة جديدة' : 'Task completed & follow-up created');
              } else {
                toast.success(isRTL ? 'تم إنهاء المهمة' : 'Task completed');
              }
              // 4. Update contact status if requested
              if (contactStatus && completeTask.contact_id) {
                const { updateContact } = await import('../services/contactsService');
                await updateContact(completeTask.contact_id, { contact_status: contactStatus });
              }
              logAction({ action: 'complete_task', entity: 'task', entityId: completeTask.id, entityName: completeTask.title, description: `Completed task: ${completeTask.title}`, userName: profile?.full_name_ar || '' });
              setCompleteTask(null);
            } catch (err) {
              console.error('Complete task error:', err);
              toast.error(isRTL ? 'حدث خطأ: ' + (err?.message || '') : 'Error: ' + (err?.message || ''));
            }
          }}
        />
      )}
    </div>
  );
}
