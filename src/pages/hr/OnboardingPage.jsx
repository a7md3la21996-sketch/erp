import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { UserPlus, UserMinus, CheckCircle, Circle, Clock, X, Plus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';

const ONBOARDING_TEMPLATE = [
  { id: 't1', category: 'docs',    ar: 'استلام عقد العمل الموقع',          en: 'Receive signed employment contract',    days: 1,  responsible: 'hr' },
  { id: 't2', category: 'docs',    ar: 'تسليم نسخة من اللوائح والسياسات',  en: 'Provide company policies handbook',     days: 1,  responsible: 'hr' },
  { id: 't3', category: 'docs',    ar: 'صورة بطاقة الهوية الوطنية',        en: 'Copy of national ID',                   days: 1,  responsible: 'hr' },
  { id: 't4', category: 'docs',    ar: 'صورة الشهادات العلمية',            en: 'Educational certificates copies',       days: 3,  responsible: 'hr' },
  { id: 't5', category: 'access',  ar: 'إنشاء حساب البريد الإلكتروني',     en: 'Create email account',                  days: 1,  responsible: 'it' },
  { id: 't6', category: 'access',  ar: 'تخصيص صلاحيات النظام',            en: 'Assign system permissions',             days: 2,  responsible: 'it' },
  { id: 't7', category: 'assets',  ar: 'تسليم الجهاز اللازم',             en: 'Issue required device',                 days: 1,  responsible: 'it' },
  { id: 't8', category: 'training',ar: 'جلسة تعريفية بالشركة والفريق',    en: 'Company and team orientation session',  days: 3,  responsible: 'hr' },
  { id: 't9', category: 'training',ar: 'تدريب على الأنظمة الداخلية',       en: 'Internal systems training',            days: 5,  responsible: 'it' },
  { id: 't10',category: 'other',   ar: 'تحديد مدير مباشر وخطة العمل',     en: 'Assign direct manager and work plan',  days: 3,  responsible: 'manager' },
];

const OFFBOARDING_TEMPLATE = [
  { id: 'o1', category: 'assets',  ar: 'استرداد الجهاز والأجهزة',         en: 'Retrieve device and equipment',         days: 1,  responsible: 'it' },
  { id: 'o2', category: 'assets',  ar: 'استرداد البطاقات والمفاتيح',       en: 'Retrieve cards and keys',              days: 1,  responsible: 'hr' },
  { id: 'o3', category: 'access',  ar: 'إلغاء صلاحيات الأنظمة',           en: 'Revoke system access',                  days: 1,  responsible: 'it' },
  { id: 'o4', category: 'access',  ar: 'إلغاء البريد الإلكتروني',          en: 'Deactivate email account',             days: 1,  responsible: 'it' },
  { id: 'o5', category: 'docs',    ar: 'تسليم شهادة الخبرة',              en: 'Issue experience certificate',          days: 7,  responsible: 'hr' },
  { id: 'o6', category: 'docs',    ar: 'تسوية الراتب والمستحقات',          en: 'Settle salary and entitlements',        days: 30, responsible: 'finance' },
  { id: 'o7', category: 'other',   ar: 'توثيق نقل المهام',                en: 'Document task handover',               days: 7,  responsible: 'manager' },
  { id: 'o8', category: 'other',   ar: 'مقابلة الخروج',                   en: 'Exit interview',                        days: 3,  responsible: 'hr' },
];

const CATEGORY_CONFIG = {
  docs:     { ar: 'مستندات', en: 'Documents', icon: '📄', color: '#3B82F6' },
  access:   { ar: 'صلاحيات', en: 'Access',    icon: '🔐', color: '#6366F1' },
  assets:   { ar: 'أصول',    en: 'Assets',    icon: '📦', color: '#F59E0B' },
  training: { ar: 'تدريب',   en: 'Training',  icon: '📚', color: '#10B981' },
  other:    { ar: 'أخرى',    en: 'Other',     icon: '📋', color: '#EC4899' },
};

const INITIAL_CASES = [
  {
    id: 'c1', type: 'onboarding', employee_id: 'e9',
    start_date: '2026-03-01', target_date: '2026-03-15',
    tasks: ONBOARDING_TEMPLATE.map(t => ({ ...t, done: ['t1','t2','t5','t6','t7'].includes(t.id) })),
    notes: '',
  },
  {
    id: 'c2', type: 'offboarding', employee_id: 'e6',
    start_date: '2026-02-15', target_date: '2026-03-15',
    tasks: OFFBOARDING_TEMPLATE.map(t => ({ ...t, done: ['o1','o2','o3','o4'].includes(t.id) })),
    notes: '',
  },
];

export default function OnboardingPage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [cases, setCases] = useState(INITIAL_CASES);
  const [employees] = useState(MOCK_EMPLOYEES);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('onboarding');
  const [newEmp, setNewEmp] = useState('');
  const [newDate, setNewDate] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };

  const filtered = cases.filter(c => activeTab === 'all' || c.type === activeTab);

  const toggleTask = (caseId, taskId) => {
    setCases(prev => prev.map(c => c.id === caseId ? {
      ...c, tasks: c.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t)
    } : c));
    if (selectedCase?.id === caseId) {
      setSelectedCase(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }));
    }
  };

  const handleAdd = () => {
    if (!newEmp || !newDate) return;
    const template = newType === 'onboarding' ? ONBOARDING_TEMPLATE : OFFBOARDING_TEMPLATE;
    const newCase = {
      id: 'c' + Date.now(), type: newType, employee_id: newEmp,
      start_date: new Date().toISOString().split('T')[0],
      target_date: newDate,
      tasks: template.map(t => ({ ...t, done: false })),
      notes: '',
    };
    setCases(prev => [...prev, newCase]);
    setShowAdd(false); setNewEmp(''); setNewDate('');
  };

  const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const getProgress = (tasks) => {
    const done = tasks.filter(t => t.done).length;
    return { done, total: tasks.length, pct: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0 };
  };

  const inputStyle = () => ({ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' });

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'الاستقبال والمغادرة' : 'Onboarding & Offboarding'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'متابعة checklist الموظفين الجدد والمغادرين' : 'Track new hire and departure checklists'}</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={16} /> {lang === 'ar' ? 'حالة جديدة' : 'New Case'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: lang === 'ar' ? 'استقبال جاري' : 'Active Onboarding', value: cases.filter(c => c.type === 'onboarding').length, color: '#10B981', icon: '👋' },
          { label: lang === 'ar' ? 'مغادرة جارية' : 'Active Offboarding', value: cases.filter(c => c.type === 'offboarding').length, color: '#EF4444', icon: '🚪' },
          { label: lang === 'ar' ? 'مكتملة هذا الشهر' : 'Completed This Month', value: cases.filter(c => getProgress(c.tasks).pct === 100).length, color: '#3B82F6', icon: '✅' },
          { label: lang === 'ar' ? 'متأخرة' : 'Overdue', value: cases.filter(c => new Date(c.target_date) < new Date() && getProgress(c.tasks).pct < 100).length, color: '#F59E0B', icon: '⚠️' },
        ].map((s, i) => (
          <div key={i} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '14px 16px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: c.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {[
          { key: 'all',         ar: 'الكل',       en: 'All'         },
          { key: 'onboarding',  ar: 'استقبال',    en: 'Onboarding'  },
          { key: 'offboarding', ar: 'مغادرة',     en: 'Offboarding' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '11px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: activeTab === t.key ? c.accent : c.textMuted, borderBottom: activeTab === t.key ? '2px solid ' + c.accent : '2px solid transparent' }}>
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* Cases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map(cas => {
          const emp = employees.find(e => e.id === cas.employee_id);
          const { done, total, pct } = getProgress(cas.tasks);
          const isOnboarding = cas.type === 'onboarding';
          const isOverdue = new Date(cas.target_date) < new Date() && pct < 100;

          return (
            <div key={cas.id} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + (isOverdue ? '#F59E0B40' : c.border), overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', flexDirection: isRTL ? 'row-reverse' : 'row' }}
                onClick={() => setSelectedCase(selectedCase?.id === cas.id ? null : cas)}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: isOnboarding ? '#10B98120' : '#EF444420', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {isOnboarding ? '👋' : '🚪'}
                </div>
                <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{emp ? (lang === 'ar' ? emp.full_name_ar : emp.full_name_en) : '—'}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: isOnboarding ? '#10B98115' : '#EF444415', color: isOnboarding ? '#10B981' : '#EF4444' }}>
                      {lang === 'ar' ? (isOnboarding ? 'استقبال' : 'مغادرة') : (isOnboarding ? 'Onboarding' : 'Offboarding')}
                    </span>
                    {isOverdue && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#F59E0B15', color: '#F59E0B' }}>⚠️ {lang === 'ar' ? 'متأخر' : 'Overdue'}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: c.textMuted }}>
                    {emp ? (lang === 'ar' ? emp.job_title_ar : emp.job_title_en) : ''} · {lang === 'ar' ? 'حتى' : 'Due'}: {cas.target_date}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: pct === 100 ? '#10B981' : pct > 50 ? '#F59E0B' : c.accent }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: c.textMuted }}>{done}/{total}</div>
                  </div>
                  {selectedCase?.id === cas.id ? <ChevronUp size={16} color={c.textMuted} /> : <ChevronDown size={16} color={c.textMuted} />}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: 4, background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }}>
                <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#10B981' : 'linear-gradient(90deg,#2B4C6F,#4A7AAB)', transition: 'width 0.4s' }} />
              </div>

              {/* Expanded Tasks */}
              {selectedCase?.id === cas.id && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid ' + c.border }}>
                  {Object.entries(CATEGORY_CONFIG).map(([catKey, cat]) => {
                    const catTasks = cas.tasks.filter(t => t.category === catKey);
                    if (catTasks.length === 0) return null;
                    const catDone = catTasks.filter(t => t.done).length;
                    const isExpanded = expandedCategories[catKey] !== false;
                    return (
                      <div key={catKey} style={{ marginBottom: 12 }}>
                        <div onClick={() => toggleCategory(catKey)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '6px 0', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <span style={{ fontSize: 14 }}>{cat.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: cat.color }}>{lang === 'ar' ? cat.ar : cat.en}</span>
                            <span style={{ fontSize: 11, color: c.textMuted }}>{catDone}/{catTasks.length}</span>
                          </div>
                          {isExpanded ? <ChevronUp size={14} color={c.textMuted} /> : <ChevronDown size={14} color={c.textMuted} />}
                        </div>
                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: isRTL ? 22 : 0, paddingLeft: isRTL ? 0 : 22 }}>
                            {catTasks.map(task => (
                              <div key={task.id} onClick={() => toggleTask(cas.id, task.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: task.done ? (isDark ? 'rgba(16,185,129,0.06)' : '#F0FDF4') : 'transparent', border: '1px solid ' + (task.done ? '#10B98120' : c.border), transition: 'all 0.15s', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                {task.done
                                  ? <CheckCircle size={16} color="#10B981" style={{ flexShrink: 0 }} />
                                  : <Circle size={16} color={c.textMuted} style={{ flexShrink: 0 }} />
                                }
                                <span style={{ fontSize: 13, color: task.done ? c.textMuted : c.text, textDecoration: task.done ? 'line-through' : 'none', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                                  {lang === 'ar' ? task.ar : task.en}
                                </span>
                                <span style={{ fontSize: 10, color: c.textMuted, flexShrink: 0 }}>
                                  {task.days}d · {task.responsible}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 420, direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'حالة جديدة' : 'New Case'}</div>
              <button onClick={() => setShowAdd(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: lang === 'ar' ? 'النوع' : 'Type', field: (
                  <select value={newType} onChange={e => setNewType(e.target.value)} style={inputStyle()}>
                    <option value="onboarding">{lang === 'ar' ? 'استقبال موظف جديد' : 'Onboarding'}</option>
                    <option value="offboarding">{lang === 'ar' ? 'مغادرة موظف' : 'Offboarding'}</option>
                  </select>
                )},
                { label: lang === 'ar' ? 'الموظف *' : 'Employee *', field: (
                  <select value={newEmp} onChange={e => setNewEmp(e.target.value)} style={inputStyle()}>
                    <option value="">{lang === 'ar' ? 'اختر موظف' : 'Select employee'}</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>)}
                  </select>
                )},
                { label: lang === 'ar' ? 'تاريخ الاكتمال المستهدف *' : 'Target Completion Date *', field: (
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle()} />
                )},
              ].map((row, i) => (
                <div key={i}>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{row.label}</label>
                  {row.field}
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={handleAdd} disabled={!newEmp || !newDate} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: newEmp && newDate ? 'pointer' : 'not-allowed', background: newEmp && newDate ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : c.border, color: '#fff', fontSize: 13, fontWeight: 600, opacity: newEmp && newDate ? 1 : 0.5 }}>
                {lang === 'ar' ? 'إنشاء' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
