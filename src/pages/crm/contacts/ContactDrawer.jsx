import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import lazyRetry from '../../../utils/lazyRetry';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { logView } from '../../../services/viewTrackingService';
import { addRecentItem } from '../../../services/recentItemsService';
import { Phone, MessageCircle, Mail, Ban, X, Clock, Star, Users, FileDown, CheckSquare, Pencil, Target, Briefcase, UserCheck, Megaphone, Settings, DollarSign, ChevronDown, ChevronUp, MoreVertical, Pin, Bell, Trash2, FileText, MessageSquare, FileUp, History, Award, Send, Calendar, Check, XCircle, Building2, Plus } from 'lucide-react';

// Lazy-loaded so the recharts vendor chunk doesn't ship with every contact open.
// Wrapped with lazyRetry so stale chunk references after a deploy auto-recover
// via reload instead of surfacing "text/html is not a valid JS MIME type".
const CampaignHistoryChart = lazyRetry(() => import('./CampaignHistoryChart'));
import {
  fetchContactActivities, createActivity, updateActivity,
  fetchContactOpportunities, getAssignmentHistory,
} from '../../../services/contactsService';
import { updateOpportunity } from '../../../services/opportunitiesService';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { fetchTasks, TASK_PRIORITIES, TASK_STATUSES } from '../../../services/tasksService';
import { logInteraction } from '../../../services/interactionsService';
import { useFocusTrap, useClickOutside } from '../../../utils/hooks';
import EditContactModal from './EditContactModal';
import DistributeLeadModal from './DistributeLeadModal';
import PullOtherLeadsModal from './PullOtherLeadsModal';
import HandOffLeadModal from './HandOffLeadModal';
import TakeActionForm from './TakeActionForm';
import ContactSMSModal from './ContactSMSModal';
import ResaleUnitsTab from './ResaleUnitsTab';
import CustomFieldsRenderer from '../../../components/ui/CustomFieldsRenderer';
import DocumentsSection from '../../../components/ui/DocumentsSection';
import CommentsSection from '../../../components/ui/CommentsSection';
import { getLocalAuditLogs, ACTION_TYPES } from '../../../services/auditService';
import { notifyNewComment } from '../../../services/notificationService';
import { isFavorite as checkFavorite, toggleFavorite } from '../../../services/favoritesService';
import { getComments } from '../../../services/chatService';
import { getDocumentsByEntity, DOCUMENT_TYPES } from '../../../services/documentService';
import DealEventModal from './DealEventModal';
import MeetingModal from './MeetingModal';
import { reportError } from '../../../utils/errorReporter';
import supabase from '../../../lib/supabase';
import { generateContactCardHTML, getCompanyInfo } from '../../../services/printService';
import PrintPreview from '../../../components/ui/PrintPreview';
import WhatsAppQuickPopup from './WhatsAppQuickPopup';
import {
  useEscClose, SOURCE_LABELS, SOURCE_EN,
  TEMP, TYPE, fmtBudget, daysSince, initials,
  Chip, ScorePill, getDeptStages, deptStageLabel,
  agentInitials, normalizePhone,
} from './constants';
import { generateWhatsAppLink } from '../../../services/whatsappService';

const ACT_ICON_MAP = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: Clock };

// Bilingual labels for the Audit section's field-level change diffs. Unknown
// fields fall back to the raw column name.
const AUDIT_FIELD_LABELS = {
  full_name: { ar: 'الاسم', en: 'Name' }, phone: { ar: 'التليفون', en: 'Phone' }, phone2: { ar: 'تليفون 2', en: 'Phone 2' }, email: { ar: 'الإيميل', en: 'Email' },
  contact_status: { ar: 'الحالة', en: 'Status' }, temperature: { ar: 'الحرارة', en: 'Temperature' }, lead_score: { ar: 'التقييم', en: 'Score' },
  my_status: { ar: 'الحالة', en: 'Status' }, my_temperature: { ar: 'الحرارة', en: 'Temperature' }, my_score: { ar: 'التقييم', en: 'Score' },
  source: { ar: 'المصدر', en: 'Source' }, company: { ar: 'الشركة', en: 'Company' }, job_title: { ar: 'المسمى', en: 'Job title' }, budget_min: { ar: 'أقل ميزانية', en: 'Min budget' },
  budget_max: { ar: 'أعلى ميزانية', en: 'Max budget' }, assigned_to_name: { ar: 'المسؤول', en: 'Assigned to' }, lead_category: { ar: 'التصنيف', en: 'Category' },
  notes: { ar: 'ملاحظات', en: 'Notes' }, disqualify_reason: { ar: 'سبب الاستبعاد', en: 'Disqualify reason' }, disqualify_note: { ar: 'ملاحظة الاستبعاد', en: 'Disqualify note' },
  campaign_name: { ar: 'الحملة', en: 'Campaign' }, contact_type: { ar: 'النوع', en: 'Type' }, is_blacklisted: { ar: 'القائمة السوداء', en: 'Blacklisted' },
};
// Safe stringify for an audit from/to value (some are JSON objects like agent_statuses).
// ISO timestamps render as a short local date instead of a raw 2026-…Z string.
const auditVal = (x) => {
  if (x == null || x === '') return '—';
  if (typeof x === 'object') return JSON.stringify(x);
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+/.test(x)) {
    const d = new Date(x);
    if (!isNaN(d)) return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(x);
};

// Module-level cache for the drawer's per-contact data. Arrow-key navigation
// fires through contacts faster than the network can respond; without a cache
// each press queues 7 round-trips. 60s TTL is short enough that data stays
// fresh during normal use, long enough to absorb the common navigation pattern.
const _drawerDataCache = new Map();
const DRAWER_CACHE_TTL = 60_000;

// Skeleton-style placeholder shown while a heavy section is unmounted.
// Once the section scrolls into view (IntersectionObserver in the
// drawer), the real component swaps in. Keeps the section's layout
// space stable so the scroll position doesn't jump.
function SectionPlaceholder({ label }) {
  return (
    <div className="rounded-xl border border-edge/60 dark:border-edge-dark/60 bg-surface-bg/40 dark:bg-surface-bg-dark/40 px-4 py-6 text-center text-[11px] text-content-muted dark:text-content-muted-dark">
      <div className="w-6 h-6 mx-auto mb-2 rounded-full border-2 border-content-muted/20 dark:border-content-muted-dark/20 border-t-content-muted/40 dark:border-t-content-muted-dark/40 animate-spin" />
      {label}
    </div>
  );
}

const TIMELINE_CONFIG = {
  activity:    { color: '#2F6BD3', bg: 'rgba(74,122,171,0.10)',  defaultIcon: Clock },
  task:        { color: '#C9860A', bg: 'rgba(245,158,11,0.10)',  defaultIcon: CheckSquare },
  opportunity: { color: '#158A57', bg: 'rgba(16,185,129,0.10)',  defaultIcon: Target },
  comment:     { color: '#5A63C4', bg: 'rgba(139,92,246,0.10)',  defaultIcon: MessageSquare },
  document:    { color: '#C14D7E', bg: 'rgba(236,72,153,0.10)',  defaultIcon: FileUp },
  audit:       { color: '#6B8DB5', bg: 'rgba(107,141,181,0.10)', defaultIcon: History },
  deal:        { color: '#0B5A53', bg: 'rgba(15,118,110,0.10)',  defaultIcon: Award },
};

// Department tab config
const DEPT_TABS = {
  sales:      { key: 'opportunities', label_ar: 'الفرص',     label_en: 'Opportunities', icon: Target,    color: '#158A57' },
  hr:         { key: 'recruitment',   label_ar: 'التوظيف',   label_en: 'Recruitment',   icon: UserCheck, color: '#6B21A8' },
  marketing:  { key: 'campaigns',     label_ar: 'الحملات',   label_en: 'Campaigns',     icon: Megaphone, color: '#C9860A' },
  operations: { key: 'orders',        label_ar: 'الطلبات',   label_en: 'Orders',        icon: Settings,  color: '#2F6BD3' },
  finance:    { key: 'invoices',      label_ar: 'الفواتير',  label_en: 'Invoices',      icon: DollarSign, color: '#0B5A53' },
};

