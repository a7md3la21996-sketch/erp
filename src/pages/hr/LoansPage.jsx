import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchLoans, createLoan, updateLoan, deleteLoan } from '../../services/payrollService';
import { fetchEmployees } from '../../services/employeesService';
import { useToast } from '../../contexts/ToastContext';
import { DollarSign, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton } from '../../components/ui';

const LOAN_TYPES = [
  { value: 'loan', ar: 'قرض', en: 'Loan' },
  { value: 'advance', ar: 'سلفة', en: 'Advance' },
];

const STATUS_OPTIONS = [
  { value: 'active', ar: 'نشط', en: 'Active' },
  { value: 'paid', ar: 'مسدد', en: 'Paid' },
  { value: 'cancelled', ar: 'ملغى', en: 'Cancelled' },
];

const STATUS_COLORS = {
  active: 'bg-brand-500/15 text-brand-500 border border-brand-500/30',
  paid: 'bg-green-500/15 text-green-600 border border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-500 border border-red-500/30',
};

const emptyForm = {
  employee_id: '',
  type: 'loan',
  amount: '',
  monthly_deduction: '',
  start_date: '',
  notes: '',
};

export default function LoansPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const loadData = async () => {
    setLoading(true);
    try {
      const [loansData, empData] = await Promise.all([
        fetchLoans(),
        fetchEmployees(),
      ]);
      setLoans(loansData);
      setEmployees(empData);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return '—';
    return (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  };

  const calcRemaining = (loan) => {
    if (loan.status === 'paid') return 0;
    if (loan.status === 'cancelled') return Number(loan.amount) || 0;
    const start = new Date(loan.start_date);
    const now = new Date();
    const monthsElapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
    const totalPaid = monthsElapsed * (Number(loan.monthly_deduction) || 0);
    return Math.max(0, (Number(loan.amount) || 0) - totalPaid);
  };

  const openAddModal = () => {
    setEditingLoan(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEditModal = (loan) => {
    setEditingLoan(loan);
    setForm({
      employee_id: loan.employee_id,
      type: loan.type || 'loan',
      amount: loan.amount,
      monthly_deduction: loan.monthly_deduction,
      start_date: loan.start_date || '',
      notes: loan.notes || '',
      status: loan.status || 'active',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.amount || !form.monthly_deduction) {
      showToast(lang === 'ar' ? 'أكمل البيانات المطلوبة' : 'Fill required fields', 'error');
      return;
    }
    try {
      if (editingLoan) {
        const updated = await updateLoan(editingLoan.id, {
          employee_id: form.employee_id,
          type: form.type,
          amount: Number(form.amount),
          monthly_deduction: Number(form.monthly_deduction),
          start_date: form.start_date || null,
          notes: form.notes || null,
          status: form.status || 'active',
        });
        setLoans(prev => prev.map(l => l.id === editingLoan.id ? updated : l));
        showToast(lang === 'ar' ? 'تم التحديث' : 'Updated', 'success');
      } else {
        const created = await createLoan({
          employee_id: form.employee_id,
          type: form.type,
          amount: Number(form.amount),
          monthly_deduction: Number(form.monthly_deduction),
          start_date: form.start_date || null,
          notes: form.notes || null,
          status: 'active',
        });
        setLoans(prev => [created, ...prev]);
        showToast(lang === 'ar' ? 'تم الإضافة' : 'Added', 'success');
      }
      setModalOpen(false);
    } catch {
      showToast(lang === 'ar' ? 'فشل الحفظ' : 'Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    const msg = lang === 'ar' ? 'حذف هذا السلف/القرض؟' : 'Delete this loan?';
    if (!window.confirm(msg)) return;
    try {
      await deleteLoan(id);
      setLoans(prev => prev.filter(l => l.id !== id));
      showToast(lang === 'ar' ? 'تم الحذف' : 'Deleted', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل الحذف' : 'Delete failed', 'error');
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis={false} tableRows={5} tableCols={7} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center mb-5 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <DollarSign size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'السلف والقروض' : 'Loans & Advances'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إدارة سلف وقروض الموظفين' : 'Manage employee loans & advances'}
            </p>
          </div>
        </div>
        <Button size="md" onClick={openAddModal}>
          <Plus size={14} />{lang === 'ar' ? 'إضافة سلفة' : 'Add Loan'}
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
              <Th>{lang === 'ar' ? 'النوع' : 'Type'}</Th>
              <Th>{lang === 'ar' ? 'المبلغ' : 'Amount'}</Th>
              <Th>{lang === 'ar' ? 'القسط الشهري' : 'Monthly Deduction'}</Th>
              <Th>{lang === 'ar' ? 'المتبقي' : 'Remaining'}</Th>
              <Th>{lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}</Th>
              <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <DollarSign size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? 'لا توجد سلف أو قروض' : 'No loans or advances'}
                  </p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                    {lang === 'ar' ? 'أضف سلفة أو قرض جديد' : 'Add a new loan or advance'}
                  </p>
                </td>
              </tr>
            ) : loans.map(loan => {
              const typeLabel = LOAN_TYPES.find(t => t.value === loan.type);
              const statusLabel = STATUS_OPTIONS.find(s => s.value === loan.status);
              const remaining = calcRemaining(loan);

              return (
                <Tr key={loan.id}>
                  <Td className="font-bold">{getEmployeeName(loan.employee_id)}</Td>
                  <Td>{typeLabel ? (lang === 'ar' ? typeLabel.ar : typeLabel.en) : loan.type}</Td>
                  <Td>{Number(loan.amount).toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</Td>
                  <Td>{Number(loan.monthly_deduction).toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</Td>
                  <Td className="font-semibold">{remaining.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</Td>
                  <Td className="font-mono">{loan.start_date || '—'}</Td>
                  <Td>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[loan.status] || STATUS_COLORS.active}`}>
                      {statusLabel ? (lang === 'ar' ? statusLabel.ar : statusLabel.en) : loan.status}
                    </span>
                  </Td>
                  <Td>
                    <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(loan)}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(loan.id)}>
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
        <Modal open onClose={() => setModalOpen(false)} title={editingLoan ? (lang === 'ar' ? 'تعديل سلفة' : 'Edit Loan') : (lang === 'ar' ? 'إضافة سلفة' : 'Add Loan')} size="md">
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

            {/* Type */}
            <div>
              <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'النوع' : 'Type'}
              </label>
              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              >
                {LOAN_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{lang === 'ar' ? t.ar : t.en}</option>
                ))}
              </select>
            </div>

            {/* Amount & Monthly Deduction */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'المبلغ' : 'Amount'} *
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {lang === 'ar' ? 'القسط الشهري' : 'Monthly Deduction'} *
                </label>
                <input
                  type="number"
                  value={form.monthly_deduction}
                  onChange={e => setForm(prev => ({ ...prev, monthly_deduction: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              />
            </div>

            {/* Status (only in edit mode) */}
            {editingLoan && (
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

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'ملاحظات' : 'Notes'}
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark resize-none"
              />
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave}>
              {editingLoan ? (lang === 'ar' ? 'تحديث' : 'Update') : (lang === 'ar' ? 'إضافة' : 'Add')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
