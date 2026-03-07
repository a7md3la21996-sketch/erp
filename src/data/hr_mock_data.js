// ============================================================
// HR Mock Data — Platform Real Estate ERP
// ============================================================

// ── HR Policies ──────────────────────────────────────────────
export const MOCK_HR_POLICIES = [
  // إجازات
  { id: 'p1',  key: 'annual_leave_year1',        category: 'leave',      level: 'company',    value: '15',    label_ar: 'رصيد الإجازة السنوية (السنة الأولى)',       label_en: 'Annual Leave Year 1',          unit: 'days',    description_ar: 'عدد أيام الإجازة السنوية خلال السنة الأولى من العمل' },
  { id: 'p2',  key: 'annual_leave_year2',        category: 'leave',      level: 'company',    value: '21',    label_ar: 'رصيد الإجازة السنوية (السنة الثانية+)',     label_en: 'Annual Leave Year 2+',         unit: 'days',    description_ar: 'عدد أيام الإجازة السنوية من السنة الثانية وما بعدها' },
  { id: 'p3',  key: 'probation_months',          category: 'employment', level: 'company',    value: '3',     label_ar: 'فترة الاستحقاق (Probation)',                label_en: 'Probation Period',             unit: 'months',  description_ar: 'مدة فترة التجربة — رصيد الإجازة لا يظهر خلالها' },
  { id: 'p4',  key: 'sick_leave_days',           category: 'leave',      level: 'company',    value: '7',     label_ar: 'أيام الإجازة المرضية السنوية',             label_en: 'Sick Leave Days',              unit: 'days',    description_ar: 'عدد أيام الإجازة المرضية المدفوعة سنوياً' },
  { id: 'p5',  key: 'marriage_leave_days',       category: 'leave',      level: 'company',    value: '3',     label_ar: 'أيام إجازة الزواج',                        label_en: 'Marriage Leave Days',          unit: 'days',    description_ar: 'عدد أيام إجازة الزواج' },
  { id: 'p6',  key: 'maternity_leave_days',      category: 'leave',      level: 'company',    value: '90',    label_ar: 'أيام إجازة الأمومة',                       label_en: 'Maternity Leave Days',         unit: 'days',    description_ar: 'عدد أيام إجازة الأمومة' },
  { id: 'p7',  key: 'paternity_leave_days',      category: 'leave',      level: 'company',    value: '3',     label_ar: 'أيام إجازة الأبوة',                        label_en: 'Paternity Leave Days',         unit: 'days',    description_ar: 'عدد أيام إجازة الأبوة' },
  // حضور وعمل
  { id: 'p8',  key: 'work_hours_normal',         category: 'attendance', level: 'company',    value: '8',     label_ar: 'ساعات العمل اليومية (عادي)',               label_en: 'Daily Work Hours (Normal)',     unit: 'hours',   description_ar: 'عدد ساعات العمل اليومية في الجدول العادي' },
  { id: 'p9',  key: 'work_hours_ramadan',        category: 'attendance', level: 'company',    value: '4.5',   label_ar: 'ساعات العمل اليومية (رمضان)',              label_en: 'Daily Work Hours (Ramadan)',    unit: 'hours',   description_ar: 'عدد ساعات العمل اليومية في شهر رمضان' },
  { id: 'p10', key: 'tolerance_hours_monthly',   category: 'attendance', level: 'company',    value: '4',     label_ar: 'ساعات التسامح الشهرية',                   label_en: 'Monthly Tolerance Hours',      unit: 'hours',   description_ar: 'ساعات التأخير المسموح بها شهرياً بدون خصم مضاعف' },
  { id: 'p11', key: 'work_start_time',           category: 'attendance', level: 'company',    value: '10:00', label_ar: 'وقت بداية العمل',                          label_en: 'Work Start Time',              unit: 'time',    description_ar: 'وقت بداية الدوام الرسمي' },
  { id: 'p12', key: 'late_threshold_time',       category: 'attendance', level: 'company',    value: '10:30', label_ar: 'وقت احتساب التأخير',                       label_en: 'Late Threshold Time',          unit: 'time',    description_ar: 'بعد هذا الوقت يُحتسب الموظف متأخراً' },
  // رواتب
  { id: 'p13', key: 'hourly_rate_divisor',       category: 'payroll',    level: 'company',    value: '240',   label_ar: 'مقسوم حساب الأجر الساعي',                 label_en: 'Hourly Rate Divisor',          unit: 'number',  description_ar: 'الراتب ÷ هذا الرقم = الأجر الساعي (30 يوم × 8 ساعات)' },
  { id: 'p14', key: 'work_days_per_month',       category: 'payroll',    level: 'company',    value: '30',    label_ar: 'أيام العمل في الشهر',                      label_en: 'Work Days Per Month',          unit: 'days',    description_ar: 'عدد أيام العمل الافتراضية في الشهر لحساب الراتب اليومي' },
  { id: 'p15', key: 'absence_with_notice_mult',  category: 'payroll',    level: 'company',    value: '1',     label_ar: 'مضاعف خصم الغياب بإشعار',                 label_en: 'Absence With Notice Multiplier', unit: 'x',     description_ar: 'مضاعف خصم يوم الغياب مع إشعار مسبق (1 = يوم مقابل يوم)' },
  { id: 'p16', key: 'absence_no_notice_mult',    category: 'payroll',    level: 'company',    value: '2',     label_ar: 'مضاعف خصم الغياب بدون إشعار',             label_en: 'Absence No Notice Multiplier', unit: 'x',       description_ar: 'مضاعف خصم يوم الغياب بدون إشعار (2 = يومين مقابل يوم)' },
  // تنبيهات
  { id: 'p17', key: 'contract_expiry_alert_days',   category: 'alerts', level: 'company',    value: '30',    label_ar: 'تنبيه انتهاء العقد (قبل كم يوم)',          label_en: 'Contract Expiry Alert Days',   unit: 'days',    description_ar: 'عدد الأيام قبل انتهاء العقد لإرسال التنبيه' },
  { id: 'p18', key: 'probation_end_alert_days',     category: 'alerts', level: 'company',    value: '7',     label_ar: 'تنبيه انتهاء فترة التجربة (قبل كم يوم)', label_en: 'Probation End Alert Days',     unit: 'days',    description_ar: 'عدد الأيام قبل انتهاء فترة التجربة لإرسال التنبيه' },
];

