import { useState } from 'react';
import { Grid3X3, Banknote, Building2, Flame, TrendingUp, Timer, Zap, Star, AlertTriangle, ChevronDown } from 'lucide-react';
import { KpiCard } from '../../../components/ui';
import { fmtBudget } from './constants';

export default function OppKPIs({
  isRTL, isMobile, filtered, totalBudget, wonCount, hotCount, weightedForecast, avgDealSize, avgCloseTime, conversionRate, quickWins,
  setSmartFilters, setActiveStage, lostReasonCounts, topLostReason, lostReasonsMap,
}) {
  const [expanded, setExpanded] = useState(false);

  const allKpis = [
    { label: isRTL ? 'إجمالي الفرص' : 'Total', value: filtered.length, color: '#4A7AAB', icon: Grid3X3, onClick: () => { setSmartFilters([]); setActiveStage('all'); } },
    { label: isRTL ? 'الميزانيات' : 'Budget', value: fmtBudget(totalBudget) + (isRTL ? ' ج' : ' EGP'), color: '#4A7AAB', icon: Banknote },
    { label: isRTL ? 'صفقات مغلقة' : 'Won', value: wonCount, color: '#10B981', icon: Building2, onClick: () => setActiveStage('closed_won') },
    { label: isRTL ? 'التحويل' : 'Conv.', value: conversionRate + '%', color: '#6B8DB5', icon: Zap },
    // Extended KPIs (hidden by default)
    { label: isRTL ? 'فرص ساخنة' : 'Hot', value: hotCount, color: '#EF4444', icon: Flame, onClick: () => setSmartFilters([{ field: 'temperature', operator: 'is', value: 'hot' }]) },
    { label: isRTL ? 'التوقع المرجح' : 'Forecast', value: fmtBudget(weightedForecast) + (isRTL ? ' ج' : ' EGP'), color: '#8B5CF6', icon: TrendingUp, title: isRTL ? 'الإيراد المتوقع (الميزانية × نسبة الفوز)' : 'Weighted revenue (budget × win rate)' },
    { label: isRTL ? 'متوسط الصفقة' : 'Avg Deal', value: fmtBudget(avgDealSize) + (isRTL ? ' ج' : ' EGP'), color: '#6B8DB5', icon: Banknote, title: isRTL ? 'متوسط حجم الصفقة المغلقة' : 'Average closed deal size' },
    { label: isRTL ? 'وقت الإغلاق' : 'Close Time', value: avgCloseTime + (isRTL ? ' يوم' : 'd'), color: avgCloseTime > 30 ? '#EF4444' : avgCloseTime > 14 ? '#F59E0B' : '#10B981', icon: Timer, title: isRTL ? 'متوسط أيام الإغلاق' : 'Avg days to close' },
    { label: isRTL ? 'فرص قريبة' : 'Quick Wins', value: quickWins.length, color: '#8B5CF6', icon: Star, onClick: quickWins.length > 0 ? () => setSmartFilters([{ field: 'temperature', operator: 'is', value: 'hot' }]) : undefined, title: isRTL ? 'فرص ساخنة قريبة من الإغلاق' : 'Hot opps near closing' },
  ];

  const visibleKpis = expanded ? allKpis : allKpis.slice(0, 4);

  return (<>
    <div className="flex gap-3 mb-2 flex-wrap">
      {visibleKpis.map((s, i) => (
        <div key={i} className={`${isMobile ? 'flex-[1_1_calc(50%-6px)]' : 'flex-[1_1_120px]'} ${s.onClick ? 'cursor-pointer' : ''}`} onClick={s.onClick} title={s.title || ''}>
          <KpiCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
        </div>
      ))}
    </div>
    {allKpis.length > 4 && (
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 mx-auto mb-4 px-3 py-1 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark text-[11px] font-semibold hover:text-brand-500 transition-colors"
      >
        {expanded ? (isRTL ? 'عرض أقل' : 'Show less') : (isRTL ? 'عرض المزيد' : 'Show more')}
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
    )}

    {/* Win/Loss Analysis */}
    {Object.keys(lostReasonCounts).length > 0 && (
      <div className="mb-4 p-3 px-4 rounded-xl bg-red-500/[0.05] dark:bg-red-500/[0.08] border border-red-500/10 flex items-center gap-4 flex-wrap text-xs">
        <span className="font-bold text-red-500 flex items-center gap-1.5">
          <AlertTriangle size={13} />
          {isRTL ? 'تحليل الخسائر' : 'Loss Analysis'}
        </span>
        {Object.entries(lostReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count]) => (
          <span key={reason} className="px-2 py-1 rounded-md bg-white dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark font-semibold">
            {lostReasonsMap[reason] ? (isRTL ? lostReasonsMap[reason].label_ar : lostReasonsMap[reason].label_en) : reason} <span className="text-red-500">({count})</span>
          </span>
        ))}
        <span className="text-content-muted dark:text-content-muted-dark ms-auto">
          {isRTL ? `الأكثر: ${topLostReason ? (lostReasonsMap[topLostReason[0]]?.label_ar || topLostReason[0]) : ''}` : `Top: ${topLostReason ? (lostReasonsMap[topLostReason[0]]?.label_en || topLostReason[0]) : ''}`}
        </span>
      </div>
    )}
  </>);
}
