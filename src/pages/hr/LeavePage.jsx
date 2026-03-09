import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { CalendarOff, Clock, CheckCircle2, XCircle, Plus, Eye, Check, X } from 'lucide-react';

function useDS() {
  const { theme } = useTheme(); const dark = theme==='dark';
  return { dark, bg:dark?'#152232':'#F0F4F8', card:dark?'#1a2234':'#ffffff', border:dark?'rgba(74,122,171,0.2)':'#E2E8F0', text:dark?'#E2EAF4':'#1A2B3C', muted:dark?'#8BA8C8':'#64748B', input:dark?'#0F1E2D':'#ffffff', rowHover:dark?'rgba(74,122,171,0.07)':'#F8FAFC', thBg:dark?'rgba(74,122,171,0.08)':'#F8FAFC', accent:'#4A7AAB', primary:'#2B4C6F' };
}

function KpiCard({ icon: Icon, label, value, color='#4A7AAB' }) {
  const ds = useDS(); const [hov, setHov] = useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ background:ds.card, borderRadius:14, border:`1px solid ${hov?color+'60':ds.border}`, padding:'18px 20px', position:'relative', overflow:'hidden', transform:hov?'translateY(-2px)':'none', boxShadow:hov?`0 8px 24px ${color}22`:'0 1px 3px rgba(0,0,0,0.06)', transition:'all 0.2s ease' }}>
    <div style={{ position:'absolute', top:0, right:0, width:4, height:'100%', background:`linear-gradient(180deg,${color},transparent)`, borderRadius:'14px 0 0 14px', opacity:hov?1:0.6, transition:'opacity 0.2s' }} />
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
      <div><p style={{ margin:'0 0 6px', fontSize:12, color:ds.muted, fontWeight:500 }}>{label}</p><p style={{ margin:0, fontSize:26, fontWeight:800, color:ds.text, lineHeight:1 }}>{value}</p></div>
      <div style={{ width:42, height:42, borderRadius:11, background:color+(hov?'25':'15'), display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}><Icon size={20} color={color} /></div>
    </div>
  </div>;
}

function Badge({ label, color='#4A7AAB' }) {
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:color+'18', color, border:`1px solid ${color}35` }}>{label}</span>;
}

const MOCK_LEAVES = [
  { id:1, emp_id:'EMP-001', type:'annual', days:5, from:'2026-03-10', to:'2026-03-14', status:'pending', notes:'رحلة عائلية' },
  { id:2, emp_id:'EMP-002', type:'sick',   days:2, from:'2026-03-05', to:'2026-03-06', status:'approved', notes:'مرض' },
  { id:3, emp_id:'EMP-003', type:'annual', days:3, from:'2026-03-15', to:'2026-03-17', status:'pending', notes:'' },
  { id:4, emp_id:'EMP-004', type:'unpaid', days:1, from:'2026-03-20', to:'2026-03-20', status:'rejected', notes:'ظروف شخصية' },
  { id:5, emp_id:'EMP-005', type:'annual', days:7, from:'2026-03-22', to:'2026-03-28', status:'approved', notes:'إجازة سنوية' },
];

