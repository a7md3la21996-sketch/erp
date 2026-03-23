import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Phone, Clock } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import { createActivity } from '../../../services/contactsService';
import { createTask } from '../../../services/tasksService';
import { useEscClose } from './constants';

const CALL_RESULTS = [
  { key: 'answered', ar: 'رد', en: 'Answered', color: '#10B981' },
  { key: 'no_answer', ar: 'لم يرد', en: 'No Answer', color: '#F59E0B' },
  { key: 'busy', ar: 'مشغول', en: 'Busy', color: '#EF4444' },
  { key: 'switched_off', ar: 'مغلق', en: 'Switched Off', color: '#6b7280' },
  { key: 'wrong_number', ar: 'رقم خاطئ', en: 'Wrong Number', color: '#8B5CF6' },
];
const FOLLOWUP_PRESETS = [
  { key: 'tomorrow', ar: 'غداً', en: 'Tomorrow', days: 1 },
  { key: '3days', ar: '3 أيام', en: '3 Days', days: 3 },
  { key: 'week', ar: 'أسبوع', en: 'Week', days: 7 },
  { key: 'custom', ar: 'تاريخ محدد', en: 'Custom', days: 0 },
];
const FOLLOWUP_TYPES = [
  { value: 'call', ar: 'مكالمة', en: 'Call' },
  { value: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
  { value: 'meeting', ar: 'اجتماع', en: 'Meeting' },
  { value: 'email', ar: 'إيميل', en: 'Email' },
];

export default function LogCallModal({ contact, onClose, onUpdate }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();
  useEscClose(onClose);

  const [callResult, setCallResult] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [addFollowup, setAddFollowup] = useState(false);
  const [followupPreset, setFollowupPreset] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupType, setFollowupType] = useState('call');
  const [followupPriority, setFollowupPriority] = useState('medium');

  const handlePreset = (preset) => {
    setFollowupPreset(preset.key);
    if (preset.key !== 'custom') {
      const d = new Date();
      d.setDate(d.getDate() + preset.days);
      d.setHours(10, 0, 0, 0);
      setFollowupDate(d.toISOString().slice(0, 16));
    } else {
      setFollowupDate('');
    }
  };

  useEffect(() => {
    if (['no_answer', 'busy', 'switched_off'].includes(callResult)) {
      setAddFollowup(true);
      if (!followupPreset) {
        const p = FOLLOWUP_PRESETS[0];
        setFollowupPreset(p.key);
        const d = new Date();
        d.setDate(d.getDate() + p.days);
        d.setHours(10, 0, 0, 0);
        setFollowupDate(d.toISOString().slice(0, 16));
      }
    }
  }, [callResult, followupPreset]);

  const handleSave = async () => {
    if (!callResult) { toast.warning(isRTL ? 'اختر نتيجة المكالمة' : 'Select call result'); return; }
    if (addFollowup && !followupDate) { toast.warning(isRTL ? 'اختر موعد المتابعة' : 'Select follow-up date'); return; }
    setSaving(true);

    const resultLabel = CALL_RESULTS.find(r => r.key === callResult)?.[isRTL ? 'ar' : 'en'] || callResult;
    const activity = {
      type: 'call',
      description: `${isRTL ? 'مكالمة' : 'Call'}: ${resultLabel}${callNotes ? ' — ' + callNotes : ''}`,
      next_action: addFollowup ? (isRTL ? 'متابعة' : 'Follow up') : '',
      next_action_date: addFollowup ? followupDate : '',
      contact_id: contact.id,
      created_at: new Date().toISOString(),
    };
    try { await createActivity(activity); } catch { /* saved optimistically */ }

    // Auto-change status from 'new' to 'contacted' on first call
    if (onUpdate && (contact.contact_status === 'new' || !contact.contact_status)) {
      onUpdate({ ...contact, contact_status: 'contacted' });
    }

    if (addFollowup && followupDate) {
      const followupTypeLabel = FOLLOWUP_TYPES.find(t => t.value === followupType)?.[isRTL ? 'ar' : 'en'] || followupType;
      const task = {
        title: isRTL ? `${followupTypeLabel} - ${contact.full_name}` : `${followupTypeLabel} - ${contact.full_name}`,
        type: followupType,
        priority: followupPriority,
        status: 'pending',
        contact_id: contact.id,
        contact_name: contact.full_name,
        due_date: followupDate,
        dept: 'crm',
        notes: callNotes ? `${isRTL ? 'من مكالمة سابقة' : 'From previous call'}: ${callNotes}` : '',
        assigned_to_name_ar: profile?.full_name_ar || '',
        assigned_to_name_en: profile?.full_name_en || '',
      };
      try { await createTask(task); } catch { /* saved optimistically */ }
    }

    toast.success(isRTL
      ? `تم حفظ المكالمة${addFollowup ? ' + مهمة المتابعة' : ''}`
      : `Call saved${addFollowup ? ' + follow-up task' : ''}`
    );
    setSaving(false);
    onClose();
  };

  const priorities = [
    { value: 'high', ar: 'عالية', en: 'High', color: '#EF4444' },
    { value: 'medium', ar: 'متوسطة', en: 'Medium', color: '#F59E0B' },
    { value: 'low', ar: 'منخفضة', en: 'Low', color: '#10B981' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-2xl w-[420px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h3 className="text-sm font-bold text-content dark:text-content-dark flex items-center gap-1.5"><Phone size={14} /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'} — {contact.full_name}</h3>
          <button onClick={onClose} className="bg-transparent border-none text-xl text-content-muted dark:text-content-muted-dark cursor-pointer">×</button>
        </div>
        <div className="px-5 py-[18px]">
          {/* Call Result */}
          <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-2">{isRTL ? 'نتيجة المكالمة' : 'Call Result'} <span className="text-red-500">*</span></div>
          <div className="flex gap-1.5 flex-wrap mb-3.5">
            {CALL_RESULTS.map(r => (
              <button key={r.key} onClick={() => setCallResult(r.key)} className="px-3 py-[5px] rounded-full text-xs cursor-pointer font-inherit transition-colors" style={{
                border: `1.5px solid ${callResult === r.key ? r.color : 'var(--border-edge, #E2E8F0)'}`,
                background: callResult === r.key ? r.color + '18' : 'none',
                color: callResult === r.key ? r.color : undefined,
                fontWeight: callResult === r.key ? 700 : 400,
              }}>{isRTL ? r.ar : r.en}</button>
            ))}
          </div>
          {/* Notes */}
          <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'ملاحظات' : 'Notes'}</div>
          <Textarea rows={2} value={callNotes} onChange={e => setCallNotes(e.target.value)} className="!resize-none mb-4" placeholder={isRTL ? 'ملاحظات المكالمة...' : 'Call notes...'} />

          {/* Follow-up Section */}
          <div className={`bg-brand-500/[0.06] dark:bg-brand-500/[0.06] rounded-xl p-3.5 transition-colors ${addFollowup ? 'border border-brand-500/25' : 'border border-edge dark:border-edge-dark'}`}>
            <label className={`flex items-center gap-2 cursor-pointer text-xs font-semibold ${addFollowup ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
              <input type="checkbox" checked={addFollowup} onChange={e => setAddFollowup(e.target.checked)} className="accent-brand-500 cursor-pointer" />
              <Clock size={14} /> {isRTL ? 'إنشاء مهمة متابعة' : 'Create follow-up task'}
            </label>
            {addFollowup && (
              <div className="mt-3">
                <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'متى؟' : 'When?'}</div>
                <div className="flex gap-[5px] flex-wrap mb-2.5">
                  {FOLLOWUP_PRESETS.map(p => (
                    <button key={p.key} onClick={() => handlePreset(p)} className="px-3 py-1 rounded-2xl text-xs cursor-pointer font-inherit transition-colors" style={{
                      border: `1.5px solid ${followupPreset === p.key ? '#4A7AAB' : 'var(--border-edge, #E2E8F0)'}`,
                      background: followupPreset === p.key ? 'rgba(74,122,171,0.12)' : 'none',
                      color: followupPreset === p.key ? '#4A7AAB' : undefined,
                      fontWeight: followupPreset === p.key ? 700 : 400,
                    }}>{isRTL ? p.ar : p.en}</button>
                  ))}
                </div>
                {followupPreset === 'custom' && (
                  <Input type="datetime-local" value={followupDate} onChange={e => setFollowupDate(e.target.value)} size="sm" className="mb-2.5" />
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1">{isRTL ? 'نوع المتابعة' : 'Follow-up type'}</div>
                    <Select size="sm" value={followupType} onChange={e => setFollowupType(e.target.value)}>
                      {FOLLOWUP_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1">{isRTL ? 'الأولوية' : 'Priority'}</div>
                    <div className="flex gap-[3px]">
                      {priorities.map(p => (
                        <button key={p.value} onClick={() => setFollowupPriority(p.value)} className="flex-1 py-[5px] rounded-[5px] text-[10px] cursor-pointer font-inherit" style={{
                          background: followupPriority === p.value ? p.color + '18' : 'transparent',
                          border: `1px solid ${followupPriority === p.value ? p.color : 'var(--border-edge, #E2E8F0)'}`,
                          color: followupPriority === p.value ? p.color : undefined,
                          fontWeight: followupPriority === p.value ? 700 : 400,
                        }}>{isRTL ? p.ar : p.en}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-edge dark:border-edge-dark flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || !callResult}>
            {saving ? '...' : addFollowup ? (isRTL ? 'حفظ + إنشاء مهمة' : 'Save + Create Task') : (isRTL ? 'حفظ المكالمة' : 'Save Call')}
          </Button>
        </div>
      </div>
    </div>
  );
}
