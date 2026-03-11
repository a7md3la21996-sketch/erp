import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { BookOpen, Users, CheckCircle2, Clock, Plus, Award , GraduationCap } from 'lucide-react';


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

const MOCK_PROGRAMS = [
  { id:1, title:'مهارات التفاوض', title_en:'Negotiation Skills', category:'sales', duration:16, enrolled:6, completed:4, status:'active', start:'2026-03-10' },
  { id:2, title:'خدمة العملاء', title_en:'Customer Service', category:'crm', duration:8, enrolled:8, completed:8, status:'completed', start:'2026-02-01' },
  { id:3, title:'إدارة العقارات', title_en:'Property Management', category:'real_estate', duration:24, enrolled:5, completed:2, status:'active', start:'2026-03-15' },
  { id:4, title:'التسويق الرقمي', title_en:'Digital Marketing', category:'marketing', duration:12, enrolled:4, completed:0, status:'upcoming', start:'2026-04-01' },
];

export default function TrainingPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [programs] = useState(MOCK_PROGRAMS);

  const active    = programs.filter(p=>p.status==='active').length;
  const totalEnr  = programs.reduce((s,p)=>s+p.enrolled,0);
  const totalComp = programs.reduce((s,p)=>s+p.completed,0);

  const statusColor = s => s==='completed'?'#4A7AAB':s==='active'?'#6B8DB5':'#8BA8C8';
  const statusLabel = (s,lang) => ({ active:lang==='ar'?'نشط':'Active', completed:lang==='ar'?'مكتمل':'Completed', upcoming:lang==='ar'?'قادم':'Upcoming' }[s]||s);

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><BookOpen size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'التدريب والتطوير':'Training & Development'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'برامج تطوير الكفاءات':'Skills development programs'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ برنامج جديد':'+ New Program'} ds={ds} />
      </div>

      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={BookOpen}    label={lang==='ar'?'إجمالي البرامج':'Total Programs'} value={programs.length} color="#1B3347" />
        <KpiCard icon={Clock}       label={lang==='ar'?'نشطة':'Active'}            value={active}          color="#6B8DB5" />
        <KpiCard icon={Users}       label={lang==='ar'?'إجمالي المسجلين':'Enrolled'}         value={totalEnr}        color="#4A7AAB" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'أتموا التدريب':'Completed'}        value={totalComp}       color="#2B4C6F" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginBottom:16 }}>
        {programs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <GraduationCap size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد برامج تدريبية':'No Training Programs'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم إضافة أي برامج تدريبية بعد':'No training programs added yet'}</p>
              </div>
            ) : programs.map(prog => {
          const [hov, setHov] = useState(false);
          const pct = prog.enrolled ? Math.round(prog.completed/prog.enrolled*100) : 0;
          return (
            <div key={prog.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
              style={{ background:ds.card, borderRadius:14, border:`1px solid ${hov?'#4A7AAB60':ds.border}`, padding:20, transform:hov?'translateY(-2px)':'none', boxShadow:hov?'0 8px 24px rgba(74,122,171,0.12)':'0 1px 3px rgba(0,0,0,0.06)', transition:'all 0.2s ease' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, flexDirection:isRTL?'row-reverse':'row' }}>
                <div style={{ textAlign:isRTL?'right':'left' }}>
                  <p style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?prog.title:prog.title_en}</p>
                  <p style={{ margin:0, fontSize:11, color:ds.muted }}>{prog.duration} {lang==='ar'?'ساعة':'hrs'} • {prog.start}</p>
                </div>
                <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:statusColor(prog.status)+'18', color:statusColor(prog.status), border:`1px solid ${statusColor(prog.status)}35`, flexShrink:0 }}>{statusLabel(prog.status,lang)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, flexDirection:isRTL?'row-reverse':'row' }}>
                <span style={{ fontSize:12, color:ds.muted }}>{lang==='ar'?'التقدم':'Progress'}: {pct}%</span>
                <span style={{ fontSize:12, color:ds.accent, fontWeight:600 }}>{prog.completed}/{prog.enrolled} {lang==='ar'?'موظف':'emp'}</span>
              </div>
              <div style={{ height:5, borderRadius:3, background:ds.dark?'rgba(255,255,255,0.08)':'#E2E8F0' }}>
                <div style={{ height:'100%', borderRadius:3, width:pct+'%', background:'linear-gradient(90deg,#1B3347,#4A7AAB)', transition:'width 0.5s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}` }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'سجل التدريب':'Training Records'}</p>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'البرنامج':'Program', lang==='ar'?'المدة':'Duration', lang==='ar'?'مسجلون':'Enrolled', lang==='ar'?'أتموا':'Completed', lang==='ar'?'الحالة':'Status'].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map(prog => {
              const [hov, setHov] = useState(false);
              return (
                <tr key={prog.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`, background:hov?ds.rowHover:'transparent', transition:'background 0.15s' }}>
                  <td style={{ ...td }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexDirection:isRTL?'row-reverse':'row' }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><BookOpen size={14} color="#fff" /></div>
                      <span style={{ fontWeight:700 }}>{lang==='ar'?prog.title:prog.title_en}</span>
                    </div>
                  </td>
                  <td style={{ ...td, color:ds.muted }}>{prog.duration}h</td>
                  <td style={{ ...td, fontWeight:600, color:ds.accent }}>{prog.enrolled}</td>
                  <td style={{ ...td, fontWeight:600 }}>{prog.completed}</td>
                  <td style={{ ...td }}><span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:statusColor(prog.status)+'18', color:statusColor(prog.status), border:`1px solid ${statusColor(prog.status)}35` }}>{statusLabel(prog.status,lang)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddBtn({ label, ds }) {
  const [hov, setHov] = useState(false);
  return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10, background:hov?'#2B4C6F':'#1B3347', border:'none', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:700, transform:hov?'translateY(-1px)':'none', boxShadow:hov?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)', transition:'all 0.2s ease' }}><Plus size={16}/>{label}</button>;
}
