import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from '../../../components/ui';

export default function ConversionFunnel({ isRTL, isDark, showFunnel, setShowFunnel, sortedFiltered, funnelData }) {
  return (
    <div className="mb-4">
      <button
        onClick={() => setShowFunnel(f => !f)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark cursor-pointer font-cairo text-xs font-semibold text-content dark:text-content-dark w-full"
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        <TrendingUp size={14} className="text-brand-500" />
        {isRTL ? 'قمع التحويل' : 'Conversion Funnel'}
        {showFunnel ? <ChevronUp size={14} className="ms-auto text-content-muted dark:text-content-muted-dark" /> : <ChevronDown size={14} className="ms-auto text-content-muted dark:text-content-muted-dark" />}
        <span className="text-[10px] font-normal text-content-muted dark:text-content-muted-dark">
          {isRTL ? `${sortedFiltered.length} فرصة` : `${sortedFiltered.length} opps`}
        </span>
      </button>
      {showFunnel && (
        <Card className="mt-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-content-muted dark:text-content-muted-dark">
              {isRTL ? `الإجمالي: ${sortedFiltered.length}` : `Total: ${sortedFiltered.length}`}
            </span>
            <span className="text-[11px] font-bold" style={{ color: '#10B981' }}>
              {isRTL ? `مغلق: ${sortedFiltered.filter(o => o.stage === 'closed_won').length}` : `Won: ${sortedFiltered.filter(o => o.stage === 'closed_won').length}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {funnelData.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
                <span className="text-[10px] font-semibold text-content dark:text-content-dark w-[90px] truncate" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? stage.label_ar : stage.label_en}
                </span>
                <div className="flex-1 h-[22px] rounded-md overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  <div
                    className="h-full rounded-md flex items-center justify-end px-2 transition-all duration-300"
                    style={{ width: `${stage.width}%`, background: stage.color, minWidth: stage.count > 0 ? 32 : 0 }}
                  >
                    {stage.count > 0 && (
                      <span className="text-[10px] font-bold text-white">{stage.count}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] w-[48px] text-content-muted dark:text-content-muted-dark" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {stage.count > 0 ? stage.count : '\u2014'}
                </span>
                {stage.dropOff !== null && (
                  <span className={`text-[9px] font-bold w-[40px] ${stage.dropOff < 0 ? 'text-red-500' : stage.dropOff > 0 ? 'text-green-500' : 'text-content-muted dark:text-content-muted-dark'}`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {stage.dropOff > 0 ? '+' : ''}{stage.dropOff}%
                  </span>
                )}
                {stage.dropOff === null && <span className="w-[40px]" />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
