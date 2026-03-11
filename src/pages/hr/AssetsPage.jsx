import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { Package, CheckCircle2, AlertCircle, Clock, Plus, Edit2, Trash2 } from 'lucide-react';


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

const MOCK_ASSETS = [
  { id:1, name:'MacBook Pro 14"', type:'laptop', serial:'MBP-2024-001', assigned_to:'EMP-001', status:'active', condition:'good', value:45000, acquired:'2024-01-15' },
  { id:2, name:'iPhone 15 Pro', type:'phone', serial:'IPH-2024-002', assigned_to:'EMP-002', status:'active', condition:'excellent', value:18000, acquired:'2024-02-10' },
  { id:3, name:'Dell Monitor 27"', type:'monitor', serial:'DLL-2023-003', assigned_to:'EMP-003', status:'active', condition:'good', value:8000, acquired:'2023-11-05' },
  { id:4, name:'Toyota Corolla 2023', type:'vehicle', serial:'VEH-2023-001', assigned_to:'EMP-001', status:'maintenance', condition:'fair', value:280000, acquired:'2023-06-20' },
  { id:5, name:'HP LaserJet Pro', type:'printer', serial:'HPL-2023-004', assigned_to:null, status:'available', condition:'good', value:12000, acquired:'2023-08-14' },
  { id:6, name:'iPad Pro 12.9"', type:'tablet', serial:'IPD-2024-005', assigned_to:'EMP-004', status:'active', condition:'excellent', value:22000, acquired:'2024-03-01' },
];

export default function AssetsPage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [assets, setAssets] = useState(MOCK_ASSETS);
  const [filter, setFilter] = useState('all');

  const filtered = filter==='all' ? assets : assets.filter(a=>a.status===filter);
  const active = assets.filter(a=>a.status==='active').length;
  const available = assets.filter(a=>a.status==='available').length;
  const maintenance = assets.filter(a=>a.status==='maintenance').length;
  const totalValue = assets.reduce((s,a)=>s+a.value,0);

  const statusColor = s => s==='active'?'#4A7AAB':s==='available'?'#6B8DB5':s==='maintenance'?'#EF4444':'#8BA8C8';
  const statusLabel = (s,lang) => ({active:lang==='ar'?'مستخدم':'Active',available:lang==='ar'?'متاح':'Available',maintenance:lang==='ar'?'صيانة':'Maintenance'}[s]||s);
  const conditionColor = c => c==='excellent'?'#4A7AAB':c==='good'?'#6B8DB5':'#EF4444';

  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };

  const filters = [
    {key:'all',label:lang==='ar'?'الكل':'All'},
    {key:'active',label:lang==='ar'?'مستخدم':'Active'},
    {key:'available',label:lang==='ar'?'متاح':'Available'},
    {key:'maintenance',label:lang==='ar'?'صيانة':'Maintenance'},
  ];

  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><Package size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'إدارة الأصول':'Asset Management'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{lang==='ar'?'تتبع أصول الشركة':'Track company assets'}</p>
          </div>
        </div>
        <AddBtn label={lang==='ar'?'+ أضف أصل':'+ Add Asset'} ds={ds} />
      </div>

      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={Package}      label={lang==='ar'?'إجمالي الأصول':'Total Assets'}   value={assets.length}  color="#1B3347" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مستخدمة':'Active'}            value={active}         color="#4A7AAB" />
        <KpiCard icon={AlertCircle}  label={lang==='ar'?'متاحة':'Available'}          value={available}      color="#6B8DB5" />
        <KpiCard icon={Clock}        label={lang==='ar'?'صيانة':'Maintenance'}        value={maintenance}    color="#EF4444" />
      </div>

      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexDirection:isRTL?'row-reverse':'row' }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?'قائمة الأصول':'Asset List'}</p>
          <div style={{ display:'flex', gap:6 }}>
            {filters.map(f => (
              <button key={f.key} onClick={()=>setFilter(f.key)} style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${filter===f.key?ds.accent+'60':ds.border}`, background:filter===f.key?ds.accent+'15':'transparent', color:filter===f.key?ds.accent:ds.muted, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>{f.label}</button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Package size={24} color='#4A7AAB' />
            </div>
            <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد أصول مسجلة':'No Assets Found'}</p>
            <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم تسجيل أي أصول بعد':'No assets registered yet'}</p>
          </div>
        ) : (<>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'الأصل':'Asset', lang==='ar'?'النوع':'Type', lang==='ar'?'مخصص ل':'Assigned To', lang==='ar'?'الحالة':'Status', lang==='ar'?'القيمة':'Value', ''].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(asset => (
              <AssetRow key={asset.id} asset={asset} isRTL={isRTL} lang={lang} ds={ds} td={td} statusColor={statusColor} statusLabel={statusLabel} />
            ))}
          </tbody>
        </table>
        <div style={{ padding:'12px 18px', borderTop:`1px solid ${ds.border}`, display:'flex', justifyContent:'space-between', flexDirection:isRTL?'row-reverse':'row' }}>
          <span style={{ fontSize:12, color:ds.muted }}>{filtered.length} {lang==='ar'?'أصل':' assets'}</span>
          <span style={{ fontSize:12, fontWeight:700, color:ds.accent }}>{lang==='ar'?'إجمالي القيمة:':'Total Value:'} {totalValue.toLocaleString()} ج.م</span>
        </div>
        </>)}}
      </div>
    </div>
  );
}

function AssetRow({ asset, isRTL, lang, ds, td, statusColor, statusLabel }) {
  const [hov, setHov] = useState(false);
  const emp = MOCK_EMPLOYEES.find(e=>e.employee_id===asset.assigned_to||e.id===asset.assigned_to);
  const empName = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : (lang==='ar'?'غير مخصص':'Unassigned');
  return (
    <tr onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ borderBottom:`1px solid ${ds.border}`, background:hov?ds.rowHover:'transparent', transition:'background 0.15s' }}>
      <td style={{ ...td }}>
        <p style={{ margin:0, fontSize:13, fontWeight:700, color:ds.text }}>{asset.name}</p>
        <p style={{ margin:0, fontSize:11, color:ds.muted }}>{asset.serial}</p>
      </td>
      <td style={{ ...td }}><span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(74,122,171,0.12)', color:'#4A7AAB', border:'1px solid rgba(74,122,171,0.25)' }}>{asset.type}</span></td>
      <td style={{ ...td, color:ds.muted }}>{empName}</td>
      <td style={{ ...td }}><span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:statusColor(asset.status)+'18', color:statusColor(asset.status), border:`1px solid ${statusColor(asset.status)}35` }}>{statusLabel(asset.status,lang)}</span></td>
      <td style={{ ...td, fontWeight:700, color:ds.accent }}>{asset.value.toLocaleString()} ج.م</td>
      <td style={{ ...td }}>
        <div style={{ display:'flex', gap:6 }}>
          <ActionBtn icon={Edit2} color="#4A7AAB" ds={ds} />
          <ActionBtn icon={Trash2} color="#EF4444" ds={ds} />
        </div>
      </td>
    </tr>
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
