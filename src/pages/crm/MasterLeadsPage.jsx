// Master Leads — admin-only view that groups contacts by phone so the
// sales admin can see, for any number, every copy that exists in the
// system (origin + clones), who currently owns each, and the lifecycle
// status of each. Powers redistribution decisions.
//
// Backed by master_leads_list / master_leads_count RPCs.

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Search, Phone, ChevronDown, ChevronRight, Calendar, AlertTriangle, Share2, ArrowRightLeft, Trash2, MoreVertical, X, ExternalLink, Megaphone, Globe } from 'lucide-react';
import { fetchMasterLeads, fetchMasterLeadsByOwner, fetchMasterLeadsByCampaign } from '../../services/masterLeadsService';
import { fetchCampaigns } from '../../services/marketingService';
import { fetchSalesAgents } from '../../services/opportunitiesService';
import { getTeamMemberIds } from '../../utils/teamHelper';
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
// Human-friendly source labels — keys match the values stored on contacts.source.
// Falls back to the raw key when unknown so we never silently drop new sources.
const SOURCE_LABELS = {
  facebook:   { ar: 'فيسبوك',         en: 'Facebook' },
  instagram:  { ar: 'انستجرام',       en: 'Instagram' },
  google_ads: { ar: 'إعلانات جوجل',   en: 'Google Ads' },
  website:    { ar: 'الموقع',          en: 'Website' },
  call:       { ar: 'اتصال',           en: 'Call' },
  walk_in:    { ar: 'زيارة مباشرة',   en: 'Walk-in' },
  referral:   { ar: 'إحالة',           en: 'Referral' },
  developer:  { ar: 'مطور',            en: 'Developer' },
  cold_call:  { ar: 'مكالمة باردة',   en: 'Cold call' },
  other:      { ar: 'أخرى',            en: 'Other' },
};
const formatSource = (s, isRTL) => {
  if (!s) return null;
  const m = SOURCE_LABELS[s];
  return m ? (isRTL ? m.ar : m.en) : s;
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

// Searchable campaign picker for the filter bar. A plain <select> is painful
// once there are many campaigns, so this lets the admin type to filter the
// list and pick.
function CampaignFilterCombo({ campaigns, value, onChange, isRTL }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const label = (c) => (isRTL ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)) || '';
  const selected = campaigns.find(c => String(c.id) === String(value));
  const s = search.trim().toLowerCase();
  const list = s
    ? campaigns.filter(c => (c.name_ar || '').toLowerCase().includes(s) || (c.name_en || '').toLowerCase().includes(s))
    : campaigns;
  const inputCls = 'w-full px-3 py-2 pe-7 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark outline-none focus:border-brand-500';
  return (
    <div className="relative min-w-[200px]" ref={ref}>
      <input
        type="text"
        value={open ? search : (selected ? label(selected) : '')}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setSearch(''); }}
        placeholder={isRTL ? 'كل الحملات...' : 'Any campaign...'}
        className={inputCls}
      />
      {value && (
        <button type="button" onClick={() => { onChange(''); setSearch(''); }}
          className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'} text-content-muted hover:text-red-500 bg-transparent border-none cursor-pointer p-0`}>
          <X size={14} />
        </button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[260px] overflow-y-auto bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg shadow-lg">
          <button type="button" onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
            className="w-full text-start px-3 py-2 text-xs text-content-muted dark:text-content-muted-dark hover:bg-brand-500/[0.08] cursor-pointer border-none bg-transparent">
            {isRTL ? 'كل الحملات' : 'Any campaign'}
          </button>
          {list.map(c => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
              className={`w-full text-start px-3 py-2 text-xs cursor-pointer border-none bg-transparent hover:bg-brand-500/[0.08] ${String(c.id) === String(value) ? 'text-brand-500 font-semibold' : 'text-content dark:text-content-dark'}`}>
              {label(c)}
            </button>
          ))}
          {list.length === 0 && (
            <div className="px-3 py-2 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد نتائج' : 'No results'}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MasterLeadsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile, hasPermission } = useAuth();
  const toast = useToast();

  // Helper that builds the deep-link URL the Leads page understands
  // (?highlight=<id> auto-opens that contact's drawer on load).
  // Used as the href on the owner-name link so middle-click, ⌘-click,
  // and right-click → 'Open in new tab' all work natively.
  const leadHref = (copyId) => `/contacts?highlight=${copyId}`;

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
  // Status filter — combined with ownerId, lets the admin ask "show me
  // every phone where Yassin has a copy in 'contacted' status". Applied
  // client-side on the current page so the RPC contract stays unchanged.
  const [statusFilter, setStatusFilter] = useState('');
  // Campaign filter — when set, the list shows only families that have a copy
  // in that campaign (resolved in JS via fetchMasterLeadsByCampaign, since the
  // RPC path doesn't know campaigns). Stores the selected campaign id.
  const [campaignFilter, setCampaignFilter] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  useEffect(() => {
    fetchCampaigns()
      .then(c => setCampaigns(Array.isArray(c) ? c : []))
      .catch(() => {});
  }, []);

  const [agents, setAgents] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  // Per-copy source + campaign — fetched in bulk after the master_leads_list
  // RPC returns, since the RPC's slim copy projection doesn't carry them.
  // Keyed by copy id → { source, campaign_name } so the expanded rows can
  // surface where each lead came from without an N+1 fetch.
  const [copyMeta, setCopyMeta] = useState({});
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

  // Gated by the POOL_SETTINGS permission (admin + operations + sales_manager).
  const canView = hasPermission ? hasPermission('pool.settings') : profile?.role === 'admin';

  // Sales managers + team leaders are scoped to their own team's agents.
  // Admin / operations see everyone. We fetch the team member uuids once
  // and use them to (a) filter the Owner dropdown, (b) hide non-team copy
  // owners in the table, (c) constrain the Distribute / Hand-off pickers.
  const isTeamScoped = profile?.role === 'sales_manager' || profile?.role === 'team_leader';
  const [teamUserIds, setTeamUserIds] = useState(null); // null = unscoped (admin/ops)
  useEffect(() => {
    if (!canView) return;
    if (!isTeamScoped) { setTeamUserIds(null); return; }
    getTeamMemberIds(profile?.role, profile?.team_id).then(ids => {
      setTeamUserIds(new Set(ids || []));
    }).catch(() => setTeamUserIds(new Set()));
  }, [canView, isTeamScoped, profile?.role, profile?.team_id]);

  // Destructive delete is admin/operations only — sales_manager can move
  // leads around but can't permanently remove them.
  const canDelete = hasPermission ? hasPermission('contacts.delete') : profile?.role === 'admin';

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load agent list once. Active first then inactive (so the admin can still
  // filter on a deactivated user who has legacy copies, but the active
  // people sit at the top of the dropdown). Inactive entries are tagged so
  // it's obvious in the option label.
  useEffect(() => {
    fetchSalesAgents().then(list => {
      let all = (list || [])
        .filter(a => a.id && (a.full_name_en || a.full_name_ar))
        .map(a => ({
          id: a.id,
          name: a.full_name_en || a.full_name_ar,
          inactive: a.status === 'inactive',
        }));
      // Team-scoped roles only see their own team in the Owner filter
      if (isTeamScoped && teamUserIds) {
        all = all.filter(a => teamUserIds.has(a.id));
      }
      all.sort((a, b) => {
        if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      setAgents(all);
    }).catch(() => {});
  }, [isTeamScoped, teamUserIds]);

  // Hold mutable refs for things that change reference on every render
  // (toast comes from a context, isRTL flips on language toggle). Putting
  // them in `load`'s deps would cause an extra fetch every render —
  // ref'ing keeps `load` stable and the effect tied only to actual filter
  // changes.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const isRTLRef = useRef(isRTL);
  isRTLRef.current = isRTL;

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      // Owner selected → use our owner-scoped loader. The RPC's
      // p_owner_id surfaces only one copy per family, missing clones
      // the agent holds when the original sits elsewhere. Our loader
      // pulls every phone the agent currently owns, then rebuilds the
      // full family for each so clones the agent holds are visible.
      // Campaign filter takes the JS path (RPC can't filter by campaign), and
      // still honours owner / search / status / minClones on top.
      const selectedCampaign = campaignFilter ? campaigns.find(c => String(c.id) === String(campaignFilter)) : null;
      const result = selectedCampaign
        ? await fetchMasterLeadsByCampaign({
            campaignNames: [selectedCampaign.name_ar, selectedCampaign.name_en],
            ownerId: ownerId || null,
            search: debouncedSearch || null,
            minClones,
            statusFilter: statusFilter || null,
          })
        : ownerId
        ? await fetchMasterLeadsByOwner({
            userId: ownerId,
            search: debouncedSearch || null,
            minClones,
            statusFilter: statusFilter || null,
          })
        : await fetchMasterLeads({
            search: debouncedSearch || null,
            minClones,
            ownerId: null,
            page,
            pageSize,
          });
      const { rows: r, total: t, error } = result;
      if (error) {
        toastRef.current.error(isRTLRef.current ? 'فشل تحميل البيانات' : 'Failed to load data');
      }
      setRows(r);
      setTotal(t);
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedSearch, minClones, ownerId, statusFilter, page, pageSize, campaignFilter, campaigns]);

  useEffect(() => { load(); }, [load]);

  // After every load, batch-fetch source + campaign for every copy on the
  // current page. The master_leads_list RPC only returns a slim projection
  // (owner/status/dates), so we hydrate the rest in one round-trip rather
  // than N selects. RLS still applies — team-scoped users only get rows
  // they're allowed to see, which matches what the RPC already filtered.
  useEffect(() => {
    if (!rows.length) { setCopyMeta({}); return; }
    const ids = [];
    rows.forEach(f => {
      (Array.isArray(f.copies) ? f.copies : []).forEach(c => { if (c?.id) ids.push(c.id); });
    });
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, source, campaign_name')
        .in('id', ids);
      if (cancelled) return;
      if (error || !Array.isArray(data)) return;
      const map = {};
      for (const r of data) map[r.id] = { source: r.source, campaign_name: r.campaign_name };
      setCopyMeta(map);
    })();
    return () => { cancelled = true; };
  }, [rows]);

  // Reset page + clear bulk selection whenever the filter changes — the
  // selectedPhones set lives across renders, so without this the user could
  // narrow to a different agent and still see "5 selected" from a previous
  // filter even though those families are no longer visible.
  useEffect(() => {
    setPage(1);
    setSelectedPhones(new Set());
  }, [debouncedSearch, minClones, ownerId, statusFilter, campaignFilter]);

  // Status filter strictly narrows to families where the selected agent's
  // own copy is in the chosen status. The agent MUST hold a copy (RPC
  // already filtered for that via p_owner_id when ownerId is set) AND
  // that specific copy's contact_status must match the dropdown. If no
  // owner is selected, the status filter matches any copy in the family.
  const displayRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter(family => {
      const copies = Array.isArray(family.copies) ? family.copies : [];
      if (ownerId) {
        // Owner is set — the agent's own copy must be in this status.
        return copies.some(c => c.owner_id === ownerId && (c.status || 'new') === statusFilter);
      }
      return copies.some(c => (c.status || 'new') === statusFilter);
    });
  }, [rows, statusFilter, ownerId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleExpand = (phone) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <AlertTriangle size={48} className="text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-content dark:text-content-dark">
            {isRTL ? 'لا تملك صلاحية الوصول لهذه الصفحة' : 'Access denied'}
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
          {agents.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}{a.inactive ? (isRTL ? ' (غير نشط)' : ' (inactive)') : ''}
            </option>
          ))}
        </select>
        {/* Status — combines with Owner above to narrow to "owner X with
            status Y". Applied client-side on the current page. */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark outline-none cursor-pointer min-w-[160px]"
        >
          <option value="">{isRTL ? 'كل الحالات' : 'Any status'}</option>
          {Object.keys(STATUS_LABELS).map(k => (
            <option key={k} value={k}>
              {isRTL ? STATUS_LABELS[k].ar : STATUS_LABELS[k].en}
            </option>
          ))}
        </select>
        {/* Campaign — type-to-search; shows only families with a copy in the
            chosen campaign. */}
        {campaigns.length > 0 && (
          <CampaignFilterCombo campaigns={campaigns} value={campaignFilter} onChange={setCampaignFilter} isRTL={isRTL} />
        )}
        {/* Total */}
        <div className="flex items-center px-3 text-xs text-content-muted dark:text-content-muted-dark">
          {loading
            ? (isRTL ? 'جاري التحميل...' : 'Loading...')
            : (statusFilter || ownerId)
              ? `${displayRows.length.toLocaleString()} ${isRTL ? 'من' : 'of'} ${total.toLocaleString()} ${isRTL ? 'عيلة' : 'families'}`
              : `${total.toLocaleString()} ${isRTL ? 'عيلة' : 'families'}`}
        </div>
      </div>

      {/* List */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[32px_2fr_1.5fr_0.7fr_1fr_1fr_30px] gap-3 px-4 py-2.5 bg-surface-bg/40 dark:bg-surface-bg-dark/40 border-b border-edge dark:border-edge-dark text-[11px] font-semibold text-content-muted dark:text-content-muted-dark uppercase">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={displayRows.length > 0 && displayRows.every(r => selectedPhones.has(r.phone))}
              ref={el => { if (el) el.indeterminate = !displayRows.every(r => selectedPhones.has(r.phone)) && displayRows.some(r => selectedPhones.has(r.phone)); }}
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
        {!loading && displayRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-content-muted dark:text-content-muted-dark">
            {(statusFilter || ownerId) && rows.length > 0
              ? (isRTL
                  ? 'لا توجد عيلات مطابقة في الصفحة الحالية. جرّب صفحة أخرى أو غيّر الفلتر.'
                  : 'No matching families on the current page. Try another page or change the filter.')
              : (isRTL ? 'لا يوجد نتائج' : 'No results')}
          </div>
        ) : displayRows.map(family => {
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
                      // Team scoping: managers/leaders see masked rows for
                      // copies owned by people outside their team. The phone
                      // family is still visible (so they know the lead has
                      // copies elsewhere), but the owner name + actions
                      // are hidden.
                      const isOutsideTeam = isTeamScoped && teamUserIds && c.owner_id && !teamUserIds.has(c.owner_id);
                      return (
                        <div key={c.id} className={`grid grid-cols-[40px_1.6fr_1.2fr_0.9fr_0.9fr_1.2fr_120px] gap-2 px-3 py-2 items-center border-b border-edge/40 dark:border-edge-dark/40 last:border-b-0 text-xs ${isOutsideTeam ? 'opacity-50' : ''}`}>
                          <div className="text-content-muted dark:text-content-muted-dark font-mono">
                            {i === 0 ? (isRTL ? 'أصلية' : 'orig') : `#${i + 1}`}
                          </div>
                          <div className="min-w-0">
                            {isOutsideTeam ? (
                              <span className="inline-flex items-center gap-1 text-content-muted dark:text-content-muted-dark italic">
                                {isRTL ? 'خارج فريقك' : 'Outside your team'}
                              </span>
                            ) : (
                              <a
                                href={leadHref(c.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={isRTL ? 'افتح هذه النسخة في تاب جديد' : 'Open this copy in a new tab'}
                                className="inline-flex items-center gap-1 text-content dark:text-content-dark font-medium truncate no-underline hover:text-brand-500 transition-colors"
                              >
                                <span className="truncate">{c.owner_name || (isRTL ? 'غير معين' : 'Unassigned')}</span>
                                <ExternalLink size={10} className="shrink-0 opacity-60" />
                              </a>
                            )}
                            {/* Source + campaign meta — surfaces *where the lead came from*
                                under the owner cell so admins can see why each copy exists. */}
                            {(() => {
                              const meta = copyMeta[c.id];
                              if (!meta) return null;
                              const src = formatSource(meta.source, isRTL);
                              const camp = meta.campaign_name;
                              if (!src && !camp) return null;
                              return (
                                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-content-muted dark:text-content-muted-dark min-w-0">
                                  {src && (
                                    <span className="inline-flex items-center gap-1 min-w-0" title={isRTL ? 'المصدر' : 'Source'}>
                                      <Globe size={9} className="shrink-0 opacity-70" />
                                      <span className="truncate">{src}</span>
                                    </span>
                                  )}
                                  {camp && (
                                    <span className="inline-flex items-center gap-1 min-w-0" title={isRTL ? 'الكامبين' : 'Campaign'}>
                                      <Megaphone size={9} className="shrink-0 opacity-70" />
                                      <span className="truncate">{camp}</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
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
                            {isOutsideTeam ? (
                              <span className="text-[10px] text-content-muted dark:text-content-muted-dark italic">
                                {isRTL ? '—' : '—'}
                              </span>
                            ) : (
                              <>
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
                                {canDelete && (
                                  <button
                                    onClick={() => setOpenMenuFor(prev => prev === c.id ? null : c.id)}
                                    title={isRTL ? 'المزيد' : 'More'}
                                    className="w-7 h-7 rounded-md border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-500/10 hover:border-brand-500/30 flex items-center justify-center cursor-pointer text-content-muted dark:text-content-muted-dark"
                                  >
                                    <MoreVertical size={12} />
                                  </button>
                                )}
                                {canDelete && openMenuFor === c.id && (
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
          eligibleUserIds={isTeamScoped ? teamUserIds : null}
        />
      )}
      {handoffContact && (
        <HandOffLeadModal
          contact={handoffContact}
          onClose={() => setHandoffContact(null)}
          onSuccess={() => { setHandoffContact(null); load(); }}
          eligibleUserIds={isTeamScoped ? teamUserIds : null}
        />
      )}
      {bulkDistributeOpen && (
        <BulkDistributeMasterModal
          families={selectedFamilies}
          onClose={() => setBulkDistributeOpen(false)}
          onSuccess={() => { setBulkDistributeOpen(false); clearSelection(); load(); }}
          eligibleUserIds={isTeamScoped ? teamUserIds : null}
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
