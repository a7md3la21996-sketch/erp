import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, Pin, PhoneCall, Ban, Users, Megaphone, Facebook, Instagram, Globe, UserPlus, MapPin, Sparkles, RefreshCw } from 'lucide-react';
import { TYPE, TEMP, normalizePhone, agentInitials, avatarColor, PhoneCell } from './constants';
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

// Days bucket → color. Drives the color of the "last activity" pill so
// urgency reads at a glance: green (recent) → amber → red (stale).
function lastActivityTone(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 3) return { bg: 'bg-emerald-500/12', fg: 'text-emerald-600 dark:text-emerald-400' };
  if (days <= 7) return { bg: 'bg-amber-500/15', fg: 'text-amber-600 dark:text-amber-400' };
  return { bg: 'bg-red-500/12', fg: 'text-red-500' };
}

// Map source key → brand icon + color. Falls back to a generic globe so
// unknown sources still get a visual pill instead of plain text.
const SOURCE_ICON = {
  facebook:   { Icon: Facebook,  color: '#1877F2' },
  instagram:  { Icon: Instagram, color: '#E4405F' },
  google_ads: { Icon: Globe,     color: '#4285F4' },
  website:    { Icon: Globe,     color: '#6B8DB5' },
  call:       { Icon: Phone,     color: '#10B981' },
  walk_in:    { Icon: MapPin,    color: '#92400E' },
  referral:   { Icon: UserPlus,  color: '#6B21A8' },
  developer:  { Icon: Sparkles,  color: '#0F766E' },
  cold_call:  { Icon: Phone,     color: '#94a3b8' },
  other:      { Icon: Globe,     color: '#94a3b8' },
};

