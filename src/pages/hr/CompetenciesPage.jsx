import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { COMPETENCIES } from '../../data/hr_mock_data';
import { Award, TrendingUp, Users, Star, ChevronDown } from 'lucide-react';

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

export default function CompetenciesPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const categories = [...new Set(COMPETENCIES.map(c=>c.category))];
  const filtered = filter==='all' ? COMPETENCIES : COMPETENCIES.filter(c=>c.category===filter);
  const avgLevel = Math.round(COMPETENCIES.reduce((s,c)=>s+(c.required_level||3),0)/COMPETENCIES.length);

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><Award size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'الكفاءات':'Competencies'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'إدارة كفاءات الموظفين':'Manage employee competencies'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ كفاءة جديدة':'+ Add Competency'} ds={ds} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={Award} label={lang==='ar'?'إجمالي الكفاءات':'Total Competencies'} value={COMPETENCIES.length} color="#1B3347" />
        <KpiCard icon={Users} label={lang==='ar'?'عدد الفئات':'Categories'} value={categories.length} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang==='ar'?'متوسط المستوى':'Avg Level'} value={avgLevel+'/5'} color="#6B8DB5" />
        <KpiCard icon={Star} label={lang==='ar'?'كفاءات متقدمة':'Advanced'} value={COMPETENCIES.filter(c=>c.required_level>=4).length} color="#2B4C6F" />
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['all', ...categories].map(cat => (
          <FilterBtn key={cat} label={cat==='all'?(lang==='ar'?'الكل':'All'):cat} active={filter===cat} onClick={()=>setFilter(cat)} ds={ds} />
        ))}
      </div>

      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'الكفاءة':'Competency', lang==='ar'?'الفئة':'Category', lang==='ar'?'المستوى المطلوب':'Required Level', lang==='ar'?'التقييم':'Rating', ''].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Star size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد كفاءات مسجلة':'No Competencies Found'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم إضافة أي كفاءات بعد':'No competencies added yet'}</p>
              </div>
            ) : filtered.map((comp, idx) => {
              const [hov, setHov] = useState(false);
              const isExp = expanded===idx;
              return (
                <>
                  <tr key={idx} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`, background:hov?ds.rowHover:'transparent', transition:'background 0.15s', cursor:'pointer' }} onClick={()=>setExpanded(isExp?null:idx)}>
                    <td style={{ ...td, fontWeight:700 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:'#4A7AAB', flexShrink:0 }} />
                        {lang==='ar'?comp.name_ar:comp.name_en}
                      </div>
                    </td>
                    <td style={{ ...td }}><span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(74,122,171,0.12)', color:'#4A7AAB', border:'1px solid rgba(74,122,171,0.25)' }}>{comp.category}</span></td>
                    <td style={{ ...td }}>
                      <div style={{ display:'flex', gap:3 }}>
                        {[1,2,3,4,5].map(i=>(<div key={i} style={{ width:16, height:16, borderRadius:4, background:i<=(comp.required_level||3)?'#4A7AAB':'rgba(74,122,171,0.15)', transition:'background 0.2s' }} />))}
                      </div>
                    </td>
                    <td style={{ ...td, color:ds.muted, fontSize:11 }}>{comp.description_ar||comp.description_en||'-'}</td>
                    <td style={{ ...td }}><ChevronDown size={14} color={ds.muted} style={{ transform:isExp?'rotate(180deg)':'none', transition:'transform 0.2s' }} /></td>
                  </tr>
                  {isExp && (
                    <tr key={idx+'exp'} style={{ background:ds.dark?'rgba(74,122,171,0.04)':'#F8FAFC', borderBottom:`1px solid ${ds.border}` }}>
                      <td colSpan={5} style={{ padding:'14px 20px' }}>
                        <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?comp.description_ar:comp.description_en}</p>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddBtn({label,ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,background:hov?'#2B4C6F':'#1B3347',border:'none',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:700,transform:hov?'translateY(-1px)':'none',boxShadow:hov?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)',transition:'all 0.2s ease'}}>{label}</button>;}
function FilterBtn({label,active,onClick,ds}){const [hov,setHov]=useState(false);return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${active||hov?'#4A7AAB60':ds.border}`,background:active?'#4A7AAB':hov?'rgba(74,122,171,0.08)':'transparent',cursor:'pointer',color:active?'#fff':hov?'#4A7AAB':ds.muted,fontSize:12,fontWeight:600,transition:'all 0.15s'}}>{label}</button>;}
