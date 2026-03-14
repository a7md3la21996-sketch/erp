import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import {
  UserPlus, CheckCircle2, Clock, AlertCircle,
  ChevronRight, UserCheck, Timer, CheckSquare, Square,
} from 'lucide-react';
import { KpiCard, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';

/* ─── Checklist Template ─── */
const CHECKLIST_ITEMS = [
  { id: 'documents',       label_ar: 'تسليم المستندات',      label_en: 'Document Submission',      icon: '📄' },
  { id: 'it_setup',        label_ar: 'إعداد تكنولوجيا المعلومات', label_en: 'IT Setup',            icon: '💻' },
  { id: 'workspace',       label_ar: 'تخصيص مساحة العمل',    label_en: 'Workspace Assigned',       icon: '🏢' },
  { id: 'orientation',     label_ar: 'جلسة التوجيه',          label_en: 'Orientation Done',         icon: '🧭' },
  { id: 'team_intro',      label_ar: 'تعريف بالفريق',         label_en: 'Team Introduction',        icon: '🤝' },
  { id: 'policy_ack',      label_ar: 'الإقرار بالسياسات',      label_en: 'Policy Acknowledgment',    icon: '📋' },
  { id: 'training',        label_ar: 'بدء التدريب',           label_en: 'Training Started',         icon: '🎓' },
  { id: 'first_review',    label_ar: 'جدولة المراجعة الأولى',  label_en: 'First Review Scheduled',   icon: '📅' },
];

/* ─── Comprehensive Mock Data ─── */
const MOCK_ONBOARDING = [
  {
    id: 'OB-001',
    employee_name_ar: 'أحمد محمد علي',
    employee_name_en: 'Ahmed Mohamed Ali',
    department: 'engineering',
    position: 'مهندس برمجيات أول',
    position_en: 'Senior Software Engineer',
    start_date: '2026-03-01',
    mentor_name: 'خالد يوسف',
    mentor_name_en: 'Khaled Youssef',
    status: 'in_progress',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: true, policy_ack: true, training: false, first_review: false },
  },
  {
    id: 'OB-002',
    employee_name_ar: 'سارة أحمد حسن',
    employee_name_en: 'Sara Ahmed Hassan',
    department: 'marketing',
    position: 'مدير تسويق رقمي',
    position_en: 'Digital Marketing Manager',
    start_date: '2026-03-08',
    mentor_name: 'نورا عبدالله',
    mentor_name_en: 'Noura Abdullah',
    status: 'in_progress',
    checklist: { documents: true, it_setup: true, workspace: false, orientation: false, team_intro: false, policy_ack: false, training: false, first_review: false },
  },
  {
    id: 'OB-003',
    employee_name_ar: 'محمد عبدالرحمن',
    employee_name_en: 'Mohamed Abdelrahman',
    department: 'finance',
    position: 'محاسب مالي',
    position_en: 'Financial Accountant',
    start_date: '2026-02-15',
    mentor_name: 'عمرو سعيد',
    mentor_name_en: 'Amr Saeed',
    status: 'completed',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: true, policy_ack: true, training: true, first_review: true },
  },
  {
    id: 'OB-004',
    employee_name_ar: 'فاطمة الزهراء',
    employee_name_en: 'Fatma Al-Zahraa',
    department: 'hr',
    position: 'أخصائي موارد بشرية',
    position_en: 'HR Specialist',
    start_date: '2026-03-10',
    mentor_name: 'هدى محمود',
    mentor_name_en: 'Huda Mahmoud',
    status: 'not_started',
    checklist: { documents: false, it_setup: false, workspace: false, orientation: false, team_intro: false, policy_ack: false, training: false, first_review: false },
  },
  {
    id: 'OB-005',
    employee_name_ar: 'عمر خالد سليمان',
    employee_name_en: 'Omar Khaled Soliman',
    department: 'engineering',
    position: 'مهندس DevOps',
    position_en: 'DevOps Engineer',
    start_date: '2026-02-20',
    mentor_name: 'خالد يوسف',
    mentor_name_en: 'Khaled Youssef',
    status: 'completed',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: true, policy_ack: true, training: true, first_review: true },
  },
  {
    id: 'OB-006',
    employee_name_ar: 'ياسمين طارق',
    employee_name_en: 'Yasmin Tarek',
    department: 'sales',
    position: 'مسؤول مبيعات',
    position_en: 'Sales Executive',
    start_date: '2026-03-05',
    mentor_name: 'سامي رضا',
    mentor_name_en: 'Sami Reda',
    status: 'in_progress',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: false, policy_ack: true, training: false, first_review: false },
  },
  {
    id: 'OB-007',
    employee_name_ar: 'كريم مصطفى',
    employee_name_en: 'Karim Mostafa',
    department: 'operations',
    position: 'منسق عمليات',
    position_en: 'Operations Coordinator',
    start_date: '2026-03-12',
    mentor_name: 'محسن فؤاد',
    mentor_name_en: 'Mohsen Fouad',
    status: 'not_started',
    checklist: { documents: false, it_setup: false, workspace: false, orientation: false, team_intro: false, policy_ack: false, training: false, first_review: false },
  },
  {
    id: 'OB-008',
    employee_name_ar: 'نادية حسين',
    employee_name_en: 'Nadia Hussein',
    department: 'engineering',
    position: 'مصممة UI/UX',
    position_en: 'UI/UX Designer',
    start_date: '2026-02-25',
    mentor_name: 'منى إبراهيم',
    mentor_name_en: 'Mona Ibrahim',
    status: 'in_progress',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: true, policy_ack: true, training: true, first_review: false },
  },
  {
    id: 'OB-009',
    employee_name_ar: 'تامر عادل',
    employee_name_en: 'Tamer Adel',
    department: 'finance',
    position: 'محلل مالي',
    position_en: 'Financial Analyst',
    start_date: '2026-03-03',
    mentor_name: 'عمرو سعيد',
    mentor_name_en: 'Amr Saeed',
    status: 'in_progress',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: false, team_intro: false, policy_ack: true, training: false, first_review: false },
  },
  {
    id: 'OB-010',
    employee_name_ar: 'ريم السيد',
    employee_name_en: 'Reem Al-Sayed',
    department: 'marketing',
    position: 'كاتبة محتوى',
    position_en: 'Content Writer',
    start_date: '2026-02-10',
    mentor_name: 'نورا عبدالله',
    mentor_name_en: 'Noura Abdullah',
    status: 'completed',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: true, policy_ack: true, training: true, first_review: true },
  },
  {
    id: 'OB-011',
    employee_name_ar: 'حسام الدين',
    employee_name_en: 'Hossam El-Din',
    department: 'sales',
    position: 'مدير حسابات',
    position_en: 'Account Manager',
    start_date: '2026-03-07',
    mentor_name: 'سامي رضا',
    mentor_name_en: 'Sami Reda',
    status: 'in_progress',
    checklist: { documents: true, it_setup: false, workspace: false, orientation: false, team_intro: false, policy_ack: false, training: false, first_review: false },
  },
  {
    id: 'OB-012',
    employee_name_ar: 'لينا جمال',
    employee_name_en: 'Lina Gamal',
    department: 'hr',
    position: 'مسؤول توظيف',
    position_en: 'Recruitment Officer',
    start_date: '2026-02-18',
    mentor_name: 'هدى محمود',
    mentor_name_en: 'Huda Mahmoud',
    status: 'completed',
    checklist: { documents: true, it_setup: true, workspace: true, orientation: true, team_intro: true, policy_ack: true, training: true, first_review: true },
  },
];

