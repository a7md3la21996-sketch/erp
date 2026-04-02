import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Phone, MessageCircle, Search, Ban, Pin, PhoneCall, Merge, MoreVertical, Bell, FileDown, Trash2, Zap, X, Pencil } from 'lucide-react';
import {
  SOURCE_LABELS, SOURCE_EN,
  TYPE,
  daysSince, initials, avatarColor, normalizePhone,
  Chip, PhoneCell, getDeptStages, deptStageLabel,
} from './constants';
import { Button, Pagination } from '../../../components/ui';
import { thCls } from '../../../utils/tableStyles';

function FixedDropdown({ btnRef, isOpen, isRTL, children }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!isOpen || !btnRef?.current) { setPos(null); return; }
    const rect = btnRef.current.getBoundingClientRect();
    // Skip if element is hidden (display:none gives 0-size rect)
    if (rect.width === 0 && rect.height === 0) { setPos(null); return; }
    const menuW = 200;
    let left = isRTL ? rect.left : rect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    let top = rect.bottom + 4;
    if (top + 240 > window.innerHeight) top = Math.max(8, rect.top - 240);
    setPos({ top, left });
  }, [isOpen, btnRef, isRTL]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div data-menu-dropdown="true" onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[190px] shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden">
      {children}
    </div>,
    document.body
  );
}

