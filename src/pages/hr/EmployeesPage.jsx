import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Users, Search, Plus, Filter, ChevronDown,
  Phone, Mail, Calendar, Building2, Briefcase,
  Clock, DollarSign, Eye, Edit2, MoreVertical,
  AlertTriangle, CheckCircle, X, User
} from 'lucide-react';
import {
  MOCK_EMPLOYEES, DEPARTMENTS, CONTRACT_TYPES, WORK_TYPES,
  getEmployeeName, calcYearsOfService, calcLeaveBalance,
  isProbationEndingSoon, isContractEndingSoon,
  MOCK_HR_POLICIES
} from '../../data/hr_mock_data';

// ── Helper ────────────────────────────────────────────────────
function getPolicyValue(key) {
  const p = MOCK_HR_POLICIES.find(p => p.key === key);
  return p ? parseFloat(p.value) : null;
}

function Avatar({ employee, size = 40 }) {
  const initials = employee.full_name_ar.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: employee.avatar_color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function StatusBadge({ employee, lang }) {
  const probMonths = getPolicyValue('probation_months') || 3;
  const alertDays = getPolicyValue('probation_end_alert_days') || 7;
  const contractAlert = getPolicyValue('contract_expiry_alert_days') || 30;

  if (isProbationEndingSoon(employee.hire_date, probMonths, alertDays)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#F59E0B20', color: '#F59E0B' }}>
        <AlertTriangle size={10} /> {lang === 'ar' ? 'فترة تجربة تنتهي قريباً' : 'Probation Ending'}
      </span>
    );
  }
  if (isContractEndingSoon(employee.contract_end_date, contractAlert)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#EF444420', color: '#EF4444' }}>
        <AlertTriangle size={10} /> {lang === 'ar' ? 'عقد ينتهي قريباً' : 'Contract Ending'}
      </span>
    );
  }
  if (employee.contract_type === 'probation') {
    return (
      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#EF444420', color: '#EF4444' }}>
        {lang === 'ar' ? 'فترة تجربة' : 'Probation'}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#10B98120', color: '#10B981' }}>
      <CheckCircle size={10} /> {lang === 'ar' ? 'نشط' : 'Active'}
    </span>
  );
}

