import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees } from '../../services/employeesService';
import { Calendar, RefreshCw } from 'lucide-react';
import { Button, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

const currentYear = new Date().getFullYear();

export default function LeaveCarryoverPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [fromYear, setFromYear] = useState(currentYear - 1);
  const [carryData, setCarryData] = useState({});
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const toYear = fromYear + 1;

  const loadData = async () => {
    setLoading(true);
    try {
      const empData = await fetchEmployees();
      const activeEmployees = empData.filter(e => e.status === 'active' || !e.status);
      setEmployees(activeEmployees);

      // Initialize carry data for each employee
      const initial = {};
      activeEmployees.forEach(emp => {
        initial[emp.id] = { carry_days: 0, encash_days: 0 };
      });
      setCarryData(initial);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data', 'error');
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_carryover')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch {
      // History table might not exist yet
      setHistory([]);
    }
    setHistoryLoading(false);
  };

  useEffect(() => { loadData(); loadHistory(); }, []);

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return '\u2014';
    return (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  };

  const updateCarryData = (empId, field, value) => {
    const numValue = Math.max(0, Number(value) || 0);
    setCarryData(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: numValue },
    }));
  };

  const calcEncashAmount = (emp, encashDays) => {
    if (!encashDays || encashDays <= 0) return 0;
    const monthlySalary = Number(emp.salary) || 0;
    const dailySalary = monthlySalary / 30;
    return Math.round(dailySalary * encashDays * 100) / 100;
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const records = [];
      const balanceUpdates = [];

      for (const emp of employees) {
        const data = carryData[emp.id];
        if (!data) continue;

        const carryDays = data.carry_days || 0;
        const encashDays = data.encash_days || 0;
        const balance = emp.leave_balance ?? 0;
        const encashAmount = calcEncashAmount(emp, encashDays);

        // Validate: carry + encash should not exceed current balance
        if (carryDays + encashDays > balance) {
          showToast(
            lang === 'ar'
              ? `أيام الترحيل والاستحقاق تتجاوز الرصيد للموظف ${(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}`
              : `Carry + encash days exceed balance for ${(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}`,
            'error'
          );
          setProcessing(false);
          setConfirmModal(false);
          return;
        }

        if (carryDays > 0 || encashDays > 0) {
          records.push({
            employee_id: emp.id,
            from_year: fromYear,
            to_year: toYear,
            previous_balance: balance,
            carry_days: carryDays,
            encash_days: encashDays,
            encash_amount: encashAmount,
          });
        }

        // New balance = annual_leave_days (reset) + carried days
        const annualDays = emp.annual_leave_days ?? 21;
        const newBalance = annualDays + carryDays;
        balanceUpdates.push({ id: emp.id, leave_balance: newBalance });
      }

      // Insert carryover records
      if (records.length > 0) {
        const { error: insertError } = await supabase
          .from('leave_carryover')
          .insert(records);
        if (insertError) throw insertError;
      }

      // Update employee balances
      for (const update of balanceUpdates) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ leave_balance: update.leave_balance })
          .eq('id', update.id);
        if (updateError) throw updateError;
      }

      showToast(
        lang === 'ar' ? 'تم ترحيل الإجازات بنجاح' : 'Leave carry-over processed successfully',
        'success'
      );

      setConfirmModal(false);
      await loadData();
      await loadHistory();
    } catch {
      showToast(lang === 'ar' ? 'فشل ترحيل الإجازات' : 'Failed to process carry-over', 'error');
    }
    setProcessing(false);
  };

  // Year options
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear; y++) {
    yearOptions.push(y);
  }

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis={false} tableRows={6} tableCols={7} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center mb-5 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Calendar size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'ترحيل الإجازات' : 'Leave Carry-over'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'ترحيل أرصدة الإجازات لنهاية العام' : 'Year-end leave balance carry-over'}
            </p>
          </div>
        </div>
        <Button size="md" onClick={() => setConfirmModal(true)} disabled={processing}>
          <RefreshCw size={14} className={processing ? 'animate-spin' : ''} />
          {lang === 'ar' ? 'تنفيذ الترحيل' : 'Process Carry-over'}
        </Button>
      </div>

      {/* Year Selector */}
      <Card className="p-5 mb-5">
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'من سنة' : 'From Year'}
            </label>
            <select
              value={fromYear}
              onChange={e => setFromYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="text-content-muted dark:text-content-muted-dark text-lg font-bold mt-4">
            &rarr;
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'إلى سنة' : 'To Year'}
            </label>
            <div className="px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-bg dark:bg-surface-bg-dark text-sm text-content dark:text-content-dark font-semibold">
              {toYear}
            </div>
          </div>
        </div>
      </Card>

      {/* Employee Carry-over Table */}
      <Card className="overflow-hidden mb-5">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {lang === 'ar' ? 'أرصدة الموظفين' : 'Employee Balances'}
          </p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
              <Th>{lang === 'ar' ? 'أيام الإجازة السنوية' : 'Annual Leave Days'}</Th>
              <Th>{lang === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</Th>
              <Th>{lang === 'ar' ? 'أيام الترحيل' : 'Carry Days'}</Th>
              <Th>{lang === 'ar' ? 'أيام الاستحقاق النقدي' : 'Encash Days'}</Th>
              <Th>{lang === 'ar' ? 'مبلغ الاستحقاق' : 'Encash Amount'}</Th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? 'لا يوجد موظفين نشطين' : 'No Active Employees'}
                  </p>
                </td>
              </tr>
            ) : employees.map(emp => {
              const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
              const annualDays = emp.annual_leave_days ?? 21;
              const balance = emp.leave_balance ?? 0;
              const data = carryData[emp.id] || { carry_days: 0, encash_days: 0 };
              const encashAmount = calcEncashAmount(emp, data.encash_days);

              return (
                <Tr key={emp.id}>
                  <Td className="font-bold">{name}</Td>
                  <Td>{annualDays}</Td>
                  <Td className="font-semibold text-brand-500">{balance} {lang === 'ar' ? 'يوم' : 'days'}</Td>
                  <Td>
                    <input
                      type="number"
                      min="0"
                      max={balance}
                      value={data.carry_days}
                      onChange={e => updateCarryData(emp.id, 'carry_days', e.target.value)}
                      className="w-20 px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark text-center"
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      min="0"
                      max={balance - data.carry_days}
                      value={data.encash_days}
                      onChange={e => updateCarryData(emp.id, 'encash_days', e.target.value)}
                      className="w-20 px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark text-center"
                    />
                  </Td>
                  <Td className="font-semibold">
                    {encashAmount > 0
                      ? `${encashAmount.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`
                      : '\u2014'
                    }
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* Carry-over History */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {lang === 'ar' ? 'سجل الترحيلات السابقة' : 'Carry-over History'}
          </p>
        </CardHeader>
        {historyLoading ? (
          <div className="p-8 text-center text-content-muted dark:text-content-muted-dark text-sm">
            {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                <Th>{lang === 'ar' ? 'من سنة' : 'From Year'}</Th>
                <Th>{lang === 'ar' ? 'إلى سنة' : 'To Year'}</Th>
                <Th>{lang === 'ar' ? 'الرصيد السابق' : 'Previous Balance'}</Th>
                <Th>{lang === 'ar' ? 'أيام الترحيل' : 'Carry Days'}</Th>
                <Th>{lang === 'ar' ? 'أيام الاستحقاق' : 'Encash Days'}</Th>
                <Th>{lang === 'ar' ? 'مبلغ الاستحقاق' : 'Encash Amount'}</Th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 px-5">
                    <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">
                      {lang === 'ar' ? 'لا يوجد سجل ترحيلات سابقة' : 'No previous carry-over records'}
                    </p>
                  </td>
                </tr>
              ) : history.map(record => (
                <Tr key={record.id}>
                  <Td className="font-bold">{getEmployeeName(record.employee_id)}</Td>
                  <Td>{record.from_year}</Td>
                  <Td>{record.to_year}</Td>
                  <Td>{record.previous_balance} {lang === 'ar' ? 'يوم' : 'days'}</Td>
                  <Td className="font-semibold text-brand-500">{record.carry_days}</Td>
                  <Td>{record.encash_days || 0}</Td>
                  <Td>
                    {record.encash_amount > 0
                      ? `${Number(record.encash_amount).toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`
                      : '\u2014'
                    }
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Confirmation Modal */}
      {confirmModal && (
        <Modal open onClose={() => setConfirmModal(false)} title={lang === 'ar' ? 'تأكيد الترحيل' : 'Confirm Carry-over'} size="sm">
          <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-3">
            <p className="text-sm text-content dark:text-content-dark">
              {lang === 'ar'
                ? `هل أنت متأكد من ترحيل أرصدة الإجازات من سنة ${fromYear} إلى سنة ${toYear}؟ سيتم تحديث أرصدة الموظفين.`
                : `Are you sure you want to carry over leave balances from ${fromYear} to ${toYear}? Employee balances will be updated.`
              }
            </p>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="m-0 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                {lang === 'ar'
                  ? 'تنبيه: هذا الإجراء لا يمكن التراجع عنه'
                  : 'Warning: This action cannot be undone'
                }
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirmModal(false)} disabled={processing}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleProcess} disabled={processing}>
              <RefreshCw size={14} className={processing ? 'animate-spin' : ''} />
              {processing
                ? (lang === 'ar' ? 'جاري المعالجة...' : 'Processing...')
                : (lang === 'ar' ? 'تأكيد الترحيل' : 'Confirm')
              }
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
