import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Settings, Search, Edit2, Check, X, ChevronDown } from 'lucide-react';
import { MOCK_HR_POLICIES, POLICY_CATEGORIES } from '../../data/hr_mock_data';

export default function HRPoliciesPage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [policies, setPolicies] = useState(MOCK_HR_POLICIES);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover:  isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    primary:   '#2B4C6F',
    accent:    '#4A7AAB',
  };

  const filtered = policies.filter(p => {
    const matchSearch = !search ||
      p.label_ar.includes(search) ||
      p.label_en.toLowerCase().includes(search.toLowerCase()) ||
      p.key.includes(search);
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const startEdit = (policy) => {
    setEditingId(policy.id);
    setEditValue(policy.value);
  };

  const saveEdit = (id) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, value: editValue } : p));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const categoryStats = Object.entries(POLICY_CATEGORIES).map(([key, cat]) => ({
    key,
    ...cat,
    count: policies.filter(p => p.category === key).length,
  }));

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? 'محرك السياسات' : 'Policy Engine'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
              {lang === 'ar' ? 'كل قواعد العمل في مكان واحد — بدون كود' : 'All business rules in one place — no code needed'}
            </p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: activeCategory === 'all' ? c.primary : (isDark ? 'rgba(74,122,171,0.1)' : '#F1F5F9'),
            color: activeCategory === 'all' ? '#fff' : c.textMuted,
            transition: 'all 0.15s',
          }}
        >
          {lang === 'ar' ? `الكل (${policies.length})` : `All (${policies.length})`}
        </button>
        {categoryStats.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: activeCategory === cat.key ? cat.color : (isDark ? 'rgba(74,122,171,0.1)' : '#F1F5F9'),
              color: activeCategory === cat.key ? '#fff' : c.textMuted,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{cat.icon}</span>
            <span>{lang === 'ar' ? cat.ar : cat.en} ({cat.count})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.textMuted }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'ar' ? 'ابحث عن سياسة...' : 'Search policy...'}
          style={{
            width: '100%', padding: isRTL ? '10px 40px 10px 14px' : '10px 14px 10px 40px',
            borderRadius: 8, border: '1px solid ' + c.border,
            background: c.inputBg, color: c.text, fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
            direction: isRTL ? 'rtl' : 'ltr',
          }}
        />
      </div>

      {/* Policies Table */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[
                { key: 'category', ar: 'الفئة',      en: 'Category', w: '120px' },
                { key: 'label',    ar: 'السياسة',    en: 'Policy',   w: 'auto' },
                { key: 'value',    ar: 'القيمة',     en: 'Value',    w: '130px' },
                { key: 'unit',     ar: 'الوحدة',     en: 'Unit',     w: '80px' },
                { key: 'level',    ar: 'المستوى',    en: 'Level',    w: '100px' },
                { key: 'actions',  ar: 'تعديل',      en: 'Edit',     w: '80px' },
              ].map(col => (
                <th key={col.key} style={{
                  padding: '12px 16px', textAlign: isRTL ? 'right' : 'left',
                  fontSize: 12, fontWeight: 600, color: c.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  width: col.w, whiteSpace: 'nowrap',
                }}>
                  {lang === 'ar' ? col.ar : col.en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((policy, idx) => {
              const cat = POLICY_CATEGORIES[policy.category];
              const isEditing = editingId === policy.id;
              return (
                <tr
                  key={policy.id}
                  style={{
                    borderTop: idx > 0 ? '1px solid ' + c.border : 'none',
                    background: isEditing ? (isDark ? 'rgba(74,122,171,0.08)' : '#EFF6FF') : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = c.rowHover; }}
                  onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Category */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      background: cat?.color + '20', color: cat?.color,
                    }}>
                      {cat?.icon} {lang === 'ar' ? cat?.ar : cat?.en}
                    </span>
                  </td>

                  {/* Label */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>
                      {lang === 'ar' ? policy.label_ar : policy.label_en}
                    </div>
                    <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                      {lang === 'ar' ? policy.description_ar : policy.description_ar}
                    </div>
                  </td>

                  {/* Value */}
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        style={{
                          width: 90, padding: '6px 10px', borderRadius: 6,
                          border: '2px solid ' + c.accent,
                          background: c.inputBg, color: c.text,
                          fontSize: 14, fontWeight: 600, outline: 'none',
                          textAlign: 'center',
                        }}
                      />
                    ) : (
                      <span style={{
                        display: 'inline-block', padding: '4px 12px', borderRadius: 6,
                        background: isDark ? 'rgba(74,122,171,0.15)' : '#EFF6FF',
                        color: c.accent, fontSize: 15, fontWeight: 700,
                      }}>
                        {policy.value}
                      </span>
                    )}
                  </td>

                  {/* Unit */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, color: c.textMuted }}>
                      {policy.unit === 'days'   ? (lang === 'ar' ? 'يوم' : 'days') :
                       policy.unit === 'hours'  ? (lang === 'ar' ? 'ساعة' : 'hrs') :
                       policy.unit === 'months' ? (lang === 'ar' ? 'شهر' : 'months') :
                       policy.unit === 'time'   ? (lang === 'ar' ? 'توقيت' : 'time') :
                       policy.unit === 'x'      ? (lang === 'ar' ? 'مضاعف' : 'multiplier') :
                       policy.unit}
                    </span>
                  </td>

                  {/* Level */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      background: policy.level === 'company' ? '#10B98120' : '#F59E0B20',
                      color: policy.level === 'company' ? '#10B981' : '#F59E0B',
                    }}>
                      {policy.level === 'company'
                        ? (lang === 'ar' ? '🏢 الشركة' : '🏢 Company')
                        : policy.level === 'department'
                        ? (lang === 'ar' ? '👥 القسم' : '👥 Dept')
                        : (lang === 'ar' ? '👤 فردي' : '👤 Individual')}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <button
                          onClick={() => saveEdit(policy.id)}
                          style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(policy)}
                        style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: c.textMuted }}>
            <Settings size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا توجد سياسات' : 'No policies found'}</p>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div style={{
        marginTop: 16, padding: '12px 16px', borderRadius: 8,
        background: isDark ? 'rgba(74,122,171,0.1)' : '#EFF6FF',
        border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : '#BFDBFE'),
        display: 'flex', alignItems: 'center', gap: 10,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <p style={{ margin: 0, fontSize: 13, color: isDark ? '#8BA8C8' : '#1D4ED8' }}>
          {lang === 'ar'
            ? 'التغييرات هنا بتأثر على حسابات الحضور والإجازات والرواتب تلقائياً — بدون تعديل أي كود'
            : 'Changes here automatically affect attendance, leave, and payroll calculations — no code changes needed'}
        </p>
      </div>
    </div>
  );
}
