import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Check, Calendar, User } from 'lucide-react';
import { Button, Textarea } from '../../../components/ui';
import { useFocusTrap } from '../../../utils/hooks';
import { logInteraction, isNoteRequired } from '../../../services/interactionsService';
import { updateTask, createTask } from '../../../services/tasksService';
import { updateActivity } from '../../../services/activitiesService';
import { updateContact } from '../../../services/contactsService';
import { ACTIVITY_RESULT_BADGES } from './constants';

// ── Shared "close a next-step" modal ────────────────────────────────────────
// The ONE way to close any task / meeting / next-step across the app: record
// what happened (type + result + note) AND the next step, in a single flow.
// Saves through logInteraction (the atomic gate) which logs ONE activity,
// closes the fulfilled task, and opens the next follow-up — so nothing is ever
// left as an open loop and no dirty result can be stored. Task closure is also
// asserted explicitly (belt + braces) via updateTask.

const ACT_TYPES = [
  { key: 'call', ar: 'مكالمة', en: 'Call' },
  { key: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
  { key: 'email', ar: 'إيميل', en: 'Email' },
  { key: 'meeting', ar: 'مقابلة', en: 'Meeting' },
  { key: 'note', ar: 'ملاحظة', en: 'Note' },
];

// Per-type result enums — read labels/colours from the shared badge map.
const RESULT_KEYS = {
  call: ['answered', 'no_answer', 'busy', 'switched_off', 'wrong_number'],
  whatsapp: ['replied', 'seen', 'delivered', 'not_delivered', 'blocked'],
  email: ['replied', 'opened', 'sent', 'bounced'],
  meeting: ['attended', 'no_show', 'rescheduled', 'cancelled'],
  visit: ['visited', 'no_show', 'rescheduled', 'cancelled'],
};

// Quick lead-status options (disqualify is intentionally excluded — it needs a
// reason and belongs in the dedicated DQ flow, not a quick toggle here).
const STATUS_OPTS = [
  { value: 'new', ar: 'جديد', en: 'New', color: '#2F6BD3' },
  { value: 'following', ar: 'متابعة', en: 'Following', color: '#158A57' },
  { value: 'contacted', ar: 'تم التواصل', en: 'Contacted', color: '#C9860A' },
  { value: 'has_opportunity', ar: 'لديه فرصة', en: 'Has Opp', color: '#117049' },
];

const toLocalInput = (d) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function CompleteTaskModal({ task, activity = null, onClose, onDone, profile, isRTL }) {
  // `activity` (optional) = a SCHEDULED activity (e.g. a meeting) to close IN
  // PLACE — its own row transitions scheduled→completed with the outcome,
  // instead of logging a new row. Without it, we close a task via logInteraction.
  const seedType = activity ? (ACT_TYPES.some(t => t.key === activity.type) ? activity.type : 'meeting')
    : (ACT_TYPES.some(t => t.key === task?.type) ? task.type : 'call');
  const [actType, setActType] = useState(seedType);
  const [actResult, setActResult] = useState('');
  const [actNotes, setActNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return toLocalInput(d); });
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [changeStatus, setChangeStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [noNextStep, setNoNextStep] = useState(false); // explicit "close without a next step"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const currentResults = (RESULT_KEYS[actType] || []).map(k => ({ value: k, ...ACTIVITY_RESULT_BADGES[k] }));
  const resultRequired = currentResults.length > 0;
  const noteRequired = isNoteRequired(actType, actResult); // engaged result → note mandatory
  // Closing a call/whatsapp/meeting/email opens the next step (mirrors the RPC's
  // FOLLOWUP_REQUIRED) — unless the rep explicitly closes with no next step
  // (deal done / dead). A pure note never requires one.
  const followUpRequired = actType !== 'note' && !noNextStep;
  const canSave = (!resultRequired || actResult)
    && (!noteRequired || actNotes.trim())
    && (!followUpRequired || followUpDate)
    && (!changeStatus || newStatus);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true); setError('');
    try {
      if (activity) {
        // Close the scheduled activity IN PLACE (one row: scheduled→completed
        // + outcome), then open the next step. Creating the next follow-up
        // task fires supersede_prior_followups, which cancels the paired
        // scheduled task — so no dangling open loop remains.
        await updateActivity(activity.id, { status: 'completed', result: actResult || null, description: actNotes || null });
        if (followUpRequired && followUpDate && task.contact_id) {
          await createTask({
            type: 'followup', title: `${isRTL ? 'متابعة' : 'Follow-up'} - ${task.contact_name || ''}`,
            notes: followUpNotes || '', priority: 'medium', status: 'pending',
            due_date: new Date(followUpDate).toISOString(), contact_id: task.contact_id, contact_name: task.contact_name || null,
            dept: 'sales', assigned_to: profile?.id || null,
            assigned_to_name_ar: profile?.full_name_ar || '', assigned_to_name_en: profile?.full_name_en || '',
          });
        }
        // Bump the lead's last-activity (logInteraction does this on the task
        // path; the in-place path must do it too) + optional status change.
        if (task.contact_id) {
          const cu = { last_activity_at: new Date().toISOString() };
          if (changeStatus && newStatus) cu.contact_status = newStatus;
          await updateContact(task.contact_id, cu);
        }
      } else {
        if (task.contact_id) {
          await logInteraction(task.contact_id, {
            type: actType,
            result: actResult || null,
            description: actNotes || null,       // PURE note — no label jamming
            followUp: (followUpRequired && followUpDate)
              ? { type: 'followup', title: `${isRTL ? 'متابعة' : 'Follow-up'} - ${task.contact_name || ''}`, dueAt: followUpDate, notes: followUpNotes || '', contactName: task.contact_name || '' }
              : null,
            // Explicit no-next-step close: tell the gate to allow it.
            skipFollowUpEnforcement: noNextStep,
            statusChange: (changeStatus && newStatus) ? { from: null, to: newStatus } : null,
            actor: { id: profile?.id || null, name_ar: profile?.full_name_ar || '', name_en: profile?.full_name_en || '' },
          });
        }
        // Assert THIS task is closed (logInteraction auto-dones matching past-due
        // tasks + supersede cancels the rest, but close the exact one to be sure).
        if (task.id) await updateTask(task.id, { status: 'done' });
      }
      onDone?.();
    } catch (err) {
      setError(err?.message === 'FOLLOWUP_REQUIRED' ? (isRTL ? 'حدّد موعد المتابعة' : 'A follow-up date is required')
        : err?.message === 'NOTE_REQUIRED' ? (isRTL ? 'اكتب اللي حصل' : 'A note is required')
        : (err?.message || (isRTL ? 'فشل الحفظ' : 'Save failed')));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[930] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="close-step-title" onClick={e => e.stopPropagation()}
        className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[460px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge dark:border-edge-dark">
          <div>
            <h3 id="close-step-title" className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'إنهاء المهمة' : 'Complete Task'}</h3>
            {task.title && <p className="m-0 mt-0.5 text-[11px] text-content-muted dark:text-content-muted-dark truncate max-w-[300px]">{task.title}</p>}
            {task.contact_name && <p className="m-0 mt-0.5 text-[11px] text-brand-500 font-medium">{task.contact_name}</p>}
          </div>
          <button onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="bg-transparent border-none cursor-pointer w-11 h-11 md:w-9 md:h-9 flex items-center justify-center text-content-muted dark:text-content-muted-dark hover:text-red-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Activity Type — locked when closing a specific scheduled activity
              in place (its type is fixed; a switchable type would write a result
              that doesn't match the stored row). */}
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 block">{isRTL ? 'نوع النشاط' : 'Activity Type'} <span className="text-red-500">*</span></label>
            {activity ? (
              <span className="inline-block px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-500 text-white">
                {(() => { const t = ACT_TYPES.find(x => x.key === actType); return t ? (isRTL ? t.ar : t.en) : actType; })()}
              </span>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {ACT_TYPES.map(t => (
                  <button key={t.key} onClick={() => { setActType(t.key); setActResult(''); }}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${actType === t.key ? 'bg-brand-500 text-white border-brand-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                    {isRTL ? t.ar : t.en}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          {currentResults.length > 0 && (
            <div className="mb-3">
              <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 block">{isRTL ? 'النتيجة' : 'Result'} <span className="text-red-500">*</span></label>
              <div className="flex gap-1.5 flex-wrap">
                {currentResults.map(r => (
                  <button key={r.value} onClick={() => setActResult(actResult === r.value ? '' : r.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${actResult === r.value ? 'font-bold text-white border-transparent' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                    style={actResult === r.value ? { background: r.color } : {}}>
                    {isRTL ? r.ar : r.en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 block">
              {isRTL ? 'اللي حصل' : 'What happened'}{noteRequired && <span className="text-red-500"> *</span>}
            </label>
            <Textarea value={actNotes} onChange={e => setActNotes(e.target.value)} rows={2} size="sm"
              placeholder={isRTL ? 'تفاصيل / اللي اتقال...' : 'Details / what was said...'} />
          </div>

          {/* Next step (follow-up) — required unless the rep closes with none */}
          {actType !== 'note' && (
            <div className="border-t border-edge dark:border-edge-dark pt-3 mt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الخطوة الجاية (موعد المتابعة)' : 'Next step (follow-up)'} {!noNextStep && <span className="text-red-500">*</span>}</label>
                <label className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark cursor-pointer select-none">
                  <input type="checkbox" checked={noNextStep} onChange={e => setNoNextStep(e.target.checked)} className="cursor-pointer" />
                  {isRTL ? 'مفيش خطوة جاية' : 'No next step'}
                </label>
              </div>
              {!noNextStep && (
                <>
                  <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
                  <input type="text" value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}
                    placeholder={isRTL ? 'ملاحظة المتابعة (اختياري)' : 'Follow-up note (optional)'}
                    className="w-full mt-2 px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
                </>
              )}
            </div>
          )}

          {/* Optional lead-status change */}
          {task.contact_id && (
            <div className="border-t border-edge dark:border-edge-dark pt-3 mt-3">
              <button onClick={() => setChangeStatus(v => !v)}
                className={`flex items-center gap-2 text-xs font-semibold cursor-pointer bg-transparent border-none p-0 transition-colors ${changeStatus ? 'text-purple-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                <User size={13} />
                {isRTL ? (changeStatus ? 'إلغاء تغيير الحالة' : '+ تغيير حالة العميل') : (changeStatus ? 'Cancel status change' : '+ Change lead status')}
              </button>
              {changeStatus && (
                <div className="mt-2.5 flex gap-1.5 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <button key={s.value} onClick={() => setNewStatus(newStatus === s.value ? '' : s.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${newStatus === s.value ? 'text-white border-transparent' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                      style={newStatus === s.value ? { background: s.color } : {}}>
                      {isRTL ? s.ar : s.en}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div className="mt-3 text-[11px] text-red-500">{error}</div>}
        </div>

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

CompleteTaskModal.propTypes = {
  task: PropTypes.object.isRequired,   // { id, contact_id, contact_name, title, type }
  activity: PropTypes.object,          // optional scheduled activity to close in place
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func,              // called after a successful close (refresh)
  profile: PropTypes.object,
  isRTL: PropTypes.bool,
};
