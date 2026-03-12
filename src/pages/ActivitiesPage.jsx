import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare, Plus, X, Search, Filter,
  Clock, Activity, TrendingUp, CloudOff
} from 'lucide-react';
import { fetchActivities, createActivity, deleteActivity, ACTIVITY_TYPES } from '../services/activitiesService';
import { Button, Card, Input, Select, Textarea, Badge, KpiCard, PageSkeleton } from '../components/ui';
import ExportButton from '../components/ui/ExportButton';

const ICONS = {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare,
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
  const { user } = useAuth();
  const lang  = i18n.language;
  const isRTL  = lang === 'ar';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState({ type: 'call', notes: '', dept: 'crm' });
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchActivities({ limit: 200 });
      setActivities(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (deptFilter !== 'all' && a.dept !== deptFilter) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (search && !a.notes?.toLowerCase().includes(search.toLowerCase()) &&
          !a.user_name_ar?.includes(search) && !a.user_name_en?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activities, deptFilter, typeFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const today = activities.filter(a => new Date(a.created_at) > new Date(Date.now() - 86400000));
    const byType = {};
    activities.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
    const topType = Object.entries(byType).sort((a,b) => b[1]-a[1])[0];
    return { total: activities.length, today: today.length, topType };
  }, [activities]);

  const handleAdd = async () => {
    if (!form.notes.trim()) return;
    setSaving(true);
    try {
      await createActivity({ type: form.type, notes: form.notes, entityType: 'internal', dept: form.dept, userId: user?.id });
      await load();
      setForm({ type: 'call', notes: '', dept: 'crm' });
      setSaving(false);
      setAdding(false);
    } catch {
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
              <label className="text-[11px] text-content-muted dark:text-content-muted-dark block mb-1">
                {lang === 'ar' ? 'القسم' : 'Department'}
              </label>
              <Select
                size="sm"
                value={form.dept}
                onChange={e => setForm(f => ({ ...f, dept: e.target.value, type: 'call' }))}
              >
                {Object.entries(DEPT_LABELS).filter(([k]) => k !== 'all').map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
            {/* Type */}
            <div>
              <label className="text-[11px] text-content-muted dark:text-content-muted-dark block mb-1">
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

      {/* Filters */}
      <Card className={`px-4 py-3 mb-4 flex gap-2.5 flex-wrap items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={13}
            className="absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark start-2.5"
          />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
            size="sm"
            className="ps-[30px] pe-2.5"
          />
        </div>
        {/* Dept filter */}
        {Object.entries(DEPT_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setDeptFilter(k)}
            className={`px-3 py-[5px] rounded-md border text-xs cursor-pointer transition-colors duration-150
              ${deptFilter === k
                ? 'border-brand-500 bg-brand-500/[0.09] text-brand-500 font-semibold'
                : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark font-normal'
              }`}
          >
            {lang === 'ar' ? v.ar : v.en}
          </button>
        ))}
        {/* Type filter */}
        <Select
          size="sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="w-auto min-w-[110px]"
        >
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
          ))}
        </Select>
      </Card>

      {/* Activities List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-3 px-4 py-3.5 border-b border-edge dark:border-edge-dark items-start">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-edge dark:bg-edge-dark flex-shrink-0 animate-pulse opacity-60" />
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
            <p className="m-0 mb-1.5 font-bold text-[15px] text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد أنشطة' : 'No activities found'}</p>
            <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'سجّل نشاطاً جديداً للبدء' : 'Log a new activity to get started'}</p>
          </div>
        ) : (
          filtered.map((act, idx) => {
            const typeDef = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.note;
            const Ic = ICONS[typeDef.icon] || FileText;
            const deptDef = DEPT_LABELS[act.dept];
            return (
              <div
                key={act.id}
                className={`group flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-brand-500/[0.07] ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${idx < filtered.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''}`}
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
                  <div className={`flex items-center gap-2 flex-wrap mb-[3px] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[13px] font-semibold" style={{ color: typeDef.color }}>
                      {lang === 'ar' ? typeDef.ar : typeDef.en}
                    </span>
                    {deptDef && (
                      <Badge variant="default" size="sm">
                        {lang === 'ar' ? deptDef.ar : deptDef.en}
                      </Badge>
                    )}
                    {act._offline && (
                      <Badge size="sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', gap: '3px', display: 'inline-flex', alignItems: 'center' }}>
                        <CloudOff size={9} /> {lang === 'ar' ? 'غير متزامن' : 'Offline'}
                      </Badge>
                    )}
                    <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
                      {act.user_name_ar && lang === 'ar' ? act.user_name_ar : act.user_name_en || ''}
                    </span>
                    <span className={`text-[11px] text-content-muted dark:text-content-muted-dark ms-auto`}>
                      {timeAgo(act.created_at, lang)}
                    </span>
                  </div>
                  {act.notes && (
                    <div className="text-[13px] text-content dark:text-content-dark leading-relaxed" dir={isRTL ? 'rtl' : 'ltr'}>
                      {act.notes}
                    </div>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => { deleteActivity(act.id); setActivities(prev => prev.filter(a => a.id !== act.id)); }}
                  className="bg-transparent border-none cursor-pointer p-1 text-content-muted dark:text-content-muted-dark flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
