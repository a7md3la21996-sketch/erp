import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import supabase from '../../lib/supabase';
import {
  History, ChevronDown, ChevronUp, Plus, Pencil, Trash2, RefreshCw,
  Ban, UserCheck, Users2, Merge, Upload, Thermometer, ArrowRightLeft,
  Activity, Calendar, User, BarChart3, Download, Clock,
} from 'lucide-react';
import { Button, Badge, Table, Th, Td, Tr, ExportButton, Pagination, KpiCard } from '../../components/ui';
import { ACTION_TYPES } from '../../services/auditService';

const ACTION_CONFIG = {
  create:             { variant: 'success', icon: Plus,           ar: 'إنشاء',               en: 'Create' },
  update:             { variant: 'default', icon: Pencil,         ar: 'تعديل',               en: 'Update' },
  delete:             { variant: 'danger',  icon: Trash2,         ar: 'حذف',                 en: 'Delete' },
  status_change:      { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير حالة',           en: 'Status Change' },
  type_change:        { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير نوع',           en: 'Type Change' },
  blacklist:          { variant: 'danger',  icon: Ban,            ar: 'بلاك ليست',           en: 'Blacklisted' },
  unblacklist:        { variant: 'success', icon: Ban,            ar: 'إلغاء بلاك ليست',     en: 'Unblacklisted' },
  reassign:           { variant: 'default', icon: UserCheck,      ar: 'إعادة تعيين',         en: 'Reassigned' },
  bulk_reassign:      { variant: 'default', icon: Users2,         ar: 'إعادة تعيين جماعي',   en: 'Bulk Reassign' },
  bulk_delete:        { variant: 'danger',  icon: Trash2,         ar: 'حذف جماعي',           en: 'Bulk Delete' },
  merge:              { variant: 'default', icon: Merge,          ar: 'دمج',                 en: 'Merge' },
  import:             { variant: 'success', icon: Upload,         ar: 'استيراد',              en: 'Import' },
  stage_change:       { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير مرحلة',         en: 'Stage Change' },
  temperature_change: { variant: 'default', icon: Thermometer,    ar: 'تغيير حرارة',         en: 'Temperature Change' },
  score_change:       { variant: 'default', icon: BarChart3,      ar: 'تغيير تقييم',         en: 'Score Change' },
  assign:             { variant: 'default', icon: UserCheck,      ar: 'تعيين',               en: 'Assigned' },
  batch_call:         { variant: 'default', icon: Plus,           ar: 'اتصال جماعي',         en: 'Batch Call' },
  note:               { variant: 'default', icon: Pencil,         ar: 'ملاحظة',              en: 'Note' },
};

const ENTITY_LABELS = {
  contact: { ar: 'جهة اتصال', en: 'Contact' }, opportunity: { ar: 'فرصة', en: 'Opportunity' },
  task: { ar: 'مهمة', en: 'Task' }, activity: { ar: 'نشاط', en: 'Activity' },
  employee: { ar: 'موظف', en: 'Employee' }, deal: { ar: 'صفقة', en: 'Deal' },
  campaign: { ar: 'حملة', en: 'Campaign' }, invoice: { ar: 'فاتورة', en: 'Invoice' },
  expense: { ar: 'مصروف', en: 'Expense' }, system: { ar: 'نظام', en: 'System' },
};

export default function AuditLogPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('changes'); // changes, views
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Views tab state
  const [views, setViews] = useState([]);
  const [viewsTotal, setViewsTotal] = useState(0);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewsPage, setViewsPage] = useState(1);
  const [viewSearch, setViewSearch] = useState('');
  const [viewUser, setViewUser] = useState('');
  const [viewDateRange, setViewDateRange] = useState('all');

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all'); // all, today, week, month, custom
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Users list (from users table, not audit_logs)
  const [userOptions, setUserOptions] = useState([]);
  useEffect(() => {
    supabase.from('users').select('id, full_name_en, full_name_ar').order('full_name_en').then(({ data }) => {
      setUserOptions((data || []).map(u => ({ value: u.id, label: u.full_name_ar || u.full_name_en, labelEn: u.full_name_en || u.full_name_ar })));
    });
  }, []);

  // KPIs
  const [kpis, setKpis] = useState({ total: 0, today: 0, users: 0 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, users:user_id (full_name_ar, full_name_en)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filterAction) query = query.eq('action', filterAction);
      if (filterEntity) query = query.eq('entity', filterEntity);
      if (filterUser) query = query.eq('user_id', filterUser);
      if (search) query = query.or(`description.ilike.%${search}%,entity_name.ilike.%${search}%`);

      // Date range
      const now = new Date();
      if (filterDateRange === 'today') {
        query = query.gte('created_at', now.toISOString().slice(0, 10) + 'T00:00:00');
      } else if (filterDateRange === 'week') {
        query = query.gte('created_at', new Date(now - 7 * 86400000).toISOString());
      } else if (filterDateRange === 'month') {
        query = query.gte('created_at', new Date(now - 30 * 86400000).toISOString());
      } else if (filterDateRange === 'custom') {
        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setLogs((data || []).map(row => ({
        ...row,
        _user_name_ar: row.users?.full_name_ar || row.user_name || '',
        _user_name_en: row.users?.full_name_en || row.user_name || '',
      })));
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Audit fetch error:', err);
      setLogs([]);
      setTotalCount(0);
    }
    setLoading(false);
  }, [page, pageSize, filterAction, filterEntity, filterUser, filterDateRange, dateFrom, dateTo, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Fetch view logs
  const fetchViews = useCallback(async () => {
    setViewsLoading(true);
    try {
      let q = supabase.from('view_logs').select('*', { count: 'exact' }).order('viewed_at', { ascending: false });
      if (viewUser) q = q.eq('user_id', viewUser);
      if (viewSearch) q = q.or(`entity_name.ilike.%${viewSearch}%,user_name.ilike.%${viewSearch}%`);
      const now = new Date();
      if (viewDateRange === 'today') q = q.gte('viewed_at', now.toISOString().slice(0, 10) + 'T00:00:00');
      else if (viewDateRange === 'week') q = q.gte('viewed_at', new Date(now - 7 * 86400000).toISOString());
      else if (viewDateRange === 'month') q = q.gte('viewed_at', new Date(now - 30 * 86400000).toISOString());
      const from = (viewsPage - 1) * pageSize;
      const { data, count } = await q.range(from, from + pageSize - 1);
      setViews(data || []);
      setViewsTotal(count || 0);
    } catch { setViews([]); setViewsTotal(0); }
    setViewsLoading(false);
  }, [viewsPage, viewUser, viewSearch, viewDateRange, pageSize]);

  useEffect(() => { if (activeTab === 'views') fetchViews(); }, [activeTab, fetchViews]);

  // Load KPIs separately
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [totalRes, todayRes] = await Promise.allSettled([
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00'),
      ]);
      setKpis({
        total: totalRes.status === 'fulfilled' ? totalRes.value.count || 0 : 0,
        today: todayRes.status === 'fulfilled' ? todayRes.value.count || 0 : 0,
        users: userOptions.length,
      });
    })();
  }, [userOptions.length]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const selectCls = "px-2.5 py-1.5 rounded-lg text-xs bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark cursor-pointer appearance-none";

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <History size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'سجل التدقيق' : 'Audit Log'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'جميع التغييرات في النظام' : 'All system changes'}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setPage(1); fetchLogs(); }}>
          <RefreshCw size={14} />{isRTL ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mb-5">
        <KpiCard icon={BarChart3} label={isRTL ? 'إجمالي السجلات' : 'Total Logs'} value={kpis.total} color="#4A7AAB" />
        <KpiCard icon={Calendar} label={isRTL ? 'إجراءات اليوم' : "Today's Actions"} value={kpis.today} color="#10B981" />
        <KpiCard icon={User} label={isRTL ? 'المستخدمين' : 'Users'} value={kpis.users} color="#8B5CF6" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setActiveTab('changes'); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${activeTab === 'changes' ? 'bg-brand-500 text-white border-none' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
          <Pencil size={12} className="inline me-1" /> {isRTL ? 'التغييرات' : 'Changes'}
        </button>
        <button onClick={() => { setActiveTab('views'); setViewsPage(1); }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${activeTab === 'views' ? 'bg-brand-500 text-white border-none' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
          <Activity size={12} className="inline me-1" /> {isRTL ? 'المشاهدات' : 'Views'}
        </button>
      </div>

      {activeTab === 'views' ? (<>
        {/* Views Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <select value={viewUser} onChange={e => { setViewUser(e.target.value); setViewsPage(1); }} className={selectCls}>
            <option value="">{isRTL ? 'كل المستخدمين' : 'All Users'}</option>
            {userOptions.map(u => <option key={u.value} value={u.value}>{isRTL ? u.label : u.labelEn}</option>)}
          </select>
          <select value={viewDateRange} onChange={e => { setViewDateRange(e.target.value); setViewsPage(1); }} className={selectCls}>
            <option value="all">{isRTL ? 'كل الأوقات' : 'All Time'}</option>
            <option value="today">{isRTL ? 'اليوم' : 'Today'}</option>
            <option value="week">{isRTL ? 'آخر أسبوع' : 'Last Week'}</option>
            <option value="month">{isRTL ? 'آخر شهر' : 'Last Month'}</option>
          </select>
          <input type="text" value={viewSearch} onChange={e => setViewSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchViews()}
            placeholder={isRTL ? 'بحث بالاسم...' : 'Search by name...'} className={`${selectCls} flex-1 min-w-[150px]`} dir="auto" />
        </div>
        <div className="text-xs text-content-muted dark:text-content-muted-dark mb-2">{isRTL ? `${viewsTotal} مشاهدة` : `${viewsTotal} views`}</div>

        {/* Views Table */}
        <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-4">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-edge dark:border-edge-dark">
                  <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'التاريخ' : 'Date'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'شاف مين' : 'Viewed By'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الدور' : 'Role'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'العميل' : 'Contact'}</th>
                  <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الجهاز' : 'Device'}</th>
                </tr>
              </thead>
              <tbody>
                {viewsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-edge/30 dark:border-edge-dark/30">
                      {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-3.5 rounded-md bg-gray-100 dark:bg-white/5 animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : views.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد مشاهدات' : 'No views found'}</td></tr>
                ) : views.map(v => (
                  <tr key={v.id} className="border-b border-edge/30 dark:border-edge-dark/30 hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
                    <td className="px-3 py-2.5 text-content-muted dark:text-content-muted-dark whitespace-nowrap">{formatDate(v.viewed_at)}</td>
                    <td className="px-3 py-2.5 font-medium text-content dark:text-content-dark">{v.user_name || '—'}</td>
                    <td className="px-3 py-2.5 text-content-muted dark:text-content-muted-dark">{v.user_role || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-brand-500">{v.entity_name || '—'}</td>
                    <td className="px-3 py-2.5 text-[10px] text-content-muted dark:text-content-muted-dark">{[v.device_type, v.browser, v.os].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden divide-y divide-edge dark:divide-edge-dark">
            {viewsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-4 py-3"><div className="h-10 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" /></div>)
            ) : views.length === 0 ? (
              <div className="text-center py-12 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد مشاهدات' : 'No views'}</div>
            ) : views.map(v => (
              <div key={v.id} className="px-4 py-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-content dark:text-content-dark">{v.user_name || '—'}</span>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{formatDate(v.viewed_at)}</span>
                </div>
                <div className="text-[11px] text-brand-500">{isRTL ? 'شاف:' : 'Viewed:'} {v.entity_name || '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <Pagination page={viewsPage} totalPages={Math.max(1, Math.ceil(viewsTotal / pageSize))} onPageChange={setViewsPage} />
      </>) : (<>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {/* Action filter */}
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">{isRTL ? 'كل الإجراءات' : 'All Actions'}</option>
          {Object.entries(ACTION_CONFIG).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
        </select>

        {/* Entity filter */}
        <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">{isRTL ? 'كل الكيانات' : 'All Entities'}</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
        </select>

        {/* User filter */}
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">{isRTL ? 'كل المستخدمين' : 'All Users'}</option>
          {userOptions.map(u => <option key={u.value} value={u.value}>{isRTL ? u.label : u.labelEn}</option>)}
        </select>

        {/* Date range */}
        <select value={filterDateRange} onChange={e => { setFilterDateRange(e.target.value); setPage(1); }} className={selectCls}>
          <option value="all">{isRTL ? 'كل الأوقات' : 'All Time'}</option>
          <option value="today">{isRTL ? 'اليوم' : 'Today'}</option>
          <option value="week">{isRTL ? 'آخر أسبوع' : 'Last Week'}</option>
          <option value="month">{isRTL ? 'آخر شهر' : 'Last Month'}</option>
          <option value="custom">{isRTL ? 'تاريخ محدد' : 'Custom'}</option>
        </select>

        {filterDateRange === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={selectCls} />
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={selectCls} />
          </>
        )}

        {/* Search */}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchLogs()}
          placeholder={isRTL ? 'بحث...' : 'Search...'}
          className={`${selectCls} flex-1 min-w-[150px]`} dir="auto" />

        {(filterAction || filterEntity || filterUser || filterDateRange !== 'all' || search) && (
          <button onClick={() => { setFilterAction(''); setFilterEntity(''); setFilterUser(''); setFilterDateRange('all'); setDateFrom(''); setDateTo(''); setSearch(''); setPage(1); }}
            className="text-xs text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-lg border-none cursor-pointer hover:bg-red-500/20">
            {isRTL ? 'مسح الفلاتر' : 'Clear'}
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-xs text-content-muted dark:text-content-muted-dark mb-2">
        {isRTL ? `${totalCount} سجل` : `${totalCount} records`}
      </div>

      {/* Table */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-4">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-edge dark:border-edge-dark">
                <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'التاريخ' : 'Date'}</th>
                <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'بواسطة' : 'User'}</th>
                <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الإجراء' : 'Action'}</th>
                <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الكيان' : 'Entity'}</th>
                <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الوصف' : 'Description'}</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-edge/30 dark:border-edge-dark/30">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-3.5 rounded-md bg-gray-100 dark:bg-white/5 animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد سجلات' : 'No logs found'}</td>
                </tr>
              ) : logs.map(log => {
                const ac = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
                const AIcon = ac.icon;
                const el = ENTITY_LABELS[log.entity] || { ar: log.entity, en: log.entity };
                const isExp = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr className={`border-b border-edge/30 dark:border-edge-dark/30 hover:bg-surface-bg dark:hover:bg-surface-bg-dark ${log.changes ? 'cursor-pointer' : ''}`}
                      onClick={() => log.changes && setExpandedId(isExp ? null : log.id)}>
                      <td className="px-3 py-2.5 text-content-muted dark:text-content-muted-dark whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-3 py-2.5 font-medium text-content dark:text-content-dark whitespace-nowrap">{isRTL ? (log._user_name_ar || '—') : (log._user_name_en || '—')}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={ac.variant} size="sm"><AIcon size={11} /> {isRTL ? ac.ar : ac.en}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-content-muted dark:text-content-muted-dark">{isRTL ? el.ar : el.en}</td>
                      <td className="px-3 py-2.5 font-medium text-content dark:text-content-dark truncate max-w-[150px]">{log.entity_name || '—'}</td>
                      <td className="px-3 py-2.5 text-content-muted dark:text-content-muted-dark truncate max-w-[200px]" title={log.description}>{log.description || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        {log.changes && (isExp ? <ChevronUp size={12} className="text-brand-500" /> : <ChevronDown size={12} className="text-content-muted" />)}
                      </td>
                    </tr>
                    {isExp && log.changes && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-surface-bg dark:bg-surface-bg-dark">
                          <div className="text-[11px] space-y-1">
                            {Object.entries(log.changes).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="font-semibold text-content dark:text-content-dark min-w-[100px]">{k}:</span>
                                <span className="text-red-500 line-through">{String(v.from ?? '—')}</span>
                                <span className="text-content-muted">→</span>
                                <span className="text-emerald-500">{String(v.to ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-edge dark:divide-edge-dark">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3"><div className="h-12 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" /></div>
            ))
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا توجد سجلات' : 'No logs found'}</div>
          ) : logs.map(log => {
            const ac = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
            const AIcon = ac.icon;
            const el = ENTITY_LABELS[log.entity] || { ar: log.entity, en: log.entity };
            return (
              <div key={log.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant={ac.variant} size="sm"><AIcon size={11} /> {isRTL ? ac.ar : ac.en}</Badge>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{formatDate(log.created_at)}</span>
                </div>
                <div className="text-xs text-content dark:text-content-dark font-medium mb-0.5">{log.entity_name || '—'} <span className="text-content-muted dark:text-content-muted-dark">({isRTL ? el.ar : el.en})</span></div>
                <div className="flex items-center gap-2 text-[11px] text-content-muted dark:text-content-muted-dark">
                  <User size={10} /> {isRTL ? (log._user_name_ar || '—') : (log._user_name_en || '—')}
                </div>
                {log.description && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-1 truncate">{log.description}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </>)}
    </div>
  );
}
