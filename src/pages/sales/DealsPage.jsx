import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Briefcase, DollarSign, TrendingUp, Users, BarChart3, X,
  ChevronUp, ChevronDown, Eye, FileCheck, Clock, CheckCircle2,
  AlertCircle, FileText, Building2, User, Phone, Calendar,
  ArrowUpDown, Hash, CreditCard, Banknote, Star,
} from 'lucide-react';
import { KpiCard, SmartFilter, applySmartFilters, ExportButton, Pagination, PageSkeleton, DocumentsSection } from '../../components/ui';
import { generateInvoiceHTML, getCompanyInfo } from '../../services/printService';
import PrintPreview from '../../components/ui/PrintPreview';
import { getWonDeals } from '../../services/dealsService';
import { logView } from '../../services/viewTrackingService';
import { addRecentItem } from '../../services/recentItemsService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { fmtMoney } from '../../utils/formatting';
import CustomFieldsRenderer from '../../components/ui/CustomFieldsRenderer';
import CommentsSection from '../../components/ui/CommentsSection';
import { thCls } from '../../utils/tableStyles';
import { isFavorite as checkFavorite, toggleFavorite } from '../../services/favoritesService';

// ── Status Config ────────────────────────────────────────────────
const STATUSES = [
  { id: 'new_deal',         ar: 'صفقة جديدة',     en: 'New Deal',         color: '#3B82F6' },
  { id: 'under_review',     ar: 'تحت المراجعة',    en: 'Under Review',     color: '#F59E0B' },
  { id: 'docs_collection',  ar: 'تجميع المستندات', en: 'Docs Collection',  color: '#8B5CF6' },
  { id: 'contract_prep',    ar: 'تحضير العقد',     en: 'Contract Prep',    color: '#F97316' },
  { id: 'contract_signed',  ar: 'عقد موقع',        en: 'Contract Signed',  color: '#10B981' },
  { id: 'completed',        ar: 'مكتملة',          en: 'Completed',        color: '#22C55E' },
  { id: 'cancelled',        ar: 'ملغية',           en: 'Cancelled',        color: '#EF4444' },
];

const DOC_LABELS = {
  national_id:          { ar: 'بطاقة الهوية',    en: 'National ID' },
  reservation_form:     { ar: 'استمارة الحجز',    en: 'Reservation Form' },
  down_payment_receipt: { ar: 'إيصال المقدم',     en: 'Down Payment Receipt' },
  contract:             { ar: 'العقد',            en: 'Contract' },
  developer_receipt:    { ar: 'إيصال المطور',     en: 'Developer Receipt' },
};

const getStatus = (id) => STATUSES.find(s => s.id === id) || STATUSES[0];

const STATIC_SMART_FIELDS = [
  { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: STATUSES.map(s => ({ value: s.id, label: s.ar, labelEn: s.en })) },
  { id: 'deal_value', label: 'قيمة الصفقة', labelEn: 'Deal Value', type: 'number' },
];

const SORT_OPTIONS = [
  { value: 'date_desc',  label: 'الأحدث',             labelEn: 'Newest' },
  { value: 'date_asc',   label: 'الأقدم',             labelEn: 'Oldest' },
  { value: 'value_desc', label: 'القيمة (الأعلى)',     labelEn: 'Value (High)' },
  { value: 'value_asc',  label: 'القيمة (الأقل)',      labelEn: 'Value (Low)' },
  { value: 'client',     label: 'العميل',              labelEn: 'Client' },
];


const docProgress = (docs) => {
  if (!docs || typeof docs !== 'object') return { done: 0, total: 5, pct: 0 };
  const keys = Object.keys(DOC_LABELS);
  const done = keys.filter(k => docs[k]).length;
  return { done, total: keys.length, pct: Math.round((done / keys.length) * 100) };
};

