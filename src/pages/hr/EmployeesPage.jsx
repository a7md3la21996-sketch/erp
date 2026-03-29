import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEmployees, fetchDepartments, createEmployee, updateEmployee, deleteEmployee } from '../../services/employeesService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import {
  Users, Plus, Eye, Edit2, FileText,
  AlertTriangle, Clock, Building2,
  UserCheck, Trash2
} from 'lucide-react';
import { Button, Card, Badge, Modal, ModalFooter, KpiCard, Table, Th, Td, Tr, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';


/* ─── Icon Button ─── */
function IconBtn({ icon: Icon, onClick, color = '#4A7AAB', title }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      className="w-8 h-8 md:w-8 md:h-8 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark"
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
  const { profile } = useAuth();

  const [searchInput, setSearchInput, search] = useDebouncedSearch(300);
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const { auditFields, applyAuditFilters } = useAuditFilter('employee');
  const userName = profile?.full_name_ar || profile?.full_name_en || '';

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchDepartments()])
      .then(([emps, depts]) => { setEmployees(emps); setDepartments(depts); })
      .finally(() => setLoading(false));
  }, []);

  /* ─── Mutation handlers with audit logging ─── */

  const handleCreateEmployee = async (data) => {
    try {
      const result = await createEmployee(data);
      logAction({
        action: 'create',
        entity: 'employee',
        entityId: result.id,
        entityName: result.full_name_ar || result.full_name_en || '',
        description: `Created employee: ${result.full_name_ar || result.full_name_en || ''}`,
        userName,
      });
      setEmployees(prev => [result, ...prev]);
      return result;
    } catch (err) {
      console.error('Create employee failed:', err);
      throw err;
    }
  };

  const handleUpdateEmployee = async (id, updates) => {
    try {
      const old = (employees || []).find(e => e.id === id);
      const result = await updateEmployee(id, updates);
      logAction({
        action: 'update',
        entity: 'employee',
        entityId: id,
        entityName: result.full_name_ar || result.full_name_en || '',
        description: `Updated employee: ${result.full_name_ar || result.full_name_en || ''}`,
        oldValue: old ? JSON.stringify(old) : null,
        newValue: JSON.stringify(result),
        userName,
      });
      setEmployees(prev => prev.map(e => e.id === id ? result : e));
      return result;
    } catch (err) {
      console.error('Update employee failed:', err);
      throw err;
    }
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      const emp = (employees || []).find(e => e.id === id);
      await deleteEmployee(id);
      logAction({
        action: 'delete',
        entity: 'employee',
        entityId: id,
        entityName: emp?.full_name_ar || emp?.full_name_en || '',
        description: `Soft-deleted employee: ${emp?.full_name_ar || emp?.full_name_en || ''}`,
        userName,
      });
      // Soft delete: update status in local state instead of removing
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, is_active: false, deleted_at: new Date().toISOString(), status: 'inactive' } : e));
    } catch (err) {
      console.error('Delete employee failed:', err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const old = (employees || []).find(e => e.id === id);
      const result = await updateEmployee(id, { status: newStatus });
      logAction({
        action: 'status_change',
        entity: 'employee',
        entityId: id,
        entityName: result.full_name_ar || result.full_name_en || '',
        description: `Changed employee status: ${old?.status} → ${newStatus}`,
        oldValue: old?.status,
        newValue: newStatus,
        userName,
      });
      setEmployees(prev => prev.map(e => e.id === id ? result : e));
      return result;
    } catch (err) {
      console.error('Status change failed:', err);
      throw err;
    }
  };

  /* stats */
  const today = new Date();
  const expiring = (employees || []).filter(e => {
    if (!e.contract_end) return false;
    const days = Math.ceil((new Date(e.contract_end) - today) / 864e5);
    return days > 0 && days <= 30;
  });
  const probation = (employees || []).filter(e => e.employment_type === 'probation');
  const active    = (employees || []).filter(e => e.status === 'active');

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
    // Exclude soft-deleted employees unless explicitly filtering for inactive
    let result = (employees || []).filter(e => !e.deleted_at);

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
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{(employees || []).length} {lang === 'ar' ? 'موظف' : 'employees'}</p>
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
          <Button size="md" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />{lang === 'ar' ? '+ موظف جديد' : '+ New Employee'}
          </Button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Users}     label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={(employees || []).length} color="#1B3347" />
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
        search={searchInput}
        onSearchChange={setSearchInput}
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
                      <IconBtn icon={Edit2}   onClick={() => setEditTarget(emp)} title={lang === 'ar' ? 'تعديل' : 'Edit'} />
                      <IconBtn icon={FileText} onClick={() => {}} title={lang === 'ar' ? 'Payslip' : 'Payslip'} color="#6B8DB5" />
                      <IconBtn icon={Trash2}  onClick={() => setDeleteTarget(emp)} title={lang === 'ar' ? 'حذف' : 'Delete'} color="#EF4444" />
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={lang === 'ar' ? 'تأكيد حذف الموظف' : 'Confirm Employee Deletion'} width="max-w-sm">
        {deleteTarget && (
          <>
            <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-red-500/[0.12] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div className="text-start">
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {lang === 'ar' ? 'هل أنت متأكد من حذف هذا الموظف؟' : 'Are you sure you want to delete this employee?'}
                </p>
                <p className="m-0 mt-1 text-xs font-semibold text-red-500">
                  {(isRTL ? deleteTarget.full_name_ar : deleteTarget.full_name_en) || deleteTarget.full_name_ar}
                </p>
              </div>
            </div>
            <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-lg p-3 mb-4">
              <p className="m-0 text-xs text-amber-700 dark:text-amber-400 font-medium mb-1.5">
                {lang === 'ar' ? 'سيتم تعطيل حساب الموظف مع الاحتفاظ بالبيانات التالية:' : 'The employee account will be deactivated. The following data will be preserved:'}
              </p>
              <ul className={`m-0 text-xs text-amber-700 dark:text-amber-400 ${isRTL ? 'pr-4' : 'pl-4'}`} style={{ listStyleType: 'disc' }}>
                <li>{lang === 'ar' ? 'سجلات الحضور والانصراف' : 'Attendance records'}</li>
                <li>{lang === 'ar' ? 'سجلات الإجازات' : 'Leave records'}</li>
                <li>{lang === 'ar' ? 'سجلات الرواتب' : 'Payroll history'}</li>
              </ul>
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={confirmDeleteEmployee}
                disabled={deleting}
                className="!bg-red-500 hover:!bg-red-600 !text-white !border-red-500"
              >
                {deleting
                  ? (lang === 'ar' ? 'جارٍ الحذف...' : 'Deleting...')
                  : (lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete')
                }
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* ── Create / Edit Employee Modal ── */}
      <EmployeeFormModal
        open={showCreateModal || !!editTarget}
        employee={editTarget}
        departments={departments}
        isRTL={isRTL}
        lang={lang}
        onClose={() => { setShowCreateModal(false); setEditTarget(null); }}
        onSave={async (data) => {
          if (editTarget) {
            await handleUpdateEmployee(editTarget.id, data);
          } else {
            await handleCreateEmployee(data);
          }
          setShowCreateModal(false);
          setEditTarget(null);
        }}
      />
    </div>
  );
}

