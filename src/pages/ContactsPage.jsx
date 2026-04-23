import { useState, useMemo, useEffect, useRef as useReactRef, useCallback, useReducer } from 'react';
import { useRealtimeSubscription, applyRealtimePayload } from '../hooks/useRealtimeSubscription';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';
import { Plus, Upload, Download, Ban, Bookmark, X as XIcon, Save, Users, ChevronDown, Clock } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact, deleteContact,
  blacklistContact, createActivity, recordAssignment,
  deriveGlobalStatus, deriveGlobalTemp,
} from '../services/contactsService';
import supabase from '../lib/supabase';
import { logAction } from '../services/auditService';
import { bulkSend } from '../services/smsTemplateService';
import { createNotification } from '../services/notificationsService';
import { setFieldValues as setCFValues } from '../services/customFieldsService';
import { fetchCampaigns, createCampaign } from '../services/marketingService';
import { notifyLeadAssigned } from '../services/notificationsService';
import { notifyImportDone, notifyLeadReassigned, notifyImportLeadsForAgent } from '../services/notificationService';
import { evaluateTriggers } from '../services/triggerService';
import { reportError } from '../utils/errorReporter';
import ImportModal from './crm/ImportModal';
import { PageSkeleton, Button, SmartFilter } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useContactsFilters } from '../hooks/useContactsFilters';
import useCrmPermissions from '../hooks/useCrmPermissions';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';


