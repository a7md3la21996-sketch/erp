import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, Search, Ban, Pin, PhoneCall, Merge, MoreVertical, Bell, FileDown, Trash2, Zap, X } from 'lucide-react';
import {
  SOURCE_LABELS, SOURCE_EN,
  TYPE,
  daysSince, initials, avatarColor, normalizePhone,
  Chip, PhoneCell, getDeptStages, deptStageLabel,
} from './constants';
import { Button, Pagination } from '../../../components/ui';
import { thCls } from '../../../utils/tableStyles';

export default function ContactsTable({
  loading,
  filtered,
  paged,
  pinnedIds,
  selectedIds,
  selectedIdSet,
  mergeMode,
  mergeTargets,
  setMergeTargets,
  MERGE_LIMIT,
  openMenuId,
  setOpenMenuId,
  quickActionTarget,
  setQuickActionTarget,
  setQuickActionForm,
  setSelected,
  toggleSelect,
  toggleSelectAll,
  togglePin,
  MAX_PINS,
  setLogCallTarget,
  setReminderTarget,
  setBlacklistTarget,
  setDisqualifyModal,
  setDqReason,
  setDqNote,
  handleDelete,
  setMergePreview,
  perms = {},
  tdCls,
  // Pagination
  safePage,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
  isRTL,
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl overflow-hidden">
      {mergeMode && (
        <div className="px-4 py-2.5 bg-brand-800/[0.06] dark:bg-brand-800/[0.12] border-b border-edge dark:border-edge-dark flex items-center gap-2.5 justify-between">
          <span className="text-xs font-semibold text-brand-800">
            <Merge size={14} className="align-middle me-1.5 inline" />
            {isRTL ? `اختر جهتي اتصال للدمج (${mergeTargets.length}/2)` : `Select 2 contacts to merge (${mergeTargets.length}/2)`}
          </span>
          <div className="flex gap-2">
            {mergeTargets.length === 2 && (
              <Button size="sm" onClick={() => setMergePreview(mergeTargets)}>
                {isRTL ? 'معاينة الدمج' : 'Preview Merge'}
              </Button>
            )}
            <button onClick={() => { /* handled by parent */ }} className="px-3.5 py-1.5 bg-transparent border border-edge dark:border-edge-dark rounded-md text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
      {/* ═══ MOBILE CARD VIEW ═══ */}
      <div className="md:hidden">
        {loading ? (
          <div className="text-center p-10 text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[rgba(27,51,71,0.08)] to-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
              <Search size={28} color="#4A7AAB" strokeWidth={1.5} />
            </div>
            <p className="m-0 mb-1.5 font-bold text-sm text-content dark:text-content-dark">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
          </div>
        ) : (
          <div className="divide-y divide-edge/50 dark:divide-edge-dark/50">
            {paged.map(c => {
              const isPinned = pinnedIds.includes(c.id);
              const typeInfo = TYPE[c.contact_type];
              const typeBorderColor = typeInfo?.color || '#4A7AAB';
              const DEPT_LABELS_M = isRTL ? { sales:'مبيعات', hr:'HR', finance:'مالية', marketing:'تسويق', operations:'عمليات' } : { sales:'Sales', hr:'HR', finance:'Finance', marketing:'Marketing', operations:'Ops' };
              return (
                <div key={c.id}
                  onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < MERGE_LIMIT ? [...prev, c.id] : prev) : setSelected(c)}
                  className={`px-4 py-3.5 cursor-pointer transition-colors ${selectedIds.includes(c.id) ? 'bg-brand-500/[0.08]' : c.is_blacklisted ? 'bg-red-500/[0.03]' : 'active:bg-surface-bg dark:active:bg-brand-500/[0.06]'}`}
                  style={{ borderInlineStart: `3px solid ${c.is_blacklisted ? '#EF4444' : typeBorderColor}` }}
                >
                  {/* Row 1: Avatar + Name + Actions */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{ background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : avatarColor(c.id), color: c.is_blacklisted ? '#EF4444' : '#fff' }}>
                      {c.is_blacklisted ? <Ban size={15} /> : initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis ${c.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                          {c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                        </span>
                        {isPinned && <Pin size={10} color="#F59E0B" className="shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {typeInfo && <Chip label={isRTL ? typeInfo.label : typeInfo.labelEn} color={typeInfo.color} bg={typeInfo.bg} />}
                        {c.department && <span className="text-[10px] px-2 py-px rounded-full bg-brand-500/[0.06] text-[#6B8DB5] font-medium">{DEPT_LABELS_M[c.department] || c.department}</span>}
                        <span className={`text-[10px] px-2 py-px rounded-full font-medium ${c.contact_status === 'disqualified' ? 'bg-red-500/10 text-red-500' : (!c.contact_status || c.contact_status === 'new') ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>{c.contact_status === 'disqualified' ? (isRTL ? 'غير مؤهل' : 'DQ') : (!c.contact_status || c.contact_status === 'new') ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'تم التواصل' : 'Contacted')}</span>
                        {c.last_activity_at && (() => { const d = daysSince(c.last_activity_at); return <span className={`text-[10px] font-semibold ${d === 0 ? 'text-brand-500' : d <= 3 ? 'text-[#6B8DB5]' : 'text-red-500'}`}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' يوم' : d + 'd ago')}</span>; })()}
                      </div>
                    </div>
                    {/* Quick actions */}
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); setQuickActionTarget(quickActionTarget?.id === c.id ? null : c); setQuickActionForm({ type: 'call', result: '', description: '' }); }} title={isRTL ? 'إجراء سريع' : 'Quick Action'}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${quickActionTarget?.id === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 hover:bg-brand-500/[0.15]'}`}>
                        <Zap size={14} />
                      </button>
                      {c.phone && (
                        <a href={`tel:${normalizePhone(c.phone)}`} className="w-8 h-8 flex items-center justify-center bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg text-emerald-500 no-underline">
                          <Phone size={14} />
                        </a>
                      )}
                      {c.phone && (
                        <a href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center bg-[#25D366]/[0.08] border border-[#25D366]/20 rounded-lg text-[#25D366] no-underline">
                          <MessageCircle size={14} />
                        </a>
                      )}
                      <button onClick={() => togglePin(c.id)} disabled={!isPinned && pinnedIds.length >= MAX_PINS}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${isPinned ? 'bg-amber-500/[0.15] border border-amber-500/30 text-amber-500' : !isPinned && pinnedIds.length >= MAX_PINS ? 'bg-transparent border border-edge dark:border-edge-dark text-content-muted/30 cursor-not-allowed' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'}`}>
                        <Pin size={14} />
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${openMenuId === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'}`}>
                          <MoreVertical size={14} />
                        </button>
                        {openMenuId === c.id && (
                          <div className={`absolute top-[36px] ${isRTL ? 'start-0' : 'end-0'} bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[190px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden`}>
                            <div className="p-1">
                              <button onClick={() => { setLogCallTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <PhoneCall size={13} className="text-brand-500" /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'}
                              </button>
                              <button onClick={() => { setReminderTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <Bell size={13} className="text-amber-500" /> {isRTL ? 'تذكير' : 'Reminder'}
                              </button>
                              <button onClick={() => { const hdr = isRTL ? ['الاسم','الهاتف','النوع','المصدر'] : ['Name','Phone','Type','Source']; const data = [hdr,[c.full_name,c.phone,c.contact_type,c.source]]; const csv = '\uFEFF'+data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <FileDown size={13} className="text-content-muted dark:text-content-muted-dark" /> {isRTL ? 'تصدير' : 'Export'}
                              </button>
                              <button onClick={() => { handleDelete(c.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <Trash2 size={13} className="text-content-muted dark:text-content-muted-dark" /> {isRTL ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                            {!c.is_blacklisted && (<><div className="h-px bg-edge dark:bg-edge-dark mx-1" /><div className="p-1">
                              <button onClick={() => { setBlacklistTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
                                <Ban size={13} /> {isRTL ? 'بلاك ليست' : 'Blacklist'}
                              </button>
                            </div></>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Phone + Source + Date */}
                  {(c.phone || c.source) && (
                    <div className="flex items-center gap-3 mt-2 ms-[52px] text-[11px] text-content-muted dark:text-content-muted-dark">
                      {c.phone && <span className="font-mono">{c.phone.slice(0, 6)}****</span>}
                      {c.source && <><span className="opacity-30">·</span><span>{isRTL ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)}</span></>}
                      {c.campaign_name && <><span className="opacity-30">·</span><span className="text-brand-500/70 dark:text-brand-400/70">{c.campaign_name}</span></>}
                      {c.created_at && <><span className="opacity-30">·</span><span>{new Date(c.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })} {new Date(c.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span></>}
                    </div>
                  )}
                  {/* Opps / Sales + Stages on mobile */}
                  {c.opportunities?.length > 0 && (() => {
                    const opps = c.opportunities;
                    const dept = c.department || 'sales';
                    const stages = getDeptStages(dept);
                    const byAgent = {};
                    opps.forEach(o => {
                      const aid = o.assigned_to || o.assigned_to_name || 'u';
                      const name = o.users ? (isRTL ? (o.users.full_name_ar || o.users.full_name_en) : (o.users.full_name_en || o.users.full_name_ar)) : (o.assigned_to_name || '?');
                      const si = stages.findIndex(s => s.id === o.stage);
                      if (!byAgent[aid] || si > byAgent[aid].si) byAgent[aid] = { name, stage: o.stage, si: si >= 0 ? si : 0 };
                    });
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ms-[52px]">
                        {Object.values(byAgent).slice(0, 2).map((e, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-px rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                            {e.name}: {deptStageLabel(e.stage, dept, isRTL)}
                          </span>
                        ))}
                        {Object.values(byAgent).length > 2 && <span className="text-[9px] text-content-muted dark:text-content-muted-dark">+{Object.values(byAgent).length - 2}</span>}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ DESKTOP TABLE VIEW ═══ */}
      <div className="hidden md:block overflow-x-auto">
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className={`${thCls} w-9 !px-2.5`}><input type="checkbox" checked={paged.length > 0 && paged.every(c => selectedIdSet.has(c.id))} onChange={toggleSelectAll} className="cursor-pointer" /></th>
              <th className={thCls}>{isRTL ? 'جهة الاتصال' : 'Contact'}</th>
              <th className={thCls}>{isRTL ? 'الهاتف' : 'Phone'}</th>
              <th className={thCls}>{isRTL ? 'المصدر / التاريخ' : 'Source / Date'}</th>
              <th className={thCls}>{isRTL ? 'الفرص / السيلز' : 'Opps / Sales'}</th>
              <th className={`${thCls} text-center`}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center p-10 text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-0 border-none">
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[rgba(27,51,71,0.08)] to-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
                    <Search size={28} color="#4A7AAB" strokeWidth={1.5} />
                  </div>
                  <p className="m-0 mb-1.5 font-bold text-sm text-content dark:text-content-dark">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'جرّب البحث بكلمات مختلفة' : 'Try searching with different keywords'}</p>
                </div>
              </td></tr>
            ) : paged.map((c) => {
              const isPinned = pinnedIds.includes(c.id);
              const isMergeSelected = mergeTargets.includes(c.id);
              const typeInfo = TYPE[c.contact_type];
              const typeBorderColor = typeInfo?.color || '#4A7AAB';
              const DEPT_LABELS = isRTL ? { sales:'مبيعات', hr:'HR', finance:'مالية', marketing:'تسويق', operations:'عمليات' } : { sales:'Sales', hr:'HR', finance:'Finance', marketing:'Marketing', operations:'Ops' };
              return (
              <tr key={c.id}
                onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < MERGE_LIMIT ? [...prev, c.id] : prev) : setSelected(c)}
                className={`group cursor-pointer transition-colors ${isMergeSelected ? 'bg-brand-800/[0.08]' : selectedIds.includes(c.id) ? 'bg-brand-500/[0.08]' : c.is_blacklisted ? 'bg-red-500/[0.03]' : 'hover:bg-surface-bg dark:hover:bg-brand-500/[0.04]'}`}
                style={{ borderInlineStart: `3px solid ${c.is_blacklisted ? '#EF4444' : typeBorderColor}` }}
              >
                {/* Checkbox */}
                <td className={`${tdCls} !px-2.5 w-9`} onClick={e => e.stopPropagation()}>
                  <div className={`${selectedIds.includes(c.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} className="cursor-pointer" />
                  </div>
                </td>

                {/* Contact — Name + Type + Dept + Activity */}
                <td className={tdCls}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : avatarColor(c.id), color: c.is_blacklisted ? '#EF4444' : '#fff' }}>
                      {c.is_blacklisted ? <Ban size={14} /> : initials(c.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] ${c.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                          {c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                        </span>
                        {isPinned && <Pin size={10} color="#F59E0B" className="shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {typeInfo && <Chip label={isRTL ? typeInfo.label : typeInfo.labelEn} color={typeInfo.color} bg={typeInfo.bg} />}
                        {c.department && <span className="text-[10px] px-2 py-px rounded-full bg-brand-500/[0.06] text-[#6B8DB5] font-medium">{DEPT_LABELS[c.department] || c.department}</span>}
                        {c.last_activity_at && (() => { const d = daysSince(c.last_activity_at); return <span className={`text-[10px] font-semibold ${d === 0 ? 'text-brand-500' : d <= 3 ? 'text-[#6B8DB5]' : 'text-red-500'}`}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' يوم' : d + 'd ago')}</span>; })()}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Phone */}
                <td className={tdCls} onClick={e => e.stopPropagation()}>
                  <PhoneCell phone={c.phone} />
                  {c.phone2 && <PhoneCell phone={c.phone2} small />}
                </td>

                {/* Source + Date */}
                <td className={tdCls}>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark">{c.source ? (isRTL ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)) : '—'}</div>
                  {c.campaign_name && <div className="text-[10px] text-brand-500/70 dark:text-brand-400/70 mt-0.5 truncate max-w-[160px]" title={c.campaign_name}>{c.campaign_name}</div>}
                  {c.created_at && <div className="text-[10px] text-content-muted/60 dark:text-content-muted-dark/60 mt-0.5">{new Date(c.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(c.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>}
                </td>

                {/* Opps / Sales Assignees + Stages */}
                <td className={tdCls}>
                  {(() => {
                    const opps = c.opportunities || [];
                    if (!opps.length) return <span className="text-content-muted/50 dark:text-content-muted-dark/50 text-[11px]">—</span>;
                    const dept = c.department || 'sales';
                    const stages = getDeptStages(dept);
                    // Group by sales agent: { agentId: { name, bestStage, bestIdx } }
                    const byAgent = {};
                    opps.forEach(o => {
                      const aid = o.assigned_to || o.assigned_to_name || 'unassigned';
                      const name = o.users ? (isRTL ? (o.users.full_name_ar || o.users.full_name_en) : (o.users.full_name_en || o.users.full_name_ar)) : (o.assigned_to_name || (isRTL ? 'غير معين' : 'Unassigned'));
                      const stageIdx = stages.findIndex(s => s.id === o.stage);
                      if (!byAgent[aid] || stageIdx > byAgent[aid].bestIdx) {
                        byAgent[aid] = { name, stage: o.stage, bestIdx: stageIdx >= 0 ? stageIdx : 0, oppCount: (byAgent[aid]?.oppCount || 0) + 1 };
                      } else {
                        byAgent[aid].oppCount++;
                      }
                    });
                    const entries = Object.values(byAgent);
                    const STAGE_COLORS = { closed_won: '#10B981', closed_lost: '#EF4444', contracted: '#10B981', reserved: '#1B3347', negotiation: '#F59E0B', proposal: '#4A7AAB', qualification: '#6B8DB5' };
                    const getStageColor = (stageId) => STAGE_COLORS[stageId] || stages.find(s => s.id === stageId)?.color || '#6B8DB5';
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {entries.slice(0, 3).map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1 }}>
                            <span className="text-[10px] font-semibold text-content dark:text-content-dark truncate max-w-[80px]" title={e.name}>{e.name}</span>
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${getStageColor(e.stage)}18`, border: `1px solid ${getStageColor(e.stage)}30`, color: getStageColor(e.stage), fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {deptStageLabel(e.stage, dept, isRTL)}
                            </span>
                            {e.oppCount > 1 && <span className="text-[9px] text-content-muted dark:text-content-muted-dark">×{e.oppCount}</span>}
                          </div>
                        ))}
                        {entries.length > 3 && <span className="text-[9px] text-content-muted dark:text-content-muted-dark">+{entries.length - 3} {isRTL ? 'أخرى' : 'more'}</span>}
                      </div>
                    );
                  })()}
                </td>

                {/* Actions — 3 visible + menu */}
                <td className={tdCls} onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 items-center justify-center">
                    {c.phone && (
                      <a href={`tel:${normalizePhone(c.phone)}`} title={isRTL ? "اتصال" : "Call"} className="w-7 h-7 flex items-center justify-center bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg text-emerald-500 no-underline hover:bg-emerald-500/[0.15] transition-colors">
                        <Phone size={13} />
                      </a>
                    )}
                    {c.phone && (
                      <a href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`} target="_blank" rel="noreferrer" title="WhatsApp" className="w-7 h-7 flex items-center justify-center bg-[#25D366]/[0.08] border border-[#25D366]/20 rounded-lg text-[#25D366] no-underline hover:bg-[#25D366]/[0.15] transition-colors">
                        <MessageCircle size={13} />
                      </a>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setQuickActionTarget(quickActionTarget?.id === c.id ? null : c); setQuickActionForm({ type: 'call', result: '', description: '' }); }} title={isRTL ? 'إجراء سريع' : 'Quick Action'}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${quickActionTarget?.id === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 hover:bg-brand-500/[0.15]'}`}>
                      <Zap size={13} />
                    </button>
                    <button onClick={() => togglePin(c.id)} title={isPinned ? (isRTL ? 'إلغاء التثبيت' : 'Unpin') : pinnedIds.length >= MAX_PINS ? (isRTL ? `الحد الأقصى ${MAX_PINS} مثبتين` : `Max ${MAX_PINS} pins`) : (isRTL ? 'تثبيت' : 'Pin')} disabled={!isPinned && pinnedIds.length >= MAX_PINS} className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${isPinned ? 'bg-amber-500/[0.15] border border-amber-500/30 text-amber-500' : !isPinned && pinnedIds.length >= MAX_PINS ? 'bg-transparent border border-edge dark:border-edge-dark text-content-muted/30 dark:text-content-muted-dark/30 cursor-not-allowed' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'}`}>
                      <Pin size={13} />
                    </button>
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${openMenuId === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'}`}>
                        <MoreVertical size={13} />
                      </button>
                      {openMenuId === c.id && (
                        <div className={`absolute top-[32px] end-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[190px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden`}>
                          <div className="p-1">
                            <button onClick={() => { setLogCallTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                              <PhoneCall size={13} className="text-brand-500" /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'}
                            </button>
                            <button onClick={() => { setReminderTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                              <Bell size={13} className="text-amber-500" /> {isRTL ? 'تذكير' : 'Reminder'}
                            </button>
                            {perms.canExportContacts && (
                              <button onClick={() => { const hdr = isRTL ? ['الاسم','الهاتف','النوع','المصدر','الميزانية'] : ['Name','Phone','Type','Source','Budget']; const data = [hdr,[c.full_name,c.phone,c.contact_type,c.source,(c.budget_min||'')+'–'+(c.budget_max||'')]]; const csv = '\uFEFF'+data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <FileDown size={13} className="text-content-muted dark:text-content-muted-dark" /> {isRTL ? 'تصدير' : 'Export'}
                              </button>
                            )}
                            {perms.canDeleteContacts && (
                              <button onClick={() => { handleDelete(c.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <Trash2 size={13} className="text-content-muted dark:text-content-muted-dark" /> {isRTL ? 'حذف' : 'Delete'}
                              </button>
                            )}
                          </div>
                          {(perms.canDeleteContacts || perms.canEditContact?.(c)) && <>
                          <div className="h-px bg-edge dark:bg-edge-dark mx-1" />
                          <div className="p-1">
                            {perms.canEditContact?.(c) && c.contact_status !== 'disqualified' && (
                              <button onClick={() => { setDisqualifyModal(c); setDqReason(''); setDqNote(''); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-amber-600 font-inherit hover:bg-amber-500/[0.05]">
                                <X size={13} /> {isRTL ? 'غير مؤهل' : 'Disqualify'}
                              </button>
                            )}
                            {perms.canDeleteContacts && !c.is_blacklisted && (
                              <button onClick={() => { setBlacklistTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
                                <Ban size={13} /> {isRTL ? 'بلاك ليست' : 'Blacklist'}
                              </button>
                            )}
                          </div>
                          </>}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={filtered.length}
      />
    </div>
  );
}
