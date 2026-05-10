import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import supabase from '../../lib/supabase';
import { fetchEmployees } from '../../services/employeesService';
import { fetchAttendance } from '../../services/attendanceService';
import { approveLeaveRequest, rejectLeaveRequest } from '../../services/leaveService';
import { approveClaim, rejectClaim } from '../../services/expenseClaimService';
import {
  Users, CalendarOff, Receipt, AlertTriangle, ChevronRight,
  CheckCircle2, Clock, TrendingUp, ExternalLink, MessageSquare,
  Check, X,
} from 'lucide-react';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';

/* ─────────────────────────────────────────────────────────────────────────
   Manager Dashboard — a focused subset of the HR Home for the manager's
   direct reports only. Lets a team leader see their people, approve their
   requests, and drill into individual employee detail without exposing
   the full HR module.
───────────────────────────────────────────────────────────────────────── */

export default function ManagerDashboardPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [team, setTeam] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);  // id of row currently being processed

  const approverName = profile?.full_name_ar || profile?.full_name_en || 'Manager';

  const handleLeaveAction = async (leave, approve) => {
    setActing(`l-${leave.id}`);
    try {
      if (approve) await approveLeaveRequest(leave.id);
      else await rejectLeaveRequest(leave.id, '');
      setPendingLeaves(prev => prev.filter(l => l.id !== leave.id));
      toast.success(isRTL
        ? (approve ? 'تمت الموافقة' : 'تم الرفض')
        : (approve ? 'Approved' : 'Rejected'));
    } catch (err) {
      toast.error(isRTL ? 'فشلت العملية' : 'Action failed');
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setActing(null);
    }
  };

  const handleClaimAction = async (claim, approve) => {
    setActing(`c-${claim.id}`);
    try {
      if (approve) await approveClaim(claim.id, approverName);
      else await rejectClaim(claim.id, approverName, '');
      setPendingClaims(prev => prev.filter(c => c.id !== claim.id));
      toast.success(isRTL
        ? (approve ? 'تمت الموافقة' : 'تم الرفض')
        : (approve ? 'Approved' : 'Rejected'));
    } catch (err) {
      toast.error(isRTL ? 'فشلت العملية' : 'Action failed');
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setActing(null);
    }
  };

  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return; }
    let cancelled = false;
    fetchEmployees().then(async (allEmps) => {
      if (cancelled) return;
      const directReports = (allEmps || []).filter(
        e => e.direct_manager_id === profile.id && e.is_active !== false
      );
      const reportIds = directReports.map(e => e.id);
      setTeam(directReports);

      if (reportIds.length === 0) {
        setLoading(false);
        return;
      }

      const [leavesRes, claimsRes, att] = await Promise.all([
        supabase.from('leave_requests').select('*').in('employee_id', reportIds).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('expense_claims').select('*').in('employee_id', reportIds).eq('status', 'pending').order('created_at', { ascending: false }),
        fetchAttendance({ month, year }).then(rows => (rows || []).filter(r => reportIds.includes(r.employee_id))),
      ]);
      if (cancelled) return;
      setPendingLeaves(leavesRes.data || []);
      setPendingClaims(claimsRes.data || []);
      setAttendance(att);
      setLoading(false);
    }).catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [profile?.id, month, year]);

  const teamStats = useMemo(() => {
    if (team.length === 0) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    const perEmp = {};
    for (const a of attendance) {
      if (!perEmp[a.employee_id]) perEmp[a.employee_id] = { present: 0, late: 0, absent: 0 };
      if (a.status === 'present') perEmp[a.employee_id].present++;
      else if (a.status === 'late') { perEmp[a.employee_id].late++; perEmp[a.employee_id].present++; }
      else if (a.status === 'absent') perEmp[a.employee_id].absent++;
    }
    return {
      headcount: team.length,
      pendingApprovals: pendingLeaves.length + pendingClaims.length,
      avgAttendance: Math.round(
        team.reduce((s, e) => s + ((perEmp[e.id]?.present || 0) / daysInMonth * 100), 0) / team.length
      ),
      lateCount: Object.values(perEmp).reduce((s, v) => s + (v.late || 0), 0),
      perEmp,
    };
  }, [team, attendance, pendingLeaves, pendingClaims, year, month]);

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={3} /></div>;

  if (team.length === 0) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-12 md:px-7 md:py-12 bg-surface-bg dark:bg-surface-bg-dark min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
          <Users size={28} className="text-brand-500" />
        </div>
        <p className="m-0 mb-1.5 text-lg font-bold text-content dark:text-content-dark">
          {isRTL ? 'لا يوجد فريق مرتبط بك' : 'No team assigned to you'}
        </p>
        <p className="m-0 mb-5 text-xs text-content-muted dark:text-content-muted-dark max-w-md">
          {isRTL
            ? 'لكي تظهر لك الموظفين هنا، يجب أن يكون عندهم direct_manager_id يساوي معرّفك. تواصل مع HR لربط الموظفين بك.'
            : 'For team members to appear here, they need their direct_manager_id set to your user id. Contact HR to assign team members to you.'}
        </p>
        <Link
          to="/hr/self-service"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-edge dark:border-edge-dark text-sm font-semibold text-content dark:text-content-dark hover:bg-brand-500/10"
        >
          {isRTL ? 'الرجوع للبوابة الشخصية' : 'Back to Self-Service'}
        </Link>
      </div>
    );
  }

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'نهارك سعيد' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Hero */}
      <div className={`mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        <h1 className="m-0 text-2xl md:text-3xl font-bold text-content dark:text-content-dark">
          {greeting}{profile?.full_name_ar ? `، ${isRTL ? profile.full_name_ar : (profile.full_name_en || profile.full_name_ar)}` : ''}
        </h1>
        <p className="m-0 mt-1 text-sm text-content-muted dark:text-content-muted-dark">
          {isRTL ? 'فريقك' : 'Your team'} · {team.length} {isRTL ? 'موظف' : 'people'}
        </p>
      </div>

      {/* KPI strip */}
      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
          <KpiCard icon={Users} label={isRTL ? 'حجم الفريق' : 'Team Size'} value={teamStats.headcount} color="#1B3347" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'بانتظار موافقتك' : 'Pending Your Approval'} value={teamStats.pendingApprovals} color="#F59E0B" />
          <KpiCard icon={TrendingUp} label={isRTL ? 'متوسط الحضور' : 'Avg Attendance'} value={`${teamStats.avgAttendance}%`} color="#10B981" />
          <KpiCard icon={Clock} label={isRTL ? 'تأخيرات الشهر' : 'Late This Month'} value={teamStats.lateCount} color="#EF4444" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Pending approvals */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertTriangle size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'يحتاج موافقتك' : 'Needs Your Approval'}</p>
            </div>
            <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
              {pendingLeaves.length + pendingClaims.length} {isRTL ? 'طلب' : 'pending'}
            </span>
          </div>
          <div className="px-5 py-3">
            {pendingLeaves.length === 0 && pendingClaims.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 size={26} className="text-green-500 mx-auto mb-2" />
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد طلبات معلقة' : 'No pending requests'}</p>
              </div>
            ) : (
              <>
                {pendingLeaves.map(l => {
                  const emp = team.find(e => e.id === l.employee_id);
                  return (
                    <ApprovalRow
                      key={`l-${l.id}`}
                      icon={CalendarOff}
                      iconColor="#4A7AAB"
                      title={(isRTL ? emp?.full_name_ar : emp?.full_name_en) || emp?.full_name_ar || '—'}
                      sub={`${isRTL ? 'إجازة' : 'Leave'} ${l.type || ''} · ${l.start_date} → ${l.end_date}`}
                      busy={acting === `l-${l.id}`}
                      onApprove={() => handleLeaveAction(l, true)}
                      onReject={() => handleLeaveAction(l, false)}
                      onClick={() => navigate(`/hr/employee/${l.employee_id}`)}
                      isRTL={isRTL}
                    />
                  );
                })}
                {pendingClaims.map(c => {
                  const emp = team.find(e => e.id === c.employee_id);
                  return (
                    <ApprovalRow
                      key={`c-${c.id}`}
                      icon={Receipt}
                      iconColor="#10B981"
                      title={(isRTL ? emp?.full_name_ar : emp?.full_name_en) || emp?.full_name_ar || '—'}
                      sub={`${isRTL ? 'مصروف' : 'Expense'} ${c.title || ''} · ${Number(c.amount || 0).toLocaleString()} ج.م`}
                      busy={acting === `c-${c.id}`}
                      onApprove={() => handleClaimAction(c, true)}
                      onReject={() => handleClaimAction(c, false)}
                      onClick={() => navigate(`/hr/employee/${c.employee_id}`)}
                      isRTL={isRTL}
                    />
                  );
                })}
              </>
            )}
          </div>
        </Card>

        {/* Quick links */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <ExternalLink size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'روابط سريعة' : 'Quick Links'}</p>
          </div>
          <div className="px-5 py-3">
            <QuickLink to="/hr/leave" icon={CalendarOff} label={isRTL ? 'كل الإجازات' : 'All Leaves'} isRTL={isRTL} />
            <QuickLink to="/hr/expense-claims" icon={Receipt} label={isRTL ? 'كل المصروفات' : 'All Expenses'} isRTL={isRTL} />
            <QuickLink to="/hr/attendance" icon={Clock} label={isRTL ? 'الحضور' : 'Attendance'} isRTL={isRTL} />
            <QuickLink to="/hr/self-service" icon={MessageSquare} label={isRTL ? 'بياناتي الشخصية' : 'My Profile'} isRTL={isRTL} />
          </div>
        </Card>
      </div>

      {/* Team grid */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Users size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'فريقي' : 'My Team'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {team.map(emp => {
            const stats = teamStats?.perEmp[emp.id] || { present: 0, late: 0, absent: 0 };
            const empPending = pendingLeaves.filter(l => l.employee_id === emp.id).length
              + pendingClaims.filter(c => c.employee_id === emp.id).length;
            const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '—';
            const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
            return (
              <button
                key={emp.id}
                onClick={() => navigate(`/hr/employee/${emp.id}`)}
                className={`flex items-center gap-3 p-3 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark hover:border-brand-500/40 hover:bg-brand-500/5 transition-all cursor-pointer ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-xs font-bold text-content dark:text-content-dark truncate">{name}</p>
                  <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark truncate">
                    {emp.position || emp.job_title_ar || ''}
                  </p>
                  <div className={`flex items-center gap-2 mt-1 text-[10px] ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-green-600">{stats.present}p</span>
                    {stats.late > 0 && <span className="text-yellow-600">{stats.late}L</span>}
                    {stats.absent > 0 && <span className="text-red-600">{stats.absent}A</span>}
                    {empPending > 0 && (
                      <span className="ms-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-600 font-bold">
                        {empPending}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ApprovalRow({ icon: Icon, iconColor, title, sub, busy, onApprove, onReject, onClick, isRTL }) {
  return (
    <div className={`flex items-center gap-2 py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
      <button
        onClick={onClick}
        className={`flex items-center gap-3 min-w-0 flex-1 hover:bg-brand-500/5 -mx-1 px-1 py-0.5 rounded transition-colors text-start ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${iconColor}18` }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <div className={`min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="m-0 text-xs font-semibold text-content dark:text-content-dark truncate">{title}</p>
          <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark truncate">{sub}</p>
        </div>
      </button>
      <div className={`flex items-center gap-1 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <button
          onClick={onApprove}
          disabled={busy}
          title={isRTL ? 'موافقة' : 'Approve'}
          className="w-7 h-7 rounded-lg border border-green-500/30 bg-green-500/5 hover:bg-green-500/15 cursor-pointer flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={13} className="text-green-600" />
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          title={isRTL ? 'رفض' : 'Reject'}
          className="w-7 h-7 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 cursor-pointer flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={13} className="text-red-600" />
        </button>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, isRTL }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 hover:bg-brand-500/5 -mx-2 px-2 rounded transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <span className={`inline-flex items-center gap-2 text-xs font-semibold text-content dark:text-content-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Icon size={14} className="text-brand-500" />
        {label}
      </span>
      <ChevronRight size={12} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
    </Link>
  );
}
