import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Target, TrendingUp, TrendingDown, Users, Star,
  ChevronRight, Award, AlertTriangle, CheckCircle,
  BarChart2, Calendar, Filter, Search
} from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS, COMPETENCIES } from '../data/hr_mock_data';
import { getAttendanceForMonth } from '../data/attendanceStore';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import Input, { Select } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import KpiCard from '../components/ui/KpiCard';
import ExportButton from '../components/ui/ExportButton';

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
    <div className={`p-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-[10px] bg-brand-800 flex items-center justify-center">
            <Target size={20} color="#fff" />
          </div>
          <div>
            <h1 className="m-0 text-[22px] font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'متابعة الأداء' : 'Performance Tracking'}
            </h1>
            <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'KPIs مبنية على بيانات CRM + الحضور — مارس 2026' : 'KPIs from CRM + Attendance data — March 2026'}
            </p>
          </div>
        </div>
        <ExportButton
          data={filtered.map(d => ({
            name: lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en,
            job_title: lang === 'ar' ? d.emp.job_title_ar : d.emp.job_title_en,
            department: d.emp.department,
            performance: d.avgPct + '%',
            attendance: d.presentDays + ' days',
            competency: d.compScore,
          }))}
          filename={isRTL ? 'الأداء' : 'performance'}
          title={isRTL ? 'متابعة الأداء' : 'Performance Tracking'}
          columns={[
            { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
            { header: isRTL ? 'الوظيفة' : 'Job Title', key: 'job_title' },
            { header: isRTL ? 'القسم' : 'Department', key: 'department' },
            { header: isRTL ? 'الأداء' : 'Performance', key: 'performance' },
            { header: isRTL ? 'الحضور' : 'Attendance', key: 'attendance' },
            { header: isRTL ? 'الكفاءة' : 'Competency', key: 'competency' },
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {[
          { label: lang === 'ar' ? 'متوسط الأداء' : 'Avg Performance', value: avgPerf + '%', icon: '', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'متميزون' : 'Top Performers',       value: topPerformers,  icon: '', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'يحتاجون متابعة' : 'Need Attention', value: atRisk,         icon: '', color: '#EF4444' },
          { label: lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees', value: MOCK_EMPLOYEES.length, icon: '', color: '#4A7AAB' },
        ].map((s, i) => (
          <Card key={i} className="px-[18px] py-4">
            <div className="text-[22px] mb-1.5">{s.icon}</div>
            <div className="text-[26px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className={`flex gap-0 mb-5 border-b border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-[11px] border-none cursor-pointer text-[13px] font-medium bg-transparent transition-colors duration-200
              ${activeTab === t.key
                ? 'text-brand-500 border-b-2 border-brand-500'
                : 'text-content-muted dark:text-content-muted-dark border-b-2 border-transparent'
              }`}
          >
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={`flex gap-2.5 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="relative flex-1 max-w-[300px]">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark start-3" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employee...'}
            className="ps-[38px] pe-3"
          />
        </div>
        <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-auto">
          <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}
        </Select>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-2.5">
          {filtered.sort((a, b) => b.avgPct - a.avgPct).map((d, idx) => {
            const dept = DEPARTMENTS.find(dep => dep.id === d.emp.department);
            const color = d.avgPct >= 90 ? '#4A7AAB' : d.avgPct >= 60 ? '#6B8DB5' : '#EF4444';
            return (
              <Card key={d.emp.id} hover
                role="button" tabIndex={0}
                onClick={() => setSelectedEmp(selectedEmp?.emp.id === d.emp.id ? null : d)}
                onKeyDown={e => { if(e.key==='Enter'||e.key===' ') setSelectedEmp(selectedEmp?.emp.id === d.emp.id ? null : d); }}
                className="px-[18px] py-3.5"
              >
                <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Rank */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx >= 3 ? 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark' : ''}`}
                    style={idx < 3 ? {
                      background: ['#6B8DB5','#8BA8C8','#4A7AAB'][idx] + '20',
                      color: ['#6B8DB5','#8BA8C8','#4A7AAB'][idx],
                    } : undefined}
                  >
                    {idx + 1}
                  </div>
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: d.emp.avatar_color || '#2B4C6F' }}
                  >
                    {(lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en).charAt(0)}
                  </div>
                  {/* Info */}
                  <div className={`flex-1 text-start`}>
                    <div className="text-sm font-semibold text-content dark:text-content-dark">{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</div>
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? d.emp.job_title_ar : d.emp.job_title_en} · {dept ? (lang === 'ar' ? dept.name_ar : dept.name_en) : ''}</div>
                  </div>
                  {/* Quick Stats */}
                  <div className={`flex gap-4 items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="text-center min-w-[50px]">
                      <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'حضور' : 'Attend'}</div>
                      <div className="text-[13px] font-bold text-content dark:text-content-dark">{d.presentDays}d</div>
                    </div>
                    {d.crm.calls > 0 && (
                      <div className="text-center min-w-[50px]">
                        <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'مكالمات' : 'Calls'}</div>
                        <div className="text-[13px] font-bold text-content dark:text-content-dark">{d.crm.calls}</div>
                      </div>
                    )}
                    {d.crm.deals_closed > 0 && (
                      <div className="text-center min-w-[50px]">
                        <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'صفقات' : 'Deals'}</div>
                        <div className="text-[13px] font-bold text-brand-500">{d.crm.deals_closed}</div>
                      </div>
                    )}
                    {/* Score */}
                    <div className="text-center min-w-[60px]">
                      <div className="text-xl font-extrabold" style={{ color }}>{d.avgPct}%</div>
                      <div className="h-1 rounded-sm bg-gray-200 dark:bg-white/[0.08] mt-1 w-[60px]">
                        <div className="h-full rounded-sm" style={{ width: Math.min(d.avgPct, 100) + '%', background: color }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded KPIs */}
                {selectedEmp?.emp.id === d.emp.id && (
                  <div className="mt-3.5 pt-3.5 border-t border-edge dark:border-edge-dark">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
                      {d.scores.map((kpi, i) => {
                        const freq = FREQ_CONFIG[kpi.freq];
                        const kpiColor = kpi.pct >= 90 ? '#4A7AAB' : kpi.pct >= 60 ? '#6B8DB5' : '#EF4444';
                        return (
                          <div key={i} className="px-3 py-2.5 rounded-lg bg-brand-500/[0.06] dark:bg-brand-500/[0.06] border border-edge dark:border-edge-dark">
                            <div className={`flex justify-between mb-1 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                              <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? kpi.ar : kpi.en}</span>
                              <Badge size="sm" className="rounded-[10px]" style={{ background: freq.color + '20', color: freq.color }}>{lang === 'ar' ? freq.ar : freq.en}</Badge>
                            </div>
                            <div className={`text-lg font-extrabold text-start`} style={{ color: kpiColor }}>
                              {kpi.actual.toLocaleString()}{kpi.unit === 'EGP' ? '' : ''}
                              <span className="text-[11px] font-normal text-content-muted dark:text-content-muted-dark"> / {kpi.target.toLocaleString()}</span>
                            </div>
                            <div className="h-[3px] rounded-sm bg-gray-200 dark:bg-white/[0.08] mt-1.5">
                              <div className="h-full rounded-sm" style={{ width: Math.min(kpi.pct, 100) + '%', background: kpiColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Source note */}
                    <div className={`mt-2.5 text-[11px] text-content-muted dark:text-content-muted-dark text-start`}>
                       {lang === 'ar' ? 'البيانات من: CRM + الحضور' : 'Data from: CRM + Attendance'}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── KPIs TAB ── */}
      {activeTab === 'kpis' && (
        <div className="flex flex-col gap-5">
          {Object.entries(DEPT_KPIS).map(([deptKey, kpis]) => {
            const dept = DEPARTMENTS.find(d => d.id === deptKey);
            if (!dept) return null;
            const deptEmps = empData.filter(d => d.emp.department === deptKey);
            if (deptEmps.length === 0) return null;
            return (
              <Card key={deptKey} className="overflow-hidden">
                <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark bg-brand-500/[0.06] dark:bg-brand-500/[0.06] flex justify-between items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? dept.name_ar : dept.name_en}</div>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark">{deptEmps.length} {lang === 'ar' ? 'موظف' : 'employees'}</div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={`px-4 py-2.5 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark text-start`}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                      {kpis.map(kpi => (
                        <th key={kpi.key} className="px-3 py-2.5 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                          <div>{lang === 'ar' ? kpi.ar : kpi.en}</div>
                          <div className="text-[10px] text-brand-500">{lang === 'ar' ? FREQ_CONFIG[kpi.freq]?.ar : FREQ_CONFIG[kpi.freq]?.en}</div>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptEmps.map((d, i) => (
                      <tr key={d.emp.id} className="border-t border-edge dark:border-edge-dark">
                        <td className="px-4 py-2.5">
                          <div className="text-[13px] font-semibold text-content dark:text-content-dark">{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</div>
                        </td>
                        {d.scores.map((kpi, j) => {
                          const kpiColor = kpi.pct >= 90 ? '#4A7AAB' : kpi.pct >= 60 ? '#6B8DB5' : '#EF4444';
                          return (
                            <td key={j} className="px-3 py-2.5 text-center">
                              <div className="text-[13px] font-bold" style={{ color: kpiColor }}>{kpi.actual.toLocaleString()}</div>
                              <div className="text-[10px] text-content-muted dark:text-content-muted-dark">/{kpi.target}</div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-[13px] font-extrabold" style={{ color: d.avgPct >= 90 ? '#4A7AAB' : d.avgPct >= 60 ? '#6B8DB5' : '#EF4444' }}>{d.avgPct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── 9-BOX TAB ── */}
      {activeTab === 'ninebox' && (
        <div>
          <div className="px-4 py-3 rounded-lg bg-brand-500/[0.08] border border-brand-500/20 mb-5 text-[13px] text-brand-500 dark:text-brand-300">
            {lang === 'ar' ? ' المحور الأفقي: الأداء (KPIs) · المحور الرأسي: الالتزام (الحضور)' : 'X-axis: Performance (KPIs) · Y-axis: Commitment (Attendance)'}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[2,1,0].map(potential => (
              [0,1,2].map(perf => {
                const boxEmps = filtered.filter(d => {
                  const pos = get9BoxPos(d.avgPct, d.compScore);
                  return pos.perf === perf && pos.potential === potential;
                });
                const label = BOX_LABELS[lang][2 - potential][perf];
                const color = BOX_COLORS[2 - potential][perf];
                return (
                  <Card key={`${potential}-${perf}`} className="p-3.5 min-h-[100px]" style={{ borderWidth: 2, borderColor: color + '30' }}>
                    <div className={`text-xs font-bold mb-2 text-start`} style={{ color }}>{label}</div>
                    {boxEmps.length === 0 ? (
                      <div className="text-[11px] text-content-muted dark:text-content-muted-dark text-center py-2.5">—</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {boxEmps.map(d => (
                          <div key={d.emp.id} title={lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}
                            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold text-white cursor-pointer"
                            style={{ background: `hsl(${d.emp.id.charCodeAt(1) * 40},60%,50%)` }}
                          >
                            {(lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en).charAt(0)}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'activity' && (
        <div className="flex flex-col gap-4">
          {/* Activity Legend */}
          <div className="grid grid-cols-3 gap-3.5">
            {[
              { label: lang === 'ar' ? 'إجمالي المكالمات' : 'Total Calls', value: Object.values(MOCK_CRM_ACTIVITY).reduce((s,d) => s + d.calls, 0), icon: '', color: '#4A7AAB' },
              { label: lang === 'ar' ? 'الفرص المفتوحة' : 'Open Opportunities', value: Object.values(MOCK_CRM_ACTIVITY).reduce((s,d) => s + d.opportunities, 0), icon: '', color: '#4A7AAB' },
              { label: lang === 'ar' ? 'الصفقات المغلقة' : 'Deals Closed', value: Object.values(MOCK_CRM_ACTIVITY).reduce((s,d) => s + d.deals_closed, 0), icon: '', color: '#4A7AAB' },
            ].map((s, i) => (
              <Card key={i} className="px-[18px] py-4">
                <div className="text-[22px] mb-1.5">{s.icon}</div>
                <div className="text-[26px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-content-muted dark:text-content-muted-dark">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Activity vs Results */}
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark text-sm font-bold text-content dark:text-content-dark text-start`}>
              {lang === 'ar' ? 'النشاط مقابل النتائج — Sales' : 'Activity vs Results — Sales'}
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-500/[0.06] dark:bg-brand-500/[0.06]">
                  {[lang === 'ar' ? 'الموظف' : 'Employee', lang === 'ar' ? 'مكالمات' : 'Calls', lang === 'ar' ? 'فرص' : 'Opps', lang === 'ar' ? 'صفقات' : 'Deals', lang === 'ar' ? 'الإيرادات' : 'Revenue', lang === 'ar' ? 'التحليل' : 'Analysis'].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark text-start`}>{h}</th>
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
                    <tr key={d.emp.id} className={i > 0 ? 'border-t border-edge dark:border-edge-dark' : ''}>
                      <td className="px-4 py-3 text-[13px] font-semibold text-content dark:text-content-dark">{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</td>
                      <td className="px-4 py-3 text-[13px] text-content dark:text-content-dark">{d.crm.calls}</td>
                      <td className="px-4 py-3 text-[13px] text-content dark:text-content-dark">{d.crm.opportunities}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-brand-500">{d.crm.deals_closed}</td>
                      <td className="px-4 py-3 text-[13px] text-brand-500">{d.crm.revenue > 0 ? (d.crm.revenue / 1000).toFixed(0) + 'K' : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge size="sm" className="rounded-[20px]" style={{ background: analysis.color + '20', color: analysis.color }}>
                          {lang === 'ar' ? analysis.ar : analysis.en}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Golden Rule */}
          <div className="px-5 py-3.5 rounded-[10px] bg-brand-500/[0.08] dark:bg-indigo-500/10 border border-brand-300 dark:border-indigo-500/20">
            <div className={`text-[13px] font-bold text-brand-800 dark:text-brand-300 mb-2 text-start`}>
              {lang === 'ar' ? ' القاعدة الذهبية' : 'Golden Rule'}
            </div>
            <div className={`flex gap-5 flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              {[
                { ar: 'نشاط عالي + نتيجة عالية = نجم → مكافأة', en: 'High Activity + High Results = Star → Reward', color: '#4A7AAB' },
                { ar: 'نشاط عالي + نتيجة ضعيفة = مشكلة مهارة → تدريب', en: 'High Activity + Low Results = Skill Gap → Training', color: '#6B8DB5' },
                { ar: 'نشاط منخفض + نتيجة ضعيفة = مشكلة التزام → متابعة', en: 'Low Activity + Low Results = Commitment Issue → Follow Up', color: '#EF4444' },
              ].map((r, i) => (
                <div key={i} className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-xs text-brand-800 dark:text-brand-300">{lang === 'ar' ? r.ar : r.en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── BSC TAB ── */}
      {activeTab === 'bsc' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            {BSC_PERSPECTIVES.map(p => {
              const avg = Math.round(p.objectives.reduce((s,o) => s + Math.min((o.actual / o.target) * 100, 100), 0) / p.objectives.length);
              return (
                <Card key={p.key} className={`px-[18px] py-4 text-start`} style={{ borderWidth: 2, borderColor: p.color + '30' }}>
                  <div className="text-2xl mb-1.5">{p.icon}</div>
                  <div className="text-[13px] font-bold text-content dark:text-content-dark mb-1">{lang === 'ar' ? p.ar : p.en}</div>
                  <div className="text-[28px] font-black" style={{ color: p.color }}>{avg}%</div>
                  <div className="h-1 rounded-sm bg-gray-200 dark:bg-white/[0.08] mt-2">
                    <div className="h-full rounded-sm" style={{ width: avg + '%', background: p.color }} />
                  </div>
                </Card>
              );
            })}
          </div>
          {BSC_PERSPECTIVES.map(p => (
            <Card key={p.key} className="overflow-hidden">
              <div className={`px-[18px] py-3 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} style={{ background: p.color + '10' }}>
                <span className="text-base">{p.icon}</span>
                <span className="text-sm font-bold" style={{ color: p.color }}>{lang === 'ar' ? p.ar : p.en}</span>
              </div>
              <div className="px-[18px] py-3.5 flex flex-col gap-3.5">
                {p.objectives.map((o, i) => {
                  const pct  = Math.min(Math.round((o.actual / o.target) * 100), 150);
                  const disp = Math.min(pct, 100);
                  const col  = pct >= 90 ? '#4A7AAB' : pct >= 60 ? '#6B8DB5' : '#EF4444';
                  const fmt  = v => typeof v === 'number' && v > 1000 ? (v / 1000).toFixed(0) + 'K' : v;
                  return (
                    <div key={i}>
                      <div className={`flex justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-[13px] text-content dark:text-content-dark font-medium">{lang === 'ar' ? o.ar : o.en}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold" style={{ color: col }}>{fmt(o.actual)}{o.unit}</span>
                          <span className="text-[11px] text-content-muted dark:text-content-muted-dark">/ {fmt(o.target)}{o.unit}</span>
                          {pct > 100 && <Badge size="sm" className="rounded-[10px] bg-brand-500/[0.12] text-brand-500 font-semibold">+{pct - 100}%</Badge>}
                        </div>
                      </div>
                      <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.08]">
                        <div className="h-full rounded" style={{ width: disp + '%', background: `linear-gradient(90deg,${col}99,${col})` }} />
                      </div>
                      <div className={`text-[11px] text-content-muted dark:text-content-muted-dark mt-[3px] text-start`}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          <div className={`px-[18px] py-3.5 rounded-[10px] bg-brand-500/[0.06] dark:bg-purple-500/[0.08] border border-brand-500/[0.15] dark:border-purple-500/20 text-xs text-brand-800 dark:text-brand-300 text-start`}>
             {lang === 'ar' ? 'البيانات ستكون حقيقية بعد ربط الـ modules — Finance + CRM + Sales' : 'Data will be live once Finance, CRM & Sales modules are connected.'}
          </div>
        </div>
      )}

    </div>
  );
}
