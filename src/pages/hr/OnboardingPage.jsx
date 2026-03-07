import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { UserPlus, UserMinus, CheckSquare, Square, Clock, CheckCircle, Plus, X, Search } from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';

const ONBOARDING_CHECKLIST = [
  { id: 'ob1', category: 'documents', ar: 'استلام نسخة العقد الموقعة', en: 'Receive signed contract copy', responsible: 'hr' },
  { id: 'ob2', category: 'documents', ar: 'تصوير الهوية الوطنية', en: 'Copy national ID', responsible: 'hr' },
  { id: 'ob3', category: 'documents', ar: 'فتح ملف الموظف', en: 'Create employee file', responsible: 'hr' },
  { id: 'ob4', category: 'it', ar: 'إنشاء حساب الإيميل', en: 'Create email account', responsible: 'it' },
  { id: 'ob5', category: 'it', ar: 'إضافة للـ ERP', en: 'Add to ERP system', responsible: 'it' },
  { id: 'ob6', category: 'it', ar: 'تسليم اللابتوب وكلمة السر', en: 'Hand over laptop & credentials', responsible: 'it' },
  { id: 'ob7', category: 'orientation', ar: 'جولة في المكتب والتعريف بالفريق', en: 'Office tour & team intro', responsible: 'manager' },
  { id: 'ob8', category: 'orientation', ar: 'شرح سياسات الشركة', en: 'Explain company policies', responsible: 'hr' },
  { id: 'ob9', category: 'orientation', ar: 'شرح نظام الحضور والإجازات', en: 'Explain attendance & leave system', responsible: 'hr' },
  { id: 'ob10', category: 'training', ar: 'تدريب على الـ CRM', en: 'CRM system training', responsible: 'manager' },
  { id: 'ob11', category: 'training', ar: 'تدريب مبيعات أولي', en: 'Initial sales training', responsible: 'manager' },
  { id: 'ob12', category: 'finance', ar: 'فتح حساب بنكي للراتب', en: 'Open salary bank account', responsible: 'finance' },
];

const OFFBOARDING_CHECKLIST = [
  { id: 'off1', category: 'assets', ar: 'استرداد اللابتوب', en: 'Retrieve laptop', responsible: 'it' },
  { id: 'off2', category: 'assets', ar: 'استرداد بطاقة الدخول', en: 'Retrieve access card', responsible: 'hr' },
  { id: 'off3', category: 'assets', ar: 'استرداد أي أصول أخرى', en: 'Retrieve other assets', responsible: 'hr' },
  { id: 'off4', category: 'it', ar: 'تعطيل حساب الإيميل', en: 'Deactivate email account', responsible: 'it' },
  { id: 'off5', category: 'it', ar: 'إزالة صلاحيات الـ ERP', en: 'Remove ERP access', responsible: 'it' },
  { id: 'off6', category: 'finance', ar: 'صرف المستحقات المالية', en: 'Process final payment', responsible: 'finance' },
  { id: 'off7', category: 'finance', ar: 'تسوية الإجازات المتبقية', en: 'Settle remaining leave', responsible: 'hr' },
  { id: 'off8', category: 'documents', ar: 'إصدار شهادة الخبرة', en: 'Issue experience certificate', responsible: 'hr' },
  { id: 'off9', category: 'documents', ar: 'مقابلة الخروج (Exit Interview)', en: 'Exit interview', responsible: 'hr' },
  { id: 'off10', category: 'handover', ar: 'تسليم المهام للزميل', en: 'Tasks handover to colleague', responsible: 'manager' },
];

const CATEGORY_COLORS = {
  documents:   { color: '#4A7AAB', ar: 'المستندات',   en: 'Documents' },
  it:          { color: '#4A7AAB', ar: 'تقنية المعلومات', en: 'IT' },
  orientation: { color: '#4A7AAB', ar: 'التوجيه',     en: 'Orientation' },
  training:    { color: '#6B8DB5', ar: 'التدريب',     en: 'Training' },
  finance:     { color: '#EF4444', ar: 'المالية',     en: 'Finance' },
  assets:      { color: '#6B7280', ar: 'الأصول',      en: 'Assets' },
  handover:    { color: '#6B8DB5', ar: 'التسليم',     en: 'Handover' },
};

const MOCK_PROCESSES = [
  { id: 'p1', type: 'onboarding',  employee_id: 'e1', start_date: '2024-03-01', status: 'completed', completed: ONBOARDING_CHECKLIST.map(i => i.id) },
  { id: 'p2', type: 'onboarding',  employee_id: 'e2', start_date: '2026-03-01', status: 'in_progress', completed: ['ob1','ob2','ob3','ob4','ob5'] },
  { id: 'p3', type: 'offboarding', employee_id: 'e7', start_date: '2026-03-10', status: 'in_progress', completed: ['off1','off2'] },
];