// ── Main Component ───────────────────────────────────────────────
export default function DealsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { auditFields, applyAuditFilters } = useAuditFilter('deal');

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [smartFilters, setSmartFilters] = useState([]);
  const [searchInput, setSearchInput, search] = useDebouncedSearch(300);
  const [sortBy, setSortBy] = useState('date_desc');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [printHTML, setPrintHTML] = useState(null);

  // ── Dynamic smart filter fields ──
  const SMART_FIELDS = useMemo(() => {
    const agentField = lang === 'ar' ? 'agent_ar' : 'agent_en';
    const agents = [...new Set(deals.map(d => d[agentField]).filter(Boolean))].sort();
    const projectField = lang === 'ar' ? 'project_ar' : 'project_en';
    const projects = [...new Set(deals.map(d => d[projectField]).filter(Boolean))].sort();
    return [
      STATIC_SMART_FIELDS[0], // status
      {
        id: agentField,
        label: 'السيلز', labelEn: 'Agent', type: 'select',
        options: agents.map(a => ({ value: a, label: a, labelEn: a })),
      },
      {
        id: projectField,
        label: 'المشروع', labelEn: 'Project', type: 'select',
        options: projects.map(p => ({ value: p, label: p, labelEn: p })),
      },
      STATIC_SMART_FIELDS[1], // deal_value
      { id: 'created_at', label: 'التاريخ', labelEn: 'Date', type: 'date' },
      ...auditFields,
    ];
  }, [deals, lang, auditFields]);

  // Load data
  useEffect(() => {
    getWonDeals().then(d => {
      setDeals(d || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...deals];
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.deal_number || '').toLowerCase().includes(q) ||
        (d.client_ar || '').toLowerCase().includes(q) ||
        (d.client_en || '').toLowerCase().includes(q) ||
        (d.agent_ar || '').toLowerCase().includes(q) ||
        (d.agent_en || '').toLowerCase().includes(q) ||
        (d.project_ar || '').toLowerCase().includes(q) ||
        (d.project_en || '').toLowerCase().includes(q) ||
        (d.phone || '').includes(q)
      );
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'value_desc': return (b.deal_value || 0) - (a.deal_value || 0);
        case 'value_asc': return (a.deal_value || 0) - (b.deal_value || 0);
        case 'client': return String(lang === 'ar' ? (a.client_ar || a.client_en || '') : (a.client_en || a.client_ar || '')).localeCompare(String(lang === 'ar' ? (b.client_ar || b.client_en || '') : (b.client_en || b.client_ar || '')), lang === 'ar' ? 'ar' : 'en');
        case 'date_desc': default: return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });
    return result;
  }, [deals, smartFilters, search, sortBy, lang]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  useEffect(() => { setPage(1); }, [smartFilters, search, sortBy, pageSize]);

  // KPIs
  const totalValue = (deals || []).reduce((s, d) => s + (d.deal_value || 0), 0);
  const avgValue = (deals || []).length > 0 ? Math.round(totalValue / (deals || []).length) : 0;
  const activeDeals = (deals || []).filter(d => d.status !== 'completed' && d.status !== 'cancelled').length;
  const completedDeals = (deals || []).filter(d => d.status === 'completed').length;
  const docsPending = (deals || []).filter(d => {
    const p = docProgress(d.documents);
    return p.pct < 100 && d.status !== 'cancelled';
  }).length;

  // Drawer nav
  const handlePrev = () => { if (selectedIdx > 0) { setSelectedDeal(filtered[selectedIdx - 1]); setSelectedIdx(selectedIdx - 1); } };
  const handleNext = () => { if (selectedIdx < filtered.length - 1) { setSelectedDeal(filtered[selectedIdx + 1]); setSelectedIdx(selectedIdx + 1); } };

  const openDrawer = useCallback((deal) => {
    const idx = filtered.findIndex(d => d.id === deal.id);
    setSelectedDeal(deal);
    setSelectedIdx(idx);
    logView({ entityType: 'deal', entityId: deal.id, entityName: deal.deal_number, viewer: profile });
    addRecentItem({ type: 'deal', id: deal.id, name: deal.deal_number || deal.client_name || 'Deal', path: '/deals?highlight=' + deal.id, extra: { deal_value: deal.deal_value, status: deal.status } });
  }, [filtered, profile]);

  // ── Skeleton ─────────────────────────────────────
  if (loading) return <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={6} />;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen pb-16">

      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Briefcase size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'الصفقات' : 'Deals'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL
                ? `${(deals || []).length} صفقة · ${fmtMoney(totalValue)} EGP إجمالي`
                : `${(deals || []).length} deals · ${fmtMoney(totalValue)} EGP total`}
            </p>
          </div>
        </div>
        <ExportButton
          data={filtered}
          filename="deals"
          title={isRTL ? 'الصفقات' : 'Deals'}
          columns={[
            { key: 'deal_number', label: isRTL ? 'رقم الصفقة' : 'Deal #' },
            { key: isRTL ? 'client_ar' : 'client_en', label: isRTL ? 'العميل' : 'Client' },
            { key: isRTL ? 'project_ar' : 'project_en', label: isRTL ? 'المشروع' : 'Project' },
            { key: 'deal_value', label: isRTL ? 'القيمة' : 'Value' },
            { key: 'status', label: isRTL ? 'الحالة' : 'Status' },
          ]}
        />
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <KpiCard icon={Briefcase} label={isRTL ? 'إجمالي الصفقات' : 'Total Deals'} value={(deals || []).length} color="#4A7AAB" />
        <KpiCard icon={DollarSign} label={isRTL ? 'إجمالي القيمة' : 'Total Value'} value={fmtMoney(totalValue) + ' EGP'} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={isRTL ? 'متوسط القيمة' : 'Avg Deal Value'} value={fmtMoney(avgValue) + ' EGP'} color="#6B21A8" />
        <KpiCard icon={Clock} label={isRTL ? 'صفقات نشطة' : 'Active Deals'} value={activeDeals} color="#F59E0B" />
        <KpiCard icon={CheckCircle2} label={isRTL ? 'مكتملة' : 'Completed'} value={completedDeals} color="#22C55E" />
        <KpiCard icon={FileText} label={isRTL ? 'مستندات ناقصة' : 'Docs Pending'} value={docsPending} color={docsPending > 0 ? '#EF4444' : '#22C55E'} />
      </div>

      {/* ═══ SmartFilter ═══ */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isRTL ? 'ابحث عن صفقة...' : 'Search deal...'}
        resultsCount={filtered.length}
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* ═══ Mobile Cards ═══ */}
      <div className="md:hidden divide-y divide-edge/50 dark:divide-edge-dark/50 bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا توجد صفقات' : 'No deals'}</div>
        ) : paged.map(deal => {
          const status = getStatus(deal.status);
          const dp = docProgress(deal.documents);
          return (
            <div key={deal.id} onClick={() => openDrawer(deal)} className="px-4 py-3.5 cursor-pointer active:bg-surface-bg dark:active:bg-brand-500/[0.06]" style={{ borderInlineStart: `3px solid ${status.color}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[13px] text-content dark:text-content-dark truncate flex-1">
                  {lang === 'ar' ? deal.client_ar : deal.client_en}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold ms-2 shrink-0" style={{ color: status.color, backgroundColor: status.color + '18' }}>
                  {isRTL ? status.ar : status.en}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-content-muted dark:text-content-muted-dark flex-wrap">
                <span className="font-mono text-brand-500">{deal.deal_number}</span>
                {(deal.project_ar || deal.project_en) && <span>{lang === 'ar' ? deal.project_ar : deal.project_en}</span>}
                <span className="font-bold text-content dark:text-content-dark">{fmtMoney(deal.deal_value)} EGP</span>
                <span className="flex items-center gap-1">
                  <FileCheck size={11} />
                  {dp.done}/{dp.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Desktop Table ═══ */}
      <div className="hidden md:block overflow-x-auto bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark mb-4">
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[1100px]">
          <thead>
            <tr>
              <th className={thCls}>{isRTL ? 'رقم الصفقة' : 'Deal #'}</th>
              <th className={thCls}>{isRTL ? 'العميل' : 'Client'}</th>
              <th className={thCls}>{isRTL ? 'المشروع / الوحدة' : 'Project / Unit'}</th>
              <th className={thCls}>{isRTL ? 'الموظف' : 'Agent'}</th>
              <th className={thCls}>{isRTL ? 'القيمة' : 'Value'}</th>
              <th className={thCls}>{isRTL ? 'المقدم' : 'Down Payment'}</th>
              <th className={thCls}>{isRTL ? 'الحالة' : 'Status'}</th>
              <th className={thCls}>{isRTL ? 'المستندات' : 'Documents'}</th>
              <th className={thCls}>{isRTL ? 'التاريخ' : 'Date'}</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد صفقات' : 'No deals'}</td></tr>
            ) : paged.map(deal => {
              const status = getStatus(deal.status);
              const dp = docProgress(deal.documents);
              return (
                <tr key={deal.id} onClick={() => openDrawer(deal)} className="cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/[0.04] border-b border-edge/50 dark:border-edge-dark/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono font-semibold text-brand-500">{deal.deal_number}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? deal.client_ar : deal.client_en}</div>
                    {deal.phone && <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 font-mono">{deal.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-content dark:text-content-dark">{lang === 'ar' ? deal.project_ar : deal.project_en || '—'}</div>
                    {deal.unit_code && <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5">{deal.unit_code} {lang === 'ar' ? deal.unit_type_ar : deal.unit_type_en}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-content dark:text-content-dark">{lang === 'ar' ? deal.agent_ar : deal.agent_en}</td>
                  <td className="px-4 py-3 text-xs font-bold text-content dark:text-content-dark">{fmtMoney(deal.deal_value)} EGP</td>
                  <td className="px-4 py-3 text-xs text-content dark:text-content-dark">{deal.down_payment ? fmtMoney(deal.down_payment) + ' EGP' : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: status.color, backgroundColor: status.color + '18' }}>
                      {isRTL ? status.ar : status.en}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12] min-w-[50px] max-w-[70px]">
                        <div className="h-full rounded" style={{ width: `${dp.pct}%`, backgroundColor: dp.pct === 100 ? '#22C55E' : dp.pct >= 60 ? '#F59E0B' : '#EF4444' }} />
                      </div>
                      <span className="text-[10px] font-medium text-content-muted dark:text-content-muted-dark">{dp.done}/{dp.total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                    {deal.created_at && new Date(deal.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); openDrawer(deal); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer hover:bg-brand-500/[0.15]">
                      <Eye size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ Pagination ═══ */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={filtered.length}
      />

      {/* ═══ Summary Bar ═══ */}
      <div className="px-4 py-3 rounded-lg bg-brand-500/[0.06] border border-brand-500/[0.15] flex flex-wrap gap-5 text-xs text-brand-800 dark:text-brand-300 mb-4">
        <span>{isRTL ? 'الإجمالي:' : 'Total:'} <strong>{fmtMoney(totalValue)} EGP</strong></span>
        <span>{isRTL ? 'المتوسط:' : 'Avg:'} <strong>{fmtMoney(avgValue)} EGP</strong></span>
        <span>{isRTL ? 'نشطة:' : 'Active:'} <strong>{activeDeals}</strong></span>
        <span>{isRTL ? 'مكتملة:' : 'Completed:'} <strong>{completedDeals}</strong></span>
        <span>{isRTL ? 'عرض:' : 'Showing:'} <strong>{filtered.length}</strong> / {(deals || []).length}</span>
      </div>

      {/* ═══ Deal Drawer ═══ */}
      {selectedDeal && (() => {
        const deal = selectedDeal;
        const status = getStatus(deal.status);
        const dp = docProgress(deal.documents);
        const downPct = deal.deal_value > 0 ? Math.round((deal.down_payment || 0) / deal.deal_value * 100) : 0;

        return (
          <div className="fixed inset-0 z-[200] flex" onClick={() => setSelectedDeal(null)}>
            <div className="flex-1 bg-black/40" />
            <div onClick={e => e.stopPropagation()} className={`w-full max-w-[480px] bg-surface-card dark:bg-surface-card-dark border-s border-edge dark:border-edge-dark shadow-2xl flex flex-col h-full overflow-hidden ${isRTL ? 'order-first border-e border-s-0' : ''}`}>

              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-edge dark:border-edge-dark flex items-center gap-3">
                <div className="flex gap-1">
                  <button onClick={handlePrev} disabled={selectedIdx <= 0} className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                  <button onClick={handleNext} disabled={selectedIdx >= filtered.length - 1} className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">{deal.deal_number}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: status.color, backgroundColor: status.color + '18' }}>
                      {isRTL ? status.ar : status.en}
                    </span>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark">
                      {deal.created_at && new Date(deal.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                {(() => {
                  const dealFavId = `deal_${deal.id}`;
                  const dealIsFav = checkFavorite(dealFavId);
                  return (
                    <button
                      onClick={() => {
                        toggleFavorite({
                          id: dealFavId,
                          type: 'deal',
                          name: deal.deal_number || (lang === 'en' ? (deal.client_en || deal.client_ar) : (deal.client_ar || deal.client_en)),
                          nameAr: deal.deal_number || deal.client_ar || deal.client_en || '',
                          path: `/sales/deals?highlight=${deal.id}`,
                        });
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border cursor-pointer"
                      style={{
                        background: 'transparent',
                        borderColor: dealIsFav ? '#F59E0B' : undefined,
                        color: dealIsFav ? '#F59E0B' : undefined,
                      }}
                      title={dealIsFav ? (isRTL ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRTL ? 'إضافة للمفضلة' : 'Add to Favorites')}
                    >
                      <Star size={14} fill={dealIsFav ? '#F59E0B' : 'none'} />
                    </button>
                  );
                })()}
                <button
                  onClick={() => {
                    const items = [
                      { description: isRTL ? (deal.project_ar || deal.project_en || 'وحدة') : (deal.project_en || deal.project_ar || 'Unit'), qty: 1, price: deal.deal_value || 0 },
                    ];
                    if (deal.down_payment) items.push({ description: isRTL ? 'مقدم مدفوع' : 'Down Payment (Paid)', qty: 1, price: -deal.down_payment });
                    setPrintHTML(generateInvoiceHTML({
                      ...deal,
                      invoice_number: deal.deal_number,
                      date: deal.created_at ? new Date(deal.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : new Date().toLocaleDateString(),
                      status: isRTL ? (STATUSES.find(s => s.id === deal.status)?.ar || '') : (STATUSES.find(s => s.id === deal.status)?.en || ''),
                    }, items, getCompanyInfo(), lang));
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-500/[0.08] border border-brand-500/20 text-brand-500 cursor-pointer hover:bg-brand-500/[0.15]"
                  title={isRTL ? 'طباعة' : 'Print'}
                >
                  <FileText size={14} />
                </button>
                <button onClick={() => setSelectedDeal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={14} /></button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* Client & Agent */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-brand-500/[0.06] rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <User size={12} className="text-brand-500" />
                      <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'العميل' : 'Client'}</span>
                    </div>
                    <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{lang === 'ar' ? deal.client_ar : deal.client_en}</p>
                    {deal.phone && <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark font-mono mt-0.5">{deal.phone}</p>}
                  </div>
                  <div className="bg-brand-500/[0.06] rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users size={12} className="text-brand-500" />
                      <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'الموظف' : 'Agent'}</span>
                    </div>
                    <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{lang === 'ar' ? deal.agent_ar : deal.agent_en}</p>
                  </div>
                </div>

                {/* Value Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-brand-500/[0.06] rounded-xl px-3 py-2.5 text-center">
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'قيمة الصفقة' : 'Deal Value'}</p>
                    <p className="m-0 text-sm font-bold text-brand-500">{fmtMoney(deal.deal_value)}</p>
                  </div>
                  <div className="bg-brand-500/[0.06] rounded-xl px-3 py-2.5 text-center">
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المقدم' : 'Down Payment'}</p>
                    <p className="m-0 text-sm font-bold text-emerald-500">{deal.down_payment ? fmtMoney(deal.down_payment) : '—'}</p>
                  </div>
                  <div className="bg-brand-500/[0.06] rounded-xl px-3 py-2.5 text-center">
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'الأقساط' : 'Installments'}</p>
                    <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{deal.installments_count || '—'}</p>
                  </div>
                </div>

                {/* Down Payment Progress */}
                {deal.down_payment > 0 && (
                  <div className="bg-brand-500/[0.06] rounded-xl px-4 py-3">
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'نسبة المقدم' : 'Down Payment %'}</span>
                      <span className="text-content dark:text-content-dark font-medium">{fmtMoney(deal.down_payment)} / {fmtMoney(deal.deal_value)} EGP ({downPct}%)</span>
                    </div>
                    <div className="h-2 bg-brand-500/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: Math.min(downPct, 100) + '%', backgroundColor: '#10B981' }} />
                    </div>
                  </div>
                )}

                {/* Deal Details */}
                <div className="space-y-1.5">
                  {[
                    { label: isRTL ? 'المشروع' : 'Project', val: lang === 'ar' ? deal.project_ar : deal.project_en, icon: Building2 },
                    { label: isRTL ? 'المطور' : 'Developer', val: lang === 'ar' ? deal.developer_ar : deal.developer_en, icon: Building2 },
                    { label: isRTL ? 'كود الوحدة' : 'Unit Code', val: deal.unit_code, icon: Hash },
                    { label: isRTL ? 'نوع الوحدة' : 'Unit Type', val: lang === 'ar' ? deal.unit_type_ar : deal.unit_type_en, icon: Building2 },
                    { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: deal.created_at ? new Date(deal.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—', icon: Calendar },
                  ].filter(row => row.val).map((row, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-brand-500/[0.06] text-xs">
                      <span className="text-content-muted dark:text-content-muted-dark flex items-center gap-1.5">
                        <row.icon size={12} />
                        {row.label}
                      </span>
                      <span className="text-content dark:text-content-dark font-medium">{row.val}</span>
                    </div>
                  ))}
                </div>

                {/* Document Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="m-0 text-xs font-bold text-content dark:text-content-dark flex items-center gap-1.5">
                      <FileCheck size={14} className="text-brand-500" />
                      {isRTL ? 'المستندات' : 'Documents'}
                    </p>
                    <span className={`text-[10px] font-bold ${dp.pct === 100 ? 'text-emerald-500' : dp.pct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                      {dp.done}/{dp.total} ({dp.pct}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-brand-500/10 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all" style={{ width: dp.pct + '%', backgroundColor: dp.pct === 100 ? '#22C55E' : dp.pct >= 60 ? '#F59E0B' : '#EF4444' }} />
                  </div>
                  {/* Checklist */}
                  <div className="space-y-1.5">
                    {Object.entries(DOC_LABELS).map(([key, labels]) => {
                      const checked = deal.documents?.[key] || false;
                      return (
                        <div key={key} className={`flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs ${checked ? 'bg-emerald-500/[0.06]' : 'bg-brand-500/[0.04]'}`}>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${checked ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-brand-500/[0.12]'}`}>
                            {checked && <CheckCircle2 size={13} />}
                          </div>
                          <span className={`flex-1 ${checked ? 'text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}>
                            {isRTL ? labels.ar : labels.en}
                          </span>
                          <span className={`text-[9px] font-semibold ${checked ? 'text-emerald-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                            {checked ? (isRTL ? 'مكتمل' : 'Done') : (isRTL ? 'ناقص' : 'Pending')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Attached Documents */}
                <DocumentsSection
                  entity="deal"
                  entityId={deal.id}
                  entityName={deal.deal_number || `Deal #${deal.id}`}
                />

                {/* Custom Fields */}
                <CustomFieldsRenderer entity="deal" entityId={deal.id} mode="edit" defaultCollapsed={false} />

                {/* Comments */}
                <CommentsSection
                  entity="deal"
                  entityId={deal.id}
                  entityName={deal.deal_number || `Deal #${deal.id}`}
                />

              </div>
            </div>
          </div>
        );
      })()}

      {/* Print Preview */}
      {printHTML && (
        <PrintPreview
          html={printHTML}
          title={isRTL ? 'فاتورة صفقة' : 'Deal Invoice'}
          onClose={() => setPrintHTML(null)}
        />
      )}

    </div>
  );
}
