import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, Pin, MoreVertical, PhoneCall, Mail, FileText, Ban, Users, Megaphone } from 'lucide-react';
import { TYPE, TEMP, normalizePhone, agentInitials, PhoneCell } from './constants';
import { Pagination } from '../../../components/ui';

// Mobile-first card view of the contacts list. Same data and handlers as
// ContactsTable, but laid out as stacked cards with thumb-friendly action
// buttons. Renders below `md:` breakpoint; the table takes over above.

const STATUS_LABELS_AR = {
  new: 'جديد', following: 'متابعة', contacted: 'تم التواصل',
  has_opportunity: 'لديه فرصة', disqualified: 'غير مؤهل',
};
const STATUS_LABELS_EN = {
  new: 'New', following: 'Following', contacted: 'Contacted',
  has_opportunity: 'Has Opp', disqualified: 'DQ',
};
const STATUS_COLORS = {
  new: '#4A7AAB', following: '#10B981', contacted: '#F59E0B',
  has_opportunity: '#059669', disqualified: '#6b7280',
};

function timeAgo(dateStr, isRTL) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const day = 86400000;
  const days = Math.floor(diff / day);
  if (days === 0) return isRTL ? 'اليوم' : 'today';
  if (days === 1) return isRTL ? 'أمس' : 'yesterday';
  if (days < 7) return isRTL ? `من ${days} أيام` : `${days}d ago`;
  if (days < 30) return isRTL ? `من ${Math.floor(days / 7)} أسابيع` : `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

export default function ContactsCardList({
  loading,
  paged,
  pinnedIds,
  selectedIdSet,
  mergeMode,
  mergeTargets,
  setMergeTargets,
  MERGE_LIMIT,
  setSelected,
  toggleSelect,
  togglePin,
  MAX_PINS,
  setLogCallTarget,
  setBlacklistTarget,
  setDisqualifyModal,
  setDqReason,
  setDqNote,
  handleDelete,
  perms = {},
  isRTL,
  // Pagination
  safePage,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
  totalContacts,
  filtered,
}) {
  const { t } = useTranslation();
  const statusLabels = isRTL ? STATUS_LABELS_AR : STATUS_LABELS_EN;

  if (loading) {
    return (
      <div className="space-y-2 p-3" aria-busy="true" aria-label={isRTL ? 'جاري التحميل' : 'Loading'}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-36 bg-surface-bg dark:bg-surface-bg-dark animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!paged?.length) {
    return (
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl">
        <div className="text-center py-16 text-content-muted dark:text-content-muted-dark text-sm">
          {isRTL ? 'لا توجد عملاء' : 'No contacts'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl overflow-hidden">
      <ul className="space-y-2 p-2">
        {paged.map(c => {
          const isSelected = selectedIdSet?.has?.(c.id);
          const isPinned = pinnedIds?.includes?.(c.id);
          const inMerge = mergeMode && mergeTargets?.includes?.(c.id);
          const tempData = c.temperature ? TEMP[c.temperature] : null;
          const status = c.contact_status || 'new';
          const statusColor = STATUS_COLORS[status] || STATUS_COLORS.new;
          const typeData = c.contact_type ? TYPE[c.contact_type] : null;
          const last = timeAgo(c.last_activity_at, isRTL);

          return (
            <li key={c.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => mergeMode
                  ? setMergeTargets(prev => prev.includes(c.id)
                      ? prev.filter(x => x !== c.id)
                      : prev.length < MERGE_LIMIT ? [...prev, c.id] : prev)
                  : setSelected(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (mergeMode) {
                      setMergeTargets(prev => prev.includes(c.id)
                        ? prev.filter(x => x !== c.id)
                        : prev.length < MERGE_LIMIT ? [...prev, c.id] : prev);
                    } else {
                      setSelected(c);
                    }
                  }
                }}
                className={`relative bg-surface-card dark:bg-surface-card-dark border rounded-xl p-3.5 cursor-pointer transition-shadow hover:shadow-md ${
                  isSelected || inMerge
                    ? 'border-brand-500 ring-2 ring-brand-500/20'
                    : 'border-edge dark:border-edge-dark'
                }`}
              >
                {/* Top row: select + name + temp + pin badge */}
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={() => toggleSelect(c.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 w-5 h-5 cursor-pointer accent-brand-500"
                    aria-label={isRTL ? `تحديد ${c.full_name || ''}` : `Select ${c.full_name || ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-sm text-content dark:text-content-dark truncate">
                        {c.full_name || (isRTL ? '— بدون اسم —' : '— No Name —')}
                      </span>
                      {tempData?.Icon && (
                        <span
                          title={isRTL ? tempData.labelAr : tempData.label}
                          aria-label={isRTL ? `حرارة: ${tempData.labelAr}` : `Temperature: ${tempData.label}`}
                          className="inline-flex items-center"
                          style={{ color: tempData.color }}
                        >
                          <tempData.Icon size={14} />
                        </span>
                      )}
                      {c.is_blacklisted && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                          <Ban size={10} /> BL
                        </span>
                      )}
                    </div>
                    {/* Masked phone (tap to reveal) + source + type */}
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                      {c.phone ? (
                        <span onClick={e => e.stopPropagation()} className="inline-flex">
                          <PhoneCell phone={c.phone} small />
                        </span>
                      ) : (
                        <span>{isRTL ? 'بدون رقم' : 'no phone'}</span>
                      )}
                      {c.source && <span className="opacity-60">· {c.source}</span>}
                      {typeData && <span className="opacity-60">· {isRTL ? typeData.label : typeData.labelEn}</span>}
                    </div>
                    {/* Campaign — shown when present so the agent knows where the lead came from */}
                    {c.campaign_name && (
                      <div className="text-[11px] text-brand-500 dark:text-brand-400 mt-1 flex items-center gap-1 truncate">
                        <Megaphone size={11} className="shrink-0" />
                        <span className="truncate">{c.campaign_name}</span>
                      </div>
                    )}
                  </div>
                  {isPinned && (
                    <Pin size={14} className="text-amber-500 shrink-0 mt-0.5" fill="currentColor" aria-label={isRTL ? 'مثبت' : 'Pinned'} />
                  )}
                </div>

                {/* Status / Score row */}
                <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
                  <span
                    className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{ color: statusColor, background: statusColor + '18' }}
                  >
                    {statusLabels[status] || status}
                  </span>
                  {typeof c.lead_score === 'number' && c.lead_score > 0 && (
                    <span className="text-[11px] font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full">
                      {c.lead_score}/100
                    </span>
                  )}
                </div>

                {/* Meta: agent + last activity */}
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-content-muted dark:text-content-muted-dark">
                    <Users size={11} />
                    <span className="truncate max-w-[140px]">
                      {c.assigned_to_name || (isRTL ? 'غير معين' : 'Unassigned')}
                    </span>
                  </div>
                  {last && (
                    <span className="text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                      {isRTL ? 'آخر نشاط: ' : 'Last: '}{last}
                    </span>
                  )}
                </div>

                {/* Action buttons row — 44px touch targets */}
                <div className="flex gap-1.5 mt-3" onClick={e => e.stopPropagation()}>
                  {c.phone ? (
                    <a
                      href={`tel:${normalizePhone(c.phone)}`}
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold no-underline active:scale-95 transition-transform"
                      aria-label={isRTL ? 'اتصال' : 'Call'}
                    >
                      <Phone size={14} /> {isRTL ? 'اتصال' : 'Call'}
                    </a>
                  ) : (
                    <div role="button" aria-disabled="true" aria-label={isRTL ? 'اتصال غير متاح' : 'Call unavailable'}
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-lg bg-surface-bg dark:bg-surface-bg-dark text-content-muted dark:text-content-muted-dark text-xs cursor-not-allowed border border-edge dark:border-edge-dark opacity-50">
                      <Phone size={14} /> {isRTL ? 'اتصال' : 'Call'}
                    </div>
                  )}
                  {c.phone && (
                    <a
                      href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs font-semibold no-underline active:scale-95 transition-transform"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle size={14} /> WA
                    </a>
                  )}
                  {perms.canEditContact && c.phone && (
                    <button
                      onClick={() => setLogCallTarget?.(c)}
                      className="h-11 w-11 flex items-center justify-center rounded-lg bg-surface-bg dark:bg-brand-500/10 border border-edge dark:border-edge-dark text-content dark:text-content-dark active:scale-95 transition-transform"
                      aria-label={isRTL ? 'تسجيل مكالمة' : 'Log call'}
                      title={isRTL ? 'تسجيل مكالمة' : 'Log call'}
                    >
                      <PhoneCall size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => togglePin(c.id)}
                    disabled={!isPinned && pinnedIds.length >= MAX_PINS}
                    className={`h-11 w-11 flex items-center justify-center rounded-lg border active:scale-95 transition-transform ${
                      isPinned
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                        : 'bg-surface-bg dark:bg-brand-500/10 border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                    } ${!isPinned && pinnedIds.length >= MAX_PINS ? 'opacity-30 cursor-not-allowed' : ''}`}
                    aria-label={isPinned ? (isRTL ? 'إلغاء التثبيت' : 'Unpin') : (isRTL ? 'تثبيت' : 'Pin')}
                  >
                    <Pin size={14} fill={isPinned ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={totalContacts || filtered?.length || 0}
      />
    </div>
  );
}