export default function OnboardingPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    accent:    '#4A7AAB',
  };

  const [activeTab, setActiveTab]     = useState('active');
  const [processes, setProcesses]     = useState(MOCK_PROCESSES);
  const [selected, setSelected]       = useState(null);
  const [showNew, setShowNew]         = useState(false);
  const [newForm, setNewForm]         = useState({ type: 'onboarding', employee_id: '' });
  const [search, setSearch]           = useState('');

  const empMap = Object.fromEntries(MOCK_EMPLOYEES.map(e => [e.id, e]));

  const activeProcs  = processes.filter(p => p.status !== 'completed');
  const doneProcs    = processes.filter(p => p.status === 'completed');
  const displayProcs = activeTab === 'active' ? activeProcs : doneProcs;
  const filtered     = displayProcs.filter(p => {
    const emp = empMap[p.employee_id];
    return !search || (emp && (emp.full_name_ar + ' ' + emp.full_name_en).toLowerCase().includes(search.toLowerCase()));
  });

  const selectedProcess  = processes.find(p => p.id === selected);
  const selectedEmployee = selectedProcess ? empMap[selectedProcess.employee_id] : null;
  const checklist        = selectedProcess?.type === 'onboarding' ? ONBOARDING_CHECKLIST : OFFBOARDING_CHECKLIST;

  function toggleItem(processId, itemId) {
    setProcesses(prev => prev.map(p => {
      if (p.id !== processId) return p;
      const completed = p.completed.includes(itemId)
        ? p.completed.filter(x => x !== itemId)
        : [...p.completed, itemId];
      const allDone = (p.type === 'onboarding' ? ONBOARDING_CHECKLIST : OFFBOARDING_CHECKLIST).every(i => completed.includes(i.id));
      return { ...p, completed, status: allDone ? 'completed' : 'in_progress' };
    }));
  }

  function startNew() {
    if (!newForm.employee_id) return;
    const newProc = {
      id: 'p' + Date.now(),
      type: newForm.type,
      employee_id: newForm.employee_id,
      start_date: new Date().toISOString().slice(0, 10),
      status: 'in_progress',
      completed: [],
    };
    setProcesses(prev => [...prev, newProc]);
    setSelected(newProc.id);
    setShowNew(false);
  }

  const tabs = [
    { key: 'active', ar: 'جارية', en: 'Active', count: activeProcs.length },
    { key: 'done',   ar: 'مكتملة', en: 'Completed', count: doneProcs.length },
  ];

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: c.text, margin: 0 }}>
            {lang === 'ar' ? ' الاستقبال والمغادرة' : 'Onboarding & Offboarding'}
          </h1>
          <p style={{ color: c.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            {lang === 'ar' ? 'إدارة عمليات استقبال الموظفين الجدد ومغادرة الحاليين' : 'Manage new hire onboarding and employee offboarding'}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: c.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={15} />
          {lang === 'ar' ? 'عملية جديدة' : 'New Process'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Left — List */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', background: c.cardBg, borderRadius: 10, border: '1px solid ' + c.border, padding: 4, marginBottom: 12, gap: 4 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeTab === t.key ? c.accent : 'transparent', color: activeTab === t.key ? '#fff' : c.textMuted, transition: 'all 0.2s' }}>
                {lang === 'ar' ? t.ar : t.en} ({t.count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={13} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 10, color: c.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
              style={{ width: '100%', padding: isRTL ? '8px 30px 8px 12px' : '8px 12px 8px 30px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 12, boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr' }} />
          </div>

          {/* Process cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(proc => {
              const emp  = empMap[proc.employee_id];
              const cl   = proc.type === 'onboarding' ? ONBOARDING_CHECKLIST : OFFBOARDING_CHECKLIST;
              const pct  = Math.round((proc.completed.length / cl.length) * 100);
              const isOn = proc.type === 'onboarding';
              return (
                <div key={proc.id} onClick={() => setSelected(proc.id)}
                  style={{ background: c.cardBg, border: `1px solid ${selected === proc.id ? c.accent : c.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 18 }}>{isOn ? '' : ''}</span>
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{emp?.full_name_ar || '—'}</div>
                        <div style={{ fontSize: 11, color: isOn ? '#4A7AAB' : '#EF4444', fontWeight: 600 }}>
                          {isOn ? (lang === 'ar' ? 'استقبال' : 'Onboarding') : (lang === 'ar' ? 'مغادرة' : 'Offboarding')}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#4A7AAB' : c.accent }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: pct + '%', background: pct === 100 ? '#4A7AAB' : c.accent, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: c.textMuted, marginTop: 5, textAlign: isRTL ? 'right' : 'left' }}>
                    {proc.completed.length}/{cl.length} {lang === 'ar' ? 'مهمة' : 'tasks'} · {proc.start_date}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: c.textMuted, fontSize: 13 }}>
                {lang === 'ar' ? 'لا توجد عمليات' : 'No processes found'}
              </div>
            )}
          </div>
        </div>

        {/* Right — Checklist */}
        {selectedProcess && selectedEmployee ? (
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, overflow: 'hidden' }}>
            {/* Process header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + c.border, background: selectedProcess.type === 'onboarding' ? '#4A7AAB08' : '#EF444408' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', fontWeight: 700 }}>
                  {(selectedEmployee.full_name_ar || selectedEmployee.full_name_en || '?').charAt(0)}
                </div>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{selectedEmployee.full_name_ar}</div>
                  <div style={{ fontSize: 12, color: c.textMuted }}>{selectedEmployee.position} · {selectedProcess.start_date}</div>
                </div>
                <div style={{ marginInlineStart: 'auto', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: selectedProcess.type === 'onboarding' ? '#4A7AAB' : '#EF4444' }}>
                    {Math.round((selectedProcess.completed.length / checklist.length) * 100)}%
                  </div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>{selectedProcess.completed.length}/{checklist.length}</div>
                </div>
              </div>
            </div>

            {/* Checklist grouped by category */}
            <div style={{ padding: 20, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              {Object.entries(
                checklist.reduce((acc, item) => {
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {})
              ).map(([cat, items]) => {
                const catInfo = CATEGORY_COLORS[cat] || { color: '#6B7280', ar: cat, en: cat };
                const doneCat = items.filter(i => selectedProcess.completed.includes(i.id)).length;
                return (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: catInfo.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: catInfo.color }}>{lang === 'ar' ? catInfo.ar : catInfo.en}</span>
                      <span style={{ fontSize: 11, color: c.textMuted }}>({doneCat}/{items.length})</span>
                    </div>
                    {items.map(item => {
                      const done = selectedProcess.completed.includes(item.id);
                      return (
                        <div key={item.id} onClick={() => toggleItem(selectedProcess.id, item.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: done ? (isDark ? 'rgba(16,185,129,0.06)' : 'rgba(74,122,171,0.06)') : (isDark ? 'rgba(255,255,255,0.02)' : '#F9FAFB'), border: `1px solid ${done ? '#4A7AAB30' : c.border}`, flexDirection: isRTL ? 'row-reverse' : 'row', transition: 'all 0.2s' }}>
                          {done ? <CheckSquare size={16} color="#4A7AAB" /> : <Square size={16} color={c.textMuted} />}
                          <span style={{ flex: 1, fontSize: 13, color: done ? c.textMuted : c.text, textDecoration: done ? 'line-through' : 'none', textAlign: isRTL ? 'right' : 'left' }}>
                            {lang === 'ar' ? item.ar : item.en}
                          </span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: catInfo.color + '20', color: catInfo.color, fontWeight: 600 }}>
                            {item.responsible.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {selectedProcess.status === 'completed' && (
                <div style={{ padding: '16px 20px', borderRadius: 10, background: '#4A7AAB10', border: '1px solid #4A7AAB30', display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <CheckCircle size={20} color="#4A7AAB" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#4A7AAB' }}>
                    {lang === 'ar' ? ' تمت العملية بنجاح!' : 'Process completed successfully!'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <div style={{ textAlign: 'center', color: c.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <p style={{ fontSize: 14 }}>{lang === 'ar' ? 'اختر عملية من القائمة' : 'Select a process from the list'}</p>
            </div>
          </div>
        )}
      </div>

      {/* New Process Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: c.cardBg, borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <h3 style={{ margin: 0, color: c.text, fontSize: 16, fontWeight: 700 }}>{lang === 'ar' ? 'عملية جديدة' : 'New Process'}</h3>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'النوع' : 'Type'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ key: 'onboarding', ar: 'استقبال', en: 'Onboarding' }, { key: 'offboarding', ar: 'مغادرة', en: 'Offboarding' }].map(t => (
                    <button key={t.key} onClick={() => setNewForm(p => ({ ...p, type: t.key }))}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: `2px solid ${newForm.type === t.key ? c.accent : c.border}`, background: newForm.type === t.key ? c.accent + '15' : 'transparent', color: newForm.type === t.key ? c.accent : c.text, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {lang === 'ar' ? t.ar : t.en}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'الموظف' : 'Employee'}</label>
                <select value={newForm.employee_id} onChange={e => setNewForm(p => ({ ...p, employee_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
                  <option value="">{lang === 'ar' ? '— اختر موظف —' : '— Select Employee —'}</option>
                  {MOCK_EMPLOYEES.map(e => <option key={e.id} value={e.id}>{e.full_name_ar}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid ' + c.border, background: 'transparent', color: c.text, fontSize: 13, cursor: 'pointer' }}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={startNew} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: c.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {lang === 'ar' ? 'ابدأ' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
