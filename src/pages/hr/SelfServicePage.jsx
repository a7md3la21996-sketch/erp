import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { User, FileText, CalendarOff, DollarSign, Bell, ChevronRight } from 'lucide-react';

const QUICK_ACTIONS = [
  { icon: CalendarOff, key: 'leave',   label_ar: 'طلب إجازة',     label_en: 'Request Leave',   color: '#4A7AAB' },
  { icon: FileText,   key: 'payslip', label_ar: 'كشف الراتب',    label_en: 'View Payslip',    color: '#2B4C6F' },
  { icon: DollarSign, key: 'expense', label_ar: 'مصروف عمل',    label_en: 'Claim Expense',   color: '#1B3347' },
  { icon: FileText,   key: 'cert',    label_ar: 'شهادة عمل',    label_en: 'Work Certificate',color: '#6B8DB5' },
  { icon: Bell,       key: 'notif',   label_ar: 'الإشعارات',    label_en: 'Notifications',   color: '#8BA8C8' },
  { icon: User,       key: 'profile', label_ar: 'تعديل البيانات', label_en: 'Update Profile',  color: '#4A7AAB' },
];

function ActionCard({ icon: Icon, label, color }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      className="relative overflow-hidden bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark px-[18px] py-5 cursor-pointer flex flex-col items-center gap-3 transition-all duration-200"
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
      <p className="m-0 text-[13px] font-bold text-content dark:text-content-dark text-center">{label}</p>
    </div>
  );
}

function RequestRow({ req, i, isRTL, lang }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      className={`flex justify-between items-center py-2.5 px-2 rounded-lg cursor-pointer transition-colors duration-150 ${isRTL ? 'flex-row-reverse' : ''} ${i < 2 ? 'border-b border-edge dark:border-edge-dark' : ''} ${hov ? 'bg-[#F8FAFC] dark:bg-brand-500/[0.07]' : 'bg-transparent'}`}
    >
      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: req.color }} />
        <div className="text-start">
          <p className="m-0 text-[13px] font-semibold text-content dark:text-content-dark">{req.label}</p>
          <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">{req.date}</p>
        </div>
      </div>
      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-[10px]"
          style={{ background: `${req.color}18`, color: req.color }}
        >
          {req.status==='pending'?(lang==='ar'?'معلق':'Pending'):(lang==='ar'?'مكتمل':'Done')}
        </span>
        <ChevronRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
      </div>
    </div>
  );
}

export default function SelfServicePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [employees, setEmployees] = useState([]);

  useEffect(() => { fetchEmployees().then(data => setEmployees(data)); }, []);

  // Use first employee as logged-in user simulation
  const emp = employees[0];
  const name = (isRTL ? emp?.full_name_ar : emp?.full_name_en) || emp?.full_name_ar || 'موظف';
  const initials = name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();

  const infoItems = [
    { label: lang==='ar'?'المسمى الوظيفي':'Job Title',    value: emp?.position || (lang==='ar'?'مدير مبيعات':'Sales Manager') },
    { label: lang==='ar'?'القسم':'Department',      value: emp?.department || (lang==='ar'?'المبيعات':'Sales') },
    { label: lang==='ar'?'رقم الموظف':'Employee ID', value: emp?.employee_id || 'EMP-001' },
    { label: lang==='ar'?'تاريخ التعيين':'Join Date',   value: emp?.join_date || '2024-01-15' },
    { label: lang==='ar'?'رصيد الإجازة':'Leave Balance', value: `${emp?.leave_balance ?? 21} ${lang==='ar'?'يوم':'days'}` },
  ];

  const recentRequests = [
    { label: lang==='ar'?'طلب إجازة - 5 أيام':'Leave Request - 5 days', date:'2026-03-01', status:'pending', color:'#6B8DB5' },
    { label: lang==='ar'?'كشف راتب فبراير':'Payslip Feb 2026', date:'2026-02-28', status:'completed', color:'#4A7AAB' },
    { label: lang==='ar'?'شهادة عمل':'Work Certificate', date:'2026-02-15', status:'completed', color:'#4A7AAB' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex items-center gap-3.5 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <User size={22} className="text-brand-500" />
        </div>
        <div className="text-start">
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'الخدمة الذاتية':'Self Service'}</h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'بوابتك الشخصية':'Your personal portal'}</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className={`bg-surface-card dark:bg-surface-card-dark rounded-2xl border border-edge dark:border-edge-dark p-6 mb-5 flex items-center gap-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0 shadow-md">
          <span className="text-2xl font-extrabold text-white">{initials}</span>
        </div>
        <div className={`flex-1 text-start`}>
          <p className="m-0 mb-1 text-xl font-extrabold text-content dark:text-content-dark">{name}</p>
          <p className="m-0 mb-3 text-[13px] text-content-muted dark:text-content-muted-dark">{emp?.employee_id || 'EMP-001'} • {emp?.department || (lang==='ar'?'المبيعات':'Sales')}</p>
          <div className={`flex gap-4 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            {infoItems.map((item,i) => (
              <div key={i} className="text-start">
                <p className="m-0 mb-0.5 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide font-semibold">{item.label}</p>
                <p className="m-0 text-[13px] font-bold text-content dark:text-content-dark">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <p className="m-0 mb-3 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'إجراءات سريعة':'Quick Actions'}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-5">
        {QUICK_ACTIONS.map(action => (
          <ActionCard key={action.key} icon={action.icon} label={lang==='ar'?action.label_ar:action.label_en} color={action.color} />
        ))}
      </div>

      {/* Recent Requests */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-edge dark:border-edge-dark">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'طلباتي الأخيرة':'Recent Requests'}</p>
        </div>
        <div className="px-[18px] py-3">
          {recentRequests.map((req, i) => (
            <RequestRow key={i} req={req} i={i} isRTL={isRTL} lang={lang} />
          ))}
        </div>
      </div>
    </div>
  );
}
