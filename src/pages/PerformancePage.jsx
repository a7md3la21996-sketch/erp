import { useState, useMemo } from 'react';
import { useDS } from '../hooks/useDesignSystem';
import { useTranslation } from 'react-i18next';
import {
  Target, TrendingUp, TrendingDown, Users, Star,
  ChevronRight, Award, AlertTriangle, CheckCircle,
  BarChart2, Calendar, Filter, Search
} from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS, COMPETENCIES } from '../data/hr_mock_data';
import { getAttendanceForMonth } from '../data/attendanceStore';

// ── Mock CRM Activity Data ─────────────────────────────────────
const MOCK_CRM_ACTIVITY = {
  e1:  { calls: 48, opportunities: 12, deals_closed: 3, leads: 0,  campaigns: 0,  revenue: 285000 },
  e2:  { calls: 35, opportunities: 8,  deals_closed: 2, leads: 0,  campaigns: 0,  revenue: 195000 },
  e3:  { calls: 22, opportunities: 5,  deals_closed: 1, leads: 0,  campaigns: 0,  revenue: 95000  },
  e4:  { calls: 0,  opportunities: 0,  deals_closed: 0, leads: 42, campaigns: 4,  revenue: 0      },
  e5:  { calls: 41, opportunities: 10, deals_closed: 3, leads: 0,  campaigns: 0,  revenue: 310000 },
  e6:  { calls: 0,  opportunities: 0,  deals_closed: 0, leads: 28, campaigns: 3,  revenue: 0      },
  e7:  { calls: 0,  opportunities: 0,  deals_closed: 0, leads: 0,  campaigns: 0,  revenue: 0      },
  e8:  { calls: 0,  opportunities: 0,  deals_closed: 0, leads: 0,  campaigns: 0,  revenue: 0      },
  e9:  { calls: 18, opportunities: 4,  deals_closed: 1, leads: 0,  campaigns: 0,  revenue: 75000  },
  e10: { calls: 29, opportunities: 7,  deals_closed: 2, leads: 0,  campaigns: 0,  revenue: 155000 },
};

// ── Competency scores (consistent with CompetenciesPage) ──────
function genCompScores(empId) {
  const seed = empId.charCodeAt(empId.length - 1);
  return COMPETENCIES.reduce((acc, c, i) => {
    acc[c.key] = Math.min(5, Math.max(1, Math.round(2.5 + ((seed * (i + 3)) % 25) / 10)));
    return acc;
  }, {});
}
function calcWeightedScore(scores) {
  const total = COMPETENCIES.reduce((sum, c) => sum + (scores[c.key] || 3) * c.weight, 0);
  return Math.round((total / 100) * 10) / 10;
}
const EMP_COMP_SCORES = Object.fromEntries(
  MOCK_EMPLOYEES.map(emp => [emp.id, calcWeightedScore(genCompScores(emp.id))])
);

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;

// KPI definitions per department with frequency
const DEPT_KPIS = {
  sales: [
    { key: 'calls',        ar: 'المكالمات',      en: 'Calls',          freq: 'daily',   target: 50,  unit: '',      source: 'crm'        },
    { key: 'opportunities',ar: 'الفرص',          en: 'Opportunities',  freq: 'weekly',  target: 10,  unit: '',      source: 'crm'        },
    { key: 'deals_closed', ar: 'الصفقات',        en: 'Deals Closed',   freq: 'monthly', target: 3,   unit: '',      source: 'crm'        },
    { key: 'revenue',      ar: 'الإيرادات',      en: 'Revenue',        freq: 'monthly', target: 250000, unit: 'EGP', source: 'crm'      },
    { key: 'attendance',   ar: 'الحضور',         en: 'Attendance',     freq: 'daily',   target: 22,  unit: 'days',  source: 'hr'         },
  ],
  marketing: [
    { key: 'leads',        ar: 'الليدز',         en: 'Leads',          freq: 'daily',   target: 40,  unit: '',      source: 'crm'        },
    { key: 'campaigns',    ar: 'الحملات',        en: 'Campaigns',      freq: 'monthly', target: 4,   unit: '',      source: 'crm'        },
    { key: 'attendance',   ar: 'الحضور',         en: 'Attendance',     freq: 'daily',   target: 22,  unit: 'days',  source: 'hr'         },
  ],
  hr: [
    { key: 'attendance',   ar: 'الحضور',         en: 'Attendance',     freq: 'daily',   target: 22,  unit: 'days',  source: 'hr'         },
  ],
  finance: [
    { key: 'attendance',   ar: 'الحضور',         en: 'Attendance',     freq: 'daily',   target: 22,  unit: 'days',  source: 'hr'         },
  ],
};

