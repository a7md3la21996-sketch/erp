import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { DollarSign, TrendingUp, Users, FileText, ChevronDown, Download } from 'lucide-react';

function useDS() {
  const { theme } = useTheme(); const dark = theme==='dark';
  return { dark, bg:dark?'#152232':'#F0F4F8', card:dark?'#1a2234':'#ffffff', border:dark?'rgba(74,122,171,0.2)':'#E2E8F0', text:dark?'#E2EAF4':'#1A2B3C', muted:dark?'#8BA8C8':'#64748B', input:dark?'#0F1E2D':'#ffffff', rowHover:dark?'rgba(74,122,171,0.07)':'#F8FAFC', thBg:dark?'rgba(74,122,171,0.08)':'#F8FAFC', accent:'#4A7AAB', primary:'#2B4C6F' };
}
function KpiCard({ icon: Icon, label, value, sub, color='#4A7AAB' }) {
  const ds = useDS(); const [hov, setHov] = useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ background:ds.card, borderRadius:14, border:`1px solid ${hov?color+'60':ds.border}`, padding:'18px 20px', position:'relative', overflow:'hidden', transform:hov?'translateY(-2px)':'none', boxShadow:hov?`0 8px 24px ${color}22`:'0 1px 3px rgba(0,0,0,0.06)', transition:'all 0.2s ease' }}>
    <div style={{ position:'absolute', top:0, right:0, width:4, height:'100%', background:`linear-gradient(180deg,${color},transparent)`, borderRadius:'14px 0 0 14px', opacity:hov?1:0.6, transition:'opacity 0.2s' }} />
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
      <div><p style={{ margin:'0 0 6px', fontSize:12, color:ds.muted, fontWeight:500 }}>{label}</p><p style={{ margin:0, fontSize:26, fontWeight:800, color:ds.text, lineHeight:1 }}>{value}</p>{sub&&<p style={{ margin:'3px 0 0', fontSize:11, color:ds.muted }}>{sub}</p>}</div>
      <div style={{ width:42, height:42, borderRadius:11, background:color+(hov?'25':'15'), display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}><Icon size={20} color={color} /></div>
    </div>
  </div>;
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default function PayrollPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const totalSalaries = useMemo(() => MOCK_EMPLOYEES.reduce((s,e)=>s+(e.salary||0),0), []);
  const avgSalary = Math.round(totalSalaries / MOCK_EMPLOYEES.length);
  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };
  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><DollarSign size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'مسير الرواتب':'Payroll'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{MONTHS_AR[month-1]} 2026</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
            <select value={month} onChange={e=>setMonth(+e.target.value)} style={{ appearance:'none', padding:'8px 32px 8px 14px', borderRadius:9, border:`1px solid ${ds.border}`, background:ds.input, color:ds.text, fontSize:13, cursor:'pointer', outline:'none' }}>{MONTHS_AR.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <DollarSign size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد بيانات مرتبات':'No Payroll Data'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم إضافة أي مرتبات بعد':'No payroll records added yet'}</p>
              </div>
            ) : MONTHS_AR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
            <ChevronDown size={14} color={ds.muted} style={{ position:'absolute', right:10, pointerEvents:'none' }} />
          </div>
          <RunBtn label={lang==='ar'?'تشغيل المسير':'Run Payroll'} ds={ds} />
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={DollarSign} label={lang==='ar'?'إجمالي الرواتب':'Total Salaries'} value={(totalSalaries/1000).toFixed(0)+'K'} sub="EGP" color="#1B3347" />
        <KpiCard icon={Users} label={lang==='ar'?'عدد الموظفين':'Employees'} value={MOCK_EMPLOYEES.length} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang==='ar'?'متوسط الراتب':'Avg Salary'} value={(avgSalary/1000).toFixed(1)+'K'} sub="EGP" color="#6B8DB5" />
        <KpiCard icon={FileText} label={lang==='ar'?'تم الصرف':'Processed'} value={MOCK_EMPLOYEES.length} color="#2B4C6F" />
      </div>
      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexDirection:isRTL?'row-reverse':'row' }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?`مسير ${MONTHS_AR[month-1]}`:`${MONTHS_AR[month-1]} Payroll`}</p>
          <ExportBtn label={lang==='ar'?'تصدير':'Export'} ds={ds} />
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>{[lang==='ar'?'الموظف':'Employee',lang==='ar'?'الراتب الأساسي':'Base Salary',lang==='ar'?'البدلات':'Allowances',lang==='ar'?'الاستقطاعات':'Deductions',lang==='ar'?'الصافي':'Net Pay',lang==='ar'?'الحالة':'Status',''].map((h,i)=>(<th key={i} style={{...th,textAlign:isRTL?'right':'left'}}>{h}</th>))}</tr></thead>
          <tbody>{MOCK_EMPLOYEES.map(emp=>{ const name=(isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar; const base=emp.salary||0; const allow=Math.round(base*0.2); const ded=Math.round(base*0.1); const net=base+allow-ded; const initials=name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'??'; const [hov,setHov]=useState(false); return (<tr key={emp.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{borderBottom:`1px solid ${ds.border}`,background:hov?ds.rowHover:'transparent',transition:'background 0.15s'}}><td style={{...td}}><div style={{display:'flex',alignItems:'center',gap:10,flexDirection:isRTL?'row-reverse':'row'}}><div style={{width:32,height:32,borderRadius:9,background:'#2B4C6F',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:'#fff'}}>{initials}</span></div><div style={{textAlign:isRTL?'right':'left'}}><p style={{margin:0,fontSize:13,fontWeight:700,color:ds.text}}>{name}</p><p style={{margin:0,fontSize:11,color:ds.muted}}>{emp.employee_id}</p></div></div></td><td style={{...td}}>{base.toLocaleString()} ج.م</td><td style={{...td,color:'#4A7AAB',fontWeight:600}}>+{allow.toLocaleString()}</td><td style={{...td,color:'#EF4444',fontWeight:600}}>-{ded.toLocaleString()}</td><td style={{...td,fontWeight:800,color:ds.text}}>{net.toLocaleString()} ج.م</td><td style={{...td}}><span style={{display:'inline-flex',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:'rgba(74,122,171,0.15)',color:'#4A7AAB',border:'1px solid rgba(74,122,171,0.3)'}}>{lang==='ar'?'تم الصرف':'Paid'}</span></td><td style={{...td}}><SlipBtn label="Payslip" ds={ds} /></td></tr>); })}</tbody>
        </table>
      </div>
    </div>
  );
}
function RunBtn({label,ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{padding:'10px 20px',borderRadius:10,background:hov?'#2B4C6F':'#1B3347',border:'none',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:700,transform:hov?'translateY(-1px)':'none',boxShadow:hov?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)',transition:'all 0.2s ease'}}>{label}</button>;}
function ExportBtn({label,ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,border:`1px solid ${hov?ds.accent+'60':ds.border}`,background:hov?ds.accent+'12':'transparent',cursor:'pointer',color:hov?ds.accent:ds.muted,fontSize:12,fontWeight:600,transition:'all 0.15s'}}><Download size={13}/>{label}</button>;}
function SlipBtn({label,ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:8,border:`1px solid ${hov?ds.accent+'60':ds.border}`,background:hov?ds.accent+'12':'transparent',cursor:'pointer',color:hov?ds.accent:ds.muted,fontSize:11,fontWeight:600,transition:'all 0.15s'}}><FileText size={12}/>{label}</button>;}