// ── Departments ───────────────────────────────────────────────
export const DEPARTMENTS = [
  { id: 'sales',     name_ar: 'المبيعات',         name_en: 'Sales' },
  { id: 'marketing', name_ar: 'التسويق',           name_en: 'Marketing' },
  { id: 'hr',        name_ar: 'الموارد البشرية',   name_en: 'HR' },
  { id: 'finance',   name_ar: 'المالية',           name_en: 'Finance' },
];

// ── Employees ─────────────────────────────────────────────────
export const MOCK_EMPLOYEES = [
  {
    id: 'e1',
    employee_number: 'EMP-001',
    full_name_ar: 'أحمد علاء الدين',
    full_name_en: 'Ahmed Alaa Eldin',
    email: 'ahmed@platform.com',
    phone: '+201001234567',
    national_id: '29901011234567',
    department: 'sales',
    job_title_ar: 'مدير المبيعات',
    job_title_en: 'Sales Director',
    role: 'sales_director',
    work_type: 'office',
    contract_type: 'full_time',
    hire_date: '2022-01-15',
    contract_end_date: null,
    base_salary: 25000,
    ot_multiplier: '1.5x',
    tolerance_hours: 4,
    direct_manager_id: null,
    status: 'active',
    avatar_color: '#2B4C6F',
    address: 'القاهرة، مصر',
    notes: '',
  },
  {
    id: 'e2',
    employee_number: 'EMP-002',
    full_name_ar: 'سارة محمود',
    full_name_en: 'Sara Mahmoud',
    email: 'sara@platform.com',
    phone: '+201112345678',
    national_id: '29503051234567',
    department: 'hr',
    job_title_ar: 'مسؤول الموارد البشرية',
    job_title_en: 'HR Officer',
    role: 'hr',
    work_type: 'office',
    contract_type: 'full_time',
    hire_date: '2022-03-01',
    contract_end_date: null,
    base_salary: 12000,
    ot_multiplier: '1x',
    tolerance_hours: 4,
    direct_manager_id: 'e1',
    status: 'active',
    avatar_color: '#6366F1',
    address: 'القاهرة، مصر',
    notes: '',
  },
  {
    id: 'e3',
    employee_number: 'EMP-003',
    full_name_ar: 'محمد خالد',
    full_name_en: 'Mohamed Khaled',
    email: 'mkh@platform.com',
    phone: '+201223456789',
    national_id: '29701021234567',
    department: 'sales',
    job_title_ar: 'سيلز مانجر',
    job_title_en: 'Sales Manager',
    role: 'sales_manager',
    work_type: 'office',
    contract_type: 'full_time',
    hire_date: '2022-06-15',
    contract_end_date: null,
    base_salary: 18000,
    ot_multiplier: '1.5x',
    tolerance_hours: 4,
    direct_manager_id: 'e1',
    status: 'active',
    avatar_color: '#10B981',
    address: 'القاهرة، مصر',
    notes: '',
  },
  {
    id: 'e4',
    employee_number: 'EMP-004',
    full_name_ar: 'نورا أحمد',
    full_name_en: 'Noura Ahmed',
    email: 'noura@platform.com',
    phone: '+201334567890',
    national_id: '29901031234567',
    department: 'marketing',
    job_title_ar: 'أخصائي تسويق',
    job_title_en: 'Marketing Specialist',
    role: 'marketing',
    work_type: 'hybrid',
    contract_type: 'full_time',
    hire_date: '2023-01-10',
    contract_end_date: null,
    base_salary: 10000,
    ot_multiplier: '1x',
    tolerance_hours: 4,
    direct_manager_id: 'e1',
    status: 'active',
    avatar_color: '#EC4899',
    address: 'القاهرة، مصر',
    notes: '',
  },
  {
    id: 'e5',
    employee_number: 'EMP-005',
    full_name_ar: 'عمر حسن',
    full_name_en: 'Omar Hassan',
    email: 'omar@platform.com',
    phone: '+201445678901',
    national_id: '30001041234567',
    department: 'sales',
    job_title_ar: 'تيم ليدر',
    job_title_en: 'Team Leader',
    role: 'team_leader',
    work_type: 'office',
    contract_type: 'full_time',
    hire_date: '2023-03-20',
    contract_end_date: null,
    base_salary: 15000,
    ot_multiplier: '1.5x',
    tolerance_hours: 5,
    direct_manager_id: 'e3',
    status: 'active',
    avatar_color: '#F59E0B',
    address: 'الجيزة، مصر',
    notes: '',
  },
  {
    id: 'e6',
    employee_number: 'EMP-006',
    full_name_ar: 'ياسمين طارق',
    full_name_en: 'Yasmine Tarek',
    email: 'yasmine@platform.com',
    phone: '+201556789012',
    national_id: '30101051234567',
    department: 'sales',
    job_title_ar: 'مستشار مبيعات',
    job_title_en: 'Sales Agent',
    role: 'sales_agent',
    work_type: 'field',
    contract_type: 'full_time',
    hire_date: '2023-09-01',
    contract_end_date: null,
    base_salary: 8000,
    ot_multiplier: '1x',
    tolerance_hours: 4,
    direct_manager_id: 'e5',
    status: 'active',
    avatar_color: '#8B5CF6',
    address: 'القاهرة، مصر',
    notes: '',
  },
  {
    id: 'e7',
    employee_number: 'EMP-007',
    full_name_ar: 'كريم وليد',
    full_name_en: 'Karim Walid',
    email: 'karim@platform.com',
    phone: '+201667890123',
    national_id: '30201061234567',
    department: 'finance',
    job_title_ar: 'محاسب',
    job_title_en: 'Accountant',
    role: 'finance',
    work_type: 'office',
    contract_type: 'full_time',
    hire_date: '2024-02-01',
    contract_end_date: null,
    base_salary: 11000,
    ot_multiplier: '1x',
    tolerance_hours: 4,
    direct_manager_id: 'e1',
    status: 'active',
    avatar_color: '#14B8A6',
    address: 'القاهرة، مصر',
    notes: '',
  },
  {
    id: 'e8',
    employee_number: 'EMP-008',
    full_name_ar: 'منى سامي',
    full_name_en: 'Mona Sami',
    email: 'mona@platform.com',
    phone: '+201778901234',
    national_id: '30301071234567',
    department: 'sales',
    job_title_ar: 'مستشار مبيعات',
    job_title_en: 'Sales Agent',
    role: 'sales_agent',
    work_type: 'office',
    contract_type: 'probation',
    hire_date: '2025-12-15',
    contract_end_date: '2026-03-15',
    base_salary: 7000,
    ot_multiplier: '1x',
    tolerance_hours: 4,
    direct_manager_id: 'e5',
    status: 'active',
    avatar_color: '#EF4444',
    address: 'القاهرة، مصر',
    notes: 'في فترة التجربة',
  },
];

