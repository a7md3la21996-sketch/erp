import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEmployees } from '../../services/employeesService';
import { getEmployeeClaims, EXPENSE_CATEGORIES } from '../../services/expenseClaimService';
import {
  User, CalendarOff, DollarSign, Bell, Clock, FileText, Receipt,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, Megaphone,
  Palmtree, TrendingUp, Briefcase, ExternalLink, PartyPopper,
} from 'lucide-react';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

/* ─────────────────────────────────────────────────────────────────────────
   Self-Service v2 — clean, employee-first portal.
   Goal: 3 clicks max for the most common actions (leave, expense, payslip).
───────────────────────────────────────────────────────────────────────── */

export default function SelfServicePage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [emp, setEmp] = useState(null);
  const [claims, setClaims] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [emps, claimsRes, leavesRes, annRes] = await Promise.all([
          fetchEmployees(),
          profile?.id ? getEmployeeClaims(profile.id) : Promise.resolve([]),
          profile?.id
            ? supabase.from('leave_requests').select('*').eq('employee_id', profile.id).order('start_date', { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
          supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
        ]);
        if (cancelled) return;
        const me = (emps || []).find(e => e.id === profile?.id || e.email === profile?.email) || null;
        setEmp(me);
        setClaims(Array.isArray(claimsRes) ? claimsRes : []);
        setLeaves(leavesRes.data || []);
        setAnnouncements(annRes.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.email]);

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={3} /></div>;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'نهارك سعيد' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();

  const name = (isRTL ? (emp?.full_name_ar || profile?.full_name_ar) : (emp?.full_name_en || profile?.full_name_en)) || profile?.full_name_ar || profile?.email || '';
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';

  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const pendingClaims = claims.filter(c => c.status === 'pending').length;
  const leaveBalance = emp?.leave_balance ?? 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* ─── Hero ─── */}
      <Card className="p-5 md:p-6 mb-5">
        <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0 shadow-md">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
          <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{greeting}</p>
            <h1 className="m-0 text-xl md:text-2xl font-bold text-content dark:text-content-dark truncate">{name}</h1>
            <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">
              {emp?.position || emp?.job_title_ar || (isRTL ? 'موظف' : 'Employee')}
              {emp?.employee_id ? ` · ${emp.employee_id}` : ''}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Stat Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Palmtree} label={isRTL ? 'رصيد الإجازة' : 'Leave Balance'} value={`${leaveBalance}`} sub={isRTL ? 'يوم متبقي' : 'days left'} color="#4A7AAB" />
        <KpiCard icon={AlertCircle} label={isRTL ? 'طلبات معلقة' : 'Pending'} value={pendingLeaves + pendingClaims} sub={isRTL ? 'بانتظار الموافقة' : 'awaiting approval'} color="#F59E0B" />
        <KpiCard icon={Receipt} label={isRTL ? 'مصروفات الشهر' : 'Month Expenses'} value={claims.filter(c => c.status !== 'rejected').reduce((s, c) => s + (Number(c.amount) || 0), 0).toLocaleString()} sub={isRTL ? 'ج.م' : 'EGP'} color="#10B981" />
        <KpiCard icon={Clock} label={isRTL ? 'مدة العمل' : 'Tenure'} value={emp?.hire_date ? `${((Date.now() - new Date(emp.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)}` : '—'} sub={isRTL ? 'سنة' : 'yrs'} color="#6B8DB5" />
      </div>

      {/* ─── 3 Big Actions ─── */}
      <p className="m-0 mb-3 text-sm font-bold text-content dark:text-content-dark">
        {isRTL ? 'ماذا تريد أن تفعل اليوم؟' : 'What do you want to do today?'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
        <BigAction
          icon={CalendarOff}
          color="#4A7AAB"
          title_ar="طلب إجازة"
          title_en="Request Leave"
          desc_ar="أرسل طلب إجازة جديد لمديرك"
          desc_en="Submit a new leave request to your manager"
          to="/hr/leave"
          isRTL={isRTL}
        />
        <BigAction
          icon={Receipt}
          color="#10B981"
          title_ar="تقديم مصروف"
          title_en="Submit Expense"
          desc_ar="أضف مصروف للموافقة عليه"
          desc_en="Add an expense for approval"
          to="/hr/expense-claims"
          isRTL={isRTL}
        />
        <BigAction
          icon={FileText}
          color="#1B3347"
          title_ar="عرض كشف الراتب"
          title_en="View Payslip"
          desc_ar="افتح صفحة الراتب التفصيلية"
          desc_en="See your detailed compensation"
          to={emp?.id ? `/hr/employee/${emp.id}` : '/hr/payroll'}
          isRTL={isRTL}
        />
      </div>

      {/* ─── My Requests + Announcements ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Requests (2 cols) */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Briefcase size={16} className="text-brand-500" />
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'طلباتي الأخيرة' : 'My Recent Requests'}</p>
              </div>
              <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
                {leaves.length + claims.length} {isRTL ? 'طلب' : 'total'}
              </span>
            </div>
            <div className="px-5 py-2">
              {(leaves.length === 0 && claims.length === 0) ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={26} className="text-green-500 mx-auto mb-2" />
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد طلبات' : 'No requests yet'}</p>
                </div>
              ) : (
                <>
                  {leaves.map(l => (
                    <RequestRow
                      key={`l-${l.id}`}
                      icon={CalendarOff}
                      iconColor="#4A7AAB"
                      title={isRTL ? `إجازة ${l.type || ''}` : `${l.type || 'Leave'} request`}
                      sub={`${l.start_date} → ${l.end_date}`}
                      status={l.status}
                      isRTL={isRTL}
                    />
                  ))}
                  {claims.map(c => (
                    <RequestRow
                      key={`c-${c.id}`}
                      icon={Receipt}
                      iconColor="#10B981"
                      title={c.title || (isRTL ? 'مصروف' : 'Expense')}
                      sub={`${Number(c.amount || 0).toLocaleString()} ${c.currency || 'EGP'} · ${c.date || ''}`}
                      status={c.status}
                      isRTL={isRTL}
                    />
                  ))}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Announcements */}
        <div>
          <Card className="overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Megaphone size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'إعلانات' : 'Announcements'}</p>
            </div>
            <div className="px-5 py-3">
              {announcements.length === 0 ? (
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-4">{isRTL ? 'لا توجد إعلانات' : 'No announcements'}</p>
              ) : announcements.map(a => (
                <div key={a.id} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="m-0 text-xs font-bold text-content dark:text-content-dark mb-0.5">
                    {(isRTL ? a.title_ar : a.title_en) || a.title || a.title_ar}
                  </p>
                  <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark line-clamp-2">
                    {(isRTL ? a.body_ar : a.body_en) || a.body || a.body_ar}
                  </p>
                  <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">
                    {a.created_at?.slice(0, 10)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BigAction({ icon: Icon, color, title_ar, title_en, desc_ar, desc_en, to, isRTL }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-5 hover:scale-[1.01] hover:shadow-lg transition-all"
      style={{ '--accent': color }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
      <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
          <Icon size={22} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-base font-bold text-content dark:text-content-dark mb-0.5">
            {isRTL ? title_ar : title_en}
          </p>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark leading-relaxed">
            {isRTL ? desc_ar : desc_en}
          </p>
        </div>
        <ChevronRight size={16} className={`text-content-muted dark:text-content-muted-dark mt-1 ${isRTL ? 'rotate-180' : ''} group-hover:text-brand-500 transition-colors`} />
      </div>
    </Link>
  );
}

function RequestRow({ icon: Icon, iconColor, title, sub, status, isRTL }) {
  const statusMap = {
    pending: { ar: 'معلق', en: 'Pending', color: '#F59E0B' },
    approved: { ar: 'موافق', en: 'Approved', color: '#10B981' },
    rejected: { ar: 'مرفوض', en: 'Rejected', color: '#EF4444' },
    paid: { ar: 'مدفوع', en: 'Paid', color: '#4A7AAB' },
  };
  const s = statusMap[status] || { ar: status, en: status, color: '#6B7280' };
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
      <div className={`flex items-center gap-3 min-w-0 flex-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${iconColor}18` }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <div className={`min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="m-0 text-xs font-semibold text-content dark:text-content-dark truncate">{title}</p>
          <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{sub}</p>
        </div>
      </div>
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0" style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}35` }}>
        {isRTL ? s.ar : s.en}
      </span>
    </div>
  );
}