// ── Employee Detail Modal ─────────────────────────────────────
function EmployeeModal({ employee, onClose, isDark, isRTL, lang, c }) {
  if (!employee) return null;

  const years = calcYearsOfService(employee.hire_date);
  const leaveInfo = calcLeaveBalance(
    employee.hire_date,
    getPolicyValue('annual_leave_year1') || 15,
    getPolicyValue('annual_leave_year2') || 21,
    getPolicyValue('probation_months') || 3
  );
  const hourlyRate = (employee.base_salary / (getPolicyValue('hourly_rate_divisor') || 240)).toFixed(2);
  const manager = MOCK_EMPLOYEES.find(e => e.id === employee.direct_manager_id);

  const InfoRow = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.15)' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color="#4A7AAB" />
      </div>
      <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
        <div style={{ fontSize: 11, color: c.textMuted }}>{label}</div>
        <div style={{ fontSize: 14, color: c.text, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Avatar employee={employee} size={52} />
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: c.text }}>
                {lang === 'ar' ? employee.full_name_ar : employee.full_name_en}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
                {lang === 'ar' ? employee.job_title_ar : employee.job_title_en} · {employee.employee_number}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '16px 24px' }}>
          {[
            { label: lang === 'ar' ? 'سنوات الخدمة' : 'Years of Service', value: years < 1 ? (lang === 'ar' ? `${Math.floor(years * 12)} شهر` : `${Math.floor(years * 12)} mo`) : `${years.toFixed(1)}`, icon: '📅' },
            { label: lang === 'ar' ? 'رصيد الإجازة' : 'Leave Balance', value: leaveInfo.inProbation ? (lang === 'ar' ? 'في التجربة' : 'Probation') : `${leaveInfo.balance} ${lang === 'ar' ? 'يوم' : 'days'}`, icon: '🏖️' },
            { label: lang === 'ar' ? 'الأجر الساعي' : 'Hourly Rate', value: `${hourlyRate} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, icon: '💰' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '12px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: c.textMuted }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ padding: '0 24px 24px' }}>
          <InfoRow icon={Mail}      label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}         value={employee.email} />
          <InfoRow icon={Phone}     label={lang === 'ar' ? 'الهاتف' : 'Phone'}                    value={employee.phone} />
          <InfoRow icon={Building2} label={lang === 'ar' ? 'القسم' : 'Department'}               value={DEPARTMENTS.find(d => d.id === employee.department)?.[`name_${lang}`] || employee.department} />
          <InfoRow icon={Briefcase} label={lang === 'ar' ? 'نوع العقد' : 'Contract Type'}        value={CONTRACT_TYPES[employee.contract_type]?.[lang] || employee.contract_type} />
          <InfoRow icon={User}      label={lang === 'ar' ? 'نوع العمل' : 'Work Type'}             value={`${WORK_TYPES[employee.work_type]?.icon} ${WORK_TYPES[employee.work_type]?.[lang] || employee.work_type}`} />
          <InfoRow icon={Calendar}  label={lang === 'ar' ? 'تاريخ التعيين' : 'Hire Date'}        value={new Date(employee.hire_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} />
          <InfoRow icon={DollarSign} label={lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}    value={`${employee.base_salary.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} />
          <InfoRow icon={Clock}     label={lang === 'ar' ? 'مضاعف الأوفرتايم' : 'OT Multiplier'} value={employee.ot_multiplier} />
          <InfoRow icon={Clock}     label={lang === 'ar' ? 'ساعات التسامح الشهرية' : 'Monthly Tolerance'} value={`${employee.tolerance_hours} ${lang === 'ar' ? 'ساعات' : 'hours'}`} />
          {manager && (
            <InfoRow icon={User} label={lang === 'ar' ? 'المدير المباشر' : 'Direct Manager'} value={lang === 'ar' ? manager.full_name_ar : manager.full_name_en} />
          )}
          {employee.notes && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', border: '1px solid ' + (isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A') }}>
              <p style={{ margin: 0, fontSize: 13, color: isDark ? '#F59E0B' : '#92400E' }}>
                📝 {employee.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function EmployeesPage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

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

  const filtered = MOCK_EMPLOYEES.filter(emp => {
    const matchSearch = !search ||
      emp.full_name_ar.includes(search) ||
      emp.full_name_en.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_number.includes(search) ||
      emp.email.includes(search);
    const matchDept = deptFilter === 'all' || emp.department === deptFilter;
    const matchContract = contractFilter === 'all' || emp.contract_type === contractFilter;
    return matchSearch && matchDept && matchContract;
  });

  // Alerts
  const probMonths = getPolicyValue('probation_months') || 3;
  const probAlertDays = getPolicyValue('probation_end_alert_days') || 7;
  const contractAlertDays = getPolicyValue('contract_expiry_alert_days') || 30;
  const alerts = MOCK_EMPLOYEES.filter(e =>
    isProbationEndingSoon(e.hire_date, probMonths, probAlertDays) ||
    isContractEndingSoon(e.contract_end_date, contractAlertDays)
  );

  // Stats
  const stats = [
    { label: lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees', value: MOCK_EMPLOYEES.length, icon: '👥', color: '#2B4C6F' },
    { label: lang === 'ar' ? 'نشط' : 'Active', value: MOCK_EMPLOYEES.filter(e => e.status === 'active').length, icon: '✅', color: '#10B981' },
    { label: lang === 'ar' ? 'فترة تجربة' : 'Probation', value: MOCK_EMPLOYEES.filter(e => e.contract_type === 'probation').length, icon: '⏳', color: '#F59E0B' },
    { label: lang === 'ar' ? 'تنبيهات' : 'Alerts', value: alerts.length, icon: '🔔', color: '#EF4444' },
  ];

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? 'الموظفين' : 'Employees'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
              {MOCK_EMPLOYEES.length} {lang === 'ar' ? 'موظف' : 'employees'}
            </p>
          </div>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
          borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', color: '#fff',
          fontSize: 14, fontWeight: 500, flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          <Plus size={16} />
          {lang === 'ar' ? 'موظف جديد' : 'New Employee'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ padding: '16px 20px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>{stat.label}</div>
              </div>
              <span style={{ fontSize: 28 }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.2)' : '#FECACA') }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <AlertTriangle size={16} color="#EF4444" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#EF4444' }}>
              {lang === 'ar' ? `${alerts.length} تنبيه يحتاج انتباهك` : `${alerts.length} alert(s) need attention`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {alerts.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployee(emp)}
                style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EF444420', color: '#EF4444', fontSize: 12, fontWeight: 500 }}
              >
                {lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employee...'}
            style={{
              width: '100%', padding: isRTL ? '10px 40px 10px 14px' : '10px 14px 10px 40px',
              borderRadius: 8, border: '1px solid ' + c.border,
              background: c.inputBg, color: c.text, fontSize: 14,
              outline: 'none', boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr',
            }}
          />
        </div>

        {/* Department Filter */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}
        </select>

        {/* Contract Filter */}
        <select
          value={contractFilter}
          onChange={e => setContractFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">{lang === 'ar' ? 'كل العقود' : 'All Contracts'}</option>
          {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
        </select>
      </div>

      {/* Employees Table */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[
                { ar: 'الموظف', en: 'Employee', w: 'auto' },
                { ar: 'القسم', en: 'Department', w: '130px' },
                { ar: 'نوع العقد', en: 'Contract', w: '120px' },
                { ar: 'نوع العمل', en: 'Work Type', w: '100px' },
                { ar: 'الراتب', en: 'Salary', w: '110px' },
                { ar: 'رصيد الإجازة', en: 'Leave', w: '100px' },
                { ar: 'الحالة', en: 'Status', w: '150px' },
                { ar: '', en: '', w: '50px' },
              ].map((col, i) => (
                <th key={i} style={{
                  padding: '12px 16px', textAlign: isRTL ? 'right' : 'left',
                  fontSize: 12, fontWeight: 600, color: c.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w,
                }}>
                  {lang === 'ar' ? col.ar : col.en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, idx) => {
              const dept = DEPARTMENTS.find(d => d.id === emp.department);
              const contract = CONTRACT_TYPES[emp.contract_type];
              const workType = WORK_TYPES[emp.work_type];
              const leaveInfo = calcLeaveBalance(
                emp.hire_date,
                getPolicyValue('annual_leave_year1') || 15,
                getPolicyValue('annual_leave_year2') || 21,
                getPolicyValue('probation_months') || 3
              );

              return (
                <tr
                  key={emp.id}
                  style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedEmployee(emp)}
                >
                  {/* Employee */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <Avatar employee={emp} size={38} />
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                          {lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
                        </div>
                        <div style={{ fontSize: 12, color: c.textMuted }}>
                          {lang === 'ar' ? emp.job_title_ar : emp.job_title_en} · {emp.employee_number}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Department */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 13, color: c.text }}>
                      {lang === 'ar' ? dept?.name_ar : dept?.name_en}
                    </span>
                  </td>

                  {/* Contract */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: contract?.color + '20', color: contract?.color }}>
                      {lang === 'ar' ? contract?.ar : contract?.en}
                    </span>
                  </td>

                  {/* Work Type */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 13, color: c.textMuted }}>
                      {workType?.icon} {lang === 'ar' ? workType?.ar : workType?.en}
                    </span>
                  </td>

                  {/* Salary */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                      {emp.base_salary.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: c.textMuted }}> {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </td>

                  {/* Leave Balance */}
                  <td style={{ padding: '14px 16px' }}>
                    {leaveInfo.inProbation ? (
                      <span style={{ fontSize: 12, color: c.textMuted }}>—</span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#10B98120', color: '#10B981' }}>
                        {leaveInfo.balance} {lang === 'ar' ? 'يوم' : 'days'}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge employee={emp} lang={lang} />
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: c.textMuted }}>
            <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا يوجد موظفين' : 'No employees found'}</p>
          </div>
        )}
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
          c={c}
        />
      )}
    </div>
  );
}
