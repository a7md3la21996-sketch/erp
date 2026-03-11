import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { User, FileText, CalendarOff, DollarSign, Bell, ChevronRight } from 'lucide-react';


const QUICK_ACTIONS = [
  { icon: CalendarOff, key: 'leave',   label_ar: 'طلب إجازة',     label_en: 'Request Leave',   color: '#4A7AAB' },
  { icon: FileText,   key: 'payslip', label_ar: 'كشف الراتب',    label_en: 'View Payslip',    color: '#2B4C6F' },
  { icon: DollarSign, key: 'expense', label_ar: 'مصروف عمل',    label_en: 'Claim Expense',   color: '#1B3347' },
  { icon: FileText,   key: 'cert',    label_ar: 'شهادة عمل',    label_en: 'Work Certificate',color: '#6B8DB5' },
  { icon: Bell,       key: 'notif',   label_ar: 'الإشعارات',    label_en: 'Notifications',   color: '#8BA8C8' },
  { icon: User,       key: 'profile', label_ar: 'تعديل البيانات', label_en: 'Update Profile',  color: '#4A7AAB' },
];

function ActionCard({ icon: Icon, label, color, ds }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:ds.card, borderRadius:14, border:`1px solid ${hov?color+'60':ds.border}`, padding:'20px 18px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:12, transform:hov?'translateY(-3px)':'none', boxShadow:hov?`0 10px 28px ${color}22`:'0 1px 3px rgba(0,0,0,0.06)', transition:'all 0.2s ease', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color},transparent)`, opacity:hov?1:0, transition:'opacity 0.2s' }} />
      <div style={{ width:48, height:48, borderRadius:13, background:color+(hov?'22':'14'), display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
        <Icon size={22} color={color} />
      </div>
      <p style={{ margin:0, fontSize:13, fontWeight:700, color:ds.text, textAlign:'center' }}>{label}</p>
    </div>
  );
}

export default function SelfServicePage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;

  // Use first employee as logged-in user simulation
  const emp = MOCK_EMPLOYEES[0];
  const name = (isRTL ? emp?.full_name_ar : emp?.full_name_en) || emp?.full_name_ar || 'موظف';
  const initials = name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();

  const infoItems = [
    { label: lang==='ar'?'المسمى الوظيفي':'Job Title',    value: emp?.position || (lang==='ar'?'مدير مبيعات':'Sales Manager') },
    { label: lang==='ar'?'القسم':'Department',      value: emp?.department || (lang==='ar'?'المبيعات':'Sales') },
    { label: lang==='ar'?'رقم الموظف':'Employee ID', value: emp?.employee_id || 'EMP-001' },
    { label: lang==='ar'?'تاريخ التعيين':'Join Date',   value: emp?.join_date || '2024-01-15' },
    { label: lang==='ar'?'رصيد الإجازة':'Leave Balance', value: `${emp?.leave_balance ?? 21} ${lang==='ar'?'يوم':'days'}` },
  ];

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><User size={22} color="#fff" /></div>
        <div style={{ textAlign:isRTL?'right':'left' }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'الخدمة الذاتية':'Self Service'}</h1>
          <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'بوابتك الشخصية':'Your personal portal'}</p>
        </div>
      </div>

      {/* Profile Card */}
      <div style={{ background:ds.card, borderRadius:16, border:`1px solid ${ds.border}`, padding:24, marginBottom:20, display:'flex', alignItems:'center', gap:20, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ width:72, height:72, borderRadius:18, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 16px rgba(74,122,171,0.3)' }}>
          <span style={{ fontSize:24, fontWeight:800, color:'#fff' }}>{initials}</span>
        </div>
        <div style={{ flex:1, textAlign:isRTL?'right':'left' }}>
          <p style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:ds.text }}>{name}</p>
          <p style={{ margin:'0 0 12px', fontSize:13, color:ds.muted }}>{emp?.employee_id || 'EMP-001'} • {emp?.department || (lang==='ar'?'المبيعات':'Sales')}</p>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', flexDirection:isRTL?'row-reverse':'row' }}>
            {infoItems.map((item,i) => (
              <div key={i} style={{ textAlign:isRTL?'right':'left' }}>
                <p style={{ margin:'0 0 2px', fontSize:10, color:ds.muted, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{item.label}</p>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:ds.text }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <p style={{ margin:'0 0 12px', fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'إجراءات سريعة':'Quick Actions'}</p>
      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        {QUICK_ACTIONS.map(action => (
          <ActionCard key={action.key} icon={action.icon} label={lang==='ar'?action.label_ar:action.label_en} color={action.color} ds={ds} />
        ))}
      </div>

      {/* Recent Requests */}
      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}` }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'طلباتي الأخيرة':'Recent Requests'}</p>
        </div>
        <div style={{ padding:'12px 18px' }}>
          {[
            { label: lang==='ar'?'طلب إجازة - 5 أيام':'Leave Request - 5 days', date:'2026-03-01', status:'pending', color:'#6B8DB5' },
            { label: lang==='ar'?'كشف راتب فبراير':'Payslip Feb 2026', date:'2026-02-28', status:'completed', color:'#4A7AAB' },
            { label: lang==='ar'?'شهادة عمل':'Work Certificate', date:'2026-02-15', status:'completed', color:'#4A7AAB' },
          ].map((req,i) => {
            const [hov, setHov] = useState(false);
            return (
              <div key={i} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i<2?`1px solid ${ds.border}`:'none', background:hov?ds.rowHover:'transparent', borderRadius:8, paddingInline:8, transition:'background 0.15s', cursor:'pointer', flexDirection:isRTL?'row-reverse':'row' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexDirection:isRTL?'row-reverse':'row' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:req.color, flexShrink:0 }} />
                  <div style={{ textAlign:isRTL?'right':'left' }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:ds.text }}>{req.label}</p>
                    <p style={{ margin:0, fontSize:11, color:ds.muted }}>{req.date}</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexDirection:isRTL?'row-reverse':'row' }}>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background:req.color+'18', color:req.color }}>
                    {req.status==='pending'?(lang==='ar'?'معلق':'Pending'):(lang==='ar'?'مكتمل':'Done')}
                  </span>
                  <ChevronRight size={14} color={ds.muted} style={{ transform:isRTL?'rotate(180deg)':'none' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
