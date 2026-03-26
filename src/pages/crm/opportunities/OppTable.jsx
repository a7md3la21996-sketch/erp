import { useState, useEffect, useRef } from 'react';
import { Trash2, CheckSquare, Square, AlertTriangle, Star, Phone, MessageCircle, MoreVertical } from 'lucide-react';
import { Card, Pagination } from '../../../components/ui';
import {
  TEMP_CONFIG, PRIORITY_CONFIG,
  getContactName, getAgentName, getProjectName,
  initials, avatarColor, fmtBudget, calcLeadScore, scoreColor, daysInStage, daysSince,
} from './constants';
import { getDeptStages } from '../contacts/constants';
import { normalizePhone } from '../contacts/constants';
import { getApprovalByEntity } from '../../../services/approvalService';

export default function OppTable({
  isRTL, lang, isMobile,
  gridPaged, sortedFiltered,
  gridSafePage, gridTotalPages, setGridPage, pageSize, setPageSize,
  scoreMap, quickWins, bulkMode, bulkSelected, toggleBulk, setBulkSelected,
  selectOpp, handleDelete, isDuplicate,
  perms = {},
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);
  return (<>
    {/* Table View - Mobile Card Layout */}
    {isMobile && (
      <div className="flex flex-col gap-3 md:hidden">
        {gridPaged.length === 0 ? (
          <Card className="text-center py-10 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'لا توجد نتائج' : 'No results'}
          </Card>
        ) : gridPaged.map(opp => {
          const contactName = getContactName(opp);
          const projectName = getProjectName(opp, lang);
          const stageConfig = getDeptStages(opp.contacts?.department || 'sales');
          const stage = stageConfig.find(s => s.id === opp.stage) || stageConfig[0] || { id: opp.stage, label_ar: opp.stage, label_en: opp.stage, color: '#4A7AAB' };
          const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
          const score = scoreMap[opp.id] ?? calcLeadScore(opp);
          return (
            <Card key={opp.id} className="p-3.5 cursor-pointer active:bg-brand-500/[0.04]" onClick={() => selectOpp(opp)}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: avatarColor(opp.contact_id || opp.id) }}>
                  {initials(contactName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-content dark:text-content-dark truncate">{contactName}</div>
                  {projectName && <div className="text-[11px] text-content-muted dark:text-content-muted-dark truncate">{projectName}</div>}
                </div>
                {bulkMode && (
                  <button onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer shrink-0 ${bulkSelected.has(opp.id) ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white dark:bg-surface-card-dark border-gray-300 dark:border-gray-600'}`}>
                    {bulkSelected.has(opp.id) && '\u2713'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: stage.color }}>{isRTL ? stage.label_ar : stage.label_en}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: temp.bg, color: temp.color }}>{isRTL ? temp.label_ar : temp.label_en}</span>
                {opp.budget > 0 && <span className="text-[11px] font-bold text-brand-500">{fmtBudget(opp.budget)} {isRTL ? '\u062C' : 'EGP'}</span>}
                <span className="text-[10px] ms-auto" style={{ color: scoreColor(score) }}>{score} pts</span>
              </div>
              {opp.notes && (
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark truncate max-w-[200px] block mt-1">
                  📝 {opp.notes.slice(0, 40)}{opp.notes.length > 40 ? '...' : ''}
                </span>
              )}
              {opp.contacts?.phone && (
                <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                  <a href={`tel:${normalizePhone(opp.contacts.phone)}`} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-500 no-underline text-[11px] font-semibold">
                    <Phone size={12} /> {isRTL ? 'اتصال' : 'Call'}
                  </a>
                  <a href={`https://wa.me/${normalizePhone(opp.contacts.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#25D366]/[0.08] border border-[#25D366]/20 text-[#25D366] no-underline text-[11px] font-semibold">
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    )}
    {/* Table View - Desktop */}
    <Card className={`overflow-hidden ${isMobile ? 'hidden' : ''}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 1100 }}>
          <thead>
            <tr className="border-b border-edge dark:border-edge-dark bg-[#F8FAFC] dark:bg-surface-bg-dark">
              {perms.canBulkOpps && (
                <th className="px-3 py-3 text-start w-10">
                  <button
                    onClick={() => {
                      const allIds = new Set(gridPaged.map(o => o.id));
                      const allSelected = gridPaged.length > 0 && gridPaged.every(o => bulkSelected.has(o.id));
                      setBulkSelected(allSelected ? new Set([...bulkSelected].filter(id => !allIds.has(id))) : new Set([...bulkSelected, ...allIds]));
                    }}
                    className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center"
                  >
                    {gridPaged.length > 0 && gridPaged.every(o => bulkSelected.has(o.id))
                      ? <CheckSquare size={18} style={{ color: '#4A7AAB' }} />
                      : <Square size={18} className="text-content-muted dark:text-content-muted-dark" />
                    }
                  </button>
                </th>
              )}
              {[
                { key: 'name', label: isRTL ? '\u0627\u0644\u0627\u0633\u0645' : 'Name', width: 'min-w-[180px]' },
                { key: 'project', label: isRTL ? '\u0627\u0644\u0645\u0634\u0631\u0648\u0639' : 'Project', width: 'min-w-[120px]' },
                { key: 'stage', label: isRTL ? '\u0627\u0644\u0645\u0631\u062D\u0644\u0629' : 'Stage', width: 'min-w-[110px]' },
                { key: 'budget', label: isRTL ? '\u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629' : 'Budget', width: 'min-w-[90px]' },
                { key: 'temp', label: isRTL ? '\u0627\u0644\u062D\u0631\u0627\u0631\u0629' : 'Temp', width: 'min-w-[70px]' },
                { key: 'priority', label: isRTL ? '\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629' : 'Priority', width: 'min-w-[80px]' },
                { key: 'agent', label: isRTL ? '\u0627\u0644\u0645\u0633\u0624\u0648\u0644' : 'Agent', width: 'min-w-[110px]' },
                { key: 'score', label: isRTL ? '\u0627\u0644\u0646\u0642\u0627\u0637' : 'Score', width: 'min-w-[60px]' },
                { key: 'days', label: isRTL ? '\u0623\u064A\u0627\u0645' : 'Days', width: 'min-w-[55px]' },
                { key: 'close', label: isRTL ? '\u0627\u0644\u0625\u063A\u0644\u0627\u0642' : 'Close', width: 'min-w-[85px]' },
                { key: 'actions', label: isRTL ? 'إجراءات' : 'Actions', width: 'min-w-[100px]' },
              ].map(col => (
                <th key={col.key} className={`px-3 py-3 text-start text-xs font-semibold text-content-muted dark:text-content-muted-dark ${col.width}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridPaged.map((opp, idx) => {
              const contactName = getContactName(opp);
              const projectName = getProjectName(opp, lang);
              const agentName = getAgentName(opp, lang);
              const stageConfig = getDeptStages(opp.contacts?.department || 'sales');
              const stage = stageConfig.find(s => s.id === opp.stage) || stageConfig[0] || { id: opp.stage, label_ar: opp.stage, label_en: opp.stage, color: '#4A7AAB' };
              const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
              const prio = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.medium;
              const score = scoreMap[opp.id] ?? calcLeadScore(opp);
              const days = daysInStage(opp);
              const closeDate = opp.expected_close_date;
              const closeDiff = closeDate ? Math.ceil((new Date(closeDate) - Date.now()) / 86400000) : null;
              const duplicate = isDuplicate(opp.contact_id);
              const staledays = daysSince(opp.contacts?.last_activity_at || opp.updated_at || opp.created_at);
              const isQuickWin = quickWins.some(q => q.id === opp.id);

              return (
                <tr
                  key={opp.id}
                  onClick={() => selectOpp(opp)}
                  className={`border-b border-edge dark:border-edge-dark cursor-pointer transition-colors hover:bg-brand-500/[0.04] dark:hover:bg-brand-500/[0.06] ${
                    bulkSelected.has(opp.id) ? 'bg-brand-500/[0.06] dark:bg-brand-500/[0.08]' : ''
                  } ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-white/[0.015]'}`}
                >
                  {perms.canBulkOpps && (
                    <td className="px-3 py-2.5">
                      <button
                        onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }}
                        className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center"
                      >
                        {bulkSelected.has(opp.id)
                          ? <CheckSquare size={18} style={{ color: '#4A7AAB' }} />
                          : <Square size={18} className="text-content-muted dark:text-content-muted-dark" />
                        }
                      </button>
                    </td>
                  )}
                  {/* Name */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: avatarColor(opp.contact_id || opp.id) }}
                      >
                        {initials(contactName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-content dark:text-content-dark truncate">{contactName}</span>
                          {duplicate && <AlertTriangle size={11} className="text-amber-500 shrink-0" title={isRTL ? '\u0645\u0643\u0631\u0631' : 'Duplicate'} />}
                          {isQuickWin && (
                            <span className="text-[9px] px-1 py-px rounded bg-purple-500/10 text-purple-500 font-bold shrink-0" title={isRTL ? '\u0641\u0631\u0635\u0629 \u0642\u0631\u064A\u0628\u0629 \u0645\u0646 \u0627\u0644\u0625\u063A\u0644\u0627\u0642' : 'Quick Win'}>
                              <Star size={8} className="inline -mt-px" /> {isRTL ? '\u0642\u0631\u064A\u0628\u0629' : 'Win'}
                            </span>
                          )}
                          {staledays >= 7 && opp.stage !== 'closed_won' && opp.stage !== 'closed_lost' && (
                            <span className={`text-[9px] px-1 py-px rounded ${staledays >= 14 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`} title={isRTL ? `${staledays} \u064A\u0648\u0645 \u0628\u062F\u0648\u0646 \u0646\u0634\u0627\u0637` : `${staledays}d inactive`}>
                              {staledays}{isRTL ? '\u064A' : 'd'}
                            </span>
                          )}
                          {(() => { const apr = getApprovalByEntity('deal', opp.id); return apr && apr.status === 'pending' ? (
                            <span className="text-[9px] px-1.5 py-px rounded bg-amber-500/10 text-amber-600 font-bold shrink-0" title={isRTL ? '\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629' : 'Pending Approval'}>
                              {isRTL ? '\u0645\u0648\u0627\u0641\u0642\u0629' : 'Approval'}
                            </span>
                          ) : null; })()}
                        </div>
                        {opp.contacts?.phone && (
                          <div className="text-[11px] text-content-muted dark:text-content-muted-dark" dir="ltr">{opp.contacts.phone}</div>
                        )}
                        {opp.notes && (
                          <span className="text-[10px] text-content-muted dark:text-content-muted-dark truncate max-w-[150px] block">
                            📝 {opp.notes.slice(0, 40)}{opp.notes.length > 40 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Project */}
                  <td className="px-3 py-2.5">
                    {projectName ? (
                      <span className="text-xs text-content dark:text-content-dark truncate block max-w-[140px]">{projectName}</span>
                    ) : (
                      <span className="text-xs text-content-muted dark:text-content-muted-dark">{'\u2014'}</span>
                    )}
                  </td>
                  {/* Stage */}
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md"
                      style={{ background: `${stage.color}18`, color: stage.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.color }} />
                      {isRTL ? stage.label_ar : stage.label_en}
                    </span>
                  </td>
                  {/* Budget */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-bold text-content dark:text-content-dark">
                      {fmtBudget(opp.budget)} {opp.budget ? (isRTL ? 'ج.م' : 'EGP') : ''}
                    </span>
                  </td>
                  {/* Temperature */}
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: temp.bg, color: temp.color }}
                    >
                      {isRTL ? temp.label_ar : temp.label_en}
                    </span>
                  </td>
                  {/* Priority */}
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: `${prio.color}18`, color: prio.color }}
                    >
                      {isRTL ? prio.label_ar : prio.label_en}
                    </span>
                  </td>
                  {/* Agent */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-content dark:text-content-dark truncate block max-w-[120px]">{agentName}</span>
                  </td>
                  {/* Lead Score */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                    </div>
                  </td>
                  {/* Days in stage */}
                  <td className="px-3 py-2.5">
                    <span className={`text-[11px] font-semibold ${days > 7 ? 'text-red-500' : days > 3 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                      {days}{isRTL ? '\u064A' : 'd'}
                    </span>
                  </td>
                  {/* Expected Close */}
                  <td className="px-3 py-2.5">
                    {closeDate ? (
                      <span className={`text-[11px] font-semibold ${closeDiff !== null && closeDiff < 0 ? 'text-red-500' : closeDiff !== null && closeDiff <= 7 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                        {new Date(closeDate).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-xs text-content-muted dark:text-content-muted-dark">{'\u2014'}</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 items-center">
                      {opp.contacts?.phone && (
                        <a href={`tel:${normalizePhone(opp.contacts.phone)}`} title={isRTL ? 'اتصال' : 'Call'} className="w-7 h-7 flex items-center justify-center bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg text-emerald-500 no-underline hover:bg-emerald-500/[0.15] transition-colors">
                          <Phone size={13} />
                        </a>
                      )}
                      {opp.contacts?.phone && (
                        <a href={`https://wa.me/${normalizePhone(opp.contacts.phone).replace('+', '')}`} target="_blank" rel="noreferrer" title="WhatsApp" className="w-7 h-7 flex items-center justify-center bg-[#25D366]/[0.08] border border-[#25D366]/20 rounded-lg text-[#25D366] no-underline hover:bg-[#25D366]/[0.15] transition-colors">
                          <MessageCircle size={13} />
                        </a>
                      )}
                      <div className="relative" ref={openMenuId === opp.id ? menuRef : undefined}>
                        <button onClick={() => setOpenMenuId(openMenuId === opp.id ? null : opp.id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${openMenuId === opp.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'}`}>
                          <MoreVertical size={13} />
                        </button>
                        {openMenuId === opp.id && (
                          <div className={`absolute top-[32px] ${isRTL ? 'start-0' : 'end-0'} bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[160px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden`}>
                            <div className="p-1">
                              <button onClick={() => { selectOpp(opp); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                {isRTL ? 'فتح التفاصيل' : 'View Details'}
                              </button>
                              {perms.canDeleteOpps && (
                                <button onClick={() => { handleDelete(opp.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
                                  <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {gridPaged.length === 0 && (
        <div className="text-center py-10 text-xs text-content-muted dark:text-content-muted-dark">
          {isRTL ? '\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C' : 'No results'}
        </div>
      )}
    </Card>
    {/* Table Pagination */}
    <Pagination
      page={gridSafePage}
      totalPages={gridTotalPages}
      onPageChange={setGridPage}
      pageSize={pageSize}
      onPageSizeChange={(s) => { setPageSize(s); setGridPage(1); }}
      totalItems={sortedFiltered.length}
      safePage={gridSafePage}
    />
  </>);
}
