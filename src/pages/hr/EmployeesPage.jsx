import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees, fetchDepartments, createEmployee, updateEmployee, deleteEmployee } from '../../services/employeesService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import {
  Users, Plus, Eye, Edit2, FileText,
  AlertTriangle, Clock, Building2,
  UserCheck, Trash2, CheckSquare
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [viewMode, setViewMode] = useState('active'); // active | former
  const [showBulkShift, setShowBulkShift] = useState(false);

  const { auditFields, applyAuditFilters } = useAuditFilter('employee');
  const userName = profile?.full_name_ar || profile?.full_name_en || '';

  const loadEmployees = () => {
    setLoading(true);
    Promise.all([
      fetchEmployees({ includeDeleted: true }),
      fetchDepartments(),
    ]).then(([all, depts]) => {
      setEmployees(all);
      setDepartments(depts);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadEmployees(); }, []);

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
      if (import.meta.env.DEV) console.error('Create employee failed:', err);
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
      if (import.meta.env.DEV) console.error('Update employee failed:', err);
      throw err;
    }
  };

  const handleTerminate = async (terminationData) => {
    const id = terminateTarget.id;
    try {
      const result = await updateEmployee(id, {
        status: 'terminated',
        is_active: false,
        termination_date: terminationData.date,
        termination_reason: terminationData.reason,
        termination_notes: terminationData.notes,
        deleted_at: new Date().toISOString(),
      });
      logAction({
        action: 'terminate',
        entity: 'employee',
        entityId: id,
        entityName: terminateTarget.full_name_ar || terminateTarget.full_name_en || '',
        description: `Terminated: ${terminationData.reason} — ${terminateTarget.full_name_ar || ''}`,
        userName,
      });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...result, is_active: false, status: 'terminated' } : e));
      setTerminateTarget(null);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Terminate failed:', err);
    }
  };

  const handleReinstate = async (emp) => {
    if (!window.confirm(lang === 'ar' ? `إعادة تعيين ${emp.full_name_ar || emp.full_name_en}؟` : `Reinstate ${emp.full_name_en || emp.full_name_ar}?`)) return;
    try {
      const result = await updateEmployee(emp.id, {
        status: 'active',
        is_active: true,
        termination_date: null,
        termination_reason: null,
        termination_notes: null,
        deleted_at: null,
      });
      logAction({
        action: 'reinstate',
        entity: 'employee',
        entityId: emp.id,
        entityName: emp.full_name_ar || emp.full_name_en || '',
        description: `Reinstated employee: ${emp.full_name_ar || ''}`,
        userName,
      });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, ...result, is_active: true, status: 'active' } : e));
    } catch {}
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
      if (import.meta.env.DEV) console.error('Status change failed:', err);
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
      options: (departments || []).map(d => ({ value: d.id, label: d.name_ar, labelEn: d.name_en })),
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

  const activeCount = (employees || []).filter(e => e.is_active !== false).length;
  const formerCount = (employees || []).filter(e => e.is_active === false || e.status === 'terminated').length;

  const filtered = useMemo(() => {
    let result = (employees || []);
    // Filter by view mode
    if (viewMode === 'active') {
      result = result.filter(e => e.is_active !== false);
    } else {
      result = result.filter(e => e.is_active === false || e.status === 'terminated');
    }

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
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen pb-16">

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

      {/* ── Bulk Selection Bar ── */}
      {selectedIds.length > 0 && (
        <div className={`flex items-center gap-3 mb-3 px-4 py-2.5 rounded-xl border border-brand-500/30 bg-brand-500/[0.07] ${isRTL ? 'flex-row-reverse' : ''}`}>
          <CheckSquare size={16} className="text-brand-500" />
          <span className="text-sm font-semibold text-brand-500">
            {lang === 'ar' ? `تم تحديد ${selectedIds.length} موظف` : `${selectedIds.length} selected`}
          </span>
          <Button size="sm" onClick={() => setShowBulkEdit(true)}>
            {lang === 'ar' ? 'تعديل جماعي' : 'Bulk Edit'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowBulkShift(true)}>
            {lang === 'ar' ? 'تعيين شيفت' : 'Assign Shift'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
            {lang === 'ar' ? 'إلغاء التحديد' : 'Deselect All'}
          </Button>
        </div>
      )}

      {/* ── Active / Former Tabs ── */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setViewMode('active'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'active' ? 'bg-brand-500 text-white' : 'bg-surface dark:bg-surface-dark text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark'}`}
        >
          {lang === 'ar' ? 'موظفين حاليين' : 'Active'} ({activeCount})
        </button>
        <button
          onClick={() => { setViewMode('former'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'former' ? 'bg-red-500 text-white' : 'bg-surface dark:bg-surface-dark text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark'}`}
        >
          {lang === 'ar' ? 'موظفين سابقين' : 'Former'} ({formerCount})
        </button>
      </div>

      {/* ── Table ── */}
      <Table>
          <thead>
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={paged.length > 0 && paged.every(e => selectedIds.includes(e.id))}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedIds(prev => [...new Set([...prev, ...paged.map(emp => emp.id)])]);
                    } else {
                      const pageIds = paged.map(emp => emp.id);
                      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
                    }
                  }}
                  className="w-4 h-4 rounded border-edge cursor-pointer accent-brand-500"
                />
              </Th>
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
              const dept   = (departments || []).find(d => d.id === emp.department);
              const deptName = dept ? (isRTL ? dept.name_ar : dept.name_en) : '—';
              const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
              const avatarColors = ['#1B3347','#2B4C6F','#4A7AAB','#6B8DB5','#8BA8C8'];
              const avatarBg = avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#4A7AAB';

              return (
                <Tr key={emp.id} onClick={() => setSelected(emp)} className="cursor-pointer">
                  <Td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(emp.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, emp.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== emp.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-edge cursor-pointer accent-brand-500"
                    />
                  </Td>
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
                      {emp.is_active !== false ? (
                        <IconBtn icon={Trash2} onClick={() => setTerminateTarget(emp)} title={lang === 'ar' ? 'إنهاء خدمة' : 'Terminate'} color="#EF4444" />
                      ) : (
                        <IconBtn icon={UserCheck} onClick={() => handleReinstate(emp)} title={lang === 'ar' ? 'إعادة تعيين' : 'Reinstate'} color="#22C55E" />
                      )}
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

      {/* ── Termination Modal ── */}
      {terminateTarget && (
        <TerminationModal
          emp={terminateTarget}
          onClose={() => setTerminateTarget(null)}
          onConfirm={handleTerminate}
          lang={lang}
          isRTL={isRTL}
        />
      )}

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

      {/* ── Bulk Edit Modal ── */}
      <BulkEditModal
        open={showBulkEdit}
        selectedIds={selectedIds}
        isRTL={isRTL}
        lang={lang}
        onClose={() => setShowBulkEdit(false)}
        onSave={async (fields) => {
          for (const id of selectedIds) {
            await handleUpdateEmployee(id, fields);
          }
          setSelectedIds([]);
          setShowBulkEdit(false);
        }}
      />

      {/* ── Bulk Shift Assignment Modal ── */}
      {showBulkShift && (
        <BulkShiftModal
          open={showBulkShift}
          selectedIds={selectedIds}
          lang={lang}
          isRTL={isRTL}
          onClose={() => setShowBulkShift(false)}
          onDone={() => { setShowBulkShift(false); setSelectedIds([]); loadEmployees(); }}
        />
      )}
    </div>
  );
}

