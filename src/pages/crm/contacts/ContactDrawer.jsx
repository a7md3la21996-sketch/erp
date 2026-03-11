import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { Phone, MessageCircle, Mail, Ban, X, Clock, Star, Users, FileDown, CheckSquare, Pencil } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import {
  fetchContactActivities, createActivity,
  fetchContactOpportunities
} from '../../../services/contactsService';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_TYPES, TASK_STATUSES } from '../../../services/tasksService';
import EditContactModal from './EditContactModal';
import {
  useEscClose, SOURCE_LABELS, SOURCE_EN, STAGE_LABELS, stageLabel, coldLabel,
  TEMP, TYPE, fmtBudget, daysSince, initials, normalizePhone,
  Chip, ScorePill,
} from './constants';

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

  const [form, setForm] = useState({ type: activityTypes[0]?.key || 'call', description: '', next_action: '', next_action_date: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const now = new Date().toLocaleString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleSave = () => {
    onSave({ ...form, created_at: new Date().toISOString() });
  };

  return (
    <div className="bg-brand-500/[0.07] border border-brand-500/20 rounded-[10px] p-3.5 mb-3">
      <div className="flex items-center gap-1.5 mb-2.5 px-2.5 py-[5px] bg-brand-500/[0.08] rounded-md">
        <Clock size={11} className="text-content-muted dark:text-content-muted-dark" />
        <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{now}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Select size="sm" value={form.type} onChange={e => set('type', e.target.value)}>
          {activityTypes.map(v => (
            <option key={v.key} value={v.key}>{isRTL ? (v.labelAr || v.label) : v.label}</option>
          ))}
        </Select>
        <Input size="sm" type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)}
          placeholder={isRTL ? 'تاريخ المتابعة' : 'Follow-up date'} />
      </div>
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
        <Button size="sm" onClick={handleSave}>
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
  const [tab, setTab] = useState('info');
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [addTaskForm, setAddTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [loadingActs, setLoadingActs] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showOppModal, setShowOppModal] = useState(false);
  const [newOpp, setNewOpp] = useState({ project:'', budget:'', stage:'new', temperature:'warm', priority:'medium', agent:'', notes:'' });

  useEffect(() => {
    let cancelled = false;
    if (tab === 'activities') {
      setLoadingActs(true);
      fetchContactActivities(contact.id)
        .then(data => { if (!cancelled) setActivities(data); })
        .catch(() => { if (!cancelled) { setActivities([]); toast.error(isRTL ? 'تعذر تحميل النشاطات' : 'Failed to load activities'); } })
        .finally(() => { if (!cancelled) setLoadingActs(false); });
    }
    if (tab === 'tasks') {
      setLoadingTasks(true);
      fetchTasks({ contactId: contact.id })
        .then(data => { if (!cancelled) setTasks(data); })
        .catch(() => { if (!cancelled) { setTasks([]); toast.error(isRTL ? 'تعذر تحميل المهام' : 'Failed to load tasks'); } })
        .finally(() => { if (!cancelled) setLoadingTasks(false); });
    }
    if (tab === 'opportunities') {
      setLoadingOpps(true);
      fetchContactOpportunities(contact.id)
        .then(data => { if (!cancelled) setOpportunities(data); })
        .catch(() => { if (!cancelled) setOpportunities([]); })
        .finally(() => { if (!cancelled) setLoadingOpps(false); });
    }
    return () => { cancelled = true; };
  }, [tab, contact.id]);

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

  if (!contact) return null;
  const tempInfo = TEMP[contact.temperature];
  const tp = TYPE[contact.contact_type];

  const baseTabs = [['info', isRTL ? 'البيانات' : 'Info'], ['activities', isRTL ? 'الأنشطة' : 'Activities'], ['opportunities', isRTL ? 'الفرص' : 'Opportunities'], ['tasks', isRTL ? 'المهام' : 'Tasks']];
  const tabs = contact.contact_type === 'supplier' ? [...baseTabs, ['invoices', isRTL ? 'الفواتير' : 'Invoices']] : baseTabs;

  const rowCls = 'flex justify-between items-center py-2 border-b border-brand-500/[0.08] text-[13px]';

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { onUpdate(updated); setShowEdit(false); }} />}
    <div className="fixed inset-0 z-[900] flex" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <div onClick={onClose} className="flex-1 bg-black/45" />
      <div className={`contact-drawer w-[430px] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden ${isRTL ? 'border-l' : 'border-r'} border-edge dark:border-edge-dark`}>

        {/* Drawer Header */}
        <div className="px-5 pt-5 bg-gradient-to-b from-surface-bg to-surface-card dark:from-[#1B3347] dark:to-surface-card-dark">
          <div className="flex justify-between items-start mb-3.5">
            <div className="flex gap-3 items-center">
              <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-lg font-extrabold ${contact.is_blacklisted ? 'bg-red-500/20 text-red-500' : 'bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white'}`}>
                {contact.is_blacklisted ? <Ban size={18} /> : initials(contact.full_name)}
              </div>
              <div>
                <div className={`text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] ${contact.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                  {contact.prefix ? <span className={`text-[#6B8DB5] dark:text-[#6B8DB5] me-1`}>{contact.prefix}</span> : null}{contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                </div>
                <div className="mt-1 flex gap-1.5 items-center flex-wrap">
                  {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                  {contact.department && <Chip label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department} color="#8BA8C8" bg="rgba(139,168,200,0.1)" />}
                  {contact.is_blacklisted && <Chip label={isRTL ? "بلاك ليست" : "Blacklist"} color="#EF4444" bg="rgba(239,68,68,0.12)" />}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={() => setShowEdit(true)} className="bg-brand-500/10 border border-brand-500/25 rounded-md text-brand-500 cursor-pointer px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1">
                <Pencil size={12} /> {isRTL ? 'تعديل' : 'Edit'}
              </button>
              <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1"><X size={18} /></button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
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
          <div className="flex border-b border-edge dark:border-edge-dark">
            {tabs.map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 bg-transparent border-0 border-b-2 border-solid text-xs cursor-pointer ${tab === k ? 'border-b-brand-500 text-brand-500 font-bold' : 'border-b-transparent text-content-muted dark:text-content-muted-dark font-normal'}`}>{v}</button>
            ))}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-auto p-5">

          {/* INFO TAB */}
          {tab === 'info' && (
            <div>
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-brand-500/[0.07] rounded-[10px] p-3 border border-brand-500/[0.12]">
                  <div className="text-content-muted dark:text-content-muted-dark text-[11px] mb-2">{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                  <ScorePill score={contact.lead_score} />
                </div>
                <div className="rounded-[10px] p-3" style={{ background: tempInfo?.bg, border: `1px solid ${tempInfo?.color || 'transparent'}30` }}>
                  <div className="text-content-muted dark:text-content-muted-dark text-[11px] mb-1">{isRTL ? 'الحرارة' : 'Temperature'}</div>
                  {tempInfo?.Icon && <div className="flex items-center gap-1.5"><tempInfo.Icon size={14} color={tempInfo.color} /><span className="font-bold text-sm" style={{ color: tempInfo?.color }}>{isRTL ? tempInfo?.labelAr : tempInfo?.label}</span></div>}
                </div>
              </div>

              {[
                { label: isRTL ? 'الهاتف الأول' : 'Phone 1',   val: contact.phone },
                { label: isRTL ? 'الهاتف الثاني' : 'Phone 2',  val: contact.phone2 || '—' },
                { label: isRTL ? 'الإيميل' : 'Email',         val: contact.email || '—' },
                { label: isRTL ? 'المصدر'   : 'Source',   val: isRTL ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
                { label: isRTL ? 'الحملة'   : 'Campaign', val: contact.campaign_name || '—' },
                { label: isRTL ? 'الميزانية': 'Budget',   val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
                { label: isRTL ? 'الموقع'   : 'Location', val: contact.preferred_location || '—' },
                { label: isRTL ? 'نوع العقار': 'Property', val: (isRTL ? { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' } : { residential: 'Residential', commercial: 'Commercial', administrative: 'Administrative' })[contact.interested_in_type] || '—' },
                { label: isRTL ? 'المسؤول'  : 'Assigned', val: contact.assigned_to_name || '—' },
                { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: contact.last_activity_at ? (() => { const d = daysSince(contact.last_activity_at); return d === 0 ? (isRTL ? 'اليوم' : 'Today') : isRTL ? `منذ ${d} يوم` : `${d} days ago`; })() : '—' },
                { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                { label: isRTL ? 'تاريخ التوزيع' : 'Assigned Date', val: contact.assigned_at ? new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
                { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
                { label: isRTL ? 'الجنس' : 'Gender', val: contact.gender ? ((isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender) : '—' },
                { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality ? ((isRTL ? { egyptian: 'مصري', saudi: 'سعودي', emirati: 'إماراتي', kuwaiti: 'كويتي', qatari: 'قطري', libyan: 'ليبي', other: 'أخرى' } : { egyptian: 'Egyptian', saudi: 'Saudi', emirati: 'Emirati', kuwaiti: 'Kuwaiti', qatari: 'Qatari', libyan: 'Libyan', other: 'Other' })[contact.nationality] || contact.nationality) : '—' },
                { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: contact.birth_date || '—' },
              ].map(r => (
              <div key={r.label} className={rowCls}>
                <span className="text-content-muted dark:text-content-muted-dark">{r.label}</span>
                <span className={`text-content dark:text-content-dark font-medium max-w-[55%] text-end whitespace-nowrap overflow-hidden text-ellipsis`}>{r.val}</span>
              </div>
              ))}
              {contact.notes && (
                <div className="mt-3 px-3.5 py-2.5 bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] text-xs text-content-muted dark:text-content-muted-dark">
                  <div className="font-semibold mb-1 text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'ملاحظات' : 'Notes'}</div>
                  {contact.notes}
                </div>
              )}

              {contact.stage && (
                <div className={rowCls}>
                  <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'المرحلة' : 'Stage'}</span>
                  <Chip label={stageLabel(contact.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                </div>
              )}
              {contact.cold_status && (
                <div className={rowCls}>
                  <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'حالة الكولد' : 'Cold Status'}</span>
                  <Chip label={coldLabel(contact.cold_status, isRTL)} color="#6B8DB5" bg="rgba(107,141,181,0.1)" />
                </div>
              )}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div className="mt-3.5 px-3.5 py-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-[10px] text-xs text-red-500 flex gap-1.5 items-start">
                  <Ban size={13} className="shrink-0 mt-0.5" /> <span className="overflow-hidden text-ellipsis">{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                </div>
              )}
              {contact.contact_type === 'supplier' && (
                <button className="w-full mt-3 p-2.5 bg-brand-500/10 border border-brand-500/25 rounded-lg text-brand-500 text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                  <span>+</span> {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
              )}
            </div>
          )}

          {/* INVOICES TAB */}
          {tab === 'invoices' && (
            <div>
              <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                <FileDown size={32} className="mb-3 opacity-40 text-content-muted dark:text-content-muted-dark" />
                <p className="m-0 text-sm font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                <p className="mt-1.5 mb-4 text-xs">{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
                <button className="px-5 py-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-semibold cursor-pointer">
                  + {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVITIES TAB */}
          {tab === 'activities' && (
            <div>
              {!showActivityForm && (
                <button onClick={() => setShowActivityForm(true)} className="w-full p-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer mb-3.5">
                  {isRTL ? '+ إضافة نشاط' : '+ Add Activity'}
                </button>
              )}
              {showActivityForm && <ActivityForm contactId={contact.id} onSave={handleSaveActivity} onCancel={() => setShowActivityForm(false)} />}

              {loadingActs ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : activities.length === 0 ? (
                <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                  <Clock size={32} className="opacity-30 mb-2" />
                  <p className="m-0 text-[13px]">{isRTL ? 'لا توجد أنشطة بعد' : 'No activities yet'}</p>
                </div>
              ) : activities.map(act => {
                const actIcon = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: Clock, site_visit: Star }[act.type];
                const ActIcon = actIcon || Clock;
                return (
                <div key={act.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] p-3 mb-2.5">
                  <div className="flex justify-between mb-1.5 items-start gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="w-[26px] h-[26px] rounded-[7px] bg-brand-500/10 flex items-center justify-center shrink-0 mt-px">
                        <ActIcon size={13} color="#4A7AAB" />
                      </div>
                      <span className="text-content dark:text-content-dark text-[13px] font-semibold">{act.description}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-content-muted dark:text-content-muted-dark">
                    <span>{isRTL ? (act.users?.full_name_ar || 'مجهول') : (act.users?.full_name_en || act.users?.full_name_ar || 'Unknown')}</span>
                    <span>{act.created_at?.slice(0, 10)}</span>
                  </div>
                  {act.next_action && (
                    <div className="mt-2 px-2.5 py-1.5 bg-brand-500/[0.08] rounded-md text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">
                      › {act.next_action}{act.next_action_date ? ` — ${act.next_action_date}` : ''}
                    </div>
                  )}
                </div>
              ); })}
            </div>
          )}


          {/* TASKS TAB */}
          {tab === 'tasks' && (
            <div>
              <button onClick={() => setAddTaskForm(f => !f)} className="w-full p-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer mb-3.5">
                {addTaskForm ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? '+ مهمة جديدة' : '+ New Task')}
              </button>

              {addTaskForm && (
                <div className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] p-3 mb-3.5">
                  <div className="flex flex-col gap-2">
                    <input value={newTask.title} onChange={e => setNewTask(f => ({...f, title: e.target.value}))}
                      placeholder={isRTL ? 'عنوان المهمة...' : 'Task title...'}
                      className="px-2.5 py-[7px] rounded-[7px] border border-brand-500/20 bg-[#f8fafc] dark:bg-[rgba(15,30,45,0.6)] text-content dark:text-content-dark text-xs outline-none"
                      style={{ direction: isRTL ? 'rtl' : 'ltr' }} />
                    <div className="flex gap-1.5">
                      <select value={newTask.type} onChange={e => setNewTask(f => ({...f, type: e.target.value}))}
                        className="flex-1 px-2 py-1.5 rounded-[7px] border border-brand-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[11px] outline-none">
                        {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                      <select value={newTask.priority} onChange={e => setNewTask(f => ({...f, priority: e.target.value}))}
                        className="flex-1 px-2 py-1.5 rounded-[7px] border border-brand-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[11px] outline-none">
                        {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                    </div>
                    <input type="datetime-local" value={newTask.due_date} onChange={e => setNewTask(f => ({...f, due_date: e.target.value}))}
                      className="px-2 py-1.5 rounded-[7px] border border-brand-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[11px] outline-none" />
                    <button onClick={async () => {
                      if (!newTask.title.trim() || !newTask.due_date) return;
                      setSavingTask(true);
                      try {
                        const savedTask = await createTask({ ...newTask, contact_id: contact.id, contact_name: contact.full_name, dept: 'crm' });
                        setTasks(prev => [savedTask, ...prev]);
                        setNewTask({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
                        setAddTaskForm(false);
                      } finally { setSavingTask(false); }
                    }} disabled={savingTask || !newTask.title.trim() || !newTask.due_date}
                      className="py-[7px] rounded-[7px] border-none bg-[#2B4C6F] text-white text-xs font-semibold cursor-pointer"
                      style={{ opacity: savingTask || !newTask.title.trim() || !newTask.due_date ? 0.5 : 1 }}>
                      {savingTask ? '...' : (isRTL ? 'حفظ' : 'Save')}
                    </button>
                  </div>
                </div>
              )}

              {loadingTasks ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : tasks.length === 0 ? (
                <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                  <CheckSquare size={32} className="opacity-30 mb-2" />
                  <p className="m-0 text-[13px]">{isRTL ? 'لا توجد مهام مرتبطة' : 'No tasks linked'}</p>
                </div>
              ) : tasks.map(task => {
                const pri = TASK_PRIORITIES[task.priority];
                const typ = TASK_TYPES[task.type];
                const st  = TASK_STATUSES[task.status];
                const due = new Date(task.due_date);
                const overdue = due < new Date() && task.status !== 'done';
                return (
                  <div key={task.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] px-3 py-2.5 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className={`text-[13px] font-semibold text-content dark:text-content-dark mb-1 ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                          {task.title}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
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
                  </div>
                );
              })}
            </div>
          )}

          {/* OPPORTUNITIES TAB */}
          {tab === 'opportunities' && (
            <div>
              <button onClick={()=>setShowOppModal(true)} className="w-full p-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer mb-3.5 font-inherit">
                {isRTL ? '+ فتح فرصة جديدة' : '+ New Opportunity'}
              </button>
              {showOppModal && (
                <div onClick={()=>setShowOppModal(false)} className="fixed inset-0 z-[1100] flex items-center justify-center p-5 bg-black/50">
                  <div dir={isRTL ? 'rtl' : 'ltr'} onClick={e=>e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[14px] p-6 w-full max-w-[420px] border border-edge dark:border-edge-dark">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="m-0 text-content dark:text-content-dark text-[15px] font-bold">{isRTL?'فرصة جديدة - ':'New Opportunity - '}{contact.full_name}</h3>
                      <button onClick={()=>setShowOppModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer text-lg">✕</button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {[
                        { key:'project', label_ar:'المشروع', label_en:'Project', type:'text' },
                        { key:'budget',  label_ar:'الميزانية', label_en:'Budget', type:'number' },
                        { key:'notes',   label_ar:'ملاحظات', label_en:'Notes', type:'text' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className={`text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start`}>{isRTL?f.label_ar:f.label_en}</label>
                          <input type={f.type} value={newOpp[f.key]} onChange={e=>setNewOpp(p=>({...p,[f.key]:e.target.value}))}
                            className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-[13px] outline-none box-border font-inherit"
                            style={{ textAlign:isRTL?'right':'left', direction:isRTL?'rtl':'ltr' }} />
                        </div>
                      ))}
                      {[
                        { key:'stage', label_ar:'المرحلة', label_en:'Stage', options:[{v:'new',ar:'جديد',en:'New'},{v:'contacted',ar:'تم التواصل',en:'Contacted'},{v:'interested',ar:'مهتم',en:'Interested'},{v:'negotiation',ar:'تفاوض',en:'Negotiation'},{v:'reserved',ar:'محجوز',en:'Reserved'}] },
                        { key:'temperature', label_ar:'الحرارة', label_en:'Temperature', options:[{v:'hot',ar:'ساخن',en:'Hot'},{v:'warm',ar:'دافئ',en:'Warm'},{v:'normal',ar:'عادي',en:'Normal'},{v:'cold',ar:'بارد',en:'Cold'}] },
                        { key:'priority', label_ar:'الأولوية', label_en:'Priority', options:[{v:'urgent',ar:'عاجل',en:'Urgent'},{v:'high',ar:'عالي',en:'High'},{v:'medium',ar:'متوسط',en:'Medium'},{v:'low',ar:'منخفض',en:'Low'}] },
                      ].map(f => (
                        <div key={f.key}>
                          <label className={`text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start`}>{isRTL?f.label_ar:f.label_en}</label>
                          <select value={newOpp[f.key]} onChange={e=>setNewOpp(p=>({...p,[f.key]:e.target.value}))}
                            className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-[13px] outline-none cursor-pointer box-border font-inherit">
                            {f.options.map(o=><option key={o.v} value={o.v}>{isRTL?o.ar:o.en}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2.5 mt-5">
                      <button onClick={()=>{ if (!newOpp.project.trim()) { toast.warning(isRTL ? 'اسم المشروع مطلوب' : 'Project name is required'); return; } const opp = {...newOpp, contactName:contact.full_name, contactId:contact.id, contact_id:contact.id, budget:Number(newOpp.budget)||0, lastActivityDays:0, agent:'', id:String(Date.now()), created_at:new Date().toISOString(), projects:{name_ar:newOpp.project,name_en:newOpp.project}}; setOpportunities(prev=>[opp,...prev]); setShowOppModal(false); setNewOpp({project:'',budget:'',stage:'new',temperature:'warm',priority:'medium',agent:'',notes:''}); toast.success(isRTL ? 'تم إنشاء الفرصة' : 'Opportunity created'); }}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white border-none text-[13px] font-bold cursor-pointer font-inherit">
                        {isRTL?'حفظ':'Save'}
                      </button>
                      <button onClick={()=>setShowOppModal(false)} className="px-4 py-2.5 rounded-lg bg-transparent text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark text-[13px] cursor-pointer font-inherit">
                        {isRTL?'إلغاء':'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {loadingOpps ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : opportunities.length === 0 ? (
                <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                  <Star size={32} className="opacity-30 mb-2" />
                  <p className="m-0 text-[13px]">{isRTL ? 'لا توجد فرص مرتبطة' : 'No opportunities linked'}</p>
                </div>
              ) : opportunities.map(opp => (
                <div key={opp.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] p-3 mb-2.5">
                  <div className="flex justify-between mb-2">
                    <span className="text-content dark:text-content-dark text-[13px] font-semibold">{isRTL ? 'فرصة' : 'Opp'} #{String(opp.id).slice(-4)}</span>
                    <Chip label={stageLabel(opp.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                  </div>
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex flex-col gap-1">
                    {opp.projects?.name_ar && <span>{isRTL ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar)}</span>}
                    <span>{isRTL ? (opp.users?.full_name_ar || '—') : (opp.users?.full_name_en || opp.users?.full_name_ar || '—')}</span>
                    {opp.next_follow_up && <span>{isRTL ? 'متابعة' : 'Follow-up'}: {opp.next_follow_up}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