// ── Helper Functions ──────────────────────────────────────────
export function getEmployeeById(id) {
  return MOCK_EMPLOYEES.find(e => e.id === id) || null;
}

export function getEmployeeName(id, lang = 'ar') {
  const emp = getEmployeeById(id);
  if (!emp) return '—';
  return lang === 'ar' ? emp.full_name_ar : emp.full_name_en;
}

export function getEmployeesByDepartment(dept) {
  return MOCK_EMPLOYEES.filter(e => e.department === dept);
}

export function getDirectReports(managerId) {
  return MOCK_EMPLOYEES.filter(e => e.direct_manager_id === managerId);
}

export function calcYearsOfService(hireDate) {
  const hire = new Date(hireDate);
  const now = new Date();
  const diff = (now - hire) / (1000 * 60 * 60 * 24 * 365.25);
  return diff;
}

export function calcLeaveBalance(hireDate, leaveYear1 = 15, leaveYear2 = 21, probationMonths = 3) {
  const years = calcYearsOfService(hireDate);
  const months = years * 12;
  if (months < probationMonths) return { balance: 0, inProbation: true };
  if (years < 1) {
    const remainingMonths = 12 - months;
    const prorated = Math.round((leaveYear1 / 12) * (12 - remainingMonths));
    return { balance: prorated, inProbation: false };
  }
  return { balance: leaveYear2, inProbation: false };
}

