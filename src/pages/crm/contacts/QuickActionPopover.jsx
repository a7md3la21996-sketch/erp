import { Zap } from 'lucide-react';

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

        {/* Save / Cancel */}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setQuickActionTarget(null)} className="px-3 py-1.5 rounded-lg text-xs border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => handleQuickAction(quickActionTarget)} disabled={savingQuickAction || ((QUICK_RESULTS[quickActionForm.type] || []).length > 0 && !quickActionForm.result)}
            className="px-3 py-1.5 rounded-lg text-xs bg-brand-500 text-white border border-brand-500 cursor-pointer hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
            <Zap size={11} />
            {savingQuickAction ? '...' : (isRTL ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
