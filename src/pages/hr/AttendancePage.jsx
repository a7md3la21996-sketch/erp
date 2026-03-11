import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';
import { Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Download } from 'lucide-react';
import { KpiCard, Button, Card, CardHeader, Table, Th, Td, Tr } from '../../components/ui';

function AttendanceRow({ emp, attendance, isRTL }) {
  const recs = attendance[emp.employee_id] || [];
  const p = recs.filter(r => r.check_in && !r.absent).length;
  const a = recs.filter(r => r.absent).length;
  const l = recs.filter(r => r.check_in && !r.absent).filter(r => { const [h, m] = (r.check_in || '').split(':').map(Number); return h > 10 || (h === 10 && m > 30); }).length;
  const total = recs.length || 1;
  const rate = Math.round((p / total) * 100);
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
  const ini = name.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || '??';

  return (
    <Tr>
      <Td>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-8 h-8 rounded-[9px] bg-[#2B4C6F] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white">{ini}</span>
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className="m-0 text-[13px] font-bold text-content dark:text-content-dark">{name}</p>
            <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">{emp.employee_id}</p>
          </div>
        </div>
      </Td>
      <Td className="text-content-muted dark:text-content-muted-dark">{emp.department_ar || emp.department}</Td>
      <Td className="font-bold text-[#4A7AAB]">{p}</Td>
      <Td className="font-bold text-red-500">{a}</Td>
      <Td className="font-bold text-[#6B8DB5]">{l}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-sm bg-slate-200 dark:bg-white/[0.08]">
            <div className="h-full rounded-sm transition-[width] duration-400" style={{ width: rate + '%', background: rate >= 80 ? '#4A7AAB' : rate >= 60 ? '#6B8DB5' : '#EF4444' }} />
          </div>
          <span className="text-xs font-bold text-content dark:text-content-dark min-w-[32px]">{rate}%</span>
        </div>
      </Td>
    </Tr>
  );
}

export default function AttendancePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year] = useState(() => new Date().getFullYear());
  const allRecords = useMemo(() => getAttendanceForMonth(year, month), [year, month]);
  const attendance = useMemo(() => {
    const grouped = {};
    allRecords.forEach(r => {
      if (!grouped[r.employee_id]) grouped[r.employee_id] = [];
      grouped[r.employee_id].push(r);
    });
    return grouped;
  }, [allRecords]);
  const stats = useMemo(() => {
    let present=0, absent=0, late=0, leave=0;
    allRecords.forEach(r => {
      if (r.absent) { absent++; return; }
      if (r.check_in) {
        const [h, m] = r.check_in.split(':').map(Number);
        if (h > 10 || (h === 10 && m > 30)) late++;
        else present++;
      }
    });
    return { present, absent, late, leave };
  }, [allRecords]);
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shadow-md" style={{ background:'linear-gradient(135deg,#1B3347,#4A7AAB)' }}>
            <Clock size={22} color="#fff" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{lang==='ar'?'الحضور والغياب':'Attendance'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{MONTHS_AR[month-1]} {year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e=>setMonth(+e.target.value)} className="px-3.5 py-2 rounded-[9px] border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] cursor-pointer outline-none">
            {MONTHS_AR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <Button variant="secondary" size="sm"><Download size={14}/>{lang==='ar'?'تصدير':'Export'}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'حاضر':'Present'}  value={stats.present} color="#4A7AAB" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'غائب':'Absent'}   value={stats.absent}  color="#EF4444" />
        <KpiCard icon={AlertCircle}  label={lang==='ar'?'متأخر':'Late'}     value={stats.late}    color="#6B8DB5" />
        <KpiCard icon={Calendar}     label={lang==='ar'?'إجازة':'Leave'}    value={stats.leave}   color="#8BA8C8" />
      </div>

      {/* Attendance Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?`حضور ${MONTHS_AR[month-1]}`:`${MONTHS_AR[month-1]} Attendance`}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الموظف':'Employee', lang==='ar'?'القسم':'Dept', lang==='ar'?'حاضر':'Present', lang==='ar'?'غائب':'Absent', lang==='ar'?'متأخر':'Late', lang==='ar'?'نسبة':'Rate'].map((h,i)=>(
                <Th key={i} className={isRTL?'text-right':'text-left'}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_EMPLOYEES.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16 px-5">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <Clock size={24} color='#4A7AAB' />
                </div>
                <p className="m-0 mb-1.5 text-[15px] font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد بيانات حضور':'No Attendance Data'}</p>
                <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تسجيل أي بيانات حضور بعد':'No attendance records yet'}</p>
              </td></tr>
            ) : MOCK_EMPLOYEES.map(emp => (
              <AttendanceRow key={emp.id} emp={emp} attendance={attendance} isRTL={isRTL} />
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
