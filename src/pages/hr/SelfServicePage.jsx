import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { getApprovals } from '../../services/approvalService';
import { KpiCard, Badge, Card, CardHeader, CardBody } from '../../components/ui';
import {
  User, FileText, CalendarOff, DollarSign, Bell, ChevronRight,
  CalendarDays, Clock, CheckCircle2, XCircle, Monitor, Wrench,
  Shield, TrendingUp, Megaphone, PartyPopper, AlertCircle, Palmtree,
  Briefcase, Heart, UserCog, MessageSquare, Target, ChevronUp, ChevronDown, Minus,
} from 'lucide-react';
import { ensureTargets, computeActuals, getEmployeeTargets, METRIC_CONFIG, METRICS } from '../../services/kpiTargetsService';
import { getEmployeeClaims, EXPENSE_CATEGORIES } from '../../services/expenseClaimService';
import { useNavigate } from 'react-router-dom';
import { getObjectives, computeObjectiveProgress, STATUS_COLORS, KR_STATUS_OPTIONS } from '../../services/okrService';

/* ─── Quick Actions ─── */
const QUICK_ACTIONS = [
  { icon: CalendarOff, key: 'leave',    label_ar: 'طلب إجازة',        label_en: 'Request Leave',      color: '#4A7AAB' },
  { icon: DollarSign,  key: 'expense',  label_ar: 'تقديم مصروف',      label_en: 'Submit Expense',     color: '#2B4C6F' },
  { icon: Monitor,     key: 'it',       label_ar: 'دعم تقني',         label_en: 'IT Support',         color: '#6B8DB5' },
  { icon: FileText,    key: 'payslip',  label_ar: 'كشف الراتب',       label_en: 'View Payslip',       color: '#1B3347' },
  { icon: UserCog,     key: 'profile',  label_ar: 'تحديث بياناتي',     label_en: 'Update Profile',     color: '#8BA8C8' },
  { icon: Shield,      key: 'policies', label_ar: 'سياسات الشركة',     label_en: 'View Policies',      color: '#4A7AAB' },
];

/* ─── Mock Data ─── */
const LEAVE_BALANCE = [
  { type_ar: 'سنوية',   type_en: 'Annual',   total: 21, used: 7,  color: '#4A7AAB' },
  { type_ar: 'مرضية',   type_en: 'Sick',     total: 14, used: 2,  color: '#6B8DB5' },
  { type_ar: 'شخصية',   type_en: 'Personal', total: 5,  used: 1,  color: '#2B4C6F' },
];

const MY_REQUESTS = [
  { id: 1, type_ar: 'إجازة سنوية',    type_en: 'Annual Leave',     date: '2026-03-10', days: '5 days',  days_ar: '5 أيام',  status: 'pending',  category: 'leave' },
  { id: 2, type_ar: 'مصروف سفر',       type_en: 'Travel Expense',   date: '2026-03-05', amount: '1,250 SAR', amount_ar: '١٬٢٥٠ ر.س', status: 'approved', category: 'expense' },
  { id: 3, type_ar: 'صيانة مكيف',      type_en: 'AC Maintenance',   date: '2026-02-28', note_en: 'Office 3B', note_ar: 'مكتب 3ب', status: 'approved', category: 'maintenance' },
  { id: 4, type_ar: 'طلب لابتوب',      type_en: 'Laptop Request',   date: '2026-02-20', note_en: 'Upgrade',  note_ar: 'ترقية',   status: 'rejected', category: 'it' },
  { id: 5, type_ar: 'إجازة مرضية',     type_en: 'Sick Leave',       date: '2026-02-15', days: '2 days',  days_ar: 'يومين',   status: 'approved', category: 'leave' },
  { id: 6, type_ar: 'مصروف تدريب',     type_en: 'Training Expense', date: '2026-02-10', amount: '800 SAR', amount_ar: '٨٠٠ ر.س', status: 'pending',  category: 'expense' },
];

