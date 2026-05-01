import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import { Button, Input, Select } from '../../../components/ui/';
import { useEscClose, contactPropType } from './constants';
import { useFocusTrap } from '../../../utils/hooks';

const REASON_OPTIONS = [
  { value: 'fraud',          label_ar: 'احتيال',                label_en: 'Fraud' },
  { value: 'spam',           label_ar: 'سبام',                  label_en: 'Spam' },
  { value: 'wrong_number',   label_ar: 'رقم خاطئ متكرر',        label_en: 'Repeated wrong number' },
  { value: 'abusive',        label_ar: 'سلوك مسيء',             label_en: 'Abusive behavior' },
  { value: 'unreachable',    label_ar: 'غير قابل للوصول',       label_en: 'Unreachable' },
  { value: 'duplicate',      label_ar: 'مكرر',                  label_en: 'Duplicate' },
  { value: 'other',          label_ar: 'سبب آخر',               label_en: 'Other' },
];

export default function BlacklistModal({ contact, onClose, onConfirm }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  useEscClose(onClose);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);
  const [reasonCode, setReasonCode] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const needsDetail = reasonCode === 'other';
  const isReady = reasonCode && (!needsDetail || otherReason.trim().length > 0);
  const finalReason = needsDetail
    ? otherReason.trim()
    : (REASON_OPTIONS.find(r => r.value === reasonCode)?.[isRTL ? 'label_ar' : 'label_en'] || reasonCode);
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="blacklist-title" className="modal-content bg-surface-card dark:bg-surface-card-dark border border-red-500/35 rounded-2xl p-7 w-full max-w-[420px]">
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-3">
            <Ban size={24} color="#EF4444" />
          </div>
          <h3 id="blacklist-title" className="text-content dark:text-content-dark m-0 mb-1.5 text-base">{isRTL ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}</h3>
          <p className="text-content-muted dark:text-content-muted-dark text-xs m-0">{isRTL ? 'سيتم منع هذا الرقم من الإضافة مستقبلاً' : 'This number will be blocked from future additions'}</p>
        </div>
        <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3.5 py-2.5 mb-4 text-xs text-content dark:text-content-dark">
          {contact?.full_name} — {contact?.phone}
        </div>
        <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-2">{isRTL ? 'سبب الإضافة' : 'Reason'} <span className="text-red-500">*</span></label>
        <Select value={reasonCode} onChange={e => setReasonCode(e.target.value)} className="mb-3">
          <option value="">{isRTL ? '— اختر السبب —' : '— Select reason —'}</option>
          {REASON_OPTIONS.map(r => (
            <option key={r.value} value={r.value}>{isRTL ? r.label_ar : r.label_en}</option>
          ))}
        </Select>
        {needsDetail && (
          <Input type="text" value={otherReason} onChange={e => setOtherReason(e.target.value)}
            placeholder={isRTL ? 'اكتب السبب...' : 'Describe the reason...'}
            className="!border-red-500/30 mb-5" autoFocus />
        )}
        <div className={`flex gap-2.5 justify-end ${needsDetail ? '' : 'mt-2'}`}>
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" onClick={() => { if (isReady) { onConfirm(contact, finalReason); onClose(); } }} disabled={!isReady}>
            {isRTL ? 'تأكيد الإضافة' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

BlacklistModal.propTypes = {
  contact: contactPropType.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
