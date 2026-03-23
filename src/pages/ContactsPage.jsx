import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { Plus, Upload, Download, Ban } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact, createActivity,
} from '../services/contactsService';
import { logAction } from '../services/auditService';
import { bulkSend } from '../services/smsTemplateService';
import { createNotification } from '../services/notificationsService';
import { setFieldValues as setCFValues } from '../services/customFieldsService';
import { fetchCampaigns, createCampaign } from '../services/marketingService';
import { notifyLeadAssigned } from '../services/notificationsService';
import { evaluateTriggers } from '../services/triggerService';
import ImportModal from './crm/ImportModal';
import { PageSkeleton, Button, SmartFilter, applySmartFilters } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import useCrmPermissions from '../hooks/useCrmPermissions';

import { SOURCE_LABELS, SOURCE_EN, TYPE, MOCK, normalizePhone, COUNTRY_CODES } from './crm/contacts/constants';
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
  const [campaignsList, setCampaignsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [filterType, setFilterType] = useState(searchParams.get('type') || 'all');
  const [showBlacklisted, setShowBlacklisted] = useState(searchParams.get('blacklist') === 'true');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'created');
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(25);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filterType !== 'all') params.set('type', filterType);
    if (showBlacklisted) params.set('blacklist', 'true');
    if (sortBy !== 'created') params.set('sort', sortBy);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [search, filterType, showBlacklisted, sortBy, page, setSearchParams]);
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
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [bulkReassignModal, setBulkReassignModal] = useState(false);
  const [bulkDropdownOpen, setBulkDropdownOpen] = useState(null);
  const [bulkSMSModal, setBulkSMSModal] = useState(false);
  const [bulkSMSState, setBulkSMSState] = useState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] });
  const [pinnedIds, setPinnedIds] = useState(() => { try { return JSON.parse(localStorage.getItem('platform_pinned_contacts') || '[]'); } catch { return []; } });
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
  const { auditFields, applyAuditFilters } = useAuditFilter('contact');
  const { activityResults: configResults, contactsSettings } = useSystemConfig();
  const MERGE_LIMIT = contactsSettings?.mergeLimit || 2;
  const MAX_PINS = contactsSettings?.maxPins || 5;

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
    const idsToUpdate = [...selectedIds];
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, assigned_to_name: agentName, assigned_by_name: assignedByName } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    logAction({ action: 'bulk_reassign', entity: 'contact', entityId: selectedIds.join(','), description: `Reassigned ${selectedIds.length} contacts to ${agentName}: ${names}`, newValue: agentName, userName: profile?.full_name_ar });
    updated.filter(c => selectedIds.includes(c.id)).forEach(c => {
      notifyLeadAssigned({ contactName: c.full_name || c.phone || '—', agentId: agentName, agentName, assignedBy: assignedByName });
    });
    toast.success(isRTL ? `تم إعادة تعيين ${selectedIds.length} جهة اتصال` : `${selectedIds.length} contacts reassigned`);
    setSelectedIds([]);
    setBulkReassignModal(false);
    setShowBulkMenu(false);
    Promise.all(idsToUpdate.map(id => updateContact(id, { assigned_to_name: agentName, assigned_by_name: assignedByName }).catch(() => {}))).catch(() => {});
  };

  const handleBulkChangeField = async (field, value, actionLabel) => {
    const count = selectedIds.length;
    const names = contacts.filter(c => selectedIds.includes(c.id)).map(c => c.full_name).join(', ');
    const idsToUpdate = [...selectedIds];
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, [field]: value } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    logAction({ action: `bulk_${field}_change`, entity: 'contact', entityId: selectedIds.join(','), description: `Bulk changed ${field} to "${value}" for ${count} contacts: ${names}`, newValue: value, userName: profile?.full_name_ar });
    createNotification({ type: 'system', title_en: `Bulk ${actionLabel}`, title_ar: `تغيير جماعي — ${actionLabel}`, body_en: `Changed ${field} to "${value}" for ${count} contacts`, body_ar: `تم تغيير ${field} إلى "${value}" لـ ${count} جهة اتصال`, for_user_id: 'all' });
    toast.success(isRTL ? `تم تحديث ${count} جهة اتصال` : `${count} contacts updated`);
    setSelectedIds([]);
    setBulkDropdownOpen(null);
    setShowBulkMenu(false);
    Promise.all(idsToUpdate.map(id => updateContact(id, { [field]: value }).catch(() => {}))).catch(() => {});
  };

  const handleBulkSMS = async () => {
    const { templateId, lang } = bulkSMSState;
    if (!templateId) return;
    const smsContacts = contacts.filter(c => selectedIds.includes(c.id) && c.phone);
    setBulkSMSState(s => ({ ...s, sending: true, total: smsContacts.length, progress: 0 }));
    const results = bulkSend(templateId, smsContacts, lang);
    setBulkSMSState(s => ({ ...s, sending: false, progress: smsContacts.length, done: true, results }));
    logAction({ action: 'bulk_sms', entity: 'contact', entityId: selectedIds.join(','), description: `Bulk SMS sent to ${results.length} contacts`, userName: profile?.full_name_ar });
    createNotification({ type: 'system', title_en: 'Bulk SMS Sent', title_ar: 'تم إرسال رسائل جماعية', body_en: `Sent SMS to ${results.length} contacts`, body_ar: `تم إرسال رسائل لـ ${results.length} جهة اتصال`, for_user_id: 'all' });
    toast.success(isRTL ? `تم إرسال ${results.length} رسالة` : `${results.length} messages sent`);
  };

  const exportSelectedCSV = () => {
    const list = contacts.filter(c => selectedIds.includes(c.id));
    exportCSVList(list);
    toast.success(isRTL ? `تم تصدير ${list.length} جهة اتصال` : `${list.length} contacts exported`);
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
    { value: 'contacted', label: isRTL ? 'تم التواصل' : 'Contacted' },
    { value: 'qualified', label: isRTL ? 'مؤهل' : 'Qualified' },
    { value: 'negotiation', label: isRTL ? 'تفاوض' : 'Negotiation' },
    { value: 'won', label: isRTL ? 'تم الإغلاق' : 'Won' },
    { value: 'lost', label: isRTL ? 'خسارة' : 'Lost' },
    { value: 'disqualified', label: isRTL ? 'غير مؤهل' : 'Disqualified' },
  ];
  const DQ_REASONS = [
    { value: 'resale', label: isRTL ? 'عايز يبيع وحدته' : 'Wants to sell unit' },
    { value: 'not_interested', label: isRTL ? 'غير مهتم' : 'Not interested' },
    { value: 'no_budget', label: isRTL ? 'ميزانية غير مناسبة' : 'No budget' },
    { value: 'wrong_audience', label: isRTL ? 'جمهور خاطئ' : 'Wrong audience' },
    { value: 'duplicate', label: isRTL ? 'مكرر' : 'Duplicate' },
    { value: 'other', label: isRTL ? 'سبب آخر' : 'Other' },
  ];

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
    fetchCampaigns().then(c => setCampaignsList(c)).catch(() => {});
  }, [profile]);

  // Handle highlight query param
  useEffect(() => {
    if (!highlightId || loading || !contacts.length) return;
    const contact = contacts.find(c => String(c.id) === String(highlightId));
    if (contact) {
      setSelected(contact);
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
    }
  }, [highlightId, loading, contacts]);

  // Stats
  const stats = useMemo(() => {
    const counts = { total: contacts.length, blacklisted: 0, disqualified: 0 };
    Object.keys(TYPE).forEach(k => { counts[k] = 0; });
    contacts.forEach(c => {
      if (c.contact_type && counts[c.contact_type] !== undefined) counts[c.contact_type]++;
      if (c.is_blacklisted) counts.blacklisted++;
      if (c.contact_status === 'disqualified') counts.disqualified++;
    });
    return counts;
  }, [contacts]);

  // Smart filter field definitions
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
    { id: 'prefix', label: 'اللقب', labelEn: 'Prefix', type: 'select', options: [
      { value: 'Mr.', label: 'Mr.', labelEn: 'Mr.' },
      { value: 'Mrs.', label: 'Mrs.', labelEn: 'Mrs.' },
      { value: 'Dr.', label: 'Dr.', labelEn: 'Dr.' },
      { value: 'Eng.', label: 'Eng.', labelEn: 'Eng.' },
      { value: 'أستاذ', label: 'أستاذ', labelEn: 'Prof.' },
    ]},
    { id: 'contact_type', label: 'النوع', labelEn: 'Type', type: 'select', options: [
      { value: 'lead', label: 'ليد', labelEn: 'Lead' },
      { value: 'cold', label: 'كولد', labelEn: 'Cold' },
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
    { id: 'created_by_name', label: 'أنشأه', labelEn: 'Created By', type: 'select', options: [...new Set(contacts.map(c => c.created_by_name).filter(Boolean))].map(n => ({ value: n, label: n, labelEn: n })) },
    { id: '_campaign_count', label: 'عدد الحملات', labelEn: 'Campaign Count', type: 'number' },
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
    list = list.map(c => ({
      ...c,
      _country: c._country || detectCountry(c.phone),
      _campaign_count: (c.campaign_interactions || []).length,
    }));
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
      if (sortBy === 'stale') return new Date(a.last_activity_at || 0) - new Date(b.last_activity_at || 0);
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

  const exportCSV = (list) => { exportCSVList(list); };

  const handleSave = async (form) => {
    const matchedCampaign = form.campaign_name ? campaignsList.find(c => c.name_en?.toLowerCase() === form.campaign_name.toLowerCase() || c.name_ar?.toLowerCase() === form.campaign_name.toLowerCase()) : null;
    const campaign_interactions = form.campaign_name
      ? [{ campaign: form.campaign_name, campaign_id: matchedCampaign?.id || null, source: form.source, platform: form.platform, date: new Date().toISOString() }]
      : [];
    const newContact = {
      ...form,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lead_score: 0,
      temperature: 'hot',
      temperature_auto: true,
      cold_status: form.contact_type === 'cold' ? 'not_contacted' : null,
      is_blacklisted: false,
      assigned_to_name: profile?.full_name_ar || '—',
      assigned_by_name: profile?.full_name_ar || '—',
      created_by: profile?.id || null,
      created_by_name: profile?.full_name_ar || profile?.full_name_en || '—',
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
    setContacts(prev => {
      const next = prev.map(c => c.id === contact.id ? { ...c, is_blacklisted: true, blacklist_reason: reason } : c);
      localStorage.setItem('platform_contacts', JSON.stringify(next));
      return next;
    });
    if (selected?.id === contact.id) setSelected(null);
    blacklistContact(contact.id, reason).catch(() => {});
    logAction({ action: 'blacklist', entity: 'contact', entityId: contact.id, entityName: contact.full_name, description: `Blacklisted: ${contact.full_name} — ${reason}`, newValue: reason, userName: profile?.full_name_ar });
    toast.success(isRTL ? 'تم إضافة للقائمة السوداء' : 'Contact blacklisted');
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
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p className="mt-1 mb-0 text-xs text-content-muted dark:text-content-muted-dark">
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${filtered.length} ${isRTL ? 'نتيجة' : (filtered.length === 1 ? 'result' : 'results')}`}
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
            <Plus size={14} /> {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
          </Button>
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
        setBlacklistTarget={setBlacklistTarget}
        setDisqualifyModal={setDisqualifyModal}
        setDqReason={setDqReason}
        setDqNote={setDqNote}
        handleDelete={handleDelete}
        setMergePreview={setMergePreview}
        perms={perms}
        tdCls={tdCls}
        safePage={safePage}
        totalPages={totalPages}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        isRTL={isRTL}
      />

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
      {showAddModal && <AddContactModal campaigns={campaignsList} onCreateCampaign={async (data) => { const created = await createCampaign(data); setCampaignsList(prev => [created, ...prev]); }} onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const np = normalizePhone(phone); const found = contacts.find(c => normalizePhone(c.phone) === np || normalizePhone(c.phone2) === np || (c.extra_phones || []).some(p => normalizePhone(p) === np)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} onAddInteraction={(contact, interaction) => {
        const existing = contact.campaign_interactions || [];
        const updatedContact = { ...contact, campaign_interactions: [...existing, interaction] };
        setContacts(prev => {
          const next = prev.map(c => c.id === contact.id ? updatedContact : c);
          localStorage.setItem('platform_contacts', JSON.stringify(next));
          return next;
        });
        updateContact(contact.id, { campaign_interactions: updatedContact.campaign_interactions }).catch(() => {});
      }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => { setSelected(null); setOpenWithAction(false); }} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => { const old = contacts.find(c => c.id === updated.id); setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); localStorage.setItem('platform_contacts', JSON.stringify(next)); return next; }); setSelected(updated); updateContact(updated.id, updated).catch(() => {}); const changedFields = old ? Object.keys(updated).filter(k => JSON.stringify(old[k]) !== JSON.stringify(updated[k]) && !['updated_at'].includes(k)) : []; const desc = changedFields.length ? changedFields.map(k => `${k}: "${old?.[k] || ''}" → "${updated[k] || ''}"`).join(', ') : `Updated contact: ${updated.full_name}`; logAction({ action: 'update', entity: 'contact', entityId: updated.id, entityName: updated.full_name, description: desc, oldValue: old || null, newValue: updated, userName: profile?.full_name_ar || '' }).catch(() => {}) }} initialAction={openWithAction} onPrev={handlePrev} onNext={handleNext} onPin={togglePin} isPinned={pinnedIds.includes(selected.id)} onLogCall={c => { setLogCallTarget(c); }} onReminder={c => { setReminderTarget(c); }} onDelete={id => { handleDelete(id); setSelected(null); }} />}
      {logCallTarget && <LogCallModal contact={logCallTarget} onClose={() => setLogCallTarget(null)} />}
      {reminderTarget && <QuickTaskModal contact={reminderTarget} onClose={() => setReminderTarget(null)} />}
      {blacklistTarget && <BlacklistModal contact={blacklistTarget} onClose={() => setBlacklistTarget(null)} onConfirm={handleBlacklist} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} existingContacts={contacts} onImportDone={(newContacts) => { setContacts(prev => { const updated = [...prev, ...newContacts]; localStorage.setItem('platform_contacts', JSON.stringify(updated)); return updated; }); setShowImportModal(false); }} />}

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
