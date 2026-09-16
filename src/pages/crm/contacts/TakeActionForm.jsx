import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { Target, Zap, Check, Calendar } from 'lucide-react';
import { Button, Select, Textarea } from '../../../components/ui/';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { TASK_PRIORITIES } from '../../../services/tasksService';
import { MEETING_SUBTYPES } from '../../../services/activitiesService';
import { isFollowUpRequired, isNoteRequired } from '../../../services/interactionsService';
import { CONVERSATION_OUTCOME_GROUPS } from './constants';

// ── Unified Take Action Form ──────────────────────────────────────────────
// Assembles a single interaction payload and hands it to onLogInteraction,
// which routes it through the one logInteraction() service path.
export default function TakeActionForm({ contact, onLogInteraction, onCancel, initialType }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const { activityTypes: configTypes, activityResults: configResults } = useSystemConfig();

  const activityTypes = ((configTypes && configTypes.length > 0) ? configTypes.map(t => ({ key: t.key, label: t.label_en, labelAr: t.label_ar })) : [
    { key: 'call', label: 'Call', labelAr: 'مكالمة' },
    { key: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب' },
    { key: 'email', label: 'Email', labelAr: 'إيميل' },
    { key: 'note', label: 'Note', labelAr: 'ملاحظة' },
  ])
    // Meetings AND site visits are logged from the drawer's Meetings tab only
    // (as type='meeting' + meeting_subtype='site_visit'). Logging a site visit
    // here made a separate type='site_visit' activity that the Meetings tab /
    // reports / cards (which filter type='meeting') never showed — so drop both.
    .filter(t => t.key !== 'meeting' && t.key !== 'site_visit');

  const ACTIVITY_RESULTS = {};
  if (configResults && Object.keys(configResults).length > 0) {
    Object.entries(configResults).forEach(([typeKey, arr]) => {
      ACTIVITY_RESULTS[typeKey] = arr.map(r => ({ value: r.value, label: isRTL ? r.label_ar : r.label_en, color: r.color }));
    });
  }

  // Activity mode: 'log' (default) or 'schedule'
  const [actMode, setActMode] = useState('log');

  // Activity state
  const [actForm, setActForm] = useState({ type: initialType || 'call', description: '', result: '', outcome: '', scheduled_date: '', meeting_subtype: '' });
  // Changing type OR result clears the conversation outcome (it's only relevant
  // to the current engaged result).
  const setAct = (k, v) => setActForm(f => ({ ...f, [k]: v, ...(k === 'type' ? { result: '', outcome: '', meeting_subtype: '' } : {}), ...(k === 'result' ? { outcome: '' } : {}) }));
  const currentResults = ACTIVITY_RESULTS[actForm.type] || [];
  const resultRequired = actMode === 'log' && currentResults.length > 0;

  // Task state — now MANDATORY: every logged action must set the next follow-up.
  const [addTask] = useState(true);
  const TASK_TYPES = [
    { key: 'followup',   ar: 'متابعة',          en: 'Follow Up' },
    { key: 'callback',   ar: 'معاودة اتصال',    en: 'Callback' },
    { key: 'send_info',  ar: 'إرسال معلومات',   en: 'Send Info' },
    { key: 'note',       ar: 'ملاحظة',           en: 'Note' },
  ];
  const [taskForm, setTaskForm] = useState({ type: 'followup', notes: '', priority: 'medium', due_date: '' });
  // Which quick-preset is currently applied (for the active highlight). Cleared
  // when the rep edits the datetime by hand.
  const [followupPreset, setFollowupPreset] = useState(null);

  // Contact status state (optional section)
  const CONTACT_STATUSES = [
    { id: 'new', ar: 'جديد', en: 'New', color: '#2F6BD3' },
    { id: 'contacted', ar: 'تم التواصل', en: 'Contacted', color: '#C9860A' },
    { id: 'following', ar: 'متابعة', en: 'Following', color: '#158A57' },
    { id: 'has_opportunity', ar: 'لديه فرصة', en: 'Has Opportunity', color: '#117049' },
    { id: 'disqualified', ar: 'غير مؤهل', en: 'Disqualified', color: '#D6403B' },
  ];
  const currentStatus = contact?.contact_status || '';
  const [newStatus, setNewStatus] = useState(currentStatus);
  const statusChanged = !!newStatus && newStatus !== currentStatus;
  const [dqReason, setDqReason] = useState('');
  const DQ_REASONS = [
    { value: 'existing_client', label: isRTL ? 'عميل حالي (شاري)' : 'Existing Client' },
    { value: 'resale', label: isRTL ? 'عايز يبيع وحدته' : 'Wants to sell unit' },
    { value: 'not_interested', label: isRTL ? 'غير مهتم' : 'Not interested' },
    { value: 'no_answer_all_time', label: isRTL ? 'لا يرد أبداً' : 'No Answer All Time' },
    { value: 'no_budget', label: isRTL ? 'ميزانية غير مناسبة' : 'No budget' },
    { value: 'wrong_audience', label: isRTL ? 'جمهور خاطئ' : 'Wrong audience' },
    { value: 'wrong_number', label: isRTL ? 'رقم خاطئ' : 'Wrong number' },
    { value: 'duplicate', label: isRTL ? 'مكرر' : 'Duplicate' },
    { value: 'other', label: isRTL ? 'سبب آخر' : 'Other' },
  ];

  const [saving, setSaving] = useState(false);

  // The form is always opened from the "+ سجّل" speed-dial with a type already
  // chosen, so it runs in "focused" mode: type tabs hidden, and the advanced
  // sections (schedule, activity notes, task type/priority/notes, change status)
  // collapse behind a "More options" toggle — leaving just result + follow-up
  // date + save for the common case.
  // Form is fully expanded by default — every field (schedule / status / task
  // details / notes) shows at once; no "More options" gate.
  const [showAdvanced] = useState(true);
  const showAdv = showAdvanced;

  // Quick follow-up presets (hours/days). Day presets land at 10:00 AM.
  const FOLLOWUP_PRESETS = [
    { key: 'h1', ar: 'بعد ساعة', en: '+1h', add: { hours: 1 } },
    { key: 'h3', ar: 'بعد 3 ساعات', en: '+3h', add: { hours: 3 } },
    { key: 'd1', ar: 'غدًا', en: 'Tomorrow', add: { days: 1, at: 10 } },
    { key: 'd2', ar: 'بعد يومين', en: '+2d', add: { days: 2, at: 10 } },
    { key: 'd3', ar: 'بعد 3 أيام', en: '+3d', add: { days: 3, at: 10 } },
  ];
  const toLocalInput = (d) => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const setPresetDate = (p) => {
    const add = p.add;
    const d = new Date();
    if (add.hours) d.setHours(d.getHours() + add.hours);
    if (add.days) { d.setDate(d.getDate() + add.days); if (add.at != null) d.setHours(add.at, 0, 0, 0); }
    setTaskForm(f => ({ ...f, due_date: toLocalInput(d) }));
    setFollowupPreset(p.key);
  };

  const meetingSubRequired = actForm.type === 'meeting';
  // Follow-up requirement comes from the SAME rule the service enforces
  // (call/whatsapp/meeting/email require it; note is exempt; a lead ending up
  // disqualified needs no next step) — so the UI gate and the DB guard agree.
  // Only the hero WhatsApp quick-send bypasses it (skipFollowUpEnforcement).
  const followUpRequired = isFollowUpRequired(actForm.type, newStatus);
  const taskDateRequired = followUpRequired && !taskForm.due_date;
  const dqReasonRequired = statusChanged && newStatus === 'disqualified' && !dqReason;
  // A note's body IS its content — don't allow saving an empty note.
  const noteBodyMissing = actForm.type === 'note' && !actForm.description.trim();
  // An ENGAGED result (call answered / whatsapp replied / meeting attended…)
  // must carry a written outcome — same rule the DB RPC enforces.
  const noteRequired = actMode === 'log' && isNoteRequired(actForm.type, actForm.result);
  const descriptionMissing = noteRequired && !actForm.description.trim();
  // After an engaged touch we also require the conversation outcome (what the
  // talk led to) so the pipeline signal is captured, not just "answered".
  const outcomeRequired = noteRequired;
  const outcomeMissing = outcomeRequired && !actForm.outcome;
  const canSave = (actMode === 'schedule'
    ? !!actForm.scheduled_date && (!meetingSubRequired || actForm.meeting_subtype)
    : (!resultRequired || actForm.result) && (!meetingSubRequired || actForm.meeting_subtype))
    && !taskDateRequired && !dqReasonRequired && !noteBodyMissing && !descriptionMissing && !outcomeMissing;

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);

    // ROOT FIX: store the PURE note only. type / result / meeting_subtype are
    // separate structured columns already — jamming their (English) labels into
    // the free-text description is what broke bidi truncation everywhere the
    // note is shown. Displays render the badges from the structured fields.
    const description = actForm.description || null;

    // Follow-up task — omitted entirely when disqualifying (a closed lead needs
    // no next step; this also prevents the old orphan-task-on-DQ case).
    const selectedType = TASK_TYPES.find(t => t.key === taskForm.type);
    const followUp = (newStatus !== 'disqualified' && taskForm.due_date)
      ? {
          type: taskForm.type,
          title: selectedType ? (isRTL ? selectedType.ar : selectedType.en) : taskForm.type,
          notes: taskForm.notes,
          priority: taskForm.priority,
          dueAt: taskForm.due_date,
          contactName: contact.full_name,
        }
      : null;

    const payload = {
      type: actForm.type,
      result: actForm.result || null,
      outcome: actForm.outcome || null,
      description,
      meetingSubtype: actForm.type === 'meeting' ? actForm.meeting_subtype : null,
      mode: actMode,
      scheduledDate: actMode === 'schedule' ? actForm.scheduled_date : null,
      statusChange: statusChanged
        ? { from: currentStatus, to: newStatus, dqReason: newStatus === 'disqualified' ? dqReason : undefined }
        : null,
      currentStatus,
      followUp,
    };

    // try/finally so a thrown save (network, RLS, or the FOLLOWUP_REQUIRED
    // guard) releases the saving state and lets the user retry.
    try {
      await onLogInteraction(payload);
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  const RESULT_TITLES = {
    call: isRTL ? 'نتيجة المكالمة' : 'Call Result',
    whatsapp: isRTL ? 'نتيجة الرسالة' : 'Message Result',
    email: isRTL ? 'نتيجة الإيميل' : 'Email Result',
    meeting: isRTL ? 'نتيجة المقابلة' : 'Meeting Result',
  };

  return (
    <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl shadow-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center">
          <Zap size={14} className="text-brand-500" />
        </div>
        <span className="text-xs font-bold text-content dark:text-content-dark">
          {isRTL
            ? (activityTypes.find(t => t.key === actForm.type)?.labelAr || 'تسجيل')
            : (activityTypes.find(t => t.key === actForm.type)?.label || 'Log')}
        </span>
      </div>

      {/* ── Section 1: Activity ── (the drawer header already names the type) */}
      <div className="ps-3 mb-3">
        {/* Schedule vs Log Now toggle */}
        {showAdv && (
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
        )}
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
                <button key={r.value} onClick={() => setActForm(f => ({ ...f, result: f.result === r.value ? '' : r.value, outcome: '' }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer border font-cairo ${actForm.result === r.value ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={actForm.result === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Conversation outcome — appears after an engaged result (answered /
            replied / attended …). Grouped by direction, one required choice. */}
        {outcomeRequired && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">
              {isRTL ? 'نتيجة المحادثة' : 'Conversation outcome'} <span className="text-red-500">*</span>
            </div>
            <div className={`flex flex-col gap-1.5 ${outcomeMissing ? 'ring-1 ring-red-500/60 rounded-lg p-1.5' : ''}`}>
              {CONVERSATION_OUTCOME_GROUPS.map(g => (
                <div key={g.key} className="flex gap-1.5 flex-wrap items-center">
                  <span className="text-[9px] font-bold w-11 shrink-0" style={{ color: g.color }}>{isRTL ? g.ar : g.en}</span>
                  {g.items.map(([key, ar, en]) => {
                    const on = actForm.outcome === key;
                    return (
                      <button key={key} type="button" onClick={() => setActForm(f => ({ ...f, outcome: f.outcome === key ? '' : key }))}
                        className={`px-2 py-1 rounded-lg text-[11px] cursor-pointer border font-cairo ${on ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                        style={on ? { background: g.color + '18', border: `1px solid ${g.color}`, color: g.color } : undefined}>
                        {isRTL ? ar : en}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Text box — always for a note (it IS the note's content), and forced
            visible + required after an engaged result so the outcome is captured. */}
        {(showAdv || actForm.type === 'note' || noteRequired) && (
          <div>
            {noteRequired && (
              <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">
                {isRTL ? 'اكتب اللي اتقال' : 'What was said'} <span className="text-red-500">*</span>
              </div>
            )}
            <Textarea size="sm" rows={actForm.type === 'note' ? 3 : 2}
              placeholder={actForm.type === 'note' ? (isRTL ? 'اكتب الملاحظة...' : 'Write the note...') : (isRTL ? 'وصف / ملاحظات...' : 'Description / notes...')}
              value={actForm.description} onChange={e => setAct('description', e.target.value)}
              className={descriptionMissing ? 'border-red-500' : ''} />
          </div>
        )}
      </div>

      <div className="border-t border-edge dark:border-edge-dark my-2" />

      {/* ── Section 2: Follow-up Task ── (the "Follow-up date *" label is enough) */}
      {addTask && (
        <div className="ps-3 mb-3 mt-1">
          {/* Follow-up type chips — advanced only */}
          {showAdv && (<>
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
          </>)}
          {/* Quick follow-up presets */}
          <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">
            {isRTL ? 'موعد المتابعة' : 'Follow-up date'}{followUpRequired && <span className="text-red-500"> *</span>}
          </div>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {FOLLOWUP_PRESETS.map(p => {
              const on = followupPreset === p.key;
              return (
                <button key={p.key} type="button" onClick={() => setPresetDate(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${on ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:border-brand-500/40 hover:text-brand-500'}`}>
                  {isRTL ? p.ar : p.en}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {showAdv && (
              <Select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} className="flex-1" size="sm">
                {Object.entries(TASK_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
              </Select>
            )}
            <input type="datetime-local" value={taskForm.due_date} onChange={e => { setTaskForm(f => ({ ...f, due_date: e.target.value })); setFollowupPreset(null); }} required
              className={`flex-1 px-2 py-1.5 rounded-lg border bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none ${taskDateRequired ? 'border-red-500' : 'border-edge dark:border-edge-dark'}`} />
          </div>
        </div>
      )}

      {showAdv && <div className="border-t border-edge dark:border-edge-dark my-2" />}

      {/* ── Section 3: Change Status (dropdown — advanced only in focused mode) ── */}
      {showAdv && (<>
      <div className="flex items-center gap-2 py-2 px-3 text-xs font-bold text-content dark:text-content-dark">
        <Target size={13} className="text-emerald-500" />
        <span>{isRTL ? 'تغيير الحالة' : 'Change Status'}</span>
      </div>
        <div className="ps-3 mb-3 mt-1">
          <Select value={newStatus} size="sm" className="w-full"
            onChange={e => { setNewStatus(e.target.value); if (e.target.value !== 'disqualified') setDqReason(''); }}>
            {CONTACT_STATUSES.map(s => (
              <option key={s.id} value={s.id}>
                {(isRTL ? s.ar : s.en)}{s.id === currentStatus ? (isRTL ? ' — الحالية' : ' — current') : ''}
              </option>
            ))}
          </Select>
          {newStatus === 'disqualified' && newStatus !== currentStatus && (
            <div className="mt-2">
              <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'السبب (إجباري)' : 'Reason (required)'} <span className="text-red-500">*</span></div>
              <div className="[&>div]:w-full">
                <SearchableSelect value={dqReason} onChange={(v) => setDqReason(v)}
                  className={`w-full justify-between px-2 py-1.5 rounded-lg text-xs outline-none bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark ${!dqReason ? 'border-2 border-red-500' : 'border border-edge dark:border-edge-dark'}`}
                  options={[{ value: '', label: isRTL ? 'اختر السبب...' : 'Select reason...' }, ...DQ_REASONS.map(r => ({ value: r.value, label: r.label }))]} />
              </div>
            </div>
          )}
        </div>
      </>)}

      {/* ── Save / Cancel ── */}
      <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-edge dark:border-edge-dark">
        <Button variant="secondary" size="sm" onClick={onCancel}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
        <Button size="sm" onClick={handleSaveAll} disabled={!canSave || saving} className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
          <Zap size={12} />
          {saving ? '...' : (isRTL ? 'حفظ الكل' : 'Save All')}
        </Button>
      </div>
    </div>
  );
}
