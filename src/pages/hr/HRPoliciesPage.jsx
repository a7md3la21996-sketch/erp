import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import {
  FileText, BookOpen, Shield, Clock, Plus, Eye, Download,
  ChevronDown, ChevronUp, AlertTriangle, Briefcase, Heart,
  Coffee, DollarSign, HardHat, Search, Calendar, CheckCircle2,
  PenLine, Archive
} from 'lucide-react';
import {
  Button, Card, KpiCard, Th, Tr, Td, FilterPill,
  SmartFilter, applySmartFilters, Pagination
} from '../../components/ui';


/* ══════════════════════════════════════════════
   MOCK DATA – Comprehensive company policies
══════════════════════════════════════════════ */
const MOCK_POLICIES = [
  // ── Leave Policies ──
  {
    id: 1,
    title_ar: 'سياسة الإجازة السنوية',
    title_en: 'Annual Leave Policy',
    category: 'leave',
    status: 'active',
    version: '3.1',
    effective_date: '2025-01-01',
    last_updated: '2026-01-15',
    views: 245,
    content_ar: 'يحق لكل موظف بدوام كامل الحصول على 21 يوم إجازة سنوية مدفوعة الأجر بعد إتمام سنة واحدة من الخدمة. تزداد الإجازة إلى 30 يومًا بعد 5 سنوات من الخدمة المتواصلة. يجب تقديم طلب الإجازة قبل أسبوعين على الأقل ويتم الموافقة عليها حسب احتياجات العمل. لا يجوز ترحيل أكثر من 10 أيام إلى السنة التالية.',
    content_en: 'Every full-time employee is entitled to 21 days of paid annual leave after completing one year of service. Leave increases to 30 days after 5 years of continuous service. Leave requests must be submitted at least two weeks in advance and are approved based on business needs. No more than 10 days may be carried over to the following year.',
  },
  {
    id: 2,
    title_ar: 'سياسة الإجازة المرضية',
    title_en: 'Sick Leave Policy',
    category: 'leave',
    status: 'active',
    version: '2.0',
    effective_date: '2025-01-01',
    last_updated: '2025-11-20',
    views: 189,
    content_ar: 'يحق للموظف الحصول على 30 يوم إجازة مرضية سنويًا. أول 15 يومًا بأجر كامل، وال15 يومًا التالية بنصف الأجر. يجب تقديم تقرير طبي معتمد للإجازات التي تزيد عن 3 أيام متتالية. في حالة الإجازات المرضية المتكررة، قد يُطلب فحص طبي من طبيب الشركة.',
    content_en: 'Employees are entitled to 30 days of sick leave per year. The first 15 days are at full pay, and the next 15 days at half pay. A certified medical report is required for absences exceeding 3 consecutive days. For recurring sick leaves, a medical examination by the company physician may be required.',
  },
  {
    id: 3,
    title_ar: 'سياسة إجازة الأمومة والأبوة',
    title_en: 'Maternity & Paternity Leave Policy',
    category: 'leave',
    status: 'active',
    version: '1.5',
    effective_date: '2025-03-01',
    last_updated: '2025-12-10',
    views: 134,
    content_ar: 'تحصل الموظفة على إجازة أمومة مدتها 90 يومًا بأجر كامل، يمكن أن تبدأ قبل 30 يومًا من تاريخ الولادة المتوقع. يحصل الموظف على إجازة أبوة مدتها 5 أيام عمل بأجر كامل. يمكن للأم المرضعة الحصول على ساعة رضاعة يوميًا لمدة سنتين من تاريخ الولادة.',
    content_en: 'Female employees receive 90 days of fully paid maternity leave, which may begin up to 30 days before the expected delivery date. Male employees receive 5 working days of fully paid paternity leave. Nursing mothers are entitled to one hour of nursing time daily for two years from the date of delivery.',
  },

  // ── Attendance Policies ──
  {
    id: 4,
    title_ar: 'سياسة ساعات العمل',
    title_en: 'Work Hours Policy',
    category: 'attendance',
    status: 'active',
    version: '2.3',
    effective_date: '2025-01-01',
    last_updated: '2026-02-01',
    views: 312,
    content_ar: 'ساعات العمل الرسمية من الأحد إلى الخميس، من الساعة 8:00 صباحًا حتى 5:00 مساءً مع ساعة راحة للغداء. يجب على الموظفين تسجيل الحضور والانصراف عبر نظام البصمة. يُسمح بفترة سماح 15 دقيقة في بداية الدوام. التأخير المتكرر يخضع للإجراءات التأديبية.',
    content_en: 'Official working hours are Sunday to Thursday, from 8:00 AM to 5:00 PM with a one-hour lunch break. Employees must clock in and out using the biometric system. A 15-minute grace period is allowed at the start of the shift. Repeated tardiness is subject to disciplinary action.',
  },
  {
    id: 5,
    title_ar: 'سياسة العمل الإضافي',
    title_en: 'Overtime Policy',
    category: 'attendance',
    status: 'active',
    version: '1.8',
    effective_date: '2025-01-01',
    last_updated: '2025-10-15',
    views: 156,
    content_ar: 'يتم احتساب العمل الإضافي بنسبة 150% من الأجر العادي لأيام العمل، و200% لأيام الجمعة والعطل الرسمية. يجب الحصول على موافقة مسبقة من المدير المباشر قبل العمل الإضافي. الحد الأقصى للعمل الإضافي 720 ساعة سنويًا وفقًا لنظام العمل.',
    content_en: 'Overtime is calculated at 150% of regular pay for working days, and 200% for Fridays and public holidays. Prior approval from the direct manager is required before overtime work. Maximum overtime is 720 hours per year as per labor law.',
  },
  {
    id: 6,
    title_ar: 'سياسة العمل عن بُعد',
    title_en: 'Remote Work Policy',
    category: 'attendance',
    status: 'active',
    version: '2.0',
    effective_date: '2025-06-01',
    last_updated: '2026-01-20',
    views: 278,
    content_ar: 'يمكن للموظفين المؤهلين العمل عن بُعد حتى يومين في الأسبوع بموافقة المدير المباشر. يجب أن يكون الموظف متاحًا خلال ساعات العمل الرسمية ويستجيب للاتصالات خلال 30 دقيقة. يتحمل الموظف مسؤولية توفير بيئة عمل مناسبة واتصال إنترنت مستقر.',
    content_en: 'Eligible employees may work remotely up to two days per week with direct manager approval. Employees must be available during official working hours and respond to communications within 30 minutes. Employees are responsible for providing a suitable work environment and stable internet connection.',
  },

  // ── Conduct Policies ──
  {
    id: 7,
    title_ar: 'سياسة اللباس والمظهر',
    title_en: 'Dress Code Policy',
    category: 'conduct',
    status: 'active',
    version: '1.2',
    effective_date: '2025-01-01',
    last_updated: '2025-09-05',
    views: 167,
    content_ar: 'يجب على جميع الموظفين الالتزام بالمظهر المهني المناسب. يُحظر ارتداء الملابس غير الرسمية إلا في الأيام المخصصة (الخميس). يجب أن يكون اللباس محتشمًا ومناسبًا لبيئة العمل. في حالة مقابلة العملاء، يُفضل ارتداء الزي الرسمي.',
    content_en: 'All employees must maintain a professional appearance. Casual attire is not permitted except on designated casual days (Thursdays). Clothing must be modest and appropriate for the work environment. When meeting clients, formal business attire is preferred.',
  },
  {
    id: 8,
    title_ar: 'سياسة وسائل التواصل الاجتماعي',
    title_en: 'Social Media Policy',
    category: 'conduct',
    status: 'active',
    version: '2.1',
    effective_date: '2025-04-01',
    last_updated: '2026-02-15',
    views: 198,
    content_ar: 'يُحظر استخدام وسائل التواصل الاجتماعي للأغراض الشخصية خلال ساعات العمل. لا يجوز نشر معلومات سرية عن الشركة أو عملائها على أي منصة. يجب الحصول على إذن من إدارة التسويق قبل النشر باسم الشركة. أي محتوى مسيء أو تمييزي يعرض الموظف للمساءلة.',
    content_en: 'Personal use of social media during working hours is prohibited. Confidential information about the company or its clients must not be shared on any platform. Marketing department approval is required before posting on behalf of the company. Any offensive or discriminatory content subjects the employee to disciplinary action.',
  },
  {
    id: 9,
    title_ar: 'سياسة السرية وحماية البيانات',
    title_en: 'Confidentiality & Data Protection Policy',
    category: 'conduct',
    status: 'active',
    version: '3.0',
    effective_date: '2025-01-01',
    last_updated: '2026-03-01',
    views: 287,
    content_ar: 'يلتزم جميع الموظفين بالحفاظ على سرية المعلومات التجارية والتقنية للشركة. يُحظر مشاركة كلمات المرور أو الوصول إلى أنظمة غير مصرح بها. يجب الإبلاغ فورًا عن أي اختراق أمني لقسم تقنية المعلومات. يستمر التزام السرية لمدة سنتين بعد انتهاء الخدمة.',
    content_en: 'All employees are committed to maintaining the confidentiality of business and technical information. Sharing passwords or accessing unauthorized systems is prohibited. Any security breach must be reported immediately to the IT department. Confidentiality obligations continue for two years after termination of employment.',
  },

  // ── Compensation Policies ──
  {
    id: 10,
    title_ar: 'سياسة مراجعة الرواتب',
    title_en: 'Salary Review Policy',
    category: 'compensation',
    status: 'active',
    version: '2.0',
    effective_date: '2025-01-01',
    last_updated: '2026-01-01',
    views: 234,
    content_ar: 'تتم مراجعة الرواتب سنويًا في شهر يناير بناءً على تقييم الأداء السنوي وظروف السوق. نسبة الزيادة تتراوح بين 3% و15% حسب تقييم الأداء. الموظفون في فترة التجربة لا يشملهم المراجعة السنوية. يتم إخطار الموظف بالزيادة الجديدة خلال أسبوعين من اعتمادها.',
    content_en: 'Salaries are reviewed annually in January based on annual performance evaluation and market conditions. Increase percentage ranges from 3% to 15% depending on performance rating. Employees on probation are not included in the annual review. Employees are notified of the new increase within two weeks of approval.',
  },
  {
    id: 11,
    title_ar: 'سياسة المكافآت والحوافز',
    title_en: 'Bonuses & Incentives Policy',
    category: 'compensation',
    status: 'active',
    version: '1.7',
    effective_date: '2025-01-01',
    last_updated: '2025-12-20',
    views: 198,
    content_ar: 'يحصل الموظفون على مكافأة أداء ربع سنوية تصل إلى 25% من الراتب الأساسي بناءً على تحقيق مؤشرات الأداء. مكافأة نهاية السنة تعادل راتب شهر كامل للموظفين الذين أتموا سنة خدمة. مكافآت خاصة للمشاريع الاستثنائية بموافقة الإدارة العليا.',
    content_en: 'Employees receive a quarterly performance bonus of up to 25% of base salary based on KPI achievement. Year-end bonus equals one month salary for employees who have completed one year of service. Special bonuses for exceptional projects are subject to senior management approval.',
  },
  {
    id: 12,
    title_ar: 'سياسة الخصومات والجزاءات',
    title_en: 'Deductions & Penalties Policy',
    category: 'compensation',
    status: 'active',
    version: '2.5',
    effective_date: '2025-01-01',
    last_updated: '2025-11-10',
    views: 145,
    content_ar: 'التأخير عن الدوام: إنذار أول مرة، خصم 1% من الراتب اليومي في المرة الثانية. الغياب بدون إذن: خصم يوم كامل مع إنذار كتابي. ثلاث إنذارات كتابية خلال سنة تؤدي إلى إنهاء الخدمة. يحق للموظف التظلم خلال 5 أيام عمل من تاريخ الإنذار.',
    content_en: 'Tardiness: first instance warning, 1% daily salary deduction for second occurrence. Unexcused absence: full day deduction with written warning. Three written warnings within a year lead to termination. Employees may appeal within 5 working days of the warning date.',
  },

  // ── Safety Policies ──
  {
    id: 13,
    title_ar: 'سياسة السلامة في بيئة العمل',
    title_en: 'Workplace Safety Policy',
    category: 'safety',
    status: 'active',
    version: '2.2',
    effective_date: '2025-01-01',
    last_updated: '2026-02-10',
    views: 176,
    content_ar: 'يلتزم جميع الموظفين بمعايير السلامة والصحة المهنية. يجب ارتداء معدات الحماية الشخصية في المناطق المحددة. الإبلاغ الفوري عن أي حادث أو خطر محتمل لمسؤول السلامة. تُجرى تدريبات الإخلاء كل 6 أشهر. التدخين محظور داخل المبنى.',
    content_en: 'All employees must comply with occupational health and safety standards. Personal protective equipment must be worn in designated areas. Any accident or potential hazard must be reported immediately to the safety officer. Evacuation drills are conducted every 6 months. Smoking is prohibited inside the building.',
  },
  {
    id: 14,
    title_ar: 'إجراءات الطوارئ',
    title_en: 'Emergency Procedures',
    category: 'safety',
    status: 'active',
    version: '3.1',
    effective_date: '2025-01-01',
    last_updated: '2026-03-05',
    views: 203,
    content_ar: 'في حالة الحريق: اضغط زر الإنذار، استخدم أقرب مخرج طوارئ، تجمع في نقطة التجمع المحددة. في حالة الزلازل: اختبئ تحت المكتب، ابتعد عن النوافذ. في حالة الطوارئ الطبية: اتصل بفريق الإسعاف الداخلي على الرقم 999. يجب على كل قسم تعيين منسق طوارئ.',
    content_en: 'In case of fire: press the alarm button, use the nearest emergency exit, gather at the designated assembly point. In case of earthquake: take cover under a desk, stay away from windows. For medical emergencies: contact the internal first-aid team at ext. 999. Each department must assign an emergency coordinator.',
  },

  // ── Draft & Archived ──
  {
    id: 15,
    title_ar: 'سياسة التطوير الوظيفي',
    title_en: 'Career Development Policy',
    category: 'conduct',
    status: 'draft',
    version: '1.0',
    effective_date: '2026-06-01',
    last_updated: '2026-03-10',
    views: 45,
    content_ar: 'مسودة: تلتزم الشركة بدعم التطوير المهني لموظفيها من خلال برامج التدريب وفرص الترقي. يحق لكل موظف الحصول على 40 ساعة تدريب سنويًا. يتم إعداد خطة تطوير فردية مع المدير المباشر خلال الربع الأول من كل سنة.',
    content_en: 'Draft: The company is committed to supporting professional development through training programs and advancement opportunities. Each employee is entitled to 40 hours of training annually. An individual development plan is prepared with the direct manager during the first quarter of each year.',
  },
  {
    id: 16,
    title_ar: 'سياسة العمل المرن',
    title_en: 'Flexible Work Arrangements Policy',
    category: 'attendance',
    status: 'draft',
    version: '0.9',
    effective_date: '2026-07-01',
    last_updated: '2026-03-08',
    views: 32,
    content_ar: 'مسودة: يمكن للموظفين المؤهلين اختيار ساعات عمل مرنة ضمن النطاق من 7:00 صباحًا إلى 7:00 مساءً شريطة إتمام 8 ساعات عمل يوميًا والتواجد خلال الساعات الأساسية من 10:00 صباحًا إلى 3:00 مساءً.',
    content_en: 'Draft: Eligible employees may choose flexible working hours within the 7:00 AM to 7:00 PM window, provided they complete 8 working hours daily and are present during core hours from 10:00 AM to 3:00 PM.',
  },
  {
    id: 17,
    title_ar: 'سياسة السفر القديمة',
    title_en: 'Legacy Travel Policy',
    category: 'compensation',
    status: 'archived',
    version: '1.0',
    effective_date: '2023-01-01',
    last_updated: '2024-12-31',
    views: 89,
    content_ar: 'أرشيف: سياسة السفر السابقة التي تم استبدالها بالسياسة المحدثة في 2025. كانت تتضمن بدل سفر يومي 500 ريال وتغطية تذاكر الطيران بالدرجة الاقتصادية.',
    content_en: 'Archived: Previous travel policy replaced by the updated policy in 2025. Included a daily travel allowance of 500 SAR and economy class flight coverage.',
  },
  {
    id: 18,
    title_ar: 'سياسة التأمين الطبي',
    title_en: 'Medical Insurance Policy',
    category: 'compensation',
    status: 'active',
    version: '2.4',
    effective_date: '2025-01-01',
    last_updated: '2026-01-10',
    views: 321,
    content_ar: 'يتم توفير تأمين طبي شامل لجميع الموظفين وعائلاتهم (الزوج/الزوجة وحتى 4 أبناء). يشمل التأمين: الكشف الطبي، الأسنان، البصريات، والأدوية. حد التغطية السنوي 500,000 ريال. نسبة التحمل 20% للعيادات الخارجية.',
    content_en: 'Comprehensive medical insurance is provided for all employees and their families (spouse and up to 4 children). Coverage includes: medical consultations, dental, optical, and medications. Annual coverage limit is 500,000 SAR. Co-payment is 20% for outpatient visits.',
  },
];

