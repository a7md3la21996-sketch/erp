import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Phone, MessageCircle, MapPin, Users, Mail, Bell, Plus, X, Check, Trash2, Clock, ChevronDown } from 'lucide-react';
import { fetchReminders, createReminder, markReminderDone, deleteReminder, REMINDER_TYPES } from '../../services/remindersService';

const ICONS = { Phone, MessageCircle, MapPin, Users, Mail };

function useDS() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark, card: dark ? '#1a2234' : '#ffffff',
    border: dark ? 'rgba(74,122,171,0.2)' : '#E2E8F0',
    text: dark ? '#E2EAF4' : '#1A2B3C',
    muted: dark ? '#8BA8C8' : '#64748B',
    input: dark ? '#0F1E2D' : '#F8FAFC',
    hover: dark ? 'rgba(74,122,171,0.07)' : '#F8FAFC',
  };
}

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

function ReminderModal({ onClose, onSave, entityType, entityId, entityName, lang, ds }) {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: ds.card, borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${ds.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1B3347,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={16} color="#fff" />
            </div>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ds.text }}>{lang === 'ar' ? 'جدول متابعة' : 'Schedule Follow-up'}</div>
              <div style={{ fontSize: 11, color: ds.muted }}>{entityName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: ds.muted }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, direction: isRTL ? 'rtl' : 'ltr' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: ds.muted, marginBottom: 8 }}>{lang === 'ar' ? 'اختر سريع' : 'Quick select'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{days:0,ar:'اليوم',en:'Today'},{days:1,ar:'غداً',en:'Tomorrow'},{days:3,ar:'بعد 3 أيام',en:'In 3 days'},{days:7,ar:'أسبوع',en:'Next week'}].map(q => (
                <button key={q.days} onClick={() => setQuick(q.days)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${quickDays === q.days ? '#4A7AAB' : ds.border}`, background: quickDays === q.days ? 'rgba(74,122,171,0.12)' : 'transparent', color: quickDays === q.days ? '#4A7AAB' : ds.muted, fontSize: 12, fontWeight: quickDays === q.days ? 600 : 400, cursor: 'pointer' }}>
                  {lang === 'ar' ? q.ar : q.en}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: ds.muted, marginBottom: 6 }}>{lang === 'ar' ? 'التاريخ' : 'Date'}</div>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); setQuickDays(null); }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: ds.muted, marginBottom: 6 }}>{lang === 'ar' ? 'الوقت' : 'Time'}</div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: ds.muted, marginBottom: 8 }}>{lang === 'ar' ? 'نوع التواصل' : 'Contact type'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(REMINDER_TYPES).map(([key, val]) => {
                const Ic = ICONS[val.icon];
                const sel = type === key;
                return (
                  <button key={key} onClick={() => setType(key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${sel ? val.color : ds.border}`, background: sel ? val.color + '18' : 'transparent', color: sel ? val.color : ds.muted, fontSize: 12, fontWeight: sel ? 600 : 400, cursor: 'pointer' }}>
                    {Ic && <Ic size={12} />}{lang === 'ar' ? val.ar : val.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: ds.muted, marginBottom: 6 }}>{lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}</div>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === 'ar' ? 'مثال: يريد عرض شقة 3 غرف...' : 'e.g. Interested in 3BR unit...'} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${ds.border}`, background: 'transparent', color: ds.muted, fontSize: 13, cursor: 'pointer' }}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button onClick={handleSave} disabled={!date || saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: !date ? ds.border : 'linear-gradient(135deg,#1B3347,#4A7AAB)', color: !date ? ds.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: !date ? 'not-allowed' : 'pointer' }}>
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
  const ds = useDS();
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {next && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: overdue ? 'rgba(239,68,68,0.1)' : 'rgba(74,122,171,0.1)', border: `1px solid ${overdue ? 'rgba(239,68,68,0.3)' : 'rgba(74,122,171,0.2)'}` }}>
            <Clock size={11} color={overdue ? '#EF4444' : '#4A7AAB'} />
            <span style={{ fontSize: 11, color: overdue ? '#EF4444' : '#4A7AAB', fontWeight: 600 }}>{formatDue(next.due_at, lang)}</span>
          </div>
        )}
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px dashed ${ds.border}`, background: 'transparent', color: ds.muted, fontSize: 11, cursor: 'pointer' }}>
          <Plus size={11} />{lang === 'ar' ? 'متابعة' : 'Follow-up'}
        </button>
        {showModal && <ReminderModal onClose={() => setShowModal(false)} onSave={handleSave} entityType={entityType} entityId={entityId} entityName={entityName} lang={lang} ds={ds} />}
      </div>
    );
  }

  return (
    <div style={{ background: ds.card, borderRadius: 12, border: `1px solid ${ds.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row', borderBottom: active.length > 0 ? `1px solid ${ds.border}` : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Bell size={14} color="#4A7AAB" />
          <span style={{ fontSize: 13, fontWeight: 600, color: ds.text }}>{lang === 'ar' ? 'المتابعات' : 'Follow-ups'}</span>
          {active.length > 0 && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: overdue ? 'rgba(239,68,68,0.15)' : 'rgba(74,122,171,0.15)', color: overdue ? '#EF4444' : '#4A7AAB', fontWeight: 600 }}>{active.length}</span>}
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#1B3347', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} />{lang === 'ar' ? 'إضافة' : 'Add'}
        </button>
      </div>
      {loading ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2].map(i => <div key={i} style={{ height: 44, borderRadius: 8, background: ds.border, opacity: 0.5 }} />)}
          
        </div>
      ) : active.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <Clock size={24} color={ds.muted} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 12, color: ds.muted }}>{lang === 'ar' ? 'لا توجد متابعات مجدولة' : 'No follow-ups scheduled'}</p>
        </div>
      ) : (
        <div>
          {(expanded ? active : active.slice(0, 3)).map((r, idx) => {
            const typeDef = REMINDER_TYPES[r.type] || REMINDER_TYPES.call;
            const Ic = ICONS[typeDef.icon] || Clock;
            const od = isOverdue(r.due_at);
            return (
              <div key={r.id} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: idx < Math.min(active.length, expanded ? 999 : 3) - 1 ? `1px solid ${ds.border}` : 'none', flexDirection: isRTL ? 'row-reverse' : 'row' }}
                onMouseEnter={e => e.currentTarget.style.background = ds.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: typeDef.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ic size={14} color={typeDef.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: od ? '#EF4444' : ds.text }}>{formatDue(r.due_at, lang)}</div>
                  {r.notes && <div style={{ fontSize: 11, color: ds.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleDone(r.id)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#10B981" /></button>
                  <button onClick={() => handleDelete(r.id)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} color="#EF4444" /></button>
                </div>
              </div>
            );
          })}
          {active.length > 3 && (
            <button onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: ds.muted, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
              {expanded ? (lang === 'ar' ? 'عرض أقل' : 'Show less') : `${active.length - 3} ${lang === 'ar' ? 'أكثر' : 'more'}`}
            </button>
          )}
        </div>
      )}
      {showModal && <ReminderModal onClose={() => setShowModal(false)} onSave={handleSave} entityType={entityType} entityId={entityId} entityName={entityName} lang={lang} ds={ds} />}
    </div>
  );
}