// "Untouched" rule: status is `new` and no activity has ever landed.
// These are the leads that get forgotten — we surface them visually so
// they can't hide in the list.
const isUntouched = (c) => c.contact_status === 'new' && !c.last_activity_at;

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
  // Identity of the current viewer — used to suppress the "Agent: X" row
  // on cards the viewer themself owns (it's redundant for them to see
  // their own name on every lead).
  agentName,
  isSalesAgent,
  // Pull-to-refresh — async function the parent supplies; if absent the
  // gesture is disabled. Returning the promise lets us show the spinner
  // until the reload settles.
  onRefresh,
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

  // ── Pull-to-refresh ─────────────────────────────────────────────────
  // Reads window scroll because the cards live inside the page's normal
  // document scroll (not a sub-scroller). Pull only registers if scrollY=0
  // at touchstart so we don't hijack mid-list scrolling.
  const PULL_THRESHOLD = 70;
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  useEffect(() => {
    if (!onRefresh) return;
    const onTouchStart = (e) => {
      if (window.scrollY > 0) { startYRef.current = null; return; }
      startYRef.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (startYRef.current == null || refreshing) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0 && window.scrollY === 0) {
        // Damped pull: 1px finger = 0.5px indicator. Caps at 1.5x threshold
        // so the user can't keep dragging forever.
        setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD * 1.5));
      }
    };
    const onTouchEnd = async () => {
      const start = startYRef.current;
      startYRef.current = null;
      if (start == null) return;
      const fired = pullDistance >= PULL_THRESHOLD;
      setPullDistance(0);
      if (!fired || refreshing) return;
      setRefreshing(true);
      try { await onRefresh(); } finally { setRefreshing(false); }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, pullDistance, refreshing]);
  const pullRatio = Math.min(pullDistance / PULL_THRESHOLD, 1);

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
      {/* Pull-to-refresh indicator. Translates and rotates with pull, then
          spins continuously while the refresh promise is in flight. */}
      {(pullDistance > 0 || refreshing) && (
        <div
          aria-live="polite"
          className="flex items-center justify-center text-content-muted dark:text-content-muted-dark transition-all"
          style={{
            height: refreshing ? PULL_THRESHOLD : pullDistance,
            opacity: refreshing ? 1 : pullRatio,
          }}
        >
          <RefreshCw
            size={20}
            className={refreshing ? 'animate-spin' : ''}
            style={refreshing ? undefined : { transform: `rotate(${pullRatio * 270}deg)` }}
          />
          <span className="ms-2 text-[11px] font-semibold">
            {refreshing
              ? (isRTL ? 'جاري التحديث...' : 'Refreshing...')
              : pullRatio >= 1
              ? (isRTL ? 'اتركها للتحديث' : 'Release to refresh')
              : (isRTL ? 'اسحب للتحديث' : 'Pull to refresh')}
          </span>
        </div>
      )}
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
          const lastTone = lastActivityTone(c.last_activity_at);
          const sourceIcon = c.source ? SOURCE_ICON[c.source] : null;
          const untouched = isUntouched(c);
          const initials = agentInitials(c.full_name || '?');
          const avatarBg = avatarColor(c.id);

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
                {/* Top row: select + avatar + name + meta + pin */}
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={() => toggleSelect(c.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 w-5 h-5 cursor-pointer accent-brand-500"
                    aria-label={isRTL ? `تحديد ${c.full_name || ''}` : `Select ${c.full_name || ''}`}
                  />
                  {/* Avatar — colored circle with initials. Color is derived
                      from the contact id so the same lead is the same color
                      every time, making the list scannable. */}
                  <div
                    aria-hidden="true"
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: avatarBg }}
                  >
                    {initials}
                  </div>
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
                      {/* Untouched badge — surfaces leads that haven't been
                          worked yet. Most likely to slip through the cracks. */}
                      {untouched && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded animate-pulse">
                          🆕 {isRTL ? 'لم يُتصل به' : 'Untouched'}
                        </span>
                      )}
                      {c.is_blacklisted && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                          <Ban size={10} /> BL
                        </span>
                      )}
                    </div>
                    {/* Masked phone (tap to reveal) + source icon + type */}
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                      {c.phone ? (
                        <span onClick={e => e.stopPropagation()} className="inline-flex">
                          <PhoneCell phone={c.phone} small />
                        </span>
                      ) : (
                        <span>{isRTL ? 'بدون رقم' : 'no phone'}</span>
                      )}
                      {sourceIcon && (
                        <span
                          title={c.source}
                          aria-label={`Source: ${c.source}`}
                          className="inline-flex items-center"
                          style={{ color: sourceIcon.color }}
                        >
                          · <sourceIcon.Icon size={11} className="ms-1" />
                        </span>
                      )}
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

                {/* Meta: agent (only when relevant) + last activity */}
                {(() => {
                  const ownerIsViewer = agentName && c.assigned_to_name === agentName;
                  // Sales agent looking at their own assigned lead → skip the
                  // agent line entirely (redundant). Admin / manager always
                  // see it because they're looking at multiple agents'
                  // contacts. Unassigned leads always show the placeholder.
                  const showAgentRow = !c.assigned_to_name || !(isSalesAgent && ownerIsViewer);
                  if (!showAgentRow && !last) return null;
                  return (
                    <div className="flex items-center justify-between mt-2 text-[11px] gap-2">
                      {showAgentRow ? (
                        <div className="flex items-center gap-1.5 text-content-muted dark:text-content-muted-dark min-w-0">
                          <Users size={11} className="shrink-0" />
                          <span className="truncate">
                            {c.assigned_to_name || (isRTL ? 'غير معين' : 'Unassigned')}
                          </span>
                        </div>
                      ) : <span />}
                      {last && lastTone && (
                        <span
                          className={`whitespace-nowrap font-semibold px-2 py-0.5 rounded-full ${lastTone.bg} ${lastTone.fg}`}
                          title={isRTL ? `آخر نشاط: ${last}` : `Last activity: ${last}`}
                        >
                          {last}
                        </span>
                      )}
                    </div>
                  );
                })()}

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
