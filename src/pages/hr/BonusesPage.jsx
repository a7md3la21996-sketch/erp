import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees } from '../../services/employeesService';
import { fetchAdjustments, createAdjustment, deleteAdjustment } from '../../services/payrollService';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Th, Td, Tr, Modal, ModalFooter, Select, PageSkeleton } from '../../components/ui';

/* ─── Helpers ─── */
const now = new Date();

const typeConfig = {
  bonus:      { ar: 'مكافأة',   en: 'Bonus',      color: '#10B981' },
  commission: { ar: 'عمولة',    en: 'Commission',  color: '#4A7AAB' },
  penalty:    { ar: 'جزاء',     en: 'Penalty',     color: '#EF4444' },
  deduction:  { ar: 'خصم',      en: 'Deduction',   color: '#EF4444' },
  addition:   { ar: 'إضافة',    en: 'Addition',    color: '#10B981' },
};

function TypeBadge({ type, lang }) {
  const cfg = typeConfig[type] || { ar: type, en: type, color: '#6B7280' };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold"
      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35` }}
    >
      {lang === 'ar' ? cfg.ar : cfg.en}
    </span>
  );
}

/* ─── Component ─── */
export default function BonusesPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const [adjustments, setAdjustments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ employee_id: '', type: 'bonus', amount: '', description: '' });

  /* ─── Load data ─── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [adjs, emps] = await Promise.all([
        fetchAdjustments(month, year),
        fetchEmployees(),
      ]);
      setAdjustments(adjs);
      setEmployees(emps);
    } catch {
      toast.error(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Summaries ─── */
  const totals = useMemo(() => {
    const sum = (types) => adjustments.filter(a => types.includes(a.type)).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    return {
      bonuses:     sum(['bonus', 'addition']),
      commissions: sum(['commission']),
      penalties:   sum(['penalty', 'deduction']),
    };
  }, [adjustments]);

  /* ─── Employee name helper ─── */
  const empName = (id) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return id;
    return (isRTL ? emp.full_name_ar : (emp.full_name_en || emp.full_name_ar)) || id;
  };

  /* ─── Actions ─── */
  const handleAdd = async () => {
    if (!form.employee_id || !form.amount) return;
    setSaving(true);
    try {
      const created = await createAdjustment({
        employee_id: form.employee_id,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description || null,
        month,
        year,
      });
      setAdjustments(prev => [created, ...prev]);
      setShowModal(false);
      setForm({ employee_id: '', type: 'bonus', amount: '', description: '' });
      toast.success(lang === 'ar' ? 'تمت الإضافة بنجاح' : 'Added successfully');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAdjustment(id);
      setAdjustments(prev => prev.filter(a => a.id !== id));
      setDeleteConfirm(null);
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
    }
  };

  /* ─── Month options ─── */
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }),
  }));
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  /* ─── Format currency ─── */
  const fmt = (v) => Number(v || 0).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={3} tableRows={6} tableCols={6} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <DollarSign size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'المكافآت والعمولات' : 'Bonuses & Commissions'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'إدارة المكافآت والجزاءات والعمولات' : 'Manage bonuses, penalties & commissions'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Button size="md" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            {lang === 'ar' ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Month / Year Selector */}
      <div className={`flex items-center gap-2.5 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Select value={month} onChange={e => setMonth(Number(e.target.value))}>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
        <Select value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mb-5">
        <KpiCard icon={DollarSign} label={lang === 'ar' ? 'إجمالي المكافآت' : 'Total Bonuses'}       value={fmt(totals.bonuses)}     color="#10B981" />
        <KpiCard icon={DollarSign} label={lang === 'ar' ? 'إجمالي العمولات' : 'Total Commissions'}   value={fmt(totals.commissions)} color="#4A7AAB" />
        <KpiCard icon={DollarSign} label={lang === 'ar' ? 'إجمالي الجزاءات' : 'Total Penalties'}     value={fmt(totals.penalties)}   color="#EF4444" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'التعديلات' : 'Adjustments'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'النوع' : 'Type',
                lang === 'ar' ? 'المبلغ' : 'Amount',
                lang === 'ar' ? 'الوصف' : 'Description',
                lang === 'ar' ? 'التاريخ' : 'Date',
                '',
              ].map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <DollarSign size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد تعديلات' : 'No Adjustments'}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لم يتم إضافة أي مكافآت أو جزاءات بعد' : 'No bonuses or penalties added yet'}</p>
                </td>
              </tr>
            ) : adjustments.map(adj => (
              <Tr key={adj.id}>
                <Td className="font-semibold">{empName(adj.employee_id)}</Td>
                <Td><TypeBadge type={adj.type} lang={lang} /></Td>
                <Td className="font-bold text-brand-500">{fmt(adj.amount)}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark max-w-[200px] truncate">{adj.description || '—'}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark text-xs">{adj.created_at ? new Date(adj.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : '—'}</Td>
                <Td>
                  {deleteConfirm === adj.id ? (
                    <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button
                        onClick={() => handleDelete(adj.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500 text-white border-none cursor-pointer transition-all duration-150 hover:bg-red-600"
                      >
                        {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-transparent text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-brand-500/10"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(adj.id)}
                      className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-red-500/10 hover:border-red-500/40 flex items-center justify-center cursor-pointer transition-all duration-150"
                      title={lang === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Add Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={lang === 'ar' ? 'إضافة مكافأة / جزاء' : 'Add Bonus / Penalty'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الموظف' : 'Employee'}</label>
            <Select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر الموظف...' : 'Select employee...'}</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{isRTL ? e.full_name_ar : (e.full_name_en || e.full_name_ar)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'النوع' : 'Type'}</label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {Object.entries(typeConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{lang === 'ar' ? cfg.ar : cfg.en}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الوصف' : 'Description'}</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>
        <ModalFooter className="justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={saving || !form.employee_id || !form.amount} onClick={handleAdd}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'إضافة' : 'Add')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
