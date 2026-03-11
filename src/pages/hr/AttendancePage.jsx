import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';
import { Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Download } from 'lucide-react';


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

function AttendanceRow({ emp, attendance, isRTL, ds }) {
  const [hov, setHov] = useState(false);
  const recs = attendance[emp.employee_id] || [];
  const p = recs.filter(r => r.check_in && !r.absent).length;
  const a = recs.filter(r => r.absent).length;
  const l = recs.filter(r => r.check_in && !r.absent).filter(r => { const [h, m] = (r.check_in || '').split(':').map(Number); return h > 10 || (h === 10 && m > 30); }).length;
  const total = recs.length || 1;
  const rate = Math.round((p / total) * 100);
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar || '';
  const ini = name.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || '??';
  const td = { fontSize: 13, color: ds.text, padding: '12px 14px', verticalAlign: 'middle' };
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderBottom: `1px solid ${ds.border}`, background: hov ? ds.rowHover : 'transparent', transition: 'background 0.15s' }}>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#2B4C6F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{ini}</span>
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ds.text }}>{name}</p>
            <p style={{ margin: 0, fontSize: 11, color: ds.muted }}>{emp.employee_id}</p>
          </div>
        </div>
      </td>
      <td style={{ ...td, color: ds.muted }}>{emp.department_ar || emp.department}</td>
      <td style={{ ...td, fontWeight: 700, color: '#4A7AAB' }}>{p}</td>
      <td style={{ ...td, fontWeight: 700, color: '#EF4444' }}>{a}</td>
      <td style={{ ...td, fontWeight: 700, color: '#6B8DB5' }}>{l}</td>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}>
            <div style={{ height: '100%', borderRadius: 3, width: rate + '%', background: rate >= 80 ? '#4A7AAB' : rate >= 60 ? '#6B8DB5' : '#EF4444', transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: ds.text, minWidth: 32 }}>{rate}%</span>
        </div>
      </td>
    </tr>
  );
}


export default function AttendancePage() {
  const { i18n } = useTranslation(); const ds = useDS();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year] = useState(() => new Date().getFullYear());
  const allRecords = useMemo(() => getAttendanceForMonth(year, month), [year, month]);
  const attendance = useMemo(() => {
    const grouped = {};
    allRecords.forEach(r => {
      if (!grouped[r.employee_id]) grouped[r.employee_id] = [];
      grouped[r.employee_id].push(r);
    });
    return grouped;
  }, [allRecords]);
  const stats = useMemo(() => {
    let present=0, absent=0, late=0, leave=0;
    allRecords.forEach(r => {
      if (r.absent) { absent++; return; }
      if (r.check_in) {
        const [h, m] = r.check_in.split(':').map(Number);
        if (h > 10 || (h === 10 && m > 30)) late++;
        else present++;
      }
    });
    return { present, absent, late, leave };
  }, [allRecords]);
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const th = { fontSize:11, fontWeight:700, color:ds.muted, padding:'10px 14px', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' };
  const td = { fontSize:13, color:ds.text, padding:'12px 14px', verticalAlign:'middle' };
  return (
    <div style={{ padding:'24px 28px', background:ds.bg, minHeight:'100vh', direction:isRTL?'rtl':'ltr' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexDirection:isRTL?'row-reverse':'row' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, flexDirection:isRTL?'row-reverse':'row' }}>
          <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#1B3347,#4A7AAB)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(74,122,171,0.3)' }}><Clock size={22} color="#fff" /></div>
          <div style={{ textAlign:isRTL?'right':'left' }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:ds.text }}>{lang==='ar'?'الحضور والغياب':'Attendance'}</h1>
            <p style={{ margin:0, fontSize:12, color:ds.muted }}>{MONTHS_AR[month-1]} {year}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={month} onChange={e=>setMonth(+e.target.value)} style={{ padding:'8px 14px', borderRadius:9, border:`1px solid ${ds.border}`, background:ds.input, color:ds.text, fontSize:13, cursor:'pointer', outline:'none' }}>
            {MONTHS_AR.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Clock size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:ds.text }}>{lang==='ar'?'لا توجد بيانات حضور':'No Attendance Data'}</p>
                <p style={{ margin:0, fontSize:13, color:ds.muted }}>{lang==='ar'?'لم يتم تسجيل أي بيانات حضور بعد':'No attendance records yet'}</p>
              </div>
            ) : MONTHS_AR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <ExportBtn label={lang==='ar'?'تصدير':'Export'} ds={ds} />
        </div>
      </div>
      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'حاضر':'Present'}  value={stats.present} color="#4A7AAB" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'غائب':'Absent'}   value={stats.absent}  color="#EF4444" />
        <KpiCard icon={AlertCircle}  label={lang==='ar'?'متأخر':'Late'}     value={stats.late}    color="#6B8DB5" />
        <KpiCard icon={Calendar}     label={lang==='ar'?'إجازة':'Leave'}    value={stats.leave}   color="#8BA8C8" />
      </div>
      <div style={{ background:ds.card, borderRadius:14, border:`1px solid ${ds.border}`, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${ds.border}` }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:ds.text }}>{lang==='ar'?`حضور ${MONTHS_AR[month-1]}`:`${MONTHS_AR[month-1]} Attendance`}</p>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:ds.thBg, borderBottom:`2px solid ${ds.border}` }}>
              {[lang==='ar'?'الموظف':'Employee', lang==='ar'?'القسم':'Dept', lang==='ar'?'حاضر':'Present', lang==='ar'?'غائب':'Absent', lang==='ar'?'متأخر':'Late', lang==='ar'?'نسبة':'Rate'].map((h,i)=>(
                <th key={i} style={{ ...th, textAlign:isRTL?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_EMPLOYEES.map(emp => (
              <AttendanceRow key={emp.id} emp={emp} attendance={attendance} isRTL={isRTL} ds={ds} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ExportBtn({ label, ds }) {
  const [hov, setHov] = useState(false);
  return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, border:`1px solid ${hov?'#4A7AAB60':ds.border}`, background:hov?'rgba(74,122,171,0.1)':'transparent', cursor:'pointer', color:hov?'#4A7AAB':ds.muted, fontSize:13, fontWeight:600, transition:'all 0.15s' }}><Download size={14}/>{label}</button>;
}
