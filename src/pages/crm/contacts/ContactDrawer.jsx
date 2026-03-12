import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { Phone, MessageCircle, Mail, Ban, X, Clock, Star, Users, FileDown, CheckSquare, Pencil, Target, ChevronDown, Plus } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import {
  fetchContactActivities, createActivity,
  fetchContactOpportunities
} from '../../../services/contactsService';
import { createOpportunity } from '../../../services/opportunitiesService';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_TYPES, TASK_STATUSES } from '../../../services/tasksService';
import EditContactModal from './EditContactModal';
import {
  useEscClose, SOURCE_LABELS, SOURCE_EN, stageLabel, coldLabel,
  TEMP, TYPE, fmtBudget, daysSince, initials, normalizePhone,
  Chip, ScorePill, getDeptStages, deptStageLabel,
} from './constants';

const ACT_ICON_MAP = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: Clock, site_visit: Star };

const TIMELINE_CONFIG = {
  activity: { color: '#4A7AAB', bg: 'rgba(74,122,171,0.10)', defaultIcon: Clock },
  task:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  defaultIcon: CheckSquare },
  opportunity: { color: '#10B981', bg: 'rgba(16,185,129,0.10)', defaultIcon: Target },
};

// ── Activity Form ─────────────────────────────────────────────────────────
function ActivityForm({ contactId, onSave, onCancel }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const defaultTypes = [
    { key: 'call',          label: 'Call',          labelAr: 'مكالمة',      lucide: 'Phone'          },
    { key: 'whatsapp',      label: 'WhatsApp',      labelAr: 'واتساب',      lucide: 'MessageCircle'  },
    { key: 'email',         label: 'Email',         labelAr: 'إيميل',       lucide: 'Mail'           },
    { key: 'meeting',       label: 'Meeting',       labelAr: 'اجتماع',      lucide: 'Users'          },
    { key: 'site_visit',    label: 'Site Visit',    labelAr: 'زيارة موقع',  lucide: 'Calendar'       },
    { key: 'note',          label: 'Note',          labelAr: 'ملاحظة',      lucide: 'Clock'          },
    { key: 'status_change', label: 'Status Change', labelAr: 'تغيير حالة',  lucide: 'CheckCircle2'   },
  ];
  const [activityTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('platform_activity_types');
      return saved ? JSON.parse(saved) : defaultTypes;
    } catch { return defaultTypes; }
  });

  const ACTIVITY_RESULTS = {
    call: [
      { value: 'answered', label: isRTL ? 'رد' : 'Answered', color: '#10B981' },
      { value: 'no_answer', label: isRTL ? 'لم يرد' : 'No Answer', color: '#F59E0B' },
      { value: 'busy', label: isRTL ? 'مشغول' : 'Busy', color: '#EF4444' },
      { value: 'switched_off', label: isRTL ? 'مغلق' : 'Switched Off', color: '#6b7280' },
      { value: 'wrong_number', label: isRTL ? 'رقم خاطئ' : 'Wrong Number', color: '#9333EA' },
    ],
    whatsapp: [
      { value: 'replied', label: isRTL ? 'رد' : 'Replied', color: '#10B981' },
      { value: 'seen', label: isRTL ? 'شاف' : 'Seen', color: '#3B82F6' },
      { value: 'delivered', label: isRTL ? 'وصلت' : 'Delivered', color: '#F59E0B' },
      { value: 'not_delivered', label: isRTL ? 'لم تصل' : 'Not Delivered', color: '#EF4444' },
      { value: 'blocked', label: isRTL ? 'محظور' : 'Blocked', color: '#6b7280' },
    ],
    email: [
      { value: 'replied', label: isRTL ? 'رد' : 'Replied', color: '#10B981' },
      { value: 'opened', label: isRTL ? 'فتح' : 'Opened', color: '#3B82F6' },
      { value: 'sent', label: isRTL ? 'تم الإرسال' : 'Sent', color: '#F59E0B' },
      { value: 'bounced', label: isRTL ? 'ارتد' : 'Bounced', color: '#EF4444' },
    ],
    meeting: [
      { value: 'attended', label: isRTL ? 'حضر' : 'Attended', color: '#10B981' },
      { value: 'cancelled', label: isRTL ? 'ألغى' : 'Cancelled', color: '#EF4444' },
      { value: 'rescheduled', label: isRTL ? 'أُجّل' : 'Rescheduled', color: '#F59E0B' },
      { value: 'no_show', label: isRTL ? 'لم يحضر' : 'No Show', color: '#6b7280' },
    ],
    site_visit: [
      { value: 'visited', label: isRTL ? 'زار' : 'Visited', color: '#10B981' },
      { value: 'cancelled', label: isRTL ? 'ألغى' : 'Cancelled', color: '#EF4444' },
      { value: 'rescheduled', label: isRTL ? 'أُجّل' : 'Rescheduled', color: '#F59E0B' },
      { value: 'no_show', label: isRTL ? 'لم يحضر' : 'No Show', color: '#6b7280' },
    ],
  };

  const RESULT_TITLES = {
    call: isRTL ? 'نتيجة المكالمة' : 'Call Result',
    whatsapp: isRTL ? 'نتيجة الرسالة' : 'Message Result',
    email: isRTL ? 'نتيجة الإيميل' : 'Email Result',
    meeting: isRTL ? 'نتيجة الاجتماع' : 'Meeting Result',
    site_visit: isRTL ? 'نتيجة الزيارة' : 'Visit Result',
  };

  const [form, setForm] = useState({ type: activityTypes[0]?.key || 'call', description: '', next_action: '', next_action_date: '', result: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'type' ? { result: '' } : {}) }));

  const currentResults = ACTIVITY_RESULTS[form.type] || [];
  const resultRequired = currentResults.length > 0;
  const canSave = !resultRequired || form.result;

  const handleSave = () => {
    if (!canSave) return;
    const data = { ...form, created_at: new Date().toISOString() };
    if (form.result && currentResults.length > 0) {
      const found = currentResults.find(r => r.value === form.result);
      const resultLabel = found ? found.label : form.result;
      data.description = `${resultLabel}${form.description ? ' — ' + form.description : ''}`;
    }
    onSave(data);
  };

  return (
    <div className="bg-brand-500/[0.07] border border-brand-500/20 rounded-xl p-3.5 mb-3">
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Select size="sm" value={form.type} onChange={e => set('type', e.target.value)}>
          {activityTypes.map(v => (
            <option key={v.key} value={v.key}>{isRTL ? (v.labelAr || v.label) : v.label}</option>
          ))}
        </Select>
        <Input size="sm" type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)}
          placeholder={isRTL ? 'تاريخ المتابعة' : 'Follow-up date'} />
      </div>
      {currentResults.length > 0 && (
        <div className="mb-2.5">
          <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{RESULT_TITLES[form.type]} <span className="text-red-500">*</span></div>
          <div className="flex gap-1.5 flex-wrap">
            {currentResults.map(r => (
              <button key={r.value} onClick={() => setForm(f => ({ ...f, result: f.result === r.value ? '' : r.value }))}
                className={`px-3 py-1.5 rounded-2xl text-xs cursor-pointer border ${form.result === r.value ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                style={form.result === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {resultRequired && !form.result && (
        <div className="text-[10px] text-red-500 mb-1.5">{isRTL ? 'اختر النتيجة أولاً' : 'Select a result first'}</div>
      )}
      <Textarea size="sm" className="mb-2.5" rows={2}
        placeholder={isRTL ? 'وصف النشاط...' : 'Activity description...'}
        value={form.description} onChange={e => set('description', e.target.value)} />
      <Input size="sm" className="mb-3"
        placeholder={isRTL ? 'الإجراء التالي (اختياري)...' : 'Next action (optional)...'}
        value={form.next_action} onChange={e => set('next_action', e.target.value)} />
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave} className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
          {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ── Contact Drawer ─────────────────────────────────────────────────────────
export default function ContactDrawer({ contact, onClose, onBlacklist, onUpdate, onAddOpportunity }) {
  const [showEdit, setShowEdit] = useState(false);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const [tab, setTab] = useState('summary');
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showOppModal, setShowOppModal] = useState(false);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [newOpp, setNewOpp] = useState({ project:'', budget:'', stage:'qualification', temperature:'warm', priority:'medium', notes:'' });

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    Promise.allSettled([
      fetchContactActivities(contact.id),
      fetchTasks({ contactId: contact.id }),
      fetchContactOpportunities(contact.id),
    ]).then(([actsRes, tasksRes, oppsRes]) => {
      if (cancelled) return;
      if (actsRes.status === 'fulfilled') setActivities(actsRes.value);
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value);
      if (oppsRes.status === 'fulfilled') setOpportunities(oppsRes.value);
      setLoadingData(false);
    });
    return () => { cancelled = true; };
  }, [contact.id]);

  useEffect(() => {
    if (!showOppModal) return;
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setShowOppModal(false); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [showOppModal]);

  const handleSaveActivity = async (form) => {
    try {
      const { user_id, ...formData } = form;
      const act = await createActivity({ ...formData, contact_id: contact.id });
      setActivities(prev => [act, ...prev]);
      setShowActivityForm(false);
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch (err) {
      const localAct = {
        id: String(Date.now()),
        ...form,
        contact_id: contact.id,
        users: { full_name_ar: 'أنت', full_name_en: 'You' },
      };
      setActivities(prev => [localAct, ...prev]);
      setShowActivityForm(false);
      toast.success(isRTL ? 'تم حفظ النشاط محلياً' : 'Activity saved locally');
    }
  };

  const handleSaveTask = async () => {
    if (!newTask.title.trim() || !newTask.due_date || !contact) return;
    setSavingTask(true);
    try {
      const savedTask = await createTask({ ...newTask, contact_id: contact.id, contact_name: contact.full_name, dept: 'crm' });
      setTasks(prev => [savedTask, ...prev]);
      setNewTask({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
      setShowTaskForm(false);
    } finally { setSavingTask(false); }
  };

  const handleSaveOpp = async () => {
    if (!newOpp.project.trim()) { toast.warning(isRTL ? 'اسم المشروع مطلوب' : 'Project name is required'); return; }
    const oppData = { contact_id: contact.id, budget: Number(newOpp.budget) || 0, stage: newOpp.stage, temperature: newOpp.temperature, priority: newOpp.priority, notes: newOpp.notes };
    const saved = await createOpportunity(oppData);
    const opp = { ...saved, contactName: contact.full_name, contacts: { id: contact.id, full_name: contact.full_name, phone: contact.phone, email: contact.email, department: contact.department, contact_type: contact.contact_type }, projects: { name_ar: newOpp.project, name_en: newOpp.project } };
    setOpportunities(prev => [opp, ...prev]);
    setShowOppModal(false);
    setNewOpp({ project: '', budget: '', stage: 'qualification', temperature: 'warm', priority: 'medium', notes: '' });
    toast.success(isRTL ? 'تم إنشاء الفرصة' : 'Opportunity created');
  };

  if (!contact) return null;
  const tempInfo = contact.temperature ? TEMP[contact.temperature] : null;
  const tp = contact.contact_type ? TYPE[contact.contact_type] : null;

  const actCount = activities.length;
  const oppCount = opportunities.length;
  const openTaskCount = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;

  // ── Unified Timeline ─────────────────────────────────────────────────────
  const timeline = useMemo(() => {
    const items = [];
    activities.forEach(a => items.push({ ...a, _type: 'activity', _date: a.created_at }));
    tasks.forEach(t => items.push({ ...t, _type: 'task', _date: t.created_at || t.due_date }));
    opportunities.forEach(o => items.push({ ...o, _type: 'opportunity', _date: o.created_at }));
    return items.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
  }, [activities, tasks, opportunities]);

  // Key info rows (always visible)
  const keyInfo = [
    { label: isRTL ? 'الهاتف' : 'Phone', val: contact.phone },
    { label: isRTL ? 'المصدر' : 'Source', val: isRTL ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
    { label: isRTL ? 'الميزانية' : 'Budget', val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
    { label: isRTL ? 'الموقع' : 'Location', val: contact.preferred_location || '—' },
    { label: isRTL ? 'المسؤول' : 'Assigned', val: contact.assigned_to_name || '—' },
  ];

  // Extra details (expandable)
  const extraInfo = [
    { label: isRTL ? 'الهاتف الثاني' : 'Phone 2', val: contact.phone2 || '—' },
    { label: isRTL ? 'الإيميل' : 'Email', val: contact.email || '—' },
    { label: isRTL ? 'الحملة' : 'Campaign', val: contact.campaign_name || '—' },
    { label: isRTL ? 'نوع العقار' : 'Property', val: (isRTL ? { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' } : { residential: 'Residential', commercial: 'Commercial', administrative: 'Administrative' })[contact.interested_in_type] || '—' },
    { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: contact.last_activity_at ? (() => { const d = daysSince(contact.last_activity_at); return d === 0 ? (isRTL ? 'اليوم' : 'Today') : isRTL ? `منذ ${d} يوم` : `${d} days ago`; })() : '—' },
    { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
    { label: isRTL ? 'تاريخ التوزيع' : 'Assigned Date', val: contact.assigned_at ? new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
    { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
    { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
    { label: isRTL ? 'الجنس' : 'Gender', val: contact.gender ? ((isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender) : '—' },
    { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality ? ((isRTL ? { egyptian: 'مصري', saudi: 'سعودي', emirati: 'إماراتي', kuwaiti: 'كويتي', qatari: 'قطري', libyan: 'ليبي', other: 'أخرى' } : { egyptian: 'Egyptian', saudi: 'Saudi', emirati: 'Emirati', kuwaiti: 'Kuwaiti', qatari: 'Qatari', libyan: 'Libyan', other: 'Other' })[contact.nationality] || contact.nationality) : '—' },
    { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: contact.birth_date || '—' },
  ];

  const rowCls = 'flex justify-between items-center py-1.5 border-b border-brand-500/[0.06] text-xs';

  // ── Timeline Item Renderer ─────────────────────────────────────────────
  const renderTimelineItem = (item) => {
    const cfg = TIMELINE_CONFIG[item._type];
    const dateStr = item._date?.slice(0, 10) || '';

    if (item._type === 'activity') {
      const ActIcon = ACT_ICON_MAP[item.type] || cfg.defaultIcon;
      return (
        <div key={'act-' + item.id} className="flex gap-3 py-2.5">
          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5" style={{ background: cfg.bg }}>
            <ActIcon size={14} color={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-content dark:text-content-dark leading-snug">{item.description || (isRTL ? 'نشاط' : 'Activity')}</div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
              <span>{isRTL ? (item.users?.full_name_ar || 'مجهول') : (item.users?.full_name_en || item.users?.full_name_ar || 'Unknown')}</span>
              <span className="opacity-40">·</span>
              <span>{dateStr}</span>
            </div>
            {item.next_action && (
              <div className="mt-1.5 px-2.5 py-1 bg-brand-500/[0.08] rounded-md text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">
                › {item.next_action}{item.next_action_date ? ` — ${item.next_action_date}` : ''}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (item._type === 'task') {
      const pri = TASK_PRIORITIES[item.priority];
      const st = TASK_STATUSES[item.status];
      const due = new Date(item.due_date);
      const overdue = due < new Date() && item.status !== 'done';
      return (
        <div key={'task-' + item.id} className="flex gap-3 py-2.5">
          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5" style={{ background: cfg.bg }}>
            <CheckSquare size={14} color={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold text-content dark:text-content-dark leading-snug ${item.status === 'done' ? 'line-through opacity-60' : ''}`}>
              {item.title}
            </div>
            <div className="flex gap-1.5 flex-wrap mt-1">
              <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold" style={{ background: (pri?.color || '#4A7AAB') + '22', color: pri?.color || '#4A7AAB' }}>
                {isRTL ? pri?.ar : pri?.en}
              </span>
              <span className="text-[10px] px-1.5 py-px rounded-[5px]" style={{ background: (st?.color || '#4A7AAB') + '22', color: st?.color || '#4A7AAB' }}>
                {isRTL ? st?.ar : st?.en}
              </span>
              <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                <Clock size={9} />
                {due.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (item._type === 'opportunity') {
      return (
        <div key={'opp-' + item.id} className="flex gap-3 py-2.5">
          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5" style={{ background: cfg.bg }}>
            <Target size={14} color={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'فرصة' : 'Opp'} #{String(item.id).slice(-4)}</span>
              <Chip label={deptStageLabel(item.stage, contact.department || 'sales', isRTL)} color="#10B981" bg="rgba(16,185,129,0.1)" />
            </div>
            <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex flex-col gap-0.5">
              {item.projects?.name_ar && <span>{isRTL ? item.projects.name_ar : (item.projects.name_en || item.projects.name_ar)}</span>}
              <span>{dateStr}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { onUpdate(updated); setShowEdit(false); }} />}
    <div className="fixed inset-0 z-[900] flex" dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={onClose} className="flex-1 bg-black/45" />
      <div className={`contact-drawer w-[430px] max-w-[100vw] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden ${isRTL ? 'border-l' : 'border-r'} border-edge dark:border-edge-dark`}>

        {/* ═══ Drawer Header ═══ */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-surface-bg to-surface-card dark:from-[#1B3347] dark:to-surface-card-dark shrink-0">
          <div className="flex justify-between items-start mb-3.5">
            <div className="flex gap-3 items-center">
              <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-lg font-bold ${contact.is_blacklisted ? 'bg-red-500/20 text-red-500' : 'bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white'}`}>
                {contact.is_blacklisted ? <Ban size={18} /> : initials(contact.full_name)}
              </div>
              <div>
                <div className={`text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] ${contact.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                  {contact.prefix ? <span className="text-[#6B8DB5] dark:text-[#6B8DB5] me-1">{contact.prefix}</span> : null}{contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                </div>
                <div className="mt-1 flex gap-1.5 items-center flex-wrap">
                  {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                  {contact.department && <Chip label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department} color="#8BA8C8" bg="rgba(139,168,200,0.1)" />}
                  {contact.is_blacklisted && <Chip label={isRTL ? "بلاك ليست" : "Blacklist"} color="#EF4444" bg="rgba(239,68,68,0.12)" />}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)} className="!text-xs !px-2.5 !py-1">
                <Pencil size={12} /> {isRTL ? 'تعديل' : 'Edit'}
              </Button>
              <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1"><X size={18} /></button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <a href={`tel:${contact.phone}`} className="flex-1 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-500 text-xs font-semibold text-center no-underline flex items-center justify-center gap-1.5">
              <Phone size={13} /> {isRTL ? 'اتصال' : 'Call'}
            </a>
            <a href={`https://wa.me/${normalizePhone(contact.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-[#25D366]/10 border border-[#25D366]/25 rounded-lg text-[#25D366] text-xs font-semibold text-center no-underline flex items-center justify-center gap-1.5">
              <MessageCircle size={13} /> {isRTL ? 'واتساب' : 'WhatsApp'}
            </a>
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex-1 py-2 bg-brand-500/10 border border-brand-500/25 rounded-lg text-[#6B8DB5] dark:text-[#6B8DB5] text-xs font-semibold text-center no-underline flex items-center justify-center gap-1.5">
                <Mail size={13} /> {isRTL ? 'إيميل' : 'Email'}
              </a>
            )}
            {!contact.is_blacklisted && (
              <button onClick={() => onBlacklist(contact)} className="flex-1 py-2 bg-red-500/[0.08] border border-red-500/25 rounded-lg text-red-500 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                <Ban size={13} /> {isRTL ? 'بلاك' : 'Block'}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-edge dark:border-edge-dark mt-4">
            {[
              ['summary', isRTL ? 'ملخص' : 'Summary'],
              ['timeline', (isRTL ? 'السجل' : 'Timeline') + (timeline.length ? ` (${timeline.length})` : '')],
              ...(contact.contact_type === 'supplier' ? [['invoices', isRTL ? 'الفواتير' : 'Invoices']] : []),
            ].map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 bg-transparent border-0 border-b-2 border-solid text-xs cursor-pointer ${tab === k ? 'border-b-brand-500 text-brand-500 font-bold' : 'border-b-transparent text-content-muted dark:text-content-muted-dark font-normal'}`}>{v}</button>
            ))}
          </div>
        </div>

        {/* ═══ Drawer Body ═══ */}
        <div className="flex-1 overflow-auto p-5">

          {/* ══════ SUMMARY TAB ══════ */}
          {tab === 'summary' && (
            <div>
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-brand-500/[0.07] border border-brand-500/[0.12] rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-brand-500">{loadingData ? '…' : actCount}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'نشاط' : 'Activities'}</div>
                </div>
                <div className="bg-emerald-500/[0.07] border border-emerald-500/[0.15] rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-500">{loadingData ? '…' : oppCount}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'فرصة' : 'Opps'}</div>
                </div>
                <div className="bg-amber-500/[0.07] border border-amber-500/[0.15] rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-amber-500">{loadingData ? '…' : openTaskCount}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'مهمة مفتوحة' : 'Open Tasks'}</div>
                </div>
              </div>

              {/* Score & Temperature */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-brand-500/[0.07] rounded-xl p-3 border border-brand-500/[0.12]">
                  <div className="text-content-muted dark:text-content-muted-dark text-xs mb-2">{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                  <ScorePill score={contact.lead_score} />
                </div>
                <div className="rounded-xl p-3" style={{ background: tempInfo?.bg || 'rgba(74,122,171,0.05)', border: `1px solid ${tempInfo?.color || 'transparent'}30` }}>
                  <div className="text-content-muted dark:text-content-muted-dark text-xs mb-1">{isRTL ? 'الحرارة' : 'Temperature'}</div>
                  {tempInfo?.Icon ? <div className="flex items-center gap-1.5"><tempInfo.Icon size={14} color={tempInfo.color} /><span className="font-bold text-sm" style={{ color: tempInfo?.color }}>{isRTL ? tempInfo?.labelAr : tempInfo?.label}</span></div> : <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>}
                </div>
              </div>

              {/* Key Info */}
              <div className="mb-3">
                {keyInfo.map(r => (
                  <div key={r.label} className={rowCls}>
                    <span className="text-content-muted dark:text-content-muted-dark">{r.label}</span>
                    <span className="text-content dark:text-content-dark font-medium max-w-[55%] text-end whitespace-nowrap overflow-hidden text-ellipsis">{r.val}</span>
                  </div>
                ))}

                {/* Expandable details */}
                <button onClick={() => setShowAllDetails(p => !p)}
                  className="w-full flex items-center justify-center gap-1 py-2 mt-1 text-[11px] text-brand-500 font-semibold bg-transparent border-none cursor-pointer hover:bg-brand-500/5 rounded-lg transition-colors">
                  <ChevronDown size={13} className={`transition-transform ${showAllDetails ? 'rotate-180' : ''}`} />
                  {showAllDetails ? (isRTL ? 'إخفاء التفاصيل' : 'Hide Details') : (isRTL ? 'عرض كل البيانات' : 'Show All Details')}
                </button>

                {showAllDetails && (
                  <div className="mt-1">
                    {extraInfo.map(r => (
                      <div key={r.label} className={rowCls}>
                        <span className="text-content-muted dark:text-content-muted-dark">{r.label}</span>
                        <span className="text-content dark:text-content-dark font-medium max-w-[55%] text-end whitespace-nowrap overflow-hidden text-ellipsis">{r.val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              {contact.notes && (
                <div className="mb-4 px-3.5 py-2.5 bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-xl text-xs text-content-muted dark:text-content-muted-dark">
                  <div className="font-semibold mb-1 text-xs text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'ملاحظات' : 'Notes'}</div>
                  {contact.notes}
                </div>
              )}

              {/* Blacklist reason */}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div className="mb-4 px-3.5 py-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-xl text-xs text-red-500 flex gap-1.5 items-start">
                  <Ban size={13} className="shrink-0 mt-0.5" /> <span className="overflow-hidden text-ellipsis">{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                </div>
              )}

              {/* Recent Timeline Preview (last 5) */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'آخر الأحداث' : 'Recent Activity'}</div>
                  <div className="flex-1 h-px bg-brand-500/10" />
                </div>

                {loadingData ? (
                  <div className="text-center p-6 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
                ) : timeline.length === 0 ? (
                  <div className="text-center p-6 text-content-muted dark:text-content-muted-dark">
                    <Clock size={24} className="opacity-25 mb-2 mx-auto" />
                    <p className="m-0 text-xs">{isRTL ? 'لا توجد سجلات بعد' : 'No records yet'}</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-brand-500/[0.06]">
                      {timeline.slice(0, 5).map(item => renderTimelineItem(item))}
                    </div>
                    {timeline.length > 5 && (
                      <button onClick={() => setTab('timeline')}
                        className="w-full mt-2 py-2 text-[11px] text-brand-500 font-semibold bg-brand-500/[0.05] hover:bg-brand-500/[0.10] border border-brand-500/15 rounded-lg cursor-pointer transition-colors">
                        {isRTL ? `عرض السجل الكامل (${timeline.length})` : `View Full Timeline (${timeline.length})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══════ TIMELINE TAB ══════ */}
          {tab === 'timeline' && (
            <div>
              {/* Action Buttons */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => { setShowActivityForm(p => !p); setShowTaskForm(false); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border transition-colors ${showActivityForm ? 'bg-brand-500 text-white border-brand-500' : 'bg-brand-500/[0.08] border-brand-500/25 text-brand-500'}`}>
                  <Plus size={13} /> {isRTL ? 'نشاط' : 'Activity'}
                </button>
                <button onClick={() => { setShowTaskForm(p => !p); setShowActivityForm(false); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border transition-colors ${showTaskForm ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-500/[0.08] border-amber-500/25 text-amber-500'}`}>
                  <Plus size={13} /> {isRTL ? 'مهمة' : 'Task'}
                </button>
                <button onClick={() => setShowOppModal(true)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-500 transition-colors">
                  <Plus size={13} /> {isRTL ? 'فرصة' : 'Opportunity'}
                </button>
              </div>

              {/* Inline Activity Form */}
              {showActivityForm && <ActivityForm contactId={contact.id} onSave={handleSaveActivity} onCancel={() => setShowActivityForm(false)} />}

              {/* Inline Task Form */}
              {showTaskForm && (
                <div className="bg-amber-500/[0.07] border border-amber-500/20 rounded-xl p-3.5 mb-3">
                  <div className="flex flex-col gap-2">
                    <input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))}
                      placeholder={isRTL ? 'عنوان المهمة...' : 'Task title...'}
                      className="px-2.5 py-[7px] rounded-[7px] border border-amber-500/20 bg-[#f8fafc] dark:bg-[rgba(15,30,45,0.6)] text-content dark:text-content-dark text-xs outline-none"
                      dir={isRTL ? 'rtl' : 'ltr'} />
                    <div className="flex gap-1.5">
                      <Select value={newTask.type} onChange={e => setNewTask(f => ({ ...f, type: e.target.value }))} className="flex-1">
                        {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </Select>
                      <Select value={newTask.priority} onChange={e => setNewTask(f => ({ ...f, priority: e.target.value }))} className="flex-1">
                        {Object.entries(TASK_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </Select>
                    </div>
                    <input type="datetime-local" value={newTask.due_date} onChange={e => setNewTask(f => ({ ...f, due_date: e.target.value }))}
                      className="px-2 py-1.5 rounded-[7px] border border-amber-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setShowTaskForm(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                      <Button size="sm" onClick={handleSaveTask} disabled={savingTask || !newTask.title.trim() || !newTask.due_date}>
                        {savingTask ? '...' : (isRTL ? 'حفظ' : 'Save')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Timeline */}
              {loadingData ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : timeline.length === 0 ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                  <Clock size={28} className="opacity-25 mb-2 mx-auto" />
                  <p className="m-0 text-xs">{isRTL ? 'لا توجد سجلات بعد' : 'No records yet'}</p>
                </div>
              ) : (
                <div className="divide-y divide-brand-500/[0.06]">
                  {timeline.map(item => renderTimelineItem(item))}
                </div>
              )}
            </div>
          )}

          {/* ══════ INVOICES TAB ══════ */}
          {tab === 'invoices' && (
            <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
              <FileDown size={28} className="mb-2 opacity-30 mx-auto" />
              <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
              <p className="mt-1 mb-3 text-xs">{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
              <Button size="sm">+ {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}</Button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ═══ New Opportunity Modal ═══ */}
    {showOppModal && (
      <div onClick={() => setShowOppModal(false)} className="fixed inset-0 z-[1100] flex items-center justify-center p-5 bg-black/50">
        <div dir={isRTL ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-xl p-6 w-full max-w-[420px] border border-edge dark:border-edge-dark">
          <div className="flex justify-between items-center mb-5">
            <h3 className="m-0 text-content dark:text-content-dark text-sm font-bold">{isRTL ? 'فرصة جديدة - ' : 'New Opportunity - '}{contact.full_name}</h3>
            <button onClick={() => setShowOppModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer text-lg">✕</button>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: 'project', label_ar: 'المشروع', label_en: 'Project', type: 'text' },
              { key: 'budget', label_ar: 'الميزانية', label_en: 'Budget', type: 'number' },
              { key: 'notes', label_ar: 'ملاحظات', label_en: 'Notes', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? f.label_ar : f.label_en}</label>
                <input type={f.type} value={newOpp[f.key]} onChange={e => setNewOpp(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-xs outline-none box-border font-inherit"
                  style={{ textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
              </div>
            ))}
            <div>
              <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? 'المرحلة' : 'Stage'}</label>
              <Select value={newOpp.stage} onChange={e => setNewOpp(p => ({ ...p, stage: e.target.value }))} className="w-full">
                {getDeptStages(contact.department || 'sales').map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </Select>
            </div>
            {[
              { key: 'temperature', label_ar: 'الحرارة', label_en: 'Temperature', options: [{ v: 'hot', ar: 'ساخن', en: 'Hot' }, { v: 'warm', ar: 'دافئ', en: 'Warm' }, { v: 'normal', ar: 'عادي', en: 'Normal' }, { v: 'cold', ar: 'بارد', en: 'Cold' }] },
              { key: 'priority', label_ar: 'الأولوية', label_en: 'Priority', options: [{ v: 'urgent', ar: 'عاجل', en: 'Urgent' }, { v: 'high', ar: 'عالي', en: 'High' }, { v: 'medium', ar: 'متوسط', en: 'Medium' }, { v: 'low', ar: 'منخفض', en: 'Low' }] },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? f.label_ar : f.label_en}</label>
                <Select value={newOpp[f.key]} onChange={e => setNewOpp(p => ({ ...p, [f.key]: e.target.value }))} className="w-full">
                  {f.options.map(o => <option key={o.v} value={o.v}>{isRTL ? o.ar : o.en}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-5">
            <Button className="flex-1" size="sm" onClick={handleSaveOpp}>
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowOppModal(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
