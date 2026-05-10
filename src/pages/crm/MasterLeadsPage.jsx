// Master Leads — admin-only view that groups contacts by phone so the
// sales admin can see, for any number, every copy that exists in the
// system (origin + clones), who currently owns each, and the lifecycle
// status of each. Powers redistribution decisions.
//
// Backed by master_leads_list / master_leads_count RPCs.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Search, Users, Phone, ChevronDown, ChevronRight, Calendar, AlertTriangle, Share2, ArrowRightLeft, Trash2, MoreVertical, X } from 'lucide-react';
import { fetchMasterLeads } from '../../services/masterLeadsService';
import { fetchSalesAgents } from '../../services/opportunitiesService';
import DistributeLeadModal from './contacts/DistributeLeadModal';
import HandOffLeadModal from './contacts/HandOffLeadModal';
import BulkDistributeMasterModal from './BulkDistributeMasterModal';
import { deleteContact } from '../../services/contactsService';
import supabase from '../../lib/supabase';
import { PhoneCell } from './contacts/constants';

const STATUS_COLORS = {
  new:             '#4A7AAB',
  contacted:       '#F59E0B',
  following:       '#10B981',
  has_opportunity: '#059669',
  disqualified:    '#EF4444',
};
const STATUS_LABELS = {
  new:             { ar: 'جديد',       en: 'New' },
  contacted:       { ar: 'تم التواصل', en: 'Contacted' },
  following:       { ar: 'متابعة',     en: 'Following' },
  has_opportunity: { ar: 'لديه فرصة',  en: 'Has Opp' },
  disqualified:    { ar: 'غير مؤهل',   en: 'DQ' },
};

