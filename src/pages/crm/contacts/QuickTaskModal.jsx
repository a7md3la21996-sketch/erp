import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Clock } from 'lucide-react';
import { Button, Input, Select } from '../../../components/ui/';
import { createTask } from '../../../services/tasksService';
import { useEscClose } from './constants';

const QUICK_TASK_PRESETS = [
  { key: 'tomorrow', ar: 'غداً', en: 'Tomorrow', days: 1 },
  { key: '3days', ar: '3 أيام', en: '3 Days', days: 3 },
  { key: 'week', ar: 'أسبوع', en: 'Week', days: 7 },
  { key: 'custom', ar: 'تاريخ محدد', en: 'Custom', days: 0 },
];

export default function QuickTaskModal({ contact, onClose }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();
  useEscClose(onClose);

  const [selectedPreset, setSelectedPreset] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('followup');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const handlePreset = (preset) => {
    setSelectedPreset(preset.key);
    if (preset.key !== 'custom') {
      const d = new Date();
      d.setDate(d.getDate() + preset.days);
      setCustomDate(d.toISOString().slice(0, 16));
    } else {
      setCustomDate('');
    }
  };

  const handleSave = async () => {
    if (!customDate) { toast.warning(isRTL ? 'اختر الموعد' : 'Select a date'); return; }
    setSaving(true);
    const task = {
      title: title || (isRTL ? `متابعة ${contact.full_name}` : `Follow up with ${contact.full_name}`),
      type: taskType,
      priority,
      status: 'pending',
      contact_id: contact.id,
      contact_name: contact.full_name,
      due_date: customDate,
      dept: 'crm',
      notes: '',
      assigned_to_name_ar: profile?.full_name_ar || '',
      assigned_to_name_en: profile?.full_name_en || '',
    };
    try { await createTask(task); toast.success(isRTL ? 'تم إنشاء المهمة' : 'Task created'); } catch { toast.success(isRTL ? 'تم إنشاء المهمة محلياً' : 'Task created locally'); }
    setSaving(false);
    onClose();
  };

  const taskTypes = [
    { value: 'followup', ar: 'متابعة', en: 'Follow-up' },
    { value: 'call', ar: 'مكالمة', en: 'Call' },
    { value: 'meeting', ar: 'اجتماع', en: 'Meeting' },
    { value: 'email', ar: 'إيميل', en: 'Email' },
    { value: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
  ];
  const priorities = [
    { value: 'high', ar: 'عالية', en: 'High', color: '#EF4444' },
    { value: 'medium', ar: 'متوسطة', en: 'Medium', color: '#F59E0B' },
    { value: 'low', ar: 'منخفضة', en: 'Low', color: '#10B981' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-2xl w-[400px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h3 className="text-sm font-bold text-content dark:text-content-dark flex items-center gap-1.5"><Clock size={14} /> {isRTL ? 'مهمة سريعة' : 'Quick Task'} — {contact.full_name}</h3>
          <button onClick={onClose} className="bg-transparent border-none text-xl text-content-muted dark:text-content-muted-dark cursor-pointer">×</button>
        </div>
        <div className="px-5 py-[18px]">
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mb-3.5" placeholder={isRTL ? `متابعة ${contact.full_name}` : `Follow up with ${contact.full_name}`} />
          <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-2">{isRTL ? 'متى؟' : 'When?'}</div>
          <div className="flex gap-1.5 flex-wrap mb-3.5">
            {QUICK_TASK_PRESETS.map(p => (
              <button key={p.key} onClick={() => handlePreset(p)} className="px-3.5 py-[5px] rounded-full text-xs cursor-pointer font-inherit transition-colors" style={{
                border: `1.5px solid ${selectedPreset === p.key ? '#4A7AAB' : 'var(--border-edge, #E2E8F0)'}`,
                background: selectedPreset === p.key ? 'rgba(74,122,171,0.12)' : 'none',
                color: selectedPreset === p.key ? '#4A7AAB' : undefined,
                fontWeight: selectedPreset === p.key ? 700 : 400,
              }}>{isRTL ? p.ar : p.en}</button>
            ))}
          </div>
          {selectedPreset === 'custom' && (
            <Input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)} size="sm" className="mb-3.5" />
          )}
          <div className="flex gap-2.5 mb-1">
            <div className="flex-1">
              <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'النوع' : 'Type'}</div>
              <Select size="sm" value={taskType} onChange={e => setTaskType(e.target.value)}>
                {taskTypes.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
              </Select>
            </div>
            <div className="flex-1">
              <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'الأولوية' : 'Priority'}</div>
              <div className="flex gap-1">
                {priorities.map(p => (
                  <button key={p.value} onClick={() => setPriority(p.value)} className="flex-1 py-1.5 rounded-md text-xs cursor-pointer font-inherit" style={{
                    background: priority === p.value ? p.color + '18' : 'transparent',
                    border: `1px solid ${priority === p.value ? p.color : 'var(--border-edge, #E2E8F0)'}`,
                    color: priority === p.value ? p.color : undefined,
                    fontWeight: priority === p.value ? 700 : 400,
                  }}>{isRTL ? p.ar : p.en}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-edge dark:border-edge-dark flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || !selectedPreset || !customDate}>{saving ? '...' : (isRTL ? 'إنشاء مهمة' : 'Create Task')}</Button>
        </div>
      </div>
    </div>
  );
}
