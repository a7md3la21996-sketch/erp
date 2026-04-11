import { Phone, MessageCircle, PhoneCall, X, SkipForward, CheckCircle2, ListTodo } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
              {batchCallLog.map((l, i) => {
                const rInfo = CALL_RESULTS.find(r => r.value === l.result);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: rInfo?.color || '#6b7280', flexShrink: 0 }} />
                    <span className="text-xs font-semibold text-content dark:text-content-dark flex-1">{l.name}</span>
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
            <button onClick={() => setBatchCallMode(false)} className="bg-white/15 border-none rounded-md w-7 h-7 flex items-center justify-center cursor-pointer text-white"><X size={14} /></button>
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
            <div className="flex-1">
              <div className="font-bold text-base text-content dark:text-content-dark">{current.full_name}</div>
              <div className="text-xs text-content-muted dark:text-content-muted-dark text-start" dir="ltr">{current.phone}</div>
              {current.company && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">{current.company}</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
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
            <div style={{ background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.05)', border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)'}`, borderRadius: 8, padding: '6px 10px', marginBottom: 12, fontSize: 11 }}>
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
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => { setBatchTaskOpen(!batchTaskOpen); if (!batchTaskOpen) setBatchTaskForm({ title: '', due: '', priority: 'medium' }); }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer bg-transparent border-none text-brand-500 dark:text-brand-400 p-0 mb-1.5">
              <ListTodo size={13} />
              {isRTL ? (batchTaskOpen ? 'إلغاء التاسك' : '+ إضافة تاسك متابعة') : (batchTaskOpen ? 'Cancel task' : '+ Add follow-up task')}
            </button>
            {batchTaskOpen && (
              <div style={{ background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)', border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)'}`, borderRadius: 10, padding: 10 }}>
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
            <button disabled={batchCallIndex === 0} onClick={() => { setBatchCallIndex(i => i - 1); setBatchCallNotes(''); setBatchCallResult(''); setBatchTaskOpen(false); setBatchTaskForm({ title: '', due: '', priority: 'medium' }); }}
              className={`flex-1 p-2.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-xs ${batchCallIndex === 0 ? 'text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-40' : 'text-content dark:text-content-dark cursor-pointer'}`}>
              {isRTL ? 'السابق' : 'Previous'}
            </button>
            <button onClick={() => { setBatchCallNotes(''); setBatchCallResult(''); setBatchTaskOpen(false); setBatchTaskForm({ title: '', due: '', priority: 'medium' }); if (batchCallIndex < batchContacts.length - 1) { setBatchCallIndex(i => i + 1); } else { setBatchCallIndex(batchContacts.length); } }}
              className="px-3 p-2.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-xs text-content-muted dark:text-content-muted-dark cursor-pointer">
              {isRTL ? 'تخطي' : 'Skip'}
            </button>
            <Button size="sm" className="flex-[2] justify-center" onClick={async () => {
              if (batchCallResult) {
                const resultLabel = CALL_RESULTS.find(r => r.value === batchCallResult)?.label || batchCallResult;
                const activity = { type: 'call', result: batchCallResult, description: `${isRTL ? 'مكالمة' : 'Call'}: ${resultLabel}${batchCallNotes ? ' — ' + batchCallNotes : ''}`, contact_id: current.id, user_id: profile?.id || null, user_name_ar: profile?.full_name_ar || '', user_name_en: profile?.full_name_en || '', created_at: new Date().toISOString() };
                try { await createActivity(activity); } catch (err) { if (import.meta.env.DEV) console.warn('batch call create activity:', err); }
                const myName = profile?.full_name_en || profile?.full_name_ar;
                const myStatus = (current.agent_statuses || {})[myName] || current.contact_status;
                let newStatus = myStatus;
                // disqualified → never auto-change
                if (myStatus === 'disqualified') {
                  newStatus = myStatus;
                } else if (['no_answer', 'busy', 'switched_off'].includes(batchCallResult)) {
                  newStatus = 'inactive';
                } else if (batchCallResult === 'answered') {
                  newStatus = 'active';
                } else if (myStatus === 'new' || !myStatus) {
                  newStatus = 'active';
                }
                const newStatuses = { ...(current.agent_statuses || {}), [myName]: newStatus };
                const statusUpdate = { last_activity_at: new Date().toISOString(), contact_status: newStatus, agent_statuses: newStatuses };
                try { await updateContact(current.id, statusUpdate); } catch (err) { if (import.meta.env.DEV) console.warn('batch call update status:', err); }
                setContacts(prev => prev.map(c => c.id === current.id ? { ...c, ...statusUpdate } : c));
                setBatchCallLog(prev => [...prev, { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes }]);
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
                } catch (err) { reportError('BatchCallModal', 'createFollowUpTask', err); }
              }
              // Reset task form for next contact
              setBatchTaskOpen(false);
              setBatchTaskForm({ title: '', due: '', priority: 'medium' });
              if (batchCallIndex < batchContacts.length - 1) {
                setBatchCallIndex(i => i + 1);
                setBatchCallNotes(''); setBatchCallResult('');
              } else {
                // Show summary
                const finalLog = batchCallResult ? [...batchCallLog, { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes }] : batchCallLog;
                setBatchCallLog(finalLog);
                setBatchCallIndex(batchContacts.length); // trigger summary view
                logAction({ action: 'batch_call', entity: 'contact', entityId: finalLog.map(l => l.id).join(','), description: `Batch called ${finalLog.length} contacts: ${finalLog.map(l => `${l.name}(${l.result})`).join(', ')}`, userName: profile?.full_name_ar || '' });
                // No full refresh needed — contacts state is already updated optimistically above
              }
            }}>
              {batchCallIndex < batchContacts.length - 1 ? (<>{isRTL ? 'التالي' : 'Next'} <SkipForward size={13} /></>) : (isRTL ? 'إنهاء' : 'Finish')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