function EmployeeFormModal({ open, employee, departments, isRTL, lang, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    if (open) {
      import('../../services/shiftsService').then(({ fetchShifts }) => {
        fetchShifts().then(setShifts);
      });
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (employee) {
        setForm({ ...employee });
      } else {
        setForm({
          full_name_ar: '', full_name_en: '', email: '', phone: '', department: '',
          job_title_ar: '', employment_type: 'full_time', join_date: '', fingerprint_id: '',
          salary: '', allowance_rate: '', allowance_fixed: '', tax_rate: '', insurance_rate: '',
          tax_exempt: false, insurance_exempt: false,
          shift_id: '', shift_name: '', work_start: '', work_end: '', late_threshold: '', work_mode: 'office',
          annual_leave_days: 21, leave_balance: 21, deduct_absence_from_leave: false,
          monthly_grace_hours: 0, grace_hours_enabled: false,
          overtime_enabled: false, overtime_rate: 1.5,
        });
      }
    }
  }, [employee, open]);

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

  const inputCls = "w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm";
  const labelCls = "block text-xs text-content-muted dark:text-content-muted-dark mb-1";
  const sectionCls = "text-sm font-bold text-content dark:text-content-dark mb-3 mt-5 pb-2 border-b border-edge dark:border-edge-dark";

  return (
    <Modal open={open} onClose={onClose} title={employee ? (lang === 'ar' ? 'تعديل موظف' : 'Edit Employee') : (lang === 'ar' ? 'إضافة موظف' : 'New Employee')} width="max-w-2xl">
      <div className="p-1 max-h-[70vh] overflow-y-auto">

        {/* ── Section 1: Basic Info ── */}
        <h3 className={sectionCls}>{lang === 'ar' ? 'بيانات أساسية' : 'Basic Info'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'الاسم بالعربي' : 'Name (AR)'}</label>
            <input value={form.full_name_ar || ''} onChange={e => set('full_name_ar', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'الاسم بالإنجليزي' : 'Name (EN)'}</label>
            <input value={form.full_name_en || ''} onChange={e => set('full_name_en', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'البريد' : 'Email'}</label>
            <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'الهاتف' : 'Phone'}</label>
            <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'القسم' : 'Department'}</label>
            <select value={form.department || form.department_id || ''} onChange={e => { set('department', e.target.value); set('department_id', e.target.value); }} className={inputCls}>
              <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
              {(departments || []).map(d => <option key={d.id} value={d.id}>{isRTL ? d.name_ar : d.name_en}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}</label>
            <input value={form.job_title_ar || ''} onChange={e => set('job_title_ar', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'نوع التعاقد' : 'Employment Type'}</label>
            <select value={form.employment_type || ''} onChange={e => set('employment_type', e.target.value)} className={inputCls}>
              {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'تاريخ الالتحاق' : 'Hire Date'}</label>
            <input type="date" value={form.join_date || form.hire_date || ''} onChange={e => set('join_date', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'كود البصمة' : 'Fingerprint ID'}</label>
            <input value={form.fingerprint_id || ''} onChange={e => set('fingerprint_id', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* ── Section 2: Salary & Deductions ── */}
        <h3 className={sectionCls}>{lang === 'ar' ? 'المرتب والخصومات' : 'Salary & Deductions'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</label>
            <input type="number" value={form.salary ?? ''} onChange={e => set('salary', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'نسبة البدلات %' : 'Allowance Rate %'}</label>
            <input type="number" value={form.allowance_rate ?? ''} onChange={e => set('allowance_rate', e.target.value)} placeholder={lang === 'ar' ? 'اتركه فارغ للقيمة الافتراضية' : 'Leave empty for default'} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'أو بدلات مبلغ ثابت' : 'Or Fixed Allowance'}</label>
            <input type="number" value={form.allowance_fixed ?? ''} onChange={e => set('allowance_fixed', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'نسبة الضرايب %' : 'Tax Rate %'}</label>
            <input type="number" value={form.tax_rate ?? ''} onChange={e => set('tax_rate', e.target.value)} placeholder={lang === 'ar' ? 'افتراضي 14%' : 'Default 14%'} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'نسبة التأمينات %' : 'Insurance Rate %'}</label>
            <input type="number" value={form.insurance_rate ?? ''} onChange={e => set('insurance_rate', e.target.value)} placeholder={lang === 'ar' ? 'افتراضي 11%' : 'Default 11%'} className={inputCls} />
          </div>
          <div className="flex items-center gap-6 sm:col-span-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.tax_exempt} onChange={e => set('tax_exempt', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              <span className="text-xs text-content dark:text-content-dark">{lang === 'ar' ? 'إعفاء من الضرايب' : 'Tax Exempt'}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.insurance_exempt} onChange={e => set('insurance_exempt', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              <span className="text-xs text-content dark:text-content-dark">{lang === 'ar' ? 'إعفاء من التأمينات' : 'Insurance Exempt'}</span>
            </label>
          </div>
        </div>

        {/* ── Section 3: Work Schedule ── */}
        <h3 className={sectionCls}>{lang === 'ar' ? 'الدوام' : 'Work Schedule'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'فترة الدوام' : 'Shift'}</label>
            <select
              value={form.shift_id || ''}
              onChange={e => {
                const s = shifts.find(sh => sh.id === e.target.value);
                set('shift_id', e.target.value);
                if (s) {
                  set('shift_name', s.name);
                  set('work_start', s.official_start);
                  set('work_end', s.official_end);
                  set('late_threshold', s.late_threshold);
                }
              }}
              className={inputCls}
            >
              <option value="">{lang === 'ar' ? 'اختر فترة...' : 'Select shift...'}</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>{isRTL ? (s.name_ar || s.name) : s.name} ({s.official_start} - {s.official_end})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'ساعة البداية' : 'Work Start'}</label>
            <input type="time" value={form.work_start || ''} onChange={e => set('work_start', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'ساعة النهاية' : 'Work End'}</label>
            <input type="time" value={form.work_end || ''} onChange={e => set('work_end', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'حد التأخير' : 'Late Threshold'}</label>
            <input type="time" value={form.late_threshold || ''} onChange={e => set('late_threshold', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'مكان العمل' : 'Work Mode'}</label>
            <select value={form.work_mode || 'office'} onChange={e => set('work_mode', e.target.value)} className={inputCls}>
              <option value="office">{lang === 'ar' ? 'من الشركة' : 'Office'}</option>
              <option value="remote">{lang === 'ar' ? 'من البيت' : 'Remote'}</option>
              <option value="flexible">{lang === 'ar' ? 'مرن' : 'Flexible'}</option>
            </select>
          </div>
        </div>

        {/* Section 4: Leave & Attendance Policy */}
        <h3 className={sectionCls}>{lang === 'ar' ? 'الإجازات والحضور' : 'Leave & Attendance'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'الإجازات السنوية (أيام)' : 'Annual Leave Days'}</label>
            <input type="number" value={form.annual_leave_days ?? 21} onChange={e => set('annual_leave_days', +e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'الرصيد المتبقي' : 'Leave Balance'}</label>
            <input type="number" step="0.5" value={form.leave_balance ?? 21} onChange={e => set('leave_balance', +e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'ساعات السماح الشهرية' : 'Monthly Grace Hours'}</label>
            <input type="number" step="0.5" value={form.monthly_grace_hours ?? 0} onChange={e => set('monthly_grace_hours', +e.target.value)} className={inputCls}
              placeholder={lang === 'ar' ? 'مثلاً 4 ساعات' : 'e.g. 4 hours'} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'ar' ? 'نسبة الأوفرتايم' : 'Overtime Rate'}</label>
            <input type="number" step="0.1" value={form.overtime_rate ?? 1.5} onChange={e => set('overtime_rate', +e.target.value)} className={inputCls}
              placeholder="1.5" />
          </div>
          <div className="col-span-full flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.deduct_absence_from_leave} onChange={e => set('deduct_absence_from_leave', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              <span className="text-xs text-content dark:text-content-dark">{lang === 'ar' ? 'خصم الغياب من رصيد الإجازات' : 'Deduct absence from leave balance'}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.grace_hours_enabled} onChange={e => set('grace_hours_enabled', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              <span className="text-xs text-content dark:text-content-dark">{lang === 'ar' ? 'تفعيل ساعات السماح' : 'Enable grace hours'}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.overtime_enabled} onChange={e => set('overtime_enabled', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              <span className="text-xs text-content dark:text-content-dark">{lang === 'ar' ? 'تفعيل الأوفرتايم' : 'Enable overtime pay'}</span>
            </label>
          </div>
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

/* ─── Bulk Edit Modal ─── */
function BulkEditModal({ open, selectedIds, isRTL, lang, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [enabled, setEnabled] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        salary: '', allowance_rate: '', allowance_fixed: '', tax_rate: '', insurance_rate: '',
        tax_exempt: false, insurance_exempt: false,
        shift_name: '', work_start: '', work_end: '', late_threshold: '', is_remote: false,
      });
      setEnabled({});
    }
  }, [open]);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k) => setEnabled(prev => ({ ...prev, [k]: !prev[k] }));

  const handleSubmit = async () => {
    const fields = {};
    Object.keys(enabled).forEach(k => {
      if (enabled[k]) fields[k] = form[k];
    });
    if (Object.keys(fields).length === 0) return;
    setSaving(true);
    try {
      await onSave(fields);
    } catch {} finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm";
  const labelCls = "block text-xs text-content-muted dark:text-content-muted-dark mb-1";
  const sectionCls = "text-sm font-bold text-content dark:text-content-dark mb-3 mt-5 pb-2 border-b border-edge dark:border-edge-dark";
  const disabledCls = "opacity-40 pointer-events-none";

  const fieldRow = (key, label, input) => (
    <div key={key}>
      <div className="flex items-center gap-2 mb-1">
        <input
          type="checkbox"
          checked={!!enabled[key]}
          onChange={() => toggle(key)}
          className="w-3.5 h-3.5 rounded border-edge accent-brand-500 cursor-pointer"
        />
        <label className={labelCls + ' !mb-0'}>{label}</label>
      </div>
      <div className={!enabled[key] ? disabledCls : ''}>
        {input}
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={lang === 'ar' ? `تعديل جماعي (${selectedIds.length} موظف)` : `Bulk Edit (${selectedIds.length} employees)`} width="max-w-2xl">
      <div className="p-1 max-h-[70vh] overflow-y-auto">
        <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3 mb-4">
          <p className="m-0 text-xs text-amber-700 dark:text-amber-400 font-medium">
            {lang === 'ar'
              ? 'فعّل الحقول اللي عايز تعدلها فقط. الحقول المفعّلة هتتطبق على كل الموظفين المحددين.'
              : 'Enable only the fields you want to change. Enabled fields will be applied to all selected employees.'}
          </p>
        </div>

        {/* ── Salary & Deductions ── */}
        <h3 className={sectionCls}>{lang === 'ar' ? 'المرتب والخصومات' : 'Salary & Deductions'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {fieldRow('salary', lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary',
            <input type="number" value={form.salary ?? ''} onChange={e => set('salary', e.target.value)} className={inputCls} />
          )}
          {fieldRow('allowance_rate', lang === 'ar' ? 'نسبة البدلات %' : 'Allowance Rate %',
            <input type="number" value={form.allowance_rate ?? ''} onChange={e => set('allowance_rate', e.target.value)} placeholder={lang === 'ar' ? 'اتركه فارغ للقيمة الافتراضية' : 'Leave empty for default'} className={inputCls} />
          )}
          {fieldRow('allowance_fixed', lang === 'ar' ? 'بدلات مبلغ ثابت' : 'Fixed Allowance',
            <input type="number" value={form.allowance_fixed ?? ''} onChange={e => set('allowance_fixed', e.target.value)} className={inputCls} />
          )}
          {fieldRow('tax_rate', lang === 'ar' ? 'نسبة الضرايب %' : 'Tax Rate %',
            <input type="number" value={form.tax_rate ?? ''} onChange={e => set('tax_rate', e.target.value)} placeholder={lang === 'ar' ? 'افتراضي 14%' : 'Default 14%'} className={inputCls} />
          )}
          {fieldRow('insurance_rate', lang === 'ar' ? 'نسبة التأمينات %' : 'Insurance Rate %',
            <input type="number" value={form.insurance_rate ?? ''} onChange={e => set('insurance_rate', e.target.value)} placeholder={lang === 'ar' ? 'افتراضي 11%' : 'Default 11%'} className={inputCls} />
          )}
          <div className="flex items-center gap-6 sm:col-span-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!enabled.tax_exempt} onChange={() => toggle('tax_exempt')} className="w-3.5 h-3.5 rounded border-edge accent-brand-500" />
              <span className={`text-xs ${!enabled.tax_exempt ? 'text-content-muted dark:text-content-muted-dark' : 'text-content dark:text-content-dark'}`}>
                {lang === 'ar' ? 'إعفاء من الضرايب' : 'Tax Exempt'}
              </span>
              {enabled.tax_exempt && (
                <input type="checkbox" checked={!!form.tax_exempt} onChange={e => set('tax_exempt', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              )}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!enabled.insurance_exempt} onChange={() => toggle('insurance_exempt')} className="w-3.5 h-3.5 rounded border-edge accent-brand-500" />
              <span className={`text-xs ${!enabled.insurance_exempt ? 'text-content-muted dark:text-content-muted-dark' : 'text-content dark:text-content-dark'}`}>
                {lang === 'ar' ? 'إعفاء من التأمينات' : 'Insurance Exempt'}
              </span>
              {enabled.insurance_exempt && (
                <input type="checkbox" checked={!!form.insurance_exempt} onChange={e => set('insurance_exempt', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              )}
            </label>
          </div>
        </div>

        {/* ── Work Schedule ── */}
        <h3 className={sectionCls}>{lang === 'ar' ? 'الدوام' : 'Work Schedule'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {fieldRow('shift_name', lang === 'ar' ? 'فترة الدوام' : 'Shift Name',
            <input value={form.shift_name || ''} onChange={e => set('shift_name', e.target.value)} className={inputCls} />
          )}
          {fieldRow('work_start', lang === 'ar' ? 'ساعة البداية' : 'Work Start',
            <input type="time" value={form.work_start || ''} onChange={e => set('work_start', e.target.value)} className={inputCls} />
          )}
          {fieldRow('work_end', lang === 'ar' ? 'ساعة النهاية' : 'Work End',
            <input type="time" value={form.work_end || ''} onChange={e => set('work_end', e.target.value)} className={inputCls} />
          )}
          {fieldRow('late_threshold', lang === 'ar' ? 'حد التأخير' : 'Late Threshold',
            <input type="time" value={form.late_threshold || ''} onChange={e => set('late_threshold', e.target.value)} className={inputCls} />
          )}
          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!enabled.is_remote} onChange={() => toggle('is_remote')} className="w-3.5 h-3.5 rounded border-edge accent-brand-500" />
              <span className={`text-xs ${!enabled.is_remote ? 'text-content-muted dark:text-content-muted-dark' : 'text-content dark:text-content-dark'}`}>
                {lang === 'ar' ? 'شغل من البيت' : 'Remote Work'}
              </span>
              {enabled.is_remote && (
                <input type="checkbox" checked={!!form.is_remote} onChange={e => set('is_remote', e.target.checked)} className="w-4 h-4 rounded border-edge accent-brand-500" />
              )}
            </label>
          </div>
        </div>

      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={handleSubmit} disabled={saving || Object.values(enabled).filter(Boolean).length === 0}>
          {saving
            ? (lang === 'ar' ? 'جاري التطبيق...' : 'Applying...')
            : (lang === 'ar' ? `تطبيق على ${selectedIds.length} موظف` : `Apply to ${selectedIds.length} employees`)}
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

// ── Termination Modal ────────────────────────────────────────

function TerminationModal({ emp, onClose, onConfirm, lang, isRTL }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    reason: 'resignation',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;

  const REASONS = [
    { value: 'resignation', ar: 'استقالة', en: 'Resignation' },
    { value: 'termination', ar: 'فصل', en: 'Termination' },
    { value: 'contract_end', ar: 'انتهاء عقد', en: 'Contract End' },
    { value: 'mutual', ar: 'اتفاق مشترك', en: 'Mutual Agreement' },
    { value: 'other', ar: 'أخرى', en: 'Other' },
  ];

  const handleSubmit = async () => {
    setSaving(true);
    await onConfirm(form);
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={lang === 'ar' ? 'إنهاء خدمة موظف' : 'Terminate Employee'} width="max-w-md">
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-red-500/[0.12] flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="text-start">
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{name}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{emp.employee_number}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ المغادرة' : 'Last Working Day'}</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'السبب' : 'Reason'}</label>
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm">
              {REASONS.map(r => <option key={r.value} value={r.value}>{lang === 'ar' ? r.ar : r.en}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none" />
          </div>
        </div>

        <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-lg p-3 mt-4">
          <p className="m-0 text-xs text-amber-700 dark:text-amber-400 font-medium">
            {lang === 'ar'
              ? 'بيانات الموظف والحضور والمرتبات هتفضل محفوظة. تقدر تعمل إعادة تعيين في أي وقت.'
              : 'All employee data, attendance and payroll records will be preserved. You can reinstate anytime.'}
          </p>
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={handleSubmit} disabled={saving} className="!bg-red-500 hover:!bg-red-600 !text-white !border-red-500">
          {saving ? (lang === 'ar' ? 'جاري الإنهاء...' : 'Processing...') : (lang === 'ar' ? 'تأكيد إنهاء الخدمة' : 'Confirm Termination')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── Bulk Shift Assignment Modal ──────────────────────────────

function BulkShiftModal({ open, selectedIds, lang, isRTL, onClose, onDone }) {
  const [shifts, setShifts] = useState([]);
  const [shiftId, setShiftId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      import('../../services/shiftsService').then(({ fetchShifts }) => fetchShifts().then(setShifts));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!shiftId || !startDate) return;
    setSaving(true);
    try {
      const { assignShiftBulk } = await import('../../services/employeeShiftsService');
      await assignShiftBulk(selectedIds, shiftId, startDate, endDate || null, notes || null);
      showToast(lang === 'ar' ? `تم تعيين الشيفت لـ ${selectedIds.length} موظف` : `Shift assigned to ${selectedIds.length} employees`, 'success');
      onDone();
    } catch {
      showToast(lang === 'ar' ? 'فشل التعيين' : 'Assignment failed', 'error');
    }
    setSaving(false);
  };

  if (!open) return null;
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm';

  return (
    <Modal open onClose={onClose} title={lang === 'ar' ? `تعيين شيفت لـ ${selectedIds.length} موظف` : `Assign shift to ${selectedIds.length} employees`} width="max-w-md">
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-3">
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'فترة الدوام' : 'Shift'}</label>
          <select value={shiftId} onChange={e => setShiftId(e.target.value)} className={inputCls}>
            <option value="">{lang === 'ar' ? 'اختر فترة...' : 'Select shift...'}</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>{isRTL ? (s.name_ar || s.name) : s.name} ({s.official_start} - {s.official_end})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'من تاريخ' : 'Start Date'}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'لتاريخ (اختياري)' : 'End Date (optional)'}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder={lang === 'ar' ? 'مثلاً: شيفت رمضان' : 'e.g. Ramadan shift'} />
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={handleSubmit} disabled={saving || !shiftId || !startDate}>
          {saving ? (lang === 'ar' ? 'جاري التعيين...' : 'Assigning...') : (lang === 'ar' ? 'تعيين' : 'Assign')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