/* ─── Department labels ─── */
const DEPARTMENTS = {
  engineering: { ar: 'الهندسة', en: 'Engineering' },
  marketing:   { ar: 'التسويق', en: 'Marketing' },
  finance:     { ar: 'المالية', en: 'Finance' },
  hr:          { ar: 'الموارد البشرية', en: 'Human Resources' },
  sales:       { ar: 'المبيعات', en: 'Sales' },
  operations:  { ar: 'العمليات', en: 'Operations' },
};

const STATUS_CONFIG = {
  in_progress: { ar: 'قيد التنفيذ', en: 'In Progress', color: '#6B8DB5' },
  completed:   { ar: 'مكتمل',      en: 'Completed',   color: '#4A7AAB' },
  not_started: { ar: 'لم يبدأ',     en: 'Not Started', color: '#EF4444' },
};

/* ─── localStorage key for checklist state ─── */
const LS_KEY = 'onboarding_checklist_state';

function loadChecklistState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveChecklistState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/* ─── Helper: compute progress ─── */
function getProgress(checklist) {
  const vals = Object.values(checklist);
  const done = vals.filter(Boolean).length;
  return { done, total: vals.length, pct: Math.round((done / vals.length) * 100) };
}

/* ─── Helper: derive status from checklist ─── */
function deriveStatus(checklist) {
  const vals = Object.values(checklist);
  if (vals.every(Boolean)) return 'completed';
  if (vals.some(Boolean)) return 'in_progress';
  return 'not_started';
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function OnboardingPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [expanded, setExpanded] = useState(null);
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { auditFields, applyAuditFilters } = useAuditFilter('onboarding');

  /* ─── Checklist state (localStorage persistence) ─── */
  const [checklistState, setChecklistState] = useState(() => {
    const saved = loadChecklistState();
    if (saved) return saved;
    // Initialize from mock data
    const init = {};
    MOCK_ONBOARDING.forEach(ob => { init[ob.id] = { ...ob.checklist }; });
    return init;
  });

  // Persist to localStorage on change
  useEffect(() => {
    saveChecklistState(checklistState);
  }, [checklistState]);

  const toggleChecklistItem = (obId, itemId) => {
    setChecklistState(prev => ({
      ...prev,
      [obId]: {
        ...prev[obId],
        [itemId]: !prev[obId]?.[itemId],
      },
    }));
  };

  /* ─── Enrich data with live checklist state ─── */
  const enrichedData = useMemo(() => {
    return MOCK_ONBOARDING.map(ob => {
      const checklist = checklistState[ob.id] || ob.checklist;
      const { done, total, pct } = getProgress(checklist);
      const status = deriveStatus(checklist);
      return { ...ob, checklist, progress: pct, done, total, status };
    });
  }, [checklistState]);

  /* ─── Smart Filter fields ─── */
  const SMART_FIELDS = useMemo(() => [
    {
      id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: Object.entries(DEPARTMENTS).map(([val, lbl]) => ({
        value: val, label: lbl.ar, labelEn: lbl.en,
      })),
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: Object.entries(STATUS_CONFIG).map(([val, cfg]) => ({
        value: val, label: cfg.ar, labelEn: cfg.en,
      })),
    },
    { id: 'start_date', label: 'تاريخ البدء', labelEn: 'Start Date', type: 'date' },
    {
      id: 'mentor_name', label: 'المرشد', labelEn: 'Mentor', type: 'select',
      options: [...new Set(MOCK_ONBOARDING.map(ob => ob.mentor_name))].map(m => {
        const ob = MOCK_ONBOARDING.find(o => o.mentor_name === m);
        return { value: m, label: m, labelEn: ob?.mentor_name_en || m };
      }),
    },
    ...auditFields,
  ], [auditFields]);

  /* ─── Filtering ─── */
  const filtered = useMemo(() => {
    let result = enrichedData;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [enrichedData, smartFilters, SMART_FIELDS, applyAuditFilters]);

  /* ─── KPI stats ─── */
  const totalCount = filtered.length;
  const completedCount = filtered.filter(o => o.status === 'completed').length;
  const inProgressCount = filtered.filter(o => o.status === 'in_progress').length;

  // Avg completion time (days from start_date to today for completed)
  const avgCompletionDays = useMemo(() => {
    const completedItems = filtered.filter(o => o.status === 'completed');
    if (completedItems.length === 0) return 0;
    const today = new Date();
    const totalDays = completedItems.reduce((sum, o) => {
      const start = new Date(o.start_date);
      const days = Math.ceil((today - start) / 86400000);
      return sum + days;
    }, 0);
    return Math.round(totalDays / completedItems.length);
  }, [filtered]);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [smartFilters]);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* ─── Header ─── */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <UserPlus size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'استقبال الموظفين' : 'Employee Onboarding'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'تتبع مسار استقبال الموظفين الجدد' : 'Track new employee onboarding progress'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={UserPlus}     label={lang === 'ar' ? 'إجمالي التهيئة' : 'Total Onboarding'}      value={totalCount}       color="#1B3347" />
        <KpiCard icon={Clock}        label={lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}              value={inProgressCount}   color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang === 'ar' ? 'مكتمل' : 'Completed'}                      value={completedCount}    color="#4A7AAB" />
        <KpiCard icon={Timer}        label={lang === 'ar' ? 'متوسط مدة الإكمال' : 'Avg Completion Time'} value={`${avgCompletionDays} ${lang === 'ar' ? 'يوم' : 'days'}`} color="#1B3347" />
      </div>

      {/* ─── Smart Filter ─── */}
      <div className="mb-4">
        <SmartFilter
          fields={SMART_FIELDS}
          filters={smartFilters}
          onChange={setSmartFilters}
        />
      </div>

      {/* ─── Cards ─── */}
      <div className="flex flex-col gap-3">
        {paged.length === 0 ? (
          <div className="text-center py-16 px-5">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <UserCheck size={24} color="#4A7AAB" />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'لا يوجد موظفون في التهيئة' : 'No Onboarding Employees'}
            </p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'لم يتم العثور على نتائج مطابقة' : 'No matching results found'}
            </p>
          </div>
        ) : paged.map(ob => (
          <OnboardingCard
            key={ob.id}
            ob={ob}
            isExpanded={expanded === ob.id}
            isRTL={isRTL}
            lang={lang}
            isDark={isDark}
            onToggle={() => setExpanded(expanded === ob.id ? null : ob.id)}
            onChecklistToggle={(itemId) => toggleChecklistItem(ob.id, itemId)}
          />
        ))}
      </div>

      {/* ─── Pagination ─── */}
      {filtered.length > 0 && (
        <div className="mt-5">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            totalItems={filtered.length}
            safePage={safePage}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ONBOARDING CARD
══════════════════════════════════════════════ */
function OnboardingCard({ ob, isExpanded, isRTL, lang, isDark, onToggle, onChecklistToggle }) {
  const [hov, setHov] = useState(false);
  const name = isRTL ? ob.employee_name_ar : ob.employee_name_en;
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const { pct, done, total } = getProgress(ob.checklist);
  const statusCfg = STATUS_CONFIG[ob.status] || STATUS_CONFIG.not_started;
  const deptLabel = DEPARTMENTS[ob.department] ? (lang === 'ar' ? DEPARTMENTS[ob.department].ar : DEPARTMENTS[ob.department].en) : ob.department;
  const mentorLabel = isRTL ? ob.mentor_name : ob.mentor_name_en;
  const positionLabel = isRTL ? ob.position : ob.position_en;

  return (
    <div
      className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden transition-all duration-200"
      style={{
        borderColor: hov || isExpanded ? 'rgba(74,122,171,0.25)' : undefined,
        boxShadow: isExpanded ? '0 4px 16px rgba(74,122,171,0.12)' : 'none',
      }}
    >
      {/* ─── Card Header (clickable) ─── */}
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onToggle}
        className={`px-5 py-4 cursor-pointer flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <div className={`flex items-center gap-3 flex-1 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          {/* Info */}
          <div className="text-start min-w-0 flex-1">
            <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">{name}</p>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                style={{ background: statusCfg.color + '18', color: statusCfg.color, border: `1px solid ${statusCfg.color}35` }}
              >
                {lang === 'ar' ? statusCfg.ar : statusCfg.en}
              </span>
            </div>
            <div className={`flex items-center gap-3 mt-0.5 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{positionLabel}</p>
              <span className="text-content-muted dark:text-content-muted-dark text-[8px]">|</span>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{deptLabel}</p>
              <span className="text-content-muted dark:text-content-muted-dark text-[8px]">|</span>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                {lang === 'ar' ? 'المرشد:' : 'Mentor:'} {mentorLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Right side: progress */}
        <div className={`flex items-center gap-4 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="hidden sm:block text-center">
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mb-0.5">
              {lang === 'ar' ? 'بدأ:' : 'Started:'} {ob.start_date}
            </p>
          </div>
          <div className="text-center" style={{ minWidth: 48 }}>
            <p className="m-0 text-xl font-bold" style={{ color: statusCfg.color }}>{pct}%</p>
            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{done}/{total}</p>
          </div>
          <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: pct + '%',
                background: pct === 100 ? '#4A7AAB' : pct >= 50 ? '#6B8DB5' : statusCfg.color,
              }}
            />
          </div>
          <div className={`text-content-muted dark:text-content-muted-dark transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isRTL && !isExpanded ? 'rotate-180' : ''}`}>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {/* ─── Expanded Checklist ─── */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-4 border-t border-edge dark:border-edge-dark">
          {/* Mobile start date */}
          <p className="sm:hidden m-0 mb-3 text-xs text-content-muted dark:text-content-muted-dark">
            {lang === 'ar' ? 'تاريخ البدء:' : 'Start Date:'} {ob.start_date}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CHECKLIST_ITEMS.map(item => {
              const checked = ob.checklist[item.id] || false;
              return (
                <div
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onChecklistToggle(item.id); }}
                  className={`px-3.5 py-3 rounded-xl border cursor-pointer transition-all duration-150 hover:scale-[1.02] ${
                    checked
                      ? 'border-brand-500/25 bg-brand-500/[0.08]'
                      : 'border-edge dark:border-edge-dark bg-transparent hover:border-brand-500/15'
                  }`}
                >
                  <div className={`flex items-start gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="mt-0.5 shrink-0">
                      {checked
                        ? <CheckSquare size={16} color="#4A7AAB" />
                        : <Square size={16} className="text-content-muted dark:text-content-muted-dark" />
                      }
                    </div>
                    <div className="text-start flex-1">
                      <div className="text-base mb-0.5">{item.icon}</div>
                      <p className={`m-0 text-xs font-semibold ${checked ? 'text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}>
                        {lang === 'ar' ? item.label_ar : item.label_en}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
