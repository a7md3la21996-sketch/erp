import { useState, useMemo, useEffect, useRef as useReactRef, useCallback, useReducer } from 'react';
import { useRealtimeSubscription, applyRealtimePayload } from '../hooks/useRealtimeSubscription';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';
import { Plus, Upload, Download, Ban, Bookmark, X as XIcon, Save, Users, ChevronDown, Clock } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact, deleteContact, restoreContact,
  createActivity, recordAssignment,
  checkDuplicate,
} from '../services/contactsService';
import supabase from '../lib/supabase';
import { logAction } from '../services/auditService';
import { bulkSend } from '../services/smsTemplateService';
import { setFieldValues as setCFValues } from '../services/customFieldsService';
import { fetchTeamAgents } from '../services/opportunitiesService';
import { fetchCampaigns, createCampaign } from '../services/marketingService';
import { getDeptStages } from './crm/contacts/constants';
import { notifyLeadAssigned, notifyImportDone, notifyLeadReassigned, notifyImportLeadsForAgent } from '../services/notificationsService';
import { evaluateTriggers } from '../services/triggerService';
import { reportError } from '../utils/errorReporter';
import { rollbackContact } from '../utils/safeRollback';
import { validateAgentNames } from '../utils/agentValidation';
import { getTeamMemberNames } from '../utils/teamHelper';
import { applyRoleFilter } from '../utils/roleFilter';
import ImportModal from './crm/ImportModal';
import { PageSkeleton, Button, SmartFilter, Modal, ModalFooter, Input } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useContactsFilters } from '../hooks/useContactsFilters';
import useCrmPermissions from '../hooks/useCrmPermissions';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';


import { SOURCE_LABELS, SOURCE_EN, TYPE, TEMP, MOCK, normalizePhone } from './crm/contacts/constants';
import AddContactModal from './crm/contacts/AddContactModal';
import LogCallModal from './crm/contacts/LogCallModal';
import QuickTaskModal from './crm/contacts/QuickTaskModal';
import ContactDrawer from './crm/contacts/ContactDrawer';
import ContactsTable from './crm/contacts/ContactsTable';
import ContactsCardList from './crm/contacts/ContactsCardList';
import QuickActionPopover from './crm/contacts/QuickActionPopover';
import BatchCallModal from './crm/contacts/BatchCallModal';
import BulkActionToolbar from './crm/contacts/BulkActionToolbar';
import { MergePreviewModal, ConfirmModal, DisqualifyModal, BulkReassignModal, BulkOppModal, BulkSMSModal, BulkCampaignModal } from './crm/contacts/BulkModals';
import BulkDistributeModal from './crm/contacts/BulkDistributeModal';

// Previously this was a module-level Set that never cleared across
// login/logout/role-switch and grew unboundedly. Moved into the component
// as a ref so it resets when the profile changes (see the useEffect on
// profile?.id below).

// Static status definitions — hoisted to module scope so loadStats's
// useCallback doesn't close over a freshly-allocated array every render
// (the older inline-in-component version was stable in practice but a
// theoretical closure footgun for future edits).
const STATUS_DEFS = [
  { value: 'new', label: 'جديد', labelEn: 'New', color: '#4A7AAB' },
  { value: 'contacted', label: 'تم التواصل', labelEn: 'Contacted', color: '#F59E0B' },
  { value: 'following', label: 'متابعة', labelEn: 'Following', color: '#10B981' },
  { value: 'has_opportunity', label: 'لديه فرصة', labelEn: 'Has Opportunity', color: '#059669' },
  { value: 'disqualified', label: 'غير مؤهل', labelEn: 'Disqualified', color: '#6b7280' },
];

