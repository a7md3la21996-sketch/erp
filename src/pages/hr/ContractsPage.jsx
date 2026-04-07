import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees } from '../../services/employeesService';
import { FileText, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

const CONTRACT_TYPES = [
  { value: 'full_time', ar: 'دوام كامل', en: 'Full Time' },
  { value: 'part_time', ar: 'دوام جزئي', en: 'Part Time' },
  { value: 'contract', ar: 'عقد', en: 'Contract' },
  { value: 'probation', ar: 'فترة تجربة', en: 'Probation' },
];

const STATUS_OPTIONS = [
  { value: 'active', ar: 'نشط', en: 'Active' },
  { value: 'expired', ar: 'منتهي', en: 'Expired' },
  { value: 'cancelled', ar: 'ملغى', en: 'Cancelled' },
];

const STATUS_COLORS = {
  active: 'bg-green-500/15 text-green-600 border border-green-500/30',
  expired: 'bg-red-500/15 text-red-500 border border-red-500/30',
  cancelled: 'bg-gray-500/15 text-gray-500 border border-gray-500/30',
};

const FILTER_OPTIONS = [
  { value: 'all', ar: 'الكل', en: 'All' },
  { value: 'expiring_soon', ar: 'ينتهي قريبا', en: 'Expiring Soon' },
  { value: 'expired', ar: 'منتهي', en: 'Expired' },
];

const emptyForm = {
  employee_id: '',
  contract_type: 'full_time',
  start_date: '',
  end_date: '',
  salary: '',
  terms: '',
  alert_days: 30,
};

export default function ContractsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, { data: contractsData, error }] = await Promise.all([
        fetchEmployees(),
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
      ]);
      if (error) throw error;
      setEmployees(empData);
      setContracts(contractsData || []);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return '\u2014';
    return (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isExpiringSoon = (contract) => {
    if (!contract.end_date) return false;
    const endDate = new Date(contract.end_date);
    endDate.setHours(0, 0, 0, 0);
    const alertDays = contract.alert_days || 30;
    const diffMs = endDate - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= alertDays;
  };

  const isExpired = (contract) => {
    if (!contract.end_date) return false;
    const endDate = new Date(contract.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today && contract.status === 'active';
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const total = contracts.length;
    const expiringSoon = contracts.filter(c => isExpiringSoon(c)).length;
    const expired = contracts.filter(c => isExpired(c)).length;
    const active = contracts.filter(c => c.status === 'active').length;
    return { total, expiringSoon, expired, active };
  }, [contracts]);

  // Filtered contracts
  const filtered = useMemo(() => {
    if (filter === 'expiring_soon') return contracts.filter(c => isExpiringSoon(c));
    if (filter === 'expired') return contracts.filter(c => isExpired(c));
    return contracts;
  }, [contracts, filter]);

  const openAddModal = () => {
    setEditingContract(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEditModal = (contract) => {
    setEditingContract(contract);
    setForm({
      employee_id: contract.employee_id,
      contract_type: contract.contract_type || 'full_time',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      salary: contract.salary || '',
      terms: contract.terms || '',
      alert_days: contract.alert_days ?? 30,
      status: contract.status || 'active',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.start_date || !form.salary) {
      showToast(lang === 'ar' ? 'أكمل البيانات المطلوبة' : 'Fill required fields', 'error');
      return;
    }
    try {
      const payload = {
        employee_id: form.employee_id,
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        salary: Number(form.salary),
        terms: form.terms || null,
        alert_days: Number(form.alert_days) || 30,
      };

      if (editingContract) {
        payload.status = form.status || 'active';
        const { data, error } = await supabase
          .from('contracts')
          .update(payload)
          .eq('id', editingContract.id)
          .select()
          .single();
        if (error) throw error;
        setContracts(prev => prev.map(c => c.id === editingContract.id ? data : c));
        showToast(lang === 'ar' ? 'تم التحديث' : 'Updated', 'success');
      } else {
        payload.status = 'active';
        const { data, error } = await supabase
          .from('contracts')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setContracts(prev => [data, ...prev]);
        showToast(lang === 'ar' ? 'تم الإضافة' : 'Added', 'success');
      }
      setModalOpen(false);
    } catch {
      showToast(lang === 'ar' ? 'فشل الحفظ' : 'Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    const msg = lang === 'ar' ? 'حذف هذا العقد؟' : 'Delete this contract?';
    if (!window.confirm(msg)) return;
    try {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw error;
      setContracts(prev => prev.filter(c => c.id !== id));
      showToast(lang === 'ar' ? 'تم الحذف' : 'Deleted', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل الحذف' : 'Delete failed', 'error');
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={8} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center mb-5 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <FileText size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'إدارة العقود' : 'Contracts'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إدارة عقود الموظفين' : 'Manage employee contracts'}
            </p>
          </div>
        </div>
        <Button size="md" onClick={openAddModal}>
          <Plus size={14} />{lang === 'ar' ? 'إضافة عقد' : 'Add Contract'}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={FileText} label={lang === 'ar' ? 'إجمالي العقود' : 'Total Contracts'} value={kpis.total} color="#1B3347" />
        <KpiCard icon={AlertTriangle} label={lang === 'ar' ? 'ينتهي قريبا' : 'Expiring Soon'} value={kpis.expiringSoon} color="#F59E0B" />
        <KpiCard icon={Trash2} label={lang === 'ar' ? 'منتهية' : 'Expired'} value={kpis.expired} color="#EF4444" />
        <KpiCard icon={CheckCircle2} label={lang === 'ar' ? 'نشطة' : 'Active'} value={kpis.active} color="#10B981" />
      </div>

      {/* Filter */}
      <div className={`flex gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
              filter === opt.value
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-transparent text-content dark:text-content-dark border-edge dark:border-edge-dark hover:border-brand-500/40'
            }`}
          >
            {lang === 'ar' ? opt.ar : opt.en}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {lang === 'ar' ? 'العقود' : 'Contracts'}
          </p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
              <Th>{lang === 'ar' ? 'نوع العقد' : 'Contract Type'}</Th>
              <Th>{lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}</Th>
              <Th>{lang === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</Th>
              <Th>{lang === 'ar' ? 'الراتب' : 'Salary'}</Th>
              <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <FileText size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? 'لا توجد عقود' : 'No Contracts'}
                  </p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                    {lang === 'ar' ? 'أضف عقد جديد للبدء' : 'Add a new contract to get started'}
                  </p>
                </td>
              </tr>
            ) : filtered.map(contract => {
              const typeLabel = CONTRACT_TYPES.find(t => t.value === contract.contract_type);
              const statusLabel = STATUS_OPTIONS.find(s => s.value === contract.status);
              const expiringSoon = isExpiringSoon(contract);
              const expired = isExpired(contract);

              return (
                <Tr key={contract.id}>
                  <Td className="font-bold">{getEmployeeName(contract.employee_id)}</Td>
                  <Td>{typeLabel ? (lang === 'ar' ? typeLabel.ar : typeLabel.en) : contract.contract_type}</Td>
                  <Td className="font-mono">{contract.start_date || '\u2014'}</Td>
                  <Td className="font-mono">{contract.end_date || '\u2014'}</Td>
                  <Td>{Number(contract.salary).toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[contract.status] || STATUS_COLORS.active}`}>
                        {statusLabel ? (lang === 'ar' ? statusLabel.ar : statusLabel.en) : contract.status}
                      </span>
                      {(expiringSoon || expired) && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            background: expired ? '#EF444418' : '#F59E0B18',
                            color: expired ? '#EF4444' : '#F59E0B',
                            border: `1px solid ${expired ? '#EF444435' : '#F59E0B35'}`,
                          }}
                        >
                          <AlertTriangle size={10} />
                          {expired
                            ? (lang === 'ar' ? 'منتهي' : 'Expired')
                            : (lang === 'ar' ? 'ينتهي قريبا' : 'Expiring Soon')
                          }
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(contract)}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(contract.id)}>
                        <Trash2 size={13} className="text-red-500" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal open onClose={() => setModalOpen(false)} title={editingContract ? (lang === 'ar' ? 'تعديل عقد' : 'Edit Contract') : (lang === 'ar' ? 'إضافة عقد' : 'Add Contract')} size="md">
          <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">
            {/* Employee */}
            <div>
              <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'الموظف' : 'Employee'} *
              </label>
              <select
                value={form.employee_id}
                onChange={e => setForm(prev => ({ ...prev, employee_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              >
                <option value="">{lang === 'ar' ? 'اختر موظف' : 'Select employee'}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* Contract Type */}
            <div>
              <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'نوع العقد' : 'Contract Type'}
              </label>
              <select
                value={form.contract_type}
                onChange={e => setForm(prev => ({ ...prev, contract_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              >
                {CONTRACT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{lang === 'ar' ? t.ar : t.en}</option>
                ))}
              </select>
            </div>

            {/* Start Date & End Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'تاريخ البدء' : 'Start Date'} *
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                />
              </div>
            </div>

            {/* Salary & Alert Days */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'الراتب' : 'Salary'} *
                </label>
                <input
                  type="number"
                  value={form.salary}
                  onChange={e => setForm(prev => ({ ...prev, salary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'أيام التنبيه قبل الانتهاء' : 'Alert Days Before Expiry'}
                </label>
                <input
                  type="number"
                  value={form.alert_days}
                  onChange={e => setForm(prev => ({ ...prev, alert_days: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                  placeholder="30"
                />
              </div>
            </div>

            {/* Status (only in edit mode) */}
            {editingContract && (
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'الحالة' : 'Status'}
                </label>
                <select
                  value={form.status || 'active'}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{lang === 'ar' ? s.ar : s.en}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Terms */}
            <div>
              <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'شروط العقد' : 'Terms'}
              </label>
              <textarea
                value={form.terms}
                onChange={e => setForm(prev => ({ ...prev, terms: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark resize-none"
              />
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave}>
              {editingContract ? (lang === 'ar' ? 'تحديث' : 'Update') : (lang === 'ar' ? 'إضافة' : 'Add')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
