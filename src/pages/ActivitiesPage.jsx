import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare, Plus, X, Search, Filter,
  Clock, Activity, TrendingUp
} from 'lucide-react';
import { fetchActivities, createActivity, deleteActivity, ACTIVITY_TYPES } from '../services/activitiesService';

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
  const { theme } = useTheme();
  const { user } = useAuth();
  const lang  = i18n.language;
  const isDark = theme === 'dark';
  const isRTL  = lang === 'ar';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState({ type: 'call', notes: '', dept: 'crm' });
  const [saving, setSaving]         = useState(false);

  const c = {
    bg:      isDark ? '#152232' : '#f9fafb',
    cardBg:  isDark ? '#1a2234' : '#ffffff',
    border:  isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:    isDark ? '#E2EAF4' : '#111827',
    muted:   isDark ? '#8BA8C8' : '#6b7280',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    thBg:    isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    hover:   isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    accent:  '#4A7AAB',
    primary: '#2B4C6F',
  };

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

  return (
    <div style={{ padding: '24px', background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? 'سجل الأنشطة' : 'Activity Log'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: c.muted }}>
              {lang === 'ar' ? 'كل الأنشطة من كل الأقسام' : 'All activities across all departments'}
            </p>
          </div>
        </div>
        <button onClick={() => setAdding(!adding)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: adding ? c.border : c.primary, color: adding ? c.muted : '#fff',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          {adding ? <X size={15} /> : <Plus size={15} />}
          {adding ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? 'نشاط جديد' : 'New Activity')}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: lang === 'ar' ? 'إجمالي الأنشطة' : 'Total Activities', value: stats.total, icon: Activity, color: c.accent },
          { label: lang === 'ar' ? 'اليوم' : 'Today', value: stats.today, icon: Clock, color: c.primary },
          { label: lang === 'ar' ? 'النشاط الأكثر' : 'Top Activity', value: stats.topType ? (lang === 'ar' ? ACTIVITY_TYPES[stats.topType[0]]?.ar : ACTIVITY_TYPES[stats.topType[0]]?.en) : '—', icon: TrendingUp, color: '#6B8DB5' },
        ].map((s, i) => {
          const Ic = s.icon;
          return (
            <div key={i} style={{ background: c.cardBg, borderRadius: 10, padding: '14px 16px', border: '1px solid ' + c.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <Ic size={16} color={s.color} />
                <span style={{ fontSize: 11, color: c.muted }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Add Form */}
      {adding && (
        <div style={{ background: c.cardBg, borderRadius: 12, padding: 18, marginBottom: 16, border: '1px solid ' + c.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {/* Dept */}
            <div>
              <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 4 }}>
                {lang === 'ar' ? 'القسم' : 'Department'}
              </label>
              <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value, type: 'call' }))} style={{
                width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid ' + c.border,
                background: c.inputBg, color: c.text, fontSize: 13, outline: 'none',
              }}>
                {Object.entries(DEPT_LABELS).filter(([k]) => k !== 'all').map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
            {/* Type */}
            <div>
              <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 4 }}>
                {lang === 'ar' ? 'النوع' : 'Type'}
              </label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{
                width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid ' + c.border,
                background: c.inputBg, color: c.text, fontSize: 13, outline: 'none',
              }}>
                {availableTypes.map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={lang === 'ar' ? 'ملاحظات النشاط...' : 'Activity notes...'}
            rows={3}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid ' + c.border,
              background: c.inputBg, color: c.text, fontSize: 13, resize: 'vertical',
              outline: 'none', boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr',
            }}
          />
          <div style={{ display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end', marginTop: 10, gap: 8 }}>
            <button onClick={() => setAdding(false)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', color: c.muted, fontSize: 12, cursor: 'pointer' }}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button onClick={handleAdd} disabled={saving || !form.notes.trim()} style={{
              padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: c.primary, color: '#fff', fontSize: 12, fontWeight: 600,
              opacity: saving || !form.notes.trim() ? 0.6 : 1,
            }}>
              {saving ? '...' : (lang === 'ar' ? 'حفظ النشاط' : 'Save Activity')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: c.cardBg, borderRadius: 12, padding: '12px 16px', marginBottom: 12, border: '1px solid ' + c.border, display: 'flex', gap: 10, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: 10, top: '50%', transform: 'translateY(-50%)', color: c.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'بحث...' : 'Search...'} style={{
            width: '100%', padding: isRTL ? '7px 30px 7px 10px' : '7px 10px 7px 30px', borderRadius: 7,
            border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }} />
        </div>
        {/* Dept filter */}
        {Object.entries(DEPT_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setDeptFilter(k)} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid ' + (deptFilter === k ? c.accent : c.border),
            background: deptFilter === k ? c.accent + '18' : 'transparent', color: deptFilter === k ? c.accent : c.muted,
            fontSize: 12, fontWeight: deptFilter === k ? 600 : 400, cursor: 'pointer',
          }}>
            {lang === 'ar' ? v.ar : v.en}
          </button>
        ))}
        {/* Type filter */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
          padding: '6px 10px', borderRadius: 7, border: '1px solid ' + c.border,
          background: c.inputBg, color: c.text, fontSize: 12, outline: 'none',
        }}>
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
          ))}
        </select>
      </div>

      {/* Activities List */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid ' + c.border, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: c.border, flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.6 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ width: '40%', height: 12, borderRadius: 6, background: c.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: '70%', height: 10, borderRadius: 6, background: c.border, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.7 }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(27,51,71,0.08), rgba(74,122,171,0.12))', border: '1.5px dashed rgba(74,122,171,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Activity size={28} color="#4A7AAB" strokeWidth={1.5} />
            </div>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: c.text }}>{lang === 'ar' ? 'لا توجد أنشطة' : 'No activities found'}</p>
            <p style={{ margin: 0, fontSize: 13, color: c.muted }}>{lang === 'ar' ? 'سجّل نشاطاً جديداً للبدء' : 'Log a new activity to get started'}</p>
          </div>
        ) : (
          filtered.map((act, idx) => {
            const typeDef = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.note;
            const Ic = ICONS[typeDef.icon] || FileText;
            const deptDef = DEPT_LABELS[act.dept];
            return (
              <div key={act.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid ' + c.border : 'none',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = c.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: typeDef.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic size={15} color={typeDef.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: typeDef.color }}>
                      {lang === 'ar' ? typeDef.ar : typeDef.en}
                    </span>
                    {deptDef && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: c.accent + '15', color: c.accent, fontWeight: 500 }}>
                        {lang === 'ar' ? deptDef.ar : deptDef.en}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: c.muted }}>
                      {act.user_name_ar && lang === 'ar' ? act.user_name_ar : act.user_name_en || ''}
                    </span>
                    <span style={{ fontSize: 11, color: c.muted, [isRTL ? 'marginRight' : 'marginLeft']: 'auto' }}>
                      {timeAgo(act.created_at, lang)}
                    </span>
                  </div>
                  {act.notes && (
                    <div style={{ fontSize: 13, color: c.text, lineHeight: 1.5, direction: isRTL ? 'rtl' : 'ltr' }}>
                      {act.notes}
                    </div>
                  )}
                </div>

                {/* Delete */}
                <button onClick={() => { deleteActivity(act.id); setActivities(prev => prev.filter(a => a.id !== act.id)); }} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: c.muted, flexShrink: 0,
                  opacity: 0, transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