export default function ContactsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const perms = useCrmPermissions();
  // Translate the common backend / Supabase error patterns into something
  // an Arabic-speaking rep can act on. Anything we don't recognize falls
  // back to the raw message so we don't accidentally hide a new error type.
  const translateErr = useCallback((err) => {
    const raw = String(err?.message || err || '').trim();
    if (!raw) return isRTL ? 'خطأ غير معروف' : 'Unknown error';
    const lower = raw.toLowerCase();
    if (err?.code === 'PERM_DENIED' || lower.includes('not allowed') || lower.includes('permission denied')) {
      return isRTL ? 'الصلاحية مش متوفرة — كلم الـ admin' : 'Not permitted — ask your admin';
    }
    if (lower.includes('dq_requires_reason')) {
      return isRTL ? 'لازم تختار سبب لعدم التأهيل' : 'Disqualify reason is required';
    }
    if (lower.includes('contacts_phone') || lower.includes('e164') || lower.includes('digit count')) {
      return isRTL ? 'رقم التليفون مش بصيغة صحيحة' : 'Phone is not in a valid format';
    }
    if (lower.includes('uniq_active_new_phone_per_owner') || (lower.includes('duplicate key') && lower.includes('phone'))) {
      return isRTL ? 'الرقم ده موجود فعلاً عند نفس السيلز كـ lead جديد' : 'This phone is already assigned as a new lead to the same agent';
    }
    if (lower.includes('check constraint')) {
      return isRTL ? 'فشل حفظ — البيانات مش مطابقة لقواعد السيستم' : 'Save failed — data violates a system rule';
    }
    if (lower.includes('rate limit')) {
      return isRTL ? 'العمليات كتير في وقت قصير — استنى ثانية وحاول تاني' : 'Rate limit — wait a moment and retry';
    }
    if (lower.includes('network') || lower.includes('failed to fetch')) {
      return isRTL ? 'مشكلة في الشبكة — جرب تاني' : 'Network issue — please retry';
    }
    return isRTL ? `خطأ: ${raw}` : `Error: ${raw}`;
  }, [isRTL]);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const highlightId = searchParams.get('highlight');

  const [contacts, setContacts] = useState([]);
  // Live user lookup: assigned_to UUID → current display name. Replaces the
  // denormalized `assigned_to_name` column for rendering, which goes stale
  // whenever someone is renamed. We still keep `assigned_to_name` as a
  // fallback for legacy rows where assigned_to is null but a name was set.
  const [userMap, setUserMap] = useState(() => new Map());
  const [filterTemp, setFilterTemp] = useState(() => searchParams.get('temp') || 'all');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || 'all');
  // Stage sub-filter — only meaningful when filterStatus === 'has_opportunity'.
  // Resets to 'all' whenever the parent status filter changes.
  const [filterStage, setFilterStage] = useState(() => searchParams.get('stage') || 'all');
  // contact_ids that have at least one opp in the selected stage (lazy-fetched)
  const [stageContactIds, setStageContactIds] = useState(null);
  // counts per stage for the chips below has_opportunity (lazy-fetched)
  const [stageCounts, setStageCounts] = useState({});
  const [filterActivity, setFilterActivity] = useState(() => searchParams.get('activity') || 'all'); // all, active_3d, moderate_7d, stale, never
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(() => searchParams.get('to') || '');
  const [showUnassigned, setShowUnassigned] = useState(() => searchParams.get('unassigned') === 'true');
  const [campaignsList, setCampaignsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // Optional label + counter shown alongside the top progress bar so bulk
  // operations no longer feel "stuck". `null` = no bulk in flight; otherwise
  // `{ label, done, total }`. Handlers set total upfront then bump done as
  // each row settles (for the per-row paths); RPC paths just set/clear.
  const [bulkProgress, setBulkProgress] = useState(null);

  const [savedFilters, setSavedFilters] = useState(() => JSON.parse(localStorage.getItem('platform_saved_filters_contacts') || '[]'));
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openWithAction, setOpenWithAction] = useState(false);
  const [quickActionTarget, setQuickActionTarget] = useState(null);
  const [quickActionForm, setQuickActionForm] = useState({ type: 'call', result: '', description: '' });
  const [savingQuickAction, setSavingQuickAction] = useState(false);
  const [logCallTarget, setLogCallTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [bulkReassignModal, setBulkReassignModal] = useState(false);
  // Result of a bulk reassign that couldn't move some leads — { agentName,
  // moved, skipped:[{contact_id,full_name,phone,reason}] }. Drives a modal that
  // explains why and offers to send the skipped ones to a different agent.
  const [reassignSkipped, setReassignSkipped] = useState(null);
  const [bulkCampaignModal, setBulkCampaignModal] = useState(false);
  const [bulkDistributeOpen, setBulkDistributeOpen] = useState(false);
  const [bulkDropdownOpen, setBulkDropdownOpen] = useState(null);
  const [bulkSMSModal, setBulkSMSModal] = useState(false);
  const [bulkSMSState, setBulkSMSState] = useState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] });
  const [pinnedIds, setPinnedIds] = useState(() => { try { return JSON.parse(localStorage.getItem('platform_pinned_contacts') || '[]'); } catch (err) { if (import.meta.env.DEV) console.warn('pinned contacts parse:', err); return []; } });
  const [batchCallMode, setBatchCallMode] = useState(false);
  const [batchCallIndex, setBatchCallIndex] = useState(0);
  const [batchCallNotes, setBatchCallNotes] = useState('');
  const [batchCallResult, setBatchCallResult] = useState('');
  const [batchCallLog, setBatchCallLog] = useState([]);
  const [batchTaskOpen, setBatchTaskOpen] = useState(false);
  const [batchTaskForm, setBatchTaskForm] = useState({ title: '', due: '', priority: 'medium' });
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTargets, setMergeTargets] = useState([]);
  const [mergePreview, setMergePreview] = useState(null);
  const [disqualifyModal, setDisqualifyModal] = useState(null);
  const [dqReason, setDqReason] = useState('');
  const [dqNote, setDqNote] = useState('');
  const [bulkOppModal, setBulkOppModal] = useState(false);
  const [bulkOppForm, setBulkOppForm] = useState({ assigned_to_name: '', stage: 'qualification', priority: 'medium', notes: '', project_id: '' });
  const [bulkOppSaving, setBulkOppSaving] = useState(false);
  const [projectsList, setProjectsList] = useState([]);
  const [allAgentNames, setAllAgentNames] = useState(null);
  useEffect(() => {
    if (!profile) return;
    // fetchTeamAgents is already statically imported above — no need for a
    // second dynamic import of the same module.
    fetchTeamAgents({ role: profile.role, userId: profile.id, teamId: profile.team_id })
      .then(data => setAllAgentNames((data || []).map(a => a.full_name_en || a.full_name_ar).filter(Boolean).sort()))
      .catch(() => {});
  }, [profile?.role, profile?.id, profile?.team_id]);

  // Build the live UUID → name map so list rows don't trust the stale
  // assigned_to_name string. Fetched once on mount (RLS scopes the result
  // anyway). When a user is renamed in /settings/users, the next page mount
  // picks up the new name; existing rows fall back gracefully.
  useEffect(() => {
    let cancelled = false;
    // Team-scoped: team_leader / sales_manager only see their team's name
    // map. Out-of-team UUIDs fall back to the denormalized assigned_to_name.
    fetchTeamAgents({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }).then(list => {
      if (cancelled) return;
      const m = new Map();
      for (const u of list || []) {
        if (!u?.id) continue;
        const name = isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar);
        if (name) m.set(u.id, name);
      }
      setUserMap(m);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isRTL, profile?.role, profile?.id, profile?.team_id]);

  // Names of agents in the viewer's team (manager / leader / director). Used
  // by the table to clip chips on shared contacts so a manager doesn't see
  // names from sibling teams. RLS already controls *which contacts* are
  // visible — this just controls which chips render on the contacts they
  // can see.
  const [myTeamNames, setMyTeamNames] = useState(null);
  useEffect(() => {
    if (!profile?.role || !profile?.team_id) { setMyTeamNames(null); return; }
    if (profile.role === 'admin' || profile.role === 'operations') {
      setMyTeamNames(null); // no clipping — see everyone
      return;
    }
    if (profile.role === 'sales_agent') {
      // sales_agent already filtered to own chip — no team list needed.
      setMyTeamNames(null);
      return;
    }
    getTeamMemberNames(profile.role, profile.team_id)
      .then(names => setMyTeamNames(names || []))
      .catch(() => setMyTeamNames([]));
  }, [profile?.role, profile?.team_id]);

  const { auditFields, applyAuditFilters } = useAuditFilter('contact');
  const {
    filtered, paged, safePage, totalPages,
    SMART_FIELDS, SORT_OPTIONS, deptView, activeDept,
    search, setSearch, searchInput, setSearchInput,
    filterType, setFilterType, showBlacklisted, setShowBlacklisted,
    sortBy, setSortBy, smartFilters, setSmartFilters,
    page, setPage, pageSize, setPageSize,
  } = useContactsFilters({
    contacts,
    pinnedIds,
    auditFields,
    applyAuditFilters,
    initialSearch: searchParams.get('q') || '',
    initialFilterType: searchParams.get('type') || 'all',
    initialShowBlacklisted: false,
    initialSortBy: searchParams.get('sort') || 'created',
    initialPage: Math.max(1, parseInt(searchParams.get('page'), 10) || 1),
    profile,
    allAgentNames,
  });

  // True when any user-applied filter narrows the result set. Drives the
  // "Clear filters" CTA on the empty state — we only offer it when there's
  // actually something to clear (no point telling a fresh visitor to "clear"
  // when nothing is set).
  const hasActiveFilters = (
    !!searchInput
    || filterType !== 'all'
    || filterTemp !== 'all'
    || filterStatus !== 'all'
    || filterStage !== 'all'
    || filterActivity !== 'all'
    || !!dateFrom || !!dateTo
    || showBlacklisted || showUnassigned
    || (Array.isArray(smartFilters) && smartFilters.length > 0)
  );
  const handleClearAllFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setFilterType('all');
    setFilterTemp('all');
    setFilterStatus('all');
    setFilterStage('all');
    setFilterActivity('all');
    setDateFrom('');
    setDateTo('');
    setShowBlacklisted(false);
    setShowUnassigned(false);
    setSmartFilters([]);
    setPage(1);
  }, [setSearchInput, setSearch, setFilterType, setShowBlacklisted, setSmartFilters, setPage]);

  // Follow-up dropdown — exactly one of overdue/today/upcoming active at a time
  // (or none). Each maps to the special smart filter the list logic understands.
  const FOLLOWUP_FILTER_VALUES = { overdue: '__overdue_tasks', today: '__today_followup', upcoming: '__upcoming_followup' };
  const isFollowupActive = (value) => smartFilters.some(f => f.value === value);
  const followupFilterValue =
    isFollowupActive('__overdue_tasks') ? 'overdue'
    : isFollowupActive('__today_followup') ? 'today'
    : isFollowupActive('__upcoming_followup') ? 'upcoming'
    : 'all';
  const setFollowupFilter = (key) => {
    setSmartFilters(prev => {
      const cleaned = prev.filter(f => !Object.values(FOLLOWUP_FILTER_VALUES).includes(f.value));
      return key === 'all' ? cleaned : [...cleaned, { field: 'contact_status', operator: 'is', value: FOLLOWUP_FILTER_VALUES[key] }];
    });
  };

  // Mount-only: consume drill-down state passed via react-router's
  // location.state (e.g. clicking a Top Performer row on the CRM
  // dashboard lands here with state.drillDown = {field, value}).
  // Pushes the matching smart filter once, then clears history state
  // so a refresh doesn't keep re-applying the same drill-down.
  useEffect(() => {
    const dd = location.state?.drillDown;
    if (!dd?.field || !dd?.value) return;
    const SUPPORTED = new Set(['source', 'assigned_to_name']);
    if (!SUPPORTED.has(dd.field)) return;
    setSmartFilters(prev => {
      // Don't double-add if the same filter is already present.
      const already = prev.some(f => f.field === dd.field && f.value === dd.value);
      return already ? prev : [...prev, { field: dd.field, operator: 'is', value: dd.value }];
    });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether highlight has been handled
  const highlightHandled = useReactRef(false);

  // Sync filters to URL — skip if highlight is pending (avoid overwriting it).
  // Every filter the user can toggle is round-tripped so a reload, bookmark,
  // or shared link restores the exact view. Previously only q/type/blacklist/
  // sort/page were saved and the other 6 (temp/status/stage/activity/date/
  // unassigned) silently dropped on refresh.
  useEffect(() => {
    if (highlightId && !highlightHandled.current) return;
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filterType !== 'all') params.set('type', filterType);
    if (filterTemp !== 'all') params.set('temp', filterTemp);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterStage !== 'all') params.set('stage', filterStage);
    if (filterActivity !== 'all') params.set('activity', filterActivity);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (showUnassigned) params.set('unassigned', 'true');
    if (sortBy !== 'created') params.set('sort', sortBy);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [search, filterType, filterTemp, filterStatus, filterStage, filterActivity, dateFrom, dateTo, showUnassigned, showBlacklisted, sortBy, page, setSearchParams, highlightId]);

  const { activityResults: configResults, contactsSettings } = useSystemConfig();
  const MERGE_LIMIT = contactsSettings?.mergeLimit || 2;
  const MAX_PINS = contactsSettings?.maxPins || 5;
  const INACTIVE_DAYS = contactsSettings?.inactiveDays || 5;
  const ACTIVITY_ACTIVE_DAYS = contactsSettings?.activityActiveDays || 3;
  const ACTIVITY_MODERATE_DAYS = contactsSettings?.activityModerateDays || 7;
  const saveContactsLocal = () => {}; // OFFLINE_MODE disabled — Supabase is single source of truth

  const deletedContactsRef = useReactRef(null);
  const restoreContacts = useCallback(async (deletedItems) => {
    if (!deletedItems?.length) return;
    // Optimistically re-add so the row reappears the instant the user clicks
    // Undo (skip any that are somehow already back to avoid duplicate rows).
    setContacts(prev => {
      const existing = new Set(prev.map(c => c.id));
      const toAdd = deletedItems.filter(c => !existing.has(c.id));
      return toAdd.length ? [...toAdd, ...prev] : prev;
    });
    // Persist the un-delete in the DB. Previously this handler ONLY mutated
    // local state, so "Undo" looked like it worked but the rows stayed
    // is_deleted=true and vanished again on the next realtime event / refetch.
    const results = await Promise.allSettled(deletedItems.map(c => restoreContact(c.id)));
    const failedIds = new Set();
    results.forEach((r, i) => {
      if (r.status === 'rejected') { failedIds.add(deletedItems[i].id); reportError('ContactsPage', 'restoreContacts', r.reason); }
    });
    if (failedIds.size > 0) {
      // Roll the rows we couldn't restore back out of the list so the UI
      // matches the DB instead of showing a row that's still soft-deleted.
      setContacts(prev => prev.filter(c => !failedIds.has(c.id)));
      toast.error(isRTL ? `فشل استرجاع ${failedIds.size} عميل` : `Failed to restore ${failedIds.size} leads`);
    } else {
      toast.success(isRTL ? 'تم التراجع عن الحذف' : 'Delete undone');
    }
  }, [isRTL]);

  const togglePin = (id) => {
    setPinnedIds(prev => {
      let next;
      if (prev.includes(id)) {
        next = prev.filter(x => x !== id);
      } else {
        if (prev.length >= MAX_PINS) return prev;
        next = [...prev, id];
      }
      // localStorage.setItem can throw on quota exceeded (lots of open tabs,
      // private mode quirks, full disk). Without a guard, the pin disappears
      // on next reload with no warning to the user.
      try {
        localStorage.setItem('platform_pinned_contacts', JSON.stringify(next));
      } catch (err) {
        reportError('ContactsPage', 'togglePin localStorage', err);
        toast.warning(isRTL ? 'لم يتم حفظ التثبيت — مساحة التخزين ممتلئة' : 'Pin not saved — storage full');
      }
      return next;
    });
  };
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const QUICK_RESULTS = useMemo(() => {
    if (configResults && Object.keys(configResults).length > 0) return configResults;
    return {
      call: [
        { value: 'answered', label_ar: 'رد', label_en: 'Answered', color: '#10B981' },
        { value: 'no_answer', label_ar: 'لم يرد', label_en: 'No Answer', color: '#F59E0B' },
        { value: 'busy', label_ar: 'مشغول', label_en: 'Busy', color: '#EF4444' },
        { value: 'switched_off', label_ar: 'مغلق', label_en: 'Switched Off', color: '#6b7280' },
        { value: 'not_interested', label_ar: 'مش مهتم', label_en: 'Not Interested', color: '#EF4444' },
      ],
      whatsapp: [
        { value: 'replied', label_ar: 'رد', label_en: 'Replied', color: '#10B981' },
        { value: 'seen', label_ar: 'شاف', label_en: 'Seen', color: '#3B82F6' },
        { value: 'delivered', label_ar: 'وصلت', label_en: 'Delivered', color: '#F59E0B' },
        { value: 'not_interested', label_ar: 'مش مهتم', label_en: 'Not Interested', color: '#EF4444' },
      ],
      email: [
        { value: 'replied', label_ar: 'رد', label_en: 'Replied', color: '#10B981' },
        { value: 'sent', label_ar: 'تم الإرسال', label_en: 'Sent', color: '#F59E0B' },
        { value: 'not_interested', label_ar: 'مش مهتم', label_en: 'Not Interested', color: '#EF4444' },
      ],
    };
  }, [configResults]);

  const handleQuickAction = async (contact) => {
    if (!quickActionForm.type) return;
    setSavingQuickAction(true);
    const results = QUICK_RESULTS[quickActionForm.type] || [];
    const resultObj = results.find(r => r.value === quickActionForm.result);
    const resultLabel = resultObj ? (isRTL ? resultObj.label_ar : resultObj.label_en) : '';
    const desc = resultLabel ? `${resultLabel}${quickActionForm.description ? ' — ' + quickActionForm.description : ''}` : quickActionForm.description;

    try {
      await createActivity({
        type: quickActionForm.type,
        description: desc || (isRTL ? 'إجراء سريع' : 'Quick action'),
        contact_id: contact.id,
        created_at: new Date().toISOString(),
        user_id: profile?.id || null,
        user_name_ar: profile?.full_name_ar || '',
        user_name_en: profile?.full_name_en || '',
      });
      // Auto-update contact_status based on action result (skip if disqualified)
      const currentStatus = contact.contact_status || 'new';
      const result = quickActionForm.result;
      let newStatus = null;

      if (currentStatus !== 'disqualified') {
        if (result === 'not_interested' && currentStatus !== 'has_opportunity' && currentStatus !== 'following') {
          // Open disqualify modal instead of auto-setting
          setDisqualifyModal(contact);
          setDqReason('not_interested');
          setDqNote('');
        } else if (['no_answer', 'busy', 'switched_off'].includes(result)) {
          newStatus = 'contacted';
        } else if (result === 'answered' || result === 'replied') {
          newStatus = 'following';
        } else if (currentStatus === 'new' || !currentStatus) {
          newStatus = 'following';
        }
      }

      if (newStatus && newStatus !== currentStatus) {
        const updated = { ...contact, contact_status: newStatus };
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        // Tell the user when this fails — silent failures here are how
        // dozens of status changes were lost during the unhealthy DB period.
        updateContact(updated.id, { contact_status: newStatus })
          .catch(err => {
            reportError('ContactsPage', 'optimistic status update', err);
            toast.error(isRTL ? 'لم يتم حفظ تغيير الحالة — حاول تاني' : 'Status change not saved — please retry');
            setContacts(prev => rollbackContact(prev, contact));
          });
      }
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch (err) {
      // Old "saved locally" toast was a relic from offline-first; we don't
      // actually persist locally after Phase 2, so the success toast lied
      // when the DB write failed. Surface the real failure.
      reportError('ContactsPage', 'handleQuickAction.saveActivity', err);
      toast.error(translateErr(err));
    }
    setSavingQuickAction(false);
    setQuickActionTarget(null);
  };

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (quickActionTarget) { setQuickActionTarget(null); return; }
      if (batchCallMode) { setBatchCallMode(false); return; }
      if (mergePreview) { setMergePreview(null); setMergeTargets([]); setMergeMode(false); return; }
      if (disqualifyModal) { setDisqualifyModal(null); return; }
      if (bulkOppModal) { setBulkOppModal(false); return; }
      if (bulkSMSModal) { setBulkSMSModal(false); setBulkSMSState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); return; }
      if (bulkReassignModal) { setBulkReassignModal(false); return; }
      if (confirmAction) { setConfirmAction(null); return; }
      if (bulkDropdownOpen) { setBulkDropdownOpen(null); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [quickActionTarget, batchCallMode, mergePreview, disqualifyModal, bulkOppModal, bulkReassignModal, confirmAction, bulkSMSModal, bulkDropdownOpen]);

  const handleDelete = async (id) => {
    // Gate on the permission, not a hardcoded role string. roles.js may grant
    // CONTACTS_DELETE to operations later without anyone remembering to update
    // this check; permission-driven means the UI keeps up automatically.
    if (!perms.canDeleteContacts) {
      toast.error(isRTL ? 'مفيش صلاحية حذف' : 'No delete permission');
      return;
    }
    const contact = contacts.find(c => c.id === id);
    // Check for linked data before confirming
    let linkedOpps = 0, linkedTasks = 0, linkedActs = 0;
    try {
      const [oppsRes, tasksRes, actsRes] = await Promise.all([
        supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('contact_id', id),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('contact_id', id),
        supabase.from('activities').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      ]);
      linkedOpps = oppsRes.count || 0;
      linkedTasks = tasksRes.count || 0;
      linkedActs = actsRes.count || 0;
    } catch (err) { if (import.meta.env.DEV) console.warn('count linked items:', err); }

    const hasLinked = linkedOpps > 0 || linkedTasks > 0 || linkedActs > 0;
    const warning = hasLinked
      ? (isRTL
        ? `\n⚠️ تحذير: سيتم حذف ${linkedOpps} فرصة و ${linkedTasks} مهمة و ${linkedActs} نشاط مرتبطين — لا يمكن التراجع!`
        : `\n⚠️ Warning: ${linkedOpps} opportunities, ${linkedTasks} tasks, and ${linkedActs} activities will also be deleted — this cannot be undone!`)
      : '';
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: (isRTL ? `هل أنت متأكد من حذف "${contact?.full_name || ''}"؟` : `Are you sure you want to delete "${contact?.full_name || ''}"?`) + warning,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await deleteContact(id);
          setContacts(prev => prev.filter(c => c.id !== id));
          logAction({ action: 'delete', entity: 'contact', entityId: id, entityName: contact?.full_name, description: `Deleted contact: ${contact?.full_name} (${linkedOpps} opps, ${linkedTasks} tasks, ${linkedActs} activities)`, userName: profile?.full_name_ar });
          // Undo toast — soft delete is reversible via restoreContact, so
          // give the user 8s to take it back. Same UX as bulk delete.
          toast.show({
            type: 'success',
            message: isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully',
            duration: 8000,
            action: contact ? {
              label: isRTL ? 'تراجع' : 'Undo',
              onClick: () => restoreContacts([contact]),
            } : undefined,
          });
        } catch (err) {
          toast.error(translateErr(err));
        } finally {
          setActionLoading(false);
        }
        setConfirmAction(null);
      }
    });
  };

  const BULK_WARN_THRESHOLD = 50;
  const handleDeleteSelected = () => {
    const warnMsg = selectedIds.length > BULK_WARN_THRESHOLD ? (isRTL ? `\n⚠️ أنت على وشك حذف ${selectedIds.length} عميل دفعة واحدة!` : `\n⚠️ You are about to delete ${selectedIds.length} leads at once!`) : '';
    const toDelete = contacts.filter(c => selectedIds.includes(c.id));
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: (isRTL ? `حذف ${selectedIds.length} عميل؟` : `Delete ${selectedIds.length} leads?`) + warnMsg,
      items: toDelete,
      onConfirm: async () => {
        const count = selectedIds.length;
        const deletedItems = contacts.filter(c => selectedIds.includes(c.id));
        const names = deletedItems.map(c => c.full_name).join(', ');
        const idsToDelete = [...selectedIds];
        const updated = contacts.filter(c => !selectedIds.includes(c.id));
        setContacts(updated);
        logAction({ action: 'bulk_delete', entity: 'contact', entityId: idsToDelete.join(','), description: `Bulk deleted ${count} contacts: ${names}`, userName: profile?.full_name_ar });
        setSelectedIds([]);
        deletedContactsRef.current = deletedItems;
        setConfirmAction(null);
        // deleteContact already retries internally via retryWithBackoff — no outer wrapping needed
        const results = await Promise.allSettled(idsToDelete.map(sid => deleteContact(sid)));
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          failed.forEach(r => reportError('ContactsPage', 'bulkDelete', r.reason));
          toast.error(isRTL ? `فشل حذف ${failed.length} من ${count}` : `Failed to delete ${failed.length} of ${count}`);
        } else {
          toast.show({ type: 'success', message: isRTL ? `تم حذف ${count} عميل` : `${count} leads deleted`, duration: 5000, action: { label: isRTL ? 'تراجع' : 'Undo', onClick: () => restoreContacts(deletedItems) } });
        }
      }
    });
  };

  // Bulk handlers operate on selectedIds, which can span multiple pages.
  // Server-side pagination means `contacts` only holds the current page,
  // so we must fetch any selected rows that aren't on screen — otherwise
  // off-page contacts get reset/wiped when the bulk write is computed
  // from a missing local row.
  const getAllSelectedContacts = async () => {
    const onPage = contacts.filter(c => selectedIds.includes(c.id));
    const onPageIds = new Set(onPage.map(c => c.id));
    const offPageIds = selectedIds.filter(id => !onPageIds.has(id));
    if (offPageIds.length === 0) return onPage;
    try {
      const { data } = await supabase.from('contacts').select('*').in('id', offPageIds);
      return [...onPage, ...(Array.isArray(data) ? data : [])];
    } catch {
      return onPage; // fall back to visible-only if fetch fails
    }
  };

  const handleBulkReassign = async (agent, bulkStatus, bulkTemp) => {
    // Modal now passes { id, name } so we don't have to reverse-lookup the
    // UUID from a name (that path is fragile and was the root cause of the
    // 'reassign recorded but lead still with old owner' bug — the DB trigger
    // resets assigned_to_name back when assigned_to UUID didn't change).
    const agentId = agent?.id || null;
    const agentName = agent?.name || (typeof agent === 'string' ? agent : '');
    if (!agentName) {
      toast.error(isRTL ? 'لم يتم اختيار سيلز' : 'No agent selected');
      return;
    }
    // Validate the target agent: must be a real user AND within the
    // caller's team scope. Catches typos and cross-team escalation
    // attempts before any DB write happens.
    const v = await validateAgentNames([agentName]);
    if (!v.ok) {
      toast.error(isRTL
        ? (v.outOfScope.length ? `لا يمكنك التعيين لهذا السيلز — خارج فريقك` : `سيلز غير موجود: ${v.unknown.join(', ')}`)
        : (v.outOfScope.length ? `Cannot reassign to that agent — outside your team scope` : `Unknown agent: ${v.unknown.join(', ')}`));
      return;
    }
    if (!agentId) {
      // Fallback path (modal couldn't load users) — refuse rather than write
      // a half-update that leaves rows stuck with the old owner.
      toast.error(isRTL
        ? `لم يتم العثور على معرّف ${agentName} — أعد فتح المودال`
        : `Could not resolve UUID for ${agentName} — please reopen the modal`);
      return;
    }
    const assignedByName = profile?.full_name_ar || profile?.full_name_en || profile?.email || profile?.id || '—';
    const allSelected = await getAllSelectedContacts();
    const allSelectedById = new Map(allSelected.map(c => [c.id, c]));
    const names = allSelected.map(c => c.full_name).filter(Boolean).join(', ');
    const idsToUpdate = [...selectedIds];
    const extraUpdates = {};
    if (bulkStatus) extraUpdates.contact_status = bulkStatus; // bulk reassign sets global (admin/ops action)
    if (bulkTemp) extraUpdates.temperature = bulkTemp; // bulk reassign sets global (admin/ops action)
    const updated = contacts.map(c => selectedIds.includes(c.id) ? {
      ...c,
      assigned_to: agentId,
      assigned_to_name: agentName,
      assigned_to_names: [agentName],
      assigned_by_name: assignedByName,
      ...extraUpdates,
    } : c);
    setContacts(updated);
        logAction({ action: 'bulk_reassign', entity: 'contact', entityId: selectedIds.join(','), description: `Reassigned ${selectedIds.length} contacts to ${agentName}: ${names}`, newValue: agentName, userName: profile?.full_name_ar });
    // Reassignment activity rows are written server-side by reassign_contacts_smart
    // (only for leads that actually move) — so no client/RPC double-write and no
    // orphan activity for skipped ones.
    const reassignedContacts = allSelected;
    // Single notification for bulk assign (not one per lead)
    if (reassignedContacts.length === 1) {
      notifyLeadReassigned({ contactName: reassignedContacts[0].full_name || reassignedContacts[0].phone || '—', contactId: reassignedContacts[0].id, newAgentId: agentId, newAgentName: agentName, assignedBy: assignedByName });
    } else if (reassignedContacts.length > 1) {
      notifyLeadAssigned({ contactName: `${reassignedContacts.length} ليد جديد`, contactId: null, agentId, agentName, assignedBy: assignedByName });
    }
    // Opportunities reassignment is handled via Supabase in updateContact
    // Snapshot prior owners for the undo path so we can revert each row to
    // exactly its previous owner (different leads may have come from
    // different agents — can't just pick one global "previous" value).
    const undoSnapshot = allSelected.map(c => ({
      id: c.id,
      assigned_to: c.assigned_to || null,
      assigned_to_name: c.assigned_to_name || null,
    }));
    const undoReassign = async () => {
      try {
        await Promise.allSettled(undoSnapshot.map(s => updateContact(s.id, {
          assigned_to: s.assigned_to,
          assigned_to_name: s.assigned_to_name,
          assigned_to_names: s.assigned_to_name ? [s.assigned_to_name] : [],
        })));
        setContacts(prev => prev.map(c => {
          const snap = undoSnapshot.find(s => s.id === c.id);
          return snap ? { ...c, assigned_to: snap.assigned_to, assigned_to_name: snap.assigned_to_name, assigned_to_names: snap.assigned_to_name ? [snap.assigned_to_name] : [] } : c;
        }));
        toast.success(isRTL ? 'تم التراجع عن النقل' : 'Reassign undone');
      } catch (err) {
        toast.error(isRTL ? 'فشل التراجع' : 'Undo failed');
        reportError('ContactsPage', 'undoBulkReassign', err);
      }
    };
    setSelectedIds([]);
    setBulkReassignModal(false);
    setShowBulkMenu(false);
    setBulkProgress({
      label: isRTL ? `جاري النقل إلى ${agentName}` : `Reassigning to ${agentName}`,
      done: 0,
      total: idsToUpdate.length,
    });
    try {
      // One smart RPC: reassigns what it can, skips conflicts (recording why),
      // and returns { moved, skipped:[{contact_id,full_name,phone,reason}] }.
      // Replaces the old two-path mess (all-or-nothing RPC + slow per-row loop).
      const { data, error } = await supabase.rpc('reassign_contacts_smart', {
        p_contact_ids: idsToUpdate,
        p_to_user_id: agentId,
        p_assigned_by_name: assignedByName,
        p_new_status: bulkStatus || null,
        p_new_temperature: bulkTemp || null,
      });
      if (error) throw error;
      const moved = Number(data?.moved) || 0;
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      if (skipped.length > 0) {
        // Roll the skipped rows back to their prior owner — the optimistic
        // update above had shown them all as moved.
        const skippedIds = new Set(skipped.map(s => s.contact_id));
        setContacts(prev => prev.map(c => (skippedIds.has(c.id) && allSelectedById.has(c.id)) ? allSelectedById.get(c.id) : c));
      }
      if (moved > 0) {
        toast.show({
          type: 'success',
          message: isRTL ? `تم إعادة تعيين ${moved} عميل` : `${moved} leads reassigned`,
          duration: 8000,
          action: { label: isRTL ? 'تراجع' : 'Undo', onClick: undoReassign },
        });
      }
      // Show the skipped ones with reasons + the "send to another agent" flow.
      if (skipped.length > 0) setReassignSkipped({ agentName, moved, skipped });
    } catch (err) {
      // RPC failed entirely — revert every optimistically-reassigned row.
      const selSet = new Set(idsToUpdate);
      setContacts(prev => prev.map(c => (selSet.has(c.id) && allSelectedById.has(c.id)) ? allSelectedById.get(c.id) : c));
      toast.error(isRTL ? 'فشل إعادة التعيين — تم التراجع' : 'Reassign failed — reverted');
      reportError('ContactsPage', 'bulkReassignSmartRPC', err);
    }
    finally { setBulkProgress(null); }
  };

  const handleBulkChangeField = async (field, value, actionLabel) => {
    const count = selectedIds.length;
    const names = contacts.filter(c => selectedIds.includes(c.id)).map(c => c.full_name).join(', ');
    const idsToUpdate = [...selectedIds];
    // Snapshot the rows we're about to mutate so we can roll back any
    // individual failures. Without this the optimistic state stuck on
    // "updated" even when half the rows had RLS-denied — and the audit /
    // success toast had already fired.
    const beforeSnapshot = new Map(contacts.filter(c => selectedIds.includes(c.id)).map(c => [c.id, c]));
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, [field]: value } : c);
    setContacts(updated);
    setBulkDropdownOpen(null);
    setShowBulkMenu(false);
    // DB write FIRST, then audit/toast/notification only for what actually
    // saved. Original code logged + toast'd success before the write, so a
    // failed update still surfaced as "X leads updated" + an audit row.
    //
    // Use bulk_change_contact_status RPC for status changes — atomic single
    // round-trip instead of N updateContact calls. Other fields fall through
    // to the per-row updateContact path (rare — Type, Source, Dept, Campaign).
    let results;
    setBulkProgress({
      label: isRTL ? `جاري تحديث ${actionLabel}` : `Updating ${actionLabel}`,
      done: 0,
      total: idsToUpdate.length,
    });
    // Set when the failure-set is RLS-driven and we genuinely don't know
    // which IDs got skipped — used below to show a generic message instead
    // of fabricating "Ahmed/Mona/Karim failed" from arbitrary array indices.
    let opaqueFailure = false;
    if (field === 'contact_status') {
      const { data: count, error } = await supabase.rpc('bulk_change_contact_status', {
        p_contact_ids: idsToUpdate,
        p_new_status: value,
        p_dq_reason: null,
      });
      // Synthesize per-row results so the rest of the function (rollback +
      // toast + audit) keeps working unchanged. The RPC is all-or-nothing,
      // so on success every id is fulfilled, on error every id is rejected.
      if (error) {
        results = idsToUpdate.map(() => ({ status: 'rejected', reason: error }));
      } else if (typeof count === 'number' && count < idsToUpdate.length) {
        // Some rows skipped by RLS. We have a count but no per-row info —
        // earlier code marked "first N succeeded, rest failed" which is a
        // lie because RLS doesn't preserve array order. We still need to
        // mark some rows as rejected so the optimistic-state rollback
        // runs, but the toast below shouldn't claim specific names.
        opaqueFailure = true;
        results = idsToUpdate.map((_, i) => i < count
          ? { status: 'fulfilled', value: null }
          : { status: 'rejected', reason: new Error('skipped by RLS') });
      } else {
        results = idsToUpdate.map(() => ({ status: 'fulfilled', value: null }));
      }
    } else {
      // Per-row path — bump done as each promise settles so the user sees
      // real-time progress on hundreds of rows.
      results = await Promise.allSettled(idsToUpdate.map(id =>
        updateContact(id, { [field]: value }).finally(() => {
          setBulkProgress(p => p ? { ...p, done: p.done + 1 } : p);
        })
      ));
    }
    setBulkProgress(null);
    const succeeded = [];
    const failedIdx = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') succeeded.push(idsToUpdate[i]);
      else failedIdx.push(i);
    });
    if (failedIdx.length > 0) {
      if (opaqueFailure) {
        // RPC told us "N of M succeeded" but not which specific IDs. We
        // can't safely roll back individual rows (would revert a successful
        // change for an ID we wrongly assumed failed), and we can't name
        // specific failures either. Refetch the page so the UI reflects
        // the actual DB state, and tell the user honestly.
        reportError('ContactsPage', `bulkChange_${field}_partial`, new Error(`${failedIdx.length} of ${idsToUpdate.length} skipped by RLS`));
        toast.warning(isRTL
          ? `نجح ${idsToUpdate.length - failedIdx.length} من ${idsToUpdate.length} — الباقي خارج صلاحياتك أو DQ بدون سبب`
          : `${idsToUpdate.length - failedIdx.length} of ${idsToUpdate.length} succeeded — the rest were outside your scope or violate a constraint`);
        loadContactsData();
      } else {
        // Per-row path — we actually know which IDs failed, so we can
        // safely roll back just those and name them in the toast.
        setContacts(prev => prev.map(c => {
          if (!failedIdx.some(i => idsToUpdate[i] === c.id)) return c;
          const original = beforeSnapshot.get(c.id);
          return original || c;
        }));
        failedIdx.forEach(i => reportError('ContactsPage', `bulkChange_${field}`, results[i].reason));
        const failedNames = failedIdx.map(i => beforeSnapshot.get(idsToUpdate[i])?.full_name || idsToUpdate[i]).filter(Boolean);
        const preview = failedNames.slice(0, 3).join(', ');
        const more = failedNames.length > 3 ? (isRTL ? ` و${failedNames.length - 3} آخرين` : ` and ${failedNames.length - 3} more`) : '';
        toast.error(isRTL ? `فشل تحديث ${failedIdx.length} عميل: ${preview}${more}` : `Failed to update ${failedIdx.length} leads: ${preview}${more}`);
      }
    }
    if (succeeded.length > 0) {
      const succeededNames = succeeded.map(id => beforeSnapshot.get(id)?.full_name).filter(Boolean).join(', ');
      logAction({ action: `bulk_${field}_change`, entity: 'contact', entityId: succeeded.join(','), description: `Bulk changed ${field} to "${value}" for ${succeeded.length} contacts: ${succeededNames || names}`, newValue: value, userName: profile?.full_name_ar });
      // No `for_user_id:'all'` broadcast here — a routine operator action
      // (changing Type/Source/Status on a batch) shouldn't ping every user in
      // the org. The audit trail above already records who did what.
      toast.success(isRTL ? `تم تحديث ${succeeded.length} عميل` : `${succeeded.length} leads updated`);
    }
    setSelectedIds([]);
  };

  const handleBulkSMS = async () => {
    const { templateId, lang } = bulkSMSState;
    if (!templateId) return;
    const smsContacts = contacts.filter(c => selectedIds.includes(c.id) && c.phone);
    setBulkSMSState(s => ({ ...s, sending: true, total: smsContacts.length, progress: 0 }));
    try {
      const results = await bulkSend(templateId, smsContacts, lang);
      const resultsList = Array.isArray(results) ? results : [];
      setBulkSMSState(s => ({ ...s, sending: false, progress: smsContacts.length, done: true, results: resultsList }));
      logAction({ action: 'bulk_sms', entity: 'contact', entityId: selectedIds.join(','), description: `Bulk SMS sent to ${resultsList.length} contacts`, userName: profile?.full_name_ar });
      // Same as bulk field change — no org-wide notification broadcast for a
      // routine send; the audit row records it.
      toast.success(isRTL ? `تم إرسال ${resultsList.length} رسالة` : `${resultsList.length} messages sent`);
    } catch (err) {
      // Without this, a thrown bulkSend left the modal stuck on the spinner
      // because `sending: true` was never reset. Reset state and surface the
      // error so the user can retry instead of staring at a frozen UI.
      reportError('ContactsPage', 'handleBulkSMS', err);
      setBulkSMSState(s => ({ ...s, sending: false, progress: 0 }));
      toast.error(translateErr(err));
    }
  };

  const exportSelectedCSV = async () => {
    if (!perms.canExportContacts) {
      toast.error(isRTL ? 'ليس لديك صلاحية التصدير' : 'No export permission');
      return;
    }
    // getAllSelectedContacts handles the "selectAllPages" case where selectedIds
    // includes contacts not loaded into local `contacts` state. The previous
    // `contacts.filter` would silently drop those off-page IDs, exporting only
    // the current 25 rows even when 5000 were "selected".
    const list = await getAllSelectedContacts();
    exportCSVList(list);
    logAction({ action: 'export', entity: 'contact', description: `Exported ${list.length} selected contacts`, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    toast.success(isRTL ? `تم تصدير ${list.length} عميل` : `${list.length} leads exported`);
    setBulkDropdownOpen(null);
    setShowBulkMenu(false);
  };

  const exportCSVList = (list) => {
    const headers = isRTL ? ['ID','الاسم','الهاتف','الإيميل','النوع','المصدر','القسم','المنصة','الشركة','تاريخ الإنشاء'] : ['ID','Name','Phone','Email','Type','Source','Department','Platform','Company','Created'];
    const rows = list.map(c => [c.id, c.full_name, c.phone, c.email || '', c.contact_type, c.source || '', c.department || '', c.platform || '', c.company || '', c.created_at || '']);
    // Neutralize spreadsheet formula injection: a cell starting with = + - @
    // (or a leading tab/CR) is evaluated as a formula by Excel/Sheets, so a
    // contact named `=cmd|...` would execute on open. Prefix with ' to force text.
    const csvCell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    // Log export — best-effort, but don't swallow Supabase {error}
    // responses (the audit trail is the only place these exports are recorded).
    supabase.from('import_export_logs').insert([{
      type: 'export', user_id: profile?.id, user_name: profile?.full_name_en || profile?.full_name_ar,
      total_records: list.length, success_count: list.length, entity: 'contacts', status: 'completed',
      file_name: `contacts_${new Date().toISOString().slice(0,10)}.csv`,
    }])
      .then(({ error }) => { if (error) reportError('ContactsPage', 'exportLog', error); })
      .catch(err => reportError('ContactsPage', 'exportLog', err));
  };

  // Bulk action dropdown options
  const BULK_TYPE_OPTIONS = Object.entries(TYPE).map(([k, v]) => ({ value: k, label: isRTL ? v.label : v.labelEn }));
  const BULK_SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: isRTL ? v : (SOURCE_EN[k] || v) }));
  const BULK_DEPT_OPTIONS = [
    { value: 'sales', label: isRTL ? 'المبيعات' : 'Sales' },
    { value: 'hr', label: isRTL ? 'HR' : 'HR' },
    { value: 'finance', label: isRTL ? 'المالية' : 'Finance' },
    { value: 'marketing', label: isRTL ? 'التسويق' : 'Marketing' },
    { value: 'operations', label: isRTL ? 'العمليات' : 'Operations' },
  ];
  const BULK_STATUS_OPTIONS = [
    { value: 'new', label: isRTL ? 'جديد' : 'New' },
    { value: 'following', label: isRTL ? 'متابعة' : 'Following' },
    { value: 'contacted', label: isRTL ? 'تم التواصل' : 'Contacted' },
    { value: 'has_opportunity', label: isRTL ? 'لديه فرصة' : 'Has Opportunity' },
    { value: 'disqualified', label: isRTL ? 'غير مؤهل' : 'Disqualified' },
  ];
  const DQ_REASONS = [
    { value: 'existing_client', label: isRTL ? 'عميل حالي (شاري)' : 'Existing Client' },
    { value: 'resale', label: isRTL ? 'عايز يبيع وحدته' : 'Wants to sell unit' },
    { value: 'not_interested', label: isRTL ? 'غير مهتم' : 'Not interested' },
    { value: 'no_answer_all_time', label: isRTL ? 'لا يرد أبداً' : 'No Answer All Time' },
    { value: 'no_budget', label: isRTL ? 'ميزانية غير مناسبة' : 'No budget' },
    { value: 'wrong_audience', label: isRTL ? 'جمهور خاطئ' : 'Wrong audience' },
    { value: 'wrong_number', label: isRTL ? 'رقم خاطئ' : 'Wrong number' },
    { value: 'duplicate', label: isRTL ? 'مكرر' : 'Duplicate' },
    { value: 'other', label: isRTL ? 'سبب آخر' : 'Other' },
  ];

  const [totalContacts, setTotalContacts] = useState(0);
  // Distinct leads needing a follow-up: overdue = a pending task due before now;
  // today = a pending task due today. Same task query + role scope as the
  // __overdue_tasks / __today_followup filters, so each chip count equals the
  // list you get when you click it.
  const [followupCounts, setFollowupCounts] = useState({ overdue: 0, today: 0, upcoming: 0 });
  const [showOverdueTasks, setShowOverdueTasks] = useState(false);
  const [overdueContactIds, setOverdueContactIds] = useState(null);
  const [showTodayFollowups, setShowTodayFollowups] = useState(false);
  const [todayFollowupIds, setTodayFollowupIds] = useState(null);
  const [showUpcomingFollowups, setShowUpcomingFollowups] = useState(false);
  const [upcomingContactIds, setUpcomingContactIds] = useState(null);
  const [showNoOpps, setShowNoOpps] = useState(false);
  const [noOppsIds, setNoOppsIds] = useState(null);
  const [showSingleAgent, setShowSingleAgent] = useState(false);
  const [singleAgentIds, setSingleAgentIds] = useState(null);

  const globalFilter = useGlobalFilter();

  // Fetch overdue task contact IDs when filter is toggled
  useEffect(() => {
    if (!showOverdueTasks) { setOverdueContactIds(null); return; }
    const fetchOverdue = async () => {
      try {
        // Calendar-based: due before the start of today (matches the dropdown's
        // mutually-exclusive overdue/today/upcoming buckets).
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        let q = supabase.from('tasks')
          .select('contact_id')
          .eq('status', 'pending')
          .lt('due_date', todayStart.toISOString())
          .not('contact_id', 'is', null);
        // Role filter: sales_agent sees only their tasks
        if (profile?.role === 'sales_agent' && profile?.id) q = q.eq('assigned_to', profile.id);
        const { data } = await q;
        if (data) {
          const ids = [...new Set(data.map(t => t.contact_id).filter(Boolean))];
          setOverdueContactIds(ids);
        }
      } catch { setOverdueContactIds([]); }
    };
    fetchOverdue();
  }, [showOverdueTasks]);

  // Fetch today's followup contact IDs
  useEffect(() => {
    if (!showTodayFollowups) { setTodayFollowupIds(null); return; }
    const fetchToday = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        let q = supabase.from('tasks')
          .select('contact_id')
          .eq('status', 'pending')
          .gte('due_date', today + 'T00:00:00')
          .lte('due_date', today + 'T23:59:59')
          .not('contact_id', 'is', null);
        if (profile?.role === 'sales_agent' && profile?.id) q = q.eq('assigned_to', profile.id);
        const { data } = await q;
        if (data) {
          const ids = [...new Set(data.map(t => t.contact_id).filter(Boolean))];
          setTodayFollowupIds(ids);
        }
      } catch { setTodayFollowupIds([]); }
    };
    fetchToday();
  }, [showTodayFollowups]);

  // Fetch upcoming followup contact IDs (pending task due after today).
  useEffect(() => {
    if (!showUpcomingFollowups) { setUpcomingContactIds(null); return; }
    const fetchUpcoming = async () => {
      try {
        const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
        let q = supabase.from('tasks')
          .select('contact_id')
          .eq('status', 'pending')
          .gte('due_date', tomorrow.toISOString())
          .not('contact_id', 'is', null);
        if (profile?.role === 'sales_agent' && profile?.id) q = q.eq('assigned_to', profile.id);
        const { data } = await q;
        if (data) setUpcomingContactIds([...new Set(data.map(t => t.contact_id).filter(Boolean))]);
      } catch { setUpcomingContactIds([]); }
    };
    fetchUpcoming();
  }, [showUpcomingFollowups]);

  // Stage sub-filter: when the user filters by has_opportunity, fetch
  // (1) per-stage counts to render numbers on the stage chips, and
  // (2) the contact_ids that have an opp in the selected stage so the
  //     query can narrow the visible list.
  useEffect(() => {
    if (filterStatus !== 'has_opportunity') {
      // Outside has_opportunity, clear stage filter + counts.
      if (filterStage !== 'all') setFilterStage('all');
      setStageContactIds(null);
      setStageCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Counts per stage (group on the client).
        // Scope to the same dept/agent/role the contacts query uses so
        // chip counts and table totals always agree. Without these
        // filters the "Proposal 12" chip could be 12 opps across every
        // dept, while the table filtered to sales+Ahmed would show 8 —
        // the user clicked a number that didn't match what they got.
        const deptFilter = globalFilter?.department && globalFilter.department !== 'all' ? globalFilter.department : null;
        const agentFilter = globalFilter?.agentName && globalFilter.agentName !== 'all' ? globalFilter.agentName : null;
        // Page through ALL matching opportunities. A plain .select() silently
        // caps at 1000 rows, so on tenants with >1000 opps the stage-chip
        // counts were wrong and stage filtering missed contacts (C-5).
        const rows = [];
        const CHUNK = 1000;
        for (let offset = 0; ; offset += CHUNK) {
          let query = supabase
            .from('opportunities')
            .select('contact_id, stage')
            .not('contact_id', 'is', null);
          if (deptFilter) query = query.eq('department', deptFilter);
          if (agentFilter) query = query.eq('assigned_to_name', agentFilter);
          if (profile?.role === 'sales_agent' && profile?.id) query = query.eq('assigned_to', profile.id);
          const { data, error } = await query.range(offset, offset + CHUNK - 1);
          if (error) throw error;
          if (cancelled) return;
          if (!data?.length) break;
          rows.push(...data);
          if (data.length < CHUNK) break;
        }
        const counts = {};
        const idsByStage = {};
        (rows || []).forEach(r => {
          if (!r.stage) return;
          counts[r.stage] = (counts[r.stage] || 0) + 1;
          (idsByStage[r.stage] = idsByStage[r.stage] || new Set()).add(r.contact_id);
        });
        setStageCounts(counts);
        if (filterStage === 'all') {
          setStageContactIds(null);
        } else {
          const ids = idsByStage[filterStage] ? [...idsByStage[filterStage]] : [];
          // Use a never-matching UUID as the empty sentinel — passing
          // a non-UUID like 'none' to .in('id', ...) makes PostgREST
          // return 400 (contacts.id is uuid-typed).
          setStageContactIds(ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        }
      } catch {
        setStageContactIds(null);
        setStageCounts({});
      }
    })();
    return () => { cancelled = true; };
  }, [filterStatus, filterStage, globalFilter?.department, globalFilter?.agentName, profile?.role, profile?.id]);

  // Fetch contact IDs that HAVE opportunities (to exclude them)
  useEffect(() => {
    if (!showNoOpps) { setNoOppsIds(null); return; }
    (async () => {
      try {
        const { data: withOpps } = await supabase.from('opportunities').select('contact_id').not('contact_id', 'is', null);
        const ids = [...new Set((withOpps || []).map(o => o.contact_id).filter(Boolean))];
        // Store as EXCLUDE list (contacts WITH opps) - will be handled in service
        setNoOppsIds(ids.length ? ids : ['none']);
      } catch { setNoOppsIds([]); }
    })();
  }, [showNoOpps]);

  // "No activity by [agent or anyone]" filter — fetches contact IDs that
  // already have an activity (matching the agent if specified) so we can
  // exclude them from the visible list.
  const noActivityFilter = smartFilters.find(f => f.field === '_no_activity_by' && (f.operator === 'is' || !f.operator));
  const [noActivityExcludeIds, setNoActivityExcludeIds] = useState(null);
  useEffect(() => {
    if (!noActivityFilter?.value) { setNoActivityExcludeIds(null); return; }
    let cancelled = false;
    (async () => {
      try {
        let q = supabase.from('activities').select('contact_id').not('contact_id', 'is', null);
        if (noActivityFilter.value !== '__anyone') {
          // Strip the PostgREST OR delimiters from the agent name before
          // interpolating — a name containing a comma/paren would otherwise
          // break the .or() tokenizer and widen the match unexpectedly.
          const safe = String(noActivityFilter.value).replace(/[,()]/g, '');
          q = q.or(`user_name_en.eq.${safe},user_name_ar.eq.${safe}`);
        }
        const { data } = await q.range(0, 9999);
        if (cancelled) return;
        const ids = [...new Set((data || []).map(r => r.contact_id).filter(Boolean))];
        setNoActivityExcludeIds(ids.length ? ids : ['none']);
      } catch {
        if (!cancelled) setNoActivityExcludeIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [noActivityFilter?.value]);

  // Fetch contacts with MULTIPLE agents (to exclude → show single agent only).
  // 'Never Reassigned' filter — after Phase 3 single-assignment, the
  // old 'multi-agent' logic returned an empty set (every contact has
  // exactly one assignee now), making the filter useless. The user's
  // real intent is 'still with the original sales agent since creation'
  // so they can rotate stale leads. We compute that as: contacts that
  // have NO activity row of type='reassignment' (recordAssignment
  // writes one of those on every hand-off / bulk-reassign — see
  // contactsService.recordAssignment line 58). We pass the EXCLUDE
  // list (contacts that HAVE been reassigned) downstream — keeping the
  // existing excludeContactIds plumbing without changing the schema.
  useEffect(() => {
    if (!showSingleAgent) { setSingleAgentIds(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const reassignedIds = new Set();
        const CHUNK = 1000;
        for (let offset = 0; ; offset += CHUNK) {
          const { data } = await supabase
            .from('activities')
            .select('contact_id')
            .eq('type', 'reassignment')
            .not('contact_id', 'is', null)
            .range(offset, offset + CHUNK - 1);
          if (cancelled) return;
          if (!data?.length) break;
          data.forEach(a => { if (a.contact_id) reassignedIds.add(a.contact_id); });
          if (data.length < CHUNK) break;
        }
        if (cancelled) return;
        const excludeIds = [...reassignedIds];
        // 'none' sentinel signals 'nothing to exclude' to the service —
        // matches the noOppsIds pattern.
        setSingleAgentIds(excludeIds.length ? excludeIds : ['none']);
      } catch {
        if (!cancelled) setSingleAgentIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [showSingleAgent]);

  // Tally how many distinct leads have an overdue / due-today pending task.
  // Uses the same task query shape + role scope as the __overdue_tasks /
  // __today_followup filters so the chip numbers always match the filtered
  // list. Refreshed on every list load (called from loadContactsData).
  const loadFollowupCounts = useCallback(async () => {
    if (!profile) return;
    try {
      // Server-side distinct-contact counts (overdue / today / upcoming). The
      // old client tally fetched contact_ids and capped at 1000, so the overdue
      // number was wrong (real backlog is ~2200). RLS scopes it per role.
      const { data, error } = await supabase.rpc('get_followup_counts');
      if (error) throw error;
      setFollowupCounts({
        overdue: Number(data?.overdue) || 0,
        today: Number(data?.today) || 0,
        upcoming: Number(data?.upcoming) || 0,
      });
    } catch (err) { if (import.meta.env.DEV) console.warn('followup counts:', err); }
  }, [profile?.role, profile?.id]);

  // Load contacts with server-side pagination
  const hasLoadedOnce = useReactRef(false);
  const [searching, setSearching] = useState(false);
  const loadContactsData = useCallback(async (pg) => {
    // First load: full skeleton. Subsequent: subtle indicator only
    if (!hasLoadedOnce.current) setLoading(true); else setSearching(true);
    try {
      const currentPage = pg || page || 1;
      // Handle special quick filter values
      const isTodayFollowup = smartFilters.some(f => f.value === '__today_followup');
      const isOverdueTasks = smartFilters.some(f => f.value === '__overdue_tasks');
      const isUpcomingFollowup = smartFilters.some(f => f.value === '__upcoming_followup');
      const isNoOpps = smartFilters.some(f => f.value === '__no_opps');
      const isSingleAgent = smartFilters.some(f => f.value === '__single_agent');
      if (isTodayFollowup && !showTodayFollowups) setShowTodayFollowups(true);
      if (isOverdueTasks && !showOverdueTasks) setShowOverdueTasks(true);
      if (isUpcomingFollowup && !showUpcomingFollowups) setShowUpcomingFollowups(true);
      if (isNoOpps && !showNoOpps) setShowNoOpps(true);
      if (isSingleAgent && !showSingleAgent) setShowSingleAgent(true);
      if (!isTodayFollowup && showTodayFollowups) { setShowTodayFollowups(false); setTodayFollowupIds(null); }
      if (!isOverdueTasks && showOverdueTasks) { setShowOverdueTasks(false); setOverdueContactIds(null); }
      if (!isUpcomingFollowup && showUpcomingFollowups) { setShowUpcomingFollowups(false); setUpcomingContactIds(null); }
      if (!isNoOpps && showNoOpps) { setShowNoOpps(false); setNoOppsIds(null); }
      if (!isSingleAgent && showSingleAgent) { setShowSingleAgent(false); setSingleAgentIds(null); }

      // If a task-based follow-up filter is active but its contact-id list
      // hasn't been fetched yet (null), skip this load. Otherwise we'd run an
      // UNFILTERED query (every lead) — and a slow unfiltered response could
      // even land after the filtered one and clobber it. The dedicated
      // id-fetch effects re-trigger this load once the ids are ready.
      const followupIdsPending =
        (isOverdueTasks && overdueContactIds == null) ||
        (isTodayFollowup && todayFollowupIds == null) ||
        (isUpcomingFollowup && upcomingContactIds == null) ||
        (isNoOpps && noOppsIds == null) ||
        (isSingleAgent && singleAgentIds == null);
      if (followupIdsPending) { setLoading(false); setSearching(false); return; }

      // Extract server-side filters from smartFilters (skip special ones).
      // is / is_not / in / not_in all need to be sent to the server, otherwise
      // the page falls back to client-side filtering on the visible page only
      // — which silently misses contacts on other pages and produces wrong
      // counts for "is none of"-style filters.
      const SELECT_OPS = ['is', 'is_not', 'in', 'not_in'];
      const statusFilter = smartFilters.find(f => f.field === 'contact_status' && SELECT_OPS.includes(f.operator) && !(typeof f.value === 'string' && f.value?.startsWith('__')));
      // my_status / my_temperature / my_score smart filters were previously
      // client-only, which silently undercounted on server-paginated views.
      // Translate them here to the existing per-agent server filters using
      // the current user's name as the JSON key.
      const myName = profile?.full_name_en || profile?.full_name_ar;
      const myStatusFilter = smartFilters.find(f => f.field === 'my_status' && SELECT_OPS.includes(f.operator));
      const myTempFilter = smartFilters.find(f => f.field === 'my_temperature' && SELECT_OPS.includes(f.operator));
      const agentSmartFilter = smartFilters.find(f => f.field === 'assigned_to_name' && SELECT_OPS.includes(f.operator));
      const sourceSmartFilter = smartFilters.find(f => f.field === 'source' && SELECT_OPS.includes(f.operator));
      const deptSmartFilter = smartFilters.find(f => f.field === 'department' && f.operator === 'is');
      // Server-side text/date filters
      const nameFilter = smartFilters.find(f => f.field === 'full_name' && f.value);
      const emailFilter = smartFilters.find(f => f.field === 'email' && f.value);
      const phoneFilter = smartFilters.find(f => f.field === 'phone' && f.value);
      const createdFilter = smartFilters.find(f => f.field === 'created_at' && f.value);
      const campaignFilter = smartFilters.find(f => f.field === 'campaign_name' && f.value);
      const result = await fetchContacts({
        role: profile?.role,
        userId: profile?.id,
        teamId: profile?.team_id,
        filters: {
          search: search || undefined,
          contact_type: filterType !== 'all' ? filterType : undefined,
          temperature: myTempFilter?.value || (filterTemp !== 'all' ? filterTemp : undefined),
          agentNameForTemp: myTempFilter
            ? myName  // my_temperature smart filter — always against current user's slot
            : (filterTemp !== 'all' ? (
              (globalFilter?.agentName && globalFilter.agentName !== 'all')
                ? globalFilter.agentName
                : (profile?.role !== 'admin' && profile?.role !== 'operations')
                  ? myName
                  : undefined
            ) : undefined),
          showBlacklisted: showBlacklisted || undefined,
          unassigned: showUnassigned || undefined,
          department: deptSmartFilter?.value || ((globalFilter?.department && globalFilter.department !== 'all') ? globalFilter.department : undefined),
          assigned_to_name: agentSmartFilter?.value || ((globalFilter?.agentName && globalFilter.agentName !== 'all') ? globalFilter.agentName : undefined),
          assigned_to_name_op: agentSmartFilter?.operator,
          assigned_to_name_not: (agentSmartFilter?.operator === 'is_not' || agentSmartFilter?.operator === 'not_in') ? true : undefined,
          source: sourceSmartFilter?.value || undefined,
          source_op: sourceSmartFilter?.operator,
          source_not: (sourceSmartFilter?.operator === 'is_not' || sourceSmartFilter?.operator === 'not_in') ? true : undefined,
          // Server-side smart filters
          smartName: nameFilter?.value || undefined,
          smartEmail: emailFilter?.value || undefined,
          smartPhone: phoneFilter?.value || undefined,
          smartCreatedAt: createdFilter ? { operator: createdFilter.operator, value: createdFilter.value } : undefined,
          smartCampaign: campaignFilter?.value || undefined,
          // When an overdue/today follow-up filter is active but resolved to an
          // empty set, send a never-matching sentinel so the list shows NOTHING
          // (not everything). fetchContacts treats an empty array as "no filter".
          contactIds: stageContactIds
            || (isOverdueTasks ? (overdueContactIds?.length ? overdueContactIds : ['00000000-0000-0000-0000-000000000000']) : null)
            || (isTodayFollowup ? (todayFollowupIds?.length ? todayFollowupIds : ['00000000-0000-0000-0000-000000000000']) : null)
            || (isUpcomingFollowup ? (upcomingContactIds?.length ? upcomingContactIds : ['00000000-0000-0000-0000-000000000000']) : null)
            || undefined,
          // Union every active exclude source instead of falling through with
          // `||` — the old chain silently dropped every list past the first
          // non-null one, so toggling "no activity by X" + "no opps" applied
          // only the first filter and the user got a result they didn't ask
          // for. dedupe so we don't send a giant array of repeats.
          excludeContactIds: (() => {
            const sources = [
              noActivityExcludeIds,
              showNoOpps ? noOppsIds : null,
              showSingleAgent ? singleAgentIds : null,
            ].filter(arr => Array.isArray(arr) && arr.length > 0);
            if (sources.length === 0) return undefined;
            if (sources.length === 1) return sources[0];
            return Array.from(new Set(sources.flat()));
          })(),
          contact_status: myStatusFilter?.value || statusFilter?.value || (filterStatus !== 'all' ? filterStatus : undefined),
          contact_status_op: myStatusFilter?.operator || statusFilter?.operator,
          contact_status_not: ((myStatusFilter?.operator === 'is_not' || myStatusFilter?.operator === 'not_in') || statusFilter?.operator === 'is_not' || statusFilter?.operator === 'not_in') ? true : undefined,
          agentNameForStatus: myStatusFilter
            ? myName  // my_status smart filter — always against current user's slot
            : ((statusFilter?.value || filterStatus !== 'all') ? (
            // If Global Filter has a specific agent, use that agent's name
            (globalFilter?.agentName && globalFilter.agentName !== 'all')
              ? globalFilter.agentName
              // Non-admin users always use their own name for per-agent filtering
              : (profile?.role !== 'admin' && profile?.role !== 'operations')
                ? myName
                // Admin without Global Filter: use global contact_status
                : undefined
          ) : undefined),
          // Pass team member names for managers/admin to search per-agent statuses
          teamMemberNames: (filterStatus !== 'all' || filterTemp !== 'all') && !globalFilter?.agentName
            ? allAgentNames || undefined
            : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          activityFilter: filterActivity !== 'all' ? filterActivity : undefined,
          activityActiveDays: ACTIVITY_ACTIVE_DAYS,
          activityModerateDays: ACTIVITY_MODERATE_DAYS,
        },
        page: currentPage,
        pageSize,
        sortBy,
      });
      let list = Array.isArray(result?.data) ? result.data : [];
      // For TL/Manager: show their team member's name, not the first assignee
      if ((profile?.role === 'team_leader' || profile?.role === 'sales_manager') && profile?.team_id) {
        try {
          const teamIds = [profile.team_id];
          if (profile.role === 'sales_manager') {
            const { data: ch } = await supabase.from('departments').select('id').eq('parent_id', profile.team_id);
            if (ch) teamIds.push(...ch.map(c => c.id));
          }
          const { data: members } = await supabase.from('users').select('full_name_en').in('team_id', teamIds);
          const teamNames = new Set((members || []).map(m => m.full_name_en).filter(Boolean));
          list = list.map(c => {
            const names = c.assigned_to_names || [];
            const teamMember = names.find(n => teamNames.has(n));
            return teamMember ? { ...c, assigned_to_name: teamMember } : c;
          });
        } catch (err) { if (import.meta.env.DEV) console.warn('resolve team display name:', err); }
      }
      // Show contacts immediately, then load feedback in background
      setContacts(list);
      setTotalContacts(result?.count || list.length);
      // Keep the follow-up chip tallies in sync with the list (after edits,
      // reassigns, status changes, page/filter changes).
      loadFollowupCounts();

      // Background: fetch feedback (non-blocking).
      // Auto-demote of stale `following` → `contacted` was REMOVED per
      // policy (May 2026): reps complained the system was silently moving
      // their leads between statuses while they were working them.
      // contact_status is now purely user-driven — anyone who wants a
      // periodic sweep should run it as a manager-triggered batch, not
      // hide it behind a page load.
      if (list.length) {

        // Fetch last feedback per contact via Postgres DISTINCT ON RPC
        // (non-blocking). The previous implementation pulled .range(0,199)
        // activities per chunk of 200 contacts, so for any chunk where ~30
        // contacts dominated the activity log, the other ~170 silently
        // stayed `_lastNote: null` even when they had real notes — reps
        // saw an empty feedback column for contacts they knew were
        // documented. The RPC returns exactly one row per contact (the
        // newest activity whose notes or description is non-empty), so
        // the page always shows the latest documented feedback if any
        // exists.
        const ids = list.map(c => c.id).filter(Boolean);
        const fetchFeedbackChunked = async () => {
          const lastByContact = {};
          const CHUNK = 500;
          for (let i = 0; i < ids.length; i += CHUNK) {
            const chunk = ids.slice(i, i + CHUNK);
            const { data: rows } = await supabase
              .rpc('get_latest_feedback_per_contact', { p_contact_ids: chunk });
            (rows || []).forEach(a => {
              if (!a.contact_id) return;
              a._feedback = a.notes || a.description || null;
              if (a._feedback) lastByContact[a.contact_id] = a;
            });
          }
          if (Object.keys(lastByContact).length) {
            setContacts(prev => prev.map(c => ({ ...c, _lastNote: lastByContact[c.id] || null })));
          }
        };
        fetchFeedbackChunked().catch(err => { if (import.meta.env.DEV) console.warn('fetch last feedback:', err); });

        // Fetch opportunity counts per contact via aggregating RPC
        // (non-blocking). Previously this pulled the full opp rows and
        // grouped client-side — for an admin scrolling a dept where many
        // contacts have multiple opps, the response could balloon to
        // thousands of rows just to compute integers. The RPC does the
        // GROUP BY in Postgres and returns one row per contact.
        supabase.rpc('get_contact_opp_counts', { p_contact_ids: ids })
          .then(({ data: counts }) => {
            if (counts?.length) {
              const countByContact = {};
              counts.forEach(c => { countByContact[c.contact_id] = Number(c.opp_count) || 0; });
              setContacts(prev => prev.map(c => ({ ...c, _opp_count: countByContact[c.id] || 0 })));
            }
          }).catch(err => { if (import.meta.env.DEV) console.warn('fetch opp counts:', err); });

        // Fetch the next pending follow-up per contact via aggregating RPC
        // (non-blocking) so each row shows a Next Action badge (overdue /
        // today / upcoming). RLS scopes the tasks to what the caller can see.
        supabase.rpc('get_next_followup_per_contact', { p_contact_ids: ids })
          .then(({ data: rows }) => {
            if (rows?.length) {
              const byContact = {};
              rows.forEach(r => { byContact[r.contact_id] = { next_due: r.next_due || null, overdue_count: Number(r.overdue_count) || 0, pending_count: Number(r.pending_count) || 0 }; });
              setContacts(prev => prev.map(c => ({ ...c, _nextFollowup: byContact[c.id] || null })));
            }
          }).catch(err => { if (import.meta.env.DEV) console.warn('fetch next followup:', err); });
      }
    } catch (err) {
      reportError('ContactsPage', 'loadContactsData', err);
      setContacts([]);
    } finally {
      setLoading(false);
      setSearching(false);
      hasLoadedOnce.current = true;
    }
  }, [profile?.role, profile?.id, profile?.team_id, page, pageSize, search, filterType, filterTemp, filterStatus, filterStage, filterActivity, dateFrom, dateTo, showBlacklisted, showUnassigned, globalFilter?.department, globalFilter?.agentName, smartFilters, sortBy, overdueContactIds, todayFollowupIds, upcomingContactIds, noOppsIds, singleAgentIds, noActivityExcludeIds, stageContactIds, loadFollowupCounts]);

  // Debounce filter/page-driven refetches by 250ms so rapid chip toggles
  // (status → temperature → activity → date in quick succession) collapse
  // into one Supabase round-trip instead of queueing 4-6 racing requests.
  // Search input already has its own 300ms debounce inside useContactsFilters.
  useEffect(() => {
    if (!profile) {
      setContacts(MOCK);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => loadContactsData(), 250);
    return () => clearTimeout(t);
  }, [profile, loadContactsData]);

  // Campaigns list — one-shot fetch, doesn't need the same debounce.
  useEffect(() => {
    fetchCampaigns()
      .then(c => setCampaignsList(c))
      .catch(err => { if (import.meta.env.DEV) console.warn('fetch campaigns:', err); });
  }, []);

  // Realtime: auto-refresh contacts when any row changes in Supabase. We
  // hold the latest loader in a ref so this callback identity is stable —
  // otherwise every filter / page change re-subscribed to the channel
  // (~20 churn/sec while the user types in search), which leaked WebSocket
  // connections and dropped events between unsub and re-sub.
  const loadContactsDataRef = useReactRef(loadContactsData);
  loadContactsDataRef.current = loadContactsData;

  useRealtimeSubscription('contacts', useCallback((payload) => {
    if (payload?.eventType) {
      const newRec = payload.new;
      const names = newRec?.assigned_to_names || [];
      // Skip contacts not relevant to this user's role
      if (profile?.role === 'sales_agent') {
        const myName = profile?.full_name_en || profile?.full_name_ar;
        if (myName && !names.includes(myName)) return;
      } else if (profile?.role === 'team_leader' || profile?.role === 'sales_manager') {
        if (payload.eventType === 'INSERT') {
          // For managers, INSERT events from realtime can't be safely merged
          // into the current page (no way to know if the new lead matches the
          // active filter / belongs on the user's current page). Earlier this
          // returned silently, so managers wouldn't see new leads until manual
          // reload. Trigger a re-fetch instead so the page stays in sync.
          loadContactsDataRef.current();
          return;
        }
      }
      setContacts(prev => applyRealtimePayload(prev, payload));
    } else if (profile) {
      loadContactsDataRef.current();
    }
  }, [profile?.role, profile?.full_name_en, profile?.full_name_ar]));

  // Handle highlight query param — open contact drawer directly
  useEffect(() => {
    if (!highlightId || highlightHandled.current) return;
    if (loading) return; // wait for first load
    highlightHandled.current = true;
    const contact = contacts.find(c => String(c.id) === String(highlightId));
    if (contact) {
      setSelected(contact);
    } else {
      // Contact not in current page — fetch directly from Supabase
      supabase.from('contacts').select('*').eq('id', highlightId).maybeSingle().then(({ data }) => {
        if (data) setSelected(data);
      });
    }
    // Clean URL immediately using a functional updater to avoid stale closure races with URL sync effect
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('highlight');
      return next;
    }, { replace: true });
  }, [highlightId, loading, contacts, setSearchParams]);

  // Stats — fetched from Supabase (real counts across all contacts).
  // STATUS_DEFS is hoisted to module scope (above) so the loadStats
  // useCallback's closure can't go stale on it.
  const [stats, setStats] = useState({ total: 0, blacklisted: 0, hot: 0, warm: 0, cool: 0, cold: 0 });
  const loadStats = useCallback(async () => {
    try {
      const deptFilter = (globalFilter?.department && globalFilter.department !== 'all') ? globalFilter.department : null;
      // Resolve agent filter to UUID (RPC takes uuid, not name)
      const agentNameFilter = (globalFilter?.agentName && globalFilter.agentName !== 'all') ? globalFilter.agentName : null;
      let agentIdFilter = null;
      if (agentNameFilter) {
        // .maybeSingle() throws PGRST116 if more than one row matches (e.g.
        // two users sharing partial name across en/ar). Use .limit(1) so
        // we deterministically take the first match. Also escape quotes
        // in the name to keep the .or() tokenizer happy.
        const safe = String(agentNameFilter).replace(/"/g, '\\"');
        const { data: u } = await supabase
          .from('users').select('id')
          .or(`full_name_en.eq."${safe}",full_name_ar.eq."${safe}"`)
          .limit(1);
        agentIdFilter = u?.[0]?.id || null;
      }
      // For sales_agent, lock the filter to themselves regardless of global filter
      if (profile?.role === 'sales_agent' && profile.id) agentIdFilter = profile.id;

      // Single-RPC stats — replaces 23 parallel COUNT queries.
      // RLS still applies (SECURITY INVOKER), so each role only counts what they can see.
      // p_status / p_temperature: chip groups exclude their own dimension
      // when counting (so the user can see how many would be in each
      // option), but honor the others — selecting status='following'
      // narrows the temperature chips to within following.
      const { data: result, error } = await supabase.rpc('get_contact_stats', {
        p_dept: deptFilter,
        p_agent_id: agentIdFilter,
        p_status: filterStatus !== 'all' ? filterStatus : null,
        p_temperature: filterTemp !== 'all' ? filterTemp : null,
      });
      if (error) throw error;

      // Flatten the nested jsonb into the flat counts shape callers expect
      const counts = {
        total: result?.total || 0,
        blacklisted: result?.blacklisted || 0,
        unassigned: result?.unassigned || 0,
      };
      const statusObj = result?.status || {};
      const tempObj = result?.temperature || {};
      const typeObj = result?.type || {};
      STATUS_DEFS.forEach(s => { counts[s.value] = statusObj[s.value] || 0; });
      ['hot', 'warm', 'cool', 'cold'].forEach(t => { counts['temp_' + t] = tempObj[t] || 0; });
      Object.keys(TYPE).forEach(t => { counts['type_' + t] = typeObj[t] || 0; });

      setStats(counts);
    } catch (err) { reportError('ContactsPage', 'loadStats', err); }
  }, [profile?.role, profile?.id, profile?.full_name_en, profile?.full_name_ar, globalFilter?.department, globalFilter?.agentName, filterStatus, filterTemp]);

  // Same 250ms debounce as loadContactsData — without this, rapid
  // toggles of globalFilter.agentName fire one users-table lookup per
  // keystroke (an admin toggling between agents 3 times in 2s used to
  // queue 3 user lookups + 3 get_contact_stats RPCs racing each other).
  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(() => loadStats(), 250);
    return () => clearTimeout(t);
  }, [profile, loadStats]);

  // Clear selection when filters change
  useEffect(() => { setSelectedIds([]); }, [filterType, search, showBlacklisted, sortBy, smartFilters, pageSize]);

  const selectedIdx = selected ? filtered.findIndex(c => c.id === selected.id) : -1;
  const handlePrev = selectedIdx > 0 ? () => {
    setSelected(filtered[selectedIdx - 1]);
    setOpenWithAction(false);
    setPage(Math.floor((selectedIdx - 1) / pageSize) + 1);
  } : null;
  const handleNext = selectedIdx >= 0 && selectedIdx < filtered.length - 1 ? () => {
    setSelected(filtered[selectedIdx + 1]);
    setOpenWithAction(false);
    setPage(Math.floor((selectedIdx + 1) / pageSize) + 1);
  } : null;

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [allPagesSelected, setAllPagesSelected] = useState(false);
  useEffect(() => { setAllPagesSelected(false); }, [filterType, smartFilters, showBlacklisted, search, sortBy]);
  const toggleSelectAll = () => {
    const pageIds = paged.map(c => c.id);
    const allSelected = pageIds.every(id => selectedIdSet.has(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !pageIds.includes(id)));
      setAllPagesSelected(false);
    } else {
      setSelectedIds([...new Set([...selectedIds, ...pageIds])]);
    }
  };
  const selectAllPages = async () => {
    // The original implementation only mirrored a subset of filters
    // (search/type/temp/status/blacklist/unassigned/dept/agent) and
    // silently ignored smartFilters, activity scope (overdue / today /
    // no-opps / never-reassigned / stage), date range, and the team
    // visibility scope. A user could narrow to "stage=Negotiation" then
    // hit Select-all-pages and end up selecting EVERY non-stage lead in
    // their dept — which a follow-up bulk delete would then nuke.
    //
    // Refuse to enable all-pages selection when any of those advanced
    // filters are active. The fallback ("select visible page only") is
    // still available — admin who wants more rows just paginates
    // through and selects each page.
    const hasComplexFilter = (
      smartFilters.length > 0
      || (stageContactIds && stageContactIds.length > 0)
      || (overdueContactIds && overdueContactIds.length > 0)
      || (todayFollowupIds && todayFollowupIds.length > 0)
      || (noOppsIds && noOppsIds.length > 0)
      || (singleAgentIds && singleAgentIds.length > 0)
      || (noActivityExcludeIds && noActivityExcludeIds.length > 0)
    );
    if (hasComplexFilter) {
      toast.warning(isRTL
        ? 'لا يمكن "تحديد كل الصفحات" مع الفلاتر المتقدمة. اختر يدوياً من كل صفحة.'
        : 'Cannot "select all pages" while advanced filters are active. Select per page manually.');
      return;
    }
    try {
      // Fetch all matching contact IDs from server (not just current page).
      // Apply the SAME role-aware filtering fetchContacts uses — without
      // this, team_leader/sales_manager would select IDs RLS later denies
      // on UPDATE, and the synthesized partial-success path (see the
      // bulk_change_contact_status path) would name random rows as failed.
      let query = supabase.from('contacts').select('id', { count: 'exact' });
      query = await applyRoleFilter(query, 'contacts', {
        role: profile?.role,
        userId: profile?.id,
        teamId: profile?.team_id,
      });
      if (search) { const s = search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, ''); if (s.length > 0) query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`); }
      if (filterType !== 'all') query = query.eq('contact_type', filterType);
      if (filterTemp !== 'all') query = query.eq('temperature', filterTemp);
      if (filterStatus !== 'all') query = query.eq('contact_status', filterStatus);
      if (showBlacklisted) query = query.eq('is_blacklisted', true);
      else query = query.eq('is_blacklisted', false);
      // Always exclude deleted from bulk selection — can't operate on deleted records
      query = query.eq('is_deleted', false);
      if (showUnassigned) query = query.or('assigned_to_name.is.null,assigned_to_name.eq.');
      const deptFilter = globalFilter?.department && globalFilter.department !== 'all' ? globalFilter.department : null;
      if (deptFilter) query = query.eq('department', deptFilter);
      const agentFilter = globalFilter?.agentName && globalFilter.agentName !== 'all' ? globalFilter.agentName : null;
      if (agentFilter) query = query.eq('assigned_to_name', agentFilter);
      const { data, count } = await query.range(0, 9999);
      // The 9,999 cap silently truncates large selections — better to refuse
      // and force the user to narrow filters than to let a subsequent bulk
      // delete operate on 2/3 of the intended set.
      if (count != null && count > 10000) {
        toast.warning(isRTL
          ? `النتائج كثيرة جداً (${count}). ضيّق الفلاتر قبل "تحديد كل الصفحات".`
          : `Too many results (${count}). Narrow your filters before "select all pages".`);
        return;
      }
      if (data?.length) {
        setSelectedIds(data.map(c => c.id));
        setAllPagesSelected(true);
      }
    } catch (err) {
      reportError('ContactsPage', 'handleSelectAllPages', err);
      // Fallback to current page — and DON'T claim all pages are selected;
      // a subsequent bulk action would operate on 25 rows while the banner
      // says "N selected". Mark visible-only so the toolbar reflects reality.
      setSelectedIds(contacts.map(c => c.id));
      setAllPagesSelected(false);
      toast.warning(isRTL
        ? 'فشل تحميل كل الصفحات — تم تحديد الصفحة الحالية فقط.'
        : 'Failed to load all pages — only the current page is selected.');
    }
  };

  const exportCSV = (list) => {
    exportCSVList(list);
    logAction({ action: 'export', entity: 'contact', description: `Exported ${list.length} contacts`, userName: profile?.full_name_ar || profile?.full_name_en || '' });
  };

  const handleSave = async (form) => {
    const matchedCampaign = form.campaign_name ? campaignsList.find(c => c.name_en?.toLowerCase() === form.campaign_name.toLowerCase() || c.name_ar?.toLowerCase() === form.campaign_name.toLowerCase()) : null;
    const campaign_interactions = form.campaign_name
      ? [{ campaign: form.campaign_name, campaign_id: matchedCampaign?.id || null, source: form.source, platform: form.platform, date: new Date().toISOString() }]
      : [];
    const myName = profile?.full_name_en || profile?.full_name_ar || '—';
    // The `newContact` placeholder that used to live here (with a
    // local_<ts> temp id) was unused — createContact builds its own
    // payload from cleanForm in the try{} below. Removed; only myName
    // stays because the next block still uses it.
    const cfValues = form._customFieldValues;
    const { _customFieldValues, ...cleanForm } = form;
    try {
      const assigneeName = cleanForm.assigned_to_name || profile?.full_name_en || profile?.full_name_ar || null;
      const assigneeNames = cleanForm.assigned_to_names || [assigneeName].filter(Boolean);
      // Pass the UUID alongside the name when we already have it (admin
      // override or self-assignment). createContact's resolver covers the
      // case where only the name is known.
      const explicitAssigneeId = cleanForm.assigned_to
        || (assigneeName === myName ? profile?.id || null : null);
      const saved = await createContact({
        ...cleanForm,
        campaign_interactions,
        ...(explicitAssigneeId ? { assigned_to: explicitAssigneeId } : {}),
        assigned_to_name: assigneeName,
        assigned_to_names: assigneeNames,
        assigned_by_name: profile?.full_name_ar || profile?.full_name_en || null,
        created_by: profile?.id || null,
        created_by_name: profile?.full_name_ar || profile?.full_name_en || null,
      });
      const updated = [{ ...saved, campaign_interactions }, ...contacts];
      setContacts(updated);
            if (cfValues) setCFValues('contact', saved.id, cfValues);
      logAction({ action: 'create', entity: 'contact', entityId: saved.id, entityName: cleanForm.full_name, description: `Created contact: ${cleanForm.full_name} (${cleanForm.contact_type})`, userName: profile?.full_name_ar });
      evaluateTriggers('contact', 'created', saved);
      // Notify assigned agent about new lead. The actual recipient is whoever
      // owns the saved contact — saved.assigned_to is the UUID; fall back to
      // self-assignment for the displayed name.
      const recipientId = saved.assigned_to || profile?.id || null;
      const recipientName = saved.assigned_to_name || profile?.full_name_en || profile?.full_name_ar || null;
      if (recipientId || recipientName) {
        notifyLeadAssigned({
          contactName: cleanForm.full_name || cleanForm.phone || '—',
          contactId: saved.id,
          agentId: recipientId,
          agentName: recipientName,
          assignedBy: profile?.full_name_ar || profile?.full_name_en || profile?.email || profile?.id || '—',
        });
      }
    } catch (err) {
      console.error('[handleSave] Failed to create contact:', err?.message || err);
      toast.error(translateErr(err));
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'n', action: () => setShowAddModal(true) },
    { key: 'e', action: () => { if (selected) setSelected(prev => prev ? { ...prev, _triggerEdit: true } : prev); } },
    { key: '/', action: () => { const el = document.querySelector('[data-search-input]'); if (el) el.focus(); } },
  ]);

  const tdCls = `px-4 py-3.5 border-b border-edge/50 dark:border-edge-dark/50 align-middle text-xs text-content dark:text-content-dark text-start`;

  if (loading) return <PageSkeleton hasKpis={false} tableRows={8} tableCols={7} />;

  return (<>
    {actionLoading && (
      <div className="fixed top-0 left-0 right-0 z-[2000] h-1 bg-brand-500/20 overflow-hidden">
        <div className="h-full bg-brand-500" style={{ width: '30%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
      </div>
    )}
    {bulkProgress && (
      // Slim status pill anchored top-center so the user always sees what's
      // running on bulk actions. Shows count when total is known; otherwise
      // just the label with a spinner via the actionLoading bar above.
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[2001] px-3.5 py-1.5 rounded-full bg-brand-700 text-white text-xs font-semibold shadow-lg flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
        <span className="w-2 h-2 rounded-full bg-white/90 animate-pulse" />
        <span>{bulkProgress.label}</span>
        {bulkProgress.total > 0 && (
          <span className="opacity-80 tabular-nums">
            {bulkProgress.done} / {bulkProgress.total}
          </span>
        )}
      </div>
    )}
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`font-['Cairo','Tajawal',sans-serif] text-content dark:text-content-dark px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen overflow-x-hidden ${selectedIds.length > 0 ? 'pb-32 sm:pb-24' : ''}`}>
      {/* Page Header */}
      <div className="mb-5 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'العملاء المحتملين' : 'Leads'}</h1>
          <p className="mt-1 mb-0 text-xs text-content-muted dark:text-content-muted-dark">
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${totalContacts.toLocaleString()} ${isRTL ? 'عميل' : 'leads'}`}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {perms.canExportContacts && (
            <button onClick={() => exportCSV(filtered)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
              <Download size={14} /> <span className="hidden sm:inline">{isRTL ? 'تصدير' : 'Export'}</span>
            </button>
          )}
          {perms.canImportContacts && (
            <button onClick={() => setShowImportModal(true)} aria-label={isRTL ? 'استيراد' : 'Import'}
              className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
              <Upload size={14} /> <span className="hidden sm:inline">{isRTL ? 'استيراد' : 'Import'}</span>
            </button>
          )}
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> {isRTL ? 'إضافة عميل' : 'Add Lead'}
          </Button>
        </div>
      </div>

      {/* Follow-up chips — top of the page. Overdue / Today / Upcoming with live,
          server-side distinct-contact counts; each its own colour. Toggle to
          filter the list (one bucket at a time). */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {[
          { key: 'overdue',  label: isRTL ? 'متأخرة' : 'Overdue',  count: followupCounts.overdue,  color: '#EF4444' },
          { key: 'today',    label: isRTL ? 'النهاردة' : 'Today',   count: followupCounts.today,    color: '#F59E0B' },
          { key: 'upcoming', label: isRTL ? 'قادمة' : 'Upcoming',   count: followupCounts.upcoming, color: '#3B82F6' },
        ].map(c => {
          const active = followupFilterValue === c.key;
          return (
            <button key={c.key} onClick={() => setFollowupFilter(active ? 'all' : c.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
              style={active ? { border: `1px solid ${c.color}`, background: `${c.color}15`, color: c.color } : undefined}>
              <Clock size={11} /> {c.label}
              <span className={`rounded-xl px-2 py-px text-[10px] ms-1 ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                style={active ? { background: c.color, color: '#fff' } : undefined}>{c.count}</span>
            </button>
          );
        })}
      </div>

      {/* Type Filter — dropdown style */}
      {(() => {
        const LEAD_TYPES = ['lead', 'cold', 'customer', 'repeat_buyer', 'vip', 'referrer'];
        const types = deptView.contactTypes || LEAD_TYPES;
        const activeType = types.find(k => k === filterType);
        const activeLabel = activeType && TYPE[activeType] ? (isRTL ? TYPE[activeType].label : TYPE[activeType].labelEn) : (isRTL ? 'كل الأنواع' : 'All Types');
        return (
          <div className="flex gap-2 flex-wrap mb-3">
            {/* Type dropdown */}
            <div className="relative inline-block">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark cursor-pointer appearance-none pe-7"
                style={activeType ? { borderColor: TYPE[activeType]?.color, color: TYPE[activeType]?.color } : undefined}>
                <option value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
                {types.filter(k => TYPE[k]).map(k => (
                  <option key={k} value={k}>{isRTL ? TYPE[k].label : TYPE[k].labelEn} ({stats['type_' + k] || 0})</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted" />
            </div>
            {/* Activity dropdown */}
            <div className="relative inline-block">
              <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark cursor-pointer appearance-none pe-7"
                style={filterActivity !== 'all' ? { borderColor: filterActivity === 'active_3d' ? '#10B981' : filterActivity === 'moderate_7d' ? '#F59E0B' : filterActivity === 'stale' ? '#EF4444' : '#6b7280', color: filterActivity === 'active_3d' ? '#10B981' : filterActivity === 'moderate_7d' ? '#F59E0B' : filterActivity === 'stale' ? '#EF4444' : '#6b7280' } : undefined}>
                {/* Shape suffix (●▲■✕) doubles as a colorblind-safe cue —
                    relying on color alone fails for ~8% of male users. */}
                <option value="all">{isRTL ? 'كل النشاط' : 'All Activity'}</option>
                <option value="active_3d">{isRTL ? `● نشط (${ACTIVITY_ACTIVE_DAYS} أيام)` : `● Active (${ACTIVITY_ACTIVE_DAYS}d)`}</option>
                <option value="moderate_7d">{isRTL ? `▲ متوسط (${ACTIVITY_MODERATE_DAYS} أيام)` : `▲ Moderate (${ACTIVITY_MODERATE_DAYS}d)`}</option>
                <option value="stale">{isRTL ? '■ مهمل' : '■ Stale'}</option>
                <option value="never">{isRTL ? '✕ لم يتم التواصل' : '✕ Never'}</option>
              </select>
              <ChevronDown size={10} className="absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted" />
            </div>
          </div>
        );
      })()}

      {/* Status Chips */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { label: isRTL ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB' },
          ...STATUS_DEFS.map(s => ({
            ...s, label: isRTL ? s.label : s.labelEn, count: stats[s.value] || 0,
          })),
        ].map(s => {
          const active = filterStatus === s.value;
          return (
          <button key={s.value} onClick={() => setFilterStatus(s.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
            style={active ? { border: `1px solid ${s.color}`, background: `${s.color}15`, color: s.color } : undefined}>
            {s.label} <span
              className={`rounded-xl px-2 py-px text-[10px] ms-1 ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
              style={active ? { background: s.color, color: '#fff' } : undefined}>{s.count}</span>
          </button>
          );
        })}
        {profile?.role !== 'sales_agent' && (
        <button onClick={() => setShowUnassigned(v => !v)} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${showUnassigned ? 'border border-amber-500 bg-amber-500/[0.08] text-amber-500 font-bold' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'}`}>
          <Users size={11} /> {isRTL ? 'غير معين' : 'Unassigned'} <span className={`rounded-xl px-2 py-px text-[10px] ms-1 ${showUnassigned ? 'bg-amber-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.unassigned || 0}</span>
        </button>
        )}
      </div>

      {/* Stage sub-filter — only when 'Has Opportunity' is the active status filter */}
      {filterStatus === 'has_opportunity' && (() => {
        const stages = getDeptStages(globalFilter?.department && globalFilter.department !== 'all' ? globalFilter.department : 'sales');
        const totalInStages = stages.reduce((s, st) => s + (stageCounts[st.id] || 0), 0);
        return (
          <div className="flex gap-1.5 mb-3 flex-wrap items-center ps-3 border-s-2 border-emerald-500/30 dark:border-emerald-500/40">
            <span className="text-[10px] text-content-muted dark:text-content-muted-dark font-semibold me-1 uppercase tracking-wider">{isRTL ? 'المرحلة:' : 'Stage:'}</span>
            <button onClick={() => setFilterStage('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${filterStage === 'all'
                ? 'bg-emerald-500 text-white border-emerald-500 font-bold'
                : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-emerald-500/40'}`}>
              {isRTL ? 'الكل' : 'All'} <span className={`rounded-xl px-1.5 py-px text-[9px] ms-1 ${filterStage === 'all' ? 'bg-white/25 text-white' : 'bg-edge dark:bg-edge-dark'}`}>{totalInStages}</span>
            </button>
            {stages.map(s => {
              const count = stageCounts[s.id] || 0;
              const active = filterStage === s.id;
              return (
                <button key={s.id} onClick={() => setFilterStage(active ? 'all' : s.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${active ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={active ? { borderColor: s.color, background: s.color + '15', color: s.color } : undefined}>
                  {isRTL ? s.label_ar : s.label_en}
                  <span className={`rounded-xl px-1.5 py-px text-[9px] ms-1 ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                    style={active ? { background: s.color, color: '#fff' } : undefined}>{count}</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Temperature Chips — only when department is selected */}
      <div className="flex gap-2 mb-3.5 flex-wrap items-center">
        <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-medium me-1">{isRTL ? 'الحرارة:' : 'Temp:'}</span>
        {[
          { label: isRTL ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB', Icon: null },
          ...Object.entries(TEMP).map(([k, v]) => ({
            label: isRTL ? v.labelAr : v.label, value: k, count: stats['temp_' + k] || 0, color: v.color, Icon: v.Icon,
          })),
        ].map(s => {
          const active = filterTemp === s.value;
          return (
          <button key={s.value} onClick={() => setFilterTemp(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
            style={active ? { border: `1px solid ${s.color}`, background: `${s.color}15`, color: s.color } : undefined}>
            {s.Icon && <s.Icon size={12} />}
            {s.label} <span
              className={`rounded-xl px-2 py-px text-[10px] ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
              style={active ? { background: s.color, color: '#fff' } : undefined}>{s.count}</span>
          </button>
          );
        })}
      </div>

      {/* Smart Filter Bar */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isRTL ? 'بحث بالاسم، الهاتف، الإيميل، ID...' : 'Search by name, phone, email, ID...'}
        recentSearchesKey="platform_recent_searches_contacts"
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultsCount={totalContacts}
        quickFilters={[
          // 'Today's Follow-ups' / 'Overdue Tasks' moved to the dedicated
          // "المتابعات" chip row above (with live counts) — removed here to
          // avoid showing the same two follow-up filters twice.
          { label: 'بدون فرص', labelEn: 'No Opportunities', filters: [{ field: 'contact_status', operator: 'is', value: '__no_opps' }] },
          ...(profile?.role !== 'sales_agent' ? [{ label: 'لم يتم نقله', labelEn: 'Never Reassigned', filters: [{ field: 'contact_status', operator: 'is', value: '__single_agent' }] }] : []),
        ]}
      />

      {/* Saved Filters */}
      {(savedFilters.length > 0 || smartFilters.length > 0) && (
        <div className="flex gap-2 items-center flex-wrap mt-2 px-1">
          {smartFilters.length > 0 && (
            <button
              onClick={() => setSaveFilterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-brand-500/30 bg-brand-500/[0.06] text-brand-500 cursor-pointer hover:bg-brand-500/[0.12] transition-colors font-medium"
            >
              <Save size={11} />
              {isRTL ? 'حفظ الفلتر' : 'Save Filter'}
            </button>
          )}
          {savedFilters.length > 0 && (
            <>
              <Bookmark size={12} className="text-[#6B8DB5] shrink-0" />
              {savedFilters.map((sf) => {
                const isActive = JSON.stringify(smartFilters) === JSON.stringify(sf.filters) && filterType === sf.filterType && showBlacklisted === sf.showBlacklisted && sortBy === sf.sortBy;
                return (
                  <span
                    key={sf.id}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                      isActive
                        ? 'border-brand-500 bg-brand-500/10 text-brand-500 font-semibold'
                        : 'border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSmartFilters(sf.filters);
                        setFilterType(sf.filterType);
                        setShowBlacklisted(sf.showBlacklisted);
                        setSortBy(sf.sortBy);
                      }}
                      className="bg-transparent border-none p-0 cursor-pointer text-inherit font-inherit text-[11px]"
                    >
                      {sf.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = savedFilters.filter(f => f.id !== sf.id);
                        setSavedFilters(updated);
                        localStorage.setItem('platform_saved_filters_contacts', JSON.stringify(updated));
                      }}
                      className={`bg-transparent border-none p-0 cursor-pointer leading-none ${isActive ? 'text-brand-500 hover:text-red-500' : 'text-content-muted dark:text-content-muted-dark hover:text-red-500'}`}
                    >
                      <XIcon size={10} />
                    </button>
                  </span>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Select All Pages Banner */}
      {selectedIds.length > 0 && selectedIds.length === contacts.length && !allPagesSelected && totalContacts > contacts.length && (
        <div className="bg-brand-500/[0.08] border border-brand-500/20 rounded-xl px-4 py-2.5 mb-2 text-center">
          <span className="text-xs text-content dark:text-content-dark">
            {isRTL ? `تم تحديد ${selectedIds.length} في هذه الصفحة.` : `${selectedIds.length} selected on this page.`}
          </span>{' '}
          <button onClick={selectAllPages} className="text-xs font-bold text-brand-500 bg-transparent border-none cursor-pointer underline">
            {isRTL ? `تحديد كل ${totalContacts} نتيجة` : `Select all ${totalContacts} results`}
          </button>
        </div>
      )}
      {allPagesSelected && (
        <div className="bg-brand-500/[0.08] border border-brand-500/20 rounded-xl px-4 py-2.5 mb-2 text-center">
          <span className="text-xs font-bold text-brand-500">
            {isRTL ? `تم تحديد كل ${selectedIds.length} نتيجة` : `All ${selectedIds.length} results selected`}
          </span>
        </div>
      )}

      {/* List view — table on md+ desktop, cards on mobile.
          Same data + handlers; the card list trades column density for
          thumb-friendly tap targets. */}
      <div style={{ opacity: searching ? 0.5 : 1, transition: 'opacity 0.15s', pointerEvents: searching ? 'none' : 'auto' }}>
      {/* Desktop: table */}
      <div className="hidden md:block">
      <ContactsTable
        loading={loading}
        filtered={filtered}
        paged={paged}
        pinnedIds={pinnedIds}
        selectedIds={selectedIds}
        selectedIdSet={selectedIdSet}
        mergeMode={mergeMode}
        setMergeMode={setMergeMode}
        mergeTargets={mergeTargets}
        setMergeTargets={setMergeTargets}
        MERGE_LIMIT={MERGE_LIMIT}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        quickActionTarget={quickActionTarget}
        setQuickActionTarget={setQuickActionTarget}
        setQuickActionForm={setQuickActionForm}
        setSelected={setSelected}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        togglePin={togglePin}
        MAX_PINS={MAX_PINS}
        setLogCallTarget={setLogCallTarget}
        setReminderTarget={setReminderTarget}
        setDisqualifyModal={setDisqualifyModal}
        setDqReason={setDqReason}
        setDqNote={setDqNote}
        handleDelete={handleDelete}
        setMergePreview={setMergePreview}
        onEdit={(c) => { setSelected(c); setOpenWithAction(false); }}
        perms={perms}
        tdCls={tdCls}
        safePage={page}
        totalPages={Math.max(1, Math.ceil(totalContacts / pageSize))}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={(s) => { setPageSize(s); setPage(1); }}
        totalContacts={totalContacts}
        isRTL={isRTL}
        isSalesAgent={profile?.role === 'sales_agent'}
        isAdmin={profile?.role === 'admin' || profile?.role === 'operations'}
        agentName={profile?.full_name_en || profile?.full_name_ar}
        userMap={userMap}
        hasActiveFilters={hasActiveFilters}
        onClearAllFilters={handleClearAllFilters}
        deptView={deptView}
      />
      </div>
      {/* Mobile: cards */}
      <div className="md:hidden">
      <ContactsCardList
        loading={loading}
        filtered={filtered}
        paged={paged}
        pinnedIds={pinnedIds}
        selectedIdSet={selectedIdSet}
        mergeMode={mergeMode}
        mergeTargets={mergeTargets}
        setMergeTargets={setMergeTargets}
        MERGE_LIMIT={MERGE_LIMIT}
        setSelected={setSelected}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        togglePin={togglePin}
        MAX_PINS={MAX_PINS}
        setLogCallTarget={setLogCallTarget}
        setReminderTarget={setReminderTarget}
        setDisqualifyModal={setDisqualifyModal}
        setDqReason={setDqReason}
        setDqNote={setDqNote}
        handleDelete={handleDelete}
        perms={perms}
        isRTL={isRTL}
        agentName={profile?.full_name_en || profile?.full_name_ar}
        userMap={userMap}
        hasActiveFilters={hasActiveFilters}
        onClearAllFilters={handleClearAllFilters}
        isSalesAgent={profile?.role === 'sales_agent'}
        onRefresh={loadContactsData}
        safePage={page}
        totalPages={Math.max(1, Math.ceil(totalContacts / pageSize))}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={(s) => { setPageSize(s); setPage(1); }}
        totalContacts={totalContacts}
      />
      </div>
      </div>

      {/* Quick Action Popover */}
      <QuickActionPopover
        quickActionTarget={quickActionTarget}
        setQuickActionTarget={setQuickActionTarget}
        quickActionForm={quickActionForm}
        setQuickActionForm={setQuickActionForm}
        QUICK_RESULTS={QUICK_RESULTS}
        handleQuickAction={handleQuickAction}
        savingQuickAction={savingQuickAction}
        isRTL={isRTL}
      />

      {/* Modals */}
      {showAddModal && <AddContactModal profile={profile} campaigns={campaignsList} onCreateCampaign={async (data) => { const created = await createCampaign(data); setCampaignsList(prev => [created, ...prev]); }} onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={async (phone) => {
        // Check the local list first — instant for already-visible duplicates.
        // If we miss, fall back to the DB so we catch dupes that are off-page
        // (the local `contacts` is capped at 1000 by fetchContacts).
        const np = normalizePhone(phone);
        const localHit = contacts.find(c =>
          normalizePhone(c.phone) === np ||
          normalizePhone(c.phone2) === np ||
          (c.extra_phones || []).some(p => normalizePhone(p) === np)
        );
        if (localHit) return localHit;
        try { return await checkDuplicate(phone); } catch { return null; }
      }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} onAddInteraction={(contact, interaction) => {
        const existing = contact.campaign_interactions || [];
        const updatedContact = { ...contact, campaign_interactions: [...existing, interaction] };
        setContacts(prev => {
          const next = prev.map(c => c.id === contact.id ? updatedContact : c);
                    return next;
        });
        updateContact(contact.id, { campaign_interactions: updatedContact.campaign_interactions })
          .catch(err => {
            reportError('ContactsPage', 'update campaign interactions', err);
            toast.error(isRTL ? 'لم يتم حفظ تفاعل الحملة — حاول تاني' : 'Campaign interaction not saved — please retry');
            setContacts(prev => rollbackContact(prev, contact));
          });
      }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => { setSelected(null); setOpenWithAction(false); }} onRequestDisqualify={c => { setDisqualifyModal(c); setDqReason(''); setDqNote(''); }} onUpdate={async (updated) => {
        const old = contacts.find(c => c.id === updated.id);
        const { _skipDbUpdate, ...cleanUpdated } = updated;
        setContacts(prev => prev.map(c => c.id === cleanUpdated.id ? cleanUpdated : c));
        setSelected(cleanUpdated);
        if (!_skipDbUpdate) {
          try {
            await updateContact(cleanUpdated.id, cleanUpdated);
          } catch (err) {
            console.error('[onUpdate] updateContact failed:', err?.message || err);
            toast.error(translateErr(err));
            if (old) {
              setContacts(prev => rollbackContact(prev, old));
              // Drawer's "selected" snapshot is independent of the realtime
              // stream, so prefer the freshest contact from state if it's
              // newer than `old`.
              setSelected(prevSel => {
                if (!prevSel || prevSel.id !== old.id) return prevSel;
                const prevTime = new Date(prevSel.updated_at || 0).getTime();
                const oldTime = new Date(old.updated_at || 0).getTime();
                return prevTime > oldTime ? prevSel : old;
              });
            }
            // Re-throw so awaiting callers (drawer's handleStatusChange /
            // handleTemperatureChange) can skip their side effects — without
            // this, a failed status update was rolled back here while the
            // drawer cheerfully wrote a status_change activity to the
            // timeline + toast'd success. The user's report of "status
            // didn't change but timeline shows it" was this exact path.
            throw err;
          }
        }
        const changedFields = old ? Object.keys(updated).filter(k => JSON.stringify(old[k]) !== JSON.stringify(updated[k]) && !['updated_at'].includes(k)) : [];
        const desc = changedFields.length ? changedFields.map(k => `${k}: "${old?.[k] || ''}" → "${updated[k] || ''}"`).join(', ') : `Updated contact: ${updated.full_name}`;
        logAction({ action: 'update', entity: 'contact', entityId: updated.id, entityName: updated.full_name, description: desc, oldValue: old || null, newValue: updated, userName: profile?.full_name_ar || '' }).catch(() => {});
      }} initialAction={openWithAction} onPrev={handlePrev} onNext={handleNext} onPin={togglePin} isPinned={pinnedIds.includes(selected.id)} onLogCall={c => { setLogCallTarget(c); }} onReminder={c => { setReminderTarget(c); }} onDelete={id => { handleDelete(id); setSelected(null); }} />}
      {logCallTarget && <LogCallModal contact={logCallTarget} onClose={() => setLogCallTarget(null)} onRequestDisqualify={c => { setDisqualifyModal(c); setDqReason('not_interested'); setDqNote(''); setLogCallTarget(null); }} onUpdate={(updated) => {
        const previous = contacts.find(c => c.id === updated.id);
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        updateContact(updated.id, updated).catch(err => {
          reportError('ContactsPage', 'LogCall optimistic update', err);
          toast.error(isRTL ? 'لم يتم حفظ التحديث — حاول تاني' : 'Update not saved — please retry');
          if (previous) setContacts(prev => rollbackContact(prev, previous));
        });
      }} />}
      {reminderTarget && <QuickTaskModal contact={reminderTarget} onClose={() => { setReminderTarget(null); loadContactsData(); }} />}
      {/* Save Filter Modal — replaces the native prompt() that was used before. */}
      {saveFilterModalOpen && (
        <Modal
          open
          onClose={() => { setSaveFilterModalOpen(false); setSaveFilterName(''); }}
          title={isRTL ? 'حفظ الفلتر' : 'Save Filter'}
        >
          <div className="space-y-3">
            <label className="text-sm font-medium text-content dark:text-content-dark block">
              {isRTL ? 'اسم الفلتر' : 'Filter name'}
            </label>
            <Input
              value={saveFilterName}
              onChange={e => setSaveFilterName(e.target.value)}
              placeholder={isRTL ? 'مثال: ليدز ساخنة هذا الأسبوع' : 'e.g. Hot leads this week'}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && saveFilterName.trim()) {
                  const newFilter = { id: Date.now(), name: saveFilterName.trim(), filters: smartFilters, filterType, showBlacklisted, sortBy };
                  const updated = [...savedFilters, newFilter];
                  setSavedFilters(updated);
                  localStorage.setItem('platform_saved_filters_contacts', JSON.stringify(updated));
                  setSaveFilterModalOpen(false);
                  setSaveFilterName('');
                }
              }}
            />
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => { setSaveFilterModalOpen(false); setSaveFilterName(''); }}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              disabled={!saveFilterName.trim()}
              onClick={() => {
                const newFilter = { id: Date.now(), name: saveFilterName.trim(), filters: smartFilters, filterType, showBlacklisted, sortBy };
                const updated = [...savedFilters, newFilter];
                setSavedFilters(updated);
                localStorage.setItem('platform_saved_filters_contacts', JSON.stringify(updated));
                setSaveFilterModalOpen(false);
                setSaveFilterName('');
              }}
            >
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} existingContacts={contacts} onImportDone={async (newContacts) => {
        // Import directly to Supabase using batch insert
        const { batchInsert } = await import('../utils/batchOperations');
        const { stripInternalFields } = await import('../utils/sanitizeForSupabase');
        // Only allow known contacts table columns. assigned_to is included so
        // imports can carry the agent UUID — name-only writes get reverted by
        // the assigned_to/_name sync trigger and orphan rows from RLS.
        const ALLOWED_COLS = new Set(['full_name','prefix','phone','phone2','extra_phones','email','company','job_title','department','source','contact_type','contact_status','notes','gender','nationality','birth_date','preferred_location','interested_in_type','campaign_name','campaign_id','campaign_interactions','temperature','platform','assigned_to','assigned_to_name','assigned_to_names','assigned_by_name','assigned_at','created_by','created_by_name','budget_min','budget_max','lead_score','is_blacklisted','last_activity_at','created_at']);
        // Resolve agent names → UUIDs once, in bulk, BEFORE batch insert.
        // Per-row lookups inside createContact would race + each one is its
        // own RLS-gated round-trip; one call here is the whole list.
        const uniqueAgentNames = [...new Set(newContacts.map(c => c.assigned_to_name?.trim()).filter(Boolean))];
        let agentNameToId = new Map();
        if (uniqueAgentNames.length > 0) {
          try {
            const { data: agentRows } = await import('../lib/supabase').then(m => m.default
              .from('users')
              .select('id, full_name_en, full_name_ar')
              .or(uniqueAgentNames.flatMap(n => [`full_name_en.eq."${n}"`, `full_name_ar.eq."${n}"`]).join(',')));
            (agentRows || []).forEach(u => {
              if (u.full_name_en) agentNameToId.set(u.full_name_en, u.id);
              if (u.full_name_ar) agentNameToId.set(u.full_name_ar, u.id);
            });
          } catch (e) { if (import.meta.env.DEV) console.warn('[Import] agent uuid lookup failed:', e); }
        }
        const myId = profile?.id || null;
        const myName = profile?.full_name_en || profile?.full_name_ar || null;
        const unresolvedAgentNames = new Set();
        const clean = newContacts.map(c => {
          const stripped = stripInternalFields(c);
          const safe = {};
          for (const [k, v] of Object.entries(stripped)) {
            if (!ALLOWED_COLS.has(k)) continue;
            safe[k] = v === '' ? null : v;
          }
          if (safe.id && !safe.id.match(/^[0-9a-f-]{36}$/)) delete safe.id;
          // Don't set last_activity_at on import - only set when actual activity happens
          safe.created_at = safe.created_at || new Date().toISOString();
          // Resolve agent: prefer the name from the row, fall back to caller.
          const agentName = safe.assigned_to_name || myName;
          if (agentName) {
            safe.assigned_to_name = agentName;
            safe.assigned_to_names = [agentName];
            if (!safe.assigned_at) safe.assigned_at = new Date().toISOString();
            // Pair the name with its UUID — without it RLS hides the row from
            // the new owner and the DB trigger resets the name back to whatever
            // assigned_to currently points at.
            if (!safe.assigned_to) {
              const resolved = agentNameToId.get(agentName) || (agentName === myName ? myId : null);
              if (resolved) safe.assigned_to = resolved;
              else unresolvedAgentNames.add(agentName);
            }
          }
          return safe;
        });
        if (unresolvedAgentNames.size > 0) {
          toast.warning(isRTL
            ? `لم يتم العثور على مستخدمين لـ: ${[...unresolvedAgentNames].join('، ')} — هتتورد بدون مالك`
            : `Could not match users for: ${[...unresolvedAgentNames].join(', ')} — rows imported unowned`);
        }
        try {
          console.log('[Import] Sending', clean.length, 'contacts. Sample:', JSON.stringify(clean[0]).slice(0, 200));
          const inserted = await batchInsert('contacts', clean, 20);
          console.log('[Import] Inserted:', inserted.length, 'out of', clean.length);
          // Log import — best-effort, but surface errors to monitoring
          // (silent .then/.catch hid RLS denials on the audit log table).
          supabase.from('import_export_logs').insert([{
            type: 'import', user_id: profile?.id, user_name: profile?.full_name_en || profile?.full_name_ar,
            total_records: clean.length, success_count: inserted.length, failed_count: clean.length - inserted.length,
            entity: 'contacts', status: inserted.length === clean.length ? 'completed' : inserted.length > 0 ? 'partial' : 'failed',
          }])
            .then(({ error }) => { if (error) reportError('ContactsPage', 'importLog', error); })
            .catch(err => reportError('ContactsPage', 'importLog', err));
          if (inserted.length === 0 && clean.length > 0) {
            toast.error(isRTL ? 'فشل الاستيراد — تأكد من البيانات' : 'Import failed — check data');
            console.error('[Import] All inserts failed. First record:', clean[0]);
          } else {
            setContacts(prev => [...inserted, ...prev]);
            toast.success(isRTL ? `تم استيراد ${inserted.length} عميل` : `${inserted.length} leads imported`);
          }
          notifyImportDone({ count: inserted.length, importedBy: profile?.full_name_en || profile?.full_name_ar });
          const byAgent = {};
          inserted.forEach(c => {
            const name = c.assigned_to_name;
            if (name) byAgent[name] = (byAgent[name] || 0) + 1;
          });
          Object.entries(byAgent).forEach(([name, count]) => {
            notifyImportLeadsForAgent({ count, agentName: name, importedBy: profile?.full_name_en || profile?.full_name_ar });
          });
        } catch (err) {
          toast.error(translateErr(err));
        }
        setShowImportModal(false);
      }} />}

      {/* Batch Call Mode */}
      <BatchCallModal
        batchCallMode={batchCallMode}
        setBatchCallMode={setBatchCallMode}
        batchCallIndex={batchCallIndex}
        setBatchCallIndex={setBatchCallIndex}
        batchCallNotes={batchCallNotes}
        setBatchCallNotes={setBatchCallNotes}
        batchCallResult={batchCallResult}
        setBatchCallResult={setBatchCallResult}
        batchCallLog={batchCallLog}
        setBatchCallLog={setBatchCallLog}
        batchTaskOpen={batchTaskOpen}
        setBatchTaskOpen={setBatchTaskOpen}
        batchTaskForm={batchTaskForm}
        setBatchTaskForm={setBatchTaskForm}
        contacts={contacts}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        setContacts={setContacts}
        profile={profile}
        isRTL={isRTL}
      />

      {/* Merge Preview Modal */}
      <MergePreviewModal
        mergePreview={mergePreview}
        setMergePreview={setMergePreview}
        setMergeTargets={setMergeTargets}
        setMergeMode={setMergeMode}
        contacts={contacts}
        setContacts={setContacts}
        setSelectedIds={setSelectedIds}
        isRTL={isRTL}
      />

      {/* Confirm Modal */}
      <ConfirmModal confirmAction={confirmAction} setConfirmAction={setConfirmAction} isRTL={isRTL} />

      {/* Disqualify Modal */}
      <DisqualifyModal
        disqualifyModal={disqualifyModal}
        setDisqualifyModal={setDisqualifyModal}
        dqReason={dqReason}
        setDqReason={setDqReason}
        dqNote={dqNote}
        setDqNote={setDqNote}
        DQ_REASONS={DQ_REASONS}
        contacts={contacts}
        setContacts={setContacts}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        profile={profile}
        isRTL={isRTL}
      />

      {/* Bulk Reassign Modal */}
      <BulkReassignModal
        bulkReassignModal={bulkReassignModal}
        setBulkReassignModal={setBulkReassignModal}
        contacts={contacts}
        selectedIds={selectedIds}
        handleBulkReassign={handleBulkReassign}
        isRTL={isRTL}
        profile={profile}
      />

      {/* Reassign — skipped leads result (why some didn't move + send to another agent) */}
      {reassignSkipped && (
        <Modal open onClose={() => setReassignSkipped(null)} title={isRTL ? 'ليدز ما اتنقلتش' : 'Skipped leads'}>
          <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mb-3">
            {isRTL
              ? `تم نقل ${reassignSkipped.moved}. الليدز دي ما اتنقلتش لـ ${reassignSkipped.agentName}:`
              : `${reassignSkipped.moved} moved. These couldn't go to ${reassignSkipped.agentName}:`}
          </p>
          <div className="max-h-[260px] overflow-y-auto space-y-1.5">
            {reassignSkipped.skipped.map(s => {
              const reasonTxt = s.reason === 'duplicate_new'
                ? (isRTL ? 'السيلز عنده الرقم ده كـ ليد جديد' : 'agent already has this number as a new lead')
                : s.reason === 'already_owned'
                ? (isRTL ? 'موجود عند السيلز بالفعل' : 'already owned by the agent')
                : (isRTL ? 'محظور بقاعدة في النظام' : 'blocked by a system rule');
              return (
                <div key={s.contact_id} className="px-3 py-2 rounded-lg bg-surface-bg dark:bg-surface-bg-dark border border-edge dark:border-edge-dark">
                  <div className="text-xs font-semibold text-content dark:text-content-dark truncate">{s.full_name || s.phone || '—'}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{reasonTxt}</div>
                </div>
              );
            })}
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setReassignSkipped(null)}>{isRTL ? 'تمام' : 'OK'}</Button>
            <Button onClick={() => {
              // Send the skipped leads to a DIFFERENT agent: preselect them and
              // reopen the reassign modal.
              setSelectedIds(reassignSkipped.skipped.map(s => s.contact_id));
              setReassignSkipped(null);
              setBulkReassignModal(true);
            }}>{isRTL ? 'وزّعهم لسيلز تاني' : 'Send to another agent'}</Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Bulk Campaign Modal */}
      <BulkCampaignModal
        bulkCampaignModal={bulkCampaignModal}
        setBulkCampaignModal={setBulkCampaignModal}
        contacts={contacts}
        selectedIds={selectedIds}
        campaignsList={campaignsList}
        handleBulkChangeField={handleBulkChangeField}
        isRTL={isRTL}
      />

      {/* Bulk Distribute Modal — split selected leads across multiple agents */}
      {bulkDistributeOpen && (
        <BulkDistributeModal
          contactIds={selectedIds}
          onClose={() => setBulkDistributeOpen(false)}
          onSuccess={() => { setBulkDistributeOpen(false); setSelectedIds([]); loadContactsData(); loadStats(); }}
        />
      )}

      {/* Bulk Create Opportunities Modal */}
      <BulkOppModal
        bulkOppModal={bulkOppModal}
        setBulkOppModal={setBulkOppModal}
        bulkOppForm={bulkOppForm}
        setBulkOppForm={setBulkOppForm}
        bulkOppSaving={bulkOppSaving}
        setBulkOppSaving={setBulkOppSaving}
        contacts={contacts}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        setContacts={setContacts}
        projectsList={projectsList}
        profile={profile}
        isRTL={isRTL}
        onRefresh={loadContactsData}
      />

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        contacts={contacts}
        isRTL={isRTL}
        bulkDropdownOpen={bulkDropdownOpen}
        setBulkDropdownOpen={setBulkDropdownOpen}
        BULK_TYPE_OPTIONS={BULK_TYPE_OPTIONS}
        BULK_SOURCE_OPTIONS={BULK_SOURCE_OPTIONS}
        BULK_DEPT_OPTIONS={BULK_DEPT_OPTIONS}
        BULK_STATUS_OPTIONS={BULK_STATUS_OPTIONS}
        handleBulkChangeField={handleBulkChangeField}
        setBulkReassignModal={setBulkReassignModal}
        setBulkCampaignModal={setBulkCampaignModal}
        setBulkDistributeOpen={setBulkDistributeOpen}
        setBulkOppModal={setBulkOppModal}
        setBulkOppForm={setBulkOppForm}
        setProjectsList={setProjectsList}
        setBulkSMSModal={setBulkSMSModal}
        setBulkSMSState={setBulkSMSState}
        exportSelectedCSV={exportSelectedCSV}
        setBatchCallMode={setBatchCallMode}
        setBatchCallIndex={setBatchCallIndex}
        setBatchCallLog={setBatchCallLog}
        setBatchCallNotes={setBatchCallNotes}
        setBatchCallResult={setBatchCallResult}
        setMergePreview={setMergePreview}
        handleDeleteSelected={handleDeleteSelected}
        setDisqualifyModal={setDisqualifyModal}
        setDqReason={setDqReason}
        setDqNote={setDqNote}
        MERGE_LIMIT={MERGE_LIMIT}
        perms={perms}
      />

      {/* Bulk SMS Modal */}
      <BulkSMSModal
        bulkSMSModal={bulkSMSModal}
        setBulkSMSModal={setBulkSMSModal}
        bulkSMSState={bulkSMSState}
        setBulkSMSState={setBulkSMSState}
        contacts={contacts}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        handleBulkSMS={handleBulkSMS}
        profile={profile}
        isRTL={isRTL}
      />
    </div>
  </>);
}
