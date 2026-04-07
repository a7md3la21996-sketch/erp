import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees } from '../../services/employeesService';
import { Clock, Plus, Check, X } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Th, Td, Tr, Modal, ModalFooter, Select, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

/* ─── Helpers ─── */
const now = new Date();
const statusColors = { pending: '#F59E0B', approved: '#10B981', rejected: '#EF4444' };

function StatusBadge({ status, lang }) {
  const labels = {
    pending:  { ar: 'معلق',   en: 'Pending'  },
    approved: { ar: 'موافق',  en: 'Approved' },
    rejected: { ar: 'مرفوض',  en: 'Rejected' },
  };
  const s = labels[status] || labels.pending;
  const color = statusColors[status] || statusColors.pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}
    >
      {lang === 'ar' ? s.ar : s.en}
    </span>
  );
}

/* ─── Supabase helpers ─── */
async function fetchOvertimeRequests(month, year) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('overtime_requests')
    .select('*')
    .gte('date', startDate)
    .lt('date', endDate)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createOvertimeRequest(payload) {
  const { data, error } = await supabase
    .from('overtime_requests')
    .insert({ ...payload, status: 'pending', created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function updateOvertimeStatus(id, status, approvedBy) {
  const updates = { status, approved_by: approvedBy, approved_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('overtime_requests')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/* ─── Component ─── */
export default function OvertimePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('all'); // all | pending | approved | rejected
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_id: '', date: '', hours: '', reason: '' });

  /* ─── Load data ─── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, emps] = await Promise.all([
        fetchOvertimeRequests(month, year),
        fetchEmployees(),
      ]);
      setRequests(reqs);
      setEmployees(emps);
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── KPIs ─── */
  const pendingCount  = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  /* ─── Filtered list ─── */
  const filtered = useMemo(() => {
    if (tab === 'all') return requests;
    return requests.filter(r => r.status === tab);
  }, [requests, tab]);

  /* ─── Actions ─── */
  const empName = (id) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return id;
    return (isRTL ? emp.full_name_ar : (emp.full_name_en || emp.full_name_ar)) || id;
  };

  const handleApprove = async (id) => {
    try {
      const updated = await updateOvertimeStatus(id, 'approved', lang === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager');
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success(lang === 'ar' ? 'تمت الموافقة' : 'Approved');
    } catch {
      toast.error(lang === 'ar' ? 'فشلت العملية' : 'Operation failed');
    }
  };

  const handleReject = async (id) => {
    try {
      const updated = await updateOvertimeStatus(id, 'rejected', lang === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager');
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success(lang === 'ar' ? 'تم الرفض' : 'Rejected');
    } catch {
      toast.error(lang === 'ar' ? 'فشلت العملية' : 'Operation failed');
    }
  };

  const handleAdd = async () => {
    if (!form.employee_id || !form.date || !form.hours) return;
    setSaving(true);
    try {
      const created = await createOvertimeRequest({
        employee_id: form.employee_id,
        date: form.date,
        hours: parseFloat(form.hours),
        reason: form.reason || null,
      });
      setRequests(prev => [created, ...prev]);
      setShowModal(false);
      setForm({ employee_id: '', date: '', hours: '', reason: '' });
      toast.success(lang === 'ar' ? 'تم إضافة الطلب' : 'Request added');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Month options ─── */
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }),
  }));
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  /* ─── Tabs ─── */
  const tabs = [
    { key: 'all',      ar: 'الكل',    en: 'All'      },
    { key: 'pending',  ar: 'معلق',    en: 'Pending'  },
    { key: 'approved', ar: 'موافق',   en: 'Approved' },
    { key: 'rejected', ar: 'مرفوض',   en: 'Rejected' },
  ];

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={7} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Clock size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الأوفرتايم' : 'Overtime'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'إدارة طلبات العمل الإضافي' : 'Manage overtime requests'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Button size="md" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            {lang === 'ar' ? 'طلب جديد' : 'Add Request'}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Clock} label={lang === 'ar' ? 'إجمالي الطلبات' : 'Total Requests'} value={requests.length} color="#1B3347" />
        <KpiCard icon={Clock} label={lang === 'ar' ? 'بانتظار الموافقة' : 'Pending'} value={pendingCount} color="#F59E0B" />
        <KpiCard icon={Check} label={lang === 'ar' ? 'موافق عليها' : 'Approved'} value={approvedCount} color="#10B981" />
        <KpiCard icon={X}     label={lang === 'ar' ? 'مرفوضة' : 'Rejected'} value={rejectedCount} color="#EF4444" />
      </div>

      {/* Filter Tabs */}
      <div className={`flex gap-1.5 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border ${
              tab === t.key
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-transparent text-content-muted dark:text-content-muted-dark border-edge dark:border-edge-dark hover:bg-brand-500/10'
            }`}
          >
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'طلبات الأوفرتايم' : 'Overtime Requests'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'التاريخ' : 'Date',
                lang === 'ar' ? 'الساعات' : 'Hours',
                lang === 'ar' ? 'السبب' : 'Reason',
                lang === 'ar' ? 'الحالة' : 'Status',
                lang === 'ar' ? 'تمت الموافقة بواسطة' : 'Approved By',
                '',
              ].map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Clock size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد طلبات' : 'No Requests'}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لم يتم تقديم أي طلبات أوفرتايم بعد' : 'No overtime requests submitted yet'}</p>
                </td>
              </tr>
            ) : filtered.map(r => (
              <Tr key={r.id}>
                <Td className="font-semibold">{empName(r.employee_id)}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{r.date}</Td>
                <Td className="font-bold text-brand-500">{r.hours}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark max-w-[200px] truncate">{r.reason || '—'}</Td>
                <Td><StatusBadge status={r.status} lang={lang} /></Td>
                <Td className="text-content-muted dark:text-content-muted-dark text-xs">{r.approved_by || '—'}</Td>
                <Td>
                  {r.status === 'pending' && (
                    <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-emerald-500/10 hover:border-emerald-500/40 flex items-center justify-center cursor-pointer transition-all duration-150"
                        title={lang === 'ar' ? 'موافقة' : 'Approve'}
                      >
                        <Check size={13} className="text-emerald-500" />
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-red-500/10 hover:border-red-500/40 flex items-center justify-center cursor-pointer transition-all duration-150"
                        title={lang === 'ar' ? 'رفض' : 'Reject'}
                      >
                        <X size={13} className="text-red-500" />
                      </button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Add Request Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={lang === 'ar' ? 'طلب أوفرتايم جديد' : 'New Overtime Request'}>
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
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'عدد الساعات' : 'Hours'}</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'السبب' : 'Reason'}</label>
            <textarea
              rows={2}
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>
        <ModalFooter className="justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={saving || !form.employee_id || !form.date || !form.hours} onClick={handleAdd}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'إضافة' : 'Add')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
