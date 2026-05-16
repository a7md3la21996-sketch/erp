import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useDebouncedSearch from '../hooks/useDebouncedSearch';
import { useAuth } from '../contexts/AuthContext';
import {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare, Plus, X, User, Link2,
  Clock, Activity, TrendingUp, CloudOff
} from 'lucide-react';
import { fetchActivities, createActivity, updateActivity, ACTIVITY_TYPES } from '../services/activitiesService';
import supabase from '../lib/supabase';
import { Button, Card, Select, Textarea, Badge, KpiCard, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import ActivityDrawer from './ActivityDrawer';
import ContactSearch from './crm/opportunities/ContactSearch';

const ICONS = {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare,
};

const RESULT_LABELS = {
  answered:     { ar: 'رد',          en: 'Answered',       color: '#10B981' },
  no_answer:    { ar: 'لم يرد',      en: 'No Answer',      color: '#F59E0B' },
  busy:         { ar: 'مشغول',       en: 'Busy',           color: '#EF4444' },
  switched_off: { ar: 'مغلق',        en: 'Switched Off',   color: '#6b7280' },
  wrong_number: { ar: 'رقم خاطئ',    en: 'Wrong Number',   color: '#8B5CF6' },
  interested:   { ar: 'مهتم',        en: 'Interested',     color: '#10B981' },
  not_interested:{ ar: 'غير مهتم',   en: 'Not Interested', color: '#EF4444' },
  sent:         { ar: 'تم الإرسال',   en: 'Sent',           color: '#4A7AAB' },
  completed:    { ar: 'مكتمل',       en: 'Completed',      color: '#10B981' },
  cancelled:    { ar: 'ملغي',        en: 'Cancelled',      color: '#EF4444' },
  rescheduled:  { ar: 'تم التأجيل',  en: 'Rescheduled',    color: '#F59E0B' },
};

const DEPT_LABELS = {
  all:        { ar: 'الكل', en: 'All' },
  sales:      { ar: 'المبيعات', en: 'Sales' },
  marketing:  { ar: 'التسويق', en: 'Marketing' },
  hr:         { ar: 'HR', en: 'HR' },
  finance:    { ar: 'المالية', en: 'Finance' },
  operations: { ar: 'العمليات', en: 'Operations' },
};

function timeAgo(dateStr, lang) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return lang === 'ar' ? 'الآن' : 'Just now';
  if (diff < 3600)  return lang === 'ar' ? `منذ ${Math.floor(diff/60)} دقيقة` : `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return lang === 'ar' ? `منذ ${Math.floor(diff/3600)} ساعة` : `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800)return lang === 'ar' ? `منذ ${Math.floor(diff/86400)} يوم` : `${Math.floor(diff/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

export default function ActivitiesPage() {
  const { i18n } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const lang  = i18n.language;
  const isRTL  = lang === 'ar';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  // Track first load separately so subsequent filter/page refetches
  // don't blank the list with a skeleton — they keep showing the
  // existing rows dimmed while the new page arrives.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // List of every agent in the users table (not just agents that
  // happen to be on the current page). Without this, the SmartFilter
  // 'Done By' dropdown only offers agents whose activity falls in the
  // first 25 visible rows.
  const [allAgents, setAllAgents] = useState([]);
  // 1-minute tick to refresh the relative timestamps on the list so
  // 'منذ دقيقة' doesn't stay frozen for the whole session.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const [smartFilters, setSmartFilters] = useState([]);
  const [searchInput, setSearchInput, search] = useDebouncedSearch(300);
  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState({ type: 'call', notes: '', dept: 'sales', contact: null });
  const [saving, setSaving]         = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { auditFields, applyAuditFilters } = useAuditFilter('activity');
  const globalFilter = useGlobalFilter();

  // Fetch the full agent list once (all users, not just those on the
  // current page) so the SmartFilter 'Done By' dropdown is complete.
  useEffect(() => {
    let cancelled = false;
    import('../services/opportunitiesService').then(({ fetchSalesAgents }) => {
      fetchSalesAgents().then(list => {
        if (cancelled) return;
        setAllAgents((list || []).filter(u => u.full_name_en || u.full_name_ar));
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  const uniqueUsers = useMemo(() => {
    if (allAgents.length > 0) {
      // value = UUID so the agent filter survives a rename. The visible label
      // still pulls from the user's current name, so the chip stays readable
      // and updates automatically when somebody is renamed in /settings.
      return allAgents.map(u => ({
        value: u.id,
        label: u.full_name_ar || u.full_name_en,
        labelEn: u.full_name_en || u.full_name_ar,
      })).sort((a, b) => a.labelEn.localeCompare(b.labelEn));
    }
    // Fallback while the users fetch is still pending — use whatever's on the
    // current page. Prefer user_id for the value; only fall back to the name
    // when the row has no id (rare, legacy data).
    const map = new Map();
    (activities || []).forEach(a => {
      const key = a.user_id || a.user_name_en || '';
      if (key && !map.has(key)) map.set(key, { value: key, label: a.user_name_ar || a.user_name_en || key, labelEn: a.user_name_en || a.user_name_ar || key });
    });
    return [...map.values()];
  }, [allAgents, activities]);

  const uniqueEntities = useMemo(() => {
    const map = new Map();
    (activities || []).forEach(a => {
      if (a.entity_name && !map.has(a.entity_name)) map.set(a.entity_name, { value: a.entity_name, label: a.entity_name, labelEn: a.entity_name });
    });
    return [...map.values()];
  }, [activities]);

  const SMART_FIELDS = useMemo(() => [
    { id: 'user_name_en', label: 'بواسطة', labelEn: 'Done By', type: 'select', options: uniqueUsers },
    { id: 'type', label: 'نوع النشاط', labelEn: 'Activity Type', type: 'select', options: Object.entries(ACTIVITY_TYPES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'dept', label: 'القسم', labelEn: 'Department', type: 'select', options: [
      { value: 'sales', label: 'المبيعات', labelEn: 'Sales' },
      { value: 'marketing', label: 'التسويق', labelEn: 'Marketing' },
      { value: 'hr', label: 'HR', labelEn: 'HR' },
      { value: 'finance', label: 'المالية', labelEn: 'Finance' },
      { value: 'operations', label: 'العمليات', labelEn: 'Operations' },
    ]},
    { id: 'entity_name', label: 'الجهة', labelEn: 'Related Entity', type: 'select', options: uniqueEntities },
    { id: 'result', label: 'النتيجة', labelEn: 'Result', type: 'select', options: Object.entries(RESULT_LABELS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'created_at', label: 'التاريخ', labelEn: 'Date', type: 'date' },
    { id: 'notes', label: 'الملاحظات', labelEn: 'Notes', type: 'text' },
    ...auditFields,
  ], [uniqueUsers, uniqueEntities, auditFields]);

  const QUICK_FILTERS = useMemo(() => [
    { label: 'اليوم', labelEn: 'Today', filters: [{ field: 'created_at', operator: 'is', value: new Date().toISOString().slice(0, 10) }] },
    { label: 'هذا الأسبوع', labelEn: 'This Week', filters: [{ field: 'created_at', operator: 'this_week', value: '' }] },
    { label: 'هذا الشهر', labelEn: 'This Month', filters: [{ field: 'created_at', operator: 'this_month', value: '' }] },
    { label: 'مكالمات', labelEn: 'Calls', filters: [{ field: 'type', operator: 'is', value: 'call' }] },
    { label: 'مقابلات', labelEn: 'Meetings', filters: [{ field: 'type', operator: 'is', value: 'meeting' }] },
  ], []);

  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, today: 0, topType: null });

  // Extract server-side filters from smartFilters. Anything that maps to
  // a single column.eq(value) belongs here so server-side count + pagination
  // stay accurate. Complex filters (notes ilike, entity_name) still run
  // client-side after the server returns the page.
  const serverFilters = useMemo(() => {
    const findIs = (field) => smartFilters.find(f => f.field === field && (f.operator === 'is' || !f.operator));
    const typeFilter   = findIs('type');
    const deptFilter   = findIs('dept');
    const agentFilter  = findIs('user_name_en');
    const resultFilter = findIs('result');
    const dateFilter   = smartFilters.find(f => f.field === 'created_at' && f.value);
    let dateFrom, dateTo;
    if (dateFilter) {
      const v = dateFilter.value;
      if (dateFilter.operator === 'this_week') {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        dateFrom = start.toISOString().slice(0, 10);
      } else if (dateFilter.operator === 'this_month') {
        dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      } else if (dateFilter.operator === 'is' && v) {
        dateFrom = v;
        dateTo   = v + 'T23:59:59';
      } else if (dateFilter.operator === 'between' && Array.isArray(v)) {
        dateFrom = v[0]; dateTo = v[1] ? v[1] + 'T23:59:59' : undefined;
      }
    }
    // agentFilter.value is now a UUID (uniqueUsers maps to u.id). Pass it as
    // agentId so the service can do user_id.eq instead of the rename-fragile
    // user_name_en.eq. The realtime predicate also uses the UUID — see below.
    return {
      type: typeFilter?.value,
      dept: deptFilter?.value,
      agentId: agentFilter?.value,
      result: resultFilter?.value,
      dateFrom, dateTo,
    };
  }, [smartFilters]);

  // Build the args once so loadActivities + loadStats stay in lockstep
  // (otherwise the headline KPIs disagree with the visible list — the
  // exact bug the May 3 review flagged).
  const baseQueryArgs = useMemo(() => ({
    role: profile?.role,
    userId: profile?.id,
    teamId: profile?.team_id,
    dept: serverFilters.dept || ((globalFilter?.department && globalFilter.department !== 'all') ? globalFilter.department : undefined),
    type: serverFilters.type,
    result: serverFilters.result,
    dateFrom: serverFilters.dateFrom,
    dateTo: serverFilters.dateTo,
    // agentId (new) takes precedence; agentName kept for the legacy global
    // filter which still passes names. Service prefers id when both are set.
    agentId: serverFilters.agentId,
    agentName: (globalFilter?.agentName && globalFilter.agentName !== 'all') ? globalFilter.agentName : undefined,
    search: search || undefined,
  }), [profile?.role, profile?.id, profile?.team_id, serverFilters, globalFilter?.department, globalFilter?.agentName, search]);

  const loadActivities = useCallback(async (pg) => {
    if (!profile?.id) return; // Don't load without profile
    setLoading(true);
    try {
      const currentPage = pg || page || 1;
      const result = await fetchActivities({ ...baseQueryArgs, page: currentPage, pageSize });
      setActivities(result?.data || []);
      setTotalCount(result?.count || 0);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [page, pageSize, profile?.id, baseQueryArgs]);

  useEffect(() => { if (profile) loadActivities(); }, [profile, loadActivities]);

  // Realtime — view-aware. The generic applyRealtimePayload prepended every
  // INSERT regardless of role/filter, so sales_agent would see other agents'
  // rows pop in and admins on a typed filter would see off-type rows. We hold
  // current filters in a ref so the subscription identity stays stable (no
  // re-subscribe on every chip toggle).
  const rtRef = useRef({});
  rtRef.current = { profile, serverFilters, globalFilter, search };

  useRealtimeSubscription('activities', useCallback((payload) => {
    if (!payload?.eventType) return;
    const { profile: p, serverFilters: sf, globalFilter: gf, search: sx } = rtRef.current;

    // Predicate: does this row belong in the current view?
    const matchesView = (row) => {
      if (!row) return false;
      // Sales agent only ever sees their own activities (RLS enforces it
      // server-side, but realtime publications can leak so guard here too).
      if (p?.role === 'sales_agent' && p?.id && row.user_id !== p.id) return false;
      if (sf?.type && row.type !== sf.type) return false;
      if (sf?.dept && row.dept !== sf.dept) return false;
      if (sf?.result && row.result !== sf.result) return false;
      if (sf?.agentId && row.user_id !== sf.agentId) return false;
      if (gf?.department && gf.department !== 'all' && row.dept !== gf.department) return false;
      if (sf?.dateFrom) {
        const created = row.created_at ? new Date(row.created_at).getTime() : 0;
        const from = new Date(sf.dateFrom).getTime();
        if (created < from) return false;
      }
      if (sf?.dateTo) {
        const created = row.created_at ? new Date(row.created_at).getTime() : 0;
        const to = new Date(sf.dateTo).getTime();
        if (created > to) return false;
      }
      if (sx) {
        // Notes search is the only client-side text dimension; cheap check.
        const q = sx.toLowerCase();
        const hit = (row.notes || '').toLowerCase().includes(q)
          || (row.entity_name || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    };

    setActivities(prev => {
      if (payload.eventType === 'DELETE') return prev.filter(a => a.id !== payload.old?.id);
      if (payload.eventType === 'INSERT') {
        if (!matchesView(payload.new)) return prev;
        if (prev.some(a => a.id === payload.new.id)) return prev;
        return [payload.new, ...prev];
      }
      if (payload.eventType === 'UPDATE') {
        const exists = prev.some(a => a.id === payload.new?.id);
        if (exists) return prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a);
        return matchesView(payload.new) ? [payload.new, ...prev] : prev;
      }
      return prev;
    });

    // Realtime payload has no entity_name (the batch contact-name resolve
    // runs only post-fetch in activitiesService). Hydrate it inline so the
    // newly-prepended row shows the real lead name instead of "Contact".
    if (payload.eventType === 'INSERT'
        && payload.new?.entity_type === 'contact'
        && payload.new?.entity_id
        && !payload.new?.entity_name) {
      supabase
        .from('contacts')
        .select('full_name')
        .eq('id', payload.new.entity_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data?.full_name) return;
          setActivities(prev => prev.map(a => a.id === payload.new.id ? { ...a, entity_name: data.full_name } : a));
        });
    }
  }, []));

  // Stats — from server, narrowed by the SAME filters as the list so the
  // KPIs and the visible rows always agree. topType is computed client-side
  // from a sample of the filtered set.
  const loadStats = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [totalRes, todayRes, sampleRes] = await Promise.all([
        fetchActivities({ ...baseQueryArgs, page: 1, pageSize: 1 }),
        fetchActivities({ ...baseQueryArgs, page: 1, pageSize: 1, dateFrom: todayStr }),
        fetchActivities({ ...baseQueryArgs, page: 1, pageSize: 100 }),
      ]);
      const sample = Array.isArray(sampleRes?.data) ? sampleRes.data : (Array.isArray(sampleRes) ? sampleRes : []);
      const typeCounts = {};
      sample.forEach(a => { if (a?.type) typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
      const top = Object.entries(typeCounts).sort((x, y) => y[1] - x[1])[0];
      setStats({
        total: totalRes?.count || 0,
        today: todayRes?.count || 0,
        topType: top || null,
      });
    } catch { /* ignore */ }
  }, [baseQueryArgs]);

  useEffect(() => { if (profile) loadStats(); }, [profile, loadStats]);

  // Client-only filters: anything that ISN'T already pushed to the server
  // (notes ilike, entity_name select, etc.). Server filters are: type,
  // dept, user_name_en, result, created_at — those don't run again here.
  const SERVER_FILTERED_FIELDS = ['type', 'dept', 'user_name_en', 'result', 'created_at'];
  const filtered = useMemo(() => {
    let list = activities || [];
    const clientFilters = smartFilters.filter(f => !SERVER_FILTERED_FIELDS.includes(f.field));
    list = applySmartFilters(list, clientFilters, SMART_FIELDS);
    list = applyAuditFilters(list, smartFilters);
    return list;
  }, [activities, smartFilters, SMART_FIELDS]);

  // Pagination uses the server's count of total matches (totalCount), not
  // the size of the current page. Without this fix, applying a filter
  // narrowed totalPages to 1 even when the server had hundreds of matches
  // — the user could only ever see the first page.
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered; // server already returned the right page
  useEffect(() => { if (page > totalPages && totalPages > 0) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [smartFilters, search, pageSize]);

  const handleAdd = async () => {
    if (!form.notes.trim()) return;
    setSaving(true);
    try {
      // Link to a contact if one is selected. Otherwise it's an internal
      // activity (still useful for free-form ops notes, just unlinked).
      const linkArgs = form.contact?.id
        ? { entityType: 'contact', entityId: form.contact.id }
        : { entityType: 'internal' };
      await createActivity({
        ...linkArgs,
        type: form.type,
        notes: form.notes,
        dept: form.dept,
        userId: user?.id || null,
        userName_ar: profile?.full_name_ar,
        userName_en: profile?.full_name_en,
      });
      await loadActivities();
      setForm({ type: 'call', notes: '', dept: 'sales', contact: null });
      setAdding(false);
    } catch (err) {
      console.error('Activity save error:', err?.message || err);
      toast.error(isRTL ? 'فشل حفظ النشاط' : 'Failed to save activity');
    } finally {
      setSaving(false);
    }
  };

  const availableTypes = Object.entries(ACTIVITY_TYPES).filter(([, v]) =>
    form.dept === 'all' || v.dept.includes(form.dept)
  );

  // Only show the full-page skeleton on the very first load. Subsequent
  // refetches (filter change, page change) keep the existing list mounted
  // and dim it via the loading state, so the user doesn't see the page
  // 'flash empty' on every interaction.
  if (loading && !hasLoadedOnce) return <PageSkeleton hasKpis={false} tableRows={6} tableCols={5} variant="list" />;

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen pb-16 ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Activity size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'سجل الأنشطة' : 'Activity Log'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'كل الأنشطة من كل الأقسام' : 'All activities across all departments'}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={filtered}
            filename={isRTL ? 'سجل_الأنشطة' : 'activities'}
            title={isRTL ? 'سجل الأنشطة' : 'Activity Log'}
            columns={[
              { header: isRTL ? 'النوع' : 'Type', key: r => isRTL ? ACTIVITY_TYPES[r.type]?.ar : ACTIVITY_TYPES[r.type]?.en },
              { header: isRTL ? 'الجهة' : 'Related To', key: 'entity_name' },
              { header: isRTL ? 'بواسطة' : 'By', key: r => isRTL ? (r.user_name_ar || r.user_name_en) : (r.user_name_en || r.user_name_ar) },
              { header: isRTL ? 'النتيجة' : 'Result', key: r => r.result ? (isRTL ? RESULT_LABELS[r.result]?.ar : RESULT_LABELS[r.result]?.en) || r.result : '' },
              { header: isRTL ? 'القسم' : 'Department', key: r => isRTL ? DEPT_LABELS[r.dept]?.ar : DEPT_LABELS[r.dept]?.en },
              { header: isRTL ? 'الملاحظات' : 'Notes', key: 'notes' },
              { header: isRTL ? 'التاريخ' : 'Date', key: 'created_at' },
            ]}
          />
          <Button
            variant={adding ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setAdding(!adding)}
            className={isRTL ? 'flex-row-reverse' : ''}
          >
            {adding ? <X size={15} /> : <Plus size={15} />}
            {adding ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? 'نشاط جديد' : 'New Activity')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard
          icon={Activity}
          label={lang === 'ar' ? 'إجمالي الأنشطة' : 'Total Activities'}
          value={stats.total}
          color="#4A7AAB"
        />
        <KpiCard
          icon={Clock}
          label={lang === 'ar' ? 'اليوم' : 'Today'}
          value={stats.today}
          color="#2B4C6F"
        />
        <KpiCard
          icon={TrendingUp}
          label={lang === 'ar' ? 'النشاط الأكثر' : 'Top Activity'}
          value={stats.topType ? (lang === 'ar' ? ACTIVITY_TYPES[stats.topType[0]]?.ar : ACTIVITY_TYPES[stats.topType[0]]?.en) : '—'}
          color="#6B8DB5"
        />
      </div>

      {/* Add Form */}
      {adding && (
        <Card className="p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            {/* Dept */}
            <div>
              <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1">
                {lang === 'ar' ? 'القسم' : 'Department'}
              </label>
              <Select
                size="sm"
                value={form.dept}
                onChange={e => { const d = e.target.value; const firstType = Object.entries(ACTIVITY_TYPES).find(([, v]) => v.dept.includes(d)); setForm(f => ({ ...f, dept: d, type: firstType ? firstType[0] : 'call' })); }}
              >
                {Object.entries(DEPT_LABELS).filter(([k]) => k !== 'all').map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
            {/* Type */}
            <div>
              <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1">
                {lang === 'ar' ? 'النوع' : 'Type'}
              </label>
              <Select
                size="sm"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {availableTypes.map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
          </div>
          {/* Optional contact link — without this every activity created
              from this page is orphaned (entity_type='internal') and
              never appears on a lead's timeline */}
          <div className="mb-2.5">
            <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1">
              {lang === 'ar' ? 'الربط بعميل (اختياري)' : 'Link to contact (optional)'}
            </label>
            {form.contact ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/[0.08] border border-brand-500/20">
                <Link2 size={13} className="text-brand-500" />
                <span className="flex-1 text-xs font-semibold text-content dark:text-content-dark">
                  {form.contact.full_name}
                  {form.contact.phone && <span className="text-content-muted dark:text-content-muted-dark font-normal ms-2">{form.contact.phone}</span>}
                </span>
                <button onClick={() => setForm(f => ({ ...f, contact: null }))} className="w-6 h-6 rounded flex items-center justify-center bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark hover:text-red-500">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <ContactSearch isRTL={isRTL} value={null} onSelect={c => setForm(f => ({ ...f, contact: c }))} />
            )}
          </div>
          <Textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={lang === 'ar' ? 'ملاحظات النشاط...' : 'Activity notes...'}
            rows={3}
            size="sm"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <div className={`flex mt-2.5 gap-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
            <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !form.notes.trim()}
            >
              {saving ? '...' : (lang === 'ar' ? 'حفظ النشاط' : 'Save Activity')}
            </Button>
          </div>
        </Card>
      )}

      {/* SmartFilter */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isRTL ? 'بحث بالملاحظات أو اسم المستخدم...' : 'Search by notes or user name...'}
        quickFilters={QUICK_FILTERS}
        resultsCount={totalCount}
      />

      {/* Activities List */}
      <Card className={`overflow-hidden mt-4 transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
        {filtered.length === 0 ? (
          (() => {
            const hasActive = !!searchInput
              || (Array.isArray(smartFilters) && smartFilters.length > 0)
              || (globalFilter?.department && globalFilter.department !== 'all')
              || (globalFilter?.agentName && globalFilter.agentName !== 'all');
            const handleClear = () => {
              setSearchInput('');
              setSmartFilters([]);
              setPage(1);
            };
            return (
              <div className="flex flex-col items-center justify-center py-[60px] px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
                  <Activity size={28} className="text-brand-500" strokeWidth={1.5} />
                </div>
                <p className="m-0 mb-1.5 font-bold text-sm text-content dark:text-content-dark">
                  {lang === 'ar' ? 'لا توجد أنشطة' : 'No activities found'}
                </p>
                <p className="m-0 mb-3 text-xs text-content-muted dark:text-content-muted-dark">
                  {hasActive
                    ? (lang === 'ar' ? 'الفلاتر الحالية مفيش بيها نتايج' : 'Current filters return nothing')
                    : (lang === 'ar' ? 'سجّل نشاطاً جديداً للبدء' : 'Log a new activity to get started')}
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {hasActive && (
                    <button
                      onClick={handleClear}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/12 text-brand-500 text-xs font-semibold border-none cursor-pointer hover:bg-brand-500/20"
                    >
                      <X size={12} /> {lang === 'ar' ? 'مسح الفلاتر' : 'Clear filters'}
                    </button>
                  )}
                  <button
                    onClick={() => setAdding(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold border-none cursor-pointer hover:bg-brand-600"
                  >
                    <Plus size={12} /> {lang === 'ar' ? 'نشاط جديد' : 'New activity'}
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          paged.map((act, idx) => {
            const typeDef = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.note;
            const Ic = ICONS[typeDef.icon] || FileText;
            const deptDef = DEPT_LABELS[act.dept];
            return (
              <div
                key={act.id}
                className={`group flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-brand-500/[0.07] cursor-pointer ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${idx < paged.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''}`}
                onClick={() => setSelectedActivity(act)}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: typeDef.color + '18' }}
                >
                  <Ic size={15} color={typeDef.color} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Type + Entity + Result + Time */}
                  <div className={`flex items-center gap-2 flex-wrap mb-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs font-semibold" style={{ color: typeDef.color }}>
                      {lang === 'ar' ? typeDef.ar : typeDef.en}
                    </span>
                    {deptDef && (
                      <Badge variant="default" size="sm">
                        {lang === 'ar' ? deptDef.ar : deptDef.en}
                      </Badge>
                    )}
                    {act.result && RESULT_LABELS[act.result] && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: RESULT_LABELS[act.result].color + '18', color: RESULT_LABELS[act.result].color }}>
                        {lang === 'ar' ? RESULT_LABELS[act.result].ar : RESULT_LABELS[act.result].en}
                      </span>
                    )}
                    {act._offline && (
                      <Badge size="sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', gap: '3px', display: 'inline-flex', alignItems: 'center' }}>
                        <CloudOff size={9} /> {lang === 'ar' ? 'غير متزامن' : 'Offline'}
                      </Badge>
                    )}
                    <span className={`text-[11px] text-content-muted dark:text-content-muted-dark ms-auto`} title={act.created_at ? new Date(act.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US') : ''}>
                      {timeAgo(act.created_at, lang)}
                    </span>
                  </div>
                  {/* Row 2: Contact Name + User (By) */}
                  <div className={`flex items-center gap-3 flex-wrap mb-1 text-[12px] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    {(act.entity_name || act.contact_id) && (
                      <span className={`flex items-center gap-1 font-semibold ${act.contact_id && act.contact_id !== 'null' ? 'text-brand-500 cursor-pointer hover:underline' : 'text-content dark:text-content-dark'}`}
                        onClick={act.contact_id && act.contact_id !== 'null' ? (e) => { e.stopPropagation(); navigate(`/contacts?highlight=${act.contact_id}`); } : undefined}
                      >
                        <Link2 size={11} />
                        {act.entity_name || (isRTL ? 'عميل' : 'Contact')}
                      </span>
                    )}
                    {(act.user_name_ar || act.user_name_en) && (
                      <span className="flex items-center gap-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                        <User size={10} />
                        {lang === 'ar' ? (act.user_name_ar || act.user_name_en) : (act.user_name_en || act.user_name_ar)}
                      </span>
                    )}
                  </div>
                  {/* Row 3: Notes */}
                  {(act.notes || act.description) && (
                    <div className="text-xs text-content-muted dark:text-content-muted-dark leading-relaxed line-clamp-2" dir={isRTL ? 'rtl' : 'ltr'}>
                      {act.description && act.description !== act.notes && (
                        <span className="font-semibold text-content dark:text-content-dark">{act.description} — </span>
                      )}
                      {act.notes}
                    </div>
                  )}
                </div>

              </div>
            );
          })
        )}
      </Card>

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={totalCount} />

      {/* Activity Detail Drawer */}
      {selectedActivity && (
        <ActivityDrawer
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onUpdate={async (id, updates) => {
            const updated = await updateActivity(id, updates);
            // Merge the server response (not the raw `updates`) so the row
            // gets the canonical updated_at, and only if state isn't already
            // on a newer version — realtime can deliver a concurrent edit
            // while the server call is in flight, and overwriting it here
            // would silently undo that change.
            setActivities(prev => prev.map(a => {
              if (String(a.id) !== String(id)) return a;
              const aTime = new Date(a.updated_at || 0).getTime();
              const uTime = new Date(updated?.updated_at || 0).getTime();
              return uTime >= aTime ? { ...a, ...updated } : a;
            }));
            setSelectedActivity(prev => {
              if (!prev || String(prev.id) !== String(id)) return prev;
              const pTime = new Date(prev.updated_at || 0).getTime();
              const uTime = new Date(updated?.updated_at || 0).getTime();
              return uTime >= pTime ? { ...prev, ...updated } : prev;
            });
            return updated;
          }}
        />
      )}
    </div>
  );
}
