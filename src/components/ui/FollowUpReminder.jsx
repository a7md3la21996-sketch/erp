import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Phone, MessageCircle, MapPin, Users, Mail, Bell, Plus, X, Check, Trash2, Clock, ChevronDown } from 'lucide-react';
import { fetchReminders, createReminder, markReminderDone, deleteReminder, REMINDER_TYPES } from '../../services/remindersService';

const ICONS = { Phone, MessageCircle, MapPin, Users, Mail };


function formatDue(dateStr, lang) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diffDays = Math.floor((d - new Date()) / 86400000);
  if (diffDays < 0) return lang === 'ar' ? `متأخر ${Math.abs(diffDays)} يوم` : `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return lang === 'ar' ? 'اليوم' : 'Today';
  if (diffDays === 1) return lang === 'ar' ? 'غداً' : 'Tomorrow';
  if (diffDays < 7) return lang === 'ar' ? `بعد ${diffDays} أيام` : `In ${diffDays} days`;
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr) { return new Date(dateStr) < new Date(); }

function ReminderModal({ onClose, onSave, entityType, entityId, entityName, lang }) {
  const { user } = useAuth();
  const [type, setType] = useState('call');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickDays, setQuickDays] = useState(null);
  const isRTL = lang === 'ar';

  const setQuick = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
    setTime('10:00');
    setQuickDays(days);
  };

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      const dueAt = new Date(`${date}T${time || '09:00'}:00`).toISOString();
      await onSave({ entityType, entityId, entityName, dueAt, type, notes, assignedTo: user?.id });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-2xl w-full max-w-[420px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className={`px-5 py-[18px] border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center">
              <Bell size={16} color="#fff" />
            </div>
            <div className="text-start">
              <div className="text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'جدول متابعة' : 'Schedule Follow-up'}</div>
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{entityName}</div>
            </div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark"><X size={18} /></button>
        </div>
        <div className={`p-5 flex flex-col gap-4 ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <div>
            <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-2">{lang === 'ar' ? 'اختر سريع' : 'Quick select'}</div>
            <div className="flex gap-1.5 flex-wrap">
              {[{days:0,ar:'اليوم',en:'Today'},{days:1,ar:'غداً',en:'Tomorrow'},{days:3,ar:'بعد 3 أيام',en:'In 3 days'},{days:7,ar:'أسبوع',en:'Next week'}].map(q => (
                <button key={q.days} onClick={() => setQuick(q.days)}
                  className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${quickDays === q.days ? 'border-brand-500 bg-brand-500/[0.12] text-brand-500 font-semibold' : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark font-normal'}`}>
                  {lang === 'ar' ? q.ar : q.en}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{lang === 'ar' ? 'التاريخ' : 'Date'}</div>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); setQuickDays(null); }}
                className="w-full py-2 px-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] outline-none box-border" />
            </div>
            <div>
              <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{lang === 'ar' ? 'الوقت' : 'Time'}</div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full py-2 px-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] outline-none box-border" />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-2">{lang === 'ar' ? 'نوع التواصل' : 'Contact type'}</div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(REMINDER_TYPES).map(([key, val]) => {
                const Ic = ICONS[val.icon];
                const sel = type === key;
                return (
                  <button key={key} onClick={() => setType(key)}
                    className="flex items-center gap-[5px] px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                    style={{ border: `1px solid ${sel ? val.color : ''}`, borderColor: sel ? val.color : undefined, background: sel ? val.color + '18' : 'transparent', color: sel ? val.color : undefined, fontWeight: sel ? 600 : 400 }}
                    // Dynamic colors from REMINDER_TYPES need inline styles
                  >
                    {Ic && <Ic size={12} />}{lang === 'ar' ? val.ar : val.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}</div>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === 'ar' ? 'مثال: يريد عرض شقة 3 غرف...' : 'e.g. Interested in 3BR unit...'}
              className="w-full py-2 px-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] outline-none box-border" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="py-2.5 px-[18px] rounded-[9px] border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-[13px] cursor-pointer">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button onClick={handleSave} disabled={!date || saving}
              className={`py-2.5 px-5 rounded-[9px] border-none text-[13px] font-semibold ${!date ? 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark cursor-not-allowed' : 'bg-gradient-to-br from-brand-900 to-brand-500 text-white cursor-pointer'}`}>
              {saving ? '...' : (lang === 'ar' ? 'حفظ المتابعة' : 'Save Reminder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FollowUpReminder({ entityType = 'contact', entityId, entityName, compact = false }) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    if (!entityId) return;
    setLoading(true);
    try { setReminders(await fetchReminders({ entityType, entityId })); }
    catch { setReminders([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [entityId, entityType]);

  const handleSave = async (data) => { await createReminder(data); load(); };
  const handleDone = async (id) => { await markReminderDone(id); setReminders(p => p.filter(r => r.id !== id)); };
  const handleDelete = async (id) => { await deleteReminder(id); setReminders(p => p.filter(r => r.id !== id)); };

  const active = reminders.filter(r => !r.is_done);
  const next = active[0];
  const overdue = next && isOverdue(next.due_at);

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {next && (
          <div className={`flex items-center gap-[5px] px-2 py-[3px] rounded-md ${overdue ? 'bg-red-500/10 border border-red-500/30' : 'bg-brand-500/10 border border-brand-500/20'}`}>
            <Clock size={11} color={overdue ? '#EF4444' : '#4A7AAB'} />
            <span className={`text-[11px] font-semibold ${overdue ? 'text-red-500' : 'text-brand-500'}`}>{formatDue(next.due_at, lang)}</span>
          </div>
        )}
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 px-2 py-[3px] rounded-md border border-dashed border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-[11px] cursor-pointer">
          <Plus size={11} />{lang === 'ar' ? 'متابعة' : 'Follow-up'}
        </button>
        {showModal && <ReminderModal onClose={() => setShowModal(false)} onSave={handleSave} entityType={entityType} entityId={entityId} entityName={entityName} lang={lang} />}
      </div>
    );
  }

  return (
    <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
      <div className={`py-3 px-4 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${active.length > 0 ? 'border-b border-edge dark:border-edge-dark' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Bell size={14} color="#4A7AAB" />
          <span className="text-[13px] font-semibold text-content dark:text-content-dark">{lang === 'ar' ? 'المتابعات' : 'Follow-ups'}</span>
          {active.length > 0 && <span className={`text-[11px] px-[7px] py-px rounded-[10px] font-semibold ${overdue ? 'bg-red-500/15 text-red-500' : 'bg-brand-500/15 text-brand-500'}`}>{active.length}</span>}
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 py-[5px] px-3 rounded-[7px] border-none bg-brand-900 text-white text-xs font-semibold cursor-pointer">
          <Plus size={13} />{lang === 'ar' ? 'إضافة' : 'Add'}
        </button>
      </div>
      {loading ? (
        <div className="p-4 flex flex-col gap-2">
          {[1,2].map(i => <div key={i} className="h-11 rounded-lg bg-edge dark:bg-edge-dark opacity-50" />)}

        </div>
      ) : active.length === 0 ? (
        <div className="py-6 px-4 text-center">
          <Clock size={24} className="text-content-muted dark:text-content-muted-dark opacity-40 mb-2" />
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لا توجد متابعات مجدولة' : 'No follow-ups scheduled'}</p>
        </div>
      ) : (
        <div>
          {(expanded ? active : active.slice(0, 3)).map((r, idx) => {
            const typeDef = REMINDER_TYPES[r.type] || REMINDER_TYPES.call;
            const Ic = ICONS[typeDef.icon] || Clock;
            const od = isOverdue(r.due_at);
            return (
              <div key={r.id}
                className={`py-2.5 px-4 flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'} hover:bg-surface-bg dark:hover:bg-surface-bg-dark ${idx < Math.min(active.length, expanded ? 999 : 3) - 1 ? 'border-b border-edge dark:border-edge-dark' : ''}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: typeDef.color + '18' }}>
                  <Ic size={14} color={typeDef.color} />
                </div>
                <div className={`flex-1 min-w-0 text-start`}>
                  <div className={`text-xs font-semibold ${od ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>{formatDue(r.due_at, lang)}</div>
                  {r.notes && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-px overflow-hidden text-ellipsis whitespace-nowrap">{r.notes}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleDone(r.id)} className="w-[26px] h-[26px] rounded-md border border-emerald-500/30 bg-emerald-500/10 cursor-pointer flex items-center justify-center"><Check size={12} color="#10B981" /></button>
                  <button onClick={() => handleDelete(r.id)} className="w-[26px] h-[26px] rounded-md border border-red-500/20 bg-transparent cursor-pointer flex items-center justify-center"><Trash2 size={12} color="#EF4444" /></button>
                </div>
              </div>
            );
          })}
          {active.length > 3 && (
            <button onClick={() => setExpanded(!expanded)} className="w-full p-2 border-none bg-transparent cursor-pointer text-content-muted dark:text-content-muted-dark text-xs flex items-center justify-center gap-1">
              <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? (lang === 'ar' ? 'عرض أقل' : 'Show less') : `${active.length - 3} ${lang === 'ar' ? 'أكثر' : 'more'}`}
            </button>
          )}
        </div>
      )}
      {showModal && <ReminderModal onClose={() => setShowModal(false)} onSave={handleSave} entityType={entityType} entityId={entityId} entityName={entityName} lang={lang} />}
    </div>
  );
}
