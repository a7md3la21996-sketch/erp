import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { KpiCard, Badge, Card, CardHeader, CardBody } from '../../components/ui';
import {
  User, FileText, CalendarOff, DollarSign, Bell, ChevronRight,
  CalendarDays, Clock, CheckCircle2, XCircle, Monitor, Wrench,
  Shield, TrendingUp, Megaphone, PartyPopper, AlertCircle, Palmtree,
  Briefcase, Heart, UserCog,
} from 'lucide-react';

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

function StatusChip({ status, lang }) {
  const map = {
    pending:  { label_ar: 'معلق',  label_en: 'Pending',  color: '#F59E0B' },
    approved: { label_ar: 'موافق', label_en: 'Approved', color: '#10B981' },
    rejected: { label_ar: 'مرفوض', label_en: 'Rejected', color: '#EF4444' },
  };
  const s = map[status] || map.pending;
  return (
    <Badge color={s.color} size="sm">
      {lang === 'ar' ? s.label_ar : s.label_en}
    </Badge>
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

  useEffect(() => { fetchEmployees().then(data => setEmployees(data)); }, []);

  // Simulate logged-in user with first employee
  const emp = employees[0];
  const name = (isRTL ? emp?.full_name_ar : emp?.full_name_en) || emp?.full_name_ar || (isRTL ? 'أحمد محمد' : 'Ahmed Mohamed');
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

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
                  isRTL ? 'الحالة' : 'Status',
                ].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MY_REQUESTS.map((req) => (
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
                    <StatusChip status={req.status} lang={lang} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
