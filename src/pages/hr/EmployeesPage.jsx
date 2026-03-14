import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees, fetchDepartments } from '../../services/employeesService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import {
  Users, Plus, Eye, Edit2, FileText,
  AlertTriangle, Clock, Building2,
  UserCheck
} from 'lucide-react';
import { Button, Card, Badge, Modal, ModalFooter, KpiCard, Table, Th, Td, Tr, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';


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
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
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
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const { auditFields, applyAuditFilters } = useAuditFilter('employee');

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchDepartments()])
      .then(([emps, depts]) => { setEmployees(emps); setDepartments(depts); })
      .finally(() => setLoading(false));
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

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: departments.map(d => ({ value: d.id, label: d.name_ar, labelEn: d.name_en })),
    },
    {
      id: 'employment_type', label: 'نوع العقد', labelEn: 'Contract Type', type: 'select',
      options: [
        { value: 'full_time', label: 'دوام كامل', labelEn: 'Full Time' },
        { value: 'part_time', label: 'دوام جزئي', labelEn: 'Part Time' },
        { value: 'probation', label: 'فترة تجربة', labelEn: 'Probation' },
      ],
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'active', label: 'نشط', labelEn: 'Active' },
        { value: 'on_leave', label: 'إجازة', labelEn: 'On Leave' },
        { value: 'inactive', label: 'غير نشط', labelEn: 'Inactive' },
      ],
    },
    { id: 'salary', label: 'الراتب', labelEn: 'Salary', type: 'number' },
    { id: 'hire_date', label: 'تاريخ التعيين', labelEn: 'Hire Date', type: 'date' },
    ...auditFields,
  ], [departments, auditFields]);

  const filtered = useMemo(() => {
    let result = employees;

    // Apply smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => {
        const name = (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar || '';
        return name.toLowerCase().includes(q) || (e.employee_id || '').toLowerCase().includes(q);
      });
    }

    return result;
  }, [employees, smartFilters, SMART_FIELDS, search, isRTL]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters]);

  const statusColor = s => s === 'active' ? '#4A7AAB' : s === 'on_leave' ? '#6B8DB5' : '#94a3b8';
  const statusLabel = s => ({ active: lang === 'ar' ? 'نشط' : 'Active', on_leave: lang === 'ar' ? 'إجازة' : 'On Leave', inactive: lang === 'ar' ? 'غير نشط' : 'Inactive' }[s] || s);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis tableRows={6} tableCols={5} />
    </div>
  );

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
          <span className="text-xs text-red-500 font-medium">
            {lang === 'ar' ? `${expiring.length} عقد ينتهي خلال 30 يوم` : `${expiring.length} contract(s) expiring within 30 days`}
            {expiring.map(e => (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar).join('، ')}
          </span>
        </div>
      )}

      {/* ── SmartFilter ── */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employees...'}
        resultsCount={filtered.length}
      />

      {/* ── Table ── */}
      <Table>
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'القسم'  : 'Department',
                lang === 'ar' ? 'نوع العقد' : 'Contract',
                lang === 'ar' ? 'الراتب' : 'Salary',
                lang === 'ar' ? 'رصيد الإجازة' : 'Leave Bal.',
                lang === 'ar' ? 'الحالة' : 'Status',
                '',
              ].map((h, i) => (
                <Th key={i} className="whitespace-nowrap">{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(emp => {
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
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: avatarBg }}>
                        <span className="text-xs font-bold text-white">{initials}</span>
                      </div>
                      <div className={'text-start'}>
                        <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{name}</p>
                        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{emp.employee_id || emp.id?.toString().slice(0,6)}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Building2 size={13} className="text-content-muted dark:text-content-muted-dark" />
                      <span className="text-content-muted dark:text-content-muted-dark text-xs">{deptName}</span>
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
      </Table>
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
            <Users size={28} color="#4A7AAB" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-bold text-content dark:text-content-dark mb-1.5">{lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
          <p className="text-xs text-content-muted dark:text-content-muted-dark m-0">{lang === 'ar' ? 'جرّب البحث بكلمات مختلفة' : 'Try different search terms'}</p>
        </div>
      )}

      {/* ── Employee Detail Modal ── */}
      <EmployeeModal emp={selected} onClose={() => setSelected(null)} isRTL={isRTL} lang={lang} />
    </div>
  );
}

function EmployeeModal({ emp, onClose, isRTL, lang }) {
  if (!emp) return null;
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
    <Modal open={!!emp} onClose={onClose} title={name} width="max-w-md">
      {/* Avatar header */}
      <div className={`flex items-center gap-3.5 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-[52px] h-[52px] rounded-xl bg-brand-500/[0.12] flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-brand-500">{initials}</span>
        </div>
        <div className="text-start">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{name}</p>
          <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">{emp.job_title || (lang === 'ar' ? 'موظف' : 'Employee')}</p>
        </div>
      </div>
      {/* Detail rows */}
      {rows.map(([label, val], i) => (
        <div key={i} className={`flex justify-between py-2.5 ${i < rows.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">{label}</span>
          <span className="text-xs font-semibold text-content dark:text-content-dark">{val}</span>
        </div>
      ))}
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إغلاق' : 'Close'}</Button>
      </ModalFooter>
    </Modal>
  );
}