export default function LeavePage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [tab, setTab] = useState('requests');
  const [leaves, setLeaves] = useState(MOCK_LEAVES);

  const pending  = leaves.filter(l=>l.status==='pending').length;
  const approved = leaves.filter(l=>l.status==='approved').length;
  const rejected = leaves.filter(l=>l.status==='rejected').length;

  const approve = id => setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:'approved'}:l));
  const reject  = id => setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:'rejected'}:l));

  const statusColor = s => s==='approved'?'#4A7AAB':s==='pending'?'#6B8DB5':'#EF4444';
  const statusLabel = (s,lang) => ({ approved:lang==='ar'?'موافق':'Approved', pending:lang==='ar'?'معلق':'Pending', rejected:lang==='ar'?'مرفوض':'Rejected' }[s]||s);
  const typeLabel   = (t,lang) => ({ annual:lang==='ar'?'سنوية':'Annual', sick:lang==='ar'?'مرضية':'Sick', unpaid:lang==='ar'?'بدون راتب':'Unpaid', emergency:lang==='ar'?'طارئة':'Emergency' }[t]||t);

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><CalendarOff size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'الإجازات':'Leave Management'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'إدارة طلبات الإجازات':'Manage leave requests'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ طلب إجازة':'+ Request Leave'} ds={ds} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={CalendarOff}  label={lang==='ar'?'إجمالي الطلبات':'Total Requests'} value={leaves.length} color="#1B3347" />
        <KpiCard icon={Clock}        label={lang==='ar'?'معلقة':'Pending'} value={pending} color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'موافق عليها':'Approved'} value={approved} color="#4A7AAB" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'مرفوضة':'Rejected'} value={rejected} color="#EF4444" />
      </div>
      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, padding:20, marginBottom:16 }}>
        <p style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'أرصدة الإجازات':'Leave Balances'}</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
          {MOCK_EMPLOYEES.slice(0,6).map(emp => {
            const bal = emp.leave_balance ?? 21; const pct = Math.round(bal/21*100);
            const name = (isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar;
            const initials = name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'??';
            return (
              <div key={emp.id} style={{ padding:'12px 14px', borderRadius:10, border:`1px solid ${ds.border}`, background:ds.dark?'rgba(74,122,171,0.04)':'#F8FAFC' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'#2B4C6F', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:10, fontWeight:700, color:'#fff' }}>{initials}</span></div>
                  <span style={{ fontSize:12, fontWeight:600, color:ds.text }}>{name}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:11, color:ds.muted }}>{lang==='ar'?'الرصيد':'Balance'}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:ds.accent }}>{bal} {lang==='ar'?'يوم':'days'}</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:ds.dark?'rgba(255,255,255,0.08)':'#E2E8F0' }}>
                  <div style={{ height:'100%', borderRadius:2, width:pct+'%', background:pct>50?'#4A7AAB':pct>25?'#6B8DB5':'#EF4444' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}` }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'طلبات الإجازة':'Leave Requests'}</p>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
            {[lang==='ar'?'الموظف':'Employee',lang==='ar'?'النوع':'Type',lang==='ar'?'من':'From',lang==='ar'?'إلى':'To',lang==='ar'?'أيام':'Days',lang==='ar'?'الحالة':'Status',''].map((h,i)=>(
              <th key={i} style={{ fontSize:11,fontWeight:700,color:ds.muted,padding:'10px 14px',textAlign:isRTL?'right':'left',textTransform:'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{leaves.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <CalendarOff size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد طلبات إجازة':'No Leave Requests'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم تقديم أي طلبات إجازة بعد':'No leave requests submitted yet'}</p>
              </div>
            ) : leaves.map(lv => {
            const emp = MOCK_EMPLOYEES.find(e=>e.employee_id===lv.emp_id);
            const name = emp?((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar):lv.emp_id;
            const [hov,setHov] = useState(false);
            return (<tr key={lv.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`,background:hov?ds.rowHover:'transparent',transition:'background 0.15s' }}>
              <td style={{ fontSize:13,color:ds.text,padding:'12px 14px',fontWeight:600 }}>{name}</td>
              <td style={{ fontSize:13,color:ds.text,padding:'12px 14px' }}><Badge label={typeLabel(lv.type,lang)} color="#4A7AAB" /></td>
              <td style={{ fontSize:13,color:ds.muted,padding:'12px 14px' }}>{lv.from}</td>
              <td style={{ fontSize:13,color:ds.muted,padding:'12px 14px' }}>{lv.to}</td>
              <td style={{ fontSize:13,color:ds.accent,padding:'12px 14px',fontWeight:700 }}>{lv.days}</td>
              <td style={{ fontSize:13,color:ds.text,padding:'12px 14px' }}><Badge label={statusLabel(lv.status,lang)} color={statusColor(lv.status)} /></td>
              <td style={{ fontSize:13,color:ds.text,padding:'12px 14px' }}>{lv.status==='pending'&&(<div style={{display:'flex',gap:6}}><ActionBtn icon={Check} color="#4A7AAB" onClick={()=>approve(lv.id)} ds={ds}/><ActionBtn icon={X} color="#EF4444" onClick={()=>reject(lv.id)} ds={ds}/></div>)}</td>
            </tr>);
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
function AddBtn({label,ds}){const[hov,setHov]=useState(false);return<button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,background:hov?'#2B4C6F':'#1B3347',border:'none',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:700,transform:hov?'translateY(-1px)':'none',boxShadow:hov?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)',transition:'all 0.2s ease'}}><Plus size={16}/>{label}</button>;}
function ActionBtn({icon:Icon,color,onClick,ds}){const[hov,setHov]=useState(false);return<button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={e=>{e.stopPropagation();onClick();}} style={{width:30,height:30,borderRadius:8,border:`1px solid ${hov?color+'60':ds.border}`,background:hov?color+'15':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transform:hov?'scale(1.08)':'scale(1)',transition:'all 0.15s ease'}}><Icon size={13} color={hov?color:ds.muted}/></button>;}
