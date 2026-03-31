import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { fetchActivities, createActivity, updateActivity, deleteActivity, ACTIVITY_TYPES } from '../services/activitiesService';
import { Button, Card, Select, Textarea, Badge, KpiCard, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';
import { useRealtimeSubscription, applyRealtimePayload } from '../hooks/useRealtimeSubscription';
import ActivityDrawer from './ActivityDrawer';

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
  all:     { ar: 'الكل', en: 'All' },
  crm:     { ar: 'CRM', en: 'CRM' },
  sales:   { ar: 'المبيعات', en: 'Sales' },
  hr:      { ar: 'HR', en: 'HR' },
  finance: { ar: 'المالية', en: 'Finance' },
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
  const lang  = i18n.language;
  const isRTL  = lang === 'ar';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [smartFilters, setSmartFilters] = useState([]);
  const [searchInput, setSearchInput, search] = useDebouncedSearch(300);
  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState({ type: 'call', notes: '', dept: 'crm' });
  const [saving, setSaving]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [deleting, setDeleting] = useState(false);
  const { auditFields, applyAuditFilters } = useAuditFilter('activity');
  const globalFilter = useGlobalFilter();

  const uniqueUsers = useMemo(() => {
    const map = new Map();
    (activities || []).forEach(a => {
      const key = a.user_name_en || a.user_id || '';
      if (key && !map.has(key)) map.set(key, { value: key, label: a.user_name_ar || key, labelEn: a.user_name_en || key });
    });
    return [...map.values()];
  }, [activities]);

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
      { value: 'crm', label: 'CRM', labelEn: 'CRM' },
      { value: 'sales', label: 'المبيعات', labelEn: 'Sales' },
      { value: 'hr', label: 'HR', labelEn: 'HR' },
      { value: 'finance', label: 'المالية', labelEn: 'Finance' },
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

  const load = async (pg = page) => {
    setLoading(true);
    try {
      const result = await fetchActivities({ page: pg, pageSize });
      setActivities(result?.data || []);
      setTotalCount(result?.count || 0);
    } catch {
      setActivities([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(page); }, [page, pageSize]);

  // Realtime: granular update — apply only the changed record
  useRealtimeSubscription('activities', useCallback((payload) => {
    if (payload?.eventType) {
      setActivities(prev => applyRealtimePayload(prev, payload));
    } else {
      load();
    }
  }, []));

  const filtered = useMemo(() => {
    let list = activities || [];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(a =>
        a.notes?.toLowerCase().includes(s) ||
        a.user_name_ar?.toLowerCase().includes(s) ||
        a.user_name_en?.toLowerCase().includes(s) ||
        a.entity_name?.toLowerCase().includes(s)
      );
    }
    list = applySmartFilters(list, smartFilters, SMART_FIELDS);
    list = applyAuditFilters(list, smartFilters);
    // Global filter
    if (globalFilter?.department && globalFilter.department !== 'all') {
      list = list.filter(a => a.dept === globalFilter.department);
    }
    if (globalFilter?.agentName && globalFilter.agentName !== 'all') {
      list = list.filter(a => a.user_name_en === globalFilter.agentName || a.user_name_ar === globalFilter.agentName);
    }
    return list;
  }, [activities, search, smartFilters, SMART_FIELDS, globalFilter?.department, globalFilter?.agentName]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(0, pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [smartFilters, search, pageSize]);

  // Stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = (activities || []).filter(a => a.created_at?.startsWith(todayStr));
    const byType = {};
    (activities || []).forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
    const topType = Object.entries(byType).sort((a,b) => b[1]-a[1])[0] || null;
    return { total: totalCount || (activities || []).length, today: today.length, topType };
  }, [activities, totalCount]);

  const handleAdd = async () => {
    if (!form.notes.trim()) return;
    setSaving(true);
    try {
      await createActivity({ type: form.type, notes: form.notes, entityType: 'internal', dept: form.dept, userId: user?.id || null, userName_ar: profile?.full_name_ar, userName_en: profile?.full_name_en });
      await load();
      setForm({ type: 'call', notes: '', dept: 'crm' });
      setAdding(false);
    } catch {
      // Activity saved locally even if server fails
      await load();
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const availableTypes = Object.entries(ACTIVITY_TYPES).filter(([, v]) =>
    form.dept === 'all' || v.dept.includes(form.dept)
  );

  if (loading) return <PageSkeleton hasKpis={false} tableRows={6} tableCols={5} variant="list" />;

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

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
          <div className="grid grid-cols-2 gap-2.5 mb-3">
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
        resultsCount={filtered.length}
      />

      {/* Activities List */}
      <Card className="overflow-hidden mt-4">
        {loading ? (
          <div className="p-6">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-3 px-4 py-3.5 border-b border-edge dark:border-edge-dark items-start">
                <div className="w-[38px] h-[38px] rounded-xl bg-edge dark:bg-edge-dark flex-shrink-0 animate-pulse opacity-60" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="w-[40%] h-3 rounded-md bg-edge dark:bg-edge-dark animate-pulse" />
                  <div className="w-[70%] h-2.5 rounded-md bg-edge dark:bg-edge-dark animate-pulse opacity-70" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[60px] px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
              <Activity size={28} className="text-brand-500" strokeWidth={1.5} />
            </div>
            <p className="m-0 mb-1.5 font-bold text-sm text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد أنشطة' : 'No activities found'}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'سجّل نشاطاً جديداً للبدء' : 'Log a new activity to get started'}</p>
          </div>
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
                    {act.contact_phone && (
                      <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-mono">{act.contact_phone}</span>
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

                {/* Delete */}
                {confirmDeleteId === act.id ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button disabled={deleting} onClick={async () => { if (deleting) return; setDeleting(true); const id = act.id; try { await deleteActivity(id); setActivities(prev => prev.filter(a => a.id !== id)); } catch { setActivities(prev => prev.filter(a => a.id !== id)); } setConfirmDeleteId(null); setDeleting(false); }}
                      className={`bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5 text-[10px] text-red-500 font-semibold ${deleting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>{deleting ? '...' : (isRTL ? 'تأكيد' : 'Confirm')}</button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="bg-transparent border border-edge dark:border-edge-dark rounded px-1.5 py-0.5 text-[10px] text-content-muted dark:text-content-muted-dark cursor-pointer">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(act.id); }}
                    className="bg-transparent border-none cursor-pointer p-1 text-content-muted dark:text-content-muted-dark flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  >
                    <X size={13} />
                  </button>
                )}
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
            setActivities(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...updates } : a));
            setSelectedActivity(prev => ({ ...prev, ...updates }));
            return updated;
          }}
          onDelete={async (id) => {
            try { await deleteActivity(id); } catch {}
            setActivities(prev => prev.filter(a => a.id !== id));
            setSelectedActivity(null);
          }}
        />
      )}
    </div>
  );
}
