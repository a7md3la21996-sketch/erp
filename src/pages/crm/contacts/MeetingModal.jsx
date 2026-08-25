import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input } from '../../../components/ui';
import { logInteraction } from '../../../services/interactionsService';

// Log a meeting on a lead. Two modes:
//   • happened  → status='completed', captures the outcome (result)
//   • scheduled → status='scheduled', captures the future date (scheduled_date)
// Stored as an activity (type='meeting') so it also shows in the timeline.
// Uses existing columns: meeting_subtype (type), scheduled_date, result, notes.
const TYPES = [
  { key: 'site_visit', ar: 'معاينة', en: 'Site visit' },
  { key: 'office',     ar: 'مكتب',   en: 'Office' },
  { key: 'online',     ar: 'أونلاين', en: 'Online' },
];

export default function MeetingModal({ contact, mode: initialMode = 'happened', profile, isRTL, onClose, onSaved }) {
  const [mode, setMode] = useState(initialMode); // toggle happened ↔ scheduled inside the sheet
  const scheduled = mode === 'scheduled';
  const [subtype, setSubtype] = useState('site_visit');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState('');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [followupAt, setFollowupAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Local "now" for the datetime-local max — blocks picking a future time when
  // logging a meeting as already happened.
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const save = async () => {
    if (scheduled && !when) { setError(isRTL ? 'اختر تاريخ الاجتماع' : 'Pick a date'); return; }
    // A "happened" meeting must actually have happened: require its time AND
    // reject a future time — this is what stops people logging a still-scheduled
    // meeting as done. (If it hasn't happened yet, they should Schedule it.)
    if (!scheduled) {
      if (!when) { setError(isRTL ? 'اختر وقت الاجتماع اللي حصل' : 'Pick when it happened'); return; }
      if (new Date(when).getTime() > Date.now()) {
        setError(isRTL ? 'ماينفعش تسجّل اجتماع «حصل» بوقت في المستقبل — لو لسه جاي استخدم «احجز اجتماع»' : "Can't log a meeting as done in the future — use Schedule instead"); return;
      }
    }
    // A logged (happened) meeting must set the next step. A scheduled meeting IS
    // the next step, so its follow-up is auto-derived from the meeting date.
    if (!scheduled && !followupAt) { setError(isRTL ? 'حدّد موعد المتابعة' : 'Pick a follow-up date'); return; }
    setSaving(true); setError('');
    const typeLabel = (TYPES.find(t => t.key === subtype) || {})[isRTL ? 'ar' : 'en'];
    const desc = [typeLabel, location && (isRTL ? `المكان: ${location}` : `at ${location}`), note].filter(Boolean).join(' — ');
    const followUp = scheduled
      ? { type: 'meeting', title: `${typeLabel} - ${contact.full_name}`, dueAt: new Date(when).toISOString(), contactName: contact.full_name, notes: location || '' }
      : { type: 'followup', title: `${isRTL ? 'متابعة' : 'Follow-up'} - ${contact.full_name}`, dueAt: new Date(followupAt).toISOString(), contactName: contact.full_name, notes: outcome || '' };
    try {
      await logInteraction(contact.id, {
        type: 'meeting',
        mode: scheduled ? 'schedule' : 'log',
        meetingSubtype: subtype,
        scheduledDate: scheduled ? new Date(when).toISOString() : null,
        occurredAt: (!scheduled && when) ? new Date(when).toISOString() : null,
        result: scheduled ? null : (outcome || null),
        notes: location || null,
        description: desc || (isRTL ? 'اجتماع' : 'Meeting'),
        followUp,
        currentStatus: contact.contact_status,
        actor: { id: profile?.id || null, name_ar: profile?.full_name_ar || '', name_en: profile?.full_name_en || '' },
      });
      onSaved?.();
    } catch (err) {
      setError(err?.message === 'FOLLOWUP_REQUIRED'
        ? (isRTL ? 'حدّد موعد المتابعة' : 'A follow-up date is required')
        : (err?.message || (isRTL ? 'فشل الحفظ' : 'Save failed')));
      setSaving(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}
      className="fixed inset-0 z-[920] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] bg-surface-card dark:bg-surface-card-dark rounded-2xl border border-edge dark:border-edge-dark shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out">
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge dark:border-edge-dark">
          <span className="text-sm font-bold text-content dark:text-content-dark">{scheduled ? (isRTL ? 'حجز اجتماع' : 'Schedule meeting') : (isRTL ? 'تسجيل اجتماع' : 'Log meeting')}</span>
          <button onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-red-500/10 hover:text-red-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Mode toggle — log a meeting that happened, or schedule an upcoming one */}
          <div className="flex gap-1.5 p-0.5 rounded-lg bg-surface-bg dark:bg-surface-bg-dark">
            {[{ v: 'happened', ar: 'حصل', en: 'Happened' }, { v: 'scheduled', ar: 'مجدول', en: 'Scheduled' }].map(m => (
              <button key={m.v} onClick={() => setMode(m.v)}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold cursor-pointer border-none transition-colors ${mode === m.v ? 'bg-brand-500 text-white' : 'bg-transparent text-content-muted dark:text-content-muted-dark'}`}>
                {isRTL ? m.ar : m.en}
              </button>
            ))}
          </div>
          {/* Type */}
          <div className="flex gap-1.5">
            {TYPES.map(t => {
              const active = subtype === t.key;
              return (
                <button key={t.key} onClick={() => setSubtype(t.key)}
                  className={`flex-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border transition-all ${active ? 'bg-brand-500 text-white border-brand-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                  {isRTL ? t.ar : t.en}
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'المكان' : 'Location'}</label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={isRTL ? 'المكتب / المشروع / رابط' : 'Office / project / link'} />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{scheduled ? (isRTL ? 'موعد الاجتماع' : 'Meeting time') : (isRTL ? 'وقت الاجتماع (اللي حصل)' : 'When it happened')}{!scheduled && <span className="text-red-500"> *</span>}</label>
            <Input type="datetime-local" value={when} max={scheduled ? undefined : nowLocal} onChange={e => setWhen(e.target.value)} />
          </div>

          {!scheduled && (
            <div>
              <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'النتيجة' : 'Outcome'}</label>
              <Input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder={isRTL ? 'مهتم / طلب عرض / ...' : 'Interested / wants offer / ...'} />
            </div>
          )}

          {!scheduled && (
            <div>
              <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'موعد المتابعة' : 'Follow-up date'} <span className="text-red-500">*</span></label>
              <Input type="datetime-local" value={followupAt} onChange={e => setFollowupAt(e.target.value)} />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'ملاحظة (اختياري)' : 'Note (optional)'}</label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="..." />
          </div>

          {error && <div className="text-[11px] text-red-500">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-edge dark:border-edge-dark">
          <Button variant="secondary" size="sm" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button size="sm" onClick={save} loading={saving}>{isRTL ? 'حفظ' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
