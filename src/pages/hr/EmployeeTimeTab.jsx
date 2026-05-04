import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../../lib/supabase';
import { Clock, CalendarOff, CheckCircle2, XCircle, AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui';
import { fetchAttendance } from '../../services/attendanceService';

export default function EmployeeTimeTab({ emp, isRTL, lang }) {
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    if (!emp?.id) { setLoading(false); return; }
    let cancelled = false;
    Promise.all([
      fetchAttendance({ month, year, employeeId: emp.id }),
      supabase.from('leave_requests').select('*').eq('employee_id', emp.id).order('start_date', { ascending: false }).limit(5),
      supabase.from('employee_shifts').select('*, shifts(*)').eq('employee_id', emp.id).order('start_date', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([att, leaveRes, shiftRes]) => {
      if (cancelled) return;
      setAttendance(att || []);
      setLeaves(leaveRes.data || []);
      setShift(shiftRes.data || null);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [emp?.id, month, year]);

  const stats = useMemo(() => {
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const onLeave = attendance.filter(a => a.status === 'leave').length;
    const totalHours = attendance.reduce((s, a) => s + (Number(a.work_hours) || 0), 0);
    return { present, absent, late, onLeave, totalHours: totalHours.toFixed(1) };
  }, [attendance]);

  const monthName = new Date(year, month - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {[1,2,3,4].map(i => (
        <Card key={i} className="p-5 animate-pulse">
          <div className="h-4 bg-edge dark:bg-edge-dark rounded w-32 mb-4" />
          <div className="h-3 bg-edge dark:bg-edge-dark rounded w-full mb-2" />
          <div className="h-3 bg-edge dark:bg-edge-dark rounded w-3/4" />
        </Card>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Attendance summary */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Clock size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? `حضور ${monthName}` : `${monthName} attendance`}</p>
          </div>
          <Link to={`/hr/attendance/${emp.id}`} className="text-[11px] font-semibold text-brand-500 hover:underline inline-flex items-center gap-0.5">
            {isRTL ? 'التفاصيل' : 'Details'}
            <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
          </Link>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          <StatTile icon={CheckCircle2} label={isRTL ? 'حضور' : 'Present'} value={stats.present} color="#10B981" isRTL={isRTL} />
          <StatTile icon={XCircle} label={isRTL ? 'غياب' : 'Absent'} value={stats.absent} color="#EF4444" isRTL={isRTL} />
          <StatTile icon={AlertCircle} label={isRTL ? 'تأخير' : 'Late'} value={stats.late} color="#F59E0B" isRTL={isRTL} />
          <StatTile icon={CalendarOff} label={isRTL ? 'إجازة' : 'On Leave'} value={stats.onLeave} color="#4A7AAB" isRTL={isRTL} />
          <div className={`col-span-2 mt-1 pt-3 border-t border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي الساعات' : 'Total Hours'}</span>
            <span className="text-sm font-bold text-brand-500 tabular-nums">{stats.totalHours}h</span>
          </div>
        </div>
      </Card>

      {/* Leave balance + recent leaves */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CalendarOff size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الإجازات' : 'Leave'}</p>
          </div>
          <Link to="/hr/leave" className="text-[11px] font-semibold text-brand-500 hover:underline">
            {isRTL ? 'إدارة' : 'Manage'}
          </Link>
        </div>
        <div className="px-5 py-4">
          <div className={`flex items-center justify-between mb-4 pb-3 border-b border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'الرصيد المتبقي' : 'Balance'}</span>
            <span className="text-lg font-extrabold text-brand-500">{emp.leave_balance ?? '—'} <span className="text-[10px] font-normal text-content-muted">{isRTL ? 'يوم' : 'days'}</span></span>
          </div>
          {leaves.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-2">{isRTL ? 'لا توجد طلبات إجازة' : 'No leave requests'}</p>
          ) : leaves.map(l => (
            <div key={l.id} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs font-semibold text-content dark:text-content-dark">{l.type || '—'}</span>
                <StatusBadge status={l.status} isRTL={isRTL} />
              </div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5">
                {l.start_date} → {l.end_date} {l.days ? `(${l.days} ${isRTL ? 'يوم' : 'd'})` : ''}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Current shift */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Calendar size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الشيفت الحالي' : 'Current Shift'}</p>
        </div>
        <div className="px-5 py-4">
          {!shift ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-3">{isRTL ? 'لم يتم تعيين شيفت' : 'No shift assigned'}</p>
          ) : (
            <>
              <p className="m-0 mb-1 text-sm font-bold text-content dark:text-content-dark">{shift.shifts?.name || '—'}</p>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                {shift.shifts?.official_start} → {shift.shifts?.official_end}
                {shift.shifts?.late_threshold ? ` · ${isRTL ? `حد التأخير ${shift.shifts.late_threshold}` : `late after ${shift.shifts.late_threshold}`}` : ''}
              </p>
              <p className="m-0 mt-2 text-[10px] text-content-muted dark:text-content-muted-dark">
                {isRTL ? `من ${shift.start_date}` : `Since ${shift.start_date}`}
                {shift.end_date ? ` ${isRTL ? 'إلى' : 'to'} ${shift.end_date}` : ''}
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Recent attendance days */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Clock size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'آخر الأيام' : 'Recent Days'}</p>
        </div>
        <div className="px-5 py-2">
          {attendance.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">{isRTL ? 'لا يوجد حضور مسجل' : 'No attendance recorded'}</p>
          ) : attendance.slice(-7).reverse().map(a => (
            <div key={a.id || a.date} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{a.date}</p>
                <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                  {a.check_in || '—'} → {a.check_out || '—'}
                  {a.late_minutes ? ` · ${a.late_minutes}m late` : ''}
                </p>
              </div>
              <StatusBadge status={a.status} isRTL={isRTL} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color, isRTL }) {
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`} style={{ background: `${color}10` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className={isRTL ? 'text-right' : 'text-left'}>
        <p className="m-0 text-base font-extrabold text-content dark:text-content-dark leading-tight tabular-nums">{value}</p>
        <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status, isRTL }) {
  const map = {
    present: { ar: 'حضور', en: 'Present', color: '#10B981' },
    absent: { ar: 'غياب', en: 'Absent', color: '#EF4444' },
    late: { ar: 'تأخير', en: 'Late', color: '#F59E0B' },
    leave: { ar: 'إجازة', en: 'Leave', color: '#4A7AAB' },
    pending: { ar: 'معلق', en: 'Pending', color: '#F59E0B' },
    approved: { ar: 'موافق', en: 'Approved', color: '#10B981' },
    rejected: { ar: 'مرفوض', en: 'Rejected', color: '#EF4444' },
    holiday: { ar: 'عطلة', en: 'Holiday', color: '#6B8DB5' },
  };
  const cfg = map[status] || { ar: status, en: status, color: '#6B7280' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35` }}>
      {isRTL ? cfg.ar : cfg.en}
    </span>
  );
}