const FREQ_CONFIG = {
  daily:     { ar: 'يومي',       en: 'Daily',     color: '#4A7AAB' },
  weekly:    { ar: 'أسبوعي',    en: 'Weekly',    color: '#4A7AAB' },
  monthly:   { ar: 'شهري',      en: 'Monthly',   color: '#4A7AAB' },
  quarterly: { ar: 'ربع سنوي', en: 'Quarterly', color: '#6B8DB5' },
};

// Build employee performance data
function buildEmpData(emp, attendance) {
  const att = attendance.filter(r => r.employee_id === emp.id);
  const presentDays = att.filter(r => r.check_in && !r.absent).length;
  const lateDays = att.filter(r => r.check_in && !r.absent).filter(r => { const [h, m] = (r.check_in || '').split(':').map(Number); return h > 10 || (h === 10 && m > 30); }).length;
  const crm = MOCK_CRM_ACTIVITY[emp.id] || {};
  const kpis = DEPT_KPIS[emp.department] || DEPT_KPIS.hr;

  const scores = kpis.map(kpi => {
    let actual = 0;
    if (kpi.key === 'attendance') actual = presentDays;
    else actual = crm[kpi.key] || 0;
    const pct = Math.min(Math.round((actual / kpi.target) * 100), 150);
    return { ...kpi, actual, pct };
  });

  const avgPct = scores.length > 0
    ? Math.round(scores.reduce((s, k) => s + k.pct, 0) / scores.length)
    : 0;

  const compScore = EMP_COMP_SCORES[emp.id] || 3;
  return { emp, scores, avgPct, presentDays, lateDays, crm, compScore };
}

// 9-Box position based on performance % and attendance
function get9BoxPos(avgPct, compScore) {
  const perf      = avgPct >= 90 ? 2 : avgPct >= 60 ? 1 : 0;
  const potential = compScore >= 4 ? 2 : compScore >= 3 ? 1 : 0;
  return { perf, potential };
}

const BOX_LABELS = {
  ar: [
    ['خطر ',        'موظف أساسي ',  'ملهم '],
    ['مراقبة ',     'موظف جيد ',    'أداء عالي '],
    ['إعادة توجيه',   'نجم صاعد ',    'نجم '],
  ],
  en: [
    ['Risk ',       'Key Player ',  'Inspire '],
    ['Monitor ',    'Good Emp ',    'High Perf '],
    ['Re-direct',     'Rising Star ', 'Star '],
  ],
};

const BOX_COLORS = [
  ['#EF4444', '#6B8DB5', '#4A7AAB'],
  ['#EF4444', '#4A7AAB', '#4A7AAB'],
  ['#6B7280', '#4A7AAB', '#4A7AAB'],
];

