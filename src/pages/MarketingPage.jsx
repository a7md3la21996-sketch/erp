import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import {
  Megaphone, Plus, TrendingUp, Users, DollarSign, BarChart3, Search, X,
  Pencil, Trash2, Eye, Zap, RefreshCw, ChevronUp, ChevronDown,
  Phone, MessageCircle, ArrowUpDown, Target, Repeat, Clock,
  PieChart, Calendar, Award, TrendingDown, CircleDollarSign,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, Button, Input, Select, Textarea, KpiCard, SmartFilter, applySmartFilters, FilterPill, ExportButton, Pagination, Modal, ModalFooter } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaignStats, getCampaignFunnel, getCampaignDetail } from '../services/marketingService';
import { normalizePhone } from './crm/contacts/constants';
import { logView } from '../services/viewTrackingService';
import { fmtMoney } from '../utils/formatting';
import { thCls } from '../utils/tableStyles';

// ── Config ───────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'facebook',   ar: 'فيسبوك',      en: 'Facebook',     color: '#1877F2' },
  { id: 'instagram',  ar: 'انستغرام',     en: 'Instagram',    color: '#E4405F' },
  { id: 'google_ads', ar: 'جوجل أدز',     en: 'Google Ads',   color: '#4285F4' },
  { id: 'tiktok',     ar: 'تيك توك',      en: 'TikTok',       color: '#000000' },
  { id: 'snapchat',   ar: 'سناب شات',     en: 'Snapchat',     color: '#FFFC00' },
  { id: 'linkedin',   ar: 'لينكدإن',      en: 'LinkedIn',     color: '#0A66C2' },
  { id: 'website',    ar: 'الموقع',        en: 'Website',      color: '#2F6BD3' },
  { id: 'cold_call',  ar: 'كولد كول',     en: 'Cold Call',    color: '#6B8DB5' },
  { id: 'referral',   ar: 'توصية',        en: 'Referral',     color: '#158A57' },
  { id: 'walk_in',    ar: 'زيارة مباشرة',  en: 'Walk-in',      color: '#C9860A' },
  { id: 'other',      ar: 'أخرى',         en: 'Other',        color: '#6B7280' },
];
const STATUSES = [
  { id: 'active',    ar: 'نشط',    en: 'Active',    color: '#158A57' },
  { id: 'paused',    ar: 'متوقف',  en: 'Paused',    color: '#C9860A' },
  { id: 'completed', ar: 'مكتمل',  en: 'Completed', color: '#6B7280' },
  { id: 'draft',     ar: 'مسودة',  en: 'Draft',     color: '#94A3B8' },
];
const TYPES = [
  { id: 'paid_ads',    ar: 'إعلانات مدفوعة', en: 'Paid Ads' },
  { id: 'content',     ar: 'محتوى',          en: 'Content' },
  { id: 'retargeting', ar: 'إعادة استهداف',  en: 'Retargeting' },
  { id: 'outbound',    ar: 'صادر',           en: 'Outbound' },
  { id: 'referral',    ar: 'توصيات',         en: 'Referral' },
  { id: 'event',       ar: 'حدث',            en: 'Event' },
  { id: 'seo',         ar: 'تحسين محركات',   en: 'SEO' },
  { id: 'email',       ar: 'بريد إلكتروني',  en: 'Email' },
];

const getPlatform = (id) => PLATFORMS.find(p => p.id === id);
const getStatus = (id) => STATUSES.find(s => s.id === id);
const getType = (id) => TYPES.find(t => t.id === id);

const BASE_SMART_FIELDS = [
  { id: 'platform', label: 'المنصة', labelEn: 'Platform', type: 'select', options: PLATFORMS.map(p => ({ value: p.id, label: p.ar, labelEn: p.en })) },
  { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: STATUSES.map(s => ({ value: s.id, label: s.ar, labelEn: s.en })) },
  { id: 'type', label: 'النوع', labelEn: 'Type', type: 'select', options: TYPES.map(t => ({ value: t.id, label: t.ar, labelEn: t.en })) },
  { id: 'budget', label: 'الميزانية', labelEn: 'Budget', type: 'number' },
  { id: 'spent', label: 'المصروف', labelEn: 'Spent', type: 'number' },
  { id: 'start_date', label: 'تاريخ البدء', labelEn: 'Start Date', type: 'date' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'الاسم', labelEn: 'Name' },
  { value: 'budget_desc', label: 'الميزانية (الأعلى)', labelEn: 'Budget (High)' },
  { value: 'leads_desc', label: 'الليدز (الأكثر)', labelEn: 'Leads (Most)' },
  { value: 'cpl_asc', label: 'تكلفة/ليد (الأقل)', labelEn: 'CPL (Lowest)' },
  { value: 'qualified_desc', label: 'الأكثر تأهيلًا', labelEn: 'Most Qualified' },
  { value: 'dq_desc', label: 'الأعلى رفضًا %', labelEn: 'Highest DQ%' },
  { value: 'roi_desc', label: 'ROI (الأعلى)', labelEn: 'ROI (Best)' },
  { value: 'date_desc', label: 'الأحدث', labelEn: 'Newest' },
];

