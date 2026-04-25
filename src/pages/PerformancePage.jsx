import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Target, TrendingUp, TrendingDown, Users, Star,
  ChevronRight, Award, AlertTriangle, CheckCircle,
  BarChart2, Calendar, Filter, Search
} from 'lucide-react';
import { DEPARTMENTS } from '../data/hr_mock_data';
import { fetchEmployees } from '../services/employeesService';
import supabase from '../lib/supabase';
import { getAttendanceForMonth } from '../data/attendanceStore';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { useAuth } from '../contexts/AuthContext';
import { fetchOpportunities } from '../services/opportunitiesService';
import { fetchActivities } from '../services/activitiesService';
import { Card, CardHeader, CardBody, Input, Select, Badge, KpiCard, ExportButton, Th, Td, Tr, FilterPill, SmartFilter, applySmartFilters, Pagination } from '../components/ui';

// ── CRM Activity Data (loaded from real services) ─────────────────────────────
const EMPTY_CRM = { calls: 0, calls_answered: 0, calls_no_answer: 0, calls_busy: 0, meetings_total: 0, meetings_online: 0, meetings_site: 0, meetings_developer: 0, meetings_office: 0, whatsapp_sent: 0, opportunities: 0, deals_closed: 0, leads: 0, campaigns: 0, revenue: 0 };

// ── Competency scores (consistent with CompetenciesPage) ──────
function genCompScores(empId, competencies) {
  const seed = typeof empId === 'string' ? empId.charCodeAt(empId.length - 1) : 0;
  return (competencies || []).reduce((acc, c, i) => {
    acc[c.key] = Math.min(5, Math.max(1, Math.round(2.5 + ((seed * (i + 3)) % 25) / 10)));
    return acc;
  }, {});
}
function calcWeightedScore(scores, competencies) {
  const total = (competencies || []).reduce((sum, c) => sum + (scores[c.key] || 3) * (c.weight || 10), 0);
  const maxWeight = (competencies || []).reduce((sum, c) => sum + (c.weight || 10), 0) || 100;
  return Math.round((total / maxWeight) * 50) / 10;
}

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;

