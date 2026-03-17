import { Plus, Grid3X3 } from 'lucide-react';
import { fmtBudget, daysSince } from './constants';
import OppCard from './OppCard';

export default function OppKanban({
  isRTL, lang, isMobile,
  sortedFiltered, totalBudget, currentStages,
  dragOverStage, setDragOverStage, draggingOpp, setDraggingOpp,
  handleMove, handleDelete, selectOpp,
  bulkMode, bulkSelected, toggleBulk,
  scoreMap, isAdmin, sourceLabelsMap,
  setShowModal,
}) {
  return (<>
    <div className="flex items-center gap-3 mb-3 px-1 text-xs text-content-muted dark:text-content-muted-dark">
      <span className="font-semibold">{sortedFiltered.length} {isRTL ? 'فرصة' : 'opportunities'}</span>
      <span>•</span>
      <span className="font-bold text-brand-500">{fmtBudget(totalBudget)} {isRTL ? 'ج' : 'EGP'}</span>
    </div>
    <div className={isMobile ? "flex flex-col gap-4 pb-4" : "flex gap-4 overflow-x-auto pb-4"}>
      {currentStages.map(stage => {
        const stageOpps = sortedFiltered.filter(o => o.stage === stage.id);
        const isOver = dragOverStage === stage.id;
        return (
          <div key={stage.id} className={isMobile ? "w-full" : "flex-shrink-0 w-[300px]"}
            onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={e => {
              e.preventDefault();
              setDragOverStage(null);
              if (draggingOpp && draggingOpp.stage !== stage.id) {
                handleMove(draggingOpp.id, stage.id);
              }
              setDraggingOpp(null);
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
              <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? stage.label_ar : stage.label_en}</span>
              <span className="text-xs text-content-muted dark:text-content-muted-dark bg-gray-100 dark:bg-brand-500/15 rounded-full px-1.5 py-px">{stageOpps.length}</span>
              {stageOpps.length > 0 && (<>
                {(() => { const staleCount = stageOpps.filter(o => daysSince(o.contacts?.last_activity_at || o.updated_at || o.created_at) >= 7).length; return staleCount > 0 ? <span className="text-[10px] font-semibold text-amber-500" title={isRTL ? 'فرص راكدة' : 'Stale opps'}>⚠ {staleCount}</span> : null; })()}
                <span className="text-[10px] font-bold text-brand-500 ms-auto">{fmtBudget(stageOpps.reduce((s, o) => s + (o.budget || 0), 0))}</span>
              </>)}
            </div>
            <div className={`flex flex-col gap-3 min-h-[200px] rounded-xl p-2.5 border border-dashed transition-colors duration-200 ${
              isOver ? 'bg-brand-500/10 border-brand-500' : 'bg-brand-500/[0.03] dark:bg-brand-500/[0.04] border-edge dark:border-edge-dark'
            }`}>
              {stageOpps.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/[0.08] flex items-center justify-center mx-auto mb-2">
                    <Grid3X3 size={16} className="text-brand-500 opacity-40" />
                  </div>
                  <p className="text-xs text-content-muted dark:text-content-muted-dark opacity-50 mb-2">{isRTL ? 'اسحب فرصة هنا' : 'Drop here'}</p>
                  <button onClick={() => setShowModal(true)} className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo">
                    <Plus size={10} className="inline -mt-px" /> {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>
              ) : stageOpps.map(opp => (
                <div key={opp.id} className="relative"
                  draggable
                  onDragStart={() => setDraggingOpp(opp)}
                  onDragEnd={() => { setDraggingOpp(null); setDragOverStage(null); }}
                >
                  {bulkMode && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }}
                      className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                        bulkSelected.has(opp.id)
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'bg-white dark:bg-surface-card-dark border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {bulkSelected.has(opp.id) && '✓'}
                    </button>
                  )}
                  <OppCard opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={bulkMode ? () => toggleBulk(opp.id) : selectOpp} stageConfig={currentStages} score={scoreMap[opp.id]} isAdmin={isAdmin} sourceLabelsMap={sourceLabelsMap} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </>);
}