export default function PerformancePage() {
  const { i18n } = useTranslation();
  const c = useDS();
  const isDark = c.dark;
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedEmp, setSelectedEmp] = useState(null);

  const attendance = getAttendanceForMonth(YEAR, MONTH);
  const empData = useMemo(() =>
    MOCK_EMPLOYEES.map(emp => buildEmpData(emp, attendance)),
    [attendance]
  );

  const filtered = useMemo(() => empData.filter(d => {
    const name = lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en;
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || d.emp.department === deptFilter;
    return matchSearch && matchDept;
  }), [empData, search, deptFilter, lang]);

  // Stats
  const avgPerf = Math.round(empData.reduce((s, d) => s + d.avgPct, 0) / empData.length);
  const topPerformers = empData.filter(d => d.avgPct >= 90).length;
  const atRisk = empData.filter(d => d.avgPct < 50).length;

  const tabs = [
    { key: 'overview',  ar: 'نظرة عامة',    en: 'Overview'   },
    { key: 'kpis',      ar: 'مؤشرات الأداء', en: 'KPIs'       },
    { key: 'ninebox',   ar: 'مصفوفة 9-Box',  en: '9-Box'      },
    { key: 'activity',  ar: 'النشاط',        en: 'Activity'   },
    { key: 'bsc',       ar: 'Balanced Scorecard', en: 'Balanced Scorecard' },
  ];

  const MOCK_SALES_BSC = { achieved: 1250000, target: 1500000 };
  const MOCK_CRM_BSC   = { closedDeals: 11, conversionRate: 7.7 };
  const avgAttendance  = Math.round(empData.reduce((s,d) => s + d.presentDays, 0) / empData.length);
  const avgCompScore   = Math.round(empData.reduce((s,d) => s + d.compScore, 0) / empData.length * 10) / 10;

  const BSC_PERSPECTIVES = [
    {
      key: 'financial', icon: '', ar: 'المالي', en: 'Financial', color: '#4A7AAB',
      objectives: [
        { ar: 'تحقيق التارجت الشهري',  en: 'Monthly target',      actual: MOCK_SALES_BSC.achieved, target: MOCK_SALES_BSC.target, unit: 'EGP' },
        { ar: 'تقليل تكاليف التوظيف', en: 'Reduce hiring costs',  actual: 18000,                   target: 25000,                unit: 'EGP' },
      ],
    },
    {
      key: 'customer', icon: '', ar: 'العملاء', en: 'Customer', color: '#4A7AAB',
      objectives: [
        { ar: 'معدل تحويل الليدز',   en: 'Lead conversion rate', actual: MOCK_CRM_BSC.conversionRate, target: 10,  unit: '%' },
        { ar: 'الصفقات المغلقة',      en: 'Deals closed',         actual: MOCK_CRM_BSC.closedDeals,    target: 15,  unit: ''  },
      ],
    },
    {
      key: 'internal', icon: '', ar: 'العمليات الداخلية', en: 'Internal Processes', color: '#6B8DB5',
      objectives: [
        { ar: 'معدل الحضور',           en: 'Attendance rate',      actual: avgAttendance, target: 22,  unit: 'days' },
        { ar: 'وقت الاستجابة',         en: 'Response time',        actual: 4,             target: 2,   unit: 'h'    },
      ],
    },
    {
      key: 'learning', icon: '', ar: 'التعلم والنمو', en: 'Learning & Growth', color: '#4A7AAB',
      objectives: [
        { ar: 'اكتمال التدريب',        en: 'Training completion',  actual: 65,            target: 80,  unit: '%'   },
        { ar: 'متوسط تقييم الكفاءات', en: 'Avg competency score', actual: avgCompScore,   target: 4,   unit: '/5'  },
      ],
    },
  ];

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2B4C6F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? 'متابعة الأداء' : 'Performance Tracking'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: c.muted }}>
              {lang === 'ar' ? 'KPIs مبنية على بيانات CRM + الحضور — مارس 2026' : 'KPIs from CRM + Attendance data — March 2026'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: lang === 'ar' ? 'متوسط الأداء' : 'Avg Performance', value: avgPerf + '%', icon: '', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'متميزون' : 'Top Performers',       value: topPerformers,  icon: '', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'يحتاجون متابعة' : 'Need Attention', value: atRisk,         icon: '', color: '#EF4444' },
          { label: lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees', value: MOCK_EMPLOYEES.length, icon: '', color: '#4A7AAB' },
        ].map((s, i) => (
          <div key={i} style={{ background: c.card, borderRadius: 12, border: '1px solid ' + c.border, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: c.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '11px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: activeTab === t.key ? c.accent : c.muted,
            borderBottom: activeTab === t.key ? '2px solid ' + c.accent : '2px solid transparent',
          }}>
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employee...'}
            style={{ width: '100%', padding: isRTL ? '9px 38px 9px 12px' : '9px 12px 9px 38px', borderRadius: 8, border: '1px solid ' + c.border, background: c.input, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.input, color: c.text, fontSize: 13, cursor: 'pointer' }}>
          <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}
        </select>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.sort((a, b) => b.avgPct - a.avgPct).map((d, idx) => {
            const dept = DEPARTMENTS.find(dep => dep.id === d.emp.department);
            const color = d.avgPct >= 90 ? '#4A7AAB' : d.avgPct >= 60 ? '#6B8DB5' : '#EF4444';
            return (
              <div key={d.emp.id} role="button" tabIndex={0} onClick={() => setSelectedEmp(selectedEmp?.emp.id === d.emp.id ? null : d)}
                onKeyDown={e => { if(e.key==='Enter'||e.key===' ') setSelectedEmp(selectedEmp?.emp.id === d.emp.id ? null : d); }}
                style={{ background: c.card, borderRadius: 12, border: '1px solid ' + c.border, padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s', flexDirection: isRTL ? 'row-reverse' : 'row' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = c.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = c.border}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  {/* Rank */}
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: idx < 3 ? ['#6B8DB5','#8BA8C8','#4A7AAB'][idx] + '20' : c.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: idx < 3 ? ['#6B8DB5','#8BA8C8','#4A7AAB'][idx] : c.muted, flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: d.emp.avatar_color || '#2B4C6F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en).charAt(0)}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</div>
                    <div style={{ fontSize: 11, color: c.muted }}>{lang === 'ar' ? d.emp.job_title_ar : d.emp.job_title_en} · {dept ? (lang === 'ar' ? dept.name_ar : dept.name_en) : ''}</div>
                  </div>
                  {/* Quick Stats */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: 'center', minWidth: 50 }}>
                      <div style={{ fontSize: 11, color: c.muted }}>{lang === 'ar' ? 'حضور' : 'Attend'}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{d.presentDays}d</div>
                    </div>
                    {d.crm.calls > 0 && (
                      <div style={{ textAlign: 'center', minWidth: 50 }}>
                        <div style={{ fontSize: 11, color: c.muted }}>{lang === 'ar' ? 'مكالمات' : 'Calls'}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{d.crm.calls}</div>
                      </div>
                    )}
                    {d.crm.deals_closed > 0 && (
                      <div style={{ textAlign: 'center', minWidth: 50 }}>
                        <div style={{ fontSize: 11, color: c.muted }}>{lang === 'ar' ? 'صفقات' : 'Deals'}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#4A7AAB' }}>{d.crm.deals_closed}</div>
                      </div>
                    )}
                    {/* Score */}
                    <div style={{ textAlign: 'center', minWidth: 60 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color }}>{d.avgPct}%</div>
                      <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', marginTop: 4, width: 60 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: Math.min(d.avgPct, 100) + '%', background: color }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded KPIs */}
                {selectedEmp?.emp.id === d.emp.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid ' + c.border }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 10 }}>
                      {d.scores.map((kpi, i) => {
                        const freq = FREQ_CONFIG[kpi.freq];
                        const kpiColor = kpi.pct >= 90 ? '#4A7AAB' : kpi.pct >= 60 ? '#6B8DB5' : '#EF4444';
                        return (
                          <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC', border: '1px solid ' + c.border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                              <span style={{ fontSize: 12, color: c.muted }}>{lang === 'ar' ? kpi.ar : kpi.en}</span>
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: freq.color + '20', color: freq.color }}>{lang === 'ar' ? freq.ar : freq.en}</span>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: kpiColor, textAlign: isRTL ? 'right' : 'left' }}>
                              {kpi.actual.toLocaleString()}{kpi.unit === 'EGP' ? '' : ''}
                              <span style={{ fontSize: 11, fontWeight: 400, color: c.muted }}> / {kpi.target.toLocaleString()}</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', marginTop: 6 }}>
                              <div style={{ height: '100%', borderRadius: 2, width: Math.min(kpi.pct, 100) + '%', background: kpiColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Source note */}
                    <div style={{ marginTop: 10, fontSize: 11, color: c.muted, textAlign: isRTL ? 'right' : 'left' }}>
                       {lang === 'ar' ? 'البيانات من: CRM + الحضور' : 'Data from: CRM + Attendance'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPIs TAB ── */}
      {activeTab === 'kpis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(DEPT_KPIS).map(([deptKey, kpis]) => {
            const dept = DEPARTMENTS.find(d => d.id === deptKey);
            if (!dept) return null;
            const deptEmps = empData.filter(d => d.emp.department === deptKey);
            if (deptEmps.length === 0) return null;
            return (
              <div key={deptKey} style={{ background: c.card, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + c.border, background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{lang === 'ar' ? dept.name_ar : dept.name_en}</div>
                  <div style={{ fontSize: 12, color: c.muted }}>{deptEmps.length} {lang === 'ar' ? 'موظف' : 'employees'}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.muted }}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                      {kpis.map(kpi => (
                        <th key={kpi.key} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: c.muted, whiteSpace: 'nowrap' }}>
                          <div>{lang === 'ar' ? kpi.ar : kpi.en}</div>
                          <div style={{ fontSize: 10, color: FREQ_CONFIG[kpi.freq]?.color }}>{lang === 'ar' ? FREQ_CONFIG[kpi.freq]?.ar : FREQ_CONFIG[kpi.freq]?.en}</div>
                        </th>
                      ))}
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: c.muted }}>{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptEmps.map((d, i) => (
                      <tr key={d.emp.id} style={{ borderTop: '1px solid ' + c.border }}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</div>
                        </td>
                        {d.scores.map((kpi, j) => {
                          const kpiColor = kpi.pct >= 90 ? '#4A7AAB' : kpi.pct >= 60 ? '#6B8DB5' : '#EF4444';
                          return (
                            <td key={j} style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: kpiColor }}>{kpi.actual.toLocaleString()}</div>
                              <div style={{ fontSize: 10, color: c.muted }}>/{kpi.target}</div>
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: d.avgPct >= 90 ? '#4A7AAB' : d.avgPct >= 60 ? '#6B8DB5' : '#EF4444' }}>{d.avgPct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 9-BOX TAB ── */}
      {activeTab === 'ninebox' && (
        <div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.08)', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.2)'), marginBottom: 20, fontSize: 13, color: isDark ? '#8BA8C8' : '#4A7AAB' }}>
            {lang === 'ar' ? ' المحور الأفقي: الأداء (KPIs) · المحور الرأسي: الالتزام (الحضور)' : 'X-axis: Performance (KPIs) · Y-axis: Commitment (Attendance)'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[2,1,0].map(potential => (
              [0,1,2].map(perf => {
                const boxEmps = filtered.filter(d => {
                  const pos = get9BoxPos(d.avgPct, d.compScore);
                  return pos.perf === perf && pos.potential === potential;
                });
                const label = BOX_LABELS[lang][2 - potential][perf];
                const color = BOX_COLORS[2 - potential][perf];
                return (
                  <div key={`${potential}-${perf}`} style={{ background: c.card, borderRadius: 10, border: '2px solid ' + color + '30', padding: '14px', minHeight: 100 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>{label}</div>
                    {boxEmps.length === 0 ? (
                      <div style={{ fontSize: 11, color: c.muted, textAlign: 'center', padding: '10px 0' }}>—</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {boxEmps.map(d => (
                          <div key={d.emp.id} title={lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en} style={{ width: 30, height: 30, borderRadius: '50%', background: `hsl(${d.emp.id.charCodeAt(1) * 40},60%,50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                            {(lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en).charAt(0)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Activity Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: lang === 'ar' ? 'إجمالي المكالمات' : 'Total Calls', value: Object.values(MOCK_CRM_ACTIVITY).reduce((s,d) => s + d.calls, 0), icon: '', color: '#4A7AAB' },
              { label: lang === 'ar' ? 'الفرص المفتوحة' : 'Open Opportunities', value: Object.values(MOCK_CRM_ACTIVITY).reduce((s,d) => s + d.opportunities, 0), icon: '', color: '#4A7AAB' },
              { label: lang === 'ar' ? 'الصفقات المغلقة' : 'Deals Closed', value: Object.values(MOCK_CRM_ACTIVITY).reduce((s,d) => s + d.deals_closed, 0), icon: '', color: '#4A7AAB' },
            ].map((s, i) => (
              <div key={i} style={{ background: c.card, borderRadius: 12, border: '1px solid ' + c.border, padding: '16px 18px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: c.muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Activity vs Results */}
          <div style={{ background: c.card, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + c.border, fontSize: 14, fontWeight: 700, color: c.text, textAlign: isRTL ? 'right' : 'left' }}>
              {lang === 'ar' ? 'النشاط مقابل النتائج — Sales' : 'Activity vs Results — Sales'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC' }}>
                  {[lang === 'ar' ? 'الموظف' : 'Employee', lang === 'ar' ? 'مكالمات' : 'Calls', lang === 'ar' ? 'فرص' : 'Opps', lang === 'ar' ? 'صفقات' : 'Deals', lang === 'ar' ? 'الإيرادات' : 'Revenue', lang === 'ar' ? 'التحليل' : 'Analysis'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empData.filter(d => d.emp.department === 'sales').map((d, i) => {
                  const convRate = d.crm.calls > 0 ? ((d.crm.deals_closed / d.crm.calls) * 100).toFixed(1) : 0;
                  const analysis = d.crm.calls >= 40 && d.crm.deals_closed >= 3
                    ? { ar: 'نجم ', en: 'Star ', color: '#4A7AAB' }
                    : d.crm.calls >= 30 && d.crm.deals_closed < 2
                    ? { ar: 'مهارة ', en: 'Skill Gap ', color: '#6B8DB5' }
                    : d.crm.calls < 20
                    ? { ar: 'نشاط منخفض', en: 'Low Activity', color: '#EF4444' }
                    : { ar: 'جيد ', en: 'Good ', color: '#4A7AAB' };
                  return (
                    <tr key={d.emp.id} style={{ borderTop: i > 0 ? '1px solid ' + c.border : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: c.text }}>{d.crm.calls}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: c.text }}>{d.crm.opportunities}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#4A7AAB' }}>{d.crm.deals_closed}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: c.accent }}>{d.crm.revenue > 0 ? (d.crm.revenue / 1000).toFixed(0) + 'K' : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: analysis.color + '20', color: analysis.color }}>
                          {lang === 'ar' ? analysis.ar : analysis.en}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Golden Rule */}
          <div style={{ padding: '14px 20px', borderRadius: 10, background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(74,122,171,0.08)', border: '1px solid ' + (isDark ? 'rgba(99,102,241,0.2)' : '#8BA8C8') }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#8BA8C8' : '#2B4C6F', marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {lang === 'ar' ? ' القاعدة الذهبية' : 'Golden Rule'}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {[
                { ar: 'نشاط عالي + نتيجة عالية = نجم → مكافأة', en: 'High Activity + High Results = Star → Reward', color: '#4A7AAB' },
                { ar: 'نشاط عالي + نتيجة ضعيفة = مشكلة مهارة → تدريب', en: 'High Activity + Low Results = Skill Gap → Training', color: '#6B8DB5' },
                { ar: 'نشاط منخفض + نتيجة ضعيفة = مشكلة التزام → متابعة', en: 'Low Activity + Low Results = Commitment Issue → Follow Up', color: '#EF4444' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: isDark ? '#8BA8C8' : '#2B4C6F' }}>{lang === 'ar' ? r.ar : r.en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── BSC TAB ── */}
      {activeTab === 'bsc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {BSC_PERSPECTIVES.map(p => {
              const avg = Math.round(p.objectives.reduce((s,o) => s + Math.min((o.actual / o.target) * 100, 100), 0) / p.objectives.length);
              return (
                <div key={p.key} style={{ background: c.card, borderRadius: 12, border: `2px solid ${p.color}30`, padding: '16px 18px', textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>{lang === 'ar' ? p.ar : p.en}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: p.color }}>{avg}%</div>
                  <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', marginTop: 8 }}>
                    <div style={{ height: '100%', borderRadius: 2, width: avg + '%', background: p.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          {BSC_PERSPECTIVES.map(p => (
            <div key={p.key} style={{ background: c.card, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid ' + c.border, background: p.color + '10', display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{lang === 'ar' ? p.ar : p.en}</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {p.objectives.map((o, i) => {
                  const pct  = Math.min(Math.round((o.actual / o.target) * 100), 150);
                  const disp = Math.min(pct, 100);
                  const col  = pct >= 90 ? '#4A7AAB' : pct >= 60 ? '#6B8DB5' : '#EF4444';
                  const fmt  = v => typeof v === 'number' && v > 1000 ? (v / 1000).toFixed(0) + 'K' : v;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 13, color: c.text, fontWeight: 500 }}>{lang === 'ar' ? o.ar : o.en}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{fmt(o.actual)}{o.unit}</span>
                          <span style={{ fontSize: 11, color: c.muted }}>/ {fmt(o.target)}{o.unit}</span>
                          {pct > 100 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#4A7AAB20', color: '#4A7AAB', fontWeight: 600 }}>+{pct - 100}%</span>}
                        </div>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: disp + '%', background: `linear-gradient(90deg,${col}99,${col})` }} />
                      </div>
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 3, textAlign: isRTL ? 'right' : 'left' }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ padding: '14px 18px', borderRadius: 10, background: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(74,122,171,0.06)', border: '1px solid ' + (isDark ? 'rgba(139,92,246,0.2)' : 'rgba(74,122,171,0.15)'), fontSize: 12, color: isDark ? '#8BA8C8' : '#2B4C6F', textAlign: isRTL ? 'right' : 'left' }}>
             {lang === 'ar' ? 'البيانات ستكون حقيقية بعد ربط الـ modules — Finance + CRM + Sales' : 'Data will be live once Finance, CRM & Sales modules are connected.'}
          </div>
        </div>
      )}

    </div>
  );
}
