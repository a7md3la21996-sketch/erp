import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { Phone, CheckSquare, Target, Zap, Check, Calendar } from 'lucide-react';
import { Button, Select, Textarea } from '../../../components/ui/';
import { TASK_PRIORITIES } from '../../../services/tasksService';
import { MEETING_SUBTYPES } from '../../../services/activitiesService';

// ── Unified Take Action Form ──────────────────────────────────────────────
export default function TakeActionForm({ contact, onSaveActivity, onSaveTask, onStatusChange, onCancel }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const { activityTypes: configTypes, activityResults: configResults } = useSystemConfig();

  const activityTypes = (configTypes && configTypes.length > 0) ? configTypes.map(t => ({ key: t.key, label: t.label_en, labelAr: t.label_ar })) : [
    { key: 'call', label: 'Call', labelAr: 'مكالمة' },
    { key: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب' },
    { key: 'email', label: 'Email', labelAr: 'إيميل' },
    { key: 'meeting', label: 'Meeting', labelAr: 'مقابلة' },
    { key: 'note', label: 'Note', labelAr: 'ملاحظة' },
  ];

  const ACTIVITY_RESULTS = {};
  if (configResults && Object.keys(configResults).length > 0) {
    Object.entries(configResults).forEach(([typeKey, arr]) => {
      ACTIVITY_RESULTS[typeKey] = arr.map(r => ({ value: r.value, label: isRTL ? r.label_ar : r.label_en, color: r.color }));
    });
  }

  // Activity mode: 'log' (default) or 'schedule'
  const [actMode, setActMode] = useState('log');

  // Activity state
  const [actForm, setActForm] = useState({ type: 'call', description: '', result: '', scheduled_date: '', meeting_subtype: '' });
  const setAct = (k, v) => setActForm(f => ({ ...f, [k]: v, ...(k === 'type' ? { result: '', meeting_subtype: '' } : {}) }));
  const currentResults = ACTIVITY_RESULTS[actForm.type] || [];
  const resultRequired = actMode === 'log' && currentResults.length > 0;

  // Task state (optional section)
  const [addTask, setAddTask] = useState(false);
  const TASK_TYPES = [
    { key: 'followup',   ar: 'متابعة',          en: 'Follow Up' },
    { key: 'callback',   ar: 'معاودة اتصال',    en: 'Callback' },
    { key: 'send_info',  ar: 'إرسال معلومات',   en: 'Send Info' },
    { key: 'note',       ar: 'ملاحظة',           en: 'Note' },
  ];
  const [taskForm, setTaskForm] = useState({ type: 'followup', notes: '', priority: 'medium', due_date: '' });

  // Contact status state (optional section)
  const CONTACT_STATUSES = [
    { id: 'new', ar: 'جديد', en: 'New', color: '#4A7AAB' },
    { id: 'active', ar: 'نشط', en: 'Active', color: '#10B981' },
    { id: 'inactive', ar: 'غير نشط', en: 'Inactive', color: '#F59E0B' },
    { id: 'has_opportunity', ar: 'لديه فرصة', en: 'Has Opportunity', color: '#059669' },
  ];
  const [changeStatus, setChangeStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(contact?.contact_status || '');

  const [saving, setSaving] = useState(false);

  const meetingSubRequired = actForm.type === 'meeting';
  const taskDateRequired = addTask && !taskForm.due_date;
  const canSave = (actMode === 'schedule'
    ? !!actForm.scheduled_date && (!meetingSubRequired || actForm.meeting_subtype)
    : (!resultRequired || actForm.result) && (!meetingSubRequired || actForm.meeting_subtype))
    && !taskDateRequired;

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);

    // 1. Save activity
    const actData = { ...actForm, created_at: new Date().toISOString() };
    actData.status = actMode === 'schedule' ? 'scheduled' : 'completed';
    if (actMode === 'schedule' && actForm.scheduled_date) {
      actData.scheduled_date = actForm.scheduled_date;
    }
    // Add meeting subtype label to description
    if (actForm.type === 'meeting' && actForm.meeting_subtype && MEETING_SUBTYPES[actForm.meeting_subtype]) {
      const subtypeLabel = isRTL ? MEETING_SUBTYPES[actForm.meeting_subtype].ar : MEETING_SUBTYPES[actForm.meeting_subtype].en;
      actData.description = `[${subtypeLabel}]${actForm.description ? ' ' + actForm.description : ''}`;
    }
    if (actForm.result && currentResults.length > 0) {
      const found = currentResults.find(r => r.value === actForm.result);
      const resultLabel = found ? found.label : actForm.result;
      actData.description = `${resultLabel}${actData.description ? ' — ' + actData.description : ''}`;
    }
    await onSaveActivity(actData);

    // 2. Save task if enabled
    if (addTask && taskForm.type && taskForm.due_date) {
      const selectedType = TASK_TYPES.find(t => t.key === taskForm.type);
      const title = selectedType ? (isRTL ? selectedType.ar : selectedType.en) : taskForm.type;
      await onSaveTask({ ...taskForm, title, contact_id: contact.id, contact_name: contact.full_name, dept: 'crm' });
    }

    // 3. Change contact status if enabled
    if (changeStatus && newStatus) {
      onStatusChange(newStatus);
    }

    setSaving(false);
    onCancel();
  };

  const RESULT_TITLES = {
    call: isRTL ? 'نتيجة المكالمة' : 'Call Result',
    whatsapp: isRTL ? 'نتيجة الرسالة' : 'Message Result',
    email: isRTL ? 'نتيجة الإيميل' : 'Email Result',
    meeting: isRTL ? 'نتيجة المقابلة' : 'Meeting Result',
  };

  const sectionHeader = (icon, label, color, enabled, onToggle, required) => (
    <button
      onClick={required ? undefined : onToggle}
      className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border-0 font-cairo transition-colors ${
        required ? 'bg-transparent cursor-default' : 'cursor-pointer hover:bg-surface-input/50 dark:hover:bg-surface-input-dark/50 bg-transparent'
      } ${enabled ? 'text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}
    >
      {icon}
      <span>{label}</span>
      {required && <span className="text-red-500 text-[10px]">*</span>}
      <span className="flex-1" />
      {!required && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${enabled ? 'bg-brand-500/15 text-brand-500' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'}`}>
          {enabled ? (isRTL ? 'مفعل' : 'ON') : (isRTL ? 'اختياري' : 'OFF')}
        </span>
      )}
    </button>
  );

  return (
    <div className="bg-gradient-to-b from-brand-500/[0.06] to-transparent border border-brand-500/20 rounded-xl p-3.5 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center">
          <Zap size={14} className="text-brand-500" />
        </div>
        <span className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'اتخذ إجراء' : 'Take Action'}</span>
      </div>

      {/* ── Section 1: Activity (Required) ── */}
      {sectionHeader(<Phone size={13} className="text-brand-500" />, isRTL ? 'سجل نشاط' : 'Log Activity', '#4A7AAB', true, null, true)}
      <div className="ps-3 mb-3">
        {/* Schedule vs Log Now toggle */}
        <div className="flex gap-1.5 mb-2.5">
          <button onClick={() => setActMode('log')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
              actMode === 'log'
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-emerald-500/40'
            }`}>
            <Check size={11} /> {isRTL ? 'سجل الآن' : 'Log now'}
          </button>
          <button onClick={() => setActMode('schedule')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
              actMode === 'schedule'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-blue-500/40'
            }`}>
            <Calendar size={11} /> {isRTL ? 'جدول' : 'Schedule'}
          </button>
        </div>
        {/* Scheduled date picker */}
        {actMode === 'schedule' && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">
              {isRTL ? 'تاريخ الموعد' : 'Scheduled Date'} <span className="text-red-500">*</span>
            </div>
            <input type="datetime-local" value={actForm.scheduled_date} onChange={e => setAct('scheduled_date', e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
          </div>
        )}
        {/* Activity type chips */}
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {(activityTypes || []).map(v => (
            <button key={v.key} onClick={() => setAct('type', v.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                actForm.type === v.key
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/40'
              }`}>
              {isRTL ? v.labelAr : v.label}
            </button>
          ))}
        </div>
        {/* Meeting subtype */}
        {actForm.type === 'meeting' && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نوع المقابلة' : 'Meeting Type'} <span className="text-red-500">*</span></div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(MEETING_SUBTYPES).map(([k, v]) => (
                <button key={k} onClick={() => setActForm(f => ({ ...f, meeting_subtype: f.meeting_subtype === k ? '' : k }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                    actForm.meeting_subtype === k
                      ? 'bg-[#2B4C6F] text-white border-[#2B4C6F]'
                      : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-[#2B4C6F]/40'
                  }`}>
                  {isRTL ? v.ar : v.en}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Result buttons */}
        {currentResults.length > 0 && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{RESULT_TITLES[actForm.type]} <span className="text-red-500">*</span></div>
            <div className="flex gap-1.5 flex-wrap">
              {currentResults.map(r => (
                <button key={r.value} onClick={() => setActForm(f => ({ ...f, result: f.result === r.value ? '' : r.value }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer border font-cairo ${actForm.result === r.value ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={actForm.result === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Textarea size="sm" rows={2}
          placeholder={isRTL ? 'وصف / ملاحظات...' : 'Description / notes...'}
          value={actForm.description} onChange={e => setAct('description', e.target.value)} />
      </div>

      <div className="border-t border-brand-500/10 my-2" />

      {/* ── Section 2: Task (Optional) ── */}
      {sectionHeader(<CheckSquare size={13} className="text-amber-500" />, isRTL ? 'أضف مهمة' : 'Add Task', '#F59E0B', addTask, () => setAddTask(p => !p))}
      {addTask && (
        <div className="ps-3 mb-3 mt-1">
          {/* Follow-up type chips */}
          <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نوع المهمة' : 'Task Type'}</div>
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {TASK_TYPES.map(ft => (
              <button key={ft.key} onClick={() => setTaskForm(f => ({ ...f, type: ft.key }))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                  taskForm.type === ft.key
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-amber-500/40'
                }`}>
                {isRTL ? ft.ar : ft.en}
              </button>
            ))}
          </div>
          {/* Description textarea */}
          <Textarea size="sm" rows={2}
            placeholder={isRTL ? 'وصف / تفاصيل...' : 'Description / details...'}
            value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
            className="mb-2" />
          <div className="flex gap-2">
            <Select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} className="flex-1" size="sm">
              {Object.entries(TASK_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
            </Select>
            <input type="datetime-local" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} required
              className={`flex-1 px-2 py-1.5 rounded-lg border bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none ${taskDateRequired ? 'border-red-500' : 'border-edge dark:border-edge-dark'}`} />
          </div>
        </div>
      )}

      <div className="border-t border-brand-500/10 my-2" />

      {/* ── Section 3: Contact Status (Optional) ── */}
      {sectionHeader(<Target size={13} className="text-emerald-500" />, isRTL ? 'حالة التواصل' : 'Contact Status', '#10B981', changeStatus, () => setChangeStatus(p => !p))}
      {changeStatus && (
        <div className="ps-3 mb-3 mt-1">
          <div className="flex gap-1.5 flex-wrap">
            {CONTACT_STATUSES.map(s => (
              <button key={s.id} onClick={() => setNewStatus(s.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                  newStatus === s.id
                    ? ''
                    : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:border-emerald-500/40'
                }`}
                style={newStatus === s.id ? { background: s.color + '18', border: `1px solid ${s.color}`, color: s.color } : undefined}>
                {isRTL ? s.ar : s.en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Save / Cancel ── */}
      <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-brand-500/10">
        <Button variant="secondary" size="sm" onClick={onCancel}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
        <Button size="sm" onClick={handleSaveAll} disabled={!canSave || saving} className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
          <Zap size={12} />
          {saving ? '...' : (isRTL ? 'حفظ الكل' : 'Save All')}
        </Button>
      </div>
    </div>
  );
}