export function isProbationEndingSoon(hireDate, probationMonths = 3, alertDays = 7) {
  const hire = new Date(hireDate);
  const probEnd = new Date(hire);
  probEnd.setMonth(probEnd.getMonth() + probationMonths);
  const now = new Date();
  const daysLeft = (probEnd - now) / (1000 * 60 * 60 * 24);
  return daysLeft > 0 && daysLeft <= alertDays;
}

export function isContractEndingSoon(contractEndDate, alertDays = 30) {
  if (!contractEndDate) return false;
  const end = new Date(contractEndDate);
  const now = new Date();
  const daysLeft = (end - now) / (1000 * 60 * 60 * 24);
  return daysLeft > 0 && daysLeft <= alertDays;
}

export const CONTRACT_TYPES = {
  full_time:  { ar: 'دوام كامل',    en: 'Full Time',   color: '#10B981' },
  part_time:  { ar: 'دوام جزئي',    en: 'Part Time',   color: '#F59E0B' },
  freelance:  { ar: 'فريلانس',      en: 'Freelance',   color: '#8B5CF6' },
  probation:  { ar: 'فترة تجربة',   en: 'Probation',   color: '#EF4444' },
};

export const WORK_TYPES = {
  office: { ar: 'مكتبي',   en: 'Office',  icon: '🏢' },
  remote: { ar: 'ريموت',   en: 'Remote',  icon: '🏠' },
  field:  { ar: 'ميداني',  en: 'Field',   icon: '🚗' },
  hybrid: { ar: 'هجين',    en: 'Hybrid',  icon: '🔄' },
};

export const OT_MULTIPLIERS = ['1x', '1.5x', '2x', 'Fixed'];

export const POLICY_CATEGORIES = {
  leave:      { ar: 'الإجازات',         en: 'Leave',      color: '#10B981', icon: '🏖️' },
  attendance: { ar: 'الحضور والعمل',    en: 'Attendance', color: '#3B82F6', icon: '⏰' },
  payroll:    { ar: 'الرواتب',          en: 'Payroll',    color: '#F59E0B', icon: '💰' },
  employment: { ar: 'التوظيف',          en: 'Employment', color: '#8B5CF6', icon: '📋' },
  alerts:     { ar: 'التنبيهات',        en: 'Alerts',     color: '#EF4444', icon: '🔔' },
};

export const COMPETENCIES = [
  { id: 'c1', key: 'communication',   ar: 'التواصل',            en: 'Communication',   icon: '💬', weight: 20 },
  { id: 'c2', key: 'teamwork',        ar: 'العمل الجماعي',      en: 'Teamwork',        icon: '🤝', weight: 15 },
  { id: 'c3', key: 'initiative',      ar: 'المبادرة',           en: 'Initiative',      icon: '⚡', weight: 15 },
  { id: 'c4', key: 'problem_solving', ar: 'حل المشكلات',        en: 'Problem Solving', icon: '🧠', weight: 20 },
  { id: 'c5', key: 'attendance',      ar: 'الالتزام والحضور',   en: 'Commitment',      icon: '📅', weight: 15 },
  { id: 'c6', key: 'quality',         ar: 'جودة العمل',         en: 'Work Quality',    icon: '✨', weight: 15 },
];