import { SOURCE_LABELS, SOURCE_EN, TYPE, TEMP, MOCK, normalizePhone } from './crm/contacts/constants';
import AddContactModal from './crm/contacts/AddContactModal';
import LogCallModal from './crm/contacts/LogCallModal';
import QuickTaskModal from './crm/contacts/QuickTaskModal';
import BlacklistModal from './crm/contacts/BlacklistModal';
import ContactDrawer from './crm/contacts/ContactDrawer';
import ContactsTable from './crm/contacts/ContactsTable';
import QuickActionPopover from './crm/contacts/QuickActionPopover';
import BatchCallModal from './crm/contacts/BatchCallModal';
import BulkActionToolbar from './crm/contacts/BulkActionToolbar';
import { MergePreviewModal, ConfirmModal, DisqualifyModal, BulkReassignModal, BulkOppModal, BulkSMSModal } from './crm/contacts/BulkModals';
export default function ContactsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const perms = useCrmPermissions();

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [contacts, setContacts] = useState([]);
  const [filterTemp, setFilterTemp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all'); // all, active_3d, moderate_7d, stale, never
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [campaignsList, setCampaignsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [savedFilters, setSavedFilters] = useState(() => JSON.parse(localStorage.getItem('platform_saved_filters_contacts') || '[]'));
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [blacklistTarget, setBlacklistTarget] = useState(null);
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
    import('../services/opportunitiesService').then(({ fetchTeamAgents }) => {
      fetchTeamAgents({ role: profile.role, userId: profile.id, teamId: profile.team_id }).then(data => {
        setAllAgentNames((data || []).map(a => a.full_name_en || a.full_name_ar).filter(Boolean).sort());
      }).catch(() => {});
    });
  }, [profile?.role, profile?.id, profile?.team_id]);
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
    initialShowBlacklisted: searchParams.get('blacklist') === 'true',
    initialSortBy: searchParams.get('sort') || 'created',
    initialPage: Math.max(1, parseInt(searchParams.get('page'), 10) || 1),
    profile,
    allAgentNames,
  });

  // Track whether highlight has been handled
  const highlightHandled = useReactRef(false);

  // Sync filters to URL — skip if highlight is pending (avoid overwriting it)
  useEffect(() => {
    if (highlightId && !highlightHandled.current) return; // don't touch URL while highlight is pending
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filterType !== 'all') params.set('type', filterType);
    if (showBlacklisted) params.set('blacklist', 'true');
    if (sortBy !== 'created') params.set('sort', sortBy);
    if (page > 1) params.set('page', String(page)); // preserve pagination in URL for reload/share
    setSearchParams(params, { replace: true });
  }, [search, filterType, showBlacklisted, sortBy, page, setSearchParams]);

  const { activityResults: configResults, contactsSettings } = useSystemConfig();
  const MERGE_LIMIT = contactsSettings?.mergeLimit || 2;
  const MAX_PINS = contactsSettings?.maxPins || 5;
  const INACTIVE_DAYS = contactsSettings?.inactiveDays || 5;
  const ACTIVITY_ACTIVE_DAYS = contactsSettings?.activityActiveDays || 3;
  const ACTIVITY_MODERATE_DAYS = contactsSettings?.activityModerateDays || 7;
  const saveContactsLocal = () => {}; // OFFLINE_MODE disabled — Supabase is single source of truth

  const deletedContactsRef = useReactRef(null);
  const restoreContacts = useCallback((deletedItems) => {
    setContacts(prev => {
      const next = [...prev, ...deletedItems];
            return next;
    });
    toast.success(isRTL ? 'تم التراجع عن الحذف' : 'Delete undone');
  }, [isRTL]);

  const togglePin = (id) => {
    setPinnedIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        localStorage.setItem('platform_pinned_contacts', JSON.stringify(next));
        return next;
      }
      if (prev.length >= MAX_PINS) return prev;
      const next = [...prev, id];
      localStorage.setItem('platform_pinned_contacts', JSON.stringify(next));
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
        const myName = profile?.full_name_en || profile?.full_name_ar;
        const newAgentStatuses = { ...(contact.agent_statuses || {}), [myName]: newStatus };
        const globalStatus = deriveGlobalStatus(newAgentStatuses);
        const updated = { ...contact, agent_statuses: newAgentStatuses, contact_status: globalStatus };
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        updateContact(updated.id, { agent_statuses: newAgentStatuses, contact_status: globalStatus }).catch(err => { if (import.meta.env.DEV) console.warn('optimistic status update:', err); });
      }
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch (err) {
      reportError('ContactsPage', 'handleQuickAction.saveActivity', err);
      toast.success(isRTL ? 'تم حفظ النشاط محلياً' : 'Activity saved locally');
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
    if (profile?.role !== 'admin') {
      toast.error(isRTL ? 'الحذف متاح للأدمن فقط' : 'Only admin can delete contacts');
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
          toast.success(isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully');
        } catch (err) {
          toast.error(isRTL ? 'فشل الحذف: ' + (err?.message || '') : 'Delete failed: ' + (err?.message || ''));
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

  const handleBulkReassign = async (agentName, bulkStatus, bulkTemp) => {
    const assignedByName = profile?.full_name_ar || '—';
    const names = contacts.filter(c => selectedIds.includes(c.id)).map(c => c.full_name).join(', ');
    const idsToUpdate = [...selectedIds];
    const extraUpdates = {};
    if (bulkStatus) extraUpdates.contact_status = bulkStatus; // bulk reassign sets global (admin/ops action)
    if (bulkTemp) extraUpdates.temperature = bulkTemp; // bulk reassign sets global (admin/ops action)
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, assigned_to_name: agentName, assigned_to_names: [agentName], assigned_by_name: assignedByName, ...extraUpdates } : c);
    setContacts(updated);
        logAction({ action: 'bulk_reassign', entity: 'contact', entityId: selectedIds.join(','), description: `Reassigned ${selectedIds.length} contacts to ${agentName}: ${names}`, newValue: agentName, userName: profile?.full_name_ar });
    // Record assignment history for each contact
    const reassignedContacts = contacts.filter(c => selectedIds.includes(c.id));
    reassignedContacts.forEach(c => {
      recordAssignment(c.id, { fromAgent: c.assigned_to_name, toAgent: agentName, assignedBy: assignedByName });
    });
    // Single notification for bulk assign (not one per lead)
    if (reassignedContacts.length === 1) {
      notifyLeadReassigned({ contactName: reassignedContacts[0].full_name || reassignedContacts[0].phone || '—', contactId: reassignedContacts[0].id, newAgentName: agentName, assignedBy: assignedByName });
    } else if (reassignedContacts.length > 1) {
      notifyLeadAssigned({ contactName: `${reassignedContacts.length} ليد جديد`, contactId: null, agentId: agentName, agentName, assignedBy: assignedByName });
    }
    // Opportunities reassignment is handled via Supabase in updateContact
    toast.success(isRTL ? `تم إعادة تعيين ${selectedIds.length} عميل` : `${selectedIds.length} leads reassigned`);
    setSelectedIds([]);
    setBulkReassignModal(false);
    setShowBulkMenu(false);
    try {
      // updateContact already retries internally — service-level retry is the single source of truth
      const results = await Promise.allSettled(
        idsToUpdate.map(id => updateContact(id, { assigned_to_name: agentName, assigned_to_names: [agentName], assigned_by_name: assignedByName, ...extraUpdates }))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast.error(isRTL ? `فشل تحديث ${failed} عميل` : `Failed to update ${failed} contacts`);
    } catch (err) { toast.error(isRTL ? 'فشل إعادة التعيين' : 'Reassign failed'); console.error('bulk reassign:', err); }
  };

  const handleBulkAddAgent = async (agentName, agentStatus = 'new', agentTemp = 'hot') => {
    const idsToUpdate = [...selectedIds];
    // Split selected contacts into { toAdd } (new assignment) and { alreadyHad } (no-op)
    // so the toast, notifications, and audit log reflect the real effect.
    const selected = contacts.filter(c => selectedIds.includes(c.id));
    const toAdd = selected.filter(c => !(c.assigned_to_names || []).includes(agentName));
    const alreadyHad = selected.filter(c => (c.assigned_to_names || []).includes(agentName));

    const updated = contacts.map(c => {
      if (!selectedIds.includes(c.id)) return c;
      const names = c.assigned_to_names || [];
      if (names.includes(agentName)) return c;
      const newStatuses = { ...(c.agent_statuses || {}), [agentName]: agentStatus };
      const newTemps = { ...(c.agent_temperatures || {}), [agentName]: agentTemp };
      return { ...c, assigned_to_names: [...names, agentName], agent_statuses: newStatuses, agent_temperatures: newTemps };
    });
    setContacts(updated);

    // Honest toast: show the real number added; mention the ones already assigned.
    if (toAdd.length === 0) {
      toast.info(isRTL
        ? `${agentName} موجود بالفعل عند كل العملاء الـ ${selectedIds.length} المختارين — ما تم تعديل شيء`
        : `${agentName} is already assigned to all ${selectedIds.length} selected leads — nothing changed`);
    } else if (alreadyHad.length > 0) {
      toast.success(isRTL
        ? `تم إضافة ${agentName} لـ ${toAdd.length} عميل (${alreadyHad.length} كانوا عنده بالفعل)`
        : `Added ${agentName} to ${toAdd.length} leads (${alreadyHad.length} already had them)`);
    } else {
      toast.success(isRTL ? `تم إضافة ${agentName} لـ ${toAdd.length} عميل` : `Added ${agentName} to ${toAdd.length} leads`);
    }

    // Notify only if something actually changed
    if (toAdd.length === 1) {
      notifyLeadAssigned({ contactName: toAdd[0].full_name || '—', contactId: toAdd[0].id, agentId: agentName, agentName, assignedBy: profile?.full_name_ar || '—' });
    } else if (toAdd.length > 1) {
      notifyLeadAssigned({ contactName: `${toAdd.length} ليد جديد`, contactId: null, agentId: agentName, agentName, assignedBy: profile?.full_name_ar || '—' });
    }

    // Audit log — so "who added whom to whose list and when" is traceable.
    if (toAdd.length > 0) {
      const names = toAdd.map(c => c.full_name).filter(Boolean).join(', ');
      logAction({
        action: 'bulk_add_agent',
        entity: 'contact',
        entityId: toAdd.map(c => c.id).join(','),
        description: `Added ${agentName} to ${toAdd.length} contacts: ${names}`,
        newValue: agentName,
        userName: profile?.full_name_ar || profile?.full_name_en || '',
      });
    }

    setSelectedIds([]);
    // Perform the actual updates only on the ones that need them
    const toAddIds = toAdd.map(c => c.id);
    const results = await Promise.allSettled(toAddIds.map(id => {
      const c = contacts.find(ct => ct.id === id);
      const names = c?.assigned_to_names || [];
      const newStatuses = { ...(c?.agent_statuses || {}), [agentName]: agentStatus };
      const newTemps = { ...(c?.agent_temperatures || {}), [agentName]: agentTemp };
      return updateContact(id, { assigned_to_names: [...names, agentName], agent_statuses: newStatuses, agent_temperatures: newTemps });
    }));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      failed.forEach(r => reportError('ContactsPage', 'bulkAddAgent', r.reason));
      toast.error(isRTL ? `فشل تحديث ${failed.length} عميل` : `Failed to update ${failed.length} leads`);
    }
  };

  const handleBulkRemoveAgent = async (agentName) => {
    // Split selected: { toRemove } (actually has the agent and not the last one),
    // { notAssigned } (doesn't have them — no-op), { onlyAgent } (has them as
    // the single assignee — we refuse to leave the contact unassigned).
    const selected = contacts.filter(c => selectedIds.includes(c.id));
    const toRemove = selected.filter(c => {
      const names = c.assigned_to_names || [];
      return names.includes(agentName) && names.filter(n => n !== agentName).length > 0;
    });
    const notAssigned = selected.filter(c => !(c.assigned_to_names || []).includes(agentName));
    const onlyAgent = selected.filter(c => {
      const names = c.assigned_to_names || [];
      return names.includes(agentName) && names.filter(n => n !== agentName).length === 0;
    });

    const updated = contacts.map(c => {
      if (!selectedIds.includes(c.id)) return c;
      const names = (c.assigned_to_names || []).filter(n => n !== agentName);
      if (names.length === 0) return c; // don't remove last agent
      const newStatuses = { ...(c.agent_statuses || {}) }; delete newStatuses[agentName];
      const newTemps = { ...(c.agent_temperatures || {}) }; delete newTemps[agentName];
      const newScores = { ...(c.agent_scores || {}) }; delete newScores[agentName];
      return { ...c, assigned_to_names: names, assigned_to_name: names[0], agent_statuses: newStatuses, agent_temperatures: newTemps, agent_scores: newScores };
    });
    setContacts(updated);

    // Honest toast
    if (toRemove.length === 0 && notAssigned.length === selected.length) {
      toast.info(isRTL
        ? `${agentName} مش موجود عند أي من العملاء الـ ${selected.length} المختارين`
        : `${agentName} is not assigned to any of the ${selected.length} selected leads`);
    } else if (toRemove.length === 0 && onlyAgent.length > 0) {
      toast.warning(isRTL
        ? `${agentName} هو المسؤول الوحيد عند ${onlyAgent.length} عميل — لن يتم شيله لتجنب تركهم بدون مسؤول`
        : `${agentName} is the only assignee for ${onlyAgent.length} leads — skipped to avoid leaving them unassigned`);
    } else {
      const extras = [];
      if (notAssigned.length > 0) extras.push(isRTL ? `${notAssigned.length} غير موجود عندهم` : `${notAssigned.length} didn't have them`);
      if (onlyAgent.length > 0) extras.push(isRTL ? `${onlyAgent.length} كان المسؤول الوحيد` : `${onlyAgent.length} was sole assignee`);
      const suffix = extras.length ? ` (${extras.join(' · ')})` : '';
      toast.success(isRTL
        ? `تم شيل ${agentName} من ${toRemove.length} عميل${suffix}`
        : `Removed ${agentName} from ${toRemove.length} leads${suffix}`);
    }

    // Audit log
    if (toRemove.length > 0) {
      const names = toRemove.map(c => c.full_name).filter(Boolean).join(', ');
      logAction({
        action: 'bulk_remove_agent',
        entity: 'contact',
        entityId: toRemove.map(c => c.id).join(','),
        description: `Removed ${agentName} from ${toRemove.length} contacts: ${names}`,
        oldValue: agentName,
        userName: profile?.full_name_ar || profile?.full_name_en || '',
      });
    }

    setSelectedIds([]);
    const toRemoveIds = toRemove.map(c => c.id);
    const results = await Promise.allSettled(toRemoveIds.map(id => {
      const c = contacts.find(ct => ct.id === id);
      const names = (c?.assigned_to_names || []).filter(n => n !== agentName);
      const newStatuses = { ...(c?.agent_statuses || {}) }; delete newStatuses[agentName];
      const newTemps = { ...(c?.agent_temperatures || {}) }; delete newTemps[agentName];
      const newScores = { ...(c?.agent_scores || {}) }; delete newScores[agentName];
      return updateContact(id, { assigned_to_names: names, assigned_to_name: names[0], agent_statuses: newStatuses, agent_temperatures: newTemps, agent_scores: newScores });
    }));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      failed.forEach(r => reportError('ContactsPage', 'bulkRemoveAgent', r.reason));
      toast.error(isRTL ? `فشل تحديث ${failed.length} عميل` : `Failed to update ${failed.length} leads`);
    }
  };

  const handleBulkChangeField = async (field, value, actionLabel) => {
    const count = selectedIds.length;
    const names = contacts.filter(c => selectedIds.includes(c.id)).map(c => c.full_name).join(', ');
    const idsToUpdate = [...selectedIds];
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, [field]: value } : c);
    setContacts(updated);
        logAction({ action: `bulk_${field}_change`, entity: 'contact', entityId: selectedIds.join(','), description: `Bulk changed ${field} to "${value}" for ${count} contacts: ${names}`, newValue: value, userName: profile?.full_name_ar });
    createNotification({ type: 'system', title_en: `Bulk ${actionLabel}`, title_ar: `تغيير جماعي — ${actionLabel}`, body_en: `Changed ${field} to "${value}" for ${count} leads`, body_ar: `تم تغيير ${field} إلى "${value}" لـ ${count} عميل`, for_user_id: 'all' });
    toast.success(isRTL ? `تم تحديث ${count} عميل` : `${count} leads updated`);
    setSelectedIds([]);
    setBulkDropdownOpen(null);
    setShowBulkMenu(false);
    const results = await Promise.allSettled(idsToUpdate.map(id => updateContact(id, { [field]: value })));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      failed.forEach(r => reportError('ContactsPage', `bulkChange_${field}`, r.reason));
      toast.error(isRTL ? `فشل تحديث ${failed.length} عميل` : `Failed to update ${failed.length} leads`);
    }
  };

  const handleBulkSMS = async () => {
    const { templateId, lang } = bulkSMSState;
    if (!templateId) return;
    const smsContacts = contacts.filter(c => selectedIds.includes(c.id) && c.phone);
    setBulkSMSState(s => ({ ...s, sending: true, total: smsContacts.length, progress: 0 }));
    const results = await bulkSend(templateId, smsContacts, lang);
    const resultsList = Array.isArray(results) ? results : [];
    setBulkSMSState(s => ({ ...s, sending: false, progress: smsContacts.length, done: true, results: resultsList }));
    logAction({ action: 'bulk_sms', entity: 'contact', entityId: selectedIds.join(','), description: `Bulk SMS sent to ${resultsList.length} contacts`, userName: profile?.full_name_ar });
    createNotification({ type: 'system', title_en: 'Bulk SMS Sent', title_ar: 'تم إرسال رسائل جماعية', body_en: `Sent SMS to ${resultsList.length} leads`, body_ar: `تم إرسال رسائل لـ ${resultsList.length} عميل`, for_user_id: 'all' });
    toast.success(isRTL ? `تم إرسال ${resultsList.length} رسالة` : `${resultsList.length} messages sent`);
  };

  const exportSelectedCSV = () => {
    const list = contacts.filter(c => selectedIds.includes(c.id));
    exportCSVList(list);
    logAction({ action: 'export', entity: 'contact', description: `Exported ${list.length} selected contacts`, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    toast.success(isRTL ? `تم تصدير ${list.length} عميل` : `${list.length} leads exported`);
    setBulkDropdownOpen(null);
    setShowBulkMenu(false);
  };

  const exportCSVList = (list) => {
    const headers = isRTL ? ['ID','الاسم','الهاتف','الإيميل','النوع','المصدر','القسم','المنصة','الشركة','تاريخ الإنشاء'] : ['ID','Name','Phone','Email','Type','Source','Department','Platform','Company','Created'];
    const rows = list.map(c => [c.id, c.full_name, c.phone, c.email || '', c.contact_type, c.source || '', c.department || '', c.platform || '', c.company || '', c.created_at || '']);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    // Log export
    supabase.from('import_export_logs').insert([{
      type: 'export', user_id: profile?.id, user_name: profile?.full_name_en || profile?.full_name_ar,
      total_records: list.length, success_count: list.length, entity: 'contacts', status: 'completed',
      file_name: `contacts_${new Date().toISOString().slice(0,10)}.csv`,
    }]).then(() => {}).catch(() => {});
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
  const [showOverdueTasks, setShowOverdueTasks] = useState(false);
  const [overdueContactIds, setOverdueContactIds] = useState(null);
  const [showTodayFollowups, setShowTodayFollowups] = useState(false);
  const [todayFollowupIds, setTodayFollowupIds] = useState(null);
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
        let q = supabase.from('tasks')
          .select('contact_id')
          .eq('status', 'pending')
          .lt('due_date', new Date().toISOString())
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

  // Fetch contacts with MULTIPLE agents (to exclude → show single agent only)
  useEffect(() => {
    if (!showSingleAgent) { setSingleAgentIds(null); return; }
    (async () => {
      try {
        // Get contacts with 2+ agents → exclude them to show single-agent contacts
        const { data } = await supabase.from('contacts').select('id, assigned_to_names').not('assigned_to_names', 'is', null).range(0, 20000);
        const multiAgentIds = (data || []).filter(c => Array.isArray(c.assigned_to_names) && c.assigned_to_names.length > 1).map(c => c.id);
        setSingleAgentIds(multiAgentIds.length ? multiAgentIds : ['none']);
      } catch { setSingleAgentIds([]); }
    })();
  }, [showSingleAgent]);

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
      const isNoOpps = smartFilters.some(f => f.value === '__no_opps');
      const isSingleAgent = smartFilters.some(f => f.value === '__single_agent');
      if (isTodayFollowup && !showTodayFollowups) setShowTodayFollowups(true);
      if (isOverdueTasks && !showOverdueTasks) setShowOverdueTasks(true);
      if (isNoOpps && !showNoOpps) setShowNoOpps(true);
      if (isSingleAgent && !showSingleAgent) setShowSingleAgent(true);
      if (!isTodayFollowup && showTodayFollowups) { setShowTodayFollowups(false); setTodayFollowupIds(null); }
      if (!isOverdueTasks && showOverdueTasks) { setShowOverdueTasks(false); setOverdueContactIds(null); }
      if (!isNoOpps && showNoOpps) { setShowNoOpps(false); setNoOppsIds(null); }
      if (!isSingleAgent && showSingleAgent) { setShowSingleAgent(false); setSingleAgentIds(null); }

      // Extract server-side filters from smartFilters (skip special ones)
      const statusFilter = smartFilters.find(f => f.field === 'contact_status' && (f.operator === 'is' || f.operator === 'is_not') && !f.value?.startsWith('__'));
      const agentSmartFilter = smartFilters.find(f => f.field === 'assigned_to_name' && (f.operator === 'is' || f.operator === 'is_not'));
      const sourceSmartFilter = smartFilters.find(f => f.field === 'source' && (f.operator === 'is' || f.operator === 'is_not'));
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
          temperature: filterTemp !== 'all' ? filterTemp : undefined,
          agentNameForTemp: filterTemp !== 'all' ? (
            (globalFilter?.agentName && globalFilter.agentName !== 'all')
              ? globalFilter.agentName
              : (profile?.role !== 'admin' && profile?.role !== 'operations')
                ? (profile?.full_name_en || profile?.full_name_ar)
                : undefined
          ) : undefined,
          showBlacklisted: showBlacklisted || undefined,
          unassigned: showUnassigned || undefined,
          department: deptSmartFilter?.value || ((globalFilter?.department && globalFilter.department !== 'all') ? globalFilter.department : undefined),
          assigned_to_name: agentSmartFilter?.value || ((globalFilter?.agentName && globalFilter.agentName !== 'all') ? globalFilter.agentName : undefined),
          assigned_to_name_not: agentSmartFilter?.operator === 'is_not' ? true : undefined,
          source: sourceSmartFilter?.value || undefined,
          source_not: sourceSmartFilter?.operator === 'is_not' ? true : undefined,
          // Server-side smart filters
          smartName: nameFilter?.value || undefined,
          smartEmail: emailFilter?.value || undefined,
          smartPhone: phoneFilter?.value || undefined,
          smartCreatedAt: createdFilter ? { operator: createdFilter.operator, value: createdFilter.value } : undefined,
          smartCampaign: campaignFilter?.value || undefined,
          contactIds: overdueContactIds || todayFollowupIds || undefined,
          excludeContactIds: showNoOpps ? noOppsIds : showSingleAgent ? singleAgentIds : undefined,
          contact_status: statusFilter?.value || (filterStatus !== 'all' ? filterStatus : undefined),
          contact_status_not: statusFilter?.operator === 'is_not' ? true : undefined,
          agentNameForStatus: (statusFilter?.value || filterStatus !== 'all') ? (
            // If Global Filter has a specific agent, use that agent's name
            (globalFilter?.agentName && globalFilter.agentName !== 'all')
              ? globalFilter.agentName
              // Non-admin users always use their own name for per-agent filtering
              : (profile?.role !== 'admin' && profile?.role !== 'operations')
                ? (profile?.full_name_en || profile?.full_name_ar)
                // Admin without Global Filter: use global contact_status
                : undefined
          ) : undefined,
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

      // Background: auto-mark inactive + fetch feedback (non-blocking)
      if (list.length) {
        // Auto-inactive (fire and forget) — only update contact_status, preserve agent_statuses
        const now = Date.now();
        const inactiveThreshold = INACTIVE_DAYS * 86400000;
        list.forEach(c => {
          if (c.contact_status === 'following' && c.last_activity_at && (now - new Date(c.last_activity_at).getTime()) > inactiveThreshold) {
            // Check if any agent has a non-contacted status — if so, skip auto-contacted
            const agentStatuses = c.agent_statuses || {};
            const hasActiveAgent = Object.values(agentStatuses).some(s => s === 'following' || s === 'has_opportunity');
            if (hasActiveAgent) return;
            c.contact_status = 'contacted';
            updateContact(c.id, { contact_status: 'contacted' }).catch(err => { if (import.meta.env.DEV) console.warn('auto-contacted:', err); });
          }
        });

        // Fetch last feedback (non-blocking)
        const ids = list.map(c => c.id).filter(Boolean);
        // Show ALL feedback on assigned contacts (if agent can see the contact, they see all its history)
        let feedbackQuery = supabase.from('activities').select('contact_id, notes, description, user_name_ar, user_name_en, created_at')
          .in('contact_id', ids)
          .or('notes.neq.,description.neq.')
          .order('created_at', { ascending: false }).range(0, 199);
        feedbackQuery.then(({ data: acts }) => {
            if (acts?.length) {
              const lastByContact = {};
              acts.forEach(a => {
                if (a.contact_id && !lastByContact[a.contact_id]) {
                  // Use notes or description, whichever is populated
                  a._feedback = a.notes || a.description || null;
                  if (a._feedback) lastByContact[a.contact_id] = a;
                }
              });
              setContacts(prev => prev.map(c => ({ ...c, _lastNote: lastByContact[c.id] || null })));
            }
          }).catch(err => { if (import.meta.env.DEV) console.warn('fetch last feedback:', err); });

        // Fetch opportunity counts per contact (non-blocking)
        supabase.from('opportunities').select('contact_id')
          .in('contact_id', ids)
          .then(({ data: opps }) => {
            if (opps?.length) {
              const countByContact = {};
              opps.forEach(o => { if (o.contact_id) countByContact[o.contact_id] = (countByContact[o.contact_id] || 0) + 1; });
              setContacts(prev => prev.map(c => ({ ...c, _opp_count: countByContact[c.id] || 0 })));
            }
          }).catch(err => { if (import.meta.env.DEV) console.warn('fetch opp counts:', err); });
      }
    } catch (err) {
      reportError('ContactsPage', 'loadContactsData', err);
      setContacts([]);
    } finally {
      setLoading(false);
      setSearching(false);
      hasLoadedOnce.current = true;
    }
  }, [profile?.role, profile?.id, profile?.team_id, page, pageSize, search, filterType, filterTemp, filterStatus, filterActivity, dateFrom, dateTo, showBlacklisted, showUnassigned, globalFilter?.department, globalFilter?.agentName, smartFilters, sortBy, overdueContactIds, todayFollowupIds, noOppsIds, singleAgentIds]);

  useEffect(() => {
    if (profile) loadContactsData();
    else { setContacts(MOCK); setLoading(false); }
    fetchCampaigns().then(c => setCampaignsList(c)).catch(err => { if (import.meta.env.DEV) console.warn('fetch campaigns:', err); });
  }, [profile, loadContactsData]);

  // Realtime: auto-refresh contacts when any row changes in Supabase
  useRealtimeSubscription('contacts', useCallback((payload) => {
    if (payload?.eventType) {
      const newRec = payload.new;
      const names = newRec?.assigned_to_names || [];
      // Skip contacts not relevant to this user's role
      if (profile?.role === 'sales_agent') {
        const myName = profile?.full_name_en || profile?.full_name_ar;
        if (myName && !names.includes(myName)) return;
      } else if (profile?.role === 'team_leader' || profile?.role === 'sales_manager') {
        // For TL/Manager: only accept if contact is already in our list (existing) or skip INSERT from other teams
        if (payload.eventType === 'INSERT') {
          // Don't auto-add new contacts from realtime — let the next page load pick them up
          return;
        }
      }
      setContacts(prev => applyRealtimePayload(prev, payload));
    } else if (profile) {
      loadContactsData();
    }
  }, [profile, loadContactsData]));

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

  // Stats — fetched from Supabase (real counts across all contacts)
  const STATUS_DEFS = [
    { value: 'new', label: 'جديد', labelEn: 'New', color: '#4A7AAB' },
    { value: 'contacted', label: 'تم التواصل', labelEn: 'Contacted', color: '#F59E0B' },
    { value: 'following', label: 'متابعة', labelEn: 'Following', color: '#10B981' },
    { value: 'has_opportunity', label: 'لديه فرصة', labelEn: 'Has Opportunity', color: '#059669' },
    { value: 'disqualified', label: 'غير مؤهل', labelEn: 'Disqualified', color: '#6b7280' },
  ];
  const [stats, setStats] = useState({ total: 0, blacklisted: 0, hot: 0, warm: 0, cool: 0, cold: 0 });
  const loadStats = useCallback(async () => {
    try {
      const deptFilter = (globalFilter?.department && globalFilter.department !== 'all') ? globalFilter.department : null;
      const agentFilter = (globalFilter?.agentName && globalFilter.agentName !== 'all') ? globalFilter.agentName : null;

      // Base query builder — respects role-based filtering
      let teamNames = null;
      if ((profile?.role === 'team_leader' || profile?.role === 'sales_manager') && profile?.team_id) {
        try {
          const teamIds = [profile.team_id];
          if (profile.role === 'sales_manager') {
            const { data: children } = await supabase.from('departments').select('id').eq('parent_id', profile.team_id);
            if (children) teamIds.push(...children.map(c => c.id));
          }
          const { data: members } = await supabase.from('users').select('full_name_en').in('team_id', teamIds);
          teamNames = (members || []).map(m => m.full_name_en).filter(Boolean);
        } catch (err) { if (import.meta.env.DEV) console.warn('stats team names:', err); }
      }

      const baseQ = () => {
        let q = supabase.from('contacts').select('id', { count: 'exact', head: true });
        if (deptFilter) q = q.eq('department', deptFilter);
        if (agentFilter) q = q.filter('assigned_to_names', 'cs', JSON.stringify([agentFilter]));
        if (profile?.role === 'sales_agent') {
          const myName = profile?.full_name_en || profile?.full_name_ar;
          if (myName) q = q.filter('assigned_to_names', 'cs', JSON.stringify([myName]));
        } else if (teamNames && teamNames.length && !agentFilter) {
          const orConds = teamNames.map(n => `assigned_to_names.cs.["${n}"]`).join(',');
          q = q.or(orConds);
        }
        return q;
      };

      // ALL count queries in ONE parallel batch
      const statusKeys = STATUS_DEFS.map(s => s.value);
      const tempKeys = ['hot', 'warm', 'cool', 'cold'];
      const typeKeys = Object.keys(TYPE);

      const allQueries = [
        baseQ(), // total
        baseQ().eq('is_blacklisted', true), // blacklisted
        baseQ().or('assigned_to_name.is.null,assigned_to_name.eq.,assigned_to_names.eq.[]'), // unassigned (respects role filter)
        ...statusKeys.map(s => baseQ().eq('contact_status', s)),
        ...tempKeys.map(t => baseQ().eq('temperature', t)),
        ...typeKeys.map(t => baseQ().eq('contact_type', t)),
      ];

      const results = await Promise.all(allQueries);

      let i = 0;
      const counts = {
        total: results[i++].count || 0,
        blacklisted: results[i++].count || 0,
        unassigned: results[i++].count || 0,
      };
      statusKeys.forEach(s => { counts[s] = results[i++].count || 0; });
      tempKeys.forEach(t => { counts['temp_' + t] = results[i++].count || 0; });
      typeKeys.forEach(t => { counts['type_' + t] = results[i++].count || 0; });

      setStats(counts);
    } catch (err) { reportError('ContactsPage', 'loadStats', err); }
  }, [profile?.role, profile?.id, profile?.full_name_en, profile?.full_name_ar, globalFilter?.department, globalFilter?.agentName]);

  useEffect(() => { if (profile) loadStats(); }, [profile, loadStats]);

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
    try {
      // Fetch all matching contact IDs from server (not just current page)
      let query = supabase.from('contacts').select('id');
      // Apply same filters as loadContactsData
      if (profile?.role === 'sales_agent') {
        const myName = profile?.full_name_en || profile?.full_name_ar;
        if (myName) query = query.filter('assigned_to_names', 'cs', JSON.stringify([myName]));
      }
      if (search) { const s = search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, ''); if (s.length > 0) query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`); }
      if (filterType !== 'all') query = query.eq('contact_type', filterType);
      if (filterTemp !== 'all') query = query.eq('temperature', filterTemp);
      if (filterStatus !== 'all') query = query.eq('contact_status', filterStatus);
      if (showBlacklisted) query = query.eq('is_blacklisted', true);
      else query = query.eq('is_blacklisted', false);
      if (showUnassigned) query = query.or('assigned_to_name.is.null,assigned_to_name.eq.');
      const deptFilter = globalFilter?.department && globalFilter.department !== 'all' ? globalFilter.department : null;
      if (deptFilter) query = query.eq('department', deptFilter);
      const agentFilter = globalFilter?.agentName && globalFilter.agentName !== 'all' ? globalFilter.agentName : null;
      if (agentFilter) query = query.filter('assigned_to_names', 'cs', JSON.stringify([agentFilter]));
      const { data } = await query.range(0, 9999);
      if (data?.length) {
        setSelectedIds(data.map(c => c.id));
        setAllPagesSelected(true);
      }
    } catch (err) {
      reportError('ContactsPage', 'handleSelectAllPages', err);
      // Fallback to current page
      setSelectedIds(contacts.map(c => c.id));
      setAllPagesSelected(true);
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
    const newContact = {
      ...form,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lead_score: 0,
      temperature: 'hot',
      contact_status: 'new',
      is_blacklisted: false,
      assigned_to_name: myName,
      assigned_to_names: [myName].filter(n => n !== '—'),
      assigned_by_name: profile?.full_name_ar || '—',
      created_by: profile?.id || null,
      created_by_name: profile?.full_name_ar || profile?.full_name_en || '—',
      agent_statuses: { [myName]: 'new' },
      agent_temperatures: { [myName]: form.temperature || 'hot' },
      agent_scores: { [myName]: 0 },
      campaign_interactions,
      created_at: new Date().toISOString(),
      last_activity_at: null,
    };
    const cfValues = form._customFieldValues;
    const { _customFieldValues, ...cleanForm } = form;
    try {
      const assigneeName = cleanForm.assigned_to_name || profile?.full_name_en || profile?.full_name_ar || null;
      const assigneeNames = cleanForm.assigned_to_names || [assigneeName].filter(Boolean);
      const saved = await createContact({
        ...cleanForm,
        campaign_interactions,
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
      // Notify assigned agent about new lead
      const assignedName = profile?.full_name_en || profile?.full_name_ar;
      if (assignedName) {
        notifyLeadAssigned({ contactName: cleanForm.full_name || cleanForm.phone || '—', contactId: saved.id, agentId: assignedName, agentName: assignedName, assignedBy: profile?.full_name_ar || '—' });
      }
    } catch (err) {
      console.error('[handleSave] Failed to create contact:', err?.message || err);
      toast.error(isRTL ? 'فشل حفظ العميل: ' + (err?.message || 'خطأ غير معروف') : 'Failed to save lead: ' + (err?.message || 'Unknown error'));
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'n', action: () => setShowAddModal(true) },
    { key: 'e', action: () => { if (selected) setSelected(prev => prev ? { ...prev, _triggerEdit: true } : prev); } },
    { key: '/', action: () => { const el = document.querySelector('[data-search-input]'); if (el) el.focus(); } },
  ]);

  const handleBlacklist = async (contact, reason) => {
    setContacts(prev => {
      const next = prev.map(c => c.id === contact.id ? { ...c, is_blacklisted: true, blacklist_reason: reason } : c);
            return next;
    });
    if (selected?.id === contact.id) setSelected(null);
    blacklistContact(contact.id, reason).catch(err => { if (import.meta.env.DEV) console.warn('blacklist contact:', err); });
    logAction({ action: 'blacklist', entity: 'contact', entityId: contact.id, entityName: contact.full_name, description: `Blacklisted: ${contact.full_name} — ${reason}`, newValue: reason, userName: profile?.full_name_ar });
    toast.success(isRTL ? 'تم إضافة للقائمة السوداء' : 'Lead blacklisted');
  };

  const tdCls = `px-4 py-3.5 border-b border-edge/50 dark:border-edge-dark/50 align-middle text-xs text-content dark:text-content-dark text-start`;

  if (loading) return <PageSkeleton hasKpis={false} tableRows={8} tableCols={7} />;

  return (<>
    {actionLoading && (
      <div className="fixed top-0 left-0 right-0 z-[2000] h-1 bg-brand-500/20 overflow-hidden">
        <div className="h-full bg-brand-500" style={{ width: '30%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
      </div>
    )}
    <div dir={isRTL ? 'rtl' : 'ltr'} className="font-['Cairo','Tajawal',sans-serif] text-content dark:text-content-dark px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
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
            <button onClick={() => setShowImportModal(true)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
              <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
            </button>
          )}
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> {isRTL ? 'إضافة عميل' : 'Add Lead'}
          </Button>
        </div>
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
                <option value="all">{isRTL ? 'كل النشاط' : 'All Activity'}</option>
                <option value="active_3d">{isRTL ? `🟢 نشط (${ACTIVITY_ACTIVE_DAYS} أيام)` : `🟢 Active (${ACTIVITY_ACTIVE_DAYS}d)`}</option>
                <option value="moderate_7d">{isRTL ? `🟡 متوسط (${ACTIVITY_MODERATE_DAYS} أيام)` : `🟡 Moderate (${ACTIVITY_MODERATE_DAYS}d)`}</option>
                <option value="stale">{isRTL ? '🔴 مهمل' : '🔴 Stale'}</option>
                <option value="never">{isRTL ? '⚫ لم يتم التواصل' : '⚫ Never'}</option>
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
              className={`rounded-xl px-2 py-px text-[10px] mis-1 ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
              style={active ? { background: s.color, color: '#fff' } : undefined}>{s.count}</span>
          </button>
          );
        })}
        {profile?.role !== 'sales_agent' && (
        <button onClick={() => setShowUnassigned(v => !v)} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${showUnassigned ? 'border border-amber-500 bg-amber-500/[0.08] text-amber-500 font-bold' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'}`}>
          <Users size={11} /> {isRTL ? 'غير معين' : 'Unassigned'} <span className={`rounded-xl px-2 py-px text-[10px] mis-1 ${showUnassigned ? 'bg-amber-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.unassigned || 0}</span>
        </button>
        )}
        <button onClick={() => setShowBlacklisted(v => !v)} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${showBlacklisted ? 'border border-red-500 bg-red-500/[0.08] text-red-500 font-bold' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'}`}>
          <Ban size={11} /> {isRTL ? 'بلاك ليست' : 'Blacklist'} <span className={`rounded-xl px-2 py-px text-[10px] mis-1 ${showBlacklisted ? 'bg-red-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.blacklisted}</span>
        </button>
      </div>

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
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultsCount={totalContacts}
        quickFilters={[
          { label: 'متابعة اليوم', labelEn: "Today's Follow-ups", filters: [{ field: 'contact_status', operator: 'is', value: '__today_followup' }] },
          { label: 'مهام متأخرة', labelEn: 'Overdue Tasks', filters: [{ field: 'contact_status', operator: 'is', value: '__overdue_tasks' }] },
          { label: 'بدون فرص', labelEn: 'No Opportunities', filters: [{ field: 'contact_status', operator: 'is', value: '__no_opps' }] },
          ...(profile?.role !== 'sales_agent' ? [{ label: 'مسؤول واحد', labelEn: 'Single Agent', filters: [{ field: 'contact_status', operator: 'is', value: '__single_agent' }] }] : []),
        ]}
      />

      {/* Saved Filters */}
      {(savedFilters.length > 0 || smartFilters.length > 0) && (
        <div className="flex gap-2 items-center flex-wrap mt-2 px-1">
          {smartFilters.length > 0 && (
            <button
              onClick={() => {
                const name = prompt(isRTL ? 'اسم الفلتر المحفوظ:' : 'Saved filter name:');
                if (!name || !name.trim()) return;
                const newFilter = { id: Date.now(), name: name.trim(), filters: smartFilters, filterType, showBlacklisted, sortBy };
                const updated = [...savedFilters, newFilter];
                setSavedFilters(updated);
                localStorage.setItem('platform_saved_filters_contacts', JSON.stringify(updated));
              }}
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

      {/* Table */}
      <div style={{ opacity: searching ? 0.5 : 1, transition: 'opacity 0.15s', pointerEvents: searching ? 'none' : 'auto' }}>
      <ContactsTable
        loading={loading}
        filtered={filtered}
        paged={filtered}
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
        setBlacklistTarget={setBlacklistTarget}
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
        deptView={deptView}
      />
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
      {showAddModal && <AddContactModal profile={profile} campaigns={campaignsList} onCreateCampaign={async (data) => { const created = await createCampaign(data); setCampaignsList(prev => [created, ...prev]); }} onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const np = normalizePhone(phone); const found = contacts.find(c => normalizePhone(c.phone) === np || normalizePhone(c.phone2) === np || (c.extra_phones || []).some(p => normalizePhone(p) === np)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} onAddInteraction={(contact, interaction) => {
        const existing = contact.campaign_interactions || [];
        const updatedContact = { ...contact, campaign_interactions: [...existing, interaction] };
        setContacts(prev => {
          const next = prev.map(c => c.id === contact.id ? updatedContact : c);
                    return next;
        });
        updateContact(contact.id, { campaign_interactions: updatedContact.campaign_interactions }).catch(err => { if (import.meta.env.DEV) console.warn('update campaign interactions:', err); });
      }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => { setSelected(null); setOpenWithAction(false); }} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={async (updated) => {
        const old = contacts.find(c => c.id === updated.id);
        const { _skipDbUpdate, ...cleanUpdated } = updated;
        setContacts(prev => prev.map(c => c.id === cleanUpdated.id ? cleanUpdated : c));
        setSelected(cleanUpdated);
        if (!_skipDbUpdate) {
          try {
            await updateContact(cleanUpdated.id, cleanUpdated);
          } catch (err) {
            console.error('[onUpdate] updateContact failed:', err?.message || err);
            toast.error(isRTL ? 'فشل حفظ التعديلات: ' + (err?.message || '') : 'Save failed: ' + (err?.message || ''));
            if (old) { setContacts(prev => prev.map(c => c.id === old.id ? old : c)); setSelected(old); }
          }
        }
        const changedFields = old ? Object.keys(updated).filter(k => JSON.stringify(old[k]) !== JSON.stringify(updated[k]) && !['updated_at'].includes(k)) : [];
        const desc = changedFields.length ? changedFields.map(k => `${k}: "${old?.[k] || ''}" → "${updated[k] || ''}"`).join(', ') : `Updated contact: ${updated.full_name}`;
        logAction({ action: 'update', entity: 'contact', entityId: updated.id, entityName: updated.full_name, description: desc, oldValue: old || null, newValue: updated, userName: profile?.full_name_ar || '' }).catch(() => {});
      }} initialAction={openWithAction} onPrev={handlePrev} onNext={handleNext} onPin={togglePin} isPinned={pinnedIds.includes(selected.id)} onLogCall={c => { setLogCallTarget(c); }} onReminder={c => { setReminderTarget(c); }} onDelete={id => { handleDelete(id); setSelected(null); }} />}
      {logCallTarget && <LogCallModal contact={logCallTarget} onClose={() => setLogCallTarget(null)} onUpdate={(updated) => { setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); return next; }); updateContact(updated.id, updated).catch(err => { if (import.meta.env.DEV) console.warn('optimistic contact update:', err); }); }} />}
      {reminderTarget && <QuickTaskModal contact={reminderTarget} onClose={() => setReminderTarget(null)} />}
      {blacklistTarget && <BlacklistModal contact={blacklistTarget} onClose={() => setBlacklistTarget(null)} onConfirm={handleBlacklist} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} existingContacts={contacts} onImportDone={async (newContacts) => {
        // Import directly to Supabase using batch insert
        const { batchInsert } = await import('../utils/batchOperations');
        const { stripInternalFields } = await import('../utils/sanitizeForSupabase');
        // Only allow known contacts table columns
        const ALLOWED_COLS = new Set(['full_name','prefix','phone','phone2','extra_phones','email','company','job_title','department','source','contact_type','contact_status','notes','gender','nationality','birth_date','preferred_location','interested_in_type','campaign_name','campaign_id','campaign_interactions','temperature','platform','assigned_to_name','assigned_to_names','assigned_by_name','assigned_at','created_by','created_by_name','budget_min','budget_max','lead_score','is_blacklisted','last_activity_at','created_at','agent_statuses','agent_temperatures','agent_scores']);
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
          // Sync assigned_to_name → assigned_to_names + agent_statuses + agent_temperatures
          const agentName = safe.assigned_to_name || profile?.full_name_en || profile?.full_name_ar;
          if (agentName) {
            safe.assigned_to_name = agentName;
            safe.assigned_to_names = [agentName];
            safe.agent_statuses = { [agentName]: safe.contact_status || 'new' };
            safe.agent_temperatures = { [agentName]: safe.temperature || 'warm' };
            // Stamp assignment time so "Sort: Assignment Date" shows imports correctly
            if (!safe.assigned_at) safe.assigned_at = new Date().toISOString();
          }
          return safe;
        });
        try {
          console.log('[Import] Sending', clean.length, 'contacts. Sample:', JSON.stringify(clean[0]).slice(0, 200));
          const inserted = await batchInsert('contacts', clean, 20);
          console.log('[Import] Inserted:', inserted.length, 'out of', clean.length);
          // Log import
          supabase.from('import_export_logs').insert([{
            type: 'import', user_id: profile?.id, user_name: profile?.full_name_en || profile?.full_name_ar,
            total_records: clean.length, success_count: inserted.length, failed_count: clean.length - inserted.length,
            entity: 'contacts', status: inserted.length === clean.length ? 'completed' : inserted.length > 0 ? 'partial' : 'failed',
          }]).then(() => {}).catch(() => {});
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
          toast.error(isRTL ? 'فشل الاستيراد: ' + err.message : 'Import failed: ' + err.message);
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
      />

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
        handleBulkAddAgent={handleBulkAddAgent}
        handleBulkRemoveAgent={handleBulkRemoveAgent}
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
