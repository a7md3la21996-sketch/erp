import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input } from '../../../components/ui';
import { createDealFromContact, advanceDeal } from '../../../services/dealsService';

// Light modal to log a deal milestone on a lead (deal-events model).
// One deal per lead advances: reserved → contracted → won (or lost).
// Captures the money fields so reports/commission aren't empty (the reason
// these milestones are structured records, not just timeline notes).
const STATUSES = [
  { key: 'reserved',   ar: 'حجز',   en: 'Reserved',   color: '#5A63C4' },
  { key: 'contracted', ar: 'عقد',   en: 'Contracted', color: '#0B5A53' },
  { key: 'won',        ar: 'بيع',   en: 'Won',        color: '#158A57' },
  { key: 'lost',       ar: 'خسارة', en: 'Lost',       color: '#D6403B' },
];

export default function DealEventModal({ contact, initialStatus = 'reserved', dealId = null, initialFields = {}, isRTL, onClose, onSaved }) {
  const [status, setStatus] = useState(initialStatus);
  const [unitCode, setUnitCode] = useState(initialFields.unit_code || '');
  const [dealValue, setDealValue] = useState(initialFields.deal_value != null ? String(initialFields.deal_value) : '');
  const [downPayment, setDownPayment] = useState(initialFields.down_payment != null ? String(initialFields.down_payment) : '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isLost = status === 'lost';
  const advancing = !!dealId; // updating a specific existing deal vs creating new

  const save = async () => {
    setSaving(true); setError('');
    const fields = {
      unit_code: unitCode || undefined,
      deal_value: dealValue !== '' ? Number(dealValue) : undefined,
      down_payment: downPayment !== '' ? Number(downPayment) : undefined,
      notes: notes || undefined,
    };
    try {
      // Advance a specific deal, or create a NEW one (a lead can have several).
      const { deal } = advancing
        ? await advanceDeal(dealId, status, fields)
        : await createDealFromContact(contact, { ...fields, status, allowDuplicate: true });
      onSaved?.({ deal, status });
    } catch (err) {
      setError(err?.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
      setSaving(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}
      className="fixed inset-0 z-[920] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] bg-surface-card dark:bg-surface-card-dark rounded-2xl border border-edge dark:border-edge-dark shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge dark:border-edge-dark">
          <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'تسجيل صفقة' : 'Log deal'}</span>
          <button onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-red-500/10 hover:text-red-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Milestone picker */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(st => {
              const active = status === st.key;
              return (
                <button key={st.key} onClick={() => setStatus(st.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border transition-all ${active ? 'text-white' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={active ? { background: st.color, borderColor: st.color } : undefined}>
                  {isRTL ? st.ar : st.en}
                </button>
              );
            })}
          </div>

          {/* Money fields — hidden for "lost" (no value to capture) */}
          {!isLost && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'كود الوحدة' : 'Unit code'}</label>
                <Input value={unitCode} onChange={e => setUnitCode(e.target.value)} placeholder={isRTL ? 'A-12' : 'A-12'} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'قيمة الصفقة' : 'Deal value'}</label>
                  <Input type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'المقدّم' : 'Down payment'}</label>
                  <Input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)} placeholder="0" />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'ملاحظة (اختياري)' : 'Note (optional)'}</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={isRTL ? '...' : '...'} />
          </div>

          {error && <div className="text-[11px] text-red-500">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-edge dark:border-edge-dark">
          <Button variant="secondary" size="sm" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</Button>
        </div>
      </div>
    </div>
  );
}
