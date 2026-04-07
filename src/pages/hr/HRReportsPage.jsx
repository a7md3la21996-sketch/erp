import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { FileText, Download } from 'lucide-react';
import { Button, Card, CardHeader, Table, Th, Td, Tr, Select, PageSkeleton, ExportButton } from '../../components/ui';
import supabase from '../../lib/supabase';
import { fetchAttendance } from '../../services/attendanceService';
import { fetchEmployees } from '../../services/employeesService';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const TABS = [
  { key: 'payroll',    ar: 'تقرير المرتبات', en: 'Payroll Report' },
  { key: 'attendance', ar: 'تقرير الحضور',   en: 'Attendance Report' },
  { key: 'leave',      ar: 'تقرير الإجازات', en: 'Leave Report' },
];

export default function HRReportsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('payroll');
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Data states
  const [payrollItems, setPayrollItems] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [employees, setEmployees] = useState([]);

  // ── Load data based on active tab ──────────────────────────
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'payroll') {
      loadPayrollData();
    } else if (activeTab === 'attendance') {
      loadAttendanceData();
    } else if (activeTab === 'leave') {
      loadLeaveData();
    }
  }, [activeTab, month, year]);

  async function loadPayrollData() {
    try {
      const { data, error } = await supabase
        .from('payroll_items')
        .select('*, payroll_runs!inner(month, year)')
        .eq('payroll_runs.month', month)
        .eq('payroll_runs.year', year);
      if (error) throw error;
      setPayrollItems(data || []);
    } catch {
      setPayrollItems([]);
    }
    setLoading(false);
  }

  async function loadAttendanceData() {
    try {
      const [attData, empData] = await Promise.all([
        fetchAttendance({ month, year }),
        fetchEmployees(),
      ]);
      setAttendanceData(attData || []);
      setEmployees(empData || []);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data', 'error');
    }
    setLoading(false);
  }

  async function loadLeaveData() {
    try {
      const empData = await fetchEmployees();
      setEmployees(empData || []);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data', 'error');
    }
    setLoading(false);
  }

  // ── Payroll totals ─────────────────────────────────────────
  const payrollTotals = useMemo(() => {
    if (!payrollItems.length) return null;
    return payrollItems.reduce((acc, item) => ({
      baseSalary: acc.baseSalary + (item.base_salary || 0),
      allowances: acc.allowances + (item.total_allowances || 0),
      deductions: acc.deductions + (item.total_deductions || 0),
      netSalary: acc.netSalary + (item.net_salary || 0),
    }), { baseSalary: 0, allowances: 0, deductions: 0, netSalary: 0 });
  }, [payrollItems]);

  // ── Attendance aggregation per employee ────────────────────
  const attendanceSummary = useMemo(() => {
    if (!employees.length) return [];
    const daysInMonth = new Date(year, month, 0).getDate();

    return employees.map(emp => {
      const empRecords = attendanceData.filter(a => a.employee_id === emp.id);
      const presentDays = empRecords.filter(a => a.status === 'present' || a.status === 'late').length;
      const absentDays = empRecords.filter(a => a.status === 'absent').length;
      const lateDays = empRecords.filter(a => a.status === 'late').length;
      const lateMinutes = empRecords.reduce((sum, a) => sum + (a.late_minutes || 0), 0);
      const totalHours = empRecords.reduce((sum, a) => sum + (a.work_hours || 0), 0);
      const rate = daysInMonth > 0 ? ((presentDays / daysInMonth) * 100).toFixed(1) : '0.0';

      return {
        id: emp.id,
        name: emp.name,
        presentDays,
        absentDays,
        lateDays,
        lateMinutes,
        totalHours: totalHours.toFixed(1),
        rate,
      };
    });
  }, [employees, attendanceData, month, year]);

  const attendanceTotals = useMemo(() => {
    if (!attendanceSummary.length) return null;
    const count = attendanceSummary.length;
    return {
      presentDays: attendanceSummary.reduce((s, e) => s + e.presentDays, 0),
      absentDays: attendanceSummary.reduce((s, e) => s + e.absentDays, 0),
      lateDays: attendanceSummary.reduce((s, e) => s + e.lateDays, 0),
      lateMinutes: attendanceSummary.reduce((s, e) => s + e.lateMinutes, 0),
      totalHours: attendanceSummary.reduce((s, e) => s + parseFloat(e.totalHours), 0).toFixed(1),
      avgRate: (attendanceSummary.reduce((s, e) => s + parseFloat(e.rate), 0) / count).toFixed(1),
    };
  }, [attendanceSummary]);

  // ── Leave summary ──────────────────────────────────────────
  const leaveSummary = useMemo(() => {
    return employees
      .filter(emp => emp.leave_balance !== undefined && emp.leave_balance !== null)
      .map(emp => {
        const annual = emp.annual_leave_days || 21;
        const balance = emp.leave_balance ?? annual;
        const used = annual - balance;
        return { id: emp.id, name: emp.name, annual, balance, used: used < 0 ? 0 : used };
      });
  }, [employees]);

  // ── Export data builders ───────────────────────────────────
  const payrollExportData = useMemo(() => payrollItems.map(item => ({
    [lang === 'ar' ? 'الموظف' : 'Employee']: item.employee_name,
    [lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary']: item.base_salary,
    [lang === 'ar' ? 'البدلات' : 'Allowances']: item.total_allowances,
    [lang === 'ar' ? 'الخصومات' : 'Deductions']: item.total_deductions,
    [lang === 'ar' ? 'صافي الراتب' : 'Net Salary']: item.net_salary,
  })), [payrollItems, lang]);

  const attendanceExportData = useMemo(() => attendanceSummary.map(e => ({
    [lang === 'ar' ? 'الموظف' : 'Employee']: e.name,
    [lang === 'ar' ? 'أيام الحضور' : 'Present']: e.presentDays,
    [lang === 'ar' ? 'أيام الغياب' : 'Absent']: e.absentDays,
    [lang === 'ar' ? 'أيام التأخير' : 'Late']: e.lateDays,
    [lang === 'ar' ? 'دقائق التأخير' : 'Late Min']: e.lateMinutes,
    [lang === 'ar' ? 'الساعات' : 'Hours']: e.totalHours,
    [lang === 'ar' ? 'النسبة %' : 'Rate %']: e.rate,
  })), [attendanceSummary, lang]);

  const leaveExportData = useMemo(() => leaveSummary.map(e => ({
    [lang === 'ar' ? 'الموظف' : 'Employee']: e.name,
    [lang === 'ar' ? 'رصيد الإجازة السنوي' : 'Annual Days']: e.annual,
    [lang === 'ar' ? 'الرصيد المتبقي' : 'Remaining']: e.balance,
    [lang === 'ar' ? 'الأيام المستخدمة' : 'Used']: e.used,
  })), [leaveSummary, lang]);

  // ── Currency formatter ─────────────────────────────────────
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  // ── Year options ───────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (loading) return <PageSkeleton hasKpis={false} tableRows={8} tableCols={5} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <FileText size={18} className="text-brand-500" />
          </div>
          <h1 className="text-lg font-semibold text-content dark:text-content-dark m-0">
            {lang === 'ar' ? 'تقارير HR' : 'HR Reports'}
          </h1>
        </div>
      </div>

      {/* Tabs + Month/Year Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-[7px] rounded-md text-[13px] font-medium border-none cursor-pointer transition-all font-[inherit]
                ${activeTab === tab.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
            >
              {tab[lang] || tab.en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="!w-auto min-w-[120px]"
          >
            {(lang === 'ar' ? MONTHS_AR : MONTHS_EN).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </Select>
          <Select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="!w-auto min-w-[90px]"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* ── Tab: Payroll ──────────────────────────────────────── */}
      {activeTab === 'payroll' && (
        <Card>
          <CardHeader
            title={lang === 'ar' ? 'تقرير المرتبات' : 'Payroll Report'}
            subtitle={`${lang === 'ar' ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1]} ${year}`}
            actions={payrollItems.length > 0 && (
              <ExportButton
                data={payrollExportData}
                filename={`payroll-report-${year}-${month}`}
                title={lang === 'ar' ? 'تقرير المرتبات' : 'Payroll Report'}
              />
            )}
          />
          {payrollItems.length === 0 ? (
            <div className="p-8 text-center text-content-muted dark:text-content-muted-dark text-sm">
              {lang === 'ar'
                ? 'شغّل المسير الأول من صفحة الرواتب'
                : 'Run the first payroll from the Payroll page'}
            </div>
          ) : (
            <Table>
              <thead>
                <Tr>
                  <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                  <Th>{lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</Th>
                  <Th>{lang === 'ar' ? 'البدلات' : 'Allowances'}</Th>
                  <Th>{lang === 'ar' ? 'الخصومات' : 'Deductions'}</Th>
                  <Th>{lang === 'ar' ? 'صافي الراتب' : 'Net Salary'}</Th>
                </Tr>
              </thead>
              <tbody>
                {payrollItems.map(item => (
                  <Tr key={item.id}>
                    <Td className="font-medium">{item.employee_name}</Td>
                    <Td>{fmt(item.base_salary)}</Td>
                    <Td className="text-green-600 dark:text-green-400">{fmt(item.total_allowances)}</Td>
                    <Td className="text-red-500">{fmt(item.total_deductions)}</Td>
                    <Td className="font-semibold">{fmt(item.net_salary)}</Td>
                  </Tr>
                ))}
                {payrollTotals && (
                  <Tr className="bg-gray-50 dark:bg-white/5 font-semibold">
                    <Td>{lang === 'ar' ? 'الإجمالي' : 'Total'}</Td>
                    <Td>{fmt(payrollTotals.baseSalary)}</Td>
                    <Td className="text-green-600 dark:text-green-400">{fmt(payrollTotals.allowances)}</Td>
                    <Td className="text-red-500">{fmt(payrollTotals.deductions)}</Td>
                    <Td className="font-bold">{fmt(payrollTotals.netSalary)}</Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Tab: Attendance ───────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <Card>
          <CardHeader
            title={lang === 'ar' ? 'تقرير الحضور' : 'Attendance Report'}
            subtitle={`${lang === 'ar' ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1]} ${year}`}
            actions={attendanceSummary.length > 0 && (
              <ExportButton
                data={attendanceExportData}
                filename={`attendance-report-${year}-${month}`}
                title={lang === 'ar' ? 'تقرير الحضور' : 'Attendance Report'}
              />
            )}
          />
          {attendanceSummary.length === 0 ? (
            <div className="p-8 text-center text-content-muted dark:text-content-muted-dark text-sm">
              {lang === 'ar' ? 'لا توجد بيانات حضور' : 'No attendance data'}
            </div>
          ) : (
            <Table>
              <thead>
                <Tr>
                  <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                  <Th>{lang === 'ar' ? 'أيام الحضور' : 'Present'}</Th>
                  <Th>{lang === 'ar' ? 'أيام الغياب' : 'Absent'}</Th>
                  <Th>{lang === 'ar' ? 'أيام التأخير' : 'Late'}</Th>
                  <Th>{lang === 'ar' ? 'دقائق التأخير' : 'Late Min'}</Th>
                  <Th>{lang === 'ar' ? 'إجمالي الساعات' : 'Total Hours'}</Th>
                  <Th>{lang === 'ar' ? 'نسبة الحضور %' : 'Rate %'}</Th>
                </Tr>
              </thead>
              <tbody>
                {attendanceSummary.map(emp => (
                  <Tr key={emp.id}>
                    <Td className="font-medium">{emp.name}</Td>
                    <Td>{emp.presentDays}</Td>
                    <Td className="text-red-500">{emp.absentDays}</Td>
                    <Td className="text-amber-500">{emp.lateDays}</Td>
                    <Td>{emp.lateMinutes}</Td>
                    <Td>{emp.totalHours}</Td>
                    <Td>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${parseFloat(emp.rate) >= 90 ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
                          parseFloat(emp.rate) >= 70 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                          'bg-red-500/15 text-red-500'}`}
                      >
                        {emp.rate}%
                      </span>
                    </Td>
                  </Tr>
                ))}
                {attendanceTotals && (
                  <Tr className="bg-gray-50 dark:bg-white/5 font-semibold">
                    <Td>{lang === 'ar' ? 'الإجمالي / المتوسط' : 'Total / Average'}</Td>
                    <Td>{attendanceTotals.presentDays}</Td>
                    <Td className="text-red-500">{attendanceTotals.absentDays}</Td>
                    <Td className="text-amber-500">{attendanceTotals.lateDays}</Td>
                    <Td>{attendanceTotals.lateMinutes}</Td>
                    <Td>{attendanceTotals.totalHours}</Td>
                    <Td className="font-bold">{attendanceTotals.avgRate}%</Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Tab: Leave ────────────────────────────────────────── */}
      {activeTab === 'leave' && (
        <Card>
          <CardHeader
            title={lang === 'ar' ? 'تقرير الإجازات' : 'Leave Report'}
            actions={leaveSummary.length > 0 && (
              <ExportButton
                data={leaveExportData}
                filename={`leave-report-${year}`}
                title={lang === 'ar' ? 'تقرير الإجازات' : 'Leave Report'}
              />
            )}
          />
          {leaveSummary.length === 0 ? (
            <div className="p-8 text-center text-content-muted dark:text-content-muted-dark text-sm">
              {lang === 'ar' ? 'لا توجد بيانات إجازات' : 'No leave data'}
            </div>
          ) : (
            <Table>
              <thead>
                <Tr>
                  <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
                  <Th>{lang === 'ar' ? 'رصيد الإجازة السنوي' : 'Annual Leave Days'}</Th>
                  <Th>{lang === 'ar' ? 'الرصيد المتبقي' : 'Remaining Balance'}</Th>
                  <Th>{lang === 'ar' ? 'الأيام المستخدمة' : 'Used Days'}</Th>
                </Tr>
              </thead>
              <tbody>
                {leaveSummary.map(emp => (
                  <Tr key={emp.id}>
                    <Td className="font-medium">{emp.name}</Td>
                    <Td>{emp.annual}</Td>
                    <Td className="text-green-600 dark:text-green-400 font-medium">{emp.balance}</Td>
                    <Td className={emp.used > 0 ? 'text-amber-500 font-medium' : ''}>{emp.used}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