const ANNOUNCEMENTS = [
  { id: 1, title_ar: 'إجازة عيد الفطر',         title_en: 'Eid Al-Fitr Holiday',          date: '2026-03-12', icon: PartyPopper, color: '#4A7AAB',
    body_ar: 'ستكون إجازة عيد الفطر من ١ إلى ٥ شوال. كل عام وأنتم بخير!',
    body_en: 'Eid Al-Fitr holiday will be from 1st to 5th Shawwal. Eid Mubarak!' },
  { id: 2, title_ar: 'تحديث سياسة العمل عن بعد',  title_en: 'Remote Work Policy Update',    date: '2026-03-08', icon: Briefcase,   color: '#2B4C6F',
    body_ar: 'تم تحديث سياسة العمل عن بعد. يرجى مراجعة التفاصيل في بوابة السياسات.',
    body_en: 'Remote work policy has been updated. Please review details in the policies portal.' },
  { id: 3, title_ar: 'التسجيل في التأمين الطبي',  title_en: 'Medical Insurance Enrollment', date: '2026-03-01', icon: Heart,       color: '#6B8DB5',
    body_ar: 'فترة التسجيل في التأمين الطبي مفتوحة حتى ٣١ مارس.',
    body_en: 'Medical insurance enrollment period is open until March 31st.' },
];

const ATTENDANCE_SUMMARY = { present: 10, absent: 1, late: 2, workedHours: 82, workDays: 13, totalWorkDays: 22 };

/* ─── Sub-components ─── */

function ActionCard({ icon: Icon, label, color }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="relative overflow-hidden bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark px-5 py-5 cursor-pointer flex flex-col items-center gap-3 transition-all duration-200"
      style={{
        borderColor: hov ? `${color}60` : undefined,
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 10px 28px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px] transition-opacity duration-200"
        style={{ background: `linear-gradient(90deg,${color},transparent)`, opacity: hov ? 1 : 0 }}
      />
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200"
        style={{ background: `${color}${hov ? '22' : '14'}` }}
      >
        <Icon size={22} color={color} />
      </div>
      <p className="m-0 text-xs font-bold text-content dark:text-content-dark text-center">{label}</p>
    </div>
  );
}

function LeaveBar({ label, used, total, color }) {
  const pct = Math.round((used / total) * 100);
  const remaining = total - used;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-content dark:text-content-dark">{label}</span>
        <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{remaining} / {total}</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ApprovalBadge({ status, approverName, comments, lang }) {
  const map = {
    pending:  { label_ar: 'بانتظار الموافقة', label_en: 'Pending Approval', color: '#F59E0B', icon: Clock },
    approved: { label_ar: 'تمت الموافقة',     label_en: 'Approved',         color: '#10B981', icon: CheckCircle2 },
    rejected: { label_ar: 'مرفوض',            label_en: 'Rejected',         color: '#EF4444', icon: XCircle },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit"
        style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}35` }}
      >
        <Icon size={12} />
        {lang === 'ar' ? s.label_ar : s.label_en}
      </div>
      {status !== 'pending' && approverName && (
        <div className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark">
          <User size={10} />
          <span>{approverName}</span>
        </div>
      )}
      {status !== 'pending' && comments && (
        <div className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark">
          <MessageSquare size={10} />
          <span className="truncate max-w-[140px]">{comments}</span>
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ category }) {
  const map = {
    leave:       { icon: CalendarOff, color: '#4A7AAB' },
    expense:     { icon: DollarSign,  color: '#2B4C6F' },
    it:          { icon: Monitor,     color: '#6B8DB5' },
    maintenance: { icon: Wrench,      color: '#8BA8C8' },
  };
  const c = map[category] || map.leave;
  const Icon = c.icon;
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.color}14` }}>
      <Icon size={16} color={c.color} />
    </div>
  );
}

/* ─── Main Page ─── */