/* ── Category definitions ── */
const CATEGORIES = [
  { key: 'all',          label_ar: 'الكل',      label_en: 'All',            icon: FileText,    color: '#1B3347' },
  { key: 'leave',        label_ar: 'الإجازات',  label_en: 'Leave',          icon: BookOpen,    color: '#4A7AAB' },
  { key: 'attendance',   label_ar: 'الحضور',    label_en: 'Attendance',     icon: Clock,       color: '#6B8DB5' },
  { key: 'conduct',      label_ar: 'السلوك',    label_en: 'Conduct',        icon: Shield,      color: '#2B4C6F' },
  { key: 'compensation', label_ar: 'التعويضات', label_en: 'Compensation',   icon: DollarSign,  color: '#3D6B8E' },
  { key: 'safety',       label_ar: 'السلامة',   label_en: 'Safety',         icon: HardHat,     color: '#5A8FA8' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.filter(c => c.key !== 'all').map(c => [c.key, c]));

const STATUS_CONFIG = {
  active:   { label_ar: 'نشط',    label_en: 'Active',   color: '#4A7AAB' },
  draft:    { label_ar: 'مسودة',   label_en: 'Draft',    color: '#6B8DB5' },
  archived: { label_ar: 'مؤرشف',  label_en: 'Archived', color: '#94a3b8' },
};


/* ── Icon Button helper ── */
function IconBtn({ icon: Icon, onClick, title, color = '#4A7AAB' }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark"
    >
      <Icon size={14} />
    </button>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function HRPoliciesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [expandedId, setExpandedId] = useState(null);

  const { auditFields, applyAuditFilters } = useAuditFilter('policy');

  /* ── Stats ── */
  const totalPolicies = MOCK_POLICIES.length;
  const activePolicies = MOCK_POLICIES.filter(p => p.status === 'active').length;
  const draftPolicies = MOCK_POLICIES.filter(p => p.status === 'draft').length;
  const recentlyUpdated = MOCK_POLICIES.filter(p => {
    const days = Math.ceil((new Date() - new Date(p.last_updated)) / 864e5);
    return days <= 30;
  }).length;

  /* ── SmartFilter fields ── */
  const SMART_FIELDS = useMemo(() => [
    {
      id: 'category', label: 'التصنيف', labelEn: 'Category', type: 'select',
      options: CATEGORIES.filter(c => c.key !== 'all').map(c => ({
        value: c.key, label: c.label_ar, labelEn: c.label_en,
      })),
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'active', label: 'نشط', labelEn: 'Active' },
        { value: 'draft', label: 'مسودة', labelEn: 'Draft' },
        { value: 'archived', label: 'مؤرشف', labelEn: 'Archived' },
      ],
    },
    { id: 'effective_date', label: 'تاريخ السريان', labelEn: 'Effective Date', type: 'date' },
    { id: 'last_updated', label: 'آخر تحديث', labelEn: 'Last Updated', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let result = [...MOCK_POLICIES];

    // Smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title_ar.toLowerCase().includes(q) ||
        p.title_en.toLowerCase().includes(q) ||
        p.content_ar.toLowerCase().includes(q) ||
        p.content_en.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [smartFilters, SMART_FIELDS, search]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters]);

  /* ── Helpers ── */
  const getCategoryInfo = (key) => CATEGORY_MAP[key] || { label_ar: key, label_en: key, color: '#94a3b8', icon: FileText };
  const getStatusInfo = (key) => STATUS_CONFIG[key] || STATUS_CONFIG.active;

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">

      {/* ── Page Header ── */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <FileText size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'سياسات الموارد البشرية' : 'HR Policies'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إدارة سياسات وأنظمة الشركة' : 'Manage company policies & guidelines'}
            </p>
          </div>
        </div>
        <Button size="md">
          <Plus size={16} />
          {lang === 'ar' ? '+ سياسة جديدة' : '+ New Policy'}
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={FileText}      label={lang === 'ar' ? 'إجمالي السياسات' : 'Total Policies'}     value={totalPolicies}   color="#1B3347" />
        <KpiCard icon={CheckCircle2}  label={lang === 'ar' ? 'نشطة' : 'Active'}                        value={activePolicies}   color="#4A7AAB" />
        <KpiCard icon={PenLine}       label={lang === 'ar' ? 'مسودة' : 'Draft'}                        value={draftPolicies}    color="#6B8DB5" />
        <KpiCard icon={Calendar}      label={lang === 'ar' ? 'مُحدّثة مؤخرًا' : 'Recently Updated'}    value={recentlyUpdated}  color="#2B4C6F" />
      </div>

      {/* ── Category Pills ── */}
      <div className={`flex flex-wrap gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {CATEGORIES.map(c => {
          const count = c.key === 'all'
            ? MOCK_POLICIES.length
            : MOCK_POLICIES.filter(p => p.category === c.key).length;
          const CatIcon = c.icon;
          const isActive = smartFilters.some(f => f.field === 'category' && f.value === c.key);
          return (
            <FilterPill
              key={c.key}
              label={`${lang === 'ar' ? c.label_ar : c.label_en} (${count})`}
              active={c.key === 'all' ? !smartFilters.some(f => f.field === 'category') : isActive}
              onClick={() => {
                if (c.key === 'all') {
                  setSmartFilters(prev => prev.filter(f => f.field !== 'category'));
                } else {
                  setSmartFilters(prev => [
                    ...prev.filter(f => f.field !== 'category'),
                    { field: 'category', operator: 'is', value: c.key },
                  ]);
                }
              }}
            />
          );
        })}
      </div>

      {/* ── SmartFilter ── */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'ابحث في السياسات...' : 'Search policies...'}
        resultsCount={filtered.length}
      />

      {/* ── Policies Table ── */}
      <Card className="!rounded-xl overflow-hidden mt-4">
        <div className={`px-4 py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {lang === 'ar' ? 'قائمة السياسات' : 'Policies List'}
            <span className="text-content-muted dark:text-content-muted-dark font-normal mx-2">
              ({filtered.length})
            </span>
          </p>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'السياسة' : 'Policy',
                lang === 'ar' ? 'التصنيف' : 'Category',
                lang === 'ar' ? 'الإصدار' : 'Version',
                lang === 'ar' ? 'تاريخ السريان' : 'Effective Date',
                lang === 'ar' ? 'آخر تحديث' : 'Updated',
                lang === 'ar' ? 'الحالة' : 'Status',
                lang === 'ar' ? 'المشاهدات' : 'Views',
                '',
              ].map((h, i) => (
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(policy => (
              <PolicyRow
                key={policy.id}
                policy={policy}
                isRTL={isRTL}
                lang={lang}
                isDark={isDark}
                expanded={expandedId === policy.id}
                onToggle={() => toggleExpand(policy.id)}
                getCategoryInfo={getCategoryInfo}
                getStatusInfo={getStatusInfo}
              />
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
                  {lang === 'ar' ? 'لا توجد سياسات مطابقة' : 'No matching policies found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════
   PolicyRow – expandable table row
══════════════════════════════════════════════ */
function PolicyRow({ policy, isRTL, lang, isDark, expanded, onToggle, getCategoryInfo, getStatusInfo }) {
  const catInfo = getCategoryInfo(policy.category);
  const statusInfo = getStatusInfo(policy.status);
  const CatIcon = catInfo.icon || FileText;

  return (
    <>
      <Tr className="cursor-pointer" onClick={onToggle}>
        <Td>
          <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
              style={{ background: catInfo.color + '18' }}
            >
              <CatIcon size={15} color={catInfo.color} />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                {lang === 'ar' ? policy.title_ar : policy.title_en}
              </p>
            </div>
          </div>
        </Td>
        <Td>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: catInfo.color + '18', color: catInfo.color, border: `1px solid ${catInfo.color}35` }}
          >
            {lang === 'ar' ? catInfo.label_ar : catInfo.label_en}
          </span>
        </Td>
        <Td className="text-content-muted dark:text-content-muted-dark">v{policy.version}</Td>
        <Td className="text-content-muted dark:text-content-muted-dark">{policy.effective_date}</Td>
        <Td className="text-content-muted dark:text-content-muted-dark">{policy.last_updated}</Td>
        <Td>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: statusInfo.color + '18', color: statusInfo.color, border: `1px solid ${statusInfo.color}35` }}
          >
            {policy.status === 'active' && <CheckCircle2 size={11} className={isRTL ? 'ml-1' : 'mr-1'} />}
            {policy.status === 'draft' && <PenLine size={11} className={isRTL ? 'ml-1' : 'mr-1'} />}
            {policy.status === 'archived' && <Archive size={11} className={isRTL ? 'ml-1' : 'mr-1'} />}
            {lang === 'ar' ? statusInfo.label_ar : statusInfo.label_en}
          </span>
        </Td>
        <Td className="text-content-muted dark:text-content-muted-dark">{policy.views}</Td>
        <Td>
          <div className={`flex gap-1.5 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
            <IconBtn icon={Eye} title={lang === 'ar' ? 'عرض' : 'View'} />
            <IconBtn icon={Download} title={lang === 'ar' ? 'تحميل' : 'Download'} />
            <button
              onClick={e => { e.stopPropagation(); onToggle(); }}
              className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </Td>
      </Tr>

      {/* ── Expanded content ── */}
      {expanded && (
        <tr>
          <td colSpan={8} className="px-0 py-0">
            <div
              className="px-6 py-4 border-b border-edge dark:border-edge-dark"
              style={{
                background: isDark ? 'rgba(27,51,71,0.15)' : 'rgba(74,122,171,0.04)',
              }}
            >
              <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: catInfo.color + '18' }}
                >
                  <FileText size={14} color={catInfo.color} />
                </div>
                <div className="flex-1">
                  <p
                    className="m-0 mb-1 text-sm font-bold text-content dark:text-content-dark"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {lang === 'ar' ? policy.title_ar : policy.title_en}
                  </p>
                  <p
                    className="m-0 text-xs leading-6 text-content-muted dark:text-content-muted-dark"
                    style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: '1.8' }}
                  >
                    {lang === 'ar' ? policy.content_ar : policy.content_en}
                  </p>
                  <div
                    className={`flex items-center gap-4 mt-3 text-xs text-content-muted dark:text-content-muted-dark ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Calendar size={12} />
                      {lang === 'ar' ? 'تاريخ السريان:' : 'Effective:'} {policy.effective_date}
                    </span>
                    <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Clock size={12} />
                      {lang === 'ar' ? 'آخر تحديث:' : 'Updated:'} {policy.last_updated}
                    </span>
                    <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Eye size={12} />
                      {policy.views} {lang === 'ar' ? 'مشاهدة' : 'views'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
