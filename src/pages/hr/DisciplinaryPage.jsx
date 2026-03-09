import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { Shield, AlertTriangle, XCircle, CheckCircle2, Plus, Eye , ShieldAlert } from 'lucide-react';

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

const MOCK_CASES = [
  { id:1, emp_id:'EMP-001', type:'warning', reason:'تأخير متكرر', date:'2026-02-10', status:'open', severity:'low' },
  { id:2, emp_id:'EMP-002', type:'suspension', reason:'غياب بدون إذن', date:'2026-01-20', status:'closed', severity:'high' },
  { id:3, emp_id:'EMP-003', type:'warning', reason:'سلوك غير لائق', date:'2026-03-01', status:'open', severity:'medium' },
  { id:4, emp_id:'EMP-004', type:'termination', reason:'خرق سياسة الشركة', date:'2026-02-28', status:'closed', severity:'high' },
];

export default function DisciplinaryPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [cases, setCases] = useState(MOCK_CASES);

  const open   = cases.filter(c=>c.status==='open').length;
  const closed = cases.filter(c=>c.status==='closed').length;
  const high   = cases.filter(c=>c.severity==='high').length;

  const severityColor = s => s==='high'?'#EF4444':s==='medium'?'#6B8DB5':'#4A7AAB';
  const severityLabel = (s,lang) => ({ high:lang==='ar'?'عالي':'High', medium:lang==='ar'?'متوسط':'Medium', low:lang==='ar'?'منخفض':'Low' }[s]||s);
  const typeLabel     = (t,lang) => ({ warning:lang==='ar'?'إنذار':'Warning', suspension:lang==='ar'?'إيقاف':'Suspension', termination:lang==='ar'?'فصل':'Termination' }[t]||t);
  const statusLabel   = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><Shield size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'الشؤون التأديبية':'Disciplinary'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'إدارة الحالات التأديبية':'Manage disciplinary cases'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ حالة جديدة':'+ New Case'} ds={ds} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={Shield}       label={lang==='ar'?'إجمالي الحالات':'Total Cases'} value={cases.length} color="#1B3347" />
        <KpiCard icon={AlertTriangle} label={lang==='ar'?'مفتوحة':'Open'}           value={open}         color="#6B8DB5" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'خطورة عالية':'High Severity'} value={high}         color="#EF4444" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مغلقة':'Closed'}          value={closed}       color="#4A7AAB" />
      </div>

      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}` }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'سجل الحالات':'Cases Log'}</p>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'الموظف':'Employee', lang==='ar'?'النوع':'Type', lang==='ar'?'السبب':'Reason', lang==='ar'?'التاريخ':'Date', lang==='ar'?'الخطورة':'Severity', lang==='ar'?'الحالة':'Status'].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <ShieldAlert size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد مخالفات تأديبية':'No Disciplinary Records'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم تسجيل أي مخالفات':'No disciplinary records found'}</p>
              </div>
            ) : cases.map(cas => {
              const emp = MOCK_EMPLOYEES.find(e=>e.employee_id===cas.emp_id||e.id===cas.emp_id);
              const name = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : cas.emp_id;
              const [hov, setHov] = useState(false);
              return (
                <tr key={cas.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`, background:hov?ds.rowHover:'transparent', transition:'background 0.15s' }}>
                  <td style={{ ...td, fontWeight:600 }}>{name}</td>
                  <td style={{ ...td }}><Badge label={typeLabel(cas.type,lang)} color="#4A7AAB" /></td>
                  <td style={{ ...td, color:ds.muted }}>{cas.reason}</td>
                  <td style={{ ...td, color:ds.muted }}>{cas.date}</td>
                  <td style={{ ...td }}><Badge label={severityLabel(cas.severity,lang)} color={severityColor(cas.severity)} /></td>
                  <td style={{ ...td }}><Badge label={statusLabel(cas.status,lang)} color={cas.status==='open'?'#6B8DB5':'#4A7AAB'} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ label, color='#4A7AAB' }) {
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:color+'18', color, border:`1px solid ${color}35` }}>{label}</span>;
}
function AddBtn({ label, ds }) {
  const [hov, setHov] = useState(false);
  return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10, background:hov?'#2B4C6F':'#1B3347', border:'none', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:700, transform:hov?'translateY(-1px)':'none', boxShadow:hov?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)', transition:'all 0.2s ease' }}><Plus size={16}/>{label}</button>;
}
