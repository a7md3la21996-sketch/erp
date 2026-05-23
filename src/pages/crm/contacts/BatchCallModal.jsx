import { useState } from 'react';
import { Phone, MessageCircle, PhoneCall, X, SkipForward, CheckCircle2, ListTodo, AlertTriangle } from 'lucide-react';
import { createActivity, updateContact } from '../../../services/contactsService';
import { createTask } from '../../../services/tasksService';
import { logAction } from '../../../services/auditService';
import {
  TYPE,
  daysSince, initials, avatarColor, normalizePhone,
  Chip,
} from './constants';
import { reportError } from '../../../utils/errorReporter';
import { Button } from '../../../components/ui';
import { useToast } from '../../../contexts/ToastContext';

const STATUS_DEFS = {
  new:             { ar: 'جديد',        en: 'New',           color: '#4A7AAB' },
  contacted:       { ar: 'تم التواصل',  en: 'Contacted',     color: '#F59E0B' },
  following:       { ar: 'متابعة',      en: 'Following',     color: '#10B981' },
  has_opportunity: { ar: 'لديه فرصة',   en: 'Has Opp',       color: '#059669' },
  disqualified:    { ar: 'غير مؤهل',    en: 'DQ',            color: '#EF4444' },
};

export default function BatchCallModal({
  batchCallMode,
  setBatchCallMode,
  batchCallIndex,
  setBatchCallIndex,
  batchCallNotes,
  setBatchCallNotes,
  batchCallResult,
  setBatchCallResult,
  batchCallLog,
  setBatchCallLog,
  batchTaskOpen,
  setBatchTaskOpen,
  batchTaskForm,
  setBatchTaskForm,
  contacts,
  selectedIds,
  setSelectedIds,
  setContacts,
  profile,
  isRTL,
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!batchCallMode) return null;

  const batchContacts = (contacts || []).filter(c => selectedIds.includes(c.id));
  const current = batchContacts[batchCallIndex];
  if (!current && batchCallIndex < batchContacts.length) return null;

  const progress = batchCallIndex + 1;
  const total = batchContacts.length;

  const CALL_RESULTS = [
    { value: 'answered', label: isRTL ? 'رد' : 'Answered', color: '#10B981' },
    { value: 'no_answer', label: isRTL ? 'لم يرد' : 'No Answer', color: '#F59E0B' },
    { value: 'busy', label: isRTL ? 'مشغول' : 'Busy', color: '#EF4444' },
    { value: 'switched_off', label: isRTL ? 'مغلق' : 'Switched Off', color: '#6b7280' },
    { value: 'wrong_number', label: isRTL ? 'رقم خاطئ' : 'Wrong Number', color: '#9333EA' },
    { value: 'callback', label: isRTL ? 'اتصل لاحقاً' : 'Call Back', color: '#4A7AAB' },
  ];

  // Summary view after finishing
  const showSummary = batchCallIndex >= batchContacts.length && batchCallLog.length > 0;
  if (showSummary) {
    const summary = {};
    batchCallLog.forEach(l => { summary[l.result] = (summary[l.result] || 0) + 1; });
    const failedCount = batchCallLog.filter(l => l.activityFailed || l.statusFailed || l.taskFailed).length;
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-5">
        <div className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[20px] w-full max-w-[520px] overflow-hidden">
          <div className="bg-gradient-to-br from-[#065F46] to-emerald-500 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} color="#fff" />
              <span className="text-white font-bold text-sm">{isRTL ? 'ملخص المكالمات' : 'Call Summary'}</span>
            </div>
            <button onClick={() => { setBatchCallMode(false); setSelectedIds([]); }} className="bg-white/15 border-none rounded-md w-7 h-7 flex items-center justify-center cursor-pointer text-white"><X size={14} /></button>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {CALL_RESULTS.filter(r => summary[r.value]).map(r => (
                <div key={r.value} style={{ background: r.color + '15', border: `1px solid ${r.color}30`, borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{summary[r.value]}</div>
                  <div style={{ fontSize: 10, color: r.color, fontWeight: 600 }}>{r.label}</div>
                </div>
              ))}
            </div>
            {failedCount > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-500">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{isRTL ? `فشل حفظ ${failedCount} مكالمة` : `${failedCount} call(s) failed to save`}</div>
                  <div className="opacity-80">{isRTL ? 'الصفوف الحمراء تحت لم تُحفظ بالكامل — راجعها يدوياً.' : 'Red rows below did not fully save — review manually.'}</div>
                </div>
              </div>
            )}
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
              {batchCallLog.map((l, i) => {
                const rInfo = CALL_RESULTS.find(r => r.value === l.result);
                const hasFailure = l.activityFailed || l.statusFailed || l.taskFailed;
                const failParts = [];
                if (l.activityFailed) failParts.push(isRTL ? 'سجل المكالمة' : 'call log');
                if (l.statusFailed) failParts.push(isRTL ? 'الحالة' : 'status');
                if (l.taskFailed) failParts.push(isRTL ? 'المهمة' : 'task');
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.1)', background: hasFailure ? 'rgba(239,68,68,0.06)' : undefined }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: rInfo?.color || '#6b7280', flexShrink: 0 }} />
                    <span className="text-xs font-semibold text-content dark:text-content-dark flex-1">{l.name}</span>
                    {hasFailure && (
                      <span title={(isRTL ? 'فشل: ' : 'Failed: ') + failParts.join('، ')} className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                        <AlertTriangle size={11} /> {isRTL ? 'فشل' : 'fail'}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: rInfo?.color, fontWeight: 600 }}>{rInfo?.label}</span>
                    {l.notes && <span className="text-[10px] text-content-muted dark:text-content-muted-dark truncate max-w-[100px]" title={l.notes}>{l.notes}</span>}
                  </div>
                );
              })}
            </div>
            <Button className="w-full justify-center" onClick={() => { setBatchCallMode(false); setSelectedIds([]); }}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const daysAgo = current.last_activity_at ? daysSince(current.last_activity_at) : null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-5">
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[20px] w-full max-w-[520px] overflow-hidden">
        <div className="bg-gradient-to-br from-[#065F46] to-emerald-500 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <PhoneCall size={18} color="#fff" />
            <span className="text-white font-bold text-sm">{isRTL ? 'وضع الاتصال' : 'Call Mode'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-xs font-semibold">{progress}/{total}</span>
            <button disabled={saving} onClick={() => {
              if (saving) return;
              // If user has logged calls, fire the audit before closing so we don't lose it
              if (batchCallLog.length > 0) {
                logAction({ action: 'batch_call', entity: 'contact', entityId: batchCallLog.map(l => l.id).join(','), description: `Batch called ${batchCallLog.length} contacts (closed early): ${batchCallLog.map(l => `${l.name}(${l.result})`).join(', ')}`, userName: profile?.full_name_ar || '' });
              }
              setBatchCallMode(false);
            }} className={`bg-white/15 border-none rounded-md w-7 h-7 flex items-center justify-center text-white ${saving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><X size={14} /></button>
          </div>
        </div>
        <div className="h-[3px] bg-gray-200 dark:bg-gray-700">
          <div className="h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
        <div className="p-6">
          {/* Contact info */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-[50px] h-[50px] rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ background: avatarColor(current.id) }}>
              {initials(current.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base text-content dark:text-content-dark truncate">{current.full_name}</div>
              <div className="text-xs text-content-muted dark:text-content-muted-dark text-start" dir="ltr">{current.phone}</div>
              {current.phone2 && <div className="text-[11px] text-content-muted dark:text-content-muted-dark text-start" dir="ltr">{current.phone2}</div>}
              {Array.isArray(current.extra_phones) && current.extra_phones.filter(Boolean).map((p, i) => <div key={i} className="text-[11px] text-content-muted dark:text-content-muted-dark text-start" dir="ltr">{p}</div>)}
              {current.company && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5 truncate">{current.company}</div>}
              {current.campaign_name && (
                <div className="flex items-center gap-1 text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5 truncate" title={current.campaign_name}>
                  <span className="opacity-70">{isRTL ? 'كامبين:' : 'Campaign:'}</span>
                  <span className="truncate text-content dark:text-content-dark">{current.campaign_name}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {(() => {
                const s = current.contact_status || 'new';
                const def = STATUS_DEFS[s];
                if (!def) return null;
                return <Chip label={isRTL ? def.ar : def.en} color={def.color} bg={def.color + '1A'} />;
              })()}
              {TYPE[current.contact_type] && <Chip label={isRTL ? TYPE[current.contact_type].label : TYPE[current.contact_type].labelEn} color={TYPE[current.contact_type].color} bg={TYPE[current.contact_type].bg} />}
              {daysAgo !== null && (
                <span className={`text-[10px] font-semibold ${daysAgo === 0 ? 'text-emerald-500' : daysAgo <= 3 ? 'text-[#6B8DB5]' : 'text-red-500'}`}>
                  {daysAgo === 0 ? (isRTL ? 'تواصل اليوم' : 'Today') : (isRTL ? `آخر تواصل: ${daysAgo} يوم` : `${daysAgo}d ago`)}
                </span>
              )}
            </div>
          </div>

          {/* Last activity note if exists */}
          {current.last_activity_note && (
            <div className="bg-brand-500/[0.05] dark:bg-brand-500/[0.08] border border-brand-500/10 dark:border-brand-500/15 rounded-lg px-2.5 py-1.5 mb-3 text-[11px]">
              <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'آخر ملاحظة: ' : 'Last note: '}</span>
              <span className="text-content dark:text-content-dark">{current.last_activity_note}</span>
            </div>
          )}

          {/* Call + WhatsApp buttons */}
          <div className="flex gap-2 mb-4">
            <a href={`tel:${normalizePhone(current.phone)}`} className="flex-1 flex items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#065F46] to-emerald-500 rounded-xl text-white font-bold text-sm no-underline">
              <Phone size={16} /> {isRTL ? 'اتصل الآن' : 'Call Now'}
            </a>
            <a href={`https://wa.me/${normalizePhone(current.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl text-[#25D366] font-bold text-sm no-underline">
              <MessageCircle size={16} /> {isRTL ? 'واتس' : 'WhatsApp'}
            </a>
          </div>

          {/* Call result */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نتيجة المكالمة' : 'Call Result'}</div>
            <div className="flex gap-1.5 flex-wrap">
              {CALL_RESULTS.map(r => (
                <button key={r.value} onClick={() => setBatchCallResult(batchCallResult === r.value ? '' : r.value)}
                  className={`px-3 py-1.5 rounded-2xl text-xs cursor-pointer border ${batchCallResult === r.value ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={batchCallResult === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <textarea value={batchCallNotes} onChange={e => setBatchCallNotes(e.target.value)} placeholder={isRTL ? 'ملاحظات سريعة...' : 'Quick notes...'} rows={2}
            className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs resize-none box-border font-inherit mb-3" />

          {/* Add Task */}
          <div className="mb-3">
            <button onClick={() => { setBatchTaskOpen(!batchTaskOpen); if (!batchTaskOpen) setBatchTaskForm({ title: '', due: '', priority: 'medium' }); }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer bg-transparent border-none text-brand-500 dark:text-brand-400 p-0 mb-1.5">
              <ListTodo size={13} />
              {isRTL ? (batchTaskOpen ? 'إلغاء التاسك' : '+ إضافة تاسك متابعة') : (batchTaskOpen ? 'Cancel task' : '+ Add follow-up task')}
            </button>
            {batchTaskOpen && (
              <div className="bg-brand-500/[0.04] dark:bg-brand-500/[0.06] border border-brand-500/10 dark:border-brand-500/15 rounded-[10px] p-2.5">
                <input value={batchTaskForm.title} onChange={e => setBatchTaskForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={isRTL ? 'عنوان التاسك (مثل: متابعة عرض سعر)' : 'Task title (e.g. Follow up proposal)'}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-xs box-border font-inherit mb-2" style={{ outline: 'none' }} />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-content-muted dark:text-content-muted-dark block mb-0.5">{isRTL ? 'تاريخ الاستحقاق' : 'Due date'}</label>
                    <input type="date" value={batchTaskForm.due} onChange={e => setBatchTaskForm(f => ({ ...f, due: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-[11px] box-border font-inherit" style={{ outline: 'none' }} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-content-muted dark:text-content-muted-dark block mb-0.5">{isRTL ? 'الأولوية' : 'Priority'}</label>
                    <select value={batchTaskForm.priority} onChange={e => setBatchTaskForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-[11px] box-border font-inherit" style={{ outline: 'none' }}>
                      <option value="low">{isRTL ? 'منخفضة' : 'Low'}</option>
                      <option value="medium">{isRTL ? 'متوسطة' : 'Medium'}</option>
                      <option value="high">{isRTL ? 'عالية' : 'High'}</option>
                      <option value="urgent">{isRTL ? 'عاجلة' : 'Urgent'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-2.5 justify-between">
            <button disabled={batchCallIndex === 0 || saving} onClick={() => { setBatchCallIndex(i => i - 1); setBatchCallNotes(''); setBatchCallResult(''); setBatchTaskOpen(false); setBatchTaskForm({ title: '', due: '', priority: 'medium' }); }}
              className={`flex-1 p-2.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-xs ${(batchCallIndex === 0 || saving) ? 'text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-40' : 'text-content dark:text-content-dark cursor-pointer'}`}>
              {isRTL ? 'السابق' : 'Previous'}
            </button>
            <button disabled={saving} onClick={() => { setBatchCallNotes(''); setBatchCallResult(''); setBatchTaskOpen(false); setBatchTaskForm({ title: '', due: '', priority: 'medium' }); if (batchCallIndex < batchContacts.length - 1) { setBatchCallIndex(i => i + 1); } else { setBatchCallIndex(batchContacts.length); } }}
              className={`px-3 p-2.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-xs text-content-muted dark:text-content-muted-dark ${saving ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
              {isRTL ? 'تخطي' : 'Skip'}
            </button>
            <Button size="sm" className="flex-[2] justify-center" disabled={saving} onClick={async () => {
              if (saving) return; // belt-and-braces guard against double-click
              setSaving(true);
              let logEntry = null;
              let activitySaved = true;
              let statusSaved = true;
              let taskSaved = true;
              try {
                if (batchCallResult) {
                  // Idempotency guard: if this contact already has a log entry,
                  // user is re-saving via Previous → Save. Refuse to create a
                  // duplicate activity row — the original audit flagged this.
                  const alreadyLogged = (batchCallLog || []).some(e => e.id === current.id);
                  if (alreadyLogged) {
                    toast.warning(isRTL
                      ? `هذه المكالمة مسجلة بالفعل لـ ${current.full_name}. تم تخطيها لتجنب التكرار.`
                      : `Call already logged for ${current.full_name}. Skipping to avoid duplicate.`);
                    setBatchTaskOpen(false);
                    setBatchTaskForm({ title: '', due: '', priority: 'medium' });
                    if (batchCallIndex < batchContacts.length - 1) {
                      setBatchCallIndex(i => i + 1);
                    } else {
                      setBatchCallIndex(batchContacts.length);
                    }
                    setBatchCallNotes('');
                    setBatchCallResult('');
                    return;
                  }
                  const resultLabel = CALL_RESULTS.find(r => r.value === batchCallResult)?.label || batchCallResult;
                  const activity = { type: 'call', result: batchCallResult, description: `${isRTL ? 'مكالمة' : 'Call'}: ${resultLabel}${batchCallNotes ? ' — ' + batchCallNotes : ''}`, contact_id: current.id, user_id: profile?.id || null, user_name_ar: profile?.full_name_ar || '', user_name_en: profile?.full_name_en || '', created_at: new Date().toISOString() };
                  try {
                    await createActivity(activity);
                  } catch (err) {
                    activitySaved = false;
                    reportError('BatchCallModal', 'createActivity', err);
                  }
                  // Only update contact_status if the activity was saved — otherwise
                  // we'd flip the status with no audit trail explaining why.
                  if (activitySaved) {
                    // Auto-status-from-batch-call REMOVED per policy (May
                    // 2026) — same as LogCallModal / ContactDrawer. The
                    // last_activity_at timestamp still updates so the
                    // contact rises in "recently touched" sorting; the
                    // status itself stays wherever the rep set it.
                    const statusUpdate = { last_activity_at: new Date().toISOString() };
                    try {
                      await updateContact(current.id, statusUpdate);
                      setContacts(prev => prev.map(c => c.id === current.id ? { ...c, ...statusUpdate } : c));
                    } catch (err) {
                      statusSaved = false;
                      reportError('BatchCallModal', 'updateContactStatus', err);
                    }
                  } else {
                    statusSaved = false; // didn't even attempt
                  }
                  logEntry = { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes, activityFailed: !activitySaved, statusFailed: !statusSaved };
                  setBatchCallLog(prev => [...prev, logEntry]);
                }
                // Create follow-up task if filled
                if (batchTaskOpen && batchTaskForm.title.trim() && batchTaskForm.due) {
                  try {
                    await createTask({
                      title: batchTaskForm.title,
                      description: `${isRTL ? 'متابعة' : 'Follow-up'}: ${current.full_name}${batchCallNotes ? ' — ' + batchCallNotes : ''}`,
                      priority: batchTaskForm.priority,
                      due_date: batchTaskForm.due || null,
                      status: 'pending',
                      dept: 'sales',
                      contact_id: current.id,
                      contact_name: current.full_name,
                      assigned_to: profile?.id || null,
                      assigned_to_name: profile?.full_name_ar || profile?.full_name_en || '',
                      assigned_to_name_ar: profile?.full_name_ar || '',
                      assigned_to_name_en: profile?.full_name_en || '',
                    });
                  } catch (err) {
                    taskSaved = false;
                    reportError('BatchCallModal', 'createFollowUpTask', err);
                    if (logEntry) {
                      // Tag the existing log entry as having a failed task too
                      setBatchCallLog(prev => prev.map(e => e === logEntry ? { ...e, taskFailed: true } : e));
                    }
                  }
                }
                // Surface mid-batch failures so the agent isn't blindsided at the end
                if (!activitySaved || !statusSaved || !taskSaved) {
                  const failures = [];
                  if (!activitySaved) failures.push(isRTL ? 'سجل المكالمة' : 'call log');
                  if (!statusSaved && activitySaved) failures.push(isRTL ? 'حالة العميل' : 'status');
                  if (!taskSaved) failures.push(isRTL ? 'المهمة' : 'task');
                  toast.error(isRTL
                    ? `فشل حفظ ${failures.join('، ')} لـ ${current.full_name}`
                    : `Failed to save ${failures.join(', ')} for ${current.full_name}`);
                }
                // Reset task form for next contact
                setBatchTaskOpen(false);
                setBatchTaskForm({ title: '', due: '', priority: 'medium' });
                if (batchCallIndex < batchContacts.length - 1) {
                  setBatchCallIndex(i => i + 1);
                  setBatchCallNotes(''); setBatchCallResult('');
                } else {
                  // Show summary — log entry already pushed above
                  setBatchCallIndex(batchContacts.length);
                  // Audit covers the whole batch (activities table is per-call source of truth)
                  const finalLog = logEntry ? [...batchCallLog, logEntry] : batchCallLog;
                  if (finalLog.length > 0) {
                    logAction({ action: 'batch_call', entity: 'contact', entityId: finalLog.map(l => l.id).join(','), description: `Batch called ${finalLog.length} contacts: ${finalLog.map(l => `${l.name}(${l.result})`).join(', ')}`, userName: profile?.full_name_ar || '' });
                  }
                }
              } finally {
                setSaving(false);
              }
            }}>
              {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (batchCallIndex < batchContacts.length - 1 ? (<>{isRTL ? 'التالي' : 'Next'} <SkipForward size={13} /></>) : (isRTL ? 'إنهاء' : 'Finish'))}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