// ── Contact Drawer ─────────────────────────────────────────────────────────
export default function ContactDrawer({ contact, onClose, onBlacklist, onUpdate, onPrev, onNext, onPin, isPinned, onReminder, onDelete, onRequestDisqualify }) {
  // Drawer ref for focus trap + restore — was missing accessibility scaffolding.
  // Tabbing now stays inside the drawer; focus returns to the opener on close.
  const drawerRef = useRef(null);
  useFocusTrap(drawerRef);
  const [showEdit, setShowEdit] = useState(false);
  const [showDistribute, setShowDistribute] = useState(false);
  const [showPullLeads, setShowPullLeads] = useState(false);
  const [showHandOff, setShowHandOff] = useState(false);
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);
  // Deal-events model. dealModal = { status, dealId?, initialFields? } | null
  // (dealId set ⇒ advancing an existing deal; null ⇒ creating a new one).
  const [dealModal, setDealModal] = useState(null);
  // A lead can have several deals (one per unit) — the Deal tab lists them all.
  const [dealRows, setDealRows] = useState([]);
  const [dealLoading, setDealLoading] = useState(false);
  // Meetings tab: { mode: 'happened' | 'scheduled' } | null
  const [meetingModal, setMeetingModal] = useState(null);
  // Quick status change popover anchored on the hero status chip — lets the
  // viewer flip their own status without opening the full TakeActionForm.
  const [showQuickStatus, setShowQuickStatus] = useState(false);
  // Quick temperature popover anchored on the temperature card.
  const [showQuickTemp, setShowQuickTemp] = useState(false);
  // Quick stage popover anchored on each opportunity card's stage chip.
  // Tracks which opp.id is currently open (only one at a time).
  const [openStagePopoverFor, setOpenStagePopoverFor] = useState(null);
  // When the hero action buttons (Meeting / Note) open the TakeActionForm
  // they preset the activity type so the user lands on the right tab.
  const [actionPresetType, setActionPresetType] = useState(null);
  // Single-scroll mode: each tab now renders as a `<section>` in the
  // scroll. Heavy components (ResaleUnitsTab, CommentsSection,
  // DocumentsSection — they each self-fetch on mount) are deferred until
  // the section actually scrolls into view, so opening a drawer doesn't
  // burn 3 extra DB queries the user may never look at. Sections are
  // discovered via [data-section-key] in the DOM.
  const [mountedSections, setMountedSections] = useState(() => new Set(['activity']));
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  // WhatsApp quick-send: only the open/close flag lives here (keyboard-nav
  // guards read it). Message/template/recent-message state + their fetches
  // now live in WhatsAppQuickPopup, which mounts only when opened — so we no
  // longer fetch WA history on every contact navigation.
  const [showWAPopup, setShowWAPopup] = useState(false);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const [tab, setTab] = useState('activity');
  // showAddAgent + addAgent* + selectedAgent state removed — per-agent picker UI is gone.
  // campaignsList feeds EditContactModal's campaign picker (see render below).
  const [campaignsList, setCampaignsList] = useState([]);
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  // Opened only by the "+ سجّل" FAB (always with a preset type) — never auto-open.
  const [showActionForm, setShowActionForm] = useState(false);
  const [showLogMenu, setShowLogMenu] = useState(false); // "+ سجّل" speed-dial
  // Close the speed-dial on an outside click WITHOUT an overlay div — an
  // inset-0 backdrop over the drawer swallowed wheel/touch so the timeline
  // couldn't scroll while the menu was open. useClickOutside listens on
  // document instead, leaving scrolling untouched.
  const fabRef = useRef(null);
  useClickOutside(fabRef, () => setShowLogMenu(false), showLogMenu);
  // Admin/operations "Audit" tab: aggregated viewers of THIS lead across all
  // employees. Fetched from the view_logs table (getEntityViewers reads only
  // this device's localStorage, so it can't show other people's views).
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  // Guarded ESC: closes the drawer only when no inner surface is open. The
  // useEscClose hook uses capture-phase + stopImmediatePropagation, so without
  // this guard the drawer would steal ESC from anything stacked over it and
  // close behind it. First ESC dismisses the top-most inner surface (the "+ سجّل"
  // menu / log form / meeting / deal modal); the drawer only closes when nothing
  // is layered on top. Modals with their own useEscClose (Edit, SMS, Distribute…)
  // are just guarded here so this handler doesn't fire behind them.
  useEscClose(() => {
    if (showLogMenu) { setShowLogMenu(false); return; }
    if (showQuickStatus) { setShowQuickStatus(false); return; }
    if (showQuickTemp) { setShowQuickTemp(false); return; }
    if (showActionForm) { setShowActionForm(false); setActionPresetType(null); return; }
    if (meetingModal) { setMeetingModal(null); return; }
    if (dealModal) { setDealModal(null); return; }
    if (showEdit || showSMSModal || showWAPopup || showPrintPreview
      || showDistribute || showPullLeads || showHandOff || showDrawerMenu) return;
    onClose();
  });
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [activityAgentFilter, setActivityAgentFilter] = useState('all');
  const assignmentHistory = useMemo(() => contact?.id ? getAssignmentHistory(contact.id) : [], [contact?.id]);
  const { profile, hasPermission } = useAuth();
  const isSalesAgent = profile?.role === 'sales_agent';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'operations';
  // Managers/leaders/admins manage other reps' leads, so they should SEE (and,
  // where an editor exists, edit) the assignee's per-agent temperature/score —
  // not just their own. Single-assignment means contact.temperature /
  // contact.lead_score are the current owner's values, so no ambiguity.
  const isManagerViewer = isAdmin || profile?.role === 'sales_manager' || profile?.role === 'team_leader';
  // Ownership is decided by ID, never by the denormalized assigned_to_name.
  // That name can drift (e.g. the same user's leads were stamped both
  // "saeed yasser" and "saeed yasser saeed"), and a name mismatch used to make
  // the owner's own leads read-only — temperature hidden, status locked. The id
  // is the source of truth.
  const isOwner = !!(contact?.assigned_to && profile?.id && contact.assigned_to === profile.id);
  // audit_logs SELECT is admin-only after the RLS tightening — skip the
  // fetch for users who can't read it. Otherwise we waste a query that
  // returns empty and renders an empty audit timeline section.
  const canViewAudit = hasPermission ? hasPermission('audit.view') : false;
  // Permission gates for destructive/sensitive actions in the More menu.
  // Service layer also enforces these — gating in UI prevents disabled-button
  // confusion and matches what the user can actually do.
  const canEditContact = hasPermission ? (hasPermission('contacts.edit') || hasPermission('contacts.edit_own')) : false;
  const canDeleteContact = hasPermission ? hasPermission('contacts.delete') : false;

  // Names of the viewer's team members (manager / leader / director). Used
  // to clip per-agent displays so a manager doesn't see sibling-team chips,
  // myTeamNames + teamNamesSet removed in Phase 3 — chip clipping was for the
  // multi-assignment model. After single-assignment migration, RLS gates
  // visibility at the contact level, so per-name clipping inside the drawer
  // is no longer needed.

  // Names of agents currently assigned that the viewer is allowed to see
  // After Phase 1 single-assignment migration, every contact has at most
  // one assignee. RLS already restricts which contacts each role can see
  // (admin sees all, manager sees team, agent sees own). So returning
  // [assigned_to_name] is sufficient — no per-name clipping needed.
  const getVisibleAssignees = (c = contact) => {
    const name = c?.assigned_to_name;
    return name ? [name] : [];
  };

  // Privacy: hide previous agent's activities if system config says so
  const hidePreviousHistory = useMemo(() => {
    if (!isSalesAgent) return false; // managers/admins always see everything
    try {
      const cfg = JSON.parse(localStorage.getItem('platform_system_config') || '{}');
      return cfg.hide_previous_agent_history === true;
    } catch (err) { if (import.meta.env.DEV) console.warn('parse system config:', err); return false; }
  }, [isSalesAgent]);

  // Find when current agent was assigned (to filter timeline)
  const myAssignmentDate = useMemo(() => {
    if (!hidePreviousHistory || !assignmentHistory.length) return null;
    const selfName = isRTL ? (profile?.full_name_ar || profile?.full_name_en || '') : (profile?.full_name_en || profile?.full_name_ar || '');
    // Find the last assignment TO the current agent
    const myAssign = [...assignmentHistory].reverse().find(h => h.to === selfName || h.to === profile?.full_name_ar || h.to === profile?.full_name_en);
    return myAssign ? new Date(myAssign.at) : null;
  }, [hidePreviousHistory, assignmentHistory, profile, isRTL]);

  // Get agents list for assignment dropdown. Team-scoped: a sales_manager or
  // team_leader only sees their own team members in the picker, so they
  // can't reassign to agents outside their scope.
  useEffect(() => {
    // Load campaigns for EditContactModal's campaign picker.
    import('../../../services/marketingService').then(({ fetchCampaigns }) => {
      fetchCampaigns().then(c => setCampaignsList(c || [])).catch(() => {});
    }).catch(() => {});
  }, [profile?.role, profile?.id, profile?.team_id]);

  // Favorites
  const [isFav, setIsFav] = useState(false);
  useEffect(() => {
    setIsFav(checkFavorite(`contact_${contact.id}`));
  }, [contact.id]);
  const handleToggleFav = () => {
    const result = toggleFavorite({
      id: `contact_${contact.id}`,
      type: 'contact',
      name: contact.full_name_en || contact.full_name || contact.full_name_ar || '',
      nameAr: contact.full_name_ar || contact.full_name || '',
      path: `/contacts?highlight=${contact.id}`,
    });
    setIsFav(result.added);
  };

  // Log view
  const lastViewedId = useRef(null);
  useEffect(() => {
    if (contact.id && contact.id !== lastViewedId.current) {
      lastViewedId.current = contact.id;
      logView({ entityType: 'contact', entityId: contact.id, entityName: contact.full_name, viewer: profile });
      addRecentItem({ type: 'contact', id: contact.id, name: contact.full_name, path: '/contacts?highlight=' + contact.id, extra: { company: contact.company, type: contact.contact_type } });
    }
  }, [contact.id, profile]);

  // Reset tab when contact changes
  useEffect(() => {
    setTab('activity');
    setTimelineFilter('all');
    setActivityAgentFilter('all');
    setShowActionForm(false);
    // Reset lazy-mount tracking — for the new contact only Activity is
    // pre-mounted; everything else lazy-mounts on first scroll-into-view.
    // sectionRefs is NOT wiped — the DOM nodes for the sections persist
    // across contact navigation (same JSX tree), so the cached refs stay
    // valid and the IntersectionObserver effect can re-observe them.
    setMountedSections(new Set(['activity']));
    // (WhatsApp draft state now lives in WhatsAppQuickPopup, which re-fetches
    // per contact.id and clears itself — no reset needed here.)
  }, [contact.id]);

  // Lazy-mount sections when they scroll into view. Heavy sections
  // (Comments, Documents, Units) self-fetch on mount, so deferring them
  // saves 3 DB queries per drawer open if the user only looks at the
  // activity timeline.
  useEffect(() => {
    const root = drawerRef.current?.querySelector('.flex-1.overflow-y-auto');
    if (!root) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const key = e.target.dataset.sectionKey;
        if (!key) return;
        setMountedSections(prev => prev.has(key) ? prev : new Set([...prev, key]));
      });
    }, { root, rootMargin: '300px 0px' });
    // Query the DOM directly instead of relying on the ref cache — the
    // sections are always rendered (single-scroll), so this is safe and
    // avoids race conditions with ref population timing.
    root.querySelectorAll('[data-section-key]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [contact.id]);

  // drawerRefresh is bumped by the realtime subscription below whenever a
  // related row (activities / tasks / opportunities) changes for this
  // contact. The data-fetch effect treats it as a refetch trigger.
  const [drawerRefresh, setDrawerRefresh] = useState(0);

  // Fetch all drawer data on contact change — single parallel batch.
  // Cached for 60s by contact id so arrow-key navigation between contacts
  // (or reopening the same one) doesn't refire 7 round-trips. Also debounced
  // by 250ms so rapid arrow presses don't queue up requests we'll throw away.
  //
  // Cache invalidates when:
  //   - contact.updated_at advances (the contact row itself changed), or
  //   - drawerRefresh changes (realtime fired for activities/tasks/opps).
  // Without the realtime branch, two users editing the same contact in
  // parallel would each see stale activity timelines because contact.updated_at
  // doesn't change when only a child row changes.
  useEffect(() => {
    let cancelled = false;
    const cid = String(contact.id);
    // Key the cache by VIEWER + contact — the cached payload is RLS-scoped to the
    // viewer (other agents' activities, admin-only audits), so a different user
    // sharing the same tab within the 60s TTL must NOT read the previous user's
    // cache. Without the profile prefix it leaked across a same-tab user switch.
    const cacheKey = `${profile?.id || 'anon'}:${cid}`;
    const contactStamp = contact.updated_at || null;

    // Cache hit — apply immediately and skip network entirely.
    const cached = _drawerDataCache.get(cacheKey);
    const cacheFresh = cached && Date.now() - cached.ts < DRAWER_CACHE_TTL;
    const cacheMatchesContact = cached && (cached.contactStamp === contactStamp);
    const cacheMatchesRefresh = cached && (cached.drawerRefresh === drawerRefresh);
    if (cacheFresh && cacheMatchesContact && cacheMatchesRefresh) {
      setActivities(cached.activities || []);
      setTasks(cached.tasks || []);
      setOpportunities(cached.opportunities || []);
      setExtraSources(cached.extraSources || { comments: [], documents: [], audits: [] });
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const timer = setTimeout(() => {
      // ── Timeline-critical (activities + tasks + opportunities) — resolve these
      //    FIRST and reveal the timeline immediately, instead of waiting on the
      //    comments/documents/audits round-trips that belong to other tabs.
      Promise.allSettled([
        fetchContactActivities(contact.id, { role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
        fetchTasks({ contactId: contact.id, role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
        fetchContactOpportunities(contact.id, { role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
      ]).then(([actsRes, tasksRes, oppsRes]) => {
        if (cancelled) return;
        const activities = actsRes.status === 'fulfilled' ? actsRes.value : [];
        const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
        const opportunities = oppsRes.status === 'fulfilled' ? oppsRes.value : [];
        setActivities(activities);
        setTasks(tasks);
        setOpportunities(opportunities);
        setLoadingData(false);
        const prev = _drawerDataCache.get(cacheKey) || {};
        _drawerDataCache.set(cacheKey, { ...prev, activities, tasks, opportunities, ts: Date.now(), contactStamp, drawerRefresh });
      });
      // ── Secondary (Comments / Documents / Audit tabs) — load in the background;
      //    the timeline never waits on these.
      Promise.allSettled([
        getComments('contact', cid).catch(() => []),
        getDocumentsByEntity('contact', cid).catch(() => []),
        isAdmin ? getLocalAuditLogs({ limit: 200, entity: 'contact', entityId: cid }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]).then(([commentsRes, docsRes, auditsRes]) => {
        if (cancelled) return;
        const comments = commentsRes.status === 'fulfilled' ? (Array.isArray(commentsRes.value) ? commentsRes.value : []) : [];
        const documents = docsRes.status === 'fulfilled' ? (Array.isArray(docsRes.value) ? docsRes.value : []) : [];
        const allAudits = auditsRes.status === 'fulfilled' ? (Array.isArray(auditsRes.value?.data) ? auditsRes.value.data : []) : [];
        const audits = allAudits.filter(a => String(a.entity_id) === cid && a.action !== 'create');
        const extraSources = { comments, documents, audits };
        setExtraSources(extraSources);
        const prev = _drawerDataCache.get(cacheKey) || {};
        _drawerDataCache.set(cacheKey, { ...prev, extraSources, ts: prev.ts || Date.now(), contactStamp, drawerRefresh });
      });
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [contact.id, contact.updated_at, drawerRefresh, isAdmin, profile?.id, profile?.role, profile?.team_id]);

  // Realtime invalidator: subscribe to activities/tasks/opportunities for the
  // currently open contact. When any change comes in, drop the cached entry
  // and bump drawerRefresh so the data-fetch effect refetches. Tied to
  // contact.id so the channel resubscribes when the user navigates contacts.
  useEffect(() => {
    if (!contact?.id) return undefined;
    const cid = String(contact.id);
    const cacheKey = `${profile?.id || 'anon'}:${cid}`;
    const channel = supabase
      .channel(`drawer_${cid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `contact_id=eq.${cid}` },
        () => { _drawerDataCache.delete(cacheKey); setDrawerRefresh(n => n + 1); })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `contact_id=eq.${cid}` },
        () => { _drawerDataCache.delete(cacheKey); setDrawerRefresh(n => n + 1); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contact?.id, profile?.id]);

  // Admin/operations only: fetch who has viewed this lead (all employees) once
  // the Audit section is mounted (scrolled to / tab clicked) — avoids a query
  // on every drawer open. Aggregates view_logs rows per user.
  useEffect(() => {
    if (!isAdmin || !contact?.id || !mountedSections.has('audit')) return undefined;
    let cancelled = false;
    setViewersLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('view_logs')
        .select('user_id, user_name, user_role, viewed_at')
        .eq('entity_type', 'contact')
        .eq('entity_id', String(contact.id))
        .order('viewed_at', { ascending: false })
        .limit(1000);
      if (cancelled) return;
      if (error) { setViewers([]); setViewersLoading(false); return; }
      const map = new Map();
      for (const l of data || []) {
        const cur = map.get(l.user_id) || { user_id: l.user_id, user_name: l.user_name, user_role: l.user_role, views: 0, last_view: l.viewed_at, first_view: l.viewed_at };
        cur.views += 1;
        if (l.viewed_at > cur.last_view) cur.last_view = l.viewed_at;
        if (l.viewed_at < cur.first_view) cur.first_view = l.viewed_at;
        map.set(l.user_id, cur);
      }
      setViewers([...map.values()].sort((a, b) => new Date(b.last_view) - new Date(a.last_view)));
      setViewersLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, contact?.id, mountedSections]);

  // Load the lead's current deal for the Deal tab (any status), refreshed when
  // a milestone is logged (drawerRefresh bump).
  useEffect(() => {
    if (!contact?.id) return undefined;
    let cancelled = false;
    setDealLoading(true);
    (async () => {
      const { data, error } = await supabase.from('deals')
        .select('id, deal_number, status, deal_value, down_payment, unit_code, project_ar, project_en, notes, agent_ar, agent_en, created_at, updated_at')
        .eq('contact_id', contact.id).order('created_at', { ascending: false });
      if (cancelled) return;
      setDealRows(error ? [] : (data || []));
      setDealLoading(false);
    })();
    return () => { cancelled = true; };
  }, [contact?.id, drawerRefresh]);

  // Arrow key navigation between contacts
  useEffect(() => {
    const handler = (e) => {
      // Don't switch the underlying lead while ANY inner surface is open — the
      // log form / meeting / deal modal, the "+ سجّل" menu, or the older modals.
      // Navigating away mid-entry silently discards what the rep was typing.
      if (showActionForm || showLogMenu || meetingModal || dealModal
        || showQuickStatus || showQuickTemp
        || showEdit || showSMSModal || showWAPopup || showPrintPreview
        || showDistribute || showPullLeads || showHandOff || showDrawerMenu) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      // Reading-direction-aware: in LTR, Left = previous, Right = next.
      // In RTL the relationship flips because reading flows the other way.
      const prevKey = isRTL ? 'ArrowRight' : 'ArrowLeft';
      const nextKey = isRTL ? 'ArrowLeft' : 'ArrowRight';
      if (e.key === prevKey && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === nextKey && onNext) { e.preventDefault(); onNext(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onPrev, onNext, showActionForm, showLogMenu, meetingModal, dealModal, showQuickStatus, showQuickTemp, showEdit, showSMSModal, showWAPopup, showPrintPreview, showDistribute, showPullLeads, showHandOff, showDrawerMenu, isRTL]);


  // Unified action path: TakeActionForm (and, later, the other entry points)
  // hand a single payload to logInteraction, which guarantees the invariants
  // (activity + mandatory follow-up + supersede + optional status). Here we
  // just fire it and reconcile the drawer's local state with what it did.
  const handleLogInteraction = async (payload) => {
    try {
      await logInteraction(contact.id, {
        ...payload,
        actor: { id: profile?.id || null, name_ar: profile?.full_name_ar || '', name_en: profile?.full_name_en || '' },
      });
      // Reload the drawer's activities + tasks from the DB so the timeline and
      // task list match EXACTLY what logInteraction wrote — including the
      // trigger's supersede and createActivity's done-marking. (Same mechanism
      // the Meetings tab uses; avoids optimistic state showing a just-completed
      // follow-up as "cancelled".)
      setDrawerRefresh(n => n + 1);
      // Sync the parent list + drawer contact (status / last activity) without a
      // second DB write — logInteraction already persisted it.
      const patch = { ...contact, last_activity_at: new Date().toISOString(), _skipDbUpdate: true };
      if (payload.statusChange?.to && payload.statusChange.to !== payload.statusChange.from) {
        patch.contact_status = payload.statusChange.to;
        if (payload.statusChange.dqReason) patch.disqualify_reason = payload.statusChange.dqReason;
      }
      onUpdate?.(patch);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    } catch (err) {
      if (err?.message === 'FOLLOWUP_REQUIRED') {
        toast.error(isRTL ? 'لازم تحدّد موعد متابعة' : 'A follow-up date is required');
      } else {
        reportError('ContactDrawer', 'handleLogInteraction', err);
        toast.error(err?.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
      }
      throw err; // let TakeActionForm keep the form open for a retry
    }
  };

  // Floating WhatsApp FAB = just OPEN the chat (fast path). It does NOT log
  // anything — merely opening the chat isn't proof the rep messaged the lead,
  // and auto-logging every tap only noised up the timeline. To RECORD a real
  // WhatsApp interaction the rep uses the "+ سجّل" FAB → WhatsApp (which also
  // sets the follow-up), or the ⋮ "WhatsApp with template" composer's Send.
  const openWhatsAppDirect = () => {
    if (!contact.phone) return;
    window.open(generateWhatsAppLink(normalizePhone(contact.phone).replace('+', '')), '_blank');
  };

  // Quick stage change for an opportunity — updates opportunities.stage
  // and patches local state so the chip flips immediately. Logs an
  // activity in the timeline for audit. Errors surface as a toast.
  const handleStageChange = async (opp, newStage) => {
    if (!opp?.id || !newStage || newStage === opp.stage) return;
    const oldStage = opp.stage;
    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, stage: newStage, stage_changed_at: new Date().toISOString() } : o));
    try {
      await updateOpportunity(opp.id, { stage: newStage, stage_changed_at: new Date().toISOString() });
    } catch (err) {
      // Roll back
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, stage: oldStage } : o));
      toast.error(isRTL ? `فشل التحديث: ${err?.message || 'غير معروف'}` : `Update failed: ${err?.message || 'Unknown'}`);
      return;
    }
    try {
      const fromLabel = deptStageLabel(oldStage, dept, false);
      const toLabel = deptStageLabel(newStage, dept, false);
      const act = await createActivity({
        type: 'stage_change',
        notes: `Stage: ${fromLabel} → ${toLabel}`,
        contact_id: contact.id,
        user_id: profile?.id || null,
        user_name_ar: profile?.full_name_ar || '',
        user_name_en: profile?.full_name_en || '',
        dept: 'sales',
        created_at: new Date().toISOString(),
      });
      setActivities(prev => [act, ...prev]);
    } catch (e) { reportError('ContactDrawer', 'handleStageChange:activity', e); }
    // Invalidate the cache so the stage change survives a re-nav within the 60s
    // TTL (opportunities aren't on the realtime channel, so the optimistic
    // setOpportunities alone reverts on a cache hit).
    setDrawerRefresh(n => n + 1);
    toast.success(isRTL ? 'تم تحديث المرحلة' : 'Stage updated');
  };

  // Deal-events model: after a milestone is logged, just drop a timeline entry
  // and refresh the Deal tab. The lead's contact_status is NOT touched — the
  // user controls status manually (per request).
  const handleDealEventSaved = async ({ status }) => {
    setDealModal(null);
    const label = isRTL
      ? { reserved: 'حجز', contracted: 'عقد', won: 'بيع', lost: 'خسارة' }
      : { reserved: 'Reserved', contracted: 'Contracted', won: 'Won', lost: 'Lost' };
    try {
      const act = await createActivity({
        type: 'deal_event',
        notes: `${isRTL ? 'صفقة' : 'Deal'}: ${label[status] || status}`,
        contact_id: contact.id, user_id: profile?.id || null,
        user_name_ar: profile?.full_name_ar || '', user_name_en: profile?.full_name_en || '',
        dept: 'sales', created_at: new Date().toISOString(),
      });
      setActivities(prev => [act, ...prev]);
    } catch (err) { reportError('ContactDrawer', 'handleDealEventSaved:activity', err); }
    toast.success(isRTL ? 'تم تسجيل الصفقة' : 'Deal logged');
    setDrawerRefresh(n => n + 1);
  };

  // Meetings are stored as activities (type='meeting'); refresh pulls them back.
  const handleMeetingSaved = () => {
    setMeetingModal(null);
    toast.success(isRTL ? 'تم حفظ الاجتماع' : 'Meeting saved');
    setDrawerRefresh(n => n + 1);
  };

  // Handle contact status change from TakeActionForm (per-agent)
  const handleStatusChange = async (newStatus, dqReason) => {
    if (onUpdate) {
      // Phase B: "has_opportunity" is now just a plain status — selecting it no
      // longer forces creating an opportunity record. (Deals are closed via the
      // Close-Deal wizard instead.)
      const oldStatus = contact.contact_status;
      // DQ requires a reason — DB constraint enforces this. If the caller
      // sent an empty/missing reason for a disqualified update, defer to
      // the DisqualifyModal instead of trying the write (which would fail
      // with "violates check constraint dq_requires_reason").
      if (newStatus === 'disqualified' && !dqReason) {
        if (onRequestDisqualify) {
          onRequestDisqualify(contact);
          return;
        }
        // No modal handler wired — bail out cleanly with a toast so the
        // user knows what to do instead of seeing the raw DB error.
        toast.warning(isRTL ? 'اختر سبب الاستبعاد من القائمة' : 'Pick a disqualify reason');
        return;
      }
      const updates = { ...contact, contact_status: newStatus };
      if (newStatus === 'disqualified' && dqReason) {
        updates.disqualify_reason = dqReason;
      }
      // OPTIMISTIC: the parent updates its state synchronously, so the hero chip
      // flips instantly — confirm right away instead of gating the toast on the
      // DB round-trip (that felt slow). The write + the hidden status_change
      // activity both run in the background; on failure the parent rolls back
      // and shows its own error toast.
      toast.success(isRTL ? 'تم تحديث حالة التواصل' : 'Lead status updated');
      onUpdate(updates).catch(() => {});
      (async () => {
        try {
          const statusLabels = { new: 'New', following: 'Following', contacted: 'Contacted', has_opportunity: 'Has Opportunity', disqualified: 'Disqualified' };
          await createActivity({
            type: 'status_change',
            notes: `${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}${dqReason ? ' (' + dqReason + ')' : ''}`,
            contact_id: contact.id,
            user_id: profile?.id || null,
            user_name_ar: profile?.full_name_ar || '',
            user_name_en: profile?.full_name_en || '',
            dept: 'sales',
            created_at: new Date().toISOString(),
          });
        } catch (err) {
          reportError('ContactDrawer', 'handleStatusChange:activity', err);
        }
      })();
    }
  };

  // Temperature change — same pattern as handleStatusChange (await parent,
  // log activity, surface real errors).
  const handleTemperatureChange = (newTemp) => {
    if (!onUpdate || newTemp === contact.temperature) return;
    const oldTemp = contact.temperature;
    // OPTIMISTIC (see handleStatusChange): chip flips instantly, toast now, the
    // write + hidden temperature_change activity run in the background; parent
    // rolls back + error-toasts on failure.
    toast.success(isRTL ? 'تم تحديث الحرارة' : 'Temperature updated');
    onUpdate({ ...contact, temperature: newTemp }).catch(() => {});
    (async () => {
      try {
        const tempLabels = { hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold' };
        await createActivity({
          type: 'temperature_change',
          notes: `Temperature: ${tempLabels[oldTemp] || oldTemp || '—'} → ${tempLabels[newTemp] || newTemp}`,
          contact_id: contact.id,
          user_id: profile?.id || null,
          user_name_ar: profile?.full_name_ar || '',
          user_name_en: profile?.full_name_en || '',
          dept: 'sales',
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        reportError('ContactDrawer', 'handleTemperatureChange:activity', err);
      }
    })();
  };


  const { drawerFields: df, activityResults } = useSystemConfig();
  // Result-key → {ar,en} lookup across every activity type. Lets the timeline
  // re-translate a stored `result` at display time instead of trusting the
  // baked `description`, which was written in the LOGGER's UI language (so a
  // call logged in Arabic used to read "لم يرد …" even for an English viewer).
  const resultLabels = useMemo(() => {
    const m = {};
    Object.values(activityResults || {}).forEach((arr) => (arr || []).forEach((r) => {
      if (r?.value) m[r.value] = { ar: r.label_ar, en: r.label_en };
    }));
    return m;
  }, [activityResults]);
  // No `if (!contact) return null` here — it sat between hooks (a Rules-of-Hooks
  // violation). The drawer is only ever mounted via `{selected && <ContactDrawer
  // contact={selected}/>}`, so contact is always defined; hooks above already
  // dereference it. All hooks now run unconditionally.
  const show = (key) => !df || df[key] !== false; // default show if not configured

  const myTempKey = (() => {
    if (isOwner) return contact.temperature;
    // Managers/admins see the assignee's temperature too.
    if (isManagerViewer) return contact.temperature;
    return null;
  })();
  const tempInfo = myTempKey ? TEMP[myTempKey] : null;
  const tp = contact.contact_type ? TYPE[contact.contact_type] : null;
  const isSupplier = contact.contact_type === 'supplier';
  const dept = contact.department || 'sales';
  const deptTab = isSupplier ? DEPT_TABS.finance : (DEPT_TABS[dept] || DEPT_TABS.sales);

  // Unique agents from activities
  const uniqueAgents = useMemo(() => {
    const map = new Map();
    (activities || []).forEach(a => {
      const id = a.user_id || a.user_name_en || a.user_name_ar;
      if (!id) return;
      const name = isRTL
        ? (a.user_name_ar || a.user_name_en || a.users?.full_name_ar || a.users?.full_name_en || '—')
        : (a.user_name_en || a.user_name_ar || a.users?.full_name_en || a.users?.full_name_ar || '—');
      if (name === '—') return;
      if (!map.has(id)) map.set(id, { id, name, count: 0 });
      map.get(id).count++;
    });
    return Array.from(map.values());
  }, [activities, isRTL]);
  const agentCount = uniqueAgents.length;

  const actCount = activities.length;
  const oppCount = opportunities.length;
  const openTaskCount = (tasks || []).filter(t => t.status !== 'done' && t.status !== 'cancelled').length;

  // ── Extra timeline sources (comments, documents, audit, deals) ───────────
  const [extraSources, setExtraSources] = useState({ comments: [], documents: [], audits: [] });

  // Extra sources are now loaded in the main useEffect above

  // Listen for real-time updates
  useEffect(() => {
    const refresh = async () => {
      if (!contact?.id) return;
      const cid = String(contact.id);
      try {
        const [comments, documents] = await Promise.all([
          getComments('contact', cid).catch(() => []),
          getDocumentsByEntity('contact', cid).catch(() => []),
        ]);
        setExtraSources(prev => ({ ...prev, comments: Array.isArray(comments) ? comments : [], documents: Array.isArray(documents) ? documents : [] }));
      } catch (err) { if (import.meta.env.DEV) console.warn('refresh comments/docs:', err); }
    };
    window.addEventListener('platform_comment', refresh);
    window.addEventListener('platform_document', refresh);
    return () => {
      window.removeEventListener('platform_comment', refresh);
      window.removeEventListener('platform_document', refresh);
    };
  }, [contact?.id]);

  // ── Update activity status (scheduled -> completed/cancelled) ────────────
  const handleUpdateActivityStatus = async (activityId, newStatus) => {
    try {
      await updateActivity(activityId, { status: newStatus });
      setActivities(prev => prev.map(a => String(a.id) === String(activityId) ? { ...a, status: newStatus } : a));
      toast.success(isRTL
        ? (newStatus === 'completed' ? 'تم إكمال النشاط' : 'تم إلغاء النشاط')
        : (newStatus === 'completed' ? 'Activity completed' : 'Activity cancelled'));
    } catch (err) {
      reportError('ContactDrawer', 'handleActivityStatusChange', err);
      toast.error(isRTL ? 'حدث خطأ' : 'Error updating activity');
    }
  };

  // ── Timeline — clean interaction log ─────────────────────────────────────
  // Only genuine activities (call/whatsapp/email/meeting/note) + follow-up
  // tasks. Deliberately EXCLUDED (each lives elsewhere now):
  //   • status_change / temperature_change activities — noise here; current
  //     values are in the hero, full change history is in the Audit tab.
  //   • reassignment / ownership history — moved to the Audit tab.
  //   • opportunities / comments / documents — each has its own tab.
  //   • audit field-edits + deals — Audit tab / deal record.
  const HIDDEN_TIMELINE_ACTIVITY_TYPES = new Set(['status_change', 'temperature_change', 'reassignment']);
  const timeline = useMemo(() => {
    const items = [];
    (activities || []).forEach(a => {
      if (HIDDEN_TIMELINE_ACTIVITY_TYPES.has(a.type)) return;
      items.push({ ...a, _type: 'activity', _date: a.created_at });
    });
    (tasks || []).forEach(t => items.push({ ...t, _type: 'task', _date: t.created_at || t.due_date }));
    return items.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, tasks]);

  const filteredTimeline = useMemo(() => {
    let items = timeline;

    // Privacy filter: hide activities before current agent's assignment date
    if (hidePreviousHistory && myAssignmentDate) {
      items = items.filter(item => {
        // Always show assignment entries (so agent knows history exists)
        if (item._type === 'assignment') return true;
        // Hide activities from before this agent was assigned
        const itemDate = new Date(item._date || 0);
        return itemDate >= myAssignmentDate;
      });
    }

    if (timelineFilter !== 'all') items = items.filter(item => item._type === timelineFilter);
    if (activityAgentFilter !== 'all') {
      items = items.filter(item => {
        const id = item.user_id || item.users?.full_name_ar || item.users?.full_name_en || item.author_name || item.uploaded_by || item.user_name;
        return id === activityAgentFilter;
      });
    }
    return items;
  }, [timeline, timelineFilter, activityAgentFilter, hidePreviousHistory, myAssignmentDate]);

  // Grouped contact info for data tab
  const dataGroups = [
    {
      title: isRTL ? 'معلومات التواصل' : 'Lead Info',
      icon: Phone,
      color: '#158A57',
      rows: [
        show('phone') && { label: isRTL ? 'الهاتف' : 'Phone', val: contact.phone || '—' },
        show('phone2') && contact.phone2 && { label: isRTL ? 'الهاتف الثاني' : 'Phone 2', val: contact.phone2 },
        ...(Array.isArray(contact.extra_phones) ? contact.extra_phones.map((p, i) => p ? { label: `${isRTL ? 'هاتف' : 'Phone'} ${i + 3}`, val: p } : null).filter(Boolean) : []),
        show('email') && { label: isRTL ? 'الإيميل' : 'Email', val: contact.email || '—' },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'معلومات العمل' : 'Business Info',
      icon: Briefcase,
      color: '#2F6BD3',
      rows: [
        show('company') && { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
        show('job_title') && { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
        show('budget') && { label: isRTL ? 'الميزانية' : 'Budget', val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
        show('preferred_location') && { label: isRTL ? 'الموقع' : 'Location', val: contact.preferred_location || '—' },
        show('interested_in_type') && { label: isRTL ? 'نوع العقار' : 'Property', val: (isRTL ? { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' } : { residential: 'Residential', commercial: 'Commercial', administrative: 'Administrative' })[contact.interested_in_type] || '—' },
        contact.gender && { label: isRTL ? 'النوع' : 'Gender', val: (isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender },
        contact.nationality && { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality },
        contact.birth_date && { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: new Date(contact.birth_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
        contact.prefix && { label: isRTL ? 'اللقب' : 'Prefix', val: contact.prefix },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'المصدر والتعيين' : 'Source & Assignment',
      icon: UserCheck,
      color: '#C9860A',
      rows: [
        contact.source && { label: isRTL ? 'المصدر' : 'Source', val: isRTL ? (SOURCE_LABELS[contact.source] || contact.source) : (SOURCE_EN[contact.source] || contact.source) },
        contact.campaign_name && { label: isRTL ? 'الحملة' : 'Campaign', val: contact.campaign_name },
        contact.assigned_by_name && { label: isRTL ? 'تم التعيين بواسطة' : 'Assigned By', val: contact.assigned_by_name },
        contact.created_by_name && { label: isRTL ? 'أنشأها' : 'Created By', val: contact.created_by_name },
        contact.assigned_at && { label: isRTL ? 'تاريخ التوزيع' : 'Assigned', val: new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'معلومات إضافية' : 'More Info',
      icon: Star,
      color: '#6B21A8',
      rows: [
        // Status + Lead Score removed — shown as chips in the hero.
        contact.contact_type && { label: isRTL ? 'النوع' : 'Type', val: tp ? (isRTL ? tp.label : tp.labelEn) : contact.contact_type },
        contact.department && { label: isRTL ? 'القسم' : 'Department', val: (isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : {})[contact.department] || contact.department },
        contact.contact_number && { label: isRTL ? 'رقم التعريف' : 'Lead #', val: contact.contact_number },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'الاستبعاد' : 'Disqualification',
      icon: Ban,
      color: '#D6403B',
      rows: [
        (contact.contact_status === 'disqualified' && contact.disqualify_reason) && { label: isRTL ? 'السبب' : 'Reason', val: ({ resale: isRTL ? 'يرغب في بيع وحدته' : 'Wants to sell unit', not_interested: isRTL ? 'غير مهتم' : 'Not interested', no_budget: isRTL ? 'ميزانية غير مناسبة' : 'No budget', wrong_audience: isRTL ? 'جمهور خاطئ' : 'Wrong audience', duplicate: isRTL ? 'مكرر' : 'Duplicate', other: isRTL ? 'آخر' : 'Other' }[contact.disqualify_reason] || contact.disqualify_reason) },
        (contact.contact_status === 'disqualified' && contact.disqualify_note) && { label: isRTL ? 'ملاحظة' : 'Note', val: contact.disqualify_note },
      ].filter(Boolean),
    },
    // Dates group removed — created + last activity now in the hero meta row.
  ].filter(s => s.rows.length > 0);

  const rowCls = 'flex justify-between items-center py-2 border-b border-brand-500/[0.06] text-xs gap-3';

  // ── Date grouping helper ────────────────────────────────────────────
  const getDateGroup = (dateStr) => {
    if (!dateStr) return isRTL ? 'غير محدد' : 'Unknown';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (itemDay.getTime() === today.getTime()) return isRTL ? 'اليوم' : 'Today';
    if (itemDay.getTime() === yesterday.getTime()) return isRTL ? 'أمس' : 'Yesterday';
    const diffDays = Math.floor((today - itemDay) / 86400000);
    if (diffDays < 7) return isRTL ? 'هذا الأسبوع' : 'This Week';
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  // Group timeline by date
  // Pagination — show TIMELINE_PAGE_SIZE items at a time. The user can load
  // more when they hit the bottom. Avoids rendering 500+ DOM nodes for VIP
  // contacts with long histories.
  const TIMELINE_PAGE_SIZE = 50;
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_PAGE_SIZE);
  // Reset limit when contact changes or timeline filter changes — stale
  // pagination across contacts would silently hide the most recent items.
  useEffect(() => { setTimelineLimit(TIMELINE_PAGE_SIZE); }, [contact.id, timelineFilter]);

  const visibleTimeline = useMemo(
    () => filteredTimeline.slice(0, timelineLimit),
    [filteredTimeline, timelineLimit]
  );
  const hasMoreTimeline = filteredTimeline.length > timelineLimit;

  const groupedTimeline = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    visibleTimeline.forEach(item => {
      const label = getDateGroup(item._date);
      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });
    return groups;
  }, [visibleTimeline]);

  // ── Timeline Item Renderer ─────────────────────────────────────────────
  const renderTimelineItem = (item, isLast) => {
    const cfg = TIMELINE_CONFIG[item._type];
    const dateObj = item._date ? new Date(item._date) : null;
    const dateTimeStr = dateObj ? dateObj.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }) + ' · ' + dateObj.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';

    // Get who created this item
    const createdBy = (() => {
      if (item._type === 'activity') return isRTL ? (item.users?.full_name_ar || item.user_name_ar || item.user_name_en || 'مجهول') : (item.users?.full_name_en || item.user_name_en || item.users?.full_name_ar || item.user_name_ar || 'Unknown');
      if (item._type === 'task') return isRTL ? (item.users?.full_name_ar || item.assigned_to_name_ar || item.created_by_name || 'مجهول') : (item.users?.full_name_en || item.assigned_to_name_en || item.users?.full_name_ar || item.created_by_name || 'Unknown');
      if (item._type === 'opportunity') {
        // Both created_by_name and assigned_to_name are single-language
        // snapshots (whichever language the writer happened to use). Prefer
        // the one most likely to match the active locale: assigned_to_name
        // tends to be English (admin-typed), created_by_name often Arabic
        // (from RTL UI). Fall through both in either order, then agent_name.
        return isRTL
          ? (item.users?.full_name_ar || item.users?.full_name_en || item.created_by_name || item.assigned_to_name || item.agent_name || 'مجهول')
          : (item.users?.full_name_en || item.users?.full_name_ar || item.assigned_to_name || item.created_by_name || item.agent_name || 'Unknown');
      }
      if (item._type === 'comment') return item.author_name || (isRTL ? 'مجهول' : 'Unknown');
      if (item._type === 'document') return item.uploaded_by || (isRTL ? 'النظام' : 'System');
      if (item._type === 'audit') {
        // Prefer the resolved current name (joined via user_id in
        // getAuditLogs) over the stored user_name snapshot — keeps audit
        // entries up-to-date when an actor is renamed later.
        const liveName = isRTL
          ? (item.users?.full_name_ar || item.users?.full_name_en)
          : (item.users?.full_name_en || item.users?.full_name_ar);
        return liveName || item.user_name || (isRTL ? 'النظام' : 'System');
      }
      if (item._type === 'deal') return isRTL ? (item.agent_ar || 'مجهول') : (item.agent_en || item.agent_ar || 'Unknown');
      return '';
    })();

    const dotContent = (() => {
      if (item._type === 'activity') {
        const ActIcon = ACT_ICON_MAP[item.type] || cfg.defaultIcon;
        return <ActIcon size={11} color={cfg.color} />;
      }
      if (item._type === 'task') return <CheckSquare size={11} color={cfg.color} />;
      if (item._type === 'opportunity') return <Target size={11} color={cfg.color} />;
      if (item._type === 'comment') return <MessageSquare size={11} color={cfg.color} />;
      if (item._type === 'document') return <FileUp size={11} color={cfg.color} />;
      if (item._type === 'audit') return <History size={11} color={cfg.color} />;
      if (item._type === 'deal') return <Award size={11} color={cfg.color} />;
      return null;
    })();

    // Action type label
    const actionLabel = (() => {
      if (item._type === 'activity') {
        const labels = { call: { ar: 'مكالمة', en: 'Call' }, whatsapp: { ar: 'واتساب', en: 'WhatsApp' }, email: { ar: 'إيميل', en: 'Email' }, meeting: { ar: 'اجتماع', en: 'Meeting' }, site_visit: { ar: 'زيارة موقع', en: 'Site Visit' }, note: { ar: 'ملاحظة', en: 'Note' }, status_change: { ar: 'تغيير حالة', en: 'Status Change' } };
        return isRTL ? (labels[item.type]?.ar || 'نشاط') : (labels[item.type]?.en || 'Activity');
      }
      if (item._type === 'task') return isRTL ? 'مهمة' : 'Task';
      if (item._type === 'opportunity') return isRTL ? 'فرصة' : 'Opportunity';
      if (item._type === 'comment') return isRTL ? 'تعليق' : 'Comment';
      if (item._type === 'document') return isRTL ? 'مستند' : 'Document';
      if (item._type === 'audit') {
        const at = ACTION_TYPES[item.action];
        return isRTL ? (at?.ar || 'إجراء') : (at?.en || 'Action');
      }
      if (item._type === 'deal') return isRTL ? 'صفقة' : 'Deal';
      return '';
    })();

    // Meta line: type + who + when (shared across all types)
    const metaLine = (
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
        <span className="font-bold" style={{ color: cfg.color }}>{actionLabel}</span>
        <span className="opacity-30">|</span>
        <span className="font-medium text-content dark:text-content-dark">{createdBy}</span>
        {dateTimeStr && <><span className="opacity-30">|</span><span>{dateTimeStr}</span></>}
      </div>
    );

    const content = (() => {
      if (item._type === 'activity') {
        const actStatus = item.status || 'completed';
        const STATUS_COLORS = { scheduled: '#2F6BD3', completed: '#158A57', cancelled: '#D6403B' };
        const STATUS_LABELS = { scheduled: { ar: 'مجدول', en: 'Scheduled' }, completed: { ar: 'مكتمل', en: 'Completed' }, cancelled: { ar: 'ملغي', en: 'Cancelled' } };
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-content dark:text-content-dark leading-snug flex-1">{(() => {
                // For reassignments, prefer the embedded users' CURRENT names
                // (joined via from_user_id / to_user_id in fetchContactActivities)
                // so a later rename of an agent updates the timeline retroactively.
                // Fall back to the legacy notes text only when those FKs are NULL.
                if (item.type === 'reassignment' && (item.from_user || item.to_user)) {
                  const pickName = (u) => u && (isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar));
                  const fromName = pickName(item.from_user)
                    || (item.notes ? item.notes.split('→')[0]?.trim() : '—');
                  const toName = pickName(item.to_user)
                    || (item.notes ? item.notes.split('→')[1]?.split(':')[0]?.trim() : '');
                  return `${fromName || '—'} → ${toName || '—'}`;
                }
                // Re-translate a stored result KEY to the viewer's language and
                // keep the free note. The baked description was "<label> — <note>",
                // so strip the label prefix and re-prepend the translated one.
                const rl = item.result && resultLabels[item.result];
                if (rl) {
                  const label = (isRTL ? rl.ar : rl.en) || item.result;
                  let note = item.notes;
                  if (!note && item.description) {
                    const sep = item.description.indexOf(' — ');
                    note = sep >= 0 ? item.description.slice(sep + 3) : '';
                  }
                  return note ? `${label} — ${note}` : label;
                }
                return item.notes || item.description || (isRTL ? 'نشاط' : 'Activity');
              })()}</div>
              {actStatus !== 'completed' && (
                <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold shrink-0" style={{ background: STATUS_COLORS[actStatus] + '22', color: STATUS_COLORS[actStatus] }}>
                  {isRTL ? STATUS_LABELS[actStatus]?.ar : STATUS_LABELS[actStatus]?.en}
                </span>
              )}
            </div>
            {metaLine}
            {item.scheduled_date && (
              <div className="mt-1 text-[11px] flex items-center gap-1 text-blue-500">
                <Calendar size={10} />
                {new Date(item.scheduled_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {new Date(item.scheduled_date).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {actStatus === 'scheduled' && (
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={(e) => { e.stopPropagation(); handleUpdateActivityStatus(item.id, 'completed'); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer border-0 transition-colors"
                  style={{ background: '#158A5722', color: '#158A57' }}>
                  <Check size={10} /> {isRTL ? 'اكتمل' : 'Complete'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleUpdateActivityStatus(item.id, 'cancelled'); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer border-0 transition-colors"
                  style={{ background: '#D6403B22', color: '#D6403B' }}>
                  <XCircle size={10} /> {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}
            {item.next_action && (
              <div className="mt-1.5 px-2.5 py-1 bg-brand-500/[0.08] rounded-md text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">
                › {item.next_action}{item.next_action_date ? ` — ${item.next_action_date}` : ''}
              </div>
            )}
          </>
        );
      }
      if (item._type === 'task') {
        const pri = TASK_PRIORITIES[item.priority];
        const st = TASK_STATUSES[item.status];
        const due = new Date(item.due_date);
        const overdue = due < new Date() && item.status !== 'done';
        return (
          <>
            <div className={`text-xs font-semibold text-content dark:text-content-dark leading-snug ${item.status === 'done' ? 'line-through opacity-60' : ''}`}>
              {item.title}
            </div>
            {(item.notes || item.description) && (
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5 leading-relaxed">{item.notes || item.description}</div>
            )}
            {metaLine}
            <div className="flex gap-1.5 flex-wrap mt-1">
              <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold" style={{ background: (pri?.color || '#2F6BD3') + '22', color: pri?.color || '#2F6BD3' }}>
                {isRTL ? pri?.ar : pri?.en}
              </span>
              <span className="text-[10px] px-1.5 py-px rounded-[5px]" style={{ background: (st?.color || '#2F6BD3') + '22', color: st?.color || '#2F6BD3' }}>
                {isRTL ? st?.ar : st?.en}
              </span>
              {item.due_date && (
                <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                  <Clock size={9} /> {new Date(item.due_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                  {overdue && (isRTL ? ' (متأخر)' : ' (Overdue)')}
                </span>
              )}
            </div>
          </>
        );
      }
      if (item._type === 'opportunity') {
        return (
          <>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'فرصة' : 'Opp'} #{String(item.id).slice(-4)}</span>
              <Chip label={deptStageLabel(item.stage, dept, isRTL)} color="#158A57" bg="rgba(16,185,129,0.1)" />
            </div>
            {metaLine}
            <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex items-center gap-2 mt-0.5">
              {item.projects?.name_ar && <span>{isRTL ? item.projects.name_ar : (item.projects.name_en || item.projects.name_ar)}</span>}
              {item.budget > 0 && <><span className="opacity-40">·</span><span>{fmtBudget(item.budget, null, isRTL)}</span></>}
            </div>
          </>
        );
      }
      if (item._type === 'comment') {
        // Highlight @mentions in text
        const renderText = (text) => {
          if (!text) return '';
          const parts = text.split(/(@\S+)/g);
          return parts.map((p, i) => p.startsWith('@') ? <span key={i} style={{ color: '#5A63C4', fontWeight: 600 }}>{p}</span> : p);
        };
        return (
          <>
            <div className="text-xs text-content dark:text-content-dark leading-relaxed">{renderText(item.text)}</div>
            {metaLine}
          </>
        );
      }
      if (item._type === 'document') {
        const docType = DOCUMENT_TYPES?.[item.type];
        return (
          <>
            <div className="text-xs font-semibold text-content dark:text-content-dark">{item.name || item.file_name}</div>
            {metaLine}
            <div className="flex gap-1.5 flex-wrap mt-1">
              {docType && (
                <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold" style={{ background: (docType.color || '#6B7280') + '22', color: docType.color || '#6B7280' }}>
                  {isRTL ? docType.ar : docType.en}
                </span>
              )}
              {item.file_size > 0 && <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{(item.file_size / 1024).toFixed(0)} KB</span>}
            </div>
          </>
        );
      }
      if (item._type === 'audit') {
        const desc = item.description || (isRTL ? (ACTION_TYPES[item.action]?.ar || item.action) : (ACTION_TYPES[item.action]?.en || item.action));
        const changes = item.changes ? Object.entries(item.changes) : [];
        return (
          <>
            <div className="text-xs text-content dark:text-content-dark">{desc}</div>
            {metaLine}
            {changes.length > 0 && changes.length <= 3 && (
              <div className="mt-1.5 text-[10px] space-y-0.5">
                {changes.map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1 text-content-muted dark:text-content-muted-dark">
                    <span className="font-medium">{key}:</span>
                    <span className="line-through text-red-400">{String(val.from ?? '—').slice(0, 20)}</span>
                    <span className="opacity-40">→</span>
                    <span className="text-emerald-500">{String(val.to ?? '—').slice(0, 20)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      }
      if (item._type === 'deal') {
        return (
          <>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-content dark:text-content-dark">{item.deal_number || (isRTL ? 'صفقة' : 'Deal')}</span>
              <Chip label={isRTL ? 'تم الإغلاق' : 'Closed Won'} color="#0B5A53" bg="rgba(15,118,110,0.1)" />
            </div>
            {metaLine}
            <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex items-center gap-2 mt-0.5">
              {item.deal_value > 0 && <span className="font-bold text-emerald-500">{Number(item.deal_value).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>}
              {(item.project_ar || item.project_en) && <><span className="opacity-40">·</span><span>{isRTL ? item.project_ar : (item.project_en || item.project_ar)}</span></>}
            </div>
          </>
        );
      }
      return null;
    })();

    return (
      <div key={`${item._type}-${item.id}`} className="flex gap-0 relative">
        {/* Line + Dot */}
        <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
          <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 bg-surface-card dark:bg-surface-card-dark z-[1]" style={{ borderColor: cfg.color, background: cfg.bg }}>
            {dotContent}
          </div>
          {!isLast && <div className="w-px flex-1 min-h-[16px]" style={{ background: `${cfg.color}30` }} />}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 pb-4 ps-2.5 pt-0.5">
          {content}
        </div>
      </div>
    );
  };

  // ── Dept-specific tab labels ─────────────────────────────────────────────
  const tabs = [
    { key: 'activity', label: isRTL ? 'السجل' : 'Timeline', icon: Clock },
    { key: 'deal', label: isRTL ? 'الصفقة' : 'Deal', icon: DollarSign },
    { key: 'meetings', label: isRTL ? 'اجتماعات' : 'Meetings', icon: Users },
    // Old sales "Opportunities" tab is retired — the Deal tab replaces it.
    // Non-sales depts keep their tab (recruitment / campaigns / orders / invoices).
    ...(deptTab.key === 'opportunities' ? [] : [{ key: deptTab.key, label: isRTL ? deptTab.label_ar : deptTab.label_en, icon: deptTab.icon }]),
    { key: 'units', label: isRTL ? 'وحدات للبيع' : 'Units', icon: Building2 },
    { key: 'comments', label: isRTL ? 'تعليقات' : 'Comments', icon: MessageSquare },
    { key: 'documents', label: isRTL ? 'المستندات' : 'Documents', icon: FileText },
    { key: 'data', label: isRTL ? 'البيانات' : 'Data', icon: Briefcase },
    // Admin/operations-only oversight tab: full change history + who viewed.
    ...(isAdmin ? [{ key: 'audit', label: isRTL ? 'السجل الكامل' : 'Audit', icon: History }] : []),
  ];

  // ── Per-agent status badges for the hero — one chip per assigned agent.
  // Viewer's chip is ringed so they spot themselves at a glance.
  // Next follow-up for the hero — derived from the earliest pending task (same
  // fact the leads list shows), so the rep instantly sees the next step and
  // whether it's overdue the moment the drawer opens.
  const nextFollowup = useMemo(() => {
    const pending = (tasks || []).filter(t => t.status === 'pending' && t.due_date);
    if (!pending.length) return null;
    const now = Date.now();
    let nextDue = null, overdue = 0;
    for (const t of pending) {
      if (!nextDue || new Date(t.due_date) < new Date(nextDue)) nextDue = t.due_date;
      if (new Date(t.due_date).getTime() < now) overdue += 1;
    }
    return { next_due: nextDue, pending_count: pending.length, overdue_count: overdue };
  }, [tasks]);

  // heroStatusChips (per-agent status pills) retired — status now shows in the
  // hero STATE BAR (single Status segment) alongside Temperature + Score.

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { await onUpdate(updated); }} userRole={profile?.role} campaigns={campaignsList} />}
    {showDistribute && <DistributeLeadModal contact={contact} onClose={() => setShowDistribute(false)} onSuccess={() => { /* Created clones — list will refresh on next nav */ }} />}
    {showPullLeads && <PullOtherLeadsModal contact={contact} onClose={() => setShowPullLeads(false)} onSuccess={() => { /* Pulled — agents will see disqualified records on refresh */ }} />}
    {showHandOff && <HandOffLeadModal contact={contact} onClose={() => setShowHandOff(false)} onSuccess={() => { onClose?.(); /* lead now belongs to someone else; close the drawer */ }} />}

    {/* Quick Campaign Edit Modal */}
    <div className="fixed inset-0 z-[900] flex" dir={isRTL ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-labelledby="drawer-contact-name">
      {/* Backdrop */}
      <div onClick={onClose} className="flex-1 bg-black/50 backdrop-blur-[2px]" aria-hidden="true" />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`contact-drawer relative w-[480px] md:w-[580px] max-w-[100vw] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden shadow-2xl ${isRTL ? 'border-s' : 'border-e'} border-edge dark:border-edge-dark`}
      >
        {/* ═══ FLOATING ACTION STACK — Log (opens the speed-dial) · Call · WhatsApp.
            Icon-only, translucent + blurred so they never hide the timeline; each
            shows its name for a moment on drawer-open and again on hover. ═══ */}
        {canEditContact && !showActionForm && (
          <div ref={fabRef}>
            {showLogMenu && (
              <div className="absolute bottom-[74px] end-5 z-40 flex flex-col-reverse items-end gap-2" role="menu">
                {[
                  { key: 'call', ar: 'مكالمة', en: 'Call', Icon: Phone, color: '#2F6BD3', open: () => { setActionPresetType('call'); setShowActionForm(true); } },
                  { key: 'whatsapp', ar: 'واتساب', en: 'WhatsApp', Icon: MessageCircle, color: '#158A57', open: () => { setActionPresetType('whatsapp'); setShowActionForm(true); } },
                  { key: 'meeting', ar: 'اجتماع', en: 'Meeting', Icon: Users, color: '#2B4C6F', open: () => setMeetingModal({ mode: 'happened' }) },
                  { key: 'note', ar: 'ملاحظة', en: 'Note', Icon: Pencil, color: '#C9860A', open: () => { setActionPresetType('note'); setShowActionForm(true); } },
                  { key: 'deal', ar: 'صفقة', en: 'Deal', Icon: DollarSign, color: '#5A63C4', open: () => setDealModal({ status: 'reserved', dealId: null }) },
                ].map(t => (
                  <button key={t.key} role="menuitem"
                    onClick={() => { setShowLogMenu(false); t.open(); }}
                    className="inline-flex items-center gap-2 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-full ps-1.5 pe-3.5 py-1.5 shadow-lg cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: t.color + '1A', color: t.color }}><t.Icon size={15} /></span>
                    <span className="text-[12.5px] font-semibold text-content dark:text-content-dark">{isRTL ? t.ar : t.en}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="absolute bottom-5 end-5 z-40 flex flex-col-reverse items-end gap-3">
              {/* Log (bottom, nearest the thumb) — opens the speed-dial menu.
                  Each FAB shows its name ONLY on hover (no timed auto-label). */}
              <div className="group flex items-center gap-2">
                <span className="text-[12px] font-semibold bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark px-2.5 py-1 rounded-full border border-edge dark:border-edge-dark shadow-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">{isRTL ? 'سجّل' : 'Log'}</span>
                <button
                  onClick={() => setShowLogMenu(v => !v)}
                  aria-label={isRTL ? 'سجّل تواصل' : 'Log interaction'}
                  aria-expanded={showLogMenu}
                  aria-haspopup="menu"
                  className="w-[54px] h-[54px] rounded-full flex items-center justify-center bg-brand-500 hover:bg-brand-600 text-white border border-brand-600 cursor-pointer shadow-lg shadow-brand-500/30 transition-all active:scale-95"
                >
                  {showLogMenu ? <X size={22} /> : <Plus size={22} />}
                </button>
              </div>
              {/* Call (middle) — dials directly. Hidden while the menu is open. */}
              {!showLogMenu && contact.phone && (
                <div className="group flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <span className="text-[12px] font-semibold bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark px-2.5 py-1 rounded-full border border-edge dark:border-edge-dark shadow-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">{isRTL ? 'اتصال' : 'Call'}</span>
                  <a href={`tel:${contact.phone}`} aria-label={isRTL ? 'اتصال' : 'Call'}
                    className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 border border-edge dark:border-edge-dark backdrop-blur-md no-underline cursor-pointer transition-all active:scale-95"
                    style={{ background: 'color-mix(in srgb, #378ADD 20%, transparent)' }}>
                    <Phone size={22} />
                  </a>
                </div>
              )}
              {/* WhatsApp (top) — opens the chat directly. Hidden while the menu is open. */}
              {!showLogMenu && contact.phone && (
                <div className="group flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <span className="text-[12px] font-semibold bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark px-2.5 py-1 rounded-full border border-edge dark:border-edge-dark shadow-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">{isRTL ? 'واتساب' : 'WhatsApp'}</span>
                  <button onClick={openWhatsAppDirect} aria-label={isRTL ? 'فتح واتساب' : 'Open WhatsApp'}
                    className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-300 border border-edge dark:border-edge-dark backdrop-blur-md cursor-pointer transition-all active:scale-95"
                    style={{ background: 'color-mix(in srgb, #1D9E75 20%, transparent)' }}>
                    <MessageCircle size={22} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ═══ STICKY TOP BAR ═══ */}
        <div className="shrink-0 sticky top-0 z-10 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm border-b border-edge dark:border-edge-dark">
          <div className="flex items-center justify-between h-11 px-3">
            {/* Left: mobile back button OR desktop nav arrows */}
            <div className="flex items-center gap-0.5">
              {/* Mobile-only "Back" — arrows are useless on touch and the X
                  on the right is too small to be a clear "go back" affordance.
                  This button gives field agents a confident way out. */}
              <button onClick={onClose}
                className="md:hidden flex items-center gap-1 h-8 px-2 rounded-md bg-transparent border-none text-content dark:text-content-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark active:scale-95 transition-all">
                {isRTL ? <ChevronDown size={16} className="rotate-90" /> : <ChevronDown size={16} className="-rotate-90" />}
                <span className="text-xs font-semibold">{isRTL ? 'القائمة' : 'Back'}</span>
              </button>
              {/* Desktop nav arrows */}
              {onPrev && (
                <button onClick={onPrev} title={isRTL ? 'السابق' : 'Previous'}
                  className="hidden md:flex w-8 h-8 rounded-md items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors">
                  <ChevronUp size={16} />
                </button>
              )}
              {onNext && (
                <button onClick={onNext} title={isRTL ? 'التالي' : 'Next'}
                  className="hidden md:flex w-8 h-8 rounded-md items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors">
                  <ChevronDown size={16} />
                </button>
              )}
            </div>

            {/* Center: contact name */}
            <span id="drawer-contact-name" className="text-xs font-semibold text-content dark:text-content-dark truncate max-w-[200px] px-2">
              {contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
            </span>

            {/* Right: More menu + close */}
            <div className="flex items-center gap-0.5 relative">
              <button onClick={() => setShowDrawerMenu(p => !p)} aria-label={isRTL ? 'المزيد من الإجراءات' : 'More actions'} aria-expanded={showDrawerMenu} aria-haspopup="menu"
                className={`w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors ${showDrawerMenu ? 'text-brand-500 bg-brand-500/10' : 'text-content-muted dark:text-content-muted-dark hover:bg-surface-bg dark:hover:bg-brand-500/10'}`}>
                <MoreVertical size={16} />
              </button>
              <button onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}
                className="w-11 h-11 md:w-8 md:h-8 rounded-md flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-red-500/10 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
              {/* Dropdown — anchored to the More button in this top bar */}
              {showDrawerMenu && (
                <>
                  <div className="fixed inset-0 z-[99]" onClick={() => setShowDrawerMenu(false)} />
                  <div role="menu" className="absolute top-full end-0 mt-1 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[210px] max-w-[calc(100vw-2rem)] z-[100] shadow-[0_12px_40px_rgba(27,51,71,0.18)] overflow-hidden">
                    {(() => {
                      const isLeader = isAdmin || profile?.role === 'sales_manager' || profile?.role === 'team_leader';
                      const itemCls = "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10";
                      const sectionLabelCls = "text-[9px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark px-3 pt-2 pb-1";
                      const Divider = () => <div className="h-px bg-edge dark:bg-edge-dark mx-1 my-1" />;
                      const groups = [
                        // Edit (single primary action)
                        canEditContact && (
                          <button key="edit" onClick={() => { setShowEdit(true); setShowDrawerMenu(false); }} className={itemCls}>
                            <Pencil size={13} className="text-brand-500" /> {isRTL ? 'تعديل البيانات' : 'Edit Lead'}
                          </button>
                        ),
                        // Communicate group
                        (contact.email || contact.phone) && (
                          <div key="communicate">
                            {canEditContact && <Divider />}
                            <div className={sectionLabelCls}>{isRTL ? 'تواصل' : 'Communicate'}</div>
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} onClick={() => setShowDrawerMenu(false)} className={`${itemCls} no-underline`}>
                                <Mail size={13} className="text-brand-500" /> {isRTL ? 'إرسال إيميل' : 'Send Email'}
                              </a>
                            )}
                            {contact.phone && (
                              <button onClick={() => { setShowWAPopup(true); setShowDrawerMenu(false); }} className={itemCls}>
                                <MessageCircle size={13} className="text-emerald-600" /> {isRTL ? 'واتساب بقالب' : 'WhatsApp with template'}
                              </button>
                            )}
                            {contact.phone && (
                              <button onClick={() => { setShowSMSModal(true); setShowDrawerMenu(false); }} className={itemCls}>
                                <Send size={13} className="text-brand-500" /> {isRTL ? 'إرسال SMS' : 'Send SMS'}
                              </button>
                            )}
                            {/* "Log Call" retired from the drawer — logging a call
                                now goes through the "+ سجّل" FAB → Call (unified
                                path). LogCallModal still serves the list/card rows. */}
                          </div>
                        ),
                        // Personal group
                        <div key="personal">
                          <Divider />
                          <div className={sectionLabelCls}>{isRTL ? 'شخصي' : 'Personal'}</div>
                          <button onClick={handleToggleFav} className={itemCls}>
                            <Star size={13} className={isFav ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'} fill={isFav ? '#C9860A' : 'none'} />
                            {isFav ? (isRTL ? 'إزالة المفضلة' : 'Unfavorite') : (isRTL ? 'إضافة للمفضلة' : 'Favorite')}
                          </button>
                          {onPin && (
                            <button onClick={() => { onPin(contact.id); setShowDrawerMenu(false); }} className={itemCls}>
                              <Pin size={13} className={isPinned ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'} />
                              {isPinned ? (isRTL ? 'إلغاء التثبيت' : 'Unpin') : (isRTL ? 'تثبيت' : 'Pin')}
                            </button>
                          )}
                          {onReminder && (
                            <button onClick={() => { onReminder(contact); setShowDrawerMenu(false); }} className={itemCls}>
                              <Bell size={13} className="text-amber-500" /> {isRTL ? 'تذكير' : 'Reminder'}
                            </button>
                          )}
                        </div>,
                        // Tools group
                        <div key="tools">
                          <Divider />
                          <div className={sectionLabelCls}>{isRTL ? 'أدوات' : 'Tools'}</div>
                          {/* "Close Deal" removed — deals are logged from the Deal tab. */}
                          <button onClick={() => { setShowPrintPreview(true); setShowDrawerMenu(false); }} className={itemCls}>
                            <FileDown size={13} className="text-brand-500" /> {isRTL ? 'طباعة' : 'Print'}
                          </button>
                          {isAdmin && contact.phone && (
                            <button onClick={() => { window.open(`/contacts/master/${encodeURIComponent(contact.phone)}`, '_blank'); setShowDrawerMenu(false); }} className={itemCls}>
                              <Users size={13} className="text-purple-500" /> {isRTL ? 'البروفايل الموحد' : 'Master Profile'}
                            </button>
                          )}
                        </div>,
                        // Lead Management group (managers/leaders only)
                        isLeader && (
                          <div key="leadmgmt">
                            <Divider />
                            <div className={sectionLabelCls}>{isRTL ? 'إدارة الليد' : 'Lead Management'}</div>
                            <button onClick={() => { setShowHandOff(true); setShowDrawerMenu(false); }} className={itemCls}>
                              <Send size={13} className="text-blue-500" /> {isRTL ? 'تسليم الليد' : 'Hand Off Lead'}
                            </button>
                            <button onClick={() => { setShowDistribute(true); setShowDrawerMenu(false); }} className={itemCls}>
                              <Send size={13} className="text-purple-500" /> {isRTL ? 'توزيع للمنافسة' : 'Distribute (compete)'}
                            </button>
                            {isAdmin && contact.phone && (
                              <button onClick={() => { setShowPullLeads(true); setShowDrawerMenu(false); }} className={itemCls}>
                                <Award size={13} className="text-green-600" /> {isRTL ? 'سحب الليد من الباقي' : 'Pull from Others'}
                              </button>
                            )}
                          </div>
                        ),
                        // Danger group
                        ((onDelete && canDeleteContact) || (!contact.is_blacklisted && canEditContact)) && (
                          <div key="danger">
                            <Divider />
                            <div className={`${sectionLabelCls} text-red-500/70 dark:text-red-400/70`}>{isRTL ? 'منطقة الخطر' : 'Danger Zone'}</div>
                            {onDelete && canDeleteContact && (
                              <button onClick={() => {
                                if (window.confirm(isRTL ? `حذف الليد "${contact.full_name}"؟ لا يمكن التراجع عن العملية.` : `Delete lead "${contact.full_name}"? This action cannot be undone.`)) {
                                  onDelete(contact.id);
                                  setShowDrawerMenu(false);
                                }
                              }} className={`${itemCls} text-red-500 hover:bg-red-500/[0.05]`}>
                                <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                              </button>
                            )}
                          </div>
                        ),
                      ];
                      return <div className="p-1">{groups.filter(Boolean)}</div>;
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          {/* ═══ HERO SECTION ═══ */}
          <div className="px-5 pt-4 pb-3">
            {/* Identity row: avatar + name + subtitle */}
            <div className="flex items-start gap-3 mb-3">
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-base font-bold shadow-sm ${
                contact.is_blacklisted
                  ? 'bg-red-500/15 text-red-500 border border-red-500/25'
                  : tp?.color
                    ? ''
                    : 'bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white'
              }`}
                style={!contact.is_blacklisted && tp?.color ? { background: `linear-gradient(135deg, ${tp.color}30, ${tp.color}15)`, color: tp.color, border: `1px solid ${tp.color}20` } : undefined}
              >
                {contact.is_blacklisted ? <Ban size={20} /> : initials(contact.full_name)}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className={`m-0 text-base font-bold leading-tight ${contact.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                    {contact.prefix && <span className="text-[#6B8DB5] font-medium me-1 text-sm">{contact.prefix}</span>}
                    {contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                  </h2>
                  {isPinned && (
                    <Pin
                      size={13}
                      className="text-amber-500 shrink-0"
                      fill="#C9860A"
                      aria-label={isRTL ? 'مثبّت' : 'Pinned'}
                    />
                  )}
                </div>
                {/* Identity badges row: type, dept, contact_number, blacklisted */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                  {contact.department && (
                    <Chip
                      label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department}
                      color="#8BA8C8" bg="rgba(139,168,200,0.1)"
                    />
                  )}
                  {contact.contact_number && (
                    <span className="text-[10px] font-mono font-medium text-content-muted dark:text-content-muted-dark bg-brand-500/[0.06] px-1.5 py-0.5 rounded-full">
                      {contact.contact_number}
                    </span>
                  )}
                  {contact.is_blacklisted && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                      <Ban size={10} /> {isRTL ? 'بلاك ليست' : 'Blacklisted'}
                    </span>
                  )}
                </div>
                {/* Attribution fields live below (full-width label:value rows). */}
              </div>
            </div>

                        {/* ═══ KEY FIELDS — compact 2-column grid (Dense direction). Uses the
              drawer width properly; full detail lives in the Data tab. ═══ */}
          {(() => {
            const propType = { residential: isRTL ? 'سكني' : 'Residential', commercial: isRTL ? 'تجاري' : 'Commercial', administrative: isRTL ? 'إداري' : 'Administrative' };
            const cells = [
              contact.phone && { k: isRTL ? 'الهاتف' : 'Phone', v: contact.phone, ltr: true },
              contact.source && { k: isRTL ? 'المصدر' : 'Source', v: isRTL ? (SOURCE_LABELS[contact.source] || contact.source) : (SOURCE_EN[contact.source] || contact.source) },
              contact.campaign_name && { k: isRTL ? 'الحملة' : 'Campaign', v: contact.campaign_name },
              (contact.budget_min || contact.budget_max) && { k: isRTL ? 'الميزانية' : 'Budget', v: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
              contact.interested_in_type && { k: isRTL ? 'مهتم بـ' : 'Interested', v: propType[contact.interested_in_type] || contact.interested_in_type },
            ].filter(Boolean);
            if (!cells.length) return null;
            return (
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 mb-4">
                {cells.map((f, i) => (
                  <div key={i} className="min-w-0">
                    <div className="text-[9.5px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{f.k}</div>
                    <div className="text-[12.5px] font-semibold text-content dark:text-content-dark mt-0.5 truncate" dir={f.ltr ? 'ltr' : undefined}>{f.v}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ═══ STATE BAR — Status · Temperature · Score in one structured,
                bordered row (matching the fields grid). Segments open a change
                popover; non-editors see them read-only. ═══ */}
            {(() => {
              const STATUS_OPTS = [
                { v: 'new', label: isRTL ? 'جديد' : 'New', color: '#2F6BD3' },
                { v: 'contacted', label: isRTL ? 'تم التواصل' : 'Contacted', color: '#C9860A' },
                { v: 'following', label: isRTL ? 'متابعة' : 'Following', color: '#158A57' },
                { v: 'has_opportunity', label: isRTL ? 'لديه فرصة' : 'Has Opportunity', color: '#117049' },
                { v: 'disqualified', label: isRTL ? 'غير مؤهل' : 'Disqualified', color: '#D6403B' },
              ];
              const cur = STATUS_OPTS.find(s => s.v === contact.contact_status);
              const canEditState = (isOwner || isManagerViewer) && canEditContact;
              const segBtn = 'w-full px-3 py-2 text-start flex items-center justify-between gap-1.5 bg-transparent border-none';
              const segLbl = 'block text-[9px] uppercase tracking-wide text-content-muted dark:text-content-muted-dark';
              return (
                <div className="flex items-stretch rounded-xl border border-edge dark:border-edge-dark mb-3">
                  {/* Status */}
                  <div className="flex-1 min-w-0 relative">
                    <button type="button" onClick={canEditState ? () => setShowQuickStatus(s => !s) : undefined}
                      className={`${segBtn} ${canEditState ? 'cursor-pointer' : 'cursor-default'}`} aria-haspopup={canEditState ? 'menu' : undefined} aria-expanded={showQuickStatus}>
                      <span className="min-w-0">
                        <span className={segLbl}>{isRTL ? 'الحالة' : 'Status'}</span>
                        <span className="block text-[12.5px] font-bold truncate" style={{ color: cur?.color || undefined }}>{cur?.label || (isRTL ? 'غير محدد' : '—')}</span>
                      </span>
                      {canEditState && <ChevronDown size={13} className="opacity-50 shrink-0" />}
                    </button>
                    {showQuickStatus && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowQuickStatus(false)} />
                        <div role="menu" className="absolute top-full mt-1.5 start-0 z-[61] min-w-[180px] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg overflow-hidden">
                          {STATUS_OPTS.map(opt => {
                            const isCurrent = opt.v === contact.contact_status;
                            return (
                              <button key={opt.v} role="menuitem"
                                onClick={() => { setShowQuickStatus(false); if (isCurrent) return; if (opt.v === 'disqualified' && onRequestDisqualify) onRequestDisqualify(contact); else handleStatusChange(opt.v); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-none bg-transparent text-start hover:bg-brand-500/10 ${isCurrent ? 'font-bold' : ''}`}
                                style={isCurrent ? { color: opt.color, background: opt.color + '12' } : undefined}>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                                <span className="flex-1">{opt.label}</span>
                                {isCurrent && <Check size={12} style={{ color: opt.color }} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="w-px bg-edge dark:bg-edge-dark shrink-0" />
                  {/* Temperature */}
                  <div className="flex-1 min-w-0 relative">
                    <button type="button" onClick={canEditState ? () => setShowQuickTemp(s => !s) : undefined}
                      className={`${segBtn} ${canEditState ? 'cursor-pointer' : 'cursor-default'}`} aria-haspopup={canEditState ? 'menu' : undefined} aria-expanded={showQuickTemp}>
                      <span className="min-w-0">
                        <span className={segLbl}>{isRTL ? 'الحرارة' : 'Temp'}</span>
                        <span className="flex items-center gap-1 text-[12.5px] font-bold truncate" style={{ color: tempInfo?.color || undefined }}>
                          {tempInfo?.Icon && <tempInfo.Icon size={12} />}
                          {tempInfo ? (isRTL ? tempInfo.labelAr : tempInfo.label) : (isRTL ? 'غير محدد' : '—')}
                        </span>
                      </span>
                      {canEditState && <ChevronDown size={13} className="opacity-50 shrink-0" />}
                    </button>
                    {showQuickTemp && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowQuickTemp(false)} />
                        <div role="menu" className="absolute top-full mt-1.5 start-0 z-[61] min-w-[160px] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg overflow-hidden p-1">
                          {['hot', 'warm', 'cool', 'cold'].map(v => {
                            const opt = TEMP[v];
                            const isCurrent = contact.temperature === v;
                            return (
                              <button key={v} role="menuitem"
                                onClick={() => { setShowQuickTemp(false); if (!isCurrent) handleTemperatureChange(v); }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border-none bg-transparent text-start hover:bg-edge/40 dark:hover:bg-edge-dark/40 ${isCurrent ? 'font-bold' : ''}`}
                                style={isCurrent && opt ? { color: opt.color, background: opt.color + '14' } : undefined}>
                                {opt?.Icon && <opt.Icon size={13} color={opt.color} />}
                                <span style={{ color: opt?.color }} className="flex-1">{isRTL ? opt?.labelAr : opt?.label}</span>
                                {isCurrent && <Check size={12} style={{ color: opt?.color }} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  {contact.assigned_to_name && (
                    <>
                      <div className="w-px bg-edge dark:bg-edge-dark shrink-0" />
                      <div className="flex-1 min-w-0 px-3 py-2">
                        <span className={segLbl}>{isRTL ? 'المسؤول' : 'Owner'}</span>
                        <span className="block text-[12.5px] font-bold text-content dark:text-content-dark truncate">{contact.assigned_to_name}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ═══ NEXT FOLLOW-UP — a display strip (tinted by urgency); the single
              most important triage fact. Read-only — set via a logged action. ═══ */}
          {canEditContact && nextFollowup && (() => {
            const fu = nextFollowup;
            const due = new Date(fu.next_due);
            const overdue = fu.overdue_count > 0;
            const isToday = due.toDateString() === new Date().toDateString();
            const tone = overdue
              ? { wrap: 'bg-red-500/10 border-red-500/25', ic: 'bg-red-500', l: 'text-red-600 dark:text-red-400' }
              : isToday
                ? { wrap: 'bg-amber-500/10 border-amber-500/25', ic: 'bg-amber-500', l: 'text-amber-600 dark:text-amber-400' }
                : { wrap: 'bg-brand-500/10 border-brand-500/25', ic: 'bg-brand-500', l: 'text-brand-600 dark:text-brand-400' };
            const dateFmt = due.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' }) + ' · ' + due.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
            return (
              <div className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border mb-3 ${tone.wrap}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${tone.ic}`}><Bell size={15} /></span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[9.5px] font-bold uppercase tracking-wide ${tone.l}`}>
                    {isRTL ? 'المتابعة الجاية' : 'Next follow-up'}{overdue ? ` · ${fu.overdue_count} ${isRTL ? 'متأخرة' : 'overdue'}` : ''}
                  </span>
                  <span className="block text-[13px] font-bold text-content dark:text-content-dark truncate">{dateFmt}</span>
                </span>
              </div>
            );
          })()}

          {/* Dates footer — created + last activity, each with day + time. */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-[10.5px] text-content-muted dark:text-content-muted-dark">
            {contact.created_at && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" />
                {isRTL ? 'أُنشئ' : 'Created'} {new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(contact.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {contact.last_activity_at && (() => {
              const d = daysSince(contact.last_activity_at);
              const tone = d <= 3 ? 'text-emerald-600 dark:text-emerald-400' : d <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500';
              const rel = d === 0 ? (isRTL ? 'اليوم' : 'today') : (isRTL ? `منذ ${d} يوم` : `${d}d ago`);
              return (
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} aria-hidden="true" />
                  {isRTL ? 'آخر نشاط' : 'Last activity'} {new Date(contact.last_activity_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} · {new Date(contact.last_activity_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  <span className={`font-semibold ${tone}`}>· {rel}</span>
                </span>
              );
            })()}
          </div>
          {/* end hero outer wrapper continues to wrap the rest of the content; closes much later */}

          {/* Direct-comms (Call · WhatsApp) moved to the floating action stack at
              the bottom of the drawer — the hero stays pure info now. */}

            {/* Quick-note composer removed — notes are logged via the "+ سجّل"
                FAB → Note (full note form). */}

            {/* ═══ WHATSAPP QUICK SEND POPUP ═══ */}
            {showWAPopup && contact.phone && (
              <WhatsAppQuickPopup contact={contact} isRTL={isRTL} onClose={() => setShowWAPopup(false)} onLogInteraction={handleLogInteraction} />
            )}

            {/* Info grid, notes, and assignment-history moved to the Data tab;
                the privacy notice moved above the timeline (Activity tab). The
                hero now stays lean: identity + status/temp + next follow-up. */}
          </div>

          {/* AGENT PROFILE SELECTOR + per-agent Status/Temp panel removed:
              after Phase 3 single-assignment there's exactly one agent per
              contact, and status/temp are now both edited inline from the hero
              (the status chip and the temperature chip each open a popover).
              The block was redundant noise. */}

          {/* ═══ TAB NAV + CONTENT ═══
              Vertical rail on every viewport (slim on mobile to preserve
              content width). Only the active section renders — no long scroll. */}
          <div className="flex items-start">
            <div role="tablist" className="sticky top-0 z-[5] bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm border-e border-edge dark:border-edge-dark flex flex-col gap-1.5 px-1.5 py-3 scrollbar-none w-[72px] md:w-[92px] shrink-0 self-start">
              {tabs.map(t => {
                const TabIcon = t.icon;
                const isActive = tab === t.key;
                const badge =
                  t.key === 'activity' ? timeline.length :
                  t.key === 'deal' ? dealRows.length :
                  t.key === 'meetings' ? (activities || []).filter(a => a.type === 'meeting').length :
                  t.key === deptTab.key ? oppCount :
                  t.key === 'comments' ? extraSources.comments.length :
                  t.key === 'documents' ? extraSources.documents.length :
                  null;
                const ariaLabel = badge > 0
                  ? (isRTL ? `${t.label}، ${badge} عنصر` : `${t.label}, ${badge} items`)
                  : t.label;
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setTab(t.key);
                      // Mount the section on demand (heavy sections self-fetch,
                      // so we only pay for the tab the user actually opens).
                      setMountedSections(prev => prev.has(t.key) ? prev : new Set([...prev, t.key]));
                    }}
                    title={t.label}
                    role="tab" aria-selected={isActive} aria-label={ariaLabel}
                    className={`relative w-full inline-flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-brand-500 text-white border-brand-500 font-bold shadow-sm shadow-brand-500/20'
                        : 'bg-transparent border-transparent text-content-muted dark:text-content-muted-dark font-semibold hover:bg-surface-bg dark:hover:bg-brand-500/10 hover:text-content dark:hover:text-content-dark'
                    }`}>
                    <TabIcon size={17} aria-hidden="true" />
                    <span className="text-[9.5px] leading-tight text-center">{t.label}</span>
                    {badge > 0 && (
                      <span aria-hidden="true" className={`absolute top-1 end-1 text-[9px] font-bold min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-1 ${
                        isActive ? 'bg-white/25 text-white' : 'bg-brand-500/10 text-brand-500'
                      }`}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

          {/* ═══ TAB CONTENT — only the active section renders ═══ */}
          <div id="drawer-tab-content" className="p-4 flex-1 min-w-0">

            {/* ══════ ACTIVITY ══════ */}
            <section id="sec-activity" data-section-key="activity" className={tab === 'activity' ? 'mb-4' : 'hidden'}>
              <div>
                {/* Logging happens through the "+ سجّل" FAB (call/whatsapp/note/
                    meeting/deal); the timeline below is read-only history. */}

                {/* Privacy notice — activities before the current agent's
                    assignment are hidden (moved here from the hero). */}
                {hidePreviousHistory && myAssignmentDate && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-brand-500/[0.05] border border-brand-500/10">
                    <p className="m-0 text-[10px] text-brand-500 font-medium">
                      {isRTL
                        ? `بتشوف الأنشطة من ${myAssignmentDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })} — الأنشطة السابقة مخفية`
                        : `Showing activities from ${myAssignmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — previous history hidden`}
                    </p>
                  </div>
                )}

                {/* Timeline Filter Chips */}
                {!loadingData && timeline.length > 0 && (
                  <div className="flex gap-1.5 mb-3 flex-wrap">
                    {[
                      { key: 'all', label: isRTL ? 'الكل' : 'All', count: timeline.length },
                      { key: 'activity', label: isRTL ? 'نشاط' : 'Activities', count: timeline.filter(i => i._type === 'activity').length },
                      { key: 'task', label: isRTL ? 'مهام' : 'Tasks', count: timeline.filter(i => i._type === 'task').length },
                    ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                      <button key={f.key} onClick={() => setTimelineFilter(f.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${
                          timelineFilter === f.key
                            ? 'bg-brand-500 text-white border-brand-500 font-bold shadow-sm shadow-brand-500/15'
                            : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-medium hover:border-brand-500/30 hover:text-brand-500'
                        }`}>
                        {f.label} {f.count > 0 ? `(${f.count})` : ''}
                      </button>
                    ))}
                  </div>
                )}

                {/* Agent Filter Chips */}
                {!loadingData && uniqueAgents.length > 1 && (
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    <button
                      onClick={() => setActivityAgentFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${
                        activityAgentFilter === 'all'
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-medium hover:border-amber-500/30'
                      }`}
                    >
                      {isRTL ? 'كل الموظفين' : 'All Agents'}
                    </button>
                    {uniqueAgents.map(ag => (
                      <button
                        key={ag.id}
                        onClick={() => setActivityAgentFilter(activityAgentFilter === ag.id ? 'all' : ag.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${
                          activityAgentFilter === ag.id
                            ? 'bg-amber-500 text-white border-amber-500 font-bold'
                            : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-medium hover:border-amber-500/30'
                        }`}
                      >
                        {ag.name} ({ag.count})
                      </button>
                    ))}
                  </div>
                )}

                {/* Timeline Content */}
                {loadingData ? (
                  <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                    <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3" />
                    <span className="text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
                  </div>
                ) : filteredTimeline.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark text-center px-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/[0.08] to-brand-500/[0.02] flex items-center justify-center mb-3 border border-brand-500/10">
                      <Clock size={26} className="text-brand-500/60" />
                    </div>
                    <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'لا توجد سجلات بعد' : 'No records yet'}</p>
                    <p className="m-0 mt-1.5 text-[11.5px] leading-relaxed max-w-[260px]">
                      {isRTL ? 'استخدم الأزرار في الأعلى للاتصال أو إرسال واتساب أو تسجيل ملاحظة' : 'Use the buttons above to call, message, or log a note'}
                    </p>
                  </div>
                ) : (
                  <div>
                    {groupedTimeline.map((group, gi) => (
                      <div key={group.label}>
                        {/* Date Group Header */}
                        <div className="flex items-center gap-2.5 mb-3 mt-1">
                          <span className="text-[10px] font-bold text-content-muted dark:text-content-muted-dark uppercase tracking-wider">{group.label}</span>
                          <div className="flex-1 h-px bg-edge/60 dark:bg-edge-dark/60" />
                        </div>
                        {/* Timeline Items */}
                        {group.items.map((item, ii) => {
                          const isLastInAll = !hasMoreTimeline && gi === groupedTimeline.length - 1 && ii === group.items.length - 1;
                          return renderTimelineItem(item, isLastInAll);
                        })}
                      </div>
                    ))}
                    {hasMoreTimeline && (
                      <div className="flex justify-center pt-3 pb-1">
                        <button
                          onClick={() => setTimelineLimit(n => n + TIMELINE_PAGE_SIZE)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500/[0.06] hover:bg-brand-500/[0.12] text-brand-500 border border-brand-500/20 cursor-pointer transition-colors"
                        >
                          {isRTL
                            ? `عرض المزيد (${filteredTimeline.length - timelineLimit} متبقّي)`
                            : `Load more (${filteredTimeline.length - timelineLimit} more)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ══════ DEAL (deal-events model — a lead can have several) ══════ */}
            <section id="sec-deal" data-section-key="deal" className={tab === 'deal' ? 'mb-4' : 'hidden'}>
              {(() => {
                const DEAL_STATUS = isRTL
                  ? { new_deal: 'جديدة', reserved: 'محجوز', contracted: 'متعاقد', won: 'مكسوبة', lost: 'خسارة' }
                  : { new_deal: 'New', reserved: 'Reserved', contracted: 'Contracted', won: 'Won', lost: 'Lost' };
                const DEAL_COLOR = { new_deal: '#6B7280', reserved: '#5A63C4', contracted: '#0B5A53', won: '#158A57', lost: '#D6403B' };
                const fmt = (n) => n == null ? '—' : Number(n).toLocaleString(isRTL ? 'ar-EG' : 'en-US');
                const ADVANCE = [
                  { k: 'reserved', ar: 'حجز', en: 'Reserve', color: '#5A63C4' },
                  { k: 'contracted', ar: 'عقد', en: 'Contract', color: '#0B5A53' },
                  { k: 'won', ar: 'بيع', en: 'Won', color: '#158A57' },
                  { k: 'lost', ar: 'خسارة', en: 'Lost', color: '#D6403B' },
                ];
                return (
                  <>
                    {/* New deal — a lead can reserve/contract more than one unit */}
                    {canEditContact && (
                      <button onClick={() => setDealModal({ status: 'reserved', dealId: null })}
                        className="w-full mb-3 py-2.5 rounded-xl text-xs font-bold border border-dashed border-brand-500/50 text-brand-500 bg-brand-500/[0.06] cursor-pointer hover:bg-brand-500/10 transition-colors">
                        + {isRTL ? 'صفقة / حجز جديد' : 'New deal / reservation'}
                      </button>
                    )}

                    {dealLoading ? (
                      <div className="py-8 text-center text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'جاري التحميل…' : 'Loading…'}</div>
                    ) : dealRows.length === 0 ? (
                      <div className="py-6 text-center text-[11px] text-content-muted dark:text-content-muted-dark rounded-xl border border-dashed border-edge dark:border-edge-dark">
                        {isRTL ? 'مفيش صفقات لسه' : 'No deals yet'}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dealRows.map(dr => (
                          <div key={dr.id} className="rounded-xl border border-edge dark:border-edge-dark p-3.5">
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-[11px] font-mono text-content-muted dark:text-content-muted-dark">{dr.deal_number}{dr.unit_code ? ` · ${dr.unit_code}` : ''}</span>
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: DEAL_COLOR[dr.status] || '#6B7280', background: (DEAL_COLOR[dr.status] || '#6B7280') + '18' }}>
                                {DEAL_STATUS[dr.status] || dr.status}
                              </span>
                            </div>
                            <div className="flex gap-4 text-xs mb-1.5">
                              <div><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'القيمة: ' : 'Value: '}</span><span className="font-bold text-content dark:text-content-dark">{fmt(dr.deal_value)}</span></div>
                              <div><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المقدّم: ' : 'Down: '}</span><span className="font-bold text-content dark:text-content-dark">{fmt(dr.down_payment)}</span></div>
                            </div>
                            <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-2.5">
                              {isRTL ? 'بواسطة: ' : 'By: '}{(isRTL ? (dr.agent_ar || dr.agent_en) : (dr.agent_en || dr.agent_ar)) || '—'}
                              {dr.created_at ? ` · ${new Date(dr.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}` : ''}
                            </div>
                            {canEditContact && (
                              <div className="flex gap-1.5 flex-wrap">
                                {ADVANCE.filter(a => a.k !== dr.status).map(a => (
                                  <button key={a.k} onClick={() => setDealModal({ status: a.k, dealId: dr.id, initialFields: { unit_code: dr.unit_code, deal_value: dr.deal_value, down_payment: dr.down_payment } })}
                                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-all active:scale-95"
                                    style={{ color: a.color, borderColor: a.color + '55', background: a.color + '10' }}>
                                    → {isRTL ? a.ar : a.en}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </section>

            {/* ══════ MEETINGS ══════ */}
            <section id="sec-meetings" data-section-key="meetings" className={tab === 'meetings' ? 'mb-4' : 'hidden'}>
              {(() => {
                const TYPE_LBL = isRTL
                  ? { site_visit: 'معاينة', office: 'مكتب', online: 'أونلاين' }
                  : { site_visit: 'Site visit', office: 'Office', online: 'Online' };
                const meetings = (activities || []).filter(a => a.type === 'meeting');
                const upcoming = meetings.filter(m => m.status === 'scheduled' && m.scheduled_date)
                  .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
                const past = meetings.filter(m => !(m.status === 'scheduled' && m.scheduled_date))
                  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                const fmtDT = (d) => d ? new Date(d).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                const Row = (m, up) => (
                  <div key={m.id} className="rounded-xl border border-edge dark:border-edge-dark p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500">{TYPE_LBL[m.meeting_subtype] || (isRTL ? 'اجتماع' : 'Meeting')}</span>
                      <div className="flex items-center gap-1.5">
                        {m.status === 'cancelled' && <span className="text-[10px] font-bold px-1.5 py-px rounded-[5px] bg-red-500/15 text-red-500">{isRTL ? 'ملغي' : 'Cancelled'}</span>}
                        <span className={`text-[10px] font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-content-muted dark:text-content-muted-dark'}`}>{fmtDT(up ? m.scheduled_date : m.created_at)}</span>
                      </div>
                    </div>
                    {m.notes && <div className="text-[11px] text-content dark:text-content-dark">{isRTL ? 'المكان: ' : 'Location: '}{m.notes}</div>}
                    {m.result && <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'النتيجة: ' : 'Outcome: '}{m.result}</div>}
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-1">
                      {isRTL ? 'بواسطة: ' : 'By: '}{(isRTL ? (m.users?.full_name_ar || m.user_name_ar || m.user_name_en) : (m.users?.full_name_en || m.user_name_en || m.user_name_ar)) || '—'}
                    </div>
                    {/* Scheduled meetings can be marked as happened or cancelled — wires up
                        the previously-unused handleUpdateActivityStatus. */}
                    {m.status === 'scheduled' && canEditContact && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-edge/50 dark:border-edge-dark/50">
                        <button onClick={() => handleUpdateActivityStatus(m.id, 'completed')}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.06] cursor-pointer hover:bg-emerald-500/10">
                          {isRTL ? 'تم الحضور' : 'Mark done'}
                        </button>
                        <button onClick={() => handleUpdateActivityStatus(m.id, 'cancelled')}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border border-red-500/40 text-red-500 bg-red-500/[0.06] cursor-pointer hover:bg-red-500/10">
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </div>
                );
                return (
                  <>
                    {canEditContact && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button onClick={() => setMeetingModal({ mode: 'happened' })}
                          className="py-2.5 rounded-xl text-xs font-bold border border-brand-500/50 text-brand-500 bg-brand-500/[0.06] cursor-pointer hover:bg-brand-500/10 transition-colors">
                          {isRTL ? 'سجّل اجتماع' : 'Log meeting'}
                        </button>
                        <button onClick={() => setMeetingModal({ mode: 'scheduled' })}
                          className="py-2.5 rounded-xl text-xs font-bold border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.06] cursor-pointer hover:bg-emerald-500/10 transition-colors">
                          {isRTL ? 'احجز اجتماع' : 'Schedule meeting'}
                        </button>
                      </div>
                    )}
                    {upcoming.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">{isRTL ? 'قادمة' : 'Upcoming'}</div>
                        <div className="space-y-2">{upcoming.map(m => Row(m, true))}</div>
                      </div>
                    )}
                    {past.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'حصلت' : 'Past'}</div>
                        <div className="space-y-2">{past.map(m => Row(m, false))}</div>
                      </div>
                    )}
                    {meetings.length === 0 && (
                      <div className="py-6 text-center text-[11px] text-content-muted dark:text-content-muted-dark rounded-xl border border-dashed border-edge dark:border-edge-dark">
                        {isRTL ? 'مفيش اجتماعات لسه' : 'No meetings yet'}
                      </div>
                    )}
                  </>
                );
              })()}
            </section>

            {/* ══════ DEPARTMENT-SPECIFIC ══════ */}
            <section id={`sec-${deptTab.key}`} data-section-key={deptTab.key} className={tab === deptTab.key ? 'mb-4' : 'hidden'}>
              <div>
                {isSupplier ? (
                  <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                    <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                      <FileDown size={24} className="opacity-30" />
                    </div>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                    <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
                  </div>
                ) : (
                  <>
                    {/* ── Sales: Opportunities ── */}
                    {dept === 'sales' && (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الفرص' : 'Opportunities'} <span className="text-content-muted dark:text-content-muted-dark font-normal">({oppCount})</span></div>
                        </div>
                        {loadingData ? (
                          <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3" />
                            <span className="text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
                          </div>
                        ) : (() => {
                          const filteredOpps = opportunities;
                          return filteredOpps.length === 0 ? (
                          <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                            <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                              <Target size={24} className="opacity-30" />
                            </div>
                            <p className="m-0 text-xs">{isRTL ? 'لا توجد فرص بعد' : 'No opportunities yet'}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            {filteredOpps.map(opp => {
                              const stages = getDeptStages(dept);
                              const currentStage = stages.find(s => s.id === opp.stage);
                              const stageColor = currentStage?.color || '#158A57';
                              const isStageOpen = openStagePopoverFor === opp.id;
                              return (
                              <div
                                key={opp.id}
                                className="bg-surface-bg/50 dark:bg-surface-bg-dark/50 border border-edge/60 dark:border-edge-dark/60 rounded-xl p-3.5 hover:bg-emerald-500/[0.05] hover:border-emerald-500/20 transition-all"
                              >
                                <div className="flex items-center justify-between mb-2 gap-2">
                                  <button
                                    onClick={() => navigate(`/crm/opportunities?highlight=${opp.id}`)}
                                    className="text-xs font-bold text-content dark:text-content-dark bg-transparent border-none cursor-pointer hover:text-brand-500 transition-colors p-0">
                                    {isRTL ? 'فرصة' : 'Opp'} #{String(opp.id).slice(-4)}
                                  </button>
                                  {/* Clickable stage chip with quick-pick popover */}
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setOpenStagePopoverFor(isStageOpen ? null : opp.id); }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer border-none transition-all hover:scale-105 active:scale-95"
                                      style={{ color: stageColor, background: stageColor + '18' }}
                                      title={isRTL ? 'تغيير المرحلة' : 'Change stage'}
                                      aria-haspopup="menu"
                                      aria-expanded={isStageOpen}
                                    >
                                      {deptStageLabel(opp.stage, dept, isRTL)}
                                      <ChevronDown size={10} className="opacity-70" />
                                    </button>
                                    {isStageOpen && (
                                      <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setOpenStagePopoverFor(null)} />
                                        <div role="menu" className="absolute top-full mt-1.5 end-0 z-[61] min-w-[180px] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg overflow-hidden p-1">
                                          <div className="text-[10px] font-bold text-content-muted dark:text-content-muted-dark uppercase tracking-wide px-2 py-1.5 border-b border-edge/50 dark:border-edge-dark/50">
                                            {isRTL ? 'تغيير المرحلة' : 'Change stage'}
                                          </div>
                                          {stages.map(s => {
                                            const isCurrent = s.id === opp.stage;
                                            return (
                                              <button key={s.id}
                                                role="menuitem"
                                                onClick={() => { setOpenStagePopoverFor(null); if (!isCurrent) handleStageChange(opp, s.id); }}
                                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border-none bg-transparent text-start hover:bg-edge/40 dark:hover:bg-edge-dark/40 ${isCurrent ? 'font-bold' : ''}`}
                                                style={isCurrent ? { color: s.color, background: s.color + '14' } : undefined}>
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                                                <span className="flex-1" style={{ color: isCurrent ? s.color : undefined }}>{isRTL ? s.label_ar : s.label_en}</span>
                                                {isCurrent && <Check size={12} style={{ color: s.color }} />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {opp.projects?.name_ar && (
                                  <div className="text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar)}</div>
                                )}
                                {(opp.users || opp.assigned_to_name) && (
                                  <div className="text-[11px] font-semibold text-brand-500 mb-1.5">
                                    {opp.users ? (isRTL ? (opp.users.full_name_ar || opp.users.full_name_en) : (opp.users.full_name_en || opp.users.full_name_ar)) : opp.assigned_to_name}
                                  </div>
                                )}
                                <div className="flex gap-3 text-[11px] text-content-muted dark:text-content-muted-dark">
                                  {opp.budget > 0 && <span className="font-medium">{fmtBudget(opp.budget, null, isRTL)} {isRTL ? 'ج.م' : 'EGP'}</span>}
                                  {opp.temperature && (
                                    <span style={{ color: TEMP[opp.temperature]?.color }}>{isRTL ? TEMP[opp.temperature]?.labelAr : TEMP[opp.temperature]?.label}</span>
                                  )}
                                  <span className="opacity-60">{opp.created_at?.slice(0, 10)}</span>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        );
                        })()}
                      </>
                    )}

                    {/* ── HR: Recruitment ── */}
                    {dept === 'hr' && (
                      <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                        <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                          <UserCheck size={24} className="opacity-30" />
                        </div>
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد عمليات توظيف بعد' : 'No recruitment records yet'}</p>
                        <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'سجل عمليات التوظيف لهذا الشخص' : 'Track recruitment for this person'}</p>
                      </div>
                    )}

                    {/* ── Marketing: Campaign Interactions ── */}
                    {dept === 'marketing' && (() => {
                      const interactions = contact.campaign_interactions?.length > 0
                        ? contact.campaign_interactions
                        : contact.campaign_name
                          ? [{ campaign: contact.campaign_name, source: contact.source, platform: contact.platform, date: contact.created_at }]
                          : [];

                      if (interactions.length === 0) return (
                        <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                          <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                            <Megaphone size={24} className="opacity-30" />
                          </div>
                          <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد تفاعلات بعد' : 'No campaign interactions yet'}</p>
                        </div>
                      );

                      const campaignMap = {};
                      interactions.forEach(i => {
                        if (!campaignMap[i.campaign]) campaignMap[i.campaign] = { count: 0, source: i.source, first: i.date, last: i.date };
                        campaignMap[i.campaign].count++;
                        if (i.date < campaignMap[i.campaign].first) campaignMap[i.campaign].first = i.date;
                        if (i.date > campaignMap[i.campaign].last) campaignMap[i.campaign].last = i.date;
                      });
                      const uniqueCampaigns = Object.entries(campaignMap);
                      const firstSource = interactions.reduce((a, b) => a.date < b.date ? a : b);
                      const lastSource = interactions.reduce((a, b) => a.date > b.date ? a : b);

                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-3 bg-brand-500/[0.05] rounded-xl text-center border border-brand-500/10">
                              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{isRTL ? 'التفاعلات' : 'Interactions'}</p>
                              <p className="m-0 text-lg font-bold text-brand-500">{interactions.length}</p>
                            </div>
                            <div className="p-3 bg-brand-500/[0.05] rounded-xl text-center border border-brand-500/10">
                              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{isRTL ? 'أول مصدر' : 'First'}</p>
                              <p className="m-0 text-[11px] font-bold text-content dark:text-content-dark truncate mt-0.5">{firstSource.campaign}</p>
                            </div>
                            <div className="p-3 bg-brand-500/[0.05] rounded-xl text-center border border-brand-500/10">
                              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{isRTL ? 'آخر مصدر' : 'Last'}</p>
                              <p className="m-0 text-[11px] font-bold text-content dark:text-content-dark truncate mt-0.5">{lastSource.campaign}</p>
                            </div>
                          </div>

                          <p className="m-0 text-xs font-semibold text-content dark:text-content-dark mt-1">
                            {isRTL ? 'تفاصيل الحملات' : 'Campaign Breakdown'} <span className="text-brand-500">({uniqueCampaigns.length})</span>
                          </p>
                          {uniqueCampaigns.map(([name, data]) => (
                            <div key={name} className="p-3 bg-surface-bg/50 dark:bg-surface-bg-dark/50 border border-edge/60 dark:border-edge-dark/60 rounded-xl">
                              <div className="flex justify-between items-center">
                                <div className="min-w-0 flex-1">
                                  <p className="m-0 text-xs font-bold text-content dark:text-content-dark truncate">{name}</p>
                                  <p className="m-0 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                                    {isRTL ? (SOURCE_LABELS[data.source] || data.source) : (SOURCE_EN[data.source] || data.source)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {data.count > 1 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                      {data.count}x {isRTL ? 'تكرار' : 'repeat'}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                                    {new Date(data.first).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}

                          <details className="mt-1">
                            <summary className="text-[11px] text-brand-500 cursor-pointer font-semibold">{isRTL ? 'سجل التفاعلات الكامل' : 'Full Interaction Log'}</summary>
                            <div className="mt-2 space-y-1">
                              {interactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map((int, idx) => (
                                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-edge/40 dark:border-edge-dark/40 text-[11px]">
                                  <span className="text-content dark:text-content-dark font-medium">{int.campaign}</span>
                                  <span className="text-content-muted dark:text-content-muted-dark">
                                    {isRTL ? (SOURCE_LABELS[int.source] || int.source) : (SOURCE_EN[int.source] || int.source)} · {new Date(int.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      );
                    })()}

                    {/* ── Operations: Orders ── */}
                    {dept === 'operations' && (
                      <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                        <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                          <Settings size={24} className="opacity-30" />
                        </div>
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                        <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'سجل الطلبات لهذا الشخص' : 'Track orders for this person'}</p>
                      </div>
                    )}

                    {/* ── Finance: Invoices ── */}
                    {dept === 'finance' && (
                      <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                        <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                          <FileDown size={24} className="opacity-30" />
                        </div>
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                        <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'أضف فاتورة لهذا الشخص' : 'Add an invoice for this person'}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* ══════ RESALE UNITS (lazy) ══════ */}
            <section id="sec-units" data-section-key="units" className={tab === 'units' ? 'mb-4' : 'hidden'}>
              {mountedSections.has('units')
                ? <ResaleUnitsTab contact={contact} isRTL={isRTL} />
                : <SectionPlaceholder label={isRTL ? 'الوحدات للبيع' : 'Resale units'} />}
            </section>

            {/* ══════ COMMENTS (lazy) ══════ */}
            <section id="sec-comments" data-section-key="comments" className={tab === 'comments' ? 'mb-4' : 'hidden'}>
              {mountedSections.has('comments')
                ? <CommentsSection
                    entity="contact"
                    entityId={contact.id}
                    entityName={contact.full_name}
                    onCommentAdded={() => {
                      const selfName = profile?.full_name_en || profile?.full_name_ar || '';
                      (contact.assigned_to_names || []).filter(n => n !== selfName).forEach(agentName => {
                        notifyNewComment({ contactName: contact.full_name, contactId: contact.id, commentBy: selfName, agentName });
                      });
                    }}
                  />
                : <SectionPlaceholder label={isRTL ? 'التعليقات' : 'Comments'} />}
            </section>

            {/* ══════ DOCUMENTS (lazy) ══════ */}
            <section id="sec-documents" data-section-key="documents" className={tab === 'documents' ? 'mb-4' : 'hidden'}>
              {mountedSections.has('documents')
                ? <DocumentsSection
                    entity="contact"
                    entityId={contact.id}
                    entityName={contact.full_name}
                  />
                : <SectionPlaceholder label={isRTL ? 'المستندات' : 'Documents'} />}
            </section>

            {/* ══════ DATA / DETAILS ══════ */}
            <section id="sec-data" data-section-key="data" className={tab === 'data' ? 'mb-4' : 'hidden'}>
              <div>
                {/* Lead Score card — the temperature editor lives only in the
                    hero chip now (single source of truth), so it was removed here. */}
                <div className="mb-4">
                  <div className="bg-brand-500/[0.05] rounded-xl p-3.5 border border-brand-500/10">
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide mb-2 font-medium">{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                    {(() => {
                      const mn = profile?.full_name_en || profile?.full_name_ar;
                      const myScore = (contact.assigned_to_name === mn || isManagerViewer) ? contact.lead_score : null;
                      return <ScorePill score={myScore != null ? Number(myScore) : null} />;
                    })()}
                  </div>
                </div>

                {/* Grouped Data Sections */}
                <div className="flex flex-col gap-4 mb-4">
                  {dataGroups.map(group => {
                    const GroupIcon = group.icon;
                    return (
                      <div
                        key={group.title}
                        className="rounded-xl border border-edge/70 dark:border-edge-dark/70 overflow-hidden shadow-sm"
                        style={{ borderInlineStartWidth: '3px', borderInlineStartColor: group.color }}
                      >
                        <div
                          className="flex items-center gap-2.5 px-3.5 py-3 border-b border-edge/50 dark:border-edge-dark/50"
                          style={{ background: `linear-gradient(90deg, ${group.color}14 0%, ${group.color}04 100%)` }}
                        >
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: group.color + '22' }}>
                            <GroupIcon size={13} style={{ color: group.color }} />
                          </div>
                          <span className="text-[12px] font-bold text-content dark:text-content-dark uppercase tracking-wider" style={{ color: group.color }}>{group.title}</span>
                          <span className="ms-auto text-[10px] text-content-muted dark:text-content-muted-dark font-semibold tabular-nums">{group.rows.length}</span>
                        </div>
                        <div className="px-3.5">
                          {group.rows.map(r => (
                            <div key={r.label} className={rowCls}>
                              <span className="text-content-muted dark:text-content-muted-dark shrink-0">{r.label}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-content dark:text-content-dark font-medium text-end whitespace-nowrap" style={r.color ? { color: r.color } : undefined}>{r.val}</span>
                                {r.action && <button onClick={r.action.onClick} className="text-[9px] text-brand-500 bg-brand-500/10 px-1.5 py-0.5 rounded border-none cursor-pointer hover:bg-brand-500/20 transition-colors">{r.action.label}</button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Notes (moved here from the hero) */}
                {contact.notes && (
                  <div className="mb-4 rounded-xl border border-edge/70 dark:border-edge-dark/70 overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-bg/60 dark:bg-surface-bg-dark/40 border-b border-edge/50 dark:border-edge-dark/50">
                      <FileText size={12} className="text-content-muted dark:text-content-muted-dark" />
                      <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wider">{isRTL ? 'ملاحظات' : 'Notes'}</span>
                    </div>
                    <div className="px-3.5 py-3 text-xs text-content dark:text-content-dark leading-relaxed whitespace-pre-wrap">{contact.notes}</div>
                  </div>
                )}

                {/* Assignment history (moved here from the hero) */}
                {assignmentHistory.length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
                    <div className="flex items-center gap-2 mb-1.5">
                      <History size={12} className="text-amber-500" />
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {isRTL ? `تم تعيينه ${assignmentHistory.length} مرة` : `Reassigned ${assignmentHistory.length} time${assignmentHistory.length > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {assignmentHistory.slice(-3).map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-content-muted dark:text-content-muted-dark">
                          <span className="font-semibold">{h.from || '—'}</span>
                          <span className="opacity-40">→</span>
                          <span className="font-semibold text-brand-500">{h.to}</span>
                          <span className="opacity-50">· {new Date(h.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                          {h.by && <span className="opacity-40">({isRTL ? 'بواسطة' : 'by'} {h.by})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blacklist reason */}
                {contact.is_blacklisted && contact.blacklist_reason && (
                  <div className="mb-4 px-3.5 py-2.5 bg-red-500/[0.06] border border-red-500/15 rounded-xl text-xs text-red-500 flex gap-2 items-start">
                    <Ban size={13} className="shrink-0 mt-0.5" />
                    <span className="overflow-hidden text-ellipsis">{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                  </div>
                )}

                {/* Viewed By moved to the admin/ops "Audit" tab (all-employee
                    viewers from view_logs) — the old localStorage-only block
                    here was a this-device-only duplicate, removed. */}

                {/* Custom Fields */}
                <CustomFieldsRenderer entity="contact" entityId={contact.id} mode="edit" defaultCollapsed={false} />

                {/* Campaign History Analytics */}
                {(() => {
                  const interactions = contact.campaign_interactions || [];
                  if (interactions.length === 0) return null;

                  const campaignMap = {};
                  interactions.forEach(i => {
                    if (!campaignMap[i.campaign]) campaignMap[i.campaign] = { name: i.campaign, count: 0, dates: [] };
                    campaignMap[i.campaign].count++;
                    if (i.date) campaignMap[i.campaign].dates.push(i.date);
                  });
                  const chartData = Object.values(campaignMap).map(c => ({
                    name: c.name.length > 18 ? c.name.slice(0, 16) + '...' : c.name,
                    fullName: c.name,
                    [isRTL ? 'تفاعلات' : 'Interactions']: c.count,
                  }));
                  const campaignList = Object.values(campaignMap).sort((a, b) => {
                    const aLast = a.dates.length ? a.dates.sort().pop() : '';
                    const bLast = b.dates.length ? b.dates.sort().pop() : '';
                    return bLast.localeCompare(aLast);
                  });

                  return (
                    <div className="mt-3 rounded-xl border border-edge/70 dark:border-edge-dark/70 overflow-hidden">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-bg/60 dark:bg-surface-bg-dark/40 border-b border-edge/50 dark:border-edge-dark/50">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center bg-brand-500/15">
                          <Megaphone size={12} style={{ color: '#2F6BD3' }} />
                        </div>
                        <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wider">
                          {isRTL ? 'سجل الحملات' : 'Campaign History'}
                        </span>
                        <span className="text-[9px] text-content-muted dark:text-content-muted-dark ms-auto">
                          {interactions.length} {isRTL ? 'تفاعل' : 'interactions'}
                        </span>
                      </div>
                      <div className="px-3.5 py-3">
                        <div style={{ width: '100%', height: Math.max(120, chartData.length * 36) }} dir="ltr">
                          <Suspense fallback={<div className="w-full h-full bg-surface-bg/30 dark:bg-surface-bg-dark/30 rounded-md animate-pulse" />}>
                            <CampaignHistoryChart chartData={chartData} isRTL={isRTL} />
                          </Suspense>
                        </div>
                        <div className="mt-2.5 border-t border-edge/50 dark:border-edge-dark/50 pt-2">
                          {campaignList.map(c => (
                            <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-edge/30 dark:border-edge-dark/30 last:border-b-0 text-[11px]">
                              <span className="text-content dark:text-content-dark font-medium truncate max-w-[60%]">{c.name}</span>
                              <span className="text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                                {c.count}x
                                {c.dates.length > 0 && ` · ${new Date(c.dates.sort().pop()).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* ══════ AUDIT (admin/operations only) — full change history + viewers ══════ */}
            {isAdmin && (
            <section id="sec-audit" data-section-key="audit" className={tab === 'audit' ? 'mb-4' : 'hidden'}>
              {/* Changes */}
              <div className="flex items-center gap-2 mb-3">
                <History size={14} className="text-brand-500" />
                <h3 className="text-xs font-bold text-content dark:text-content-dark m-0">{isRTL ? 'كل التغييرات' : 'All Changes'}</h3>
                <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark ms-auto">{extraSources.audits.length}</span>
              </div>
              {extraSources.audits.length === 0 ? (
                <div className="text-[11px] text-content-muted dark:text-content-muted-dark py-3 text-center rounded-lg border border-dashed border-edge dark:border-edge-dark">
                  {isRTL ? 'لا توجد تغييرات مسجّلة على هذا العميل' : 'No recorded changes for this lead'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {extraSources.audits.map(a => {
                    // Defensive filter: rows logged before the auditService fix
                    // may still carry internal '_'-prefixed keys (e.g. _skipDbUpdate)
                    // or the noisy last_activity_at — hide them here too.
                    const chg = a.changes && typeof a.changes === 'object'
                      ? Object.entries(a.changes).filter(([k]) => !k.startsWith('_') && k !== 'last_activity_at')
                      : [];
                    return (
                      <div key={a.id} className="rounded-lg border border-edge/60 dark:border-edge-dark/60 bg-surface-bg/30 dark:bg-surface-bg-dark/20 px-3 py-2">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-[11px] font-semibold text-content dark:text-content-dark truncate">{a.user_name || '—'}</span>
                          <span className="text-[9px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">{new Date(a.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {chg.length ? (
                          <div className="space-y-0.5">
                            {chg.map(([f, v]) => (
                              <div key={f} className="text-[10.5px] text-content-muted dark:text-content-muted-dark">
                                <span className="font-semibold text-content dark:text-content-dark">{(isRTL ? AUDIT_FIELD_LABELS[f]?.ar : AUDIT_FIELD_LABELS[f]?.en) || f}:</span>{' '}
                                <span className="line-through opacity-60">{auditVal(v?.from)}</span>
                                <span className="mx-1">→</span>
                                <span className="text-content dark:text-content-dark font-medium">{auditVal(v?.to)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10.5px] text-content-muted dark:text-content-muted-dark">{a.description || a.action}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Viewers */}
              <div className="flex items-center gap-2 mt-6 mb-3">
                <Users size={14} className="text-brand-500" />
                <h3 className="text-xs font-bold text-content dark:text-content-dark m-0">{isRTL ? 'مين شاف العميل' : 'Viewers'}</h3>
                <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark ms-auto">{viewers.length}</span>
              </div>
              {viewersLoading ? (
                <div className="text-[11px] text-content-muted dark:text-content-muted-dark py-3 text-center">{isRTL ? 'جاري التحميل…' : 'Loading…'}</div>
              ) : viewers.length === 0 ? (
                <div className="text-[11px] text-content-muted dark:text-content-muted-dark py-3 text-center rounded-lg border border-dashed border-edge dark:border-edge-dark">
                  {isRTL ? 'لا أحد شاهد هذا العميل بعد' : 'No one has viewed this lead yet'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {viewers.map(v => (
                    <div key={v.user_id} className="flex items-center gap-2.5 rounded-lg border border-edge/60 dark:border-edge-dark/60 bg-surface-bg/30 dark:bg-surface-bg-dark/20 px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center text-[10px] font-bold shrink-0">{agentInitials(v.user_name || '?')}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-content dark:text-content-dark truncate">{v.user_name || v.user_id}</div>
                        {v.user_role && <div className="text-[9px] text-content-muted dark:text-content-muted-dark">{v.user_role}</div>}
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-[10px] font-bold text-brand-500">{v.views}×</div>
                        <div className="text-[9px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">{new Date(v.last_view).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>

    {/* Deal-events modal — create a new deal or advance a specific one */}
    {dealModal && (
      <DealEventModal
        contact={contact}
        initialStatus={dealModal.status}
        dealId={dealModal.dealId}
        initialFields={dealModal.initialFields || {}}
        isRTL={isRTL}
        onClose={() => setDealModal(null)}
        onSaved={handleDealEventSaved}
      />
    )}

    {/* ═══ Unified log sheet — opened by the "+ سجّل" FAB (call/whatsapp/note).
         TakeActionForm presented as a modal centered over the drawer panel. ═══ */}
    {showActionForm && (
      <div
        className="fixed inset-0 z-[930] flex bg-black/50 backdrop-blur-[2px]"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={() => { setShowActionForm(false); setActionPresetType(null); }}
      >
        {/* Spacer mirrors the drawer's own backdrop so the modal region lands
            exactly over the drawer panel (not centered on the whole viewport). */}
        <div className="flex-1" aria-hidden="true" />
        <div className="w-[480px] md:w-[580px] max-w-[100vw] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-[440px] max-h-[92vh] overflow-y-auto">
          <TakeActionForm
            key={actionPresetType || 'default'}
            contact={contact}
            onLogInteraction={handleLogInteraction}
            onCancel={() => { setShowActionForm(false); setActionPresetType(null); }}
            initialType={actionPresetType}
          />
          </div>
        </div>
      </div>
    )}

    {/* Meeting modal — log a happened meeting or schedule an upcoming one */}
    {meetingModal && (
      <MeetingModal
        contact={contact}
        mode={meetingModal.mode}
        profile={profile}
        isRTL={isRTL}
        onClose={() => setMeetingModal(null)}
        onSaved={handleMeetingSaved}
      />
    )}

    {/* Send SMS Modal */}
    {showSMSModal && contact.phone && (
      <ContactSMSModal
        contact={contact}
        isRTL={isRTL}
        onClose={() => setShowSMSModal(false)}
        onSent={() => {
          toast.success(isRTL ? 'تم إرسال الرسالة' : 'SMS sent successfully');
          setShowSMSModal(false);
        }}
      />
    )}
    {showPrintPreview && (
      <PrintPreview
        html={generateContactCardHTML(contact, getCompanyInfo(), isRTL ? 'ar' : 'en')}
        title={isRTL ? 'بطاقة عميل' : 'Lead Card'}
        onClose={() => setShowPrintPreview(false)}
      />
    )}
    </>
  );
}

