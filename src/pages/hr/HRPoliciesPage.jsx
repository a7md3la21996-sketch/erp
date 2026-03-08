import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { FileText, BookOpen, Shield, Clock, Plus, Eye, Download } from 'lucide-react';

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

const MOCK_POLICIES = [
  { id:1, title_ar:'سياسة الحضور', title_en:'Attendance Policy', category:'attendance', status:'active', version:'2.1', updated:'2026-01-15', views:124 },
  { id:2, title_ar:'سياسة الإجازات', title_en:'Leave Policy', category:'leave', status:'active', version:'1.3', updated:'2025-11-20', views:98 },
  { id:3, title_ar:'سياسة السلوك المهني', title_en:'Code of Conduct', category:'conduct', status:'active', version:'3.0', updated:'2025-09-10', views:210 },
  { id:4, title_ar:'سياسة التطوير الوظيفي', title_en:'Career Development', category:'training', status:'draft', version:'1.0', updated:'2026-02-28', views:45 },
  { id:5, title_ar:'سياسة الرواتب والمكافآت', title_en:'Compensation Policy', category:'payroll', status:'active', version:'2.0', updated:'2026-01-01', views:167 },
  { id:6, title_ar:'سياسة الخصوصية', title_en:'Privacy Policy', category:'compliance', status:'active', version:'1.5', updated:'2025-12-15', views:77 },
];

const CATEGORIES = [
  { key:'all', label_ar:'الكل', label_en:'All', icon: FileText },
  { key:'attendance', label_ar:'حضور', label_en:'Attendance', icon: Clock },
  { key:'leave', label_ar:'إجازات', label_en:'Leave', icon: BookOpen },
  { key:'conduct', label_ar:'سلوك', label_en:'Conduct', icon: Shield },
];

export default function HRPoliciesPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [cat, setCat] = useState('all');

  const filtered = cat==='all' ? MOCK_POLICIES : MOCK_POLICIES.filter(p=>p.category===cat);
  const active = MOCK_POLICIES.filter(p=>p.status==='active').length;
  const draft = MOCK_POLICIES.filter(p=>p.status==='draft').length;

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><FileText size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'سياسات الموارد البشرية':'HR Policies'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'إدارة سياسات وأنظمة الشركة':'Manage company policies & guidelines'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ سياسة جديدة':'+ New Policy'} ds={ds} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={FileText}  label={lang==='ar'?'إجمالي السياسات':'Total Policies'} value={MOCK_POLICIES.length} color="#1B3347" />
        <KpiCard icon={Shield}    label={lang==='ar'?'نشطة':'Active'}               value={active}                color="#4A7AAB" />
        <KpiCard icon={Clock}     label={lang==='ar'?'مسودة':'Draft'}                value={draft}                 color="#6B8DB5" />
        <KpiCard icon={BookOpen}  label={lang==='ar'?'إجمالي المشاهدات':'Total Views'}     value={MOCK_POLICIES.reduce((s,p)=>s+p.views,0)} color="#2B4C6F" />
      </div>

      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexDirection:isRTL?'row-reverse':'row' }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'قائمة السياسات':'Policies List'}</p>
          <div style={{ display:'flex', gap:6 }}>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={()=>setCat(c.key)} style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${cat===c.key?ds.accent+'60':ds.border}`, background:cat===c.key?ds.accent+'15':'transparent', color:cat===c.key?ds.accent:ds.muted, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>{lang==='ar'?c.label_ar:c.label_en}</button>
            ))}
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'السياسة':'Policy', lang==='ar'?'التصنيف':'Category', lang==='ar'?'الإصدار':'Version', lang==='ar'?'آخر تحديث':'Updated', lang==='ar'?'الحالة':'Status', lang==='ar'?'المشاهدات':'Views', ''].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(policy => {
              const [hov, setHov] = useState(false);
              return (
                <tr key={policy.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`, background:hov?ds.rowHover:'transparent', transition:'background 0.15s' }}>
                  <td style={{ ...td }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexDirection:isRTL?'row-reverse':'row' }}>
                      <div style={{ width:34, height:34, borderRadius:9, background:'rgba(74,122,171,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FileText size={15} color="#4A7AAB" /></div>
                      <p style={{ margin:0, fontSize:13, fontWeight:700, color:ds.text }}>{lang==='ar'?policy.title_ar:policy.title_en}</p>
                    </div>
                  </td>
                  <td style={{ ...td }}><span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(74,122,171,0.12)', color:'#4A7AAB', border:'1px solid rgba(74,122,171,0.25)' }}>{policy.category}</span></td>
                  <td style={{ ...td, color:ds.muted }}>v{policy.version}</td>
                  <td style={{ ...td, color:ds.muted }}>{policy.updated}</td>
                  <td style={{ ...td }}>
                    <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:policy.status==='active'?'rgba(74,122,171,0.15)':'rgba(107,141,181,0.15)', color:policy.status==='active'?'#4A7AAB':'#6B8DB5', border:`1px solid ${policy.status==='active'?'rgba(74,122,171,0.3)':'rgba(107,141,181,0.3)'}` }}>
                      {policy.status==='active'?(lang==='ar'?'نشط':'Active'):(lang==='ar'?'مسودة':'Draft')}
                    </span>
                  </td>
                  <td style={{ ...td, color:ds.muted }}>{policy.views}</td>
                  <td style={{ ...td }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <ActionBtn icon={Eye} color="#4A7AAB" ds={ds} />
                      <ActionBtn icon={Download} color="#6B8DB5" ds={ds} />
                    </div>
                  </td>
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
function ActionBtn({ icon: Icon, color, ds }) {
  const [hov, setHov] = useState(false);
  return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${hov?color+'60':ds.border}`, background:hov?color+'15':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transform:hov?'scale(1.08)':'scale(1)', transition:'all 0.15s ease' }}><Icon size={13} color={hov?color:ds.muted} /></button>;
}
