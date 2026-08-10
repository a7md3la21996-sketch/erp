import PropTypes from 'prop-types';
import { Zap } from 'lucide-react';
import { isFollowUpRequired } from '../../../services/interactionsService';

// datetime-local wants a LOCAL wall-clock string (avoid the UTC-offset shift).
const toLocalInput = (d) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function QuickActionPopover({
  quickActionTarget,
  setQuickActionTarget,
  quickActionForm,
  setQuickActionForm,
  QUICK_RESULTS,
  handleQuickAction,
  savingQuickAction,
  isRTL,
}) {
  if (!quickActionTarget) return null;

  // Same rule the service enforces — call/whatsapp/email need a follow-up; note
  // is exempt; an already-disqualified lead needs none. A "not interested"
  // result closes the lead (→ disqualify), so it needs no next step either.
  const closing = quickActionForm.result === 'not_interested';
  const followUpRequired = !closing && isFollowUpRequired(quickActionForm.type, quickActionTarget.contact_status);
  const resultMissing = (QUICK_RESULTS[quickActionForm.type] || []).length > 0 && !quickActionForm.result;

  return (
    <div className="fixed inset-0 z-[150]" onClick={() => setQuickActionTarget(null)}>
      <div onClick={e => e.stopPropagation()}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-[0_8px_30px_rgba(27,51,71,0.2)] p-4 w-[320px] z-[151]"
        dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-brand-500" />
            <span className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'إجراء سريع' : 'Quick Action'}</span>
          </div>
          <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{quickActionTarget.full_name}</span>
        </div>

        {/* Activity type chips */}
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {[
            { key: 'call', ar: 'مكالمة', en: 'Call' },
            { key: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
            { key: 'email', ar: 'إيميل', en: 'Email' },
            { key: 'note', ar: 'ملاحظة', en: 'Note' },
          ].map(v => (
            <button key={v.key} onClick={() => setQuickActionForm(f => ({ ...f, type: v.key, result: '' }))}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                quickActionForm.type === v.key
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/40'
              }`}>
              {isRTL ? v.ar : v.en}
            </button>
          ))}
        </div>

        {/* Result chips (required) */}
        {(QUICK_RESULTS[quickActionForm.type] || []).length > 0 && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النتيجة' : 'Result'} <span className="text-red-500">*</span></div>
            <div className="flex gap-1.5 flex-wrap">
              {(QUICK_RESULTS[quickActionForm.type] || []).map(r => (
                <button key={r.value} onClick={() => setQuickActionForm(f => ({ ...f, result: f.result === r.value ? '' : r.value }))}
                  className={`px-2 py-0.5 rounded-lg text-[11px] cursor-pointer border ${
                    quickActionForm.result === r.value
                      ? 'font-bold'
                      : 'font-normal bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                  }`}
                  style={quickActionForm.result === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>
                  {isRTL ? r.label_ar : r.label_en}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <textarea
          rows={2}
          placeholder={isRTL ? 'ملاحظات...' : 'Notes...'}
          value={quickActionForm.description}
          onChange={e => setQuickActionForm(f => ({ ...f, description: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none resize-none mb-3 box-border"
        />

        {/* Follow-up — mandatory for call/whatsapp/email (matches everywhere else) */}
        <div className="mb-3">
          <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1">
            {isRTL ? 'موعد المتابعة' : 'Follow-up'} {followUpRequired && <span className="text-red-500">*</span>}
          </div>
          <div className="flex gap-1.5 flex-wrap mb-1.5">
            {[{ k: 1, ar: 'غدًا', en: 'Tomorrow' }, { k: 3, ar: '3 أيام', en: '3d' }, { k: 7, ar: 'أسبوع', en: 'Week' }].map(p => (
              <button key={p.k} type="button"
                onClick={() => { const d = new Date(); d.setDate(d.getDate() + p.k); d.setHours(10, 0, 0, 0); setQuickActionForm(f => ({ ...f, followupDate: toLocalInput(d) })); }}
                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:border-brand-500/40 hover:text-brand-500">
                {isRTL ? p.ar : p.en}
              </button>
            ))}
          </div>
          <input type="datetime-local" value={quickActionForm.followupDate || ''}
            onChange={e => setQuickActionForm(f => ({ ...f, followupDate: e.target.value }))}
            className={`w-full px-2 py-1.5 rounded-lg border bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none box-border ${followUpRequired && !quickActionForm.followupDate ? 'border-red-500' : 'border-edge dark:border-edge-dark'}`} />
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setQuickActionTarget(null)} className="px-3 py-1.5 rounded-lg text-xs border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => handleQuickAction(quickActionTarget)} disabled={savingQuickAction || resultMissing || (followUpRequired && !quickActionForm.followupDate)}
            className="px-3 py-1.5 rounded-lg text-xs bg-brand-500 text-white border border-brand-500 cursor-pointer hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
            <Zap size={11} />
            {savingQuickAction ? '...' : (isRTL ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

QuickActionPopover.propTypes = {
  quickActionTarget: PropTypes.object,
  setQuickActionTarget: PropTypes.func.isRequired,
  quickActionForm: PropTypes.object.isRequired,
  setQuickActionForm: PropTypes.func.isRequired,
  QUICK_RESULTS: PropTypes.object.isRequired,
  handleQuickAction: PropTypes.func.isRequired,
  savingQuickAction: PropTypes.bool,
  isRTL: PropTypes.bool,
};
