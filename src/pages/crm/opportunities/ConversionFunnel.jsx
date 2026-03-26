import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';

export default function ConversionFunnel({ isRTL, isDark, showFunnel, setShowFunnel, sortedFiltered, funnelData }) {
  const total = sortedFiltered.length;
  return (
    <div className="mb-4">
      <button
        onClick={() => setShowFunnel(f => !f)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark cursor-pointer font-cairo text-xs font-semibold text-content dark:text-content-dark w-full"
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        <TrendingUp size={14} className="text-brand-500" />
        {isRTL ? 'توزيع المراحل' : 'Stage Breakdown'}
        {showFunnel ? <ChevronUp size={14} className="ms-auto text-content-muted dark:text-content-muted-dark" /> : <ChevronDown size={14} className="ms-auto text-content-muted dark:text-content-muted-dark" />}
        <span className="text-[10px] font-normal text-content-muted dark:text-content-muted-dark">
          {isRTL ? `${total} فرصة` : `${total} opps`}
        </span>
      </button>
      {showFunnel && (
        <div className="mt-2 flex flex-wrap gap-1.5 px-1" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
          {funnelData.map((stage) => {
            const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
            return (
              <span
                key={stage.id}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: `${stage.color}18`, border: `1px solid ${stage.color}30`, color: stage.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.color }} />
                {isRTL ? stage.label_ar : stage.label_en}: {stage.count}
                <span className="text-[10px] font-normal opacity-70">({pct}%)</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
