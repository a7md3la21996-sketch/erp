import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { Phone, MessageCircle, Plus, Upload, Download, Search, Ban, X, Pin, PhoneCall, Merge, SkipForward, MoreVertical, Bell, FileDown, Trash2, Zap } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact, createActivity,
} from '../services/contactsService';
import { logAction } from '../services/auditService';
import { setFieldValues as setCFValues } from '../services/customFieldsService';
import { fetchCampaigns } from '../services/marketingService';
import { notifyLeadAssigned } from '../services/notificationsService';
import { evaluateTriggers } from '../services/triggerService';
import ImportModal from './crm/ImportModal';
import { PageSkeleton, Button, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { thCls } from '../utils/tableStyles';

// ── Split modules ──────────────────────────────────────────────────────────
import {
  SOURCE_LABELS, SOURCE_EN,
  TYPE, MOCK,
  daysSince, initials, avatarColor, normalizePhone,
  Chip, PhoneCell, COUNTRY_CODES,
} from './crm/contacts/constants';
import AddContactModal from './crm/contacts/AddContactModal';
import LogCallModal from './crm/contacts/LogCallModal';
import QuickTaskModal from './crm/contacts/QuickTaskModal';
import BlacklistModal from './crm/contacts/BlacklistModal';
import ContactDrawer from './crm/contacts/ContactDrawer';

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [contacts, setContacts] = useState([]);
  const [campaignsList, setCampaignsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [filterType, setFilterType] = useState('all');
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [sortBy, setSortBy] = useState('created');
  const [smartFilters, setSmartFilters] = useState([]);
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [bulkReassignModal, setBulkReassignModal] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => { try { return JSON.parse(localStorage.getItem('platform_pinned_contacts') || '[]'); } catch { return []; } });
  const [batchCallMode, setBatchCallMode] = useState(false);
  const [batchCallIndex, setBatchCallIndex] = useState(0);
  const [batchCallNotes, setBatchCallNotes] = useState('');
  const [batchCallResult, setBatchCallResult] = useState('');
  const [batchCallLog, setBatchCallLog] = useState([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTargets, setMergeTargets] = useState([]);
  const [mergePreview, setMergePreview] = useState(null);
  const isAdmin = profile?.role === 'admin';
  const { auditFields, applyAuditFilters } = useAuditFilter('contact');

  const MAX_PINS = 4;
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

  const { activityResults: configResults } = useSystemConfig();
  const QUICK_RESULTS = useMemo(() => {
    if (configResults && Object.keys(configResults).length > 0) return configResults;
    return {
      call: [
        { value: 'answered', label_ar: 'رد', label_en: 'Answered', color: '#10B981' },
        { value: 'no_answer', label_ar: 'لم يرد', label_en: 'No Answer', color: '#F59E0B' },
        { value: 'busy', label_ar: 'مشغول', label_en: 'Busy', color: '#EF4444' },
        { value: 'switched_off', label_ar: 'مغلق', label_en: 'Switched Off', color: '#6b7280' },
      ],
      whatsapp: [
        { value: 'replied', label_ar: 'رد', label_en: 'Replied', color: '#10B981' },
        { value: 'seen', label_ar: 'شاف', label_en: 'Seen', color: '#3B82F6' },
        { value: 'delivered', label_ar: 'وصلت', label_en: 'Delivered', color: '#F59E0B' },
      ],
      email: [
        { value: 'replied', label_ar: 'رد', label_en: 'Replied', color: '#10B981' },
        { value: 'sent', label_ar: 'تم الإرسال', label_en: 'Sent', color: '#F59E0B' },
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
      });
      if (contact.contact_status === 'new' || !contact.contact_status) {
        const updated = { ...contact, contact_status: 'contacted' };
        setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); localStorage.setItem('platform_contacts', JSON.stringify(next)); return next; });
        updateContact(updated.id, updated).catch(() => {});
      }
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch {
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

      if (bulkReassignModal) { setBulkReassignModal(false); return; }
      if (confirmAction) { setConfirmAction(null); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [quickActionTarget, batchCallMode, mergePreview, bulkReassignModal, confirmAction]);

  const handleDelete = (id) => {
    const contact = contacts.find(c => c.id === id);
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: isRTL ? `هل أنت متأكد من حذف "${contact?.full_name || ''}"؟` : `Are you sure you want to delete "${contact?.full_name || ''}"?`,
      onConfirm: () => {
        const updated = contacts.filter(c => c.id !== id);
        setContacts(updated);
        localStorage.setItem('platform_contacts', JSON.stringify(updated));
        logAction({ action: 'delete', entity: 'contact', entityId: id, entityName: contact?.full_name, description: `Deleted contact: ${contact?.full_name}`, userName: profile?.full_name_ar });
        toast.success(isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully');
        setConfirmAction(null);
      }
    });
  };

  const handleDeleteSelected = () => {
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: isRTL ? `حذف ${selectedIds.length} جهة اتصال؟ لا يمكن التراجع.` : `Delete ${selectedIds.length} contacts? This cannot be undone.`,
      onConfirm: () => {
        const count = selectedIds.length;
        const names = contacts.filter(c => selectedIds.includes(c.id)).map(c => c.full_name).join(', ');
        const updated = contacts.filter(c => !selectedIds.includes(c.id));
        setContacts(updated);
        localStorage.setItem('platform_contacts', JSON.stringify(updated));
        logAction({ action: 'bulk_delete', entity: 'contact', entityId: selectedIds.join(','), description: `Bulk deleted ${count} contacts: ${names}`, userName: profile?.full_name_ar });
        setSelectedIds([]);
        toast.success(isRTL ? `تم حذف ${count} جهة اتصال` : `${count} contacts deleted`);
        setConfirmAction(null);
      }
    });
  };


  const handleBulkReassign = async (agentName) => {
    const assignedByName = profile?.full_name_ar || '—';
    const names = contacts.filter(c => selectedIds.includes(c.id)).map(c => c.full_name).join(', ');
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, assigned_to_name: agentName, assigned_by_name: assignedByName } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    logAction({ action: 'bulk_reassign', entity: 'contact', entityId: selectedIds.join(','), description: `Reassigned ${selectedIds.length} contacts to ${agentName}: ${names}`, newValue: agentName, userName: profile?.full_name_ar });
    // Notify assigned agent
    contacts.filter(c => selectedIds.includes(c.id)).forEach(c => {
      notifyLeadAssigned({ contactName: c.full_name || c.phone || '—', agentId: agentName, agentName, assignedBy: assignedByName });
    });
    toast.success(isRTL ? `تم إعادة تعيين ${selectedIds.length} جهة اتصال` : `${selectedIds.length} contacts reassigned`);
    setSelectedIds([]);
    setBulkReassignModal(false);
    setShowBulkMenu(false);
    // Persist to DB + audit log
    await Promise.all(selectedIds.map(id => updateContact(id, { assigned_to_name: agentName, assigned_by_name: assignedByName }).catch(() => {})));
  };


  // Load contacts
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchContacts({
          role: profile?.role,
          userId: profile?.id,
          teamId: profile?.team_id,
          filters: {},
        });
        if (data.length) {
          setContacts(data);
        } else {
          throw new Error('no data');
        }
      } catch {
        const cached = localStorage.getItem('platform_contacts');
        if (cached) {
          try { setContacts(JSON.parse(cached)); } catch { setContacts(MOCK); }
        } else {
          setContacts(MOCK);
        }
      } finally {
        setLoading(false);
      }
    };
    if (profile) load();
    else { setContacts(MOCK); setLoading(false); }
    // Load campaigns for ID linking
    fetchCampaigns().then(c => setCampaignsList(c)).catch(() => {});
  }, [profile]);

  // Handle highlight query param (scroll to & select contact)
  useEffect(() => {
    if (!highlightId || loading || !contacts.length) return;
    const contact = contacts.find(c => String(c.id) === String(highlightId));
    if (contact) {
      setSelected(contact);
      // Clear the query param
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
    }
  }, [highlightId, loading, contacts]);

  // Stats
  const stats = useMemo(() => {
    const counts = { total: contacts.length, blacklisted: 0 };
    Object.keys(TYPE).forEach(k => { counts[k] = 0; });
    contacts.forEach(c => {
      if (c.contact_type && counts[c.contact_type] !== undefined) counts[c.contact_type]++;
      if (c.is_blacklisted) counts.blacklisted++;
    });
    return counts;
  }, [contacts]);

  // Smart filter field definitions
  // Detect country from phone number prefix
  const detectCountry = (phone) => {
    if (!phone) return '';
    const p = phone.replace(/\s+/g, '');
    if (p.startsWith('+20') || (p.startsWith('01') && ['0','1','2','5'].includes(p[2]))) return 'EG';
    if (p.startsWith('+966') || p.startsWith('05')) return 'SA';
    if (p.startsWith('+971')) return 'AE';
    if (p.startsWith('+965')) return 'KW';
    if (p.startsWith('+974')) return 'QA';
    if (p.startsWith('+968')) return 'OM';
    if (p.startsWith('+973')) return 'BH';
    if (p.startsWith('+962') || p.startsWith('07')) return 'JO';
    if (p.startsWith('+964') || p.startsWith('09')) return 'IQ';
    if (p.startsWith('+961')) return 'LB';
    if (p.startsWith('+218')) return 'LY';
    if (p.startsWith('+212')) return 'MA';
    if (p.startsWith('+216')) return 'TN';
    if (p.startsWith('+249')) return 'SD';
    return '';
  };

  const COUNTRY_OPTIONS = COUNTRY_CODES.filter(c => ['EG','SA','AE','KW','QA','OM','BH','JO','IQ','LB','LY','MA','TN','SD'].includes(c.country)).map(c => ({ value: c.country, label: c.labelAr, labelEn: c.label }));

  const SMART_FIELDS = useMemo(() => [
    { id: 'contact_type', label: 'النوع', labelEn: 'Type', type: 'select', options: [
      { value: 'lead', label: 'ليد', labelEn: 'Lead' },
      { value: 'cold', label: 'كولد كول', labelEn: 'Cold Call' },
      { value: 'client', label: 'عميل', labelEn: 'Client' },
      { value: 'supplier', label: 'مورد', labelEn: 'Supplier' },
      { value: 'developer', label: 'مطور عقاري', labelEn: 'Developer' },
      { value: 'applicant', label: 'متقدم لوظيفة', labelEn: 'Applicant' },
      { value: 'partner', label: 'شريك', labelEn: 'Partner' },
    ]},
    { id: 'source', label: 'المصدر', labelEn: 'Source', type: 'select', options: Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v, labelEn: SOURCE_EN[k] || v })) },
    { id: 'department', label: 'القسم', labelEn: 'Department', type: 'select', options: [
      { value: 'sales', label: 'المبيعات', labelEn: 'Sales' },
      { value: 'hr', label: 'HR', labelEn: 'HR' },
      { value: 'finance', label: 'المالية', labelEn: 'Finance' },
      { value: 'marketing', label: 'التسويق', labelEn: 'Marketing' },
      { value: 'operations', label: 'العمليات', labelEn: 'Operations' },
    ]},
    { id: 'full_name', label: 'الاسم', labelEn: 'Name', type: 'text' },
    { id: 'email', label: 'الإيميل', labelEn: 'Email', type: 'text' },
    { id: 'phone', label: 'الهاتف', labelEn: 'Phone', type: 'text' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created Date', type: 'date' },
    { id: 'last_activity_at', label: 'آخر نشاط', labelEn: 'Last Activity', type: 'date' },
    { id: 'lead_score', label: 'Lead Score', labelEn: 'Lead Score', type: 'number' },
    { id: 'campaign_name', label: 'الحملة', labelEn: 'Campaign', type: 'text' },
    { id: '_country', label: 'الدولة', labelEn: 'Country', type: 'select', options: COUNTRY_OPTIONS },
    { id: 'assigned_to_name', label: 'المسؤول', labelEn: 'Assigned To', type: 'select', options: [...new Set(contacts.map(c => c.assigned_to_name).filter(Boolean))].map(n => ({ value: n, label: n, labelEn: n })) },
    { id: 'assigned_by_name', label: 'عيّنه', labelEn: 'Assigned By', type: 'select', options: [...new Set(contacts.map(c => c.assigned_by_name).filter(Boolean))].map(n => ({ value: n, label: n, labelEn: n })) },
    ...auditFields,
  ], [contacts, auditFields]);

  const SORT_OPTIONS = useMemo(() => [
    { value: 'created', label: 'ترتيب: الأحدث', labelEn: 'Sort: Newest' },
    { value: 'last_activity', label: 'ترتيب: آخر نشاط', labelEn: 'Sort: Last Activity' },
    { value: 'score', label: 'ترتيب: Lead Score', labelEn: 'Sort: Lead Score' },
    { value: 'name', label: 'ترتيب: الاسم', labelEn: 'Sort: Name' },
    { value: 'stale', label: 'ترتيب: يحتاج متابعة', labelEn: 'Sort: Needs Follow-up' },
  ], []);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (!showBlacklisted && c.is_blacklisted) return false;
      if (filterType !== 'all' && c.contact_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q) || c.campaign_name?.toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q));
      }
      return true;
    });
    // Compute country from phone for filtering
    list = list.map(c => c._country ? c : { ...c, _country: detectCountry(c.phone) });
    // Apply smart filters
    list = applySmartFilters(list, smartFilters, SMART_FIELDS);
    list = applyAuditFilters(list, smartFilters);
    list.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      if (sortBy === 'last_activity') return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
      if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
      if (sortBy === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'stale') {
        return new Date(a.last_activity_at || 0) - new Date(b.last_activity_at || 0);
      }
      return 0;
    });
    return list;
  }, [contacts, filterType, search, showBlacklisted, sortBy, pinnedIds, smartFilters, SMART_FIELDS]);

  useEffect(() => { setPage(1); setSelectedIds([]); }, [filterType, search, showBlacklisted, sortBy, smartFilters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

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
  const toggleSelectAll = () => {
    const pageIds = paged.map(c => c.id);
    const allSelected = pageIds.every(id => selectedIdSet.has(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  };

  const exportCSV = (list) => {
    const headers = isRTL ? ['ID','الاسم','الهاتف','الإيميل','النوع','المصدر','القسم','المنصة','الشركة','تاريخ الإنشاء'] : ['ID','Name','Phone','Email','Type','Source','Department','Platform','Company','Created'];
    const rows = list.map(c => [c.id, c.full_name, c.phone, c.email || '', c.contact_type, c.source || '', c.department || '', c.platform || '', c.company || '', c.created_at || '']);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async (form) => {
    const matchedCampaign = form.campaign_name ? campaignsList.find(c => c.name_en?.toLowerCase() === form.campaign_name.toLowerCase() || c.name_ar?.toLowerCase() === form.campaign_name.toLowerCase()) : null;
    const campaign_interactions = form.campaign_name
      ? [{ campaign: form.campaign_name, campaign_id: matchedCampaign?.id || null, source: form.source, platform: form.platform, date: new Date().toISOString() }]
      : [];
    const newContact = {
      ...form,
      id: String(Math.max(0, ...contacts.map(c => parseInt(c.id) || 0)) + 1),
      lead_score: 0,
      temperature: 'hot',
      temperature_auto: true,
      cold_status: form.contact_type === 'cold' ? 'not_contacted' : null,
      is_blacklisted: false,
      assigned_to_name: profile?.full_name_ar || '—',
      assigned_by_name: profile?.full_name_ar || '—',
      campaign_interactions,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    const cfValues = form._customFieldValues;
    const { _customFieldValues, ...cleanForm } = form;
    try {
      const saved = await createContact(cleanForm);
      const updated = [saved, ...contacts];
      setContacts(updated);
      localStorage.setItem('platform_contacts', JSON.stringify(updated));
      if (cfValues) setCFValues('contact', saved.id, cfValues);
      logAction({ action: 'create', entity: 'contact', entityId: saved.id, entityName: cleanForm.full_name, description: `Created contact: ${cleanForm.full_name} (${cleanForm.contact_type})`, userName: profile?.full_name_ar });
      evaluateTriggers('contact', 'created', saved);
    } catch {
      const updated = [newContact, ...contacts];
      setContacts(updated);
      localStorage.setItem('platform_contacts', JSON.stringify(updated));
      if (cfValues) setCFValues('contact', newContact.id, cfValues);
      logAction({ action: 'create', entity: 'contact', entityId: newContact.id, entityName: cleanForm.full_name, description: `Created contact: ${cleanForm.full_name} (${cleanForm.contact_type})`, userName: profile?.full_name_ar });
      evaluateTriggers('contact', 'created', newContact);
    }
  };

  const handleBlacklist = async (contact, reason) => {
    try { await blacklistContact(contact.id, reason); } catch { /* optimistic */ }
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_blacklisted: true, blacklist_reason: reason } : c));
    logAction({ action: 'blacklist', entity: 'contact', entityId: contact.id, entityName: contact.full_name, description: `Blacklisted: ${contact.full_name} — ${reason}`, newValue: reason, userName: profile?.full_name_ar });
    if (selected?.id === contact.id) setSelected(null);
  };

  const tdCls = `px-4 py-3.5 border-b border-edge/50 dark:border-edge-dark/50 align-middle text-xs text-content dark:text-content-dark text-start`;

  if (loading) return <PageSkeleton hasKpis={false} tableRows={8} tableCols={7} />;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="font-['Cairo','Tajawal',sans-serif] text-content dark:text-content-dark px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Page Header */}
      <div className="mb-5 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p className="mt-1 mb-0 text-xs text-content-muted dark:text-content-muted-dark">
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${filtered.length} ${isRTL ? 'نتيجة' : (filtered.length === 1 ? 'result' : 'results')}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportCSV(filtered)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
            <Download size={14} /> <span className="hidden sm:inline">{isRTL ? 'تصدير' : 'Export'}</span>
          </button>
          <button onClick={() => setShowImportModal(true)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
            <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
          </button>

          {selectedIds.length > 0 && (
            <Button variant="call" size="sm" onClick={() => { setBatchCallMode(true); setBatchCallIndex(0); setBatchCallLog([]); setBatchCallNotes(''); setBatchCallResult(''); }}>
              <PhoneCall size={14} /> {isRTL ? `اتصال جماعي (${selectedIds.length})` : `Batch Call (${selectedIds.length})`}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
          </Button>
          {isAdmin && selectedIds.length > 0 && (
            <div className="relative">
              <Button size="sm" onClick={() => setShowBulkMenu(v => !v)}>
                {isRTL ? `إجراءات (${selectedIds.length})` : `Actions (${selectedIds.length})`} ▾
              </Button>
              {showBulkMenu && (
                <div className={`absolute top-[110%] start-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[190px] z-[200] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden`}>
                  {[
                    { label: isRTL ? "تصدير المحددين" : "Export Selected", action: () => exportCSV(contacts.filter(c => selectedIds.includes(c.id))) },
                    { label: isRTL ? "إعادة تعيين" : "Reassign", action: () => setBulkReassignModal(true) },
                    ...(selectedIds.length === 2 ? [{ label: isRTL ? "دمج جهتي اتصال" : "Merge Contacts", action: () => { setMergePreview(selectedIds); setShowBulkMenu(false); } }] : []),
                  ].map(item => (
                    <button key={item.label} onClick={item.action} className={`w-full px-4 py-2.5 bg-transparent border-none text-content dark:text-content-dark text-xs cursor-pointer text-start flex items-center gap-2 hover:bg-brand-500/[0.15]`}>
                      {item.label}
                    </button>
                  ))}
                  <div className="h-px bg-red-500/20 my-1" />
                  <button onClick={handleDeleteSelected} className={`w-full px-4 py-2.5 bg-transparent border-none text-red-500 text-xs cursor-pointer text-start flex items-center gap-2 hover:bg-red-500/10`}>
                    {isRTL ? "حذف المحددين" : "Delete Selected"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Type Chips */}
      <div className="flex gap-2 mb-3.5 flex-wrap">
        {[
          { label: isRTL ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB' },
          ...Object.entries(TYPE).filter(([k]) => stats[k] > 0).map(([k, v]) => ({
            label: isRTL ? v.label : v.labelEn, value: k, count: stats[k] || 0, color: v.color,
          })),
        ].map(s => {
          const active = filterType === s.value;
          return (
          <button key={s.value} onClick={() => setFilterType(s.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
            style={active ? { border: `1px solid ${s.color}`, background: `${s.color}15`, color: s.color } : undefined}>
            {s.label} <span
              className={`rounded-xl px-2 py-px text-[10px] mis-1 ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
              style={active ? { background: s.color, color: '#fff' } : undefined}>{s.count}</span>
          </button>
          );
        })}
        <button onClick={() => setShowBlacklisted(v => !v)} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${showBlacklisted ? 'border border-red-500 bg-red-500/[0.08] text-red-500 font-bold' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'}`}>
          <Ban size={11} /> {isRTL ? 'بلاك ليست' : 'Blacklist'} <span className={`rounded-xl px-2 py-px text-[10px] mis-1 ${showBlacklisted ? 'bg-red-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.blacklisted}</span>
        </button>
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
        resultsCount={filtered.length}
        quickFilters={[
          { label: 'ليدز جدد', labelEn: 'New Leads', filters: [{ field: 'contact_type', operator: 'is', value: 'lead' }, { field: 'created_at', operator: 'last_7' }] },
          { label: 'بدون نشاط', labelEn: 'No Activity 30d', filters: [{ field: 'last_activity_at', operator: 'before', value: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) }] },
          { label: 'عملاء مبيعات', labelEn: 'Sales Clients', filters: [{ field: 'contact_type', operator: 'is', value: 'client' }, { field: 'department', operator: 'is', value: 'sales' }] },
          { label: 'موردين', labelEn: 'Suppliers', filters: [{ field: 'contact_type', operator: 'is', value: 'supplier' }] },
        ]}
      />

      {/* Table */}
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
              <button onClick={() => { setMergeMode(false); setMergeTargets([]); }} className="px-3.5 py-1.5 bg-transparent border border-edge dark:border-edge-dark rounded-md text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
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
                    onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 2 ? [...prev, c.id] : prev) : setSelected(c)}
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
                          <span className={`text-[10px] px-2 py-px rounded-full font-medium ${(!c.contact_status || c.contact_status === 'new') ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>{(!c.contact_status || c.contact_status === 'new') ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'تم التواصل' : 'Contacted')}</span>
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
                <th className={thCls}>{t('contacts.phone')}</th>
                <th className={thCls}>{isRTL ? 'المصدر / التاريخ' : 'Source / Date'}</th>
                <th className={`${thCls} text-center`}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center p-10 text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-0 border-none">
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
                  onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 2 ? [...prev, c.id] : prev) : setSelected(c)}
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
                          {c.opportunities?.length > 0 && <span className="text-[9px] px-1.5 py-px rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">{c.opportunities.length} {isRTL ? 'فرص' : 'opps'}</span>}
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
                              <button onClick={() => { const hdr = isRTL ? ['الاسم','الهاتف','النوع','المصدر','الميزانية'] : ['Name','Phone','Type','Source','Budget']; const data = [hdr,[c.full_name,c.phone,c.contact_type,c.source,(c.budget_min||'')+'–'+(c.budget_max||'')]]; const csv = '\uFEFF'+data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
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

      {/* Quick Action Popover */}
      {quickActionTarget && (
        <div className="fixed inset-0 z-[150]" onClick={() => setQuickActionTarget(null)}>
          <div onClick={e => e.stopPropagation()}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-[0_8px_30px_rgba(27,51,71,0.2)] p-4 w-[320px] z-[151]"
            dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-brand-500" />
                <span className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'إجراء سريع' : 'Quick Action'}</span>
              </div>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{quickActionTarget.full_name}</span>
            </div>

            {/* Activity type chips */}
            <div className="flex gap-1.5 flex-wrap mb-2.5">
              {[
                { key: 'call', ar: 'مكالمة', en: 'Call' },
                { key: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
                { key: 'email', ar: 'إيميل', en: 'Email' },
                { key: 'note', ar: 'ملاحظة', en: 'Note' },
              ].map(v => (
                <button key={v.key} onClick={() => setQuickActionForm(f => ({ ...f, type: v.key, result: '' }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors ${
                    quickActionForm.type === v.key
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/40'
                  }`}>
                  {isRTL ? v.ar : v.en}
                </button>
              ))}
            </div>

            {/* Result chips (required) */}
            {(QUICK_RESULTS[quickActionForm.type] || []).length > 0 && (
              <div className="mb-2.5">
                <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النتيجة' : 'Result'} <span className="text-red-500">*</span></div>
                <div className="flex gap-1.5 flex-wrap">
                  {(QUICK_RESULTS[quickActionForm.type] || []).map(r => (
                    <button key={r.value} onClick={() => setQuickActionForm(f => ({ ...f, result: f.result === r.value ? '' : r.value }))}
                      className={`px-2 py-0.5 rounded-lg text-[11px] cursor-pointer border ${
                        quickActionForm.result === r.value
                          ? 'font-bold'
                          : 'font-normal bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                      }`}
                      style={quickActionForm.result === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>
                      {isRTL ? r.label_ar : r.label_en}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <textarea
              rows={2}
              placeholder={isRTL ? 'ملاحظات...' : 'Notes...'}
              value={quickActionForm.description}
              onChange={e => setQuickActionForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none resize-none mb-3 box-border"
            />

            {/* Save / Cancel */}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setQuickActionTarget(null)} className="px-3 py-1.5 rounded-lg text-xs border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={() => handleQuickAction(quickActionTarget)} disabled={savingQuickAction || ((QUICK_RESULTS[quickActionForm.type] || []).length > 0 && !quickActionForm.result)}
                className="px-3 py-1.5 rounded-lg text-xs bg-brand-500 text-white border border-brand-500 cursor-pointer hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                <Zap size={11} />
                {savingQuickAction ? '...' : (isRTL ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const np = normalizePhone(phone); const found = contacts.find(c => normalizePhone(c.phone) === np || normalizePhone(c.phone2) === np || (c.extra_phones || []).some(p => normalizePhone(p) === np)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} onAddInteraction={(contact, interaction) => {
        const existing = contact.campaign_interactions || [];
        const updated = { ...contact, campaign_interactions: [...existing, interaction] };
        setContacts(prev => prev.map(c => c.id === contact.id ? updated : c));
        localStorage.setItem('platform_contacts', JSON.stringify(contacts.map(c => c.id === contact.id ? updated : c)));
        updateContact(contact.id, { campaign_interactions: updated.campaign_interactions }).catch(() => {});
      }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => { setSelected(null); setOpenWithAction(false); }} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => { setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); localStorage.setItem('platform_contacts', JSON.stringify(next)); return next; }); setSelected(updated); updateContact(updated.id, updated).catch(() => { /* optimistic */ }); logAction({ action: 'update', entity: 'contact', entityId: updated.id, entityName: updated.full_name, description: `Updated contact: ${updated.full_name}`, userName: profile?.full_name_ar || '' }) }} initialAction={openWithAction} onPrev={handlePrev} onNext={handleNext} onPin={togglePin} isPinned={pinnedIds.includes(selected.id)} onLogCall={c => { setLogCallTarget(c); }} onReminder={c => { setReminderTarget(c); }} onDelete={id => { handleDelete(id); setSelected(null); }} />}
      {logCallTarget && <LogCallModal contact={logCallTarget} onClose={() => setLogCallTarget(null)} />}
      {reminderTarget && <QuickTaskModal contact={reminderTarget} onClose={() => setReminderTarget(null)} />}
    {blacklistTarget && <BlacklistModal contact={blacklistTarget} onClose={() => setBlacklistTarget(null)} onConfirm={handleBlacklist} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} existingContacts={contacts} onImportDone={(newContacts) => { setContacts(prev => { const updated = [...prev, ...newContacts]; localStorage.setItem('platform_contacts', JSON.stringify(updated)); return updated; }); setShowImportModal(false); }} />}

      {/* Batch Call Mode */}
      {batchCallMode && (() => {
        const batchContacts = contacts.filter(c => selectedIds.includes(c.id));
        const current = batchContacts[batchCallIndex];
        if (!current) return null;
        const progress = batchCallLog.length;
        const total = batchContacts.length;
        return (
          <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-5">
            <div className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[20px] w-full max-w-[520px] overflow-hidden">
              <div className="bg-gradient-to-br from-[#065F46] to-emerald-500 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <PhoneCall size={18} color="#fff" />
                  <span className="text-white font-bold text-sm">{isRTL ? 'وضع الاتصال' : 'Call Mode'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-xs">{progress}/{total}</span>
                  <button onClick={() => setBatchCallMode(false)} className="bg-white/15 border-none rounded-md w-7 h-7 flex items-center justify-center cursor-pointer text-white"><X size={14} /></button>
                </div>
              </div>
              <div className="h-[3px] bg-gray-200 dark:bg-gray-700">
                <div className="h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(progress / total) * 100}%` }} />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3.5 mb-5">
                  <div className="w-[50px] h-[50px] rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ background: avatarColor(current.id) }}>
                    {initials(current.full_name)}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-base text-content dark:text-content-dark">{current.full_name}</div>
                    <div className={`text-xs text-content-muted dark:text-content-muted-dark text-start`} dir="ltr">{current.phone}</div>
                    {current.company && <div className="text-xs text-content-muted dark:text-content-muted-dark">{current.company}</div>}
                  </div>
                  <div className="text-center">
                    {TYPE[current.contact_type] ? <Chip label={isRTL ? TYPE[current.contact_type].label : TYPE[current.contact_type].labelEn} color={TYPE[current.contact_type].color} bg={TYPE[current.contact_type].bg} /> : <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>}
                  </div>
                </div>
                <a href={`tel:${normalizePhone(current.phone)}`} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#065F46] to-emerald-500 rounded-xl text-white font-bold text-sm no-underline mb-4">
                  <Phone size={16} /> {isRTL ? 'اتصل الآن' : 'Call Now'}
                </a>
                <div className="mb-3">
                  <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نتيجة المكالمة' : 'Call Result'}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: 'answered', label: isRTL ? 'رد' : 'Answered', color: '#10B981' },
                      { value: 'no_answer', label: isRTL ? 'لم يرد' : 'No Answer', color: '#F59E0B' },
                      { value: 'busy', label: isRTL ? 'مشغول' : 'Busy', color: '#EF4444' },
                      { value: 'switched_off', label: isRTL ? 'مغلق' : 'Switched Off', color: '#6b7280' },
                      { value: 'wrong_number', label: isRTL ? 'رقم خاطئ' : 'Wrong Number', color: '#9333EA' },
                    ].map(r => (
                      <button key={r.value} onClick={() => setBatchCallResult(batchCallResult === r.value ? '' : r.value)}
                        className={`px-3 py-1.5 rounded-2xl text-xs cursor-pointer border ${batchCallResult === r.value ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                        style={batchCallResult === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <textarea value={batchCallNotes} onChange={e => setBatchCallNotes(e.target.value)} placeholder={isRTL ? 'ملاحظات سريعة...' : 'Quick notes...'} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs resize-none box-border font-inherit mb-4" />
                <div className="flex gap-2.5 justify-between">
                  <button disabled={batchCallIndex === 0} onClick={() => { setBatchCallIndex(i => i - 1); setBatchCallNotes(''); setBatchCallResult(''); }}
                    className={`flex-1 p-2.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-xs ${batchCallIndex === 0 ? 'text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-40' : 'text-content dark:text-content-dark cursor-pointer'}`}>
                    {isRTL ? 'السابق' : 'Previous'}
                  </button>
                  <Button size="sm" className="flex-[2] justify-center" onClick={async () => {
                    if (batchCallResult) {
                      const resultLabel = { answered: isRTL?'رد':'Answered', no_answer: isRTL?'لم يرد':'No Answer', busy: isRTL?'مشغول':'Busy', switched_off: isRTL?'مغلق':'Switched Off', wrong_number: isRTL?'رقم خاطئ':'Wrong Number' }[batchCallResult] || batchCallResult;
                      const activity = { type: 'call', description: `${isRTL ? 'مكالمة' : 'Call'}: ${resultLabel}${batchCallNotes ? ' — ' + batchCallNotes : ''}`, contact_id: current.id, created_at: new Date().toISOString() };
                      try { await createActivity(activity); } catch { /* optimistic */ }
                      setBatchCallLog(prev => [...prev, { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes }]);
                    }
                    if (batchCallIndex < batchContacts.length - 1) {
                      setBatchCallIndex(i => i + 1);
                      setBatchCallNotes(''); setBatchCallResult('');
                    } else {
                      const finalLog = batchCallResult ? [...batchCallLog, { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes }] : batchCallLog;
                      toast.success(isRTL ? `تم الانتهاء من ${finalLog.length} مكالمة` : `Completed ${finalLog.length} calls`);
                      logAction({ action: 'batch_call', entity: 'contact', entityId: finalLog.map(l => l.id).join(','), description: `Batch called ${finalLog.length} contacts: ${finalLog.map(l => l.name).join(', ')}`, userName: profile?.full_name_ar || '' });
                      setBatchCallMode(false); setSelectedIds([]);
                    }
                  }}>
                    {batchCallIndex < batchContacts.length - 1 ? (<>{isRTL ? 'التالي' : 'Next'} <SkipForward size={13} /></>) : (isRTL ? 'إنهاء' : 'Finish')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Merge Preview Modal */}
      {mergePreview && (() => {
        const [c1, c2] = mergePreview.map(id => contacts.find(c => c.id === id)).filter(Boolean);
        if (!c1 || !c2) return null;
        const merged = { ...c2, ...c1 };
        if (!c1.email && c2.email) merged.email = c2.email;
        if (!c1.phone2 && c2.phone2) merged.phone2 = c2.phone2;
        if (!c1.phone2 && c2.phone !== c1.phone) merged.phone2 = c2.phone;
        if ((c2.lead_score || 0) > (c1.lead_score || 0)) merged.lead_score = c2.lead_score;
        if (!c1.company && c2.company) merged.company = c2.company;
        if (!c1.preferred_location && c2.preferred_location) merged.preferred_location = c2.preferred_location;
        const fields = ['full_name','phone','phone2','email','contact_type','source','department','temperature','company','preferred_location'];
        return (
          <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-3 sm:p-5">
            <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h3 className="m-0 text-content dark:text-content-dark text-base font-bold flex items-center gap-2"><Merge size={18} color="#1E40AF" /> {isRTL ? 'معاينة الدمج' : 'Merge Preview'}</h3>
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={18} /></button>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs min-w-[450px]">
                <thead>
                  <tr>
                    <th className={`px-2.5 py-2 text-start text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{isRTL ? 'الحقل' : 'Field'}</th>
                    <th className={`px-2.5 py-2 text-start text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{c1.full_name}</th>
                    <th className={`px-2.5 py-2 text-start text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{c2.full_name}</th>
                    <th className={`px-2.5 py-2 text-start text-emerald-500 font-semibold border-b border-edge dark:border-edge-dark`}>{isRTL ? 'النتيجة' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f} className="border-b border-edge dark:border-edge-dark">
                      <td className="px-2.5 py-2 font-semibold text-content-muted dark:text-content-muted-dark">{f}</td>
                      <td className={`px-2.5 py-2 ${merged[f] === c1[f] ? 'text-emerald-500' : 'text-content dark:text-content-dark'}`}>{c1[f] || '—'}</td>
                      <td className={`px-2.5 py-2 ${merged[f] === c2[f] && merged[f] !== c1[f] ? 'text-emerald-500' : 'text-content dark:text-content-dark'}`}>{c2[f] || '—'}</td>
                      <td className="px-2.5 py-2 font-semibold text-emerald-500">{merged[f] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex gap-2.5 mt-5 justify-end">
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <Button size="sm" onClick={() => {
                  const updatedContacts = contacts.map(c => c.id === c1.id ? { ...c, ...merged, id: c1.id } : c).filter(c => c.id !== c2.id);
                  setContacts(updatedContacts);
                  localStorage.setItem('platform_contacts', JSON.stringify(updatedContacts));
                  toast.success(isRTL ? 'تم دمج جهتي الاتصال بنجاح' : 'Contacts merged successfully');
                  setMergePreview(null); setMergeTargets([]); setMergeMode(false); setSelectedIds([]);
                }}>
                  {isRTL ? 'تأكيد الدمج' : 'Confirm Merge'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm Modal */}
      {confirmAction && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
          <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-red-500/30 dark:border-red-500/30 rounded-2xl p-7 w-full max-w-[400px] text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
            <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold">{confirmAction.title}</h3>
            <p className="m-0 mb-5 text-content-muted dark:text-content-muted-dark text-xs">{confirmAction.message}</p>
            <div className="flex gap-2.5 justify-center">
              <button onClick={() => setConfirmAction(null)} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <Button variant="danger" size="sm" onClick={confirmAction.onConfirm}>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {bulkReassignModal && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
          <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full max-w-[380px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 text-content dark:text-content-dark text-sm font-bold">{isRTL ? `إعادة تعيين (${selectedIds.length})` : `Reassign (${selectedIds.length})`}</h3>
              <button onClick={() => setBulkReassignModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-1.5">
              {[...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))].map(agent => (
                <button key={agent} onClick={() => handleBulkReassign(agent)}
                  className={`px-3.5 py-2.5 bg-gray-50 dark:bg-brand-500/[0.08] border border-edge dark:border-edge-dark rounded-lg text-content dark:text-content-dark text-xs cursor-pointer text-start hover:bg-surface-bg dark:hover:bg-brand-500/[0.15]`}>
                  {agent}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
