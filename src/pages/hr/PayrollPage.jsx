import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { fetchAttendance } from '../../services/attendanceService';
import { loadPayrollConfig, savePayrollConfig, calcEmployeeAttendance, calcProRatedSalary, DEFAULT_PAYROLL_CONFIG } from '../../config/payrollConfig';
import supabase from '../../lib/supabase';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { useToast } from '../../contexts/ToastContext';
import { DollarSign, TrendingUp, Users, FileText, ChevronDown, Download, Settings, Clock, AlertTriangle } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Tr, Td, Th, PageSkeleton, ExportButton, Select, Modal, ModalFooter, Pagination, SmartFilter, applySmartFilters } from '../../components/ui';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default function PayrollPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { auditFields, applyAuditFilters } = useAuditFilter('payroll');
  const { showToast } = useToast();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year] = useState(() => new Date().getFullYear());
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [config, setConfig] = useState(DEFAULT_PAYROLL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [salaryHistories, setSalaryHistories] = useState({});

  // Load data
  useEffect(() => {
    Promise.all([
      fetchEmployees(),
      loadPayrollConfig(),
    ]).then(async ([empData, cfgData]) => {
      setEmployees(empData);
      setConfig(cfgData);

      // Load salary history for all employees
      const { data: allHistory } = await supabase
        .from('salary_history')
        .select('*')
        .order('effective_date', { ascending: true });

      const grouped = {};
      (allHistory || []).forEach(h => {
        if (!grouped[h.employee_id]) grouped[h.employee_id] = [];
        grouped[h.employee_id].push(h);
      });
      setSalaryHistories(grouped);

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchAttendance({ month, year }).then(setAttendance);
  }, [month, year]);

  // Group attendance by employee
  const attendanceByEmp = useMemo(() => {
    const grouped = {};
    attendance.forEach(r => {
      if (!grouped[r.employee_id]) grouped[r.employee_id] = [];
      grouped[r.employee_id].push(r);
    });
    return grouped;
  }, [attendance]);

  // Calculate payroll for each employee
  const payrollData = useMemo(() => {
    return employees.map(emp => {
      const empAttendance = attendanceByEmp[emp.id] || [];
      const shiftName = emp.shift || config.default_shift || 'فترة الدوام1';
      const shiftConfig = config.shifts?.[shiftName] || config.shifts?.['فترة الدوام1'] || Object.values(config.shifts || {})[0];

      const stats = calcEmployeeAttendance(empAttendance, shiftConfig);

      const empHistory = salaryHistories[emp.id] || [];
      const baseSalary = empHistory.length > 0
        ? calcProRatedSalary(empHistory, month, year, emp.salary)
        : (emp.salary || emp.base_salary || 0);
      const dailyRate = baseSalary / 30;
      const hoursPerDay = shiftConfig
        ? (parseInt(shiftConfig.official_end) || 18) - (parseInt(shiftConfig.official_start) || 10)
        : 8;
      const minuteRate = baseSalary / (30 * hoursPerDay * 60);

      // Late deduction: late minutes × penalty multiplier × minute rate
      const penaltyMultiplier = config.late_penalty_multiplier || 2;
      const lateDeduction = Math.round(stats.totalLateMinutes * penaltyMultiplier * minuteRate);

      // Absent deduction
      const absentDeduction = Math.round(stats.absentDays * dailyRate);

      // Allowances
      const allowances = Math.round(baseSalary * (config.allowance_rate || 0.20));

      // Tax & Insurance
      const tax = Math.round(baseSalary * (config.tax_rate || 0.14));
      const socialInsurance = Math.round(baseSalary * (config.social_insurance_rate || 0.11));

      // Total deductions
      const totalDeductions = tax + socialInsurance + lateDeduction + absentDeduction;

      // Overtime bonus (if any)
      const overtimeBonus = Math.round(stats.totalOvertimeMinutes * minuteRate * 1.5);

      // Net salary
      const netSalary = baseSalary + allowances + overtimeBonus - totalDeductions;

      return {
        ...emp,
        stats,
        baseSalary,
        allowances,
        tax,
        socialInsurance,
        lateDeduction,
        absentDeduction,
        overtimeBonus,
        totalDeductions,
        netSalary,
        hasAttendance: empAttendance.length > 0,
      };
    });
  }, [employees, attendanceByEmp, config, salaryHistories, month, year]);

  const totalSalaries = useMemo(() => payrollData.reduce((s, e) => s + e.baseSalary, 0), [payrollData]);
  const totalNet = useMemo(() => payrollData.reduce((s, e) => s + e.netSalary, 0), [payrollData]);
  const avgSalary = employees.length ? Math.round(totalSalaries / employees.length) : 0;
  const empWithAttendance = payrollData.filter(e => e.hasAttendance).length;

  const SMART_FIELDS = useMemo(() => [
    { id: 'full_name_ar', label: 'اسم الموظف', labelEn: 'Employee Name', type: 'text', resolve: (row) => (isRTL ? row.full_name_ar : row.full_name_en) || row.full_name_ar },
    { id: 'department', label: 'القسم', labelEn: 'Department', type: 'select', options: [...new Set(employees.map(e => e.department).filter(Boolean))].map(d => ({ value: d, label: d, labelEn: d })) },
    { id: 'salary', label: 'الراتب', labelEn: 'Salary', type: 'number' },
    { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: [{ value: 'active', label: 'نشط', labelEn: 'Active' }, { value: 'inactive', label: 'غير نشط', labelEn: 'Inactive' }] },
    ...auditFields,
  ], [auditFields, employees, isRTL]);

  const filtered = useMemo(() => {
    let result = payrollData;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [payrollData, smartFilters, SMART_FIELDS]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [month, smartFilters]);

  const handleRunPayroll = useCallback(() => {
    if (!payrollData.length) return;
    const activeEmployees = payrollData.filter(emp => emp.status === 'active' || !emp.status);

    const payrollRun = {
      id: `PR-${Date.now()}`,
      month,
      year,
      run_date: new Date().toISOString(),
      total_employees: activeEmployees.length,
      total_net: activeEmployees.reduce((sum, e) => sum + e.netSalary, 0),
      total_gross: activeEmployees.reduce((sum, e) => sum + e.baseSalary + e.allowances, 0),
      total_deductions: activeEmployees.reduce((sum, e) => sum + e.totalDeductions, 0),
      items: activeEmployees.map(e => ({
        employee_id: e.id,
        employee_name_ar: e.full_name_ar,
        employee_name_en: e.full_name_en,
        department: e.department,
        base_salary: e.baseSalary,
        allowances: e.allowances,
        tax: e.tax,
        social_insurance: e.socialInsurance,
        late_deduction: e.lateDeduction,
        absent_deduction: e.absentDeduction,
        overtime_bonus: e.overtimeBonus,
        total_deductions: e.totalDeductions,
        net_salary: e.netSalary,
        present_days: e.stats.presentDays,
        absent_days: e.stats.absentDays,
        late_minutes: e.stats.totalLateMinutes,
        overtime_minutes: e.stats.totalOvertimeMinutes,
      })),
      status: 'completed',
    };

    import('../../lib/supabase').then(({ default: supabase }) => {
      supabase.from('system_config')
        .upsert({ key: `payroll_run_${year}_${month}`, value: payrollRun, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .catch(() => {});
    }).catch(() => {});

    showToast(
      lang === 'ar'
        ? `تم تشغيل مسير رواتب ${MONTHS_AR[month - 1]} بنجاح - ${activeEmployees.length} موظف`
        : `Payroll for ${MONTHS_AR[month - 1]} processed successfully - ${activeEmployees.length} employees`,
      'success'
    );
  }, [payrollData, month, year, lang, showToast]);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={8} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <DollarSign size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'مسير الرواتب' : 'Payroll'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{MONTHS_AR[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative inline-flex items-center">
            <Select value={month} onChange={e => setMonth(+e.target.value)} className="appearance-none pe-8">
              {MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <ChevronDown size={14} className="absolute end-2.5 pointer-events-none text-content-muted dark:text-content-muted-dark" />
          </div>
          <Button variant="secondary" size="md" onClick={() => setShowSettings(true)}>
            <Settings size={14} />{lang === 'ar' ? 'الإعدادات' : 'Settings'}
          </Button>
          <ExportButton
            data={payrollData.map(e => ({
              name: isRTL ? e.full_name_ar : e.full_name_en,
              department: e.department,
              base_salary: e.baseSalary,
              allowances: e.allowances,
              late_deduction: e.lateDeduction,
              absent_deduction: e.absentDeduction,
              overtime_bonus: e.overtimeBonus,
              tax: e.tax,
              social_insurance: e.socialInsurance,
              total_deductions: e.totalDeductions,
              net_salary: e.netSalary,
              present_days: e.stats.presentDays,
              absent_days: e.stats.absentDays,
              late_minutes: e.stats.totalLateMinutes,
            }))}
            filename={isRTL ? 'مسير_الرواتب' : 'payroll'}
            title={isRTL ? 'مسير الرواتب' : 'Payroll'}
            columns={[
              { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
              { header: isRTL ? 'القسم' : 'Department', key: 'department' },
              { header: isRTL ? 'الأساسي' : 'Base', key: 'base_salary' },
              { header: isRTL ? 'البدلات' : 'Allowances', key: 'allowances' },
              { header: isRTL ? 'خصم التأخير' : 'Late Ded.', key: 'late_deduction' },
              { header: isRTL ? 'خصم الغياب' : 'Absent Ded.', key: 'absent_deduction' },
              { header: isRTL ? 'إضافي' : 'Overtime', key: 'overtime_bonus' },
              { header: isRTL ? 'الضرايب' : 'Tax', key: 'tax' },
              { header: isRTL ? 'التأمينات' : 'Insurance', key: 'social_insurance' },
              { header: isRTL ? 'الصافي' : 'Net', key: 'net_salary' },
            ]}
          />
          <Button size="md" onClick={handleRunPayroll}>{lang === 'ar' ? 'تشغيل المسير' : 'Run Payroll'}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={DollarSign} label={lang === 'ar' ? 'صافي الرواتب' : 'Net Salaries'} value={(totalNet / 1000).toFixed(0) + 'K'} sub="EGP" color="#1B3347" />
        <KpiCard icon={Users} label={lang === 'ar' ? 'عدد الموظفين' : 'Employees'} value={employees.length} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang === 'ar' ? 'متوسط الراتب' : 'Avg Salary'} value={(avgSalary / 1000).toFixed(1) + 'K'} sub="EGP" color="#6B8DB5" />
        <KpiCard icon={Clock} label={lang === 'ar' ? 'لديهم حضور' : 'With Attendance'} value={empWithAttendance} sub={`/ ${employees.length}`} color="#2B4C6F" />
      </div>

      {/* Warning if no attendance data */}
      {empWithAttendance === 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-3 mb-5">
          <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="m-0 text-sm text-yellow-700 dark:text-yellow-300">
            {lang === 'ar'
              ? 'لا توجد بيانات حضور لهذا الشهر. ارفع شيت البصمة من صفحة الحضور والغياب عشان الحسابات تكون دقيقة.'
              : 'No attendance data for this month. Upload fingerprint sheet from Attendance page for accurate calculations.'}
          </p>
        </div>
      )}

      <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />

      <Card className="!rounded-xl overflow-hidden">
        <div className={`px-4 py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? `مسير ${MONTHS_AR[month - 1]}` : `${MONTHS_AR[month - 1]} Payroll`}</p>
          <Button variant="secondary" size="sm">
            <Download size={13} />{lang === 'ar' ? 'تصدير' : 'Export'}
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'الأساسي' : 'Base',
                lang === 'ar' ? 'البدلات' : 'Allowances',
                lang === 'ar' ? 'الحضور' : 'Attendance',
                lang === 'ar' ? 'التأخير' : 'Late',
                lang === 'ar' ? 'الاستقطاعات' : 'Deductions',
                lang === 'ar' ? 'الصافي' : 'Net Pay',
                lang === 'ar' ? 'الحالة' : 'Status',
                '',
              ].map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {paged.map(emp => (
              <PayrollRow key={emp.id} emp={emp} isRTL={isRTL} lang={lang} config={config} />
            ))}
          </tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>

      {/* Payroll Settings Modal */}
      {showSettings && (
        <PayrollSettingsModal
          config={config}
          onSave={(newConfig) => { setConfig(newConfig); savePayrollConfig(newConfig); setShowSettings(false); showToast(lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved', 'success'); }}
          onClose={() => setShowSettings(false)}
          lang={lang}
          isRTL={isRTL}
        />
      )}
    </div>
  );
}

// ── Payroll Row ──────────────────────────────────────────────

function PayrollRow({ emp, isRTL, lang, config }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const penaltyMult = config.late_penalty_multiplier || 2;

  return (
    <Tr>
      <Td>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="text-start">
            <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{name}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{emp.employee_id || emp.employee_number}</p>
          </div>
        </div>
      </Td>
      <Td>{emp.baseSalary.toLocaleString()} ج.م</Td>
      <Td className="text-brand-500 font-semibold">+{emp.allowances.toLocaleString()}</Td>
      <Td>
        <div className="text-xs">
          <span className="font-bold text-green-600">{emp.stats.presentDays}</span>
          <span className="text-content-muted dark:text-content-muted-dark"> {lang === 'ar' ? 'حضور' : 'days'}</span>
          {emp.stats.absentDays > 0 && (
            <>
              <span className="mx-1">·</span>
              <span className="font-bold text-red-500">{emp.stats.absentDays}</span>
              <span className="text-content-muted dark:text-content-muted-dark"> {lang === 'ar' ? 'غياب' : 'absent'}</span>
            </>
          )}
        </div>
      </Td>
      <Td>
        {emp.stats.totalLateMinutes > 0 ? (
          <div className="text-xs">
            <span className="font-bold text-yellow-600">{emp.stats.totalLateMinutes}</span>
            <span className="text-content-muted dark:text-content-muted-dark"> {lang === 'ar' ? `د × ${penaltyMult}` : `m × ${penaltyMult}`}</span>
            <p className="m-0 text-red-500 font-semibold">-{emp.lateDeduction.toLocaleString()}</p>
          </div>
        ) : (
          <span className="text-xs text-green-500">{lang === 'ar' ? 'لا تأخير' : 'No late'}</span>
        )}
      </Td>
      <Td className="text-red-500 font-semibold">-{emp.totalDeductions.toLocaleString()}</Td>
      <Td className="font-bold">{emp.netSalary.toLocaleString()} ج.م</Td>
      <Td>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          emp.hasAttendance
            ? 'bg-brand-500/15 text-brand-500 border border-brand-500/30'
            : 'bg-yellow-500/15 text-yellow-600 border border-yellow-500/30'
        }`}>
          {emp.hasAttendance
            ? (lang === 'ar' ? 'محسوب' : 'Calculated')
            : (lang === 'ar' ? 'بدون بصمة' : 'No Data')}
        </span>
      </Td>
      <Td>
        <Button variant="ghost" size="sm">
          <FileText size={12} />Payslip
        </Button>
      </Td>
    </Tr>
  );
}

// ── Payroll Settings Modal ───────────────────────────────────

function PayrollSettingsModal({ config, onSave, onClose, lang, isRTL }) {
  const [draft, setDraft] = useState({ ...config });

  const updateField = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));
  const updateShift = (shiftKey, field, value) => {
    setDraft(prev => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [shiftKey]: { ...prev.shifts[shiftKey], [field]: value },
      },
    }));
  };

  return (
    <Modal open onClose={onClose} title={lang === 'ar' ? 'إعدادات المرتبات' : 'Payroll Settings'} size="lg">
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">
        {/* Global rates */}
        <div>
          <h3 className="text-sm font-bold text-content dark:text-content-dark mb-3">{lang === 'ar' ? 'النسب العامة' : 'Global Rates'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SettingInput label={lang === 'ar' ? 'الضرايب %' : 'Tax %'} value={Math.round(draft.tax_rate * 100)} onChange={v => updateField('tax_rate', v / 100)} type="number" />
            <SettingInput label={lang === 'ar' ? 'التأمينات %' : 'Insurance %'} value={Math.round(draft.social_insurance_rate * 100)} onChange={v => updateField('social_insurance_rate', v / 100)} type="number" />
            <SettingInput label={lang === 'ar' ? 'البدلات %' : 'Allowances %'} value={Math.round(draft.allowance_rate * 100)} onChange={v => updateField('allowance_rate', v / 100)} type="number" />
            <SettingInput label={lang === 'ar' ? 'مضاعف التأخير' : 'Late Penalty ×'} value={draft.late_penalty_multiplier} onChange={v => updateField('late_penalty_multiplier', v)} type="number" />
          </div>
        </div>

        {/* Shifts */}
        <div>
          <h3 className="text-sm font-bold text-content dark:text-content-dark mb-3">{lang === 'ar' ? 'فترات الدوام' : 'Work Shifts'}</h3>
          {Object.entries(draft.shifts || {}).map(([key, shift]) => (
            <div key={key} className="border border-edge dark:border-edge-dark rounded-xl p-3 mb-3">
              <p className="m-0 text-sm font-bold text-brand-500 mb-2">{shift.name_ar || key}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SettingInput label={lang === 'ar' ? 'بداية الدوام' : 'Start'} value={shift.official_start} onChange={v => updateShift(key, 'official_start', v)} type="time" />
                <SettingInput label={lang === 'ar' ? 'نهاية الدوام' : 'End'} value={shift.official_end} onChange={v => updateShift(key, 'official_end', v)} type="time" />
                <SettingInput label={lang === 'ar' ? 'حد التأخير' : 'Late After'} value={shift.late_threshold} onChange={v => updateShift(key, 'late_threshold', v)} type="time" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        <Button onClick={() => onSave(draft)}>{lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}</Button>
      </ModalFooter>
    </Modal>
  );
}

function SettingInput({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(type === 'number' ? +e.target.value : e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
      />
    </div>
  );
}