// ── Main Component ───────────────────────────────────────────────
export default function MarketingPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/marketing/campaigns')) return 'campaigns';
    if (path.includes('/marketing/channels')) return 'channels';
    if (path.includes('/marketing/funnel')) return 'funnel';
    if (path.includes('/marketing/roi')) return 'roi';
    return 'dashboard';
  }, [location.pathname]);
  const [campaigns, setCampaigns] = useState([]);
  const [statsRows, setStatsRows] = useState([]);   // get_campaign_stats() rows
  const [funnelRows, setFunnelRows] = useState([]); // get_campaign_funnel() rows
  const [drawerContacts, setDrawerContacts] = useState([]); // on-demand per-campaign
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [smartFilters, setSmartFilters] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { auditFields, applyAuditFilters } = useAuditFilter('campaign');

  const SMART_FIELDS = useMemo(() => [
    ...BASE_SMART_FIELDS,
    ...auditFields,
  ], [auditFields]);


  // Load data — campaigns + DB-side aggregates (no more pulling the whole
  // contacts/opps/deals tables into the browser).
  useEffect(() => {
    Promise.all([
      fetchCampaigns(),
      getCampaignStats(),
      getCampaignFunnel(),
    ]).then(([c, s, f]) => {
      setCampaigns(c);
      setStatsRows(s);
      setFunnelRows(f);
      setLoading(false);
    });
  }, [profile?.role, profile?.id]);

  // On-demand: load the selected campaign's contacts when the drawer opens
  // (or when navigating prev/next inside it).
  useEffect(() => {
    if (!selectedCampaign?.id) { setDrawerContacts([]); return; }
    let cancelled = false;
    setDrawerLoading(true);
    getCampaignDetail(selectedCampaign).then(d => {
      if (!cancelled) { setDrawerContacts(d); setDrawerLoading(false); }
    });
    return () => { cancelled = true; };
  }, [selectedCampaign?.id]);

  // Per-campaign stats — now sourced from the DB aggregate RPC (get_campaign_stats)
  // instead of computing over a capped client-side contacts array.
  const campaignStats = useMemo(() => {
    const byCamp = {};
    campaigns.forEach(c => { byCamp[c.id] = c; });
    const stats = {};
    statsRows.forEach(r => {
      const spent = byCamp[r.campaign_id]?.spent || 0;
      const leads = Number(r.leads) || 0;
      const engaged = Number(r.engaged) || 0;         // qualified = following + has_opportunity
      const disqualified = Number(r.disqualified) || 0;
      const interactions = Number(r.interactions) || 0;
      const cpl = leads > 0 ? Math.round(spent / leads) : 0;
      // Cost per QUALIFIED lead — the real efficiency metric (junk leads excluded).
      const cpql = engaged > 0 ? Math.round(spent / engaged) : 0;
      const conversionRate = leads > 0 ? Math.round((engaged / leads) * 100) : 0;
      const disqualRate = leads > 0 ? Math.round((disqualified / leads) * 100) : 0;
      stats[r.campaign_id] = {
        leads,
        totalInteractions: interactions,
        repeats: Math.max(0, interactions - leads), // interactions beyond first touch
        cpl,
        cpql,
        contactedLeads: engaged,
        qualified: engaged,
        disqualified,
        conversionRate,
        disqualRate,
        opps: Number(r.opps) || 0,
        wonDeals: Number(r.won_deals) || 0,
        revenue: Number(r.revenue) || 0,
      };
    });
    return stats;
  }, [campaigns, statsRows]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...campaigns];
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => (c.name_en || '').toLowerCase().includes(q) || (c.name_ar || '').toLowerCase().includes(q));
    }
    // Sort
    const stats = campaignStats;
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name': return ((lang === 'ar' ? a.name_ar : a.name_en) || '').localeCompare((lang === 'ar' ? b.name_ar : b.name_en) || '');
        case 'budget_desc': return (b.budget || 0) - (a.budget || 0);
        case 'leads_desc': return (stats[b.id]?.leads || 0) - (stats[a.id]?.leads || 0);
        case 'cpl_asc': return (stats[a.id]?.cpl || 99999) - (stats[b.id]?.cpl || 99999);
        case 'qualified_desc': return (stats[b.id]?.qualified || 0) - (stats[a.id]?.qualified || 0);
        case 'dq_desc': return (stats[b.id]?.disqualRate || 0) - (stats[a.id]?.disqualRate || 0);
        // True ROI = (revenue - spent) / spent (was mistakenly sorting by contact-rate).
        case 'roi_desc': {
          const roi = (c) => { const s = stats[c.id]; const sp = c.spent || 0; return s && sp > 0 ? (s.revenue - sp) / sp : -Infinity; };
          return roi(b) - roi(a);
        }
        case 'date_desc': default: return new Date(b.start_date || 0) - new Date(a.start_date || 0);
      }
    });
    return result;
  }, [campaigns, smartFilters, search, sortBy, lang, campaignStats, applyAuditFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedData = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [smartFilters, search, pageSize]);

  // KPIs
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const totalSpent = campaigns.reduce((s, c) => s + (c.spent || 0), 0);
  const totalLeads = Object.values(campaignStats).reduce((s, v) => s + v.leads, 0);
  const avgCPL = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalInteractions = Object.values(campaignStats).reduce((s, v) => s + v.totalInteractions, 0);

  // Channel analytics
  const channelStats = useMemo(() => {
    const map = {};
    PLATFORMS.forEach(p => { map[p.id] = { campaigns: 0, budget: 0, spent: 0, leads: 0, interactions: 0, repeats: 0 }; });
    campaigns.forEach(camp => {
      const s = campaignStats[camp.id] || {};
      const ch = map[camp.platform] || (map[camp.platform] = { campaigns: 0, budget: 0, spent: 0, leads: 0, interactions: 0, repeats: 0 });
      ch.campaigns++;
      ch.budget += camp.budget || 0;
      ch.spent += camp.spent || 0;
      ch.leads += s.leads || 0;
      ch.interactions += s.totalInteractions || 0;
      ch.repeats += s.repeats || 0;
    });
    return map;
  }, [campaigns, campaignStats]);

  // Funnel data — now sourced from get_campaign_funnel() (UNIQUE contacts,
  // company-wide + per-channel), instead of deduping a capped client array.
  const funnelData = useMemo(() => {
    const all = funnelRows.find(r => r.platform === '__all__') || { leads: 0, contacted: 0, opps: 0, deals: 0 };
    const total = Number(all.leads) || 0;
    const contacted = Number(all.contacted) || 0;
    const opportunities = Number(all.opps) || 0;
    const dealsWon = Number(all.deals) || 0;
    return {
      total,
      contacted,
      opportunities,
      deals: dealsWon,
      contactedPct: total > 0 ? Math.round((contacted / total) * 100) : 0,
      oppPct: contacted > 0 ? Math.round((opportunities / contacted) * 100) : 0,
      dealPct: opportunities > 0 ? Math.round((dealsWon / opportunities) * 100) : 0,
      overallPct: total > 0 ? Math.round((dealsWon / total) * 100) : 0,
      byChannel: funnelRows
        .filter(r => r.platform !== '__all__' && (Number(r.leads) || 0) > 0)
        .map(r => ({
          platform: getPlatform(r.platform) || { id: r.platform, ar: r.platform, en: r.platform, color: '#6B7280' },
          leads: Number(r.leads) || 0,
          contacted: Number(r.contacted) || 0,
          opps: Number(r.opps) || 0,
          deals: Number(r.deals) || 0,
        }))
        .sort((a, b) => b.leads - a.leads),
    };
  }, [funnelRows]);

  // Top campaigns by leads
  const topCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => (campaignStats[b.id]?.leads || 0) - (campaignStats[a.id]?.leads || 0)).slice(0, 5);
  }, [campaigns, campaignStats]);

  // ── ROI Performance Data ──────────────────────────────────────
  // Built from the DB aggregate (campaignStats) + each campaign's spend.
  // NOTE: "commission" here is really the sum of linked deal_value (the system
  // has no commission column yet) — kept as-is for accuracy; Track C will model
  // true commission.
  const roiData = useMemo(() => {
    const rows = campaigns.map(camp => {
      const s = campaignStats[camp.id] || {};
      const spent = camp.spent || 0;
      const leads = s.leads || 0;
      const opps = s.opps || 0;
      const wonDeals = s.wonDeals || 0;
      const commission = s.revenue || 0;
      const costPerLead = leads > 0 ? Math.round(spent / leads) : 0;
      const costPerDeal = wonDeals > 0 ? Math.round(spent / wonDeals) : 0;
      const roi = spent > 0 ? Math.round(((commission - spent) / spent) * 100) : 0;
      return {
        id: camp.id,
        name_en: camp.name_en,
        name_ar: camp.name_ar,
        platform: camp.platform,
        status: camp.status,
        budget: camp.budget || 0,
        spent,
        leads,
        opps,
        wonDeals,
        commission,
        costPerLead,
        costPerDeal,
        roi,
      };
    });

    const totalSpentAll = rows.reduce((s, r) => s + r.spent, 0);
    const totalLeadsAll = rows.reduce((s, r) => s + r.leads, 0);
    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const totalDealsWon = rows.reduce((s, r) => s + r.wonDeals, 0);
    // Pooled ROI (Σrevenue−Σspent)/Σspent — not a simple average of per-campaign
    // ratios (which zero-spent campaigns drag toward 0 and is statistically wrong).
    const avgRoi = totalSpentAll > 0 ? Math.round(((totalCommission - totalSpentAll) / totalSpentAll) * 100) : 0;
    const bestCampaign = rows.length > 0 ? [...rows].sort((a, b) => b.roi - a.roi)[0] : null;

    return { rows, totalSpentAll, totalLeadsAll, totalCommission, totalDealsWon, avgRoi, bestCampaign };
  }, [campaigns, campaignStats]);

  const [roiSortField, setRoiSortField] = useState('roi');
  const [roiSortDir, setRoiSortDir] = useState('desc');
  const sortedRoiRows = useMemo(() => {
    return [...roiData.rows].sort((a, b) => {
      const mul = roiSortDir === 'desc' ? -1 : 1;
      const av = a[roiSortField] ?? 0;
      const bv = b[roiSortField] ?? 0;
      if (typeof av === 'string') return mul * av.localeCompare(bv);
      return mul * (av - bv);
    });
  }, [roiData.rows, roiSortField, roiSortDir]);

  const handleRoiSort = useCallback((field) => {
    setRoiSortField(prev => {
      if (prev === field) { setRoiSortDir(d => d === 'desc' ? 'asc' : 'desc'); return field; }
      setRoiSortDir('desc');
      return field;
    });
  }, []);

  // Handlers
  const handleSave = async (form) => {
    try {
      if (editTarget) {
        const updated = await updateCampaign(editTarget.id, form);
        setCampaigns(prev => prev.map(c => c.id === editTarget.id ? updated : c));
        toast.success(isRTL ? 'تم التحديث' : 'Updated');
      } else {
        const created = await createCampaign({ ...form, created_by: profile?.id || null, created_by_name: profile?.full_name_ar || profile?.full_name_en || null });
        setCampaigns(prev => [created, ...prev]);
        toast.success(isRTL ? 'تم الإضافة' : 'Created');
      }
      setModalOpen(false);
      setEditTarget(null);
    } catch (err) {
      // Was unhandled: a failed save threw with no toast and left the modal
      // open, so the user assumed it saved.
      toast.error((isRTL ? 'فشل الحفظ: ' : 'Save failed: ') + (err?.message || ''));
    }
  };

  // Gate + open the confirm modal (replaces the non-RTL window.confirm).
  const handleDelete = (id) => {
    if (profile?.role !== 'admin' && profile?.role !== 'operations') {
      toast.error(isRTL ? 'ليس لديك صلاحية حذف الحملات' : 'You do not have permission to delete campaigns');
      return;
    }
    const camp = campaigns.find(c => c.id === id);
    if (camp) setDeleteConfirm(camp);
  };

  // Actual delete — now with error handling (was a silent failure before).
  const confirmDelete = async () => {
    const camp = deleteConfirm;
    if (!camp) return;
    try {
      await deleteCampaign(camp.id);
      setCampaigns(prev => prev.filter(c => c.id !== camp.id));
      if (selectedCampaign?.id === camp.id) setSelectedCampaign(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error((isRTL ? 'فشل الحذف: ' : 'Delete failed: ') + (err?.message || ''));
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Drawer nav
  const handlePrev = () => { if (selectedIdx > 0) { setSelectedCampaign(filtered[selectedIdx - 1]); setSelectedIdx(selectedIdx - 1); } };
  const handleNext = () => { if (selectedIdx < filtered.length - 1) { setSelectedCampaign(filtered[selectedIdx + 1]); setSelectedIdx(selectedIdx + 1); } };

  const openDrawer = (camp) => {
    setSelectedCampaign(camp);
    setSelectedIdx(filtered.findIndex(c => c.id === camp.id));
    logView({ entityType: 'campaign', entityId: camp.id, entityName: camp.name_en || camp.name_ar, viewer: profile });
  };

  // ── Skeleton ─────────────────────────────────────
  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-screen pb-16">
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-brand-500/10 rounded-xl w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-brand-500/10 rounded-xl" />)}</div>
        <div className="h-64 bg-brand-500/10 rounded-xl" />
      </div>
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-screen pb-16">

      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Megaphone size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'التسويق' : 'Marketing'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? `${campaigns.length} حملة · ${totalLeads} ليد · ${totalInteractions} تفاعل` : `${campaigns.length} campaigns · ${totalLeads} leads · ${totalInteractions} interactions`}
            </p>
          </div>
        </div>
        {activeTab === 'campaigns' && (
          <div className="flex gap-2">
            <ExportButton
              data={filtered.map(c => { const s = campaignStats[c.id] || {}; return { name: isRTL ? c.name_ar : c.name_en, platform: c.platform, status: c.status, type: c.type, budget: c.budget, spent: c.spent, leads: s.leads || 0, qualified: s.qualified || 0, disqualified: s.disqualified || 0, dq_rate: (s.disqualRate || 0) + '%', cpl: s.cpl || 0, cpql: s.cpql || 0, created_by: c.created_by_name || '', start: c.start_date, end: c.end_date }; })}
              filename="campaigns"
              title={isRTL ? 'الحملات' : 'Campaigns'}
              columns={[{ header: 'Name', key: 'name' }, { header: 'Platform', key: 'platform' }, { header: 'Status', key: 'status' }, { header: 'Budget', key: 'budget' }, { header: 'Spent', key: 'spent' }, { header: 'Leads', key: 'leads' }, { header: 'Qualified', key: 'qualified' }, { header: 'Disqualified', key: 'disqualified' }, { header: 'DQ%', key: 'dq_rate' }, { header: 'CPL', key: 'cpl' }, { header: 'CPQL', key: 'cpql' }, { header: 'Created By', key: 'created_by' }]}
            />
            <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
              <Plus size={16} /> {isRTL ? 'حملة جديدة' : 'New Campaign'}
            </Button>
          </div>
        )}
      </div>

      {/* ═══ Section tabs (in-page nav — replaces the old sidebar submenu) ═══ */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {[
          { key: 'dashboard', path: '/marketing',          icon: BarChart3,  ar: 'نظرة عامة', en: 'Overview' },
          { key: 'campaigns', path: '/marketing/campaigns', icon: Megaphone,  ar: 'الحملات',   en: 'Campaigns' },
          { key: 'channels',  path: '/marketing/channels',  icon: Target,     ar: 'القنوات',   en: 'Channels' },
          { key: 'funnel',    path: '/marketing/funnel',    icon: PieChart,   ar: 'القمع',     en: 'Funnel' },
          { key: 'roi',       path: '/marketing/roi',       icon: TrendingUp, ar: 'الأداء و ROI', en: 'ROI' },
        ].map(t => {
          const active = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => navigate(t.path)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                active
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark border-edge dark:border-edge-dark hover:text-content dark:hover:text-content-dark hover:border-brand-500/40'
              }`}
            >
              <Icon size={14} /> {isRTL ? t.ar : t.en}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══ DASHBOARD TAB ═══ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (<>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <KpiCard icon={BarChart3} label={isRTL ? 'إجمالي الحملات' : 'Total Campaigns'} value={campaigns.length} color="#2F6BD3" />
        <KpiCard icon={TrendingUp} label={isRTL ? 'حملات نشطة' : 'Active'} value={activeCampaigns} color="#158A57" />
        <KpiCard icon={Users} label={isRTL ? 'إجمالي الليدز' : 'Total Leads'} value={totalLeads} color="#2F6BD3" />
        <KpiCard icon={Repeat} label={isRTL ? 'إجمالي التفاعلات' : 'Interactions'} value={totalInteractions} color="#6B21A8" />
        <KpiCard icon={DollarSign} label={isRTL ? 'إجمالي المصروف' : 'Total Spent'} value={fmtMoney(totalSpent) + ' EGP'} color="#D6403B" />
        <KpiCard icon={Target} label={isRTL ? 'متوسط تكلفة/ليد' : 'Avg CPL'} value={avgCPL + ' EGP'} color={avgCPL > 300 ? '#D6403B' : avgCPL > 200 ? '#C9860A' : '#158A57'} />
      </div>

      {/* ═══ Top Campaigns Mini Chart ═══ */}
      <Card className="mb-5 p-4">
        <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'أداء الحملات (ليدز vs مصروف)' : 'Campaign Performance (Leads vs Spent)'}</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filtered.slice(0, 10).map(camp => {
            const stats = campaignStats[camp.id] || {};
            const maxLeads = Math.max(...filtered.slice(0, 10).map(c => campaignStats[c.id]?.leads || 0), 1);
            const barH = Math.max(((stats.leads || 0) / maxLeads) * 80, 4);
            const platform = getPlatform(camp.platform);
            return (
              <div key={camp.id} className="flex flex-col items-center min-w-[60px] cursor-pointer group" onClick={() => openDrawer(camp)}>
                <div className="flex-1 flex items-end h-[90px]">
                  <div className="w-8 rounded-t-md transition-all group-hover:opacity-80" style={{ height: barH, backgroundColor: platform?.color || '#2F6BD3' }} />
                </div>
                <span className="text-[9px] font-bold text-content dark:text-content-dark mt-1">{stats.leads || 0}</span>
                <span className="text-[8px] text-content-muted dark:text-content-muted-dark truncate max-w-[58px]">{isRTL ? camp.name_ar : camp.name_en}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {PLATFORMS.filter(p => campaigns.some(c => c.platform === p.id)).map(p => (
            <span key={p.id} className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
              {isRTL ? p.ar : p.en}
            </span>
          ))}
        </div>
      </Card>

      {/* ═══ Dashboard: Leads by Channel ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Channel Breakdown */}
        <Card className="p-4">
          <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'الليدز حسب القناة' : 'Leads by Channel'}</p>
          <div className="space-y-2">
            {PLATFORMS.filter(p => channelStats[p.id]?.leads > 0).sort((a, b) => (channelStats[b.id]?.leads || 0) - (channelStats[a.id]?.leads || 0)).map(p => {
              const ch = channelStats[p.id];
              const maxCh = Math.max(...Object.values(channelStats).map(c => c.leads), 1);
              const pct = Math.round((ch.leads / maxCh) * 100);
              const cpl = ch.leads > 0 ? Math.round(ch.spent / ch.leads) : 0;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-[10px] w-16 text-end text-content-muted dark:text-content-muted-dark shrink-0">{isRTL ? p.ar : p.en}</span>
                  <div className="flex-1 h-5 bg-brand-500/[0.06] rounded-md overflow-hidden relative">
                    <div className="h-full rounded-md transition-all" style={{ width: pct + '%', backgroundColor: p.color }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[9px] font-bold text-content dark:text-content-dark">{ch.leads} {isRTL ? 'ليد' : 'leads'}</span>
                  </div>
                  <span className={`text-[9px] font-medium w-12 text-end shrink-0 ${cpl > 300 ? 'text-red-500' : cpl > 200 ? 'text-amber-500' : 'text-emerald-500'}`}>{cpl > 0 ? 'CPL ' + cpl : '—'}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Budget Overview */}
        <Card className="p-4">
          <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'نظرة على الميزانية' : 'Budget Overview'}</p>
          <div className="flex items-center justify-center gap-6 mb-3">
            <div className="text-center">
              <p className="m-0 text-lg font-bold text-brand-500">{fmtMoney(totalBudget)}</p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'الميزانية' : 'Budget'}</p>
            </div>
            <div className="text-center">
              <p className="m-0 text-lg font-bold text-red-500">{fmtMoney(totalSpent)}</p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المصروف' : 'Spent'}</p>
            </div>
            <div className="text-center">
              <p className="m-0 text-lg font-bold text-emerald-500">{fmtMoney(totalBudget - totalSpent)}</p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المتبقي' : 'Remaining'}</p>
            </div>
          </div>
          <div className="h-3 bg-brand-500/10 rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full" style={{ width: (totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0) + '%', backgroundColor: totalBudget <= 0 ? '#158A57' : totalSpent / totalBudget > 0.9 ? '#D6403B' : totalSpent / totalBudget > 0.7 ? '#C9860A' : '#158A57' }} />
          </div>
          {/* Per-channel budget bars */}
          <div className="space-y-1.5">
            {PLATFORMS.filter(p => channelStats[p.id]?.budget > 0).sort((a, b) => (channelStats[b.id]?.budget || 0) - (channelStats[a.id]?.budget || 0)).map(p => {
              const ch = channelStats[p.id];
              const pct = ch.budget > 0 ? Math.round(ch.spent / ch.budget * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-2 text-[10px]">
                  <span className="w-14 text-end text-content-muted dark:text-content-muted-dark shrink-0">{isRTL ? p.ar : p.en}</span>
                  <div className="flex-1 h-2 bg-brand-500/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct + '%', backgroundColor: p.color }} />
                  </div>
                  <span className="w-10 text-end font-medium text-content dark:text-content-dark shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ═══ Dashboard: Top Campaigns + Quick Funnel ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Top 5 Campaigns */}
        <Card className="p-4">
          <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'أفضل 5 حملات' : 'Top 5 Campaigns'}</p>
          <div className="space-y-2">
            {topCampaigns.map((camp, i) => {
              const stats2 = campaignStats[camp.id] || {};
              const platform = getPlatform(camp.platform);
              const cpl = stats2.cpl || 0;
              return (
                <div key={camp.id} onClick={() => { navigate('/marketing/campaigns'); openDrawer(camp); }} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-brand-500/[0.04] hover:bg-brand-500/[0.08] cursor-pointer transition-colors">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: platform?.color + '20', color: platform?.color }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark truncate">{isRTL ? camp.name_ar : camp.name_en}</p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? platform?.ar : platform?.en} · {fmtMoney(camp.spent || 0)} EGP</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="m-0 text-xs font-bold text-brand-500">{stats2.leads || 0} {isRTL ? 'ليد' : 'leads'}</p>
                    <p className={`m-0 text-[9px] font-medium ${cpl > 300 ? 'text-red-500' : cpl > 200 ? 'text-amber-500' : 'text-emerald-500'}`}>CPL: {cpl || '—'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick Funnel */}
        <Card className="p-4">
          <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'القمع التسويقي' : 'Marketing Funnel'}</p>
          <div className="space-y-3">
            {[
              { label: isRTL ? 'الليدز' : 'Leads', value: funnelData.total, pct: 100, color: '#2F6BD3', width: 100 },
              { label: isRTL ? 'نشط' : 'Active', value: funnelData.contacted, pct: funnelData.contactedPct, color: '#C9860A', width: Math.max(funnelData.contactedPct, 15) },
              { label: isRTL ? 'فرص' : 'Opportunities', value: funnelData.opportunities, pct: funnelData.oppPct, color: '#6B21A8', width: Math.max(funnelData.total > 0 ? (funnelData.opportunities / funnelData.total) * 100 : 0, 10) },
              { label: isRTL ? 'صفقات' : 'Deals', value: funnelData.deals, pct: funnelData.dealPct, color: '#158A57', width: Math.max(funnelData.total > 0 ? (funnelData.deals / funnelData.total) * 100 : 0, 8) },
            ].map((stage, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-content dark:text-content-dark font-medium">{stage.label}</span>
                  <span className="text-content-muted dark:text-content-muted-dark">{stage.value} {i > 0 ? `(${stage.pct}%)` : ''}</span>
                </div>
                <div className="h-7 bg-brand-500/[0.06] rounded-lg overflow-hidden flex items-center justify-center mx-auto" style={{ width: stage.width + '%' }}>
                  <div className="w-full h-full rounded-lg flex items-center justify-center" style={{ backgroundColor: stage.color + '25' }}>
                    <span className="text-[10px] font-bold" style={{ color: stage.color }}>{stage.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-brand-500/[0.08] flex justify-between text-[11px]">
            <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'معدل التحويل الكلي' : 'Overall Conversion'}</span>
            <span className={`font-bold ${funnelData.overallPct > 5 ? 'text-emerald-500' : funnelData.overallPct > 2 ? 'text-amber-500' : 'text-red-500'}`}>{funnelData.overallPct}%</span>
          </div>
        </Card>
      </div>

      </>)}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══ CAMPAIGNS TAB ═══ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'campaigns' && (<>

      {/* ═══ SmartFilter ═══ */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isRTL ? 'ابحث عن حملة...' : 'Search campaign...'}
        resultsCount={filtered.length}
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* ═══ Mobile Cards ═══ */}
      <div className="md:hidden divide-y divide-edge/50 dark:divide-edge-dark/50 bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-4">
        {paginatedData.length === 0 ? (
          <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا توجد حملات' : 'No campaigns'}</div>
        ) : paginatedData.map(camp => {
          const stats = campaignStats[camp.id] || {};
          const platform = getPlatform(camp.platform);
          const status = getStatus(camp.status);
          return (
            <div key={camp.id} onClick={() => openDrawer(camp)} className="px-4 py-3.5 cursor-pointer active:bg-surface-bg dark:active:bg-brand-500/[0.06]" style={{ borderInlineStart: `3px solid ${platform?.color || '#2F6BD3'}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[13px] text-content dark:text-content-dark truncate flex-1">
                  {isRTL ? camp.name_ar : camp.name_en}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold ms-2 shrink-0" style={{ color: status?.color, backgroundColor: status?.color + '18' }}>
                  {isRTL ? status?.ar : status?.en}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-content-muted dark:text-content-muted-dark flex-wrap">
                <span style={{ color: platform?.color }}>{isRTL ? platform?.ar : platform?.en}</span>
                <span>{isRTL ? 'ميزانية' : 'Budget'}: {fmtMoney(camp.budget)}</span>
                <span className="font-bold text-brand-500">{stats.leads || 0} {isRTL ? 'ليد' : 'leads'}</span>
                {stats.repeats > 0 && <span className="text-amber-500">{stats.repeats} {isRTL ? 'تكرار' : 'repeat'}</span>}
                {stats.cpl > 0 && <span className={stats.cpl > 300 ? 'text-red-500' : stats.cpl > 200 ? 'text-amber-500' : 'text-emerald-500'}>CPL: {stats.cpl}</span>}
                {camp.created_by_name && <span className="text-content-muted dark:text-content-muted-dark">{camp.created_by_name}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Desktop Table ═══ */}
      <div className="hidden md:block overflow-x-auto bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark mb-4">
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr>
              <th className={thCls}>{isRTL ? 'الحملة' : 'Campaign'}</th>
              <th className={thCls}>{isRTL ? 'المنصة' : 'Platform'}</th>
              <th className={thCls}>{isRTL ? 'الحالة' : 'Status'}</th>
              <th className={thCls}>{isRTL ? 'النوع' : 'Type'}</th>
              <th className={thCls}>{isRTL ? 'الميزانية' : 'Budget'}</th>
              <th className={thCls}>{isRTL ? 'المصروف' : 'Spent'}</th>
              <th className={thCls}>{isRTL ? 'الليدز' : 'Leads'}</th>
              <th className={thCls}>{isRTL ? 'تكلفة/ليد' : 'CPL'}</th>
              <th className={thCls}>{isRTL ? 'مؤهّل' : 'Qualified'}</th>
              <th className={thCls}>{isRTL ? 'مرفوض%' : 'DQ%'}</th>
              <th className={thCls}>{isRTL ? 'التفاعلات' : 'Interactions'}</th>
              <th className={thCls}>{isRTL ? 'التحويل' : 'Conv.'}</th>
              <th className={thCls}>{isRTL ? 'أنشأها' : 'Created by'}</th>
              <th className={thCls}>{isRTL ? 'الفترة' : 'Period'}</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr><td colSpan={15} className="text-center py-12 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد حملات' : 'No campaigns'}</td></tr>
            ) : paginatedData.map(camp => {
              const stats = campaignStats[camp.id] || {};
              const platform = getPlatform(camp.platform);
              const status = getStatus(camp.status);
              const type = getType(camp.type);
              const spentPct = camp.budget > 0 ? Math.round((camp.spent || 0) / camp.budget * 100) : 0;
              return (
                <tr key={camp.id} onClick={() => openDrawer(camp)} className="cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/[0.04] border-b border-edge/50 dark:border-edge-dark/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? camp.name_ar : camp.name_en}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: platform?.color, backgroundColor: (platform?.color || '#666') + '18' }}>
                      {isRTL ? platform?.ar : platform?.en}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: status?.color, backgroundColor: (status?.color || '#666') + '18' }}>
                      {isRTL ? status?.ar : status?.en}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? type?.ar : type?.en}</td>
                  <td className="px-4 py-3 text-xs font-medium text-content dark:text-content-dark">{fmtMoney(camp.budget)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-content dark:text-content-dark">{fmtMoney(camp.spent || 0)}</span>
                      <span className={`text-[9px] ${spentPct > 90 ? 'text-red-500' : spentPct > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>({spentPct}%)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-brand-500">{stats.leads || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${stats.cpl > 300 ? 'text-red-500' : stats.cpl > 200 ? 'text-amber-500' : stats.cpl > 0 ? 'text-emerald-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                      {stats.cpl > 0 ? stats.cpl + '' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-600">{stats.qualified || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${stats.disqualRate > 60 ? 'text-red-500' : stats.disqualRate > 30 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                      {stats.disqualRate || 0}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-content dark:text-content-dark">{stats.totalInteractions || 0}</span>
                    {stats.repeats > 0 && <span className="text-[9px] text-amber-500 ms-1">+{stats.repeats}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${stats.conversionRate > 50 ? 'text-emerald-500' : stats.conversionRate > 20 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                      {stats.conversionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-content dark:text-content-dark">{camp.created_by_name || '—'}</td>
                  <td className="px-4 py-3 text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                    {camp.start_date && new Date(camp.start_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                    {camp.end_date && (' → ' + new Date(camp.end_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }))}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditTarget(camp); setModalOpen(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer hover:bg-brand-500/[0.15]"><Pencil size={12} /></button>
                      <button onClick={() => handleDelete(camp.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/[0.08] border border-red-500/20 text-red-500 cursor-pointer hover:bg-red-500/[0.15]"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />

      {/* ═══ Summary Bar ═══ */}
      <div className="px-4 py-3 rounded-lg bg-brand-500/[0.06] border border-brand-500/[0.15] flex flex-wrap gap-5 text-xs text-brand-800 dark:text-brand-300 mb-4">
        <span>{isRTL ? 'الميزانية:' : 'Budget:'} <strong>{fmtMoney(totalBudget)} EGP</strong></span>
        <span>{isRTL ? 'المصروف:' : 'Spent:'} <strong>{fmtMoney(totalSpent)} EGP</strong> ({totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0}%)</span>
        <span>{isRTL ? 'الليدز:' : 'Leads:'} <strong>{totalLeads}</strong></span>
        <span>{isRTL ? 'متوسط CPL:' : 'Avg CPL:'} <strong>{avgCPL} EGP</strong></span>
        <span>{isRTL ? 'التفاعلات:' : 'Interactions:'} <strong>{totalInteractions}</strong></span>
      </div>

      </>)}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══ CHANNELS TAB ═══ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'channels' && (<>

      {/* Channel KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={PieChart} label={isRTL ? 'قنوات نشطة' : 'Active Channels'} value={PLATFORMS.filter(p => channelStats[p.id]?.campaigns > 0).length} color="#2F6BD3" />
        <KpiCard icon={DollarSign} label={isRTL ? 'أعلى إنفاق' : 'Top Spend'} value={(() => { const top = [...PLATFORMS].sort((a, b) => (channelStats[b.id]?.spent || 0) - (channelStats[a.id]?.spent || 0))[0]; return top ? (isRTL ? top.ar : top.en) : '—'; })()} color="#D6403B" />
        <KpiCard icon={Users} label={isRTL ? 'أفضل قناة (ليدز)' : 'Best Channel (Leads)'} value={(() => { const top = [...PLATFORMS].sort((a, b) => (channelStats[b.id]?.leads || 0) - (channelStats[a.id]?.leads || 0))[0]; return top ? (isRTL ? top.ar : top.en) : '—'; })()} color="#158A57" />
        <KpiCard icon={Target} label={isRTL ? 'أقل CPL' : 'Lowest CPL'} value={(() => { const sorted = PLATFORMS.filter(p => channelStats[p.id]?.leads > 0).sort((a, b) => ((channelStats[a.id]?.spent || 0) / channelStats[a.id].leads) - ((channelStats[b.id]?.spent || 0) / channelStats[b.id].leads)); return sorted[0] ? (isRTL ? sorted[0].ar : sorted[0].en) : '—'; })()} color="#158A57" />
      </div>

      {/* Channel Comparison Table */}
      <div className="overflow-x-auto bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark mb-5">
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className={thCls}>{isRTL ? 'القناة' : 'Channel'}</th>
              <th className={thCls}>{isRTL ? 'الحملات' : 'Campaigns'}</th>
              <th className={thCls}>{isRTL ? 'الميزانية' : 'Budget'}</th>
              <th className={thCls}>{isRTL ? 'المصروف' : 'Spent'}</th>
              <th className={thCls}>{isRTL ? 'الليدز' : 'Leads'}</th>
              <th className={thCls}>{isRTL ? 'تكلفة/ليد' : 'CPL'}</th>
              <th className={thCls}>{isRTL ? 'التفاعلات' : 'Interactions'}</th>
              <th className={thCls}>{isRTL ? 'حصة الميزانية' : 'Budget Share'}</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORMS.filter(p => channelStats[p.id]?.campaigns > 0).sort((a, b) => (channelStats[b.id]?.leads || 0) - (channelStats[a.id]?.leads || 0)).map(p => {
              const ch = channelStats[p.id];
              const cpl = ch.leads > 0 ? Math.round(ch.spent / ch.leads) : 0;
              const budgetShare = totalBudget > 0 ? Math.round((ch.budget / totalBudget) * 100) : 0;
              const spentPct = ch.budget > 0 ? Math.round((ch.spent / ch.budget) * 100) : 0;
              return (
                <tr key={p.id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-surface-bg dark:hover:bg-brand-500/[0.04]">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-content dark:text-content-dark">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {isRTL ? p.ar : p.en}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-content dark:text-content-dark">{ch.campaigns}</td>
                  <td className="px-4 py-3 text-xs font-medium text-content dark:text-content-dark">{fmtMoney(ch.budget)} EGP</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-content dark:text-content-dark">{fmtMoney(ch.spent)}</span>
                      <span className={`text-[9px] ${spentPct > 90 ? 'text-red-500' : spentPct > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>({spentPct}%)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-brand-500">{ch.leads}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${cpl > 300 ? 'text-red-500' : cpl > 200 ? 'text-amber-500' : cpl > 0 ? 'text-emerald-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                      {cpl > 0 ? cpl + ' EGP' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-content dark:text-content-dark">
                    {ch.interactions}
                    {ch.repeats > 0 && <span className="text-[9px] text-amber-500 ms-1">+{ch.repeats}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-brand-500/[0.06] rounded-full overflow-hidden max-w-[80px]">
                        <div className="h-full rounded-full" style={{ width: budgetShare + '%', backgroundColor: p.color }} />
                      </div>
                      <span className="text-[10px] font-medium text-content-muted dark:text-content-muted-dark">{budgetShare}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Channel Visual Comparison */}
      <Card className="p-4 mb-5">
        <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'مقارنة القنوات (ليدز vs تكلفة/ليد)' : 'Channel Comparison (Leads vs CPL)'}</p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {PLATFORMS.filter(p => channelStats[p.id]?.leads > 0).sort((a, b) => (channelStats[b.id]?.leads || 0) - (channelStats[a.id]?.leads || 0)).map(p => {
            const ch = channelStats[p.id];
            const maxLeads2 = Math.max(...PLATFORMS.map(pl => channelStats[pl.id]?.leads || 0), 1);
            const barH = Math.max(((ch.leads || 0) / maxLeads2) * 90, 8);
            const cpl = ch.leads > 0 ? Math.round(ch.spent / ch.leads) : 0;
            return (
              <div key={p.id} className="flex flex-col items-center min-w-[70px]">
                <div className="flex items-end h-[100px] mb-1">
                  <div className="w-10 rounded-t-lg" style={{ height: barH, backgroundColor: p.color }} />
                </div>
                <span className="text-[10px] font-bold text-content dark:text-content-dark">{ch.leads}</span>
                <span className={`text-[9px] font-medium ${cpl > 300 ? 'text-red-500' : cpl > 200 ? 'text-amber-500' : 'text-emerald-500'}`}>{cpl > 0 ? 'CPL ' + cpl : ''}</span>
                <span className="text-[9px] text-content-muted dark:text-content-muted-dark mt-0.5">{isRTL ? p.ar : p.en}</span>
              </div>
            );
          })}
        </div>
      </Card>

      </>)}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══ FUNNEL TAB ═══ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'funnel' && (<>

      {/* Funnel KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Users} label={isRTL ? 'إجمالي الليدز' : 'Total Leads'} value={funnelData.total} color="#2F6BD3" />
        <KpiCard icon={Phone} label={isRTL ? 'نشط' : 'Active'} value={`${funnelData.contacted} (${funnelData.contactedPct}%)`} color="#C9860A" />
        <KpiCard icon={Target} label={isRTL ? 'فرص' : 'Opportunities'} value={`${funnelData.opportunities} (${funnelData.oppPct}%)`} color="#6B21A8" />
        <KpiCard icon={DollarSign} label={isRTL ? 'صفقات' : 'Deals Won'} value={`${funnelData.deals} (${funnelData.overallPct}%)`} color="#158A57" />
      </div>

      {/* Full Funnel Visual */}
      <Card className="p-5 mb-5">
        <p className="m-0 mb-4 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'القمع التسويقي الكامل' : 'Full Marketing Funnel'}</p>
        <div className="space-y-3 max-w-[500px] mx-auto">
          {[
            { label: isRTL ? 'ليد جديد' : 'New Lead', value: funnelData.total, color: '#2F6BD3', w: 100 },
            { label: isRTL ? 'نشط' : 'Active', value: funnelData.contacted, color: '#C9860A', w: funnelData.total > 0 ? Math.max((funnelData.contacted / funnelData.total) * 100, 20) : 20 },
            { label: isRTL ? 'فرصة' : 'Opportunity', value: funnelData.opportunities, color: '#6B21A8', w: funnelData.total > 0 ? Math.max((funnelData.opportunities / funnelData.total) * 100, 15) : 15 },
            { label: isRTL ? 'صفقة ناجحة' : 'Won Deal', value: funnelData.deals, color: '#158A57', w: funnelData.total > 0 ? Math.max((funnelData.deals / funnelData.total) * 100, 10) : 10 },
          ].map((stage, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] w-20 text-end text-content-muted dark:text-content-muted-dark shrink-0">{stage.label}</span>
              <div className="h-9 rounded-lg flex items-center justify-center transition-all" style={{ width: stage.w + '%', backgroundColor: stage.color + '20', borderInlineStart: `3px solid ${stage.color}` }}>
                <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.value}</span>
              </div>
              {i > 0 && (
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark shrink-0">
                  {i === 1 ? funnelData.contactedPct : i === 2 ? funnelData.oppPct : funnelData.dealPct}%
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-brand-500/[0.08] text-center">
          <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'معدل التحويل الكلي (ليد → صفقة):' : 'Overall Conversion (Lead → Deal):'}</span>
          <span className={`text-sm font-bold ms-2 ${funnelData.overallPct > 5 ? 'text-emerald-500' : funnelData.overallPct > 2 ? 'text-amber-500' : 'text-red-500'}`}>{funnelData.overallPct}%</span>
        </div>
      </Card>

      {/* Per-Channel Funnel */}
      <Card className="p-4 mb-5">
        <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'القمع حسب القناة' : 'Funnel by Channel'}</p>
        <div className="overflow-x-auto">
          <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className={thCls}>{isRTL ? 'القناة' : 'Channel'}</th>
                <th className={thCls}>{isRTL ? 'ليدز' : 'Leads'}</th>
                <th className={thCls}>{isRTL ? 'تواصل' : 'Contacted'}</th>
                <th className={thCls}>{isRTL ? 'فرص' : 'Opps'}</th>
                <th className={thCls}>{isRTL ? 'صفقات' : 'Deals'}</th>
                <th className={thCls}>{isRTL ? 'التحويل' : 'Conv.'}</th>
              </tr>
            </thead>
            <tbody>
              {funnelData.byChannel.map(ch => {
                const conv = ch.leads > 0 ? Math.round((ch.deals / ch.leads) * 100) : 0;
                return (
                  <tr key={ch.platform.id} className="border-b border-edge/50 dark:border-edge-dark/50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-xs font-semibold text-content dark:text-content-dark">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ch.platform.color }} />
                        {isRTL ? ch.platform.ar : ch.platform.en}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-brand-500">{ch.leads}</td>
                    <td className="px-4 py-3 text-xs text-content dark:text-content-dark">
                      {ch.contacted} <span className="text-[9px] text-content-muted dark:text-content-muted-dark">({ch.leads > 0 ? Math.round((ch.contacted / ch.leads) * 100) : 0}%)</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-content dark:text-content-dark">{ch.opps}</td>
                    <td className="px-4 py-3 text-xs text-content dark:text-content-dark">{ch.deals}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${conv > 5 ? 'text-emerald-500' : conv > 2 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>{conv}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      </>)}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══ ROI REPORT TAB ═══ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'roi' && (<>

      {/* ═══ ROI KPI Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <KpiCard icon={DollarSign} label={isRTL ? 'إجمالي المصروف' : 'Total Spent'} value={fmtMoney(roiData.totalSpentAll) + ' EGP'} color="#D6403B" />
        <KpiCard icon={Users} label={isRTL ? 'إجمالي الليدز' : 'Total Leads'} value={roiData.totalLeadsAll} color="#2F6BD3" />
        <KpiCard icon={CircleDollarSign} label={isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'} value={fmtMoney(roiData.totalCommission) + ' EGP'} color="#158A57" />
        <KpiCard icon={TrendingUp} label={isRTL ? 'متوسط ROI' : 'Average ROI'} value={roiData.avgRoi + '%'} color={roiData.avgRoi > 0 ? '#158A57' : '#D6403B'} />
        <KpiCard
          icon={Award}
          label={isRTL ? 'أفضل حملة' : 'Best Campaign'}
          value={roiData.bestCampaign ? (isRTL ? roiData.bestCampaign.name_ar : roiData.bestCampaign.name_en) : '—'}
          color="#6B21A8"
          sub={roiData.bestCampaign ? `ROI: ${roiData.bestCampaign.roi}%` : ''}
        />
      </div>

      {/* ═══ ROI Summary Cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card className="p-4 text-center">
          <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'إجمالي الصفقات الناجحة' : 'Total Won Deals'}</p>
          <p className="m-0 text-2xl font-bold text-emerald-500">{roiData.totalDealsWon}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'تكلفة الليد الكلية' : 'Overall Cost/Lead'}</p>
          <p className="m-0 text-2xl font-bold text-brand-500">{roiData.totalLeadsAll > 0 ? fmtMoney(Math.round(roiData.totalSpentAll / roiData.totalLeadsAll)) : '—'} <span className="text-sm">EGP</span></p>
        </Card>
        <Card className="p-4 text-center">
          <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'تكلفة الصفقة الكلية' : 'Overall Cost/Deal'}</p>
          <p className="m-0 text-2xl font-bold text-amber-500">{roiData.totalDealsWon > 0 ? fmtMoney(Math.round(roiData.totalSpentAll / roiData.totalDealsWon)) : '—'} <span className="text-sm">EGP</span></p>
        </Card>
      </div>

      {/* ═══ ROI Bar Chart ═══ */}
      <Card className="p-4 mb-5">
        <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'ROI حسب الحملة' : 'ROI by Campaign'}</p>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={sortedRoiRows.map(r => ({ name: isRTL ? r.name_ar : r.name_en, ROI: r.roi, [isRTL ? 'المصروف' : 'Spent']: r.spent, [isRTL ? 'الإيرادات' : 'Revenue']: r.commission }))} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#aaa' : '#666' }} angle={-35} textAnchor="end" interval={0} height={80} reversed={isRTL} />
              <YAxis tick={{ fontSize: 10, fill: isDark ? '#aaa' : '#666' }} />
              <Tooltip
                contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}`, borderRadius: 8, fontSize: 12, direction: isRTL ? 'rtl' : 'ltr' }}
                formatter={(value, name) => [name === 'ROI' ? value + '%' : fmtMoney(value) + ' EGP', name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ROI" fill="#2F6BD3" radius={[4, 4, 0, 0]}>
                {sortedRoiRows.map((entry, idx) => (
                  <Cell key={idx} fill={entry.roi > 0 ? '#158A57' : '#D6403B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ═══ Spent vs Commission Chart ═══ */}
      <Card className="p-4 mb-5">
        <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'المصروف مقابل الإيرادات' : 'Spent vs Revenue'}</p>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={sortedRoiRows.filter(r => r.spent > 0 || r.commission > 0).map(r => ({ name: isRTL ? r.name_ar : r.name_en, [isRTL ? 'المصروف' : 'Spent']: r.spent, [isRTL ? 'الإيرادات' : 'Revenue']: r.commission }))} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#aaa' : '#666' }} angle={-35} textAnchor="end" interval={0} height={80} reversed={isRTL} />
              <YAxis tick={{ fontSize: 10, fill: isDark ? '#aaa' : '#666' }} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}`, borderRadius: 8, fontSize: 12, direction: isRTL ? 'rtl' : 'ltr' }} formatter={(value) => fmtMoney(value) + ' EGP'} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={isRTL ? 'المصروف' : 'Spent'} fill="#D6403B" radius={[4, 4, 0, 0]} />
              <Bar dataKey={isRTL ? 'الإيرادات' : 'Revenue'} fill="#158A57" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ═══ Campaign Performance Table ═══ */}
      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'تقرير أداء الحملات التفصيلي' : 'Detailed Campaign Performance Report'}</p>
          <ExportButton
            data={sortedRoiRows.map(r => ({
              name: isRTL ? r.name_ar : r.name_en,
              platform: getPlatform(r.platform) ? (isRTL ? getPlatform(r.platform).ar : getPlatform(r.platform).en) : r.platform,
              spent: r.spent,
              leads: r.leads,
              opportunities: r.opps,
              won_deals: r.wonDeals,
              commission: r.commission,
              cost_per_lead: r.costPerLead,
              cost_per_deal: r.costPerDeal,
              roi: r.roi + '%',
            }))}
            filename="campaign_roi_report"
            title={isRTL ? 'تقرير ROI' : 'ROI Report'}
            columns={[
              { header: isRTL ? 'الحملة' : 'Campaign', key: 'name' },
              { header: isRTL ? 'المنصة' : 'Platform', key: 'platform' },
              { header: isRTL ? 'المصروف' : 'Spent', key: 'spent' },
              { header: isRTL ? 'الليدز' : 'Leads', key: 'leads' },
              { header: isRTL ? 'الفرص' : 'Opps', key: 'opportunities' },
              { header: isRTL ? 'صفقات ناجحة' : 'Won Deals', key: 'won_deals' },
              { header: isRTL ? 'الإيرادات' : 'Revenue', key: 'commission' },
              { header: isRTL ? 'تكلفة/ليد' : 'Cost/Lead', key: 'cost_per_lead' },
              { header: isRTL ? 'تكلفة/صفقة' : 'Cost/Deal', key: 'cost_per_deal' },
              { header: 'ROI %', key: 'roi' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr>
                {[
                  { key: 'name_ar', label: isRTL ? 'الحملة' : 'Campaign' },
                  { key: 'platform', label: isRTL ? 'المنصة' : 'Platform' },
                  { key: 'spent', label: isRTL ? 'المصروف' : 'Spent' },
                  { key: 'leads', label: isRTL ? 'الليدز' : 'Leads' },
                  { key: 'opps', label: isRTL ? 'الفرص' : 'Opps' },
                  { key: 'wonDeals', label: isRTL ? 'صفقات ناجحة' : 'Won Deals' },
                  { key: 'commission', label: isRTL ? 'الإيرادات' : 'Revenue' },
                  { key: 'costPerLead', label: isRTL ? 'تكلفة/ليد' : 'Cost/Lead' },
                  { key: 'costPerDeal', label: isRTL ? 'تكلفة/صفقة' : 'Cost/Deal' },
                  { key: 'roi', label: 'ROI %' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleRoiSort(col.key)}
                    className={`${thCls} cursor-pointer select-none hover:bg-brand-500/[0.06] transition-colors`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {roiSortField === col.key && (roiSortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRoiRows.map(row => {
                const platform = getPlatform(row.platform);
                const status = getStatus(row.status);
                return (
                  <tr key={row.id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-brand-500/[0.03] transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? row.name_ar : row.name_en}</span>
                        {status && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ color: status.color, backgroundColor: status.color + '18' }}>{isRTL ? status.ar : status.en}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: platform?.color || '#666' }} />
                        {isRTL ? platform?.ar : platform?.en}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-red-500">{fmtMoney(row.spent)} <span className="text-[9px]">EGP</span></td>
                    <td className="px-3 py-3 text-xs font-bold text-brand-500">{row.leads}</td>
                    <td className="px-3 py-3 text-xs text-content dark:text-content-dark">{row.opps}</td>
                    <td className="px-3 py-3 text-xs font-bold text-emerald-500">{row.wonDeals}</td>
                    <td className="px-3 py-3 text-xs font-medium text-emerald-600">{row.commission > 0 ? fmtMoney(row.commission) + ' EGP' : '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${row.costPerLead > 300 ? 'text-red-500' : row.costPerLead > 200 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {row.costPerLead > 0 ? fmtMoney(row.costPerLead) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${row.costPerDeal > 5000 ? 'text-red-500' : row.costPerDeal > 2000 ? 'text-amber-500' : row.costPerDeal > 0 ? 'text-emerald-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                        {row.costPerDeal > 0 ? fmtMoney(row.costPerDeal) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${row.roi > 0 ? 'bg-emerald-500/10 text-emerald-500' : row.roi === 0 ? 'bg-gray-500/10 text-content-muted dark:text-content-muted-dark' : 'bg-red-500/10 text-red-500'}`}>
                        {row.roi > 0 ? <TrendingUp size={12} /> : row.roi < 0 ? <TrendingDown size={12} /> : null}
                        {row.roi}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr className="border-t-2 border-brand-500/20 bg-brand-500/[0.04]">
                <td className="px-3 py-3 text-xs font-bold text-content dark:text-content-dark" colSpan={2}>{isRTL ? 'الإجمالي' : 'Total'}</td>
                <td className="px-3 py-3 text-xs font-bold text-red-500">{fmtMoney(roiData.totalSpentAll)} <span className="text-[9px]">EGP</span></td>
                <td className="px-3 py-3 text-xs font-bold text-brand-500">{roiData.totalLeadsAll}</td>
                <td className="px-3 py-3 text-xs font-bold text-content dark:text-content-dark">{roiData.rows.reduce((s, r) => s + r.opps, 0)}</td>
                <td className="px-3 py-3 text-xs font-bold text-emerald-500">{roiData.totalDealsWon}</td>
                <td className="px-3 py-3 text-xs font-bold text-emerald-600">{roiData.totalCommission > 0 ? fmtMoney(roiData.totalCommission) + ' EGP' : '—'}</td>
                <td className="px-3 py-3 text-xs font-bold text-brand-500">{roiData.totalLeadsAll > 0 ? fmtMoney(Math.round(roiData.totalSpentAll / roiData.totalLeadsAll)) : '—'}</td>
                <td className="px-3 py-3 text-xs font-bold text-amber-500">{roiData.totalDealsWon > 0 ? fmtMoney(Math.round(roiData.totalSpentAll / roiData.totalDealsWon)) : '—'}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-bold ${roiData.totalSpentAll > 0 ? (((roiData.totalCommission - roiData.totalSpentAll) / roiData.totalSpentAll * 100) > 0 ? 'text-emerald-500' : 'text-red-500') : 'text-content-muted'}`}>
                    {roiData.totalSpentAll > 0 ? Math.round(((roiData.totalCommission - roiData.totalSpentAll) / roiData.totalSpentAll) * 100) + '%' : '—'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ═══ ROI Mobile Cards (for smaller screens) ═══ */}
      <div className="md:hidden space-y-3 mb-5">
        {sortedRoiRows.map(row => {
          const platform = getPlatform(row.platform);
          return (
            <Card key={row.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: platform?.color || '#666' }} />
                  <span className="text-xs font-bold text-content dark:text-content-dark truncate">{isRTL ? row.name_ar : row.name_en}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${row.roi > 0 ? 'bg-emerald-500/10 text-emerald-500' : row.roi < 0 ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-content-muted dark:text-content-muted-dark'}`}>
                  ROI: {row.roi}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-brand-500/[0.06] rounded-lg px-2 py-2">
                  <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المصروف' : 'Spent'}</p>
                  <p className="m-0 text-[11px] font-bold text-red-500">{fmtMoney(row.spent)}</p>
                </div>
                <div className="bg-brand-500/[0.06] rounded-lg px-2 py-2">
                  <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'الليدز' : 'Leads'}</p>
                  <p className="m-0 text-[11px] font-bold text-brand-500">{row.leads}</p>
                </div>
                <div className="bg-brand-500/[0.06] rounded-lg px-2 py-2">
                  <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'الإيرادات' : 'Revenue'}</p>
                  <p className="m-0 text-[11px] font-bold text-emerald-500">{row.commission > 0 ? fmtMoney(row.commission) : '—'}</p>
                </div>
                <div className="bg-brand-500/[0.06] rounded-lg px-2 py-2">
                  <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'صفقات' : 'Deals'}</p>
                  <p className="m-0 text-[11px] font-bold text-emerald-500">{row.wonDeals}</p>
                </div>
                <div className="bg-brand-500/[0.06] rounded-lg px-2 py-2">
                  <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'تكلفة/ليد' : 'CPL'}</p>
                  <p className={`m-0 text-[11px] font-bold ${row.costPerLead > 300 ? 'text-red-500' : 'text-emerald-500'}`}>{row.costPerLead > 0 ? row.costPerLead : '—'}</p>
                </div>
                <div className="bg-brand-500/[0.06] rounded-lg px-2 py-2">
                  <p className="m-0 text-[9px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'تكلفة/صفقة' : 'CPD'}</p>
                  <p className="m-0 text-[11px] font-bold text-amber-500">{row.costPerDeal > 0 ? fmtMoney(row.costPerDeal) : '—'}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      </>)}

      {/* ═══ Campaign Drawer ═══ */}
      {selectedCampaign && (() => {
        const camp = selectedCampaign;
        const stats = campaignStats[camp.id] || {};
        const platform = getPlatform(camp.platform);
        const status = getStatus(camp.status);
        const type = getType(camp.type);
        const linkedContacts = drawerContacts;
        const spentPct = camp.budget > 0 ? Math.round((camp.spent || 0) / camp.budget * 100) : 0;

        // Interaction log
        const interactions = [];
        linkedContacts.forEach(c => {
          (c.campaign_interactions || []).forEach(i => {
            const idMatch = i.campaign_id && i.campaign_id === camp.id;
            const ic = i.campaign?.toLowerCase().trim();
            if (idMatch || ic === camp.name_en?.toLowerCase().trim() || ic === camp.name_ar?.toLowerCase().trim()) {
              interactions.push({ ...i, contact_name: c.full_name, contact_phone: c.phone, contact_id: c.id });
            }
          });
          if (!c.campaign_interactions?.length && c.campaign_name) {
            const idMatch = c.campaign_id && c.campaign_id === camp.id;
            const cn = c.campaign_name.toLowerCase().trim();
            if (idMatch || cn === camp.name_en?.toLowerCase().trim() || cn === camp.name_ar?.toLowerCase().trim()) {
              interactions.push({ campaign: c.campaign_name, source: c.source, date: c.created_at, contact_name: c.full_name, contact_phone: c.phone, contact_id: c.id });
            }
          }
        });
        interactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return (
          <div className="fixed inset-0 z-[200] flex" onClick={() => setSelectedCampaign(null)}>
            <div className="flex-1 bg-black/40" />
            <div onClick={e => e.stopPropagation()} className={`w-full max-w-[480px] bg-surface-card dark:bg-surface-card-dark border-s border-edge dark:border-edge-dark shadow-2xl flex flex-col h-full overflow-hidden ${isRTL ? 'order-first border-e border-s-0' : ''}`}>

              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-edge dark:border-edge-dark flex items-center gap-3">
                <div className="flex gap-1">
                  <button onClick={handlePrev} disabled={selectedIdx <= 0} className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                  <button onClick={handleNext} disabled={selectedIdx >= filtered.length - 1} className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">{isRTL ? camp.name_ar : camp.name_en}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: platform?.color, backgroundColor: (platform?.color || '#666') + '18' }}>{isRTL ? platform?.ar : platform?.en}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: status?.color, backgroundColor: (status?.color || '#666') + '18' }}>{isRTL ? status?.ar : status?.en}</span>
                  </div>
                </div>
                <button onClick={() => { setEditTarget(camp); setModalOpen(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer"><Pencil size={14} /></button>
                <button onClick={() => setSelectedCampaign(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={14} /></button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: isRTL ? 'الليدز' : 'Leads', value: stats.leads || 0, color: '#2F6BD3' },
                    { label: isRTL ? 'مؤهّل' : 'Qualified', value: stats.qualified || 0, color: '#158A57' },
                    { label: isRTL ? 'مرفوض' : 'Disqualified', value: `${stats.disqualified || 0}${stats.disqualRate ? ` (${stats.disqualRate}%)` : ''}`, color: stats.disqualRate > 60 ? '#D6403B' : stats.disqualRate > 30 ? '#C9860A' : '#6B7280' },
                    { label: isRTL ? 'تكلفة/ليد' : 'CPL', value: stats.cpl > 0 ? stats.cpl + '' : '—', color: stats.cpl > 300 ? '#D6403B' : stats.cpl > 200 ? '#C9860A' : '#158A57' },
                    { label: isRTL ? 'تكلفة/مؤهّل' : 'CPQL', value: stats.cpql > 0 ? stats.cpql + '' : '—', color: stats.cpql > 1000 ? '#D6403B' : stats.cpql > 500 ? '#C9860A' : '#158A57' },
                    { label: isRTL ? 'التحويل' : 'Conv.', value: stats.conversionRate + '%', color: stats.conversionRate > 50 ? '#158A57' : '#C9860A' },
                    { label: isRTL ? 'التفاعلات' : 'Interactions', value: stats.totalInteractions || 0, color: '#6B21A8' },
                    { label: isRTL ? 'تكرار' : 'Repeats', value: stats.repeats || 0, color: '#C9860A' },
                    { label: isRTL ? 'المصروف' : 'Spent', value: fmtMoney(camp.spent || 0), color: spentPct > 90 ? '#D6403B' : '#2F6BD3' },
                  ].map((item, i) => (
                    <div key={i} className="bg-brand-500/[0.06] rounded-xl px-3 py-2.5 text-center">
                      <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{item.label}</p>
                      <p className="m-0 text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Budget Progress */}
                <div className="bg-brand-500/[0.06] rounded-xl px-4 py-3">
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'الميزانية' : 'Budget'}</span>
                    <span className="text-content dark:text-content-dark font-medium">{fmtMoney(camp.spent || 0)} / {fmtMoney(camp.budget)} EGP</span>
                  </div>
                  <div className="h-2 bg-brand-500/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: Math.min(spentPct, 100) + '%', backgroundColor: spentPct > 90 ? '#D6403B' : spentPct > 70 ? '#C9860A' : '#158A57' }} />
                  </div>
                </div>

                {/* Campaign Details */}
                <div className="space-y-1.5">
                  {[
                    { label: isRTL ? 'أنشأها' : 'Created by', val: camp.created_by_name || '—' },
                    { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: camp.created_at ? new Date(camp.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                    { label: isRTL ? 'النوع' : 'Type', val: isRTL ? type?.ar : type?.en },
                    { label: isRTL ? 'البداية' : 'Start', val: camp.start_date || '—' },
                    { label: isRTL ? 'النهاية' : 'End', val: camp.end_date || '—' },
                    { label: isRTL ? 'ملاحظات' : 'Notes', val: camp.notes || '—' },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-brand-500/[0.06] text-xs">
                      <span className="text-content-muted dark:text-content-muted-dark">{row.label}</span>
                      <span className="text-content dark:text-content-dark font-medium">{row.val}</span>
                    </div>
                  ))}
                </div>

                {/* Linked Contacts */}
                <div>
                  <p className="m-0 mb-2 text-xs font-bold text-content dark:text-content-dark">
                    {isRTL ? 'الليدز المرتبطة' : 'Linked Leads'} <span className="text-brand-500">({stats.leads || 0})</span>
                    {!drawerLoading && (stats.leads || 0) > linkedContacts.length && (
                      <span className="text-[10px] font-normal text-content-muted dark:text-content-muted-dark ms-1">
                        {isRTL ? `· عرض ${linkedContacts.length}` : `· showing ${linkedContacts.length}`}
                      </span>
                    )}
                  </p>
                  {drawerLoading ? (
                    <p className="text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'جاري التحميل…' : 'Loading…'}</p>
                  ) : linkedContacts.length === 0 ? (
                    <p className="text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا يوجد ليدز مرتبطة بهذه الحملة' : 'No leads linked to this campaign'}</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {linkedContacts.map(c => {
                        const contactInteractions = (c.campaign_interactions || []).filter(i => {
                          if (i.campaign_id && i.campaign_id === camp.id) return true;
                          const ic = i.campaign?.toLowerCase().trim();
                          return ic === camp.name_en?.toLowerCase().trim() || ic === camp.name_ar?.toLowerCase().trim();
                        }).length;
                        return (
                          <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-brand-500/[0.04] rounded-lg text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-content dark:text-content-dark truncate">{c.full_name}</span>
                              {c.phone && <span className="text-content-muted dark:text-content-muted-dark font-mono text-[10px]">{c.phone.slice(0, 6)}**</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {contactInteractions > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">{contactInteractions}x</span>}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${['following', 'has_opportunity'].includes(c.contact_status) ? 'bg-emerald-500/10 text-emerald-500' : c.contact_status === 'contacted' ? 'bg-gray-500/10 text-gray-500' : c.contact_status === 'disqualified' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {['following', 'has_opportunity'].includes(c.contact_status) ? (isRTL ? 'متابعة' : 'Following') : c.contact_status === 'contacted' ? (isRTL ? 'تم التواصل' : 'Contacted') : c.contact_status === 'disqualified' ? (isRTL ? 'غير مؤهل' : 'Disqualified') : (isRTL ? 'جديد' : 'New')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Interaction Log */}
                {interactions.length > 0 && (
                  <details>
                    <summary className="text-[11px] text-brand-500 cursor-pointer font-semibold mb-2">{isRTL ? `سجل التفاعلات (${interactions.length})` : `Interaction Log (${interactions.length})`}</summary>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {interactions.map((int, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 border-b border-brand-500/[0.06] text-[11px]">
                          <span className="text-content dark:text-content-dark font-medium truncate">{int.contact_name}</span>
                          <span className="text-content-muted dark:text-content-muted-dark shrink-0 ms-2">
                            {int.date && new Date(int.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ Add/Edit Modal ═══ */}
      {modalOpen && <CampaignModal
        isRTL={isRTL}
        editTarget={editTarget}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
      />}

      {/* ═══ Delete confirm (replaces window.confirm — RTL + proper modal) ═══ */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title={isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}>
          <p className="text-sm text-content dark:text-content-dark m-0">
            {isRTL
              ? `حذف حملة "${deleteConfirm.name_ar || deleteConfirm.name_en || ''}"؟ لا يمكن التراجع.`
              : `Delete campaign "${deleteConfirm.name_en || deleteConfirm.name_ar || ''}"? This cannot be undone.`}
          </p>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant="danger" onClick={confirmDelete}>{isRTL ? 'حذف' : 'Delete'}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

// ── Campaign Modal ────────────────────────────────────────────────
function CampaignModal({ isRTL, editTarget, onClose, onSave }) {
  const [form, setForm] = useState({
    name_en: editTarget?.name_en || '',
    name_ar: editTarget?.name_ar || '',
    platform: editTarget?.platform || 'facebook',
    status: editTarget?.status || 'active',
    type: editTarget?.type || 'paid_ads',
    budget: editTarget?.budget || '',
    spent: editTarget?.spent || '',
    start_date: editTarget?.start_date || '',
    end_date: editTarget?.end_date || '',
    target_audience: editTarget?.target_audience || '',
    notes: editTarget?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name_en.trim()) return;
    setSaving(true);
    await onSave({ ...form, budget: Number(form.budget) || 0, spent: Number(form.spent) || 0 });
    setSaving(false);
  };

  const labelCls = 'block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1.5';

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[250] flex items-center justify-center p-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={e => e.stopPropagation()} className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h2 className="m-0 text-[15px] font-bold text-content dark:text-content-dark">
            {editTarget ? (isRTL ? 'تعديل الحملة' : 'Edit Campaign') : (isRTL ? 'حملة جديدة' : 'New Campaign')}
          </h2>
          <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>{isRTL ? 'الاسم (EN)' : 'Name (EN)'}</label><Input value={form.name_en} onChange={e => set('name_en', e.target.value)} placeholder="Campaign name" /></div>
            <div><label className={labelCls}>{isRTL ? 'الاسم (AR)' : 'Name (AR)'}</label><Input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} placeholder="اسم الحملة" dir="rtl" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{isRTL ? 'المنصة' : 'Platform'}</label>
              <Select value={form.platform} onChange={e => set('platform', e.target.value)}>
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{isRTL ? p.ar : p.en}</option>)}
              </Select>
            </div>
            <div>
              <label className={labelCls}>{isRTL ? 'الحالة' : 'Status'}</label>
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{isRTL ? s.ar : s.en}</option>)}
              </Select>
            </div>
            <div>
              <label className={labelCls}>{isRTL ? 'النوع' : 'Type'}</label>
              <Select value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(t => <option key={t.id} value={t.id}>{isRTL ? t.ar : t.en}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>{isRTL ? 'الميزانية (EGP)' : 'Budget (EGP)'}</label><Input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" /></div>
            <div><label className={labelCls}>{isRTL ? 'المصروف (EGP)' : 'Spent (EGP)'}</label><Input type="number" value={form.spent} onChange={e => set('spent', e.target.value)} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>{isRTL ? 'تاريخ البدء' : 'Start Date'}</label><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
            <div><label className={labelCls}>{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</label><Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>{isRTL ? 'ملاحظات' : 'Notes'}</label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
        </div>

        <div className="px-6 py-4 border-t border-edge dark:border-edge-dark flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSubmit} disabled={!form.name_en.trim() || saving}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {editTarget ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إضافة' : 'Add')}
          </Button>
        </div>
      </div>
    </div>
  );
}
