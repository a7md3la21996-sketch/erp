import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees, fetchDepartments } from '../../services/employeesService';
import {
  Users, Plus, Search, Eye, Edit2, FileText,
  AlertTriangle, Clock, ChevronDown, Building2,
  UserCheck, Briefcase, Shield, X, Check
} from 'lucide-react';
import { Button, Card, Badge, Modal, KpiCard, Table, Th, Td, Tr } from '../../components/ui';
import { Select as UISelect } from '../../components/ui';
import ExportButton from '../../components/ui/ExportButton';


/* ─── Icon Button ─── */
function IconBtn({ icon: Icon, onClick, color = '#4A7AAB', title }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark"
      style={{ '--btn-color': color }}
    >
      <Icon size={14} />
    </button>
  );
}

/* ─── Badge (dynamic color) ─── */
function DynBadge({ label, color = '#4A7AAB' }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

/* ─── Select ─── */
function FilterSelect({ value, onChange, options, isRTL }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none px-3 py-2 pe-8 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] cursor-pointer outline-none transition-colors duration-150 focus:border-brand-500"
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute text-content-muted dark:text-content-muted-dark pointer-events-none" style={{ [isRTL ? 'left' : 'right']: 10 }} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function EmployeesPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang  = i18n.language;

  const [search,  setSearch]  = useState('');
  const [deptF,   setDeptF]   = useState('all');
  const [contractF, setContractF] = useState('all');
  const [view,    setView]    = useState('list');
  const [selected, setSelected] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchEmployees().then(setEmployees);
    fetchDepartments().then(setDepartments);
  }, []);

  /* stats */
  const today = new Date();
  const expiring = employees.filter(e => {
    if (!e.contract_end) return false;
    const days = Math.ceil((new Date(e.contract_end) - today) / 864e5);
    return days > 0 && days <= 30;
  });
  const probation = employees.filter(e => e.employment_type === 'probation');
  const active    = employees.filter(e => e.status === 'active');

  const filtered = useMemo(() => employees.filter(e => {
    const name = (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
                        (e.employee_id || '').toLowerCase().includes(search.toLowerCase());
    const matchDept   = deptF === 'all' || e.department === deptF;
    const matchCont   = contractF === 'all' || e.employment_type === contractF;
    return matchSearch && matchDept && matchCont;
  }), [search, deptF, contractF, isRTL]);

  const deptOptions  = [{ value: 'all', label: lang === 'ar' ? 'كل الأقسام' : 'All Departments' }, ...departments.map(d => ({ value: d.id, label: isRTL ? d.name_ar : d.name_en }))];
  const contractOpts = [{ value: 'all', label: lang === 'ar' ? 'كل العقود' : 'All Contracts' }, { value: 'full_time', label: lang === 'ar' ? 'دوام كامل' : 'Full Time' }, { value: 'part_time', label: lang === 'ar' ? 'دوام جزئي' : 'Part Time' }, { value: 'probation', label: lang === 'ar' ? 'فترة تجربة' : 'Probation' }];

  const statusColor = s => s === 'active' ? '#4A7AAB' : s === 'on_leave' ? '#6B8DB5' : '#94a3b8';
  const statusLabel = s => ({ active: lang === 'ar' ? 'نشط' : 'Active', on_leave: lang === 'ar' ? 'إجازة' : 'On Leave', inactive: lang === 'ar' ? 'غير نشط' : 'Inactive' }[s] || s);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">

      {/* ── Page Header ── */}
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Users size={20} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الموظفين' : 'Employees'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{employees.length} {lang === 'ar' ? 'موظف' : 'employees'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={filtered}
            filename={isRTL ? 'الموظفين' : 'employees'}
            title={isRTL ? 'الموظفين' : 'Employees'}
            columns={[
              { header: isRTL ? 'الاسم' : 'Name', key: r => isRTL ? r.full_name_ar : r.full_name_en },
              { header: isRTL ? 'الوظيفة' : 'Job Title', key: r => isRTL ? r.job_title_ar : r.job_title_en },
              { header: isRTL ? 'القسم' : 'Department', key: 'department' },
              { header: isRTL ? 'الحالة' : 'Status', key: 'status' },
              { header: isRTL ? 'الراتب' : 'Salary', key: 'salary' },
              { header: isRTL ? 'تاريخ التعيين' : 'Hire Date', key: 'hire_date' },
            ]}
          />
          <Button size="md">
            <Plus size={16} />{lang === 'ar' ? '+ موظف جديد' : '+ New Employee'}
          </Button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Users}     label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={employees.length} color="#1B3347" />
        <KpiCard icon={UserCheck} label={lang === 'ar' ? 'نشط'             : 'Active'}           value={active.length}         color="#4A7AAB" />
        <KpiCard icon={Clock}     label={lang === 'ar' ? 'فترة تجربة'      : 'Probation'}        value={probation.length}      color="#6B8DB5" />
        <KpiCard icon={AlertTriangle} label={lang === 'ar' ? 'عقود تنتهي قريباً' : 'Expiring Soon'} value={expiring.length} color="#EF4444" />
      </div>

      {/* ── Alert Banner ── */}
      {expiring.length > 0 && (
        <div className={`bg-red-500/[0.07] border border-red-500/25 rounded-xl px-4 py-3 mb-4 flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <AlertTriangle size={16} color="#EF4444" />
          <span className="text-[13px] text-red-500 font-medium">
            {lang === 'ar' ? `${expiring.length} عقد ينتهي خلال 30 يوم` : `${expiring.length} contract(s) expiring within 30 days`}
            {expiring.map(e => (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar).join('، ')}
          </span>
        </div>
      )}

      {/* ── Toolbar ── */}
      <Card className={`!rounded-xl px-4 py-3.5 mb-4 flex items-center gap-2.5 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-content-muted dark:text-content-muted-dark" style={{ [isRTL ? 'right' : 'left']: 12 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employees...'}
            className="w-full rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] outline-none box-border transition-colors focus:border-brand-500"
            style={{ padding: isRTL ? '8px 36px 8px 12px' : '8px 12px 8px 36px', direction: isRTL ? 'rtl' : 'ltr' }}
          />
        </div>
        <FilterSelect value={deptF}     onChange={setDeptF}     options={deptOptions}  isRTL={isRTL} />
        <FilterSelect value={contractF} onChange={setContractF} options={contractOpts} isRTL={isRTL} />
        <span className="text-xs text-content-muted dark:text-content-muted-dark ms-auto">
          {filtered.length} {lang === 'ar' ? 'نتيجة' : 'results'}
        </span>
      </Card>

      {/* ── Table ── */}
      <Card className="!rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'القسم'  : 'Department',
                lang === 'ar' ? 'نوع العقد' : 'Contract',
                lang === 'ar' ? 'الراتب' : 'Salary',
                lang === 'ar' ? 'رصيد الإجازة' : 'Leave Bal.',
                lang === 'ar' ? 'الحالة' : 'Status',
                '',
              ].map((h, i) => (
                <th key={i} className={`text-[11px] font-bold text-content-muted dark:text-content-muted-dark px-3.5 py-2.5 uppercase tracking-wider whitespace-nowrap ${'text-start'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => {
              const name   = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
              const dept   = departments.find(d => d.id === emp.department);
              const deptName = dept ? (isRTL ? dept.name_ar : dept.name_en) : '—';
              const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
              const avatarColors = ['#1B3347','#2B4C6F','#4A7AAB','#6B8DB5','#8BA8C8'];
              const avatarBg = avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#4A7AAB';

              return (
                <Tr key={emp.id} onClick={() => setSelected(emp)} className="cursor-pointer">
                  <Td>
                    <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: avatarBg }}>
                        <span className="text-[13px] font-bold text-white">{initials}</span>
                      </div>
                      <div className={'text-start'}>
                        <p className="m-0 text-[13px] font-bold text-content dark:text-content-dark">{name}</p>
                        <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">{emp.employee_id || emp.id?.toString().slice(0,6)}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Building2 size={13} className="text-content-muted dark:text-content-muted-dark" />
                      <span className="text-content-muted dark:text-content-muted-dark text-[13px]">{deptName}</span>
                    </div>
                  </Td>
                  <Td>
                    <DynBadge label={emp.employment_type === 'full_time' ? (lang === 'ar' ? 'دوام كامل' : 'Full Time') : emp.employment_type === 'probation' ? (lang === 'ar' ? 'تجربة' : 'Probation') : (lang === 'ar' ? 'جزئي' : 'Part Time')} color={emp.employment_type === 'probation' ? '#6B8DB5' : '#4A7AAB'} />
                  </Td>
                  <Td className="font-bold">
                    {emp.salary ? emp.salary.toLocaleString() + ' ج.م' : '—'}
                  </Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="h-1 w-[50px] rounded-sm bg-gray-200 dark:bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-sm bg-brand-500" style={{ width: Math.min((emp.leave_balance || 21) / 21 * 100, 100) + '%' }} />
                      </div>
                      <span className="text-xs text-content-muted dark:text-content-muted-dark">{emp.leave_balance ?? 21}</span>
                    </div>
                  </Td>
                  <Td>
                    <DynBadge label={statusLabel(emp.status)} color={statusColor(emp.status)} />
                  </Td>
                  <Td>
                    <div className={`flex gap-1.5 justify-end ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <IconBtn icon={Eye}     onClick={() => setSelected(emp)} title={lang === 'ar' ? 'عرض' : 'View'} />
                      <IconBtn icon={Edit2}   onClick={() => {}} title={lang === 'ar' ? 'تعديل' : 'Edit'} />
                      <IconBtn icon={FileText} onClick={() => {}} title={lang === 'ar' ? 'Payslip' : 'Payslip'} color="#6B8DB5" />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-900/[0.08] to-brand-500/[0.12] border-[1.5px] border-dashed border-brand-500/30 flex items-center justify-center mb-4">
              <Users size={28} color="#4A7AAB" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-bold text-content dark:text-content-dark mb-1.5">{lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
            <p className="text-[13px] text-content-muted dark:text-content-muted-dark m-0">{lang === 'ar' ? 'جرّب البحث بكلمات مختلفة' : 'Try different search terms'}</p>
          </div>
        )}
      </Card>

      {/* ── Employee Detail Modal ── */}
      {selected && <EmployeeModal emp={selected} onClose={() => setSelected(null)} isRTL={isRTL} lang={lang} />}
    </div>
  );
}

function EmployeeModal({ emp, onClose, isRTL, lang }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const rows = [
    [lang === 'ar' ? 'كود الموظف' : 'Employee ID', emp.employee_id || '—'],
    [lang === 'ar' ? 'الإيميل' : 'Email', emp.email || '—'],
    [lang === 'ar' ? 'الموبايل' : 'Phone', emp.phone || '—'],
    [lang === 'ar' ? 'الراتب' : 'Salary', emp.salary ? emp.salary.toLocaleString() + ' ج.م' : '—'],
    [lang === 'ar' ? 'نوع العمل' : 'Work Type', emp.work_type || '—'],
    [lang === 'ar' ? 'تاريخ الانضمام' : 'Join Date', emp.hire_date || '—'],
    [lang === 'ar' ? 'انتهاء العقد' : 'Contract End', emp.contract_end || '—'],
    [lang === 'ar' ? 'رصيد الإجازة' : 'Leave Balance', (emp.leave_balance ?? 21) + (lang === 'ar' ? ' يوم' : ' days')],
  ];
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center" onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="bg-surface-card dark:bg-surface-card-dark rounded-2xl w-[480px] max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className={`bg-gradient-to-br from-brand-900 to-brand-500 p-6 rounded-t-2xl flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[52px] h-[52px] rounded-[14px] bg-white/15 flex items-center justify-center shrink-0">
            <span className="text-lg font-extrabold text-white">{initials}</span>
          </div>
          <div className={`flex-1 ${'text-start'}`}>
            <p className="m-0 text-lg font-extrabold text-white">{name}</p>
            <p className="m-0 mt-0.5 text-xs text-white/70">{emp.job_title || (lang === 'ar' ? 'موظف' : 'Employee')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border-none bg-white/15 cursor-pointer flex items-center justify-center">
            <X size={16} color="#fff" />
          </button>
        </div>
        {/* body */}
        <div className="p-5">
          {rows.map(([label, val], i) => (
            <div key={i} className={`flex justify-between py-2.5 ${i < rows.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-[13px] text-content-muted dark:text-content-muted-dark">{label}</span>
              <span className="text-[13px] font-semibold text-content dark:text-content-dark">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