function formatDate(dateStr, isRTL) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function MasterLeadsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minClones, setMinClones] = useState(1);
  const [ownerId, setOwnerId] = useState('');

  const [agents, setAgents] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  // Action modals — operate on a single contact picked from the family.
  // Distribute uses the family's first/origin copy as the source of truth
  // for cloning. Handoff/delete operate on the specific clone the user picks.
  const [distributeContact, setDistributeContact] = useState(null);
  const [handoffContact, setHandoffContact] = useState(null);
  // Bulk selection — Set of phone strings (one per family)
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [bulkDistributeOpen, setBulkDistributeOpen] = useState(false);
  // Delete is gated behind: kebab menu → confirm modal that requires
  // explicit click. The previous inline Trash icon was one accidental
  // click away from soft-deleting a copy — too risky next to two
  // similar-looking action buttons.
  const [openMenuFor, setOpenMenuFor] = useState(null); // copy id whose menu is open
  const [deleteConfirm, setDeleteConfirm] = useState(null); // copy object pending confirm

  const togglePhoneSelected = (phone, e) => {
    if (e) e.stopPropagation();
    setSelectedPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });
  };
  const toggleSelectAllOnPage = () => {
    setSelectedPhones(prev => {
      const all = rows.every(r => prev.has(r.phone));
      if (all) {
        const next = new Set(prev);
        rows.forEach(r => next.delete(r.phone));
        return next;
      }
      const next = new Set(prev);
      rows.forEach(r => next.add(r.phone));
      return next;
    });
  };
  const clearSelection = () => setSelectedPhones(new Set());
  const selectedFamilies = rows.filter(r => selectedPhones.has(r.phone));

  // Fetches a single full contact row (the modals expect the complete record,
  // but our list only carries the slim copy projection). Cheap one-row read.
  const fetchFullContact = async (id) => {
    try {
      const { data, error } = await supabase.from('contacts').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    } catch (err) {
      toast.error(isRTL ? 'تعذر تحميل بيانات العميل' : 'Could not load contact');
      return null;
    }
  };

  const handleDistribute = async (copyId) => {
    const c = await fetchFullContact(copyId);
    if (c) setDistributeContact(c);
  };

  const handleHandoff = async (copyId) => {
    const c = await fetchFullContact(copyId);
    if (c) setHandoffContact(c);
  };

  const handleSoftDelete = async (copy) => {
    try {
      await deleteContact(copy.id);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error((isRTL ? 'فشل الحذف: ' : 'Delete failed: ') + (err?.message || ''));
    }
  };

  const isAdmin = profile?.role === 'admin';

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load agent list once
  useEffect(() => {
    fetchSalesAgents().then(list => {
      setAgents((list || [])
        .filter(a => a.id && (a.full_name_en || a.full_name_ar))
        .map(a => ({ id: a.id, name: a.full_name_en || a.full_name_ar }))
        .sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { rows: r, total: t, error } = await fetchMasterLeads({
        search: debouncedSearch || null,
        minClones,
        ownerId: ownerId || null,
        page,
        pageSize,
      });
      if (error) {
        toast.error(isRTL ? 'فشل تحميل البيانات' : 'Failed to load data');
      }
      setRows(r);
      setTotal(t);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, debouncedSearch, minClones, ownerId, page, pageSize, isRTL, toast]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, minClones, ownerId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleExpand = (phone) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <AlertTriangle size={48} className="text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-content dark:text-content-dark">
            {isRTL ? 'هذه الصفحة مخصصة للأدمن فقط' : 'Admin only'}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-content dark:text-content-dark m-0 mb-1">
          {isRTL ? 'Master Leads' : 'Master Leads'}
        </h1>
        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
          {isRTL
            ? 'كل رقم تليفون مع كل النسخ المرتبطة به والسيلز اللي عندهم نسخة. يساعدك تقرر أين توزع وأين تسحب.'
            : 'Every phone number with all the copies linked to it and the agents currently holding each. Helps you decide where to distribute or pull from.'}
        </p>
      </div>

      {/* Filters bar */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-3 mb-4 flex flex-col sm:flex-row gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-content-muted dark:text-content-muted-dark`} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث بالاسم أو التليفون...' : 'Search by name or phone...'}
            className={`w-full ${isRTL ? 'pe-3 ps-9' : 'ps-9 pe-3'} py-2 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark outline-none focus:border-brand-500`}
          />
        </div>
        {/* Min clones */}
        <select
          value={minClones}
          onChange={e => setMinClones(Number(e.target.value))}
          className="px-3 py-2 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark outline-none cursor-pointer"
        >
          <option value={1}>{isRTL ? 'كل النسخ' : 'All families'}</option>
          <option value={2}>{isRTL ? '2 نسخ أو أكتر' : '2+ copies'}</option>
          <option value={3}>{isRTL ? '3 نسخ أو أكتر' : '3+ copies'}</option>
          <option value={4}>{isRTL ? '4 نسخ أو أكتر' : '4+ copies'}</option>
        </select>
        {/* Owner */}
        <select
          value={ownerId}
          onChange={e => setOwnerId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark outline-none cursor-pointer min-w-[180px]"
        >
          <option value="">{isRTL ? 'كل السيلز' : 'Any owner'}</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {/* Total */}
        <div className="flex items-center px-3 text-xs text-content-muted dark:text-content-muted-dark">
          {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${total.toLocaleString()} ${isRTL ? 'عيلة' : 'families'}`}
        </div>
      </div>

      {/* List */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[32px_2fr_1.5fr_0.7fr_1fr_1fr_30px] gap-3 px-4 py-2.5 bg-surface-bg/40 dark:bg-surface-bg-dark/40 border-b border-edge dark:border-edge-dark text-[11px] font-semibold text-content-muted dark:text-content-muted-dark uppercase">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={rows.length > 0 && rows.every(r => selectedPhones.has(r.phone))}
              ref={el => { if (el) el.indeterminate = !rows.every(r => selectedPhones.has(r.phone)) && rows.some(r => selectedPhones.has(r.phone)); }}
              onChange={toggleSelectAllOnPage}
              className="w-4 h-4 cursor-pointer accent-brand-500"
              title={isRTL ? 'تحديد الكل' : 'Select all on page'}
            />
          </div>
          <div>{isRTL ? 'الاسم' : 'Name'}</div>
          <div>{isRTL ? 'التليفون' : 'Phone'}</div>
          <div className="text-center">{isRTL ? 'النسخ' : 'Copies'}</div>
          <div>{isRTL ? 'أول إنشاء' : 'First Created'}</div>
          <div>{isRTL ? 'آخر نشاط' : 'Last Activity'}</div>
          <div></div>
        </div>

        {/* Rows */}
        {!loading && rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'لا يوجد نتائج' : 'No results'}
          </div>
        ) : rows.map(family => {
          const isOpen = expanded.has(family.phone);
          const copies = Array.isArray(family.copies) ? family.copies : [];
          const lastActDays = daysSince(family.last_activity_at);
          // Highlight: family with multiple "active" copies (working conflict)
          const activeCopies = copies.filter(c => c.status !== 'disqualified');
          const hasConflict = activeCopies.length > 1;

          return (
            <div key={family.phone} className="border-b border-edge/40 dark:border-edge-dark/40 last:border-b-0">
              {/* Header row — clickable to expand */}
              <button
                onClick={() => toggleExpand(family.phone)}
                className="w-full grid grid-cols-[32px_2fr_1.5fr_0.7fr_1fr_1fr_30px] gap-3 px-4 py-3 items-center text-start bg-transparent border-none cursor-pointer hover:bg-brand-500/[0.04] dark:hover:bg-brand-500/[0.06] transition-colors"
              >
                <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedPhones.has(family.phone)}
                    onChange={(e) => togglePhoneSelected(family.phone, e)}
                    className="w-4 h-4 cursor-pointer accent-brand-500"
                  />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  {hasConflict && (
                    <span title={isRTL ? 'تعارض: نسخ متعددة شغّالة' : 'Conflict: multiple active copies'}>
                      <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                    </span>
                  )}
                  <span className="text-sm font-semibold text-content dark:text-content-dark truncate">
                    {family.primary_name || (isRTL ? 'بدون اسم' : 'No name')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-muted-dark" onClick={e => e.stopPropagation()}>
                  <Phone size={11} className="shrink-0" />
                  <PhoneCell phone={family.phone} />
                </div>
                <div className="text-center">
                  <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-[11px] font-bold ${family.family_count > 1 ? 'bg-blue-500/15 text-blue-500' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                    {family.family_count}
                  </span>
                </div>
                <div className="text-xs text-content-muted dark:text-content-muted-dark flex items-center gap-1">
                  <Calendar size={11} /> {formatDate(family.first_created_at, isRTL)}
                </div>
                <div className={`text-xs ${lastActDays != null && lastActDays > 30 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                  {family.last_activity_at
                    ? (lastActDays === 0
                        ? (isRTL ? 'اليوم' : 'today')
                        : (isRTL ? `من ${lastActDays} يوم` : `${lastActDays}d ago`))
                    : '—'}
                </div>
                <div className="flex justify-center">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />}
                </div>
              </button>

              {/* Expanded copies */}
              {isOpen && (
                <div className="px-4 pb-4 bg-surface-bg/30 dark:bg-surface-bg-dark/30">
                  <div className="rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
                    <div className="grid grid-cols-[40px_1.6fr_1.2fr_0.9fr_0.9fr_1.2fr_120px] gap-2 px-3 py-2 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark text-[10px] font-semibold text-content-muted dark:text-content-muted-dark uppercase">
                      <div>#</div>
                      <div>{isRTL ? 'المالك الحالي' : 'Current Owner'}</div>
                      <div>{isRTL ? 'الحالة' : 'Status'}</div>
                      <div>{isRTL ? 'تاريخ النسخة' : 'Copy Date'}</div>
                      <div>{isRTL ? 'آخر نشاط' : 'Last Act'}</div>
                      <div>{isRTL ? 'أنشأها' : 'Created By'}</div>
                      <div className="text-center">{isRTL ? 'إجراءات' : 'Actions'}</div>
                    </div>
                    {copies.map((c, i) => {
                      const status = c.status || 'new';
                      const color = STATUS_COLORS[status] || '#6b7280';
                      const cDays = daysSince(c.last_activity_at);
                      return (
                        <div key={c.id} className="grid grid-cols-[40px_1.6fr_1.2fr_0.9fr_0.9fr_1.2fr_120px] gap-2 px-3 py-2 items-center border-b border-edge/40 dark:border-edge-dark/40 last:border-b-0 text-xs">
                          <div className="text-content-muted dark:text-content-muted-dark font-mono">
                            {i === 0 ? (isRTL ? 'أصلية' : 'orig') : `#${i + 1}`}
                          </div>
                          <div className="text-content dark:text-content-dark font-medium truncate">
                            {c.owner_name || (isRTL ? 'غير معين' : 'Unassigned')}
                          </div>
                          <div>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ background: color + '1A', color }}
                            >
                              {isRTL ? STATUS_LABELS[status]?.ar : STATUS_LABELS[status]?.en}
                            </span>
                            {c.dq_reason && status === 'disqualified' && (
                              <span className="ms-1 text-[10px] text-content-muted dark:text-content-muted-dark">({c.dq_reason})</span>
                            )}
                          </div>
                          <div className="text-content-muted dark:text-content-muted-dark">
                            {formatDate(c.created_at, isRTL)}
                          </div>
                          <div className={cDays != null && cDays > 30 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}>
                            {c.last_activity_at
                              ? (cDays === 0 ? (isRTL ? 'اليوم' : 'today') : `${cDays}${isRTL ? ' يوم' : 'd'}`)
                              : '—'}
                          </div>
                          <div className="text-content-muted dark:text-content-muted-dark truncate">
                            {c.created_by_name || '—'}
                          </div>
                          <div className="flex items-center justify-center gap-1 relative">
                            <button
                              onClick={() => handleDistribute(c.id)}
                              title={isRTL ? 'وزع نسخ إضافية' : 'Distribute (clone to more agents)'}
                              className="w-7 h-7 rounded-md border border-edge dark:border-edge-dark bg-transparent hover:bg-emerald-500/10 hover:border-emerald-500/30 flex items-center justify-center cursor-pointer text-emerald-500"
                            >
                              <Share2 size={12} />
                            </button>
                            <button
                              onClick={() => handleHandoff(c.id)}
                              title={isRTL ? 'انقل لسيلز آخر' : 'Hand off (move to another agent)'}
                              className="w-7 h-7 rounded-md border border-edge dark:border-edge-dark bg-transparent hover:bg-blue-500/10 hover:border-blue-500/30 flex items-center justify-center cursor-pointer text-blue-500"
                            >
                              <ArrowRightLeft size={12} />
                            </button>
                            <button
                              onClick={() => setOpenMenuFor(prev => prev === c.id ? null : c.id)}
                              title={isRTL ? 'المزيد' : 'More'}
                              className="w-7 h-7 rounded-md border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-500/10 hover:border-brand-500/30 flex items-center justify-center cursor-pointer text-content-muted dark:text-content-muted-dark"
                            >
                              <MoreVertical size={12} />
                            </button>
                            {openMenuFor === c.id && (
                              <>
                                {/* backdrop closes the menu when clicking outside */}
                                <div className="fixed inset-0 z-[60]" onClick={() => setOpenMenuFor(null)} />
                                <div className={`absolute top-full mt-1 ${isRTL ? 'left-0' : 'right-0'} z-[61] min-w-[160px] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg shadow-lg overflow-hidden`}>
                                  <button
                                    onClick={() => { setOpenMenuFor(null); setDeleteConfirm(c); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-none bg-transparent text-start text-red-500 hover:bg-red-500/10 font-semibold"
                                  >
                                    <Trash2 size={12} />
                                    {isRTL ? 'احذف هذه النسخة' : 'Delete this copy'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="px-4 py-12 text-center text-sm text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'جاري التحميل...' : 'Loading...'}
          </div>
        )}
      </div>

      {/* Bulk action bar — sticky bottom when families are selected */}
      {selectedPhones.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-[300] px-5 py-3 flex items-center gap-3 flex-wrap
                        bg-gradient-to-br from-[#0a1929] to-[#132337] border-t border-brand-500/30
                        shadow-[0_-4px_20px_rgba(0,0,0,0.3)]" dir={isRTL ? 'rtl' : 'ltr'}>
          <span className="text-sm font-bold text-slate-200">
            {isRTL ? `${selectedPhones.size} عيلة محددة` : `${selectedPhones.size} families selected`}
          </span>
          <button
            onClick={clearSelection}
            className="px-2.5 py-1 rounded-md border border-slate-400/30 bg-transparent text-slate-400 text-[11px] cursor-pointer hover:border-slate-300/50"
          >
            {isRTL ? 'إلغاء' : 'Clear'}
          </button>
          <div className="w-px h-6 bg-slate-400/20" />
          <button
            onClick={() => setBulkDistributeOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
          >
            <Share2 size={13} /> {isRTL ? 'وزع للسيلز' : 'Distribute to agents'}
          </button>
        </div>
      )}

      {/* Action modals */}
      {distributeContact && (
        <DistributeLeadModal
          contact={distributeContact}
          onClose={() => setDistributeContact(null)}
          onSuccess={() => { setDistributeContact(null); load(); }}
        />
      )}
      {handoffContact && (
        <HandOffLeadModal
          contact={handoffContact}
          onClose={() => setHandoffContact(null)}
          onSuccess={() => { setHandoffContact(null); load(); }}
        />
      )}
      {bulkDistributeOpen && (
        <BulkDistributeMasterModal
          families={selectedFamilies}
          onClose={() => setBulkDistributeOpen(false)}
          onSuccess={() => { setBulkDistributeOpen(false); clearSelection(); load(); }}
        />
      )}

      {/* Delete-copy confirm modal — explicit two-step confirmation
          (open menu → click delete → confirm in modal). Replaces the
          earlier inline Trash button that was misclick-prone. */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[1300] flex items-center justify-center p-5" dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface-card dark:bg-surface-card-dark rounded-2xl w-full max-w-[440px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-edge dark:border-edge-dark flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center">
                  <Trash2 size={14} className="text-red-500" />
                </div>
                <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {isRTL ? 'حذف نسخة من الليد' : 'Delete lead copy'}
                </h3>
              </div>
              <button onClick={() => setDeleteConfirm(null)} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="m-0 text-sm text-content dark:text-content-dark leading-relaxed">
                {isRTL
                  ? `أنت بتحذف نسخة العميل "${deleteConfirm.full_name || '—'}" اللي عند ${deleteConfirm.owner_name || (isRTL ? 'غير معين' : 'unassigned')}.`
                  : `You are deleting the copy of "${deleteConfirm.full_name || '—'}" assigned to ${deleteConfirm.owner_name || 'unassigned'}.`}
              </p>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL
                  ? 'الباقي من نسخ نفس الرقم عند سيلز آخرين هتفضل زي ما هي. الحذف soft — يمكن استرجاعه.'
                  : 'Other copies of this phone at other agents stay untouched. This is a soft delete — it can be restored.'}
              </p>
            </div>
            <div className="px-5 py-3 bg-surface-bg/40 dark:bg-surface-bg-dark/40 border-t border-edge dark:border-edge-dark flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark text-xs font-semibold cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleSoftDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg border-none bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={12} /> {isRTL ? 'احذف النسخة' : 'Delete copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className={`px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-500/10'}`}
          >
            {isRTL ? 'السابق' : 'Previous'}
          </button>
          <span className="text-content-muted dark:text-content-muted-dark">
            {isRTL ? `الصفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className={`px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark ${page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-500/10'}`}
          >
            {isRTL ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
