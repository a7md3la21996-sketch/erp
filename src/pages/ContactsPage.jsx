import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Phone, MessageCircle, Plus, Upload, Download, Search, Ban, X, Flame, Pin, PhoneCall, Merge, SkipForward, MoreVertical, Bell, FileDown, Trash2 } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact, createActivity,
} from '../services/contactsService';
import ImportModal from './crm/ImportModal';
import { PageSkeleton, Select, Input, Button } from '../components/ui';

// ── Split modules ──────────────────────────────────────────────────────────
import {
  SOURCE_LABELS, SOURCE_EN,
  TEMP, TYPE, MOCK,
  daysSince, initials, avatarColor, normalizePhone,
  Chip, ScorePill, PhoneCell,
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
  const highlightRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterTemp, setFilterTemp] = useState('all');
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [sortBy, setSortBy] = useState('last_activity');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [blacklistTarget, setBlacklistTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [logCallTarget, setLogCallTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
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

  const togglePin = (id) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('platform_pinned_contacts', JSON.stringify(next));
      return next;
    });
  };
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    const pageIds = paged.map(c => c.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  };

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (batchCallMode) { setBatchCallMode(false); return; }
      if (mergePreview) { setMergePreview(null); setMergeTargets([]); setMergeMode(false); return; }

      if (bulkReassignModal) { setBulkReassignModal(false); return; }
      if (confirmAction) { setConfirmAction(null); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [batchCallMode, mergePreview, bulkReassignModal, confirmAction]);

  const handleDelete = (id) => {
    const contact = contacts.find(c => c.id === id);
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: isRTL ? `هل أنت متأكد من حذف "${contact?.full_name || ''}"؟` : `Are you sure you want to delete "${contact?.full_name || ''}"?`,
      onConfirm: () => {
        const updated = contacts.filter(c => c.id !== id);
        setContacts(updated);
        localStorage.setItem('platform_contacts', JSON.stringify(updated));
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
        const updated = contacts.filter(c => !selectedIds.includes(c.id));
        setContacts(updated);
        localStorage.setItem('platform_contacts', JSON.stringify(updated));
        setSelectedIds([]);
        toast.success(isRTL ? `تم حذف ${selectedIds.length} جهة اتصال` : `${selectedIds.length} contacts deleted`);
        setConfirmAction(null);
      }
    });
  };


  const handleBulkReassign = (agentName) => {
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, assigned_to_name: agentName } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    toast.success(isRTL ? `تم إعادة تعيين ${selectedIds.length} جهة اتصال` : `${selectedIds.length} contacts reassigned`);
    setSelectedIds([]);
    setBulkReassignModal(false);
    setShowBulkMenu(false);
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
    const counts = { total: contacts.length, hot: 0, blacklisted: 0 };
    Object.keys(TYPE).forEach(k => { counts[k] = 0; });
    contacts.forEach(c => {
      if (c.contact_type && counts[c.contact_type] !== undefined) counts[c.contact_type]++;
      if (c.temperature === 'hot') counts.hot++;
      if (c.is_blacklisted) counts.blacklisted++;
    });
    return counts;
  }, [contacts]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (!showBlacklisted && c.is_blacklisted) return false;
      if (filterType !== 'all' && c.contact_type !== filterType) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (filterTemp !== 'all' && c.temperature !== filterTemp) return false;
      if (filterDept !== 'all' && (c.department || 'sales') !== filterDept) return false;
      if (search) {
        const q = search.toLowerCase();
        return (c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q) || c.campaign_name?.toLowerCase().includes(q));
      }
      return true;
    });
    list.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      if (sortBy === 'last_activity') return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
      if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
      if (sortBy === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'temperature') {
        const order = { hot: 0, warm: 1, cool: 2, cold: 3 };
        return (order[a.temperature] ?? 4) - (order[b.temperature] ?? 4);
      }
      if (sortBy === 'stale') {
        return new Date(a.last_activity_at || 0) - new Date(b.last_activity_at || 0);
      }
      return 0;
    });
    return list;
  }, [contacts, filterType, filterSource, filterTemp, filterDept, search, showBlacklisted, sortBy, pinnedIds]);

  useEffect(() => { setPage(1); setSelectedIds([]); }, [filterType, filterSource, filterTemp, filterDept, search, showBlacklisted, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const exportCSV = (list) => {
    const headers = isRTL ? ['ID','الاسم','الهاتف','الإيميل','النوع','المصدر','القسم','الحرارة','المنصة','الشركة','تاريخ الإنشاء'] : ['ID','Name','Phone','Email','Type','Source','Department','Temperature','Platform','Company','Created'];
    const rows = list.map(c => [c.id, c.full_name, c.phone, c.email || '', c.contact_type, c.source || '', c.department || '', c.temperature || '', c.platform || '', c.company || '', c.created_at || '']);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async (form) => {
    const newContact = {
      ...form,
      id: String(Math.max(0, ...contacts.map(c => parseInt(c.id) || 0)) + 1),
      lead_score: 0,
      temperature: 'hot',
      temperature_auto: true,
      cold_status: form.contact_type === 'cold' ? 'not_contacted' : null,
      is_blacklisted: false,
      assigned_to_name: profile?.full_name_ar || '—',
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    try {
      const saved = await createContact(form);
      const updated = [saved, ...contacts];
      setContacts(updated);
      localStorage.setItem('platform_contacts', JSON.stringify(updated));
    } catch {
      const updated = [newContact, ...contacts];
      setContacts(updated);
      localStorage.setItem('platform_contacts', JSON.stringify(updated));
    }
  };

  const handleBlacklist = async (contact, reason) => {
    try { await blacklistContact(contact.id, reason); } catch { /* optimistic */ }
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_blacklisted: true, blacklist_reason: reason } : c));
    if (selected?.id === contact.id) setSelected(null);
  };

  const thCls = `text-xs text-[#6B8DB5] font-bold uppercase tracking-wide px-3.5 py-3 bg-gray-50 dark:bg-brand-500/[0.08] border-b border-edge dark:border-edge-dark whitespace-nowrap text-start`;
  const tdCls = `px-3.5 py-3 border-b border-edge dark:border-edge-dark align-middle text-xs text-content dark:text-content-dark text-start`;

  if (loading) return <PageSkeleton hasKpis={false} tableRows={8} tableCols={7} />;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="font-['Cairo','Tajawal',sans-serif] text-content dark:text-content-dark px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Page Header */}
      <div className="mb-5 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p className="mt-1 mb-0 text-xs text-content-muted dark:text-content-muted-dark">
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${filtered.length} ${isRTL ? 'نتيجة' : 'results'}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportCSV(filtered)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
            <Download size={14} /> <span className="hidden sm:inline">{isRTL ? 'تصدير' : 'Export'}</span>
          </button>
          <button onClick={() => setShowImportModal(true)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
            <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
          </button>
          <button onClick={() => setMergeMode(m => !m)} className={`px-3.5 py-2.5 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 ${mergeMode ? 'bg-brand-800/10 border border-brand-800 text-brand-800' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
            <Merge size={14} /> {isRTL ? 'دمج' : 'Merge'}
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
        <button onClick={() => setFilterTemp(filterTemp === 'hot' ? 'all' : 'hot')} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${filterTemp === 'hot' ? 'border border-red-500 bg-red-500/[0.08] text-red-500' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
          <Flame size={11} /> {isRTL ? 'حار فقط' : 'Hot Only'} <span className={`rounded-xl px-2 py-px text-[10px] mis-1 ${filterTemp === 'hot' ? 'bg-red-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.hot}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center bg-gray-50 dark:bg-brand-500/[0.08] px-3.5 py-2.5 rounded-xl border border-edge dark:border-edge-dark">
        <div className="relative flex-[1_1_220px]">
          <Search size={14} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[#6B8DB5] dark:text-[#6B8DB5] pointer-events-none" />
          <Input placeholder={isRTL ? 'بحث بالاسم، الهاتف، الإيميل...' : 'Search by name, phone, email...'} value={searchInput} onChange={e => setSearchInput(e.target.value)}
            className="w-full pe-8" />
        </div>
        <Select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
          <option value="all">{isRTL ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
        </Select>
        <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
          <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
          <option value="cold">{isRTL ? 'كولد كول' : 'Cold Call'}</option>
          <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
          <option value="supplier">{isRTL ? 'مورد' : 'Supplier'}</option>
          <option value="developer">{isRTL ? 'مطور عقاري' : 'Developer'}</option>
          <option value="applicant">{isRTL ? 'متقدم لوظيفة' : 'Applicant'}</option>
          <option value="partner">{isRTL ? 'شريك' : 'Partner'}</option>
        </Select>
        <Select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="all">{isRTL ? 'كل الأقسام' : 'All Depts'}</option>
          <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
          <option value="hr">{isRTL ? 'HR' : 'HR'}</option>
          <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
          <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
          <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
        </Select>
        <Select value={filterTemp} onChange={e => setFilterTemp(e.target.value)}>
          <option value="all">{isRTL ? 'كل الدرجات' : 'All Temps'}</option>
          {Object.entries(TEMP).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.labelAr : v.label}</option>)}
        </Select>
        <Select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="last_activity">{isRTL ? 'ترتيب: آخر نشاط' : 'Sort: Last Activity'}</option>
          <option value="score">{isRTL ? 'ترتيب: Lead Score' : 'Sort: Lead Score'}</option>
          <option value="name">{isRTL ? 'ترتيب: الاسم' : 'Sort: Name'}</option>
          <option value="created">{isRTL ? 'ترتيب: تاريخ الإنشاء' : 'Sort: Created Date'}</option>
          <option value="temperature">{isRTL ? 'ترتيب: الحرارة' : 'Sort: Temperature'}</option>
          <option value="stale">{isRTL ? 'ترتيب: يحتاج متابعة' : 'Sort: Needs Follow-up'}</option>
        </Select>
      </div>

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
        <div className="overflow-x-auto">
          <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className={`${thCls} w-9 !px-2 !py-2.5`}><input type="checkbox" checked={paged.length > 0 && paged.every(c => selectedIds.includes(c.id))} onChange={toggleSelectAll} className="cursor-pointer" /></th>
                <th className={`${thCls} w-[50px]`}>ID</th>
                <th className={thCls}>{t('contacts.fullName')}</th>
                <th className={thCls}>{t('contacts.phone')}</th>
                <th className={thCls}>{t('contacts.type')}</th>
                <th className={thCls}>{isRTL ? 'القسم' : 'Dept'}</th>
                <th className={thCls}>{t('contacts.temperature')}</th>
                <th className={thCls}>{t('contacts.source')}</th>
                <th className={thCls}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center p-10 text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-0 border-none">
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
                return (
                <tr key={c.id}
                  onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 2 ? [...prev, c.id] : prev) : setSelected(c)}
                  className={`cursor-pointer transition-colors ${isMergeSelected ? 'bg-brand-800/[0.08]' : selectedIds.includes(c.id) ? 'bg-brand-500/[0.08]' : c.is_blacklisted ? 'bg-red-500/[0.03]' : 'hover:bg-surface-bg dark:hover:bg-brand-500/[0.06]'}`}
                >
                  <td className={`${tdCls} !px-2 !py-3`} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} className="cursor-pointer" /></td>
                  <td className={`${tdCls} text-[10px] text-[#6B8DB5] dark:text-[#6B8DB5] font-mono`}>
                    <div className="flex items-center gap-1">
                      {isPinned && <Pin size={10} color="#F59E0B" className="shrink-0" />}
                      #{String(c.id).slice(-4)}
                    </div>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-[34px] h-[34px] rounded-xl shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : avatarColor(c.id), color: c.is_blacklisted ? '#EF4444' : '#fff' }}>
                        {c.is_blacklisted ? <Ban size={14} /> : initials(c.full_name)}
                      </div>
                      <div>
                        <div className={`font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] ${c.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>{c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}</div>
                        {c.email && <div className="text-xs text-[#6B8DB5] dark:text-[#6B8DB5] whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">{c.email}</div>}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {c.last_activity_at && (() => { const d = daysSince(c.last_activity_at); return <span className={`text-[10px] font-semibold ${d === 0 ? 'text-brand-500' : d <= 3 ? 'text-[#6B8DB5]' : 'text-red-500'}`}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' أيام' : d + 'd ago')}</span>; })()}
                          {c.opportunities?.length > 0 && <span className="text-[9px] px-1.5 py-px rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">{c.opportunities.length} {isRTL ? 'فرص' : 'opps'}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={tdCls} onClick={e => e.stopPropagation()}>
                    <PhoneCell phone={c.phone} />
                    {c.phone2 && <PhoneCell phone={c.phone2} small />}
                  </td>
                  <td className={tdCls}>{TYPE[c.contact_type] ? <Chip label={isRTL ? TYPE[c.contact_type].label : TYPE[c.contact_type].labelEn} color={TYPE[c.contact_type].color} bg={TYPE[c.contact_type].bg} /> : <span className="text-content-muted dark:text-content-muted-dark">—</span>}</td>
                  <td className={tdCls}><span className="text-xs text-content-muted dark:text-content-muted-dark">{(isRTL ? { sales:'مبيعات', hr:'HR', finance:'مالية', marketing:'تسويق', operations:'عمليات' } : { sales:'Sales', hr:'HR', finance:'Finance', marketing:'Marketing', operations:'Ops' })[c.department] || '—'}</span></td>
                  <td className={tdCls}>
                    {(() => { const TempIcon = TEMP[c.temperature]?.Icon; return TempIcon ? <TempIcon size={15} color={TEMP[c.temperature]?.color} /> : '—'; })()}
                  </td>
                  <td className={tdCls}><span className="text-xs bg-gray-100 dark:bg-brand-500/[0.12] border border-edge dark:border-edge-dark rounded-md px-2 py-1 text-content-muted dark:text-content-muted-dark">{c.source ? (isRTL ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)) : '—'}</span></td>
                  <td className={tdCls} onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 items-center">
                      <a href={"tel:" + c.phone} title={isRTL ? "اتصال" : "Call"} className="w-[26px] h-[26px] flex items-center justify-center bg-emerald-500/[0.06] border border-emerald-500/20 rounded-md text-emerald-500 no-underline">
                        <Phone size={12} />
                      </a>
                      <a href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`} target="_blank" rel="noreferrer" title="WhatsApp" className="w-[26px] h-[26px] flex items-center justify-center bg-[#25D366]/[0.06] border border-[#25D366]/20 rounded-md text-[#25D366] no-underline">
                        <MessageCircle size={12} />
                      </a>
                      <button onClick={() => setLogCallTarget(c)} title={isRTL ? 'تسجيل مكالمة' : 'Log Call'} className="w-[26px] h-[26px] flex items-center justify-center bg-brand-500/[0.06] border border-brand-500/20 rounded-md text-brand-500 cursor-pointer">
                        <PhoneCall size={12} />
                      </button>
                      <button onClick={() => setReminderTarget(c)} title={isRTL ? 'تذكير' : 'Reminder'} className="w-[26px] h-[26px] flex items-center justify-center bg-amber-500/[0.06] border border-amber-500/20 rounded-md text-amber-500 cursor-pointer">
                        <Bell size={12} />
                      </button>
                      <button onClick={() => togglePin(c.id)} title={isRTL ? 'تثبيت' : 'Pin'} className={`w-[26px] h-[26px] flex items-center justify-center rounded-md cursor-pointer ${isPinned ? 'bg-amber-500/[0.12] border border-amber-500/30 text-amber-500' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                        <Pin size={12} />
                      </button>
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className={`w-[26px] h-[26px] flex items-center justify-center rounded-md cursor-pointer ${openMenuId === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                          <MoreVertical size={12} />
                        </button>
                        {openMenuId === c.id && (
                          <div className={`absolute top-[30px] end-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[180px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.12)] overflow-hidden`}>
                            <div className="p-1">
                              <button onClick={() => { const hdr = isRTL ? ['الاسم','الهاتف','النوع','المصدر','الميزانية'] : ['Name','Phone','Type','Source','Budget']; const data = [hdr,[c.full_name,c.phone,c.contact_type,c.source,(c.budget_min||'')+'–'+(c.budget_max||'')]]; const csv = '\uFEFF'+data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <FileDown size={13} /> {isRTL ? 'تصدير' : 'Export'}
                              </button>
                              <button onClick={() => { handleDelete(c.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                            {!c.is_blacklisted && (<><div className="h-px bg-edge dark:bg-edge-dark" /><div className="p-1">
                              <button onClick={() => { setBlacklistTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
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
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${page === 1 ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}>
              {isRTL ? 'السابق →' : '← Prev'}
            </button>
            <span className="text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? `${page} من ${totalPages}` : `${page} of ${totalPages}`}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${page === totalPages ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}>
              {isRTL ? '← التالي' : 'Next →'}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const np = normalizePhone(phone); const found = contacts.find(c => normalizePhone(c.phone) === np || normalizePhone(c.phone2) === np || (c.extra_phones || []).some(p => normalizePhone(p) === np)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => setSelected(null)} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => { setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); localStorage.setItem('platform_contacts', JSON.stringify(next)); return next; }); setSelected(updated); updateContact(updated.id, updated).catch(() => { /* optimistic */ }) }} onAddOpportunity={() => {}} />}
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
          <div className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-5">
            <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[20px] w-full max-w-[520px] overflow-hidden">
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
                    <Chip label={isRTL ? TYPE[current.contact_type]?.label : TYPE[current.contact_type]?.labelEn} color={TYPE[current.contact_type]?.color} bg={TYPE[current.contact_type]?.bg} />
                  </div>
                </div>
                <a href={"tel:" + current.phone} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#065F46] to-emerald-500 rounded-xl text-white font-bold text-sm no-underline mb-4">
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
          <div className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
            <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full max-w-[600px] max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h3 className="m-0 text-content dark:text-content-dark text-base font-bold flex items-center gap-2"><Merge size={18} color="#1E40AF" /> {isRTL ? 'معاينة الدمج' : 'Merge Preview'}</h3>
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={18} /></button>
              </div>
              <table className="w-full border-collapse text-xs">
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
