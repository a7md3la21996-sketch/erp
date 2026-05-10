import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEmployees, fetchDepartments } from '../../services/employeesService';
import {
  ArrowLeft, ArrowRight, User, Briefcase, Mail, Phone, Calendar, Building2,
  DollarSign, Clock, FileText, Award, Shield, ChevronRight, MapPin,
  CalendarDays, BadgeCheck, ExternalLink,
} from 'lucide-react';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';
import EmployeeCompensationTab from './EmployeeCompensationTab';
import EmployeeTimeTab from './EmployeeTimeTab';
import EmployeeDocumentsTab from './EmployeeDocumentsTab';
import EmployeePerformanceTab from './EmployeePerformanceTab';
import EmployeeDisciplinaryTab from './EmployeeDisciplinaryTab';

/* ─────────────────────────────────────────────────────────────────────────
   Person-centric employee detail page. The hub for everything about one
   employee. Phase 1 wires up Overview fully and stubs the other 5 tabs.
───────────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'overview',     icon: User,        label_ar: 'نظرة عامة',   label_en: 'Overview' },
  { key: 'compensation', icon: DollarSign,  label_ar: 'الراتب',        label_en: 'Compensation' },
  { key: 'time',         icon: Clock,       label_ar: 'الوقت والحضور', label_en: 'Time' },
  { key: 'documents',    icon: FileText,    label_ar: 'المستندات',    label_en: 'Documents' },
  { key: 'performance',  icon: Award,       label_ar: 'الأداء',         label_en: 'Performance' },
  { key: 'disciplinary', icon: Shield,      label_ar: 'الشؤون التأديبية', label_en: 'Disciplinary' },
];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [emp, setEmp] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Salary visible only to admin / finance / hr (mirrors EmployeesPage gate).
  const canViewSalary = ['admin', 'finance', 'hr'].includes(profile?.role);
  // Disciplinary tab is admin/hr only.
  const canViewDisciplinary = ['admin', 'hr'].includes(profile?.role);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchEmployees({ includeDeleted: true }),
      fetchDepartments(),
    ]).then(([all, depts]) => {
      if (cancelled) return;
      const found = (all || []).find(e => e.id === id || e.employee_id === id);
      setEmp(found || null);
      setDepartments(depts || []);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={4} />
    </div>
  );

  if (!emp) return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-12 md:px-7 md:py-12 bg-surface-bg dark:bg-surface-bg-dark min-h-screen flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <User size={28} className="text-red-500" />
      </div>
      <p className="m-0 mb-1.5 text-lg font-bold text-content dark:text-content-dark">
        {isRTL ? 'الموظف غير موجود' : 'Employee not found'}
      </p>
      <p className="m-0 mb-5 text-xs text-content-muted dark:text-content-muted-dark">
        {isRTL ? `لم نتمكن من العثور على موظف بالمعرّف ${id}` : `We could not find an employee with id ${id}`}
      </p>
      <button
        onClick={() => navigate('/hr/employees')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-sm font-semibold text-content dark:text-content-dark hover:bg-brand-500/10 transition-colors"
      >
        {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
        {isRTL ? 'الرجوع لقائمة الموظفين' : 'Back to Employees'}
      </button>
    </div>
  );

  const tabsToShow = TABS.filter(t => t.key !== 'disciplinary' || canViewDisciplinary);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Back button */}
      <button
        onClick={() => navigate('/hr/employees')}
        className={`inline-flex items-center gap-1.5 text-xs text-content-muted dark:text-content-muted-dark hover:text-brand-500 mb-3 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        {isRTL ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
        {isRTL ? 'الموظفين' : 'Employees'}
      </button>

      <EmployeeHeader emp={emp} departments={departments} isRTL={isRTL} lang={lang} />

      <KpiStrip emp={emp} canViewSalary={canViewSalary} isRTL={isRTL} lang={lang} />

      {/* Tabs */}
      <div className={`flex gap-1 mb-5 p-1 rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
        {tabsToShow.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500'
              }`}
            >
              <Icon size={15} />
              {isRTL ? tab.label_ar : tab.label_en}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab emp={emp} departments={departments} isRTL={isRTL} lang={lang} canViewSalary={canViewSalary} />
      )}
      {activeTab === 'compensation' && (
        <EmployeeCompensationTab emp={emp} isRTL={isRTL} lang={lang} canViewSalary={canViewSalary} />
      )}
      {activeTab === 'time' && (
        <EmployeeTimeTab emp={emp} isRTL={isRTL} lang={lang} />
      )}
      {activeTab === 'documents' && (
        <EmployeeDocumentsTab emp={emp} isRTL={isRTL} lang={lang} />
      )}
      {activeTab === 'performance' && (
        <EmployeePerformanceTab emp={emp} isRTL={isRTL} lang={lang} />
      )}
      {activeTab === 'disciplinary' && canViewDisciplinary && (
        <EmployeeDisciplinaryTab emp={emp} isRTL={isRTL} lang={lang} />
      )}
    </div>
  );
}

/* ───── Header card with avatar + key info ───── */
function EmployeeHeader({ emp, departments, isRTL, lang }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || emp.full_name_en || '—';
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const dept = departments.find(d => d.id === emp.department_id);
  const deptName = dept ? (isRTL ? dept.name_ar : dept.name_en) : (lang === 'ar' ? '—' : '—');

  const isFormer = emp.is_active === false || emp.deleted_at;
  const statusBadge = isFormer
    ? { color: '#6B7280', label_ar: 'سابق', label_en: 'Former' }
    : emp.employment_type === 'probation'
      ? { color: '#F59E0B', label_ar: 'فترة تجربة', label_en: 'Probation' }
      : { color: '#10B981', label_ar: 'نشط', label_en: 'Active' };

  return (
    <Card className="p-5 md:p-6 mb-5">
      <div className={`flex flex-col sm:flex-row gap-5 ${isRTL ? 'sm:flex-row-reverse text-right' : ''}`}>
        <div
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0 shadow-md"
        >
          <span className="text-2xl font-bold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex flex-wrap items-center gap-2 mb-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h1 className="m-0 text-xl md:text-2xl font-bold text-content dark:text-content-dark truncate">{name}</h1>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: `${statusBadge.color}18`, color: statusBadge.color, border: `1px solid ${statusBadge.color}35` }}
            >
              {isRTL ? statusBadge.label_ar : statusBadge.label_en}
            </span>
          </div>
          <p className="m-0 mb-3 text-sm text-content-muted dark:text-content-muted-dark">
            {emp.position || emp.job_title_ar || emp.job_title_en || (lang === 'ar' ? 'موظف' : 'Employee')}
            {' · '}
            {deptName}
            {emp.employee_id ? ` · ${emp.employee_id}` : ''}
          </p>
          <div className={`flex flex-wrap gap-x-5 gap-y-2 text-xs text-content-muted dark:text-content-muted-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
            {emp.email && (
              <span className={`inline-flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Mail size={13} /> {emp.email}
              </span>
            )}
            {emp.phone && (
              <span className={`inline-flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Phone size={13} /> {emp.phone}
              </span>
            )}
            {emp.hire_date && (
              <span className={`inline-flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Calendar size={13} /> {isRTL ? `تاريخ الانضمام ${emp.hire_date}` : `Joined ${emp.hire_date}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ───── KPI strip ───── */
function KpiStrip({ emp, canViewSalary, isRTL, lang }) {
  const tenureYears = useMemo(() => {
    if (!emp.hire_date) return null;
    const start = new Date(emp.hire_date);
    if (isNaN(start.getTime())) return null;
    const diffMs = Date.now() - start.getTime();
    return (diffMs / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
  }, [emp.hire_date]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
      {canViewSalary && (
        <KpiCard
          icon={DollarSign}
          label={lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}
          value={emp.salary ? `${Number(emp.salary).toLocaleString()} ج.م` : '—'}
          color="#1B3347"
        />
      )}
      <KpiCard
        icon={CalendarDays}
        label={lang === 'ar' ? 'رصيد الإجازة' : 'Leave Balance'}
        value={`${emp.leave_balance ?? '—'} ${lang === 'ar' ? 'يوم' : 'days'}`}
        color="#4A7AAB"
      />
      <KpiCard
        icon={Clock}
        label={lang === 'ar' ? 'مدة العمل' : 'Tenure'}
        value={tenureYears != null ? `${tenureYears} ${lang === 'ar' ? 'سنة' : 'yrs'}` : '—'}
        color="#6B8DB5"
      />
      <KpiCard
        icon={BadgeCheck}
        label={lang === 'ar' ? 'نوع العقد' : 'Contract'}
        value={
          emp.employment_type === 'full_time' ? (lang === 'ar' ? 'دوام كامل' : 'Full Time') :
          emp.employment_type === 'part_time' ? (lang === 'ar' ? 'دوام جزئي' : 'Part Time') :
          emp.employment_type === 'probation' ? (lang === 'ar' ? 'تجربة' : 'Probation') :
          emp.employment_type === 'contract' ? (lang === 'ar' ? 'عقد' : 'Contract') : '—'
        }
        color="#8BA8C8"
      />
    </div>
  );
}

/* ───── Overview tab content ───── */
function OverviewTab({ emp, departments, isRTL, lang, canViewSalary }) {
  const dept = departments.find(d => d.id === emp.department_id);
  const deptName = dept ? (isRTL ? dept.name_ar : dept.name_en) : '—';

  // Personal info section
  const personalRows = [
    { label_ar: 'الاسم بالعربية', label_en: 'Name (AR)', value: emp.full_name_ar },
    { label_ar: 'الاسم بالإنجليزية', label_en: 'Name (EN)', value: emp.full_name_en },
    { label_ar: 'كود الموظف', label_en: 'Employee ID', value: emp.employee_id },
    { label_ar: 'البريد الإلكتروني', label_en: 'Email', value: emp.email },
    { label_ar: 'رقم الجوال', label_en: 'Phone', value: emp.phone },
    { label_ar: 'الرقم القومي', label_en: 'National ID', value: emp.national_id },
  ];

  // Job section
  const jobRows = [
    { label_ar: 'المنصب', label_en: 'Position', value: emp.position || emp.job_title_ar || emp.job_title_en },
    { label_ar: 'القسم', label_en: 'Department', value: deptName },
    { label_ar: 'تاريخ الانضمام', label_en: 'Hire Date', value: emp.hire_date },
    { label_ar: 'انتهاء العقد', label_en: 'Contract End', value: emp.contract_end },
    { label_ar: 'نوع العقد', label_en: 'Employment Type', value: emp.employment_type },
    { label_ar: 'نمط العمل', label_en: 'Work Mode', value: emp.work_mode || emp.work_type },
  ];

  // Compensation summary (gated)
  const compRows = canViewSalary ? [
    { label_ar: 'الراتب الأساسي', label_en: 'Base Salary', value: emp.salary ? `${Number(emp.salary).toLocaleString()} ج.م` : null },
    { label_ar: 'رصيد الإجازة', label_en: 'Leave Balance', value: emp.leave_balance != null ? `${emp.leave_balance} ${lang === 'ar' ? 'يوم' : 'days'}` : null },
    { label_ar: 'الإجازة السنوية', label_en: 'Annual Leave', value: emp.annual_leave_days != null ? `${emp.annual_leave_days} ${lang === 'ar' ? 'يوم' : 'days'}` : null },
  ] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <InfoCard
        title={lang === 'ar' ? 'البيانات الشخصية' : 'Personal Info'}
        icon={User}
        rows={personalRows}
        isRTL={isRTL}
        lang={lang}
      />
      <InfoCard
        title={lang === 'ar' ? 'بيانات الوظيفة' : 'Job Info'}
        icon={Briefcase}
        rows={jobRows}
        isRTL={isRTL}
        lang={lang}
      />
      {compRows.length > 0 && (
        <InfoCard
          title={lang === 'ar' ? 'الراتب' : 'Compensation'}
          icon={DollarSign}
          rows={compRows}
          isRTL={isRTL}
          lang={lang}
        />
      )}
    </div>
  );
}

function InfoCard({ title, icon: Icon, rows, isRTL, lang }) {
  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Icon size={16} className="text-brand-500" />
        <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{title}</p>
      </div>
      <div className="px-5 py-3">
        {rows.map((row, i) => {
          const value = row.value;
          const display = value === null || value === undefined || value === ''
            ? <span className="text-content-muted dark:text-content-muted-dark">—</span>
            : value;
          return (
            <div
              key={i}
              className={`flex items-center justify-between py-2.5 ${i < rows.length - 1 ? 'border-b border-edge/50 dark:border-edge-dark/50' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <span className="text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL ? row.label_ar : row.label_en}
              </span>
              <span className="text-xs font-semibold text-content dark:text-content-dark">{display}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───── Reusable placeholder for tabs we haven't built yet ───── */
function ComingSoonTab({ icon: Icon, title_ar, title_en, desc_ar, desc_en, links = [], isRTL, lang }) {
  return (
    <Card className="p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
        <Icon size={26} className="text-brand-500" />
      </div>
      <p className="m-0 mb-1.5 text-base font-bold text-content dark:text-content-dark">
        {isRTL ? title_ar : title_en}
      </p>
      <p className="m-0 mb-5 text-xs text-content-muted dark:text-content-muted-dark max-w-md mx-auto leading-relaxed">
        {isRTL ? desc_ar : desc_en}
      </p>
      <div className="inline-flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-500/10 text-brand-500 border border-brand-500/30">
          {isRTL ? 'قيد التطوير' : 'Coming soon'}
        </span>
        {links.map((link, i) => (
          <Link
            key={i}
            to={link.to}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ExternalLink size={11} />
            {isRTL ? link.label_ar : link.label_en}
          </Link>
        ))}
      </div>
    </Card>
  );
}
