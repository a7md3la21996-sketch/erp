import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { DollarSign, TrendingUp, Users, FileText, ChevronDown, Download } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Tr, Td, Th, PageSkeleton, ExportButton } from '../../components/ui';


const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default function PayrollPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees().then(data => { setEmployees(data); setLoading(false); });
  }, []);

  const totalSalaries = useMemo(() => employees.reduce((s,e)=>s+(e.salary||0),0), [employees]);
  const avgSalary = employees.length ? Math.round(totalSalaries / employees.length) : 0;

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
            <select value={month} onChange={e=>setMonth(+e.target.value)}
              className="appearance-none px-3.5 py-2 pe-8 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs cursor-pointer outline-none focus:border-brand-500"
            >
              {MONTHS_AR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
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
          <Button size="md">{lang==='ar'?'تشغيل المسير':'Run Payroll'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={DollarSign} label={lang==='ar'?'إجمالي الرواتب':'Total Salaries'} value={(totalSalaries/1000).toFixed(0)+'K'} sub="EGP" color="#1B3347" />
        <KpiCard icon={Users} label={lang==='ar'?'عدد الموظفين':'Employees'} value={employees.length} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang==='ar'?'متوسط الراتب':'Avg Salary'} value={(avgSalary/1000).toFixed(1)+'K'} sub="EGP" color="#6B8DB5" />
        <KpiCard icon={FileText} label={lang==='ar'?'تم الصرف':'Processed'} value={employees.length} color="#2B4C6F" />
      </div>

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
          <tbody>{employees.map(emp=>(
            <PayrollRow key={emp.id} emp={emp} isRTL={isRTL} lang={lang} />
          ))}</tbody>
        </Table>
      </Card>
    </div>
  );
}

function PayrollRow({ emp, isRTL, lang }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  const base = emp.salary || 0;
  const allow = Math.round(base * 0.2);
  const ded = Math.round(base * 0.1);
  const net = base + allow - ded;
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  return (
    <Tr>
      <Td>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          <div className="text-start">
            <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{name}</p>
            <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">{emp.employee_id}</p>
          </div>
        </div>
      </Td>
      <Td>{base.toLocaleString()} ج.م</Td>
      <Td className="text-brand-500 font-semibold">+{allow.toLocaleString()}</Td>
      <Td className="text-red-500 font-semibold">-{ded.toLocaleString()}</Td>
      <Td className="font-bold">{net.toLocaleString()} ج.م</Td>
      <Td>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/15 text-brand-500 border border-brand-500/30">
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