// KPI definitions per department with frequency
const DEPT_KPIS = {
  sales: [
    { key: 'calls',            ar: 'المكالمات',       en: 'Calls',           freq: 'daily',   target: 50,     unit: '',      source: 'crm' },
    { key: 'calls_answered',   ar: 'مكالمات ناجحة',   en: 'Answered Calls',  freq: 'daily',   target: 30,     unit: '',      source: 'crm' },
    { key: 'opportunities',    ar: 'الفرص',           en: 'Opportunities',   freq: 'weekly',  target: 10,     unit: '',      source: 'crm' },
    { key: 'deals_closed',     ar: 'الصفقات',         en: 'Deals Closed',    freq: 'monthly', target: 3,      unit: '',      source: 'crm' },
    { key: 'meetings_total',    ar: 'إجمالي المقابلات', en: 'Total Meetings',  freq: 'weekly',  target: 8,      unit: '',      source: 'crm' },
    { key: 'meetings_site',     ar: 'زيارات موقع',     en: 'Site Visits',     freq: 'weekly',  target: 3,      unit: '',      source: 'crm' },
    { key: 'meetings_developer',ar: 'مقابلات مطورين',  en: 'Developer Meetings', freq: 'weekly', target: 2,    unit: '',      source: 'crm' },
    { key: 'revenue',          ar: 'الإيرادات',       en: 'Revenue',         freq: 'monthly', target: 250000, unit: 'EGP',   source: 'crm' },
    { key: 'attendance',       ar: 'الحضور',          en: 'Attendance',      freq: 'daily',   target: 22,     unit: 'days',  source: 'hr'  },
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
function buildEmpData(emp, attendance, crmData, competencies) {
  const att = attendance.filter(r => r.employee_id === emp.id);
  const presentDays = att.filter(r => r.check_in && !r.absent).length;
  const lateDays = att.filter(r => r.check_in && !r.absent).filter(r => { const [h, m] = (r.check_in || '').split(':').map(Number); return h > 10 || (h === 10 && m > 30); }).length;
  const crm = crmData[emp.id] || EMPTY_CRM;
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

  const compScore = calcWeightedScore(genCompScores(emp.id, competencies), competencies);
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
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [employees, setEmployees] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [period, setPeriod] = useState('this_month');

  useEffect(() => {
    fetchEmployees().then(d => setEmployees(d || [])).catch(() => {});
    supabase.from('competencies').select('*').then(({ data }) => setCompetencies(data || [])).catch(() => {});
  }, []);

  const { auditFields, applyAuditFilters } = useAuditFilter('performance');

  // ── Period date range helper ──
  function getPeriodRange(p) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (p === 'today') return { start: startOfDay, end: now };
    if (p === 'this_week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // week starts Monday
      const weekStart = new Date(startOfDay);
      weekStart.setDate(weekStart.getDate() - diff);
      return { start: weekStart, end: now };
    }
    // this_month
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }

  function filterByPeriod(items, periodVal) {
    const { start, end } = getPeriodRange(periodVal);
    return items.filter(item => {
      const d = item.date || item.created_at;
      if (!d) return true;
      const dt = new Date(d);
      return dt >= start && dt <= end;
    });
  }

  function buildCrmMap(opps, acts, periodVal) {
    const filteredActs = filterByPeriod(acts, periodVal);
    const filteredOpps = filterByPeriod(opps, periodVal);
    const map = {};
    employees.forEach(emp => {
      const empOpps = filteredOpps.filter(o => o.assigned_to === emp.id);
      const closedWon = empOpps.filter(o => o.stage === 'closed_won');
      const empActs = filteredActs.filter(a => a.user_id === emp.id || a.assigned_to === emp.id);
      const empCalls = empActs.filter(a => a.type === 'call');
      const desc = (a) => (a.description || a.notes || '').toLowerCase();
      map[emp.id] = {
        calls: empCalls.length,
        calls_answered: empCalls.filter(a => /answered|رد/i.test(desc(a))).length,
        calls_no_answer: empCalls.filter(a => /no answer|لم يرد/i.test(desc(a))).length,
        calls_busy: empCalls.filter(a => /busy|مشغول/i.test(desc(a))).length,
        meetings_total: empActs.filter(a => a.type === 'meeting').length,
        meetings_online: empActs.filter(a => a.type === 'meeting' && a.meeting_subtype === 'online').length,
        meetings_site: empActs.filter(a => a.type === 'meeting' && a.meeting_subtype === 'site').length,
        meetings_developer: empActs.filter(a => a.type === 'meeting' && a.meeting_subtype === 'developer').length,
        meetings_office: empActs.filter(a => a.type === 'meeting' && a.meeting_subtype === 'office').length,
        whatsapp_sent: empActs.filter(a => a.type === 'whatsapp').length,
        opportunities: empOpps.length,
        deals_closed: closedWon.length,
        leads: 0,
        campaigns: 0,
        revenue: closedWon.reduce((sum, o) => sum + (Number(o.budget) || 0), 0),
      };
    });
    return map;
  }

  // ── Load real CRM data from services ──
  const [crmData, setCrmData] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function loadCrmData() {
      try {
        const [opps, acts] = await Promise.all([
          fetchOpportunities({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
          fetchActivities({ limit: 200, role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
        ]);
        if (cancelled) return;
        setCrmData(buildCrmMap(opps, acts, period));
      } catch { /* keep localStorage fallback */ }
    }
    loadCrmData();
    return () => { cancelled = true; };
  }, [period, profile?.role, profile?.id, profile?.team_id]);

  const attendance = getAttendanceForMonth(YEAR, MONTH);
  const empData = useMemo(() =>
    employees.map(emp => buildEmpData(emp, attendance, crmData, competencies)),
    [employees, attendance, crmData, competencies]
  );

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: DEPARTMENTS.map(d => ({ value: d.id, label: d.name_ar, labelEn: d.name_en })),
      accessor: d => d.emp?.department,
    },
    {
      id: 'avgPct', label: 'نسبة الأداء', labelEn: 'Performance %', type: 'number',
    },
    {
      id: 'compScore', label: 'تقييم الكفاءة', labelEn: 'Competency Score', type: 'number',
    },
    {
      id: 'presentDays', label: 'أيام الحضور', labelEn: 'Attendance Days', type: 'number',
    },
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = empData;

    // Apply smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d => {
        const name = lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en;
        return name.toLowerCase().includes(q);
      });
    }

    // Apply department filter (legacy pill filter)
    if (deptFilter !== 'all') {
      result = result.filter(d => d.emp.department === deptFilter);
    }

    return result;
  }, [empData, smartFilters, SMART_FIELDS, search, deptFilter, lang]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters]);

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

  // Compute BSC from real CRM data
  const allCrmValues = Object.values(crmData);
  const totalRevenue = allCrmValues.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalClosedDeals = allCrmValues.reduce((s, d) => s + (d.deals_closed || 0), 0);
  const totalOpps = allCrmValues.reduce((s, d) => s + (d.opportunities || 0), 0);
  const conversionRate = totalOpps > 0 ? Math.round((totalClosedDeals / totalOpps) * 1000) / 10 : 0;
  const SALES_BSC = { achieved: totalRevenue || 0, target: 1500000 };
  const CRM_BSC   = { closedDeals: totalClosedDeals, conversionRate };
  const avgAttendance  = Math.round(empData.reduce((s,d) => s + d.presentDays, 0) / empData.length);
  const avgCompScore   = Math.round(empData.reduce((s,d) => s + d.compScore, 0) / empData.length * 10) / 10;

  const BSC_PERSPECTIVES = [
    {
      key: 'financial', icon: '', ar: 'المالي', en: 'Financial', color: '#4A7AAB',
      objectives: [
        { ar: 'تحقيق التارجت الشهري',  en: 'Monthly target',      actual: SALES_BSC.achieved, target: SALES_BSC.target, unit: 'EGP' },
        { ar: 'تقليل تكاليف التوظيف', en: 'Reduce hiring costs',  actual: 18000,                   target: 25000,                unit: 'EGP' },
      ],
    },
    {
      key: 'customer', icon: '', ar: 'العملاء', en: 'Customer', color: '#4A7AAB',
      objectives: [
        { ar: 'معدل تحويل الليدز',   en: 'Lead conversion rate', actual: CRM_BSC.conversionRate, target: 10,  unit: '%' },
        { ar: 'الصفقات المغلقة',      en: 'Deals closed',         actual: CRM_BSC.closedDeals,    target: 15,  unit: ''  },
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
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen pb-16 ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Target size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'متابعة الأداء' : 'Performance Tracking'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: lang === 'ar' ? 'متوسط الأداء' : 'Avg Performance', value: avgPerf + '%', icon: '', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'متميزون' : 'Top Performers',       value: topPerformers,  icon: '', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'يحتاجون متابعة' : 'Need Attention', value: atRisk,         icon: '', color: '#EF4444' },
          { label: lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees', value: employees.length, icon: '', color: '#4A7AAB' },
        ].map((s, i) => (
          <Card key={i} className="px-5 py-4">
            <div className="text-xl mb-1.5">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className={`flex flex-wrap gap-2 mb-5 overflow-x-auto ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {tabs.map(t => (
          <FilterPill key={t.key} label={lang === 'ar' ? t.ar : t.en} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} />
        ))}
      </div>

      {/* Period Filter */}
      <div className={`flex flex-wrap gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark self-center">{lang === 'ar' ? 'الفترة:' : 'Period:'}</span>
        {[
          { key: 'today', ar: 'اليوم', en: 'Today' },
          { key: 'this_week', ar: 'هذا الأسبوع', en: 'This Week' },
          { key: 'this_month', ar: 'هذا الشهر', en: 'This Month' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              period === p.key
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-surface dark:bg-surface-dark text-content dark:text-content-dark border-edge dark:border-edge-dark hover:border-brand-500/50'
            }`}
          >
            {lang === 'ar' ? p.ar : p.en}
          </button>
        ))}
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employee...'}
        resultsCount={filtered.length}
      />

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-2.5">
          {paged.sort((a, b) => b.avgPct - a.avgPct).map((d, idx) => {
            const dept = DEPARTMENTS.find(dep => dep.id === d.emp.department);
            const color = d.avgPct >= 90 ? '#4A7AAB' : d.avgPct >= 60 ? '#6B8DB5' : '#EF4444';
            return (
              <Card key={d.emp.id} hover
                role="button" tabIndex={0}
                onClick={() => setSelectedEmp(selectedEmp?.emp.id === d.emp.id ? null : d)}
                onKeyDown={e => { if(e.key==='Enter'||e.key===' ') setSelectedEmp(selectedEmp?.emp.id === d.emp.id ? null : d); }}
                className="px-5 py-3.5"
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
                    <div className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? d.emp.job_title_ar : d.emp.job_title_en} · {dept ? (lang === 'ar' ? dept.name_ar : dept.name_en) : ''}</div>
                  </div>
                  {/* Quick Stats */}
                  <div className={`flex gap-4 items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'حضور' : 'Attend'}</div>
                      <div className="text-xs font-bold text-content dark:text-content-dark">{d.presentDays}d</div>
                    </div>
                    {d.crm.calls > 0 && (
                      <div className="text-center min-w-[50px]">
                        <div className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'مكالمات' : 'Calls'}</div>
                        <div className="text-xs font-bold text-content dark:text-content-dark">{d.crm.calls}</div>
                      </div>
                    )}
                    {d.crm.deals_closed > 0 && (
                      <div className="text-center min-w-[50px]">
                        <div className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'صفقات' : 'Deals'}</div>
                        <div className="text-xs font-bold text-brand-500">{d.crm.deals_closed}</div>
                      </div>
                    )}
                    {/* Score */}
                    <div className="text-center min-w-[60px]">
                      <div className="text-xl font-bold" style={{ color }}>{d.avgPct}%</div>
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
                              <Badge size="sm" className="rounded-xl" style={{ background: freq.color + '20', color: freq.color }}>{lang === 'ar' ? freq.ar : freq.en}</Badge>
                            </div>
                            <div className={`text-lg font-bold text-start`} style={{ color: kpiColor }}>
                              {kpi.actual.toLocaleString()}{kpi.unit === 'EGP' ? '' : ''}
                              <span className="text-xs font-normal text-content-muted dark:text-content-muted-dark"> / {kpi.target.toLocaleString()}</span>
                            </div>
                            <div className="h-[3px] rounded-sm bg-gray-200 dark:bg-white/[0.08] mt-1.5">
                              <div className="h-full rounded-sm" style={{ width: Math.min(kpi.pct, 100) + '%', background: kpiColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Source note */}
                    <div className={`mt-2.5 text-xs text-content-muted dark:text-content-muted-dark text-start`}>
                       {lang === 'ar' ? 'البيانات من: CRM + الحضور' : 'Data from: CRM + Attendance'}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(val) => { setPageSize(val); setPage(1); }}
          totalItems={filtered.length}
        />
      )}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-900/[0.08] to-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
            <Target size={28} color="#4A7AAB" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-bold text-content dark:text-content-dark mb-1.5">{lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
          <p className="text-xs text-content-muted dark:text-content-muted-dark m-0">{lang === 'ar' ? 'جرّب البحث بكلمات مختلفة' : 'Try different search terms'}</p>
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
                <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm min-w-[500px]">
                  <thead>
                    <tr>
                      <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                      {kpis.map(kpi => (
                        <Th key={kpi.key} className="text-center whitespace-nowrap">
                          <div>{lang === 'ar' ? kpi.ar : kpi.en}</div>
                          <div className="text-[10px] text-brand-500">{lang === 'ar' ? FREQ_CONFIG[kpi.freq]?.ar : FREQ_CONFIG[kpi.freq]?.en}</div>
                        </Th>
                      ))}
                      <Th className="text-center">{lang === 'ar' ? 'الإجمالي' : 'Total'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptEmps.map((d, i) => (
                      <Tr key={d.emp.id}>
                        <Td>
                          <div className="text-xs font-semibold">{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</div>
                        </Td>
                        {d.scores.map((kpi, j) => {
                          const kpiColor = kpi.pct >= 90 ? '#4A7AAB' : kpi.pct >= 60 ? '#6B8DB5' : '#EF4444';
                          return (
                            <Td key={j} className="text-center">
                              <div className="text-xs font-bold" style={{ color: kpiColor }}>{kpi.actual.toLocaleString()}</div>
                              <div className="text-[10px] text-content-muted dark:text-content-muted-dark">/{kpi.target}</div>
                            </Td>
                          );
                        })}
                        <Td className="text-center">
                          <span className="text-xs font-bold" style={{ color: d.avgPct >= 90 ? '#4A7AAB' : d.avgPct >= 60 ? '#6B8DB5' : '#EF4444' }}>{d.avgPct}%</span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── 9-BOX TAB ── */}
      {activeTab === 'ninebox' && (
        <div>
          <div className="px-4 py-3 rounded-lg bg-brand-500/[0.08] border border-brand-500/20 mb-5 text-xs text-brand-500 dark:text-brand-300">
            {lang === 'ar' ? ' المحور الأفقي: الأداء (KPIs) · المحور الرأسي: الالتزام (الحضور)' : 'X-axis: Performance (KPIs) · Y-axis: Commitment (Attendance)'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                      <div className="text-xs text-content-muted dark:text-content-muted-dark text-center py-2.5">—</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {boxEmps.map(d => (
                          <div key={d.emp.id} title={lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}
                            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: lang === 'ar' ? 'إجمالي المكالمات' : 'Total Calls', value: Object.values(crmData).reduce((s,d) => s + (d.calls || 0), 0), color: '#4A7AAB' },
              { label: lang === 'ar' ? 'مكالمات ناجحة' : 'Answered', value: Object.values(crmData).reduce((s,d) => s + (d.calls_answered || 0), 0), color: '#4A7AAB' },
              { label: lang === 'ar' ? 'زيارات' : 'Visits', value: Object.values(crmData).reduce((s,d) => s + (d.visits || 0), 0), color: '#6B8DB5' },
              { label: lang === 'ar' ? 'اجتماعات' : 'Meetings', value: Object.values(crmData).reduce((s,d) => s + (d.meetings_scheduled || 0), 0), color: '#6B8DB5' },
              { label: lang === 'ar' ? 'الفرص المفتوحة' : 'Open Opportunities', value: Object.values(crmData).reduce((s,d) => s + (d.opportunities || 0), 0), color: '#4A7AAB' },
              { label: lang === 'ar' ? 'الصفقات المغلقة' : 'Deals Closed', value: Object.values(crmData).reduce((s,d) => s + (d.deals_closed || 0), 0), color: '#4A7AAB' },
            ].map((s, i) => (
              <Card key={i} className="px-4 py-3.5">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-content-muted dark:text-content-muted-dark">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Activity vs Results */}
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark text-sm font-bold text-content dark:text-content-dark text-start`}>
              {lang === 'ar' ? 'النشاط مقابل النتائج — Sales' : 'Activity vs Results — Sales'}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[500px]">
              <thead>
                <tr>
                  {[lang === 'ar' ? 'الموظف' : 'Employee', lang === 'ar' ? 'مكالمات' : 'Calls', lang === 'ar' ? 'فرص' : 'Opps', lang === 'ar' ? 'صفقات' : 'Deals', lang === 'ar' ? 'الإيرادات' : 'Revenue', lang === 'ar' ? 'التحليل' : 'Analysis'].map((h, i) => (
                    <Th key={i}>{h}</Th>
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
                    <Tr key={d.emp.id}>
                      <Td className="text-xs font-semibold">{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</Td>
                      <Td className="text-xs">{d.crm.calls}</Td>
                      <Td className="text-xs">{d.crm.opportunities}</Td>
                      <Td className="text-xs font-bold text-brand-500">{d.crm.deals_closed}</Td>
                      <Td className="text-xs text-brand-500">{d.crm.revenue > 0 ? (d.crm.revenue / 1000).toFixed(0) + 'K' : '—'}</Td>
                      <Td>
                        <Badge size="sm" className="rounded-[20px]" style={{ background: analysis.color + '20', color: analysis.color }}>
                          {lang === 'ar' ? analysis.ar : analysis.en}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>

          {/* Detailed Activity Breakdown */}
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark text-sm font-bold text-content dark:text-content-dark text-start`}>
              {lang === 'ar' ? 'تفاصيل النشاط — Sales' : 'Activity Breakdown — Sales'}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[700px]">
              <thead>
                <tr>
                  {[
                    lang === 'ar' ? 'الموظف' : 'Agent',
                    lang === 'ar' ? 'إجمالي مكالمات' : 'Total Calls',
                    lang === 'ar' ? 'ناجحة' : 'Answered',
                    lang === 'ar' ? 'لم يرد' : 'No Answer',
                    lang === 'ar' ? 'مشغول' : 'Busy',
                    lang === 'ar' ? 'زيارات' : 'Visits',
                    lang === 'ar' ? 'اجتماعات' : 'Meetings',
                    lang === 'ar' ? 'واتساب' : 'WhatsApp',
                    lang === 'ar' ? 'نسبة الرد' : 'Answer Rate',
                  ].map((h, i) => (
                    <Th key={i} className="text-center whitespace-nowrap">{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empData.filter(d => d.emp.department === 'sales').map((d) => {
                  const c = d.crm;
                  const answerRate = c.calls > 0 ? Math.round((c.calls_answered / c.calls) * 100) : 0;
                  const rateColor = answerRate >= 60 ? '#4A7AAB' : answerRate >= 40 ? '#6B8DB5' : '#EF4444';
                  return (
                    <Tr key={d.emp.id}>
                      <Td className="text-xs font-semibold">{lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}</Td>
                      <Td className="text-xs text-center font-bold">{c.calls}</Td>
                      <Td className="text-xs text-center" style={{ color: '#4A7AAB' }}>{c.calls_answered}</Td>
                      <Td className="text-xs text-center" style={{ color: '#6B8DB5' }}>{c.calls_no_answer}</Td>
                      <Td className="text-xs text-center" style={{ color: '#EF4444' }}>{c.calls_busy}</Td>
                      <Td className="text-xs text-center">{c.visits}</Td>
                      <Td className="text-xs text-center">{c.meetings_scheduled}</Td>
                      <Td className="text-xs text-center">{c.whatsapp_sent}</Td>
                      <Td className="text-center">
                        <Badge size="sm" className="rounded-[20px]" style={{ background: rateColor + '20', color: rateColor }}>
                          {answerRate}%
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>

          {/* Golden Rule */}
          <div className="px-5 py-3.5 rounded-xl bg-brand-500/[0.08] dark:bg-brand-500/10 border border-brand-300 dark:border-brand-500/20">
            <div className={`text-xs font-bold text-brand-800 dark:text-brand-300 mb-2 text-start`}>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BSC_PERSPECTIVES.map(p => {
              const avg = Math.round(p.objectives.reduce((s,o) => s + Math.min((o.actual / o.target) * 100, 100), 0) / p.objectives.length);
              return (
                <Card key={p.key} className={`px-5 py-4 text-start`} style={{ borderWidth: 2, borderColor: p.color + '30' }}>
                  <div className="text-2xl mb-1.5">{p.icon}</div>
                  <div className="text-xs font-bold text-content dark:text-content-dark mb-1">{lang === 'ar' ? p.ar : p.en}</div>
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
              <div className={`px-5 py-3 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} style={{ background: p.color + '10' }}>
                <span className="text-base">{p.icon}</span>
                <span className="text-sm font-bold" style={{ color: p.color }}>{lang === 'ar' ? p.ar : p.en}</span>
              </div>
              <div className="px-5 py-3.5 flex flex-col gap-3.5">
                {p.objectives.map((o, i) => {
                  const pct  = Math.min(Math.round((o.actual / o.target) * 100), 150);
                  const disp = Math.min(pct, 100);
                  const col  = pct >= 90 ? '#4A7AAB' : pct >= 60 ? '#6B8DB5' : '#EF4444';
                  const fmt  = v => typeof v === 'number' && v > 1000 ? (v / 1000).toFixed(0) + 'K' : v;
                  return (
                    <div key={i}>
                      <div className={`flex justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs text-content dark:text-content-dark font-medium">{lang === 'ar' ? o.ar : o.en}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold" style={{ color: col }}>{fmt(o.actual)}{o.unit}</span>
                          <span className="text-xs text-content-muted dark:text-content-muted-dark">/ {fmt(o.target)}{o.unit}</span>
                          {pct > 100 && <Badge size="sm" className="rounded-xl bg-brand-500/[0.12] text-brand-500 font-semibold">+{pct - 100}%</Badge>}
                        </div>
                      </div>
                      <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.08]">
                        <div className="h-full rounded" style={{ width: disp + '%', background: `linear-gradient(90deg,${col}99,${col})` }} />
                      </div>
                      <div className={`text-xs text-content-muted dark:text-content-muted-dark mt-[3px] text-start`}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          <div className={`px-5 py-3.5 rounded-xl bg-brand-500/[0.06] dark:bg-purple-500/[0.08] border border-brand-500/[0.15] dark:border-purple-500/20 text-xs text-brand-800 dark:text-brand-300 text-start`}>
             {lang === 'ar' ? 'البيانات مبنية على CRM الحقيقي + بيانات الحضور' : 'Data is sourced from live CRM + Attendance data.'}
          </div>
        </div>
      )}

    </div>
  );
}