export default function SelfServicePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const [employees, setEmployees] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const loadApprovals = useCallback(async () => {
    // Load approvals for the current user (simulated as first employee)
    const allApprovals = await getApprovals({});
    setApprovals(Array.isArray(allApprovals) ? allApprovals : []);
  }, []);

  useEffect(() => { fetchEmployees().then(data => setEmployees(data)); loadApprovals(); }, [loadApprovals]);

  // Listen for approval changes
  useEffect(() => {
    const handler = () => loadApprovals();
    window.addEventListener('platform_approval_change', handler);
    return () => window.removeEventListener('platform_approval_change', handler);
  }, [loadApprovals]);

  // Simulate logged-in user with first employee
  const emp = employees[0];
  const name = (isRTL ? emp?.full_name_ar : emp?.full_name_en) || emp?.full_name_ar || (isRTL ? 'أحمد محمد' : 'Ahmed Mohamed');
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  // ── Pre-loaded async KPI targets ──
  const [ssTargets, setSsTargets] = useState([]);
  const [ssPrevTargets, setSsPrevTargets] = useState([]);
  useEffect(() => {
    const loadTargets = async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const empId = emp?.id || 'e1';
      const empRole = emp?.role || 'sales_agent';
      await ensureTargets(empId, empRole, currentMonth, currentYear);
      const tgts = await getEmployeeTargets(empId, currentMonth, currentYear);
      setSsTargets(Array.isArray(tgts) ? tgts : []);
      await ensureTargets(empId, empRole, prevMonth, prevYear);
      const prevTgts = await getEmployeeTargets(empId, prevMonth, prevYear);
      setSsPrevTargets(Array.isArray(prevTgts) ? prevTgts : []);
    };
    if (emp) loadTargets();
  }, [emp]);

  // ── Pre-loaded async OKR objectives ──
  const [ssObjectives, setSsObjectives] = useState([]);
  useEffect(() => {
    const loadOkrs = async () => {
      const currentMonth = new Date().getMonth();
      const cq = currentMonth < 3 ? 'Q1' : currentMonth < 6 ? 'Q2' : currentMonth < 9 ? 'Q3' : 'Q4';
      const cy = new Date().getFullYear();
      const empId = emp?.id || 'e1';
      const result = await getObjectives({ quarter: cq, year: cy });
      const arr = Array.isArray(result) ? result : [];
      setSsObjectives(arr.filter(o => o.owner_id === empId));
    };
    if (emp) loadOkrs();
  }, [emp]);

  // ── Pre-loaded async expense claims ──
  const [ssClaims, setSsClaims] = useState([]);
  useEffect(() => {
    const loadClaims = async () => {
      const empId = emp?.id || 'e1';
      const result = await getEmployeeClaims(empId);
      setSsClaims(Array.isArray(result) ? result.slice(0, 5) : []);
    };
    if (emp) loadClaims();
  }, [emp]);

  // Enrich MY_REQUESTS with approval data
  const getRequestApproval = (req) => {
    // Try to find a matching approval by category/type
    return approvals.find(a => {
      if (req.category === 'leave' && a.type === 'leave') return true;
      if (req.category === 'expense' && a.type === 'expense') return true;
      return false;
    }) || null;
  };

  const pendingCount = MY_REQUESTS.filter(r => r.status === 'pending').length;
  const attendancePct = Math.round((ATTENDANCE_SUMMARY.present / ATTENDANCE_SUMMARY.totalWorkDays) * 100);
  const totalLeaveRemaining = LEAVE_BALANCE.reduce((sum, l) => sum + (l.total - l.used), 0);

  const profileFields = [
    { label_ar: 'رقم الموظف',     label_en: 'Employee ID',  value: emp?.employee_id || 'EMP-001' },
    { label_ar: 'القسم',          label_en: 'Department',   value: emp?.department || (isRTL ? 'المبيعات' : 'Sales') },
    { label_ar: 'المسمى الوظيفي',  label_en: 'Position',     value: emp?.position || (isRTL ? 'مدير مبيعات' : 'Sales Manager') },
    { label_ar: 'تاريخ الالتحاق',  label_en: 'Join Date',    value: emp?.join_date || '2024-01-15' },
    { label_ar: 'البريد',          label_en: 'Email',        value: emp?.email || 'ahmed@company.com' },
    { label_ar: 'الجوال',          label_en: 'Phone',        value: emp?.phone || '+966 55 123 4567' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">

      {/* ── Page Header ── */}
      <div className={`flex items-center gap-3.5 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <User size={22} className="text-brand-500" />
        </div>
        <div className="text-start">
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
            {isRTL ? 'الخدمة الذاتية' : 'Self Service'}
          </h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'بوابتك الشخصية لإدارة طلباتك' : 'Your personal portal for managing requests'}
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <KpiCard
          icon={Palmtree}
          label={isRTL ? 'رصيد الإجازات' : 'Leave Balance'}
          value={`${totalLeaveRemaining}`}
          sub={isRTL ? `${LEAVE_BALANCE[0].total - LEAVE_BALANCE[0].used} يوم سنوية متبقية` : `${LEAVE_BALANCE[0].total - LEAVE_BALANCE[0].used} annual days remaining`}
          color="#4A7AAB"
        />
        <KpiCard
          icon={AlertCircle}
          label={isRTL ? 'طلبات معلقة' : 'Pending Requests'}
          value={`${pendingCount}`}
          sub={isRTL ? 'بانتظار الموافقة' : 'Awaiting approval'}
          color="#F59E0B"
        />
        <KpiCard
          icon={TrendingUp}
          label={isRTL ? 'نسبة الحضور' : 'Attendance %'}
          value={`${attendancePct}%`}
          sub={isRTL ? `${ATTENDANCE_SUMMARY.present} من ${ATTENDANCE_SUMMARY.totalWorkDays} يوم عمل` : `${ATTENDANCE_SUMMARY.present} of ${ATTENDANCE_SUMMARY.totalWorkDays} work days`}
          color="#10B981"
        />
        <KpiCard
          icon={PartyPopper}
          label={isRTL ? 'الإجازة القادمة' : 'Next Holiday'}
          value={isRTL ? 'عيد الفطر' : 'Eid Al-Fitr'}
          sub={isRTL ? '٣٠ مارس ٢٠٢٦' : 'Mar 30, 2026'}
          color="#6B8DB5"
        />
      </div>

      {/* ── Profile Card ── */}
      <div className={`bg-surface-card dark:bg-surface-card-dark rounded-2xl border border-edge dark:border-edge-dark p-6 mb-6 flex items-start gap-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0 shadow-md">
          <span className="text-2xl font-bold text-white">{initials}</span>
        </div>
        <div className="flex-1 text-start">
          <p className="m-0 mb-1 text-xl font-bold text-content dark:text-content-dark">{name}</p>
          <p className="m-0 mb-4 text-xs text-content-muted dark:text-content-muted-dark">
            {emp?.employee_id || 'EMP-001'} &bull; {emp?.department || (isRTL ? 'المبيعات' : 'Sales')} &bull; {emp?.position || (isRTL ? 'مدير مبيعات' : 'Sales Manager')}
          </p>
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 ${isRTL ? '' : ''}`}>
            {profileFields.map((f, i) => (
              <div key={i} className="text-start">
                <p className="m-0 mb-0.5 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide font-semibold">
                  {isRTL ? f.label_ar : f.label_en}
                </p>
                <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout: Leave Balance + Attendance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

        {/* Leave Balance */}
        <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? 'رصيد الإجازات' : 'Leave Balance'}
            </p>
            <CalendarDays size={16} className="text-content-muted dark:text-content-muted-dark" />
          </div>
          <div className="px-5 py-4">
            {LEAVE_BALANCE.map((lb, i) => (
              <LeaveBar
                key={i}
                label={isRTL ? lb.type_ar : lb.type_en}
                used={lb.used}
                total={lb.total}
                color={lb.color}
              />
            ))}
            <div className="mt-4 pt-3 border-t border-edge dark:border-edge-dark flex items-center justify-between">
              <span className="text-xs font-semibold text-content dark:text-content-dark">
                {isRTL ? 'إجمالي المتبقي' : 'Total Remaining'}
              </span>
              <span className="text-sm font-extrabold text-brand-500">
                {totalLeaveRemaining} {isRTL ? 'يوم' : 'days'}
              </span>
            </div>
          </div>
        </div>

        {/* My Attendance */}
        <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? 'حضوري هذا الشهر' : 'My Attendance This Month'}
            </p>
            <Clock size={16} className="text-content-muted dark:text-content-muted-dark" />
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { label_ar: 'أيام حضور',  label_en: 'Present Days',  value: ATTENDANCE_SUMMARY.present,     color: '#10B981', icon: CheckCircle2 },
                { label_ar: 'أيام غياب',   label_en: 'Absent Days',   value: ATTENDANCE_SUMMARY.absent,      color: '#EF4444', icon: XCircle },
                { label_ar: 'تأخير',       label_en: 'Late Arrivals', value: ATTENDANCE_SUMMARY.late,         color: '#F59E0B', icon: AlertCircle },
                { label_ar: 'ساعات العمل', label_en: 'Worked Hours',  value: `${ATTENDANCE_SUMMARY.workedHours}h`, color: '#4A7AAB', icon: Clock },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`} style={{ background: `${item.color}08` }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}14` }}>
                      <Icon size={16} color={item.color} />
                    </div>
                    <div className="text-start">
                      <p className="m-0 text-lg font-extrabold text-content dark:text-content-dark leading-tight">{item.value}</p>
                      <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark font-medium">{isRTL ? item.label_ar : item.label_en}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Overall progress */}
            <div className="pt-3 border-t border-edge dark:border-edge-dark">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-content dark:text-content-dark">
                  {isRTL ? 'نسبة الحضور الشهري' : 'Monthly Attendance Rate'}
                </span>
                <span className="text-xs font-extrabold" style={{ color: attendancePct >= 90 ? '#10B981' : attendancePct >= 75 ? '#F59E0B' : '#EF4444' }}>
                  {attendancePct}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${attendancePct}%`,
                    background: attendancePct >= 90 ? '#10B981' : attendancePct >= 75 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <p className="m-0 mb-3 text-sm font-bold text-content dark:text-content-dark">
        {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        {QUICK_ACTIONS.map(action => (
          <ActionCard key={action.key} icon={action.icon} label={isRTL ? action.label_ar : action.label_en} color={action.color} />
        ))}
      </div>

      {/* ── My Requests Table ── */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-6">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'طلباتي الأخيرة' : 'My Requests'}
          </p>
          <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${MY_REQUESTS.length} طلبات` : `${MY_REQUESTS.length} requests`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr className="border-b border-edge dark:border-edge-dark">
                {[
                  isRTL ? 'النوع' : 'Type',
                  isRTL ? 'التفاصيل' : 'Details',
                  isRTL ? 'التاريخ' : 'Date',
                  isRTL ? 'حالة الموافقة' : 'Approval Status',
                ].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MY_REQUESTS.map((req) => {
                const approval = getRequestApproval(req);
                const effectiveStatus = approval ? approval.status : req.status;
                return (
                <tr key={req.id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.05] transition-colors cursor-pointer">
                  <td className={`px-5 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <CategoryIcon category={req.category} />
                      <span className="text-xs font-semibold text-content dark:text-content-dark">
                        {isRTL ? req.type_ar : req.type_en}
                      </span>
                    </div>
                  </td>
                  <td className={`px-5 py-3 text-xs text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>
                    {req.days ? (isRTL ? req.days_ar : req.days) : req.amount ? (isRTL ? req.amount_ar : req.amount) : (isRTL ? req.note_ar : req.note_en) || '—'}
                  </td>
                  <td className={`px-5 py-3 text-xs text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>
                    {req.date}
                  </td>
                  <td className={`px-5 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <ApprovalBadge
                      status={effectiveStatus}
                      approverName={approval?.approver_name}
                      comments={approval?.comments}
                      lang={lang}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── My Targets / أهدافي ── */}
      {(() => {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const empId = emp?.id || 'e1';

        const targets = ssTargets;
        const actuals = computeActuals(empId, currentMonth, currentYear);

        const prevTargets = ssPrevTargets;
        const prevActuals = computeActuals(empId, prevMonth, prevYear);

        const getPctColor = (pct) => pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
        const fmtVal = (metric, val) => metric === 'revenue' ? (val >= 1000000 ? (val/1000000).toFixed(1)+'M' : val >= 1000 ? (val/1000).toFixed(0)+'K' : val) : val;

        const metricRows = METRICS.map(metric => {
          const tgt = targets.find(t => t.metric === metric);
          const targetVal = tgt?.target_value || 0;
          const actualVal = actuals[metric] || 0;
          const pct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 0;

          // Previous month pct
          const prevTgt = prevTargets.find(t => t.metric === metric);
          const prevTargetVal = prevTgt?.target_value || 0;
          const prevActualVal = prevActuals[metric] || 0;
          const prevPct = prevTargetVal > 0 ? Math.round((prevActualVal / prevTargetVal) * 100) : 0;
          const trend = pct - prevPct;

          return { metric, target: targetVal, actual: actualVal, pct, trend };
        });

        const overallPct = metricRows.length > 0 ? Math.round(metricRows.reduce((s, m) => s + m.pct, 0) / metricRows.length) : 0;

        return (
          <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-6">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Target size={16} className="text-brand-500" />
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {isRTL ? 'أهدافي — KPI' : 'My Targets — KPI'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold" style={{ color: getPctColor(overallPct) }}>{overallPct}%</span>
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي' : 'Overall'}</span>
              </div>
            </div>
            <div className="px-5 py-4">
              {metricRows.map(m => {
                const cfg = METRIC_CONFIG[m.metric];
                const mColor = getPctColor(m.pct);
                return (
                  <div key={m.metric} className="mb-3.5 last:mb-0">
                    <div className={`flex items-center justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: cfg.color + '18' }}>
                          <span className="text-[10px]" style={{ color: cfg.color }}>
                            {m.metric === 'calls' ? '📞' : m.metric === 'new_opportunities' ? '💼' : m.metric === 'closed_deals' ? '🏆' : m.metric === 'revenue' ? '💰' : m.metric === 'meetings' ? '👥' : '📍'}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? cfg.ar : cfg.en}</span>
                      </div>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs"><span className="font-bold" style={{ color: mColor }}>{fmtVal(m.metric, m.actual)}</span><span className="text-content-muted dark:text-content-muted-dark mx-1">/</span><span className="text-content-muted dark:text-content-muted-dark">{fmtVal(m.metric, m.target)}</span></span>
                        {m.trend > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-500"><ChevronUp size={12} />+{m.trend}%</span>
                        ) : m.trend < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500"><ChevronDown size={12} />{m.trend}%</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-content-muted dark:text-content-muted-dark"><Minus size={12} /></span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(m.pct, 100)}%`, background: mColor }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 pt-3 border-t border-edge dark:border-edge-dark">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-xs font-semibold text-content dark:text-content-dark">
                    {isRTL ? 'الإنجاز الكلي' : 'Overall Achievement'}
                  </span>
                  <span className="text-sm font-extrabold" style={{ color: getPctColor(overallPct) }}>
                    {overallPct}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(overallPct, 100)}%`, background: `linear-gradient(90deg, ${getPctColor(overallPct)}cc, ${getPctColor(overallPct)})` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── My Expenses ── */}
      {(() => {
        const empId = emp?.id || 'e1';
        const myClaims = ssClaims;
        const myPendingAmt = myClaims.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
        const myApprovedAmt = myClaims.filter(c => c.status === 'approved' || c.status === 'paid').reduce((s, c) => s + c.amount, 0);
        const statusMap = {
          pending:  { ar: 'معلق',     en: 'Pending',  color: '#F59E0B' },
          approved: { ar: 'موافق عليه', en: 'Approved', color: '#10B981' },
          rejected: { ar: 'مرفوض',    en: 'Rejected', color: '#EF4444' },
          paid:     { ar: 'مدفوع',    en: 'Paid',     color: '#4A7AAB' },
        };
        return (
          <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-6">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <DollarSign size={16} className="text-brand-500" />
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {isRTL ? 'مصروفاتي' : 'My Expenses'}
                </p>
              </div>
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
                  {isRTL ? `معلق: ${myPendingAmt.toLocaleString()} ج.م` : `Pending: ${myPendingAmt.toLocaleString()} EGP`}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>
                  {isRTL ? `موافق عليه: ${myApprovedAmt.toLocaleString()} ج.م` : `Approved: ${myApprovedAmt.toLocaleString()} EGP`}
                </span>
                <button
                  onClick={() => window.location.href = '/hr/expense-claims'}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer transition-colors"
                  style={{ background: 'rgba(74,122,171,0.12)', color: '#4A7AAB' }}
                >
                  {isRTL ? 'عرض الكل' : 'View All'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-edge dark:border-edge-dark">
                    {[
                      isRTL ? 'التاريخ' : 'Date',
                      isRTL ? 'العنوان' : 'Title',
                      isRTL ? 'الفئة' : 'Category',
                      isRTL ? 'المبلغ' : 'Amount',
                      isRTL ? 'الحالة' : 'Status',
                    ].map((h, i) => (
                      <th key={i} className={`px-5 py-3 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myClaims.length === 0 && (
                    <tr><td colSpan={5} className={`px-5 py-6 text-center text-xs text-content-muted dark:text-content-muted-dark`}>
                      {isRTL ? 'لا توجد طلبات مصروفات' : 'No expense claims yet'}
                    </td></tr>
                  )}
                  {myClaims.map(claim => {
                    const cat = EXPENSE_CATEGORIES[claim.category] || EXPENSE_CATEGORIES.other;
                    const st = statusMap[claim.status] || statusMap.pending;
                    return (
                      <tr key={claim.id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.05] transition-colors">
                        <td className={`px-5 py-3 text-xs text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>{claim.date}</td>
                        <td className={`px-5 py-3 text-xs font-semibold text-content dark:text-content-dark ${isRTL ? 'text-right' : 'text-left'}`}>{claim.title}</td>
                        <td className={`px-5 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}30` }}>
                            {isRTL ? cat.ar : cat.en}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-xs font-bold text-content dark:text-content-dark ${isRTL ? 'text-right' : 'text-left'}`}>
                          {claim.amount.toLocaleString()} {claim.currency}
                        </td>
                        <td className={`px-5 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                            {isRTL ? st.ar : st.en}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── My Goals / OKRs ── */}
      {(() => {
        const currentMonth = new Date().getMonth();
        const cq = currentMonth < 3 ? 'Q1' : currentMonth < 6 ? 'Q2' : currentMonth < 9 ? 'Q3' : 'Q4';
        const cy = new Date().getFullYear();
        const myObjectives = ssObjectives;

        if (myObjectives.length === 0) return null;

        return (
          <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden mb-6">
            <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Target size={16} className="text-brand-500" />
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {isRTL ? `أهدافي — ${cq} ${cy}` : `My Goals — ${cq} ${cy}`}
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/hr/goals'}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer transition-colors"
                style={{ background: 'rgba(74,122,171,0.12)', color: '#4A7AAB' }}
              >
                {isRTL ? 'عرض الكل' : 'View All'}
              </button>
            </div>
            <div className="px-5 py-4">
              {myObjectives.map(obj => {
                const progress = computeObjectiveProgress(obj);
                const pColor = progress >= 70 ? '#10B981' : progress >= 40 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={obj.id} className="mb-4 last:mb-0">
                    <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-bold text-content dark:text-content-dark">
                        {isRTL ? (obj.titleAr || obj.title) : obj.title}
                      </span>
                      <span className="text-xs font-extrabold" style={{ color: pColor }}>
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%`, background: pColor }}
                      />
                    </div>
                    <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {(obj.keyResults || []).map(kr => {
                        const krColor = STATUS_COLORS[kr.status] || '#94a3b8';
                        const krOpt = KR_STATUS_OPTIONS.find(s => s.value === kr.status);
                        return (
                          <span
                            key={kr.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                            style={{ background: `${krColor}15`, color: krColor, border: `1px solid ${krColor}30` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: krColor }} />
                            {isRTL ? (kr.titleAr || kr.title) : kr.title}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Announcements ── */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Megaphone size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? 'إعلانات الشركة' : 'Company Announcements'}
            </p>
          </div>
          <Bell size={16} className="text-content-muted dark:text-content-muted-dark" />
        </div>
        <div className="divide-y divide-edge dark:divide-edge-dark">
          {ANNOUNCEMENTS.map((ann) => {
            const Icon = ann.icon;
            return (
              <div key={ann.id} className={`px-5 py-4 flex items-start gap-3.5 hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.05] transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ann.color}14` }}>
                  <Icon size={18} color={ann.color} />
                </div>
                <div className="flex-1 text-start">
                  <div className={`flex items-center justify-between mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                      {isRTL ? ann.title_ar : ann.title_en}
                    </p>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark shrink-0">{ann.date}</span>
                  </div>
                  <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark leading-relaxed">
                    {isRTL ? ann.body_ar : ann.body_en}
                  </p>
                </div>
                <ChevronRight size={14} className={`text-content-muted dark:text-content-muted-dark mt-3 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
