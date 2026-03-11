import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { UserPlus, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight , UserCheck } from 'lucide-react';


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

const ONBOARDING_STEPS = [
  { id:'docs', label_ar:'المستندات', label_en:'Documents', icon:'📄' },
  { id:'equipment', label_ar:'المعدات', label_en:'Equipment', icon:'💻' },
  { id:'training', label_ar:'التدريب', label_en:'Training', icon:'🏆' },
  { id:'system', label_ar:'الأنظمة', label_en:'System Access', icon:'🔐' },
  { id:'intro', label_ar:'التعريف', label_en:'Introduction', icon:'🤝' },
];

const MOCK_ONBOARDING = [
  { emp_id:'EMP-001', start:'2026-03-01', progress:{ docs:true, equipment:true, training:true, system:true, intro:false } },
  { emp_id:'EMP-002', start:'2026-03-08', progress:{ docs:true, equipment:false, training:false, system:false, intro:false } },
  { emp_id:'EMP-003', start:'2026-02-15', progress:{ docs:true, equipment:true, training:true, system:true, intro:true } },
];

export default function OnboardingPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [expanded, setExpanded] = useState(null);

  const completed = MOCK_ONBOARDING.filter(o=>Object.values(o.progress).every(Boolean)).length;
  const inProgress = MOCK_ONBOARDING.filter(o=>!Object.values(o.progress).every(Boolean)&&Object.values(o.progress).some(Boolean)).length;
  const notStarted = MOCK_ONBOARDING.filter(o=>Object.values(o.progress).every(v=>!v)).length;

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><UserPlus size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'استقبال الموظفين':'Employee Onboarding'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'تتبع مسار استقبال الموظفين الجدد':'Track new employee onboarding'}</p>
          </div>
        </div>
      </div>

      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={UserPlus}     label={lang==='ar'?'إجمالي':'Total'}        value={MOCK_ONBOARDING.length} color="#1B3347" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مكتمل':'Completed'}    value={completed}             color="#4A7AAB" />
        <KpiCard icon={Clock}        label={lang==='ar'?'جاري':'In Progress'}   value={inProgress}            color="#6B8DB5" />
        <KpiCard icon={AlertCircle}  label={lang==='ar'?'لم يبدأ':'Not Started'}  value={notStarted}            color="#EF4444" />
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {MOCK_ONBOARDING.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <UserCheck size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا يوجد موظفون في التهيئة':'No Onboarding Employees'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم إضافة أي موظفين في مرحلة التهيئة':'No employees in onboarding'}</p>
              </div>
            ) : MOCK_ONBOARDING.map(ob => {
          const emp = MOCK_EMPLOYEES.find(e=>e.employee_id===ob.emp_id||e.id===ob.emp_id);
          const name = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : ob.emp_id;
          const initials = name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'??';
          const done = Object.values(ob.progress).filter(Boolean).length;
          const total = Object.values(ob.progress).length;
          const pct = Math.round(done/total*100);
          const isExpanded = expanded===ob.emp_id;
          const [hov, setHov] = useState(false);
          return (
            <div key={ob.emp_id} style={{ background:ds.card, borderRadius:14, border:`1px solid ${hov||isExpanded?ds.accent+'40':ds.border}`, overflow:'hidden', transition:'border-color 0.2s, box-shadow 0.2s', boxShadow:isExpanded?`0 4px 16px rgba(74,122,171,0.12)`:'none' }}>
              <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>setExpanded(isExpanded?null:ob.emp_id)} style={{ padding:'16px 20px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', flexDirection:isRTL?'row-reverse':'row' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexDirection:isRTL?'row-reverse':'row' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{initials}</span></div>
                  <div style={{ textAlign:isRTL?'right':'left' }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{name}</p>
                    <p style={{ margin:0, fontSize:11, color:ds.muted }}>{lang==='ar'?'بدأ:':' Started:'} {ob.start}</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:16, flexDirection:isRTL?'row-reverse':'row' }}>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:20, fontWeight:800, color:pct===100?'#4A7AAB':ds.accent }}>{pct}%</p>
                    <p style={{ margin:0, fontSize:10, color:ds.muted }}>{done}/{total}</p>
                  </div>
                  <div style={{ width:80, height:6, borderRadius:3, background:ds.dark?'rgba(255,255,255,0.08)':'#E2E8F0' }}>
                    <div style={{ height:'100%', borderRadius:3, width:pct+'%', background:pct===100?'#4A7AAB':'#6B8DB5', transition:'width 0.5s' }} />
                  </div>
                  <div style={{ transform:isExpanded?'rotate(90deg)':'none', transition:'transform 0.2s', color:ds.muted }}><ChevronRight size={16} /></div>
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding:'0 20px 16px', borderTop:`1px solid ${ds.border}`, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, paddingTop:14 }}>
                  {ONBOARDING_STEPS.map(step => {
                    const done = ob.progress[step.id];
                    return (
                      <div key={step.id} style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${done?'#4A7AAB40':ds.border}`, background:done?'rgba(74,122,171,0.08)':'transparent', textAlign:'center' }}>
                        <div style={{ fontSize:20, marginBottom:4 }}>{step.icon}</div>
                        <p style={{ margin:'0 0 6px', fontSize:11, color:ds.text, fontWeight:600 }}>{lang==='ar'?step.label_ar:step.label_en}</p>
                        {done ? <CheckCircle2 size={16} color="#4A7AAB" /> : <Clock size={16} color={ds.muted} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
