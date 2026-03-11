import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { Briefcase, Users, Clock, CheckCircle2, Plus, Eye  } from 'lucide-react';


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

const MOCK_JOBS = [
  { id:1, title_ar:'مدير مبيعات', title_en:'Sales Manager', dept:'المبيعات', type:'full-time', status:'open', applicants:12, posted:'2026-02-15' },
  { id:2, title_ar:'محاسب', title_en:'Accountant', dept:'المالية', type:'full-time', status:'open', applicants:8, posted:'2026-02-20' },
  { id:3, title_ar:'مستشار عقاري', title_en:'Real Estate Consultant', dept:'العقارات', type:'full-time', status:'interviewing', applicants:5, posted:'2026-03-01' },
  { id:4, title_ar:'مدير تسويق', title_en:'Marketing Manager', dept:'التسويق', type:'full-time', status:'closed', applicants:20, posted:'2026-01-10' },
];

export default function RecruitmentPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [jobs] = useState(MOCK_JOBS);

  const open = jobs.filter(j=>j.status==='open').length;
  const interviewing = jobs.filter(j=>j.status==='interviewing').length;
  const closed = jobs.filter(j=>j.status==='closed').length;
  const totalApplicants = jobs.reduce((s,j)=>s+j.applicants,0);

  const statusColor = s => s==='open'?'#4A7AAB':s==='interviewing'?'#6B8DB5':'#8BA8C8';
  const statusLabel = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', interviewing:lang==='ar'?'مقابلات':'Interviewing', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><Briefcase size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'التوظيف':'Recruitment'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'إدارة طلبات التوظيف':'Manage job openings & applicants'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ وظيفة جديدة':'+ New Job'} ds={ds} />
      </div>

      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={Briefcase} label={lang==='ar'?'إجمالي الوظائف':'Total Jobs'} value={jobs.length} color="#1B3347" />
        <KpiCard icon={Clock} label={lang==='ar'?'مفتوحة':'Open'} value={open} color="#4A7AAB" />
        <KpiCard icon={Users} label={lang==='ar'?'المتقدمون':'Applicants'} value={totalApplicants} color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'ماتمت المقابلة':'Interviewing'} value={interviewing} color="#2B4C6F" />
      </div>

      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}` }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'الوظائف المتاحة':'Job Openings'}</p>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'الوظيفة':'Position', lang==='ar'?'القسم':'Dept', lang==='ar'?'المتقدمون':'Applicants', lang==='ar'?'تاريخ النشر':'Posted', lang==='ar'?'الحالة':'Status', ''].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Briefcase size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد طلبات توظيف':'No Recruitment Requests'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم إضافة أي طلبات توظيف بعد':'No recruitment requests added yet'}</p>
              </div>
            ) : jobs.map(job => {
              const [hov, setHov] = useState(false);
              return (
                <tr key={job.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`, background:hov?ds.rowHover:'transparent', transition:'background 0.15s' }}>
                  <td style={{ ...td, fontWeight:700 }}>{lang==='ar'?job.title_ar:job.title_en}</td>
                  <td style={{ ...td, color:ds.muted }}>{job.dept}</td>
                  <td style={{ ...td }}><span style={{ fontWeight:700, color:'#4A7AAB' }}>{job.applicants}</span></td>
                  <td style={{ ...td, color:ds.muted }}>{job.posted}</td>
                  <td style={{ ...td }}><span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:statusColor(job.status)+'18', color:statusColor(job.status), border:`1px solid ${statusColor(job.status)}35` }}>{statusLabel(job.status,lang)}</span></td>
                  <td style={{ ...td }}><ViewBtn ds={ds} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function AddBtn({label,ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,background:hov?'#2B4C6F':'#1B3347',border:'none',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:700,transform:hov?'translateY(-1px)':'none',boxShadow:hov?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)',transition:'all 0.2s ease'}}><Plus size={16}/>{label}</button>;}
function ViewBtn({ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{width:30,height:30,borderRadius:8,border:`1px solid ${hov?'#4A7AAB60':ds.border}`,background:hov?'rgba(74,122,171,0.12)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transform:hov?'scale(1.08)':'scale(1)',transition:'all 0.15s'}}><Eye size={13} color={hov?'#4A7AAB':ds.muted} /></button>;}