export default function ContactsTable({
  loading,
  filtered,
  paged,
  pinnedIds,
  selectedIds,
  selectedIdSet,
  mergeMode,
  setMergeMode,
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
  onEdit,
  perms = {},
  tdCls,
  // Pagination
  safePage,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
  isRTL,
  isSalesAgent,
  isAdmin,
}) {
  const { t } = useTranslation();
  const menuBtnRefs = useRef({});
  const getMenuBtnRef = useCallback((id) => (el) => { if (el) menuBtnRefs.current[id] = el; else delete menuBtnRefs.current[id]; }, []);
  const DEPT_LABELS = isRTL ? { sales:'مبيعات', hr:'HR', finance:'مالية', marketing:'تسويق', operations:'عمليات' } : { sales:'Sales', hr:'HR', finance:'Finance', marketing:'Marketing', operations:'Ops' };

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      // Don't close if clicking the toggle button itself
      const mKey = `m-${openMenuId}`;
      const dKey = `d-${openMenuId}`;
      if (menuBtnRefs.current[mKey]?.contains(e.target) || menuBtnRefs.current[dKey]?.contains(e.target)) return;
      // Don't close if clicking inside the dropdown menu (portal)
      if (e.target.closest?.('[data-menu-dropdown]')) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId, setOpenMenuId]);

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
            <button onClick={() => { setMergeTargets([]); setMergeMode(false); }} className="px-3.5 py-1.5 bg-transparent border border-edge dark:border-edge-dark rounded-md text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
      {/* ═══ MOBILE CARD VIEW ═══ */}
      <div className="md:hidden pb-16">
        {loading ? (
          <div className="text-center p-10 text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (paged || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[rgba(27,51,71,0.08)] to-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
              <Search size={28} color="#4A7AAB" strokeWidth={1.5} />
            </div>
            <p className="m-0 mb-1.5 font-bold text-sm text-content dark:text-content-dark">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
          </div>
        ) : (
          <div className="divide-y divide-edge/50 dark:divide-edge-dark/50">
            {(paged || []).map(c => {
              const typeInfo = TYPE[c.contact_type];
              const typeBorderColor = typeInfo?.color || '#4A7AAB';
              return (
                <div key={c.id}
                  onClick={() => setSelected(c)}
                  className={`px-4 py-3 cursor-pointer active:bg-surface-bg dark:active:bg-brand-500/[0.06]`}
                  style={{ borderInlineStart: `3px solid ${c.is_blacklisted ? '#EF4444' : typeBorderColor}` }}
                >
                  {/* Row 1: Avatar + Name + Call/WA buttons */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{ background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : avatarColor(c.id), color: c.is_blacklisted ? '#EF4444' : '#fff' }}>
                      {c.is_blacklisted ? <Ban size={15} /> : initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold text-sm block truncate ${c.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                        {c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                      </span>
                      <div className="mt-0.5" onClick={e => e.stopPropagation()}><PhoneCell phone={c.phone} small /></div>
                      {c.phone2 && <div onClick={e => e.stopPropagation()}><PhoneCell phone={c.phone2} small /></div>}
                    </div>
                    {/* Call + WhatsApp buttons */}
                    <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        {c.phone && (
                          <a href={`tel:${normalizePhone(c.phone)}`} className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 no-underline">
                            <Phone size={16} />
                          </a>
                        )}
                        {c.phone && (
                          <a href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl text-[#25D366] no-underline">
                            <MessageCircle size={16} />
                          </a>
                        )}
                      </div>
                      {c.phone2 && (
                        <div className="flex gap-1.5">
                          <a href={`tel:${normalizePhone(c.phone2)}`} className="w-10 h-10 flex items-center justify-center bg-emerald-500/8 border border-emerald-500/15 rounded-xl text-emerald-400 no-underline">
                            <Phone size={14} />
                          </a>
                          <a href={`https://wa.me/${normalizePhone(c.phone2).replace('+', '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center bg-[#25D366]/8 border border-[#25D366]/15 rounded-xl text-[#25D366]/70 no-underline">
                            <MessageCircle size={14} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Row 2: Tags */}
                  <div className="flex items-center gap-1.5 mt-2 ms-[52px] flex-wrap">
                    {typeInfo && <Chip label={isRTL ? typeInfo.label : typeInfo.labelEn} color={typeInfo.color} bg={typeInfo.bg} />}
                    {!isSalesAgent && c.assigned_to_name && <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/[0.06] text-brand-500 font-medium">{c.assigned_to_name}</span>}
                    {c.last_activity_at && (() => { const d = daysSince(c.last_activity_at); return <span className={`text-[10px] font-semibold ${d === 0 ? 'text-brand-500' : d <= 3 ? 'text-[#6B8DB5]' : 'text-red-500'}`}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' يوم' : d + 'd')}</span>; })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ DESKTOP TABLE VIEW ═══ */}
      <div className="hidden md:block overflow-x-auto">
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[500px]">
          <thead>
            <tr>
              <th className={`${thCls} w-9 !px-2.5`}><input type="checkbox" checked={paged.length > 0 && paged.every(c => selectedIdSet.has(c.id))} onChange={toggleSelectAll} className="cursor-pointer" /></th>
              <th className={thCls}>{isRTL ? 'جهة الاتصال' : 'Contact'}</th>
              <th className={thCls}>{isRTL ? 'الهاتف' : 'Phone'}</th>
              {!isSalesAgent && <th className={`${thCls} hidden md:table-cell`}>{isRTL ? 'المسؤول' : 'Assigned To'}</th>}
              <th className={`${thCls} hidden lg:table-cell`}>{isRTL ? 'المصدر / التاريخ' : 'Source / Date'}</th>
              <th className={`${thCls} hidden lg:table-cell`}>{isRTL ? 'آخر فيدباك' : 'Last Feedback'}</th>
              <th className={`${thCls} text-center`}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center p-10 text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-0 border-none">
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
                          {c.prefix ? `${c.prefix} ` : ''}{c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                        </span>
                        {c.contact_number && <span className="text-[9px] font-mono text-content-muted dark:text-content-muted-dark bg-surface-bg dark:bg-surface-bg-dark px-1.5 py-px rounded">{c.contact_number}</span>}
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

                {/* Assigned To — admin sees all names, TL/manager sees single name */}
                {!isSalesAgent && <td className={`${tdCls} hidden md:table-cell`}>
                  {isAdmin && Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.assigned_to_names.map((name, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${i === 0 ? 'bg-brand-500/10 text-brand-500' : 'bg-surface-bg dark:bg-surface-bg-dark text-content-muted dark:text-content-muted-dark'}`}>{name}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-content dark:text-content-dark">{c.assigned_to_name || '—'}</span>
                  )}
                </td>}

                {/* Source + Date */}
                <td className={`${tdCls} hidden lg:table-cell`}>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark">{c.source ? (isRTL ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)) : '—'}</div>
                  {c.campaign_name && <div className="text-[10px] text-brand-500/70 dark:text-brand-400/70 mt-0.5 truncate max-w-[160px]" title={c.campaign_name}>{c.campaign_name}</div>}
                  {c.created_at && <div className="text-[10px] text-content-muted/60 dark:text-content-muted-dark/60 mt-0.5">{new Date(c.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(c.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>}
                  {c.notes && (
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark truncate max-w-[150px] block mt-0.5">
                      📝 {c.notes.slice(0, 40)}{c.notes.length > 40 ? '...' : ''}
                    </span>
                  )}
                </td>

                {/* Last Feedback */}
                <td className={`${tdCls} hidden lg:table-cell`}>
                  {c._lastNote ? (
                    <div className="max-w-[180px]">
                      <p className="m-0 text-[11px] text-content dark:text-content-dark truncate" title={c._lastNote.notes}>{c._lastNote.notes}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-content-muted dark:text-content-muted-dark">
                        <span>{c._lastNote.user_name_en || c._lastNote.user_name_ar || ''}</span>
                        {c._lastNote.created_at && <span>· {new Date(c._lastNote.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                  ) : <span className="text-content-muted/50 dark:text-content-muted-dark/50 text-[11px]">—</span>}
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
                    <div onClick={e => e.stopPropagation()}>
                      <button ref={getMenuBtnRef(`d-${c.id}`)} onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${openMenuId === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'}`}>
                        <MoreVertical size={13} />
                      </button>
                      <FixedDropdown btnRef={{ current: menuBtnRefs.current[`d-${c.id}`] }} isOpen={openMenuId === c.id} isRTL={isRTL}>
                        <div className="p-1">
                          <button onClick={() => { onEdit?.(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                            <Pencil size={13} className="text-brand-500" /> {isRTL ? 'تعديل' : 'Edit'}
                          </button>
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
                      </FixedDropdown>
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
