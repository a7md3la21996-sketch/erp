import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { useToast } from '../../contexts/ToastContext';
import { DollarSign, TrendingUp, Users, FileText, ChevronDown, Download } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Tr, Td, Th, PageSkeleton, ExportButton, Select, Pagination, SmartFilter, applySmartFilters } from '../../components/ui';


const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const TAX_RATE = 0.14;
const SOCIAL_INSURANCE_RATE = 0.11;
const ALLOWANCE_RATE = 0.20;

export default function PayrollPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const { auditFields, applyAuditFilters } = useAuditFilter('payroll');
  const { showToast } = useToast();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);

  useEffect(() => {
    fetchEmployees().then(data => { setEmployees(data); setLoading(false); });
  }, []);

  const totalSalaries = useMemo(() => employees.reduce((s,e)=>s+(e.salary||0),0), [employees]);
  const avgSalary = employees.length ? Math.round(totalSalaries / employees.length) : 0;

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'full_name_ar', label: 'اسم الموظف', labelEn: 'Employee Name', type: 'text',
      resolve: (row) => (isRTL ? row.full_name_ar : row.full_name_en) || row.full_name_ar,
    },
    {
      id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: [...new Set(employees.map(e => e.department).filter(Boolean))].map(d => ({ value: d, label: d, labelEn: d })),
    },
    {
      id: 'salary', label: 'الراتب', labelEn: 'Salary', type: 'number',
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'active', label: 'نشط', labelEn: 'Active' },
        { value: 'inactive', label: 'غير نشط', labelEn: 'Inactive' },
      ],
    },
    ...auditFields,
  ], [auditFields, employees, isRTL]);

  const filtered = useMemo(() => {
    let result = employees;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [employees, smartFilters, SMART_FIELDS]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [month, smartFilters]);

  const handleRunPayroll = useCallback(() => {
    if (!employees.length) return;

    const payrollItems = employees
      .filter(emp => emp.status === 'active' || !emp.status)
      .map(emp => {
        const baseSalary = emp.salary || 0;
        const allowances = Math.round(baseSalary * ALLOWANCE_RATE);
        const absentDays = emp.absent_days || 0;
        const dailyRate = Math.round(baseSalary / 30);
        const absentDeduction = absentDays * dailyRate;
        const tax = Math.round(baseSalary * TAX_RATE);
        const socialInsurance = Math.round(baseSalary * SOCIAL_INSURANCE_RATE);
        const totalDeductions = tax + socialInsurance + absentDeduction;
        const netSalary = baseSalary + allowances - totalDeductions;

        return {
          employee_id: emp.id,
          employee_name_ar: emp.full_name_ar,
          employee_name_en: emp.full_name_en,
          department: emp.department,
          base_salary: baseSalary,
          allowances,
          tax,
          social_insurance: socialInsurance,
          absent_days: absentDays,
          absent_deduction: absentDeduction,
          total_deductions: totalDeductions,
          net_salary: netSalary,
        };
      });

    const payrollRun = {
      id: `PR-${Date.now()}`,
      month,
      year: 2026,
      run_date: new Date().toISOString(),
      total_employees: payrollItems.length,
      total_net: payrollItems.reduce((sum, item) => sum + item.net_salary, 0),
      total_gross: payrollItems.reduce((sum, item) => sum + item.base_salary + item.allowances, 0),
      total_deductions: payrollItems.reduce((sum, item) => sum + item.total_deductions, 0),
      items: payrollItems,
      status: 'completed',
    };

    // Save to Supabase
    import('../../lib/supabase').then(({ default: supabase }) => {
      supabase.from('system_config')
        .upsert({ key: 'payroll_runs', value: [...(payrollRuns || []), payrollRun], updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .catch(() => {});
    }).catch(() => {});

    showToast(
      lang === 'ar'
        ? `تم تشغيل مسير رواتب ${MONTHS_AR[month - 1]} بنجاح - ${payrollItems.length} موظف`
        : `Payroll for ${MONTHS_AR[month - 1]} processed successfully - ${payrollItems.length} employees`,
      'success'
    );
  }, [employees, month, lang, showToast]);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={7} />
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
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'مسير الرواتب':'Payroll'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{MONTHS_AR[month-1]} 2026</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative inline-flex items-center">
            <Select value={month} onChange={e=>setMonth(+e.target.value)}
              className="appearance-none pe-8"
            >
              {MONTHS_AR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </Select>
            <ChevronDown size={14} className="absolute end-2.5 pointer-events-none text-content-muted dark:text-content-muted-dark" />
          </div>
          <ExportButton
            data={employees.map(e => ({
              name: isRTL ? e.full_name_ar : e.full_name_en,
              department: e.department,
              salary: e.salary,
              status: e.status,
            }))}
            filename={isRTL ? 'مسير_الرواتب' : 'payroll'}
            title={isRTL ? 'مسير الرواتب' : 'Payroll'}
            columns={[
              { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
              { header: isRTL ? 'القسم' : 'Department', key: 'department' },
              { header: isRTL ? 'الراتب' : 'Salary', key: 'salary' },
              { header: isRTL ? 'الحالة' : 'Status', key: 'status' },
            ]}
          />
          <Button size="md" onClick={handleRunPayroll}>{lang==='ar'?'تشغيل المسير':'Run Payroll'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={DollarSign} label={lang==='ar'?'إجمالي الرواتب':'Total Salaries'} value={(totalSalaries/1000).toFixed(0)+'K'} sub="EGP" color="#1B3347" />
        <KpiCard icon={Users} label={lang==='ar'?'عدد الموظفين':'Employees'} value={employees.length} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang==='ar'?'متوسط الراتب':'Avg Salary'} value={(avgSalary/1000).toFixed(1)+'K'} sub="EGP" color="#6B8DB5" />
        <KpiCard icon={FileText} label={lang==='ar'?'تم الصرف':'Processed'} value={employees.length} color="#2B4C6F" />
      </div>

      {/* Smart Filters */}
      <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />

      <Card className="!rounded-xl overflow-hidden">
        <div className={`px-4 py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?`مسير ${MONTHS_AR[month-1]}`:`${MONTHS_AR[month-1]} Payroll`}</p>
          <Button variant="secondary" size="sm">
            <Download size={13} />{lang==='ar'?'تصدير':'Export'}
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الموظف':'Employee',lang==='ar'?'الراتب الأساسي':'Base Salary',lang==='ar'?'البدلات':'Allowances',lang==='ar'?'الاستقطاعات':'Deductions',lang==='ar'?'الصافي':'Net Pay',lang==='ar'?'الحالة':'Status',''].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>{paged.map(emp=>(
            <PayrollRow key={emp.id} emp={emp} isRTL={isRTL} lang={lang} />
          ))}</tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>
    </div>
  );
}

function PayrollRow({ emp, isRTL, lang }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  const base = emp.salary || 0;
  const allow = Math.round(base * ALLOWANCE_RATE);
  const tax = Math.round(base * TAX_RATE);
  const social = Math.round(base * SOCIAL_INSURANCE_RATE);
  const ded = tax + social;
  const net = base + allow - ded;
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  return (
    <Tr>
      <Td>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="text-start">
            <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{name}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{emp.employee_id}</p>
          </div>
        </div>
      </Td>
      <Td>{base.toLocaleString()} ج.م</Td>
      <Td className="text-brand-500 font-semibold">+{allow.toLocaleString()}</Td>
      <Td className="text-red-500 font-semibold">-{ded.toLocaleString()}</Td>
      <Td className="font-bold">{net.toLocaleString()} ج.م</Td>
      <Td>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/15 text-brand-500 border border-brand-500/30">
          {lang === 'ar' ? 'تم الصرف' : 'Paid'}
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