function EmployeeFormModal({ open, employee, departments, isRTL, lang, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useState(() => {
    if (employee) {
      setForm({ ...employee });
    } else {
      setForm({ full_name_ar: '', full_name_en: '', email: '', phone: '', department: '', role: 'sales_agent', salary: '', employment_type: 'full_time', join_date: '' });
    }
  }, [employee, open]);

  // Reset form when modal opens
  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.full_name_ar && !form.full_name_en) return;
    setSaving(true);
    try {
      await onSave(form);
    } catch {} finally {
      setSaving(false);
    }
  };

  const WORK_TYPES = [
    { value: 'full_time', ar: 'دوام كامل', en: 'Full Time' },
    { value: 'part_time', ar: 'دوام جزئي', en: 'Part Time' },
    { value: 'contract', ar: 'عقد', en: 'Contract' },
    { value: 'probation', ar: 'فترة تجربة', en: 'Probation' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={employee ? (lang === 'ar' ? 'تعديل موظف' : 'Edit Employee') : (lang === 'ar' ? 'إضافة موظف' : 'New Employee')} width="max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-1">
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الاسم (عربي)' : 'Name (AR)'}</label>
          <input value={form.full_name_ar || ''} onChange={e => set('full_name_ar', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الاسم (إنجليزي)' : 'Name (EN)'}</label>
          <input value={form.full_name_en || ''} onChange={e => set('full_name_en', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'البريد' : 'Email'}</label>
          <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الهاتف' : 'Phone'}</label>
          <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'القسم' : 'Department'}</label>
          <select value={form.department || ''} onChange={e => set('department', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm">
            <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
            {departments.map(d => <option key={d.id} value={d.id}>{isRTL ? d.name_ar : d.name_en}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'نوع التعاقد' : 'Work Type'}</label>
          <select value={form.employment_type || ''} onChange={e => set('employment_type', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm">
            {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الراتب' : 'Salary'}</label>
          <input type="number" value={form.salary || ''} onChange={e => set('salary', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'تاريخ الالتحاق' : 'Join Date'}</label>
          <input type="date" value={form.join_date || ''} onChange={e => set('join_date', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (employee ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add'))}
        </Button>
      </ModalFooter>
    </Modal>
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
