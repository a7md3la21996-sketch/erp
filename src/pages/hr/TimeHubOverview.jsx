import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, CalendarOff,
  PartyPopper, CalendarDays, ArrowRight, Settings,
} from 'lucide-react';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';
import { getAttendanceSummary } from '../../services/attendanceService';
import { fetchLeaveRequests } from '../../services/leaveService';
import { fetchHolidays } from '../../services/holidaysService';

/* ─────────────────────────────────────────────────────────────────────────
   Time Hub Overview — at-a-glance snapshot of attendance, pending leave,
   and upcoming holidays. Mirrors the visual language of PayrollOverview.
───────────────────────────────────────────────────────────────────────── */
export default function TimeHubOverview({ isRTL, lang }) {
  const [summary, setSummary] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthName = new Date(year, month - 1).toLocaleString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { month: 'long', year: 'numeric' },
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAttendanceSummary(month, year),
      fetchLeaveRequests({ status: 'pending' }),
      fetchHolidays(year), // full year, then filter to upcoming
    ]).then(([sum, leaves, holidays]) => {
      if (cancelled) return;
      setSummary(sum || { total: 0, present: 0, absent: 0, late: 0, leave: 0 });
      setPendingLeaves(leaves || []);
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = (holidays || [])
        .filter(h => (h.date || '') >= today)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .slice(0, 5);
      setUpcomingHolidays(upcoming);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  // Determine attendance state (good vs needs-attention)
  const attendanceState = useMemo(() => {
    if (!summary || summary.total === 0) {
      return { label_ar: 'لا يوجد بيانات', label_en: 'No Data', color: '#94A3B8', icon: AlertTriangle };
    }
    const lateOrAbsent = (summary.absent || 0) + (summary.late || 0);
    const ratio = summary.total ? lateOrAbsent / summary.total : 0;
    if (ratio < 0.05) return { label_ar: 'ممتاز', label_en: 'Excellent', color: '#10B981', icon: CheckCircle2 };
    if (ratio < 0.15) return { label_ar: 'جيد', label_en: 'Good', color: '#4A7AAB', icon: CheckCircle2 };
    return { label_ar: 'يحتاج متابعة', label_en: 'Needs Attention', color: '#F59E0B', icon: AlertTriangle };
  }, [summary]);

  if (loading) return <PageSkeleton hasKpis tableRows={4} />;

  const StatusIcon = attendanceState.icon;

  return (
    <div className="space-y-5">
      {/* Status card — current month attendance state */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${attendanceState.color}18` }}
            >
              <StatusIcon size={20} style={{ color: attendanceState.color }} />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? `حضور ${monthName}` : `${monthName} attendance`}
              </p>
              <p className="m-0 text-xs" style={{ color: attendanceState.color }}>
                {isRTL ? attendanceState.label_ar : attendanceState.label_en}
                {summary?.total ? ` · ${summary.total} ${isRTL ? 'سجل' : 'records'}` : ''}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link
              to="/hr/time"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600"
            >
              <Clock size={12} />
              {isRTL ? 'فتح الحضور' : 'Open Attendance'}
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard
          icon={CheckCircle2}
          label={isRTL ? 'حاضر' : 'Present'}
          value={summary?.present || 0}
          color="#10B981"
        />
        <KpiCard
          icon={XCircle}
          label={isRTL ? 'غائب' : 'Absent'}
          value={summary?.absent || 0}
          color="#EF4444"
        />
        <KpiCard
          icon={AlertTriangle}
          label={isRTL ? 'متأخر' : 'Late'}
          value={summary?.late || 0}
          color="#F59E0B"
        />
        <KpiCard
          icon={CalendarOff}
          label={isRTL ? 'طلبات إجازة معلقة' : 'Pending Leave'}
          value={pendingLeaves.length}
          color="#4A7AAB"
        />
      </div>

      {/* Two-col: pending leave + upcoming holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending leave requests */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CalendarOff size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? 'طلبات إجازة معلقة' : 'Pending Leave Requests'}
              </p>
            </div>
            <Link to="/hr/time?tab=leave" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-2">
            {pendingLeaves.length === 0 ? (
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
                {isRTL ? 'لا توجد طلبات معلقة' : 'No pending requests'}
              </p>
            ) : pendingLeaves.slice(0, 5).map(req => (
              <div
                key={req.id}
                className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <AlertTriangle size={14} className="text-amber-500" />
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                      {req.type
                        ? (isRTL
                          ? ({ annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }[req.type] || req.type)
                          : req.type)
                        : '—'}
                    </p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                      {req.start_date?.slice(0, 10)} → {req.end_date?.slice(0, 10)}
                      {req.days ? ` · ${req.days} ${isRTL ? 'يوم' : 'days'}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                  {isRTL ? 'معلق' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming holidays */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <PartyPopper size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? 'الإجازات القادمة' : 'Upcoming Holidays'}
              </p>
            </div>
            <Link to="/hr/time?tab=holidays" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-2">
            {upcomingHolidays.length === 0 ? (
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
                {isRTL ? 'لا توجد إجازات قادمة' : 'No upcoming holidays'}
              </p>
            ) : upcomingHolidays.map(h => {
              const dateObj = h.date ? new Date(h.date) : null;
              const daysUntil = dateObj
                ? Math.ceil((dateObj - new Date()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <div
                  key={h.id || h.date}
                  className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <PartyPopper size={14} className="text-brand-500" />
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                        {isRTL ? (h.name_ar || h.name || h.name_en || '—') : (h.name_en || h.name || h.name_ar || '—')}
                      </p>
                      <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                        {h.date}
                      </p>
                    </div>
                  </div>
                  {daysUntil != null && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500">
                      {daysUntil === 0
                        ? (isRTL ? 'اليوم' : 'Today')
                        : `${daysUntil} ${isRTL ? 'يوم' : 'days'}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Settings size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'روابط سريعة' : 'Quick Links'}
          </p>
        </div>
        <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to="/hr/time?tab=shifts"
            className={`flex items-center justify-between p-3 rounded-lg border border-edge dark:border-edge-dark hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CalendarDays size={16} className="text-brand-500" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                  {isRTL ? 'إدارة الشيفتات' : 'Manage Shifts'}
                </p>
                <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'مواعيد العمل والورديات' : 'Work hours & rotations'}
                </p>
              </div>
            </div>
            <ArrowRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
          </Link>
          <Link
            to="/hr/time?tab=holidays"
            className={`flex items-center justify-between p-3 rounded-lg border border-edge dark:border-edge-dark hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <PartyPopper size={16} className="text-brand-500" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                  {isRTL ? 'إدارة الإجازات الرسمية' : 'Manage Holidays'}
                </p>
                <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'العطلات الرسمية للسنة' : 'Public holidays for the year'}
                </p>
              </div>
            </div>
            <ArrowRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </Card>
    </div>
  );
}
