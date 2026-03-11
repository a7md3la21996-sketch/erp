import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { Shield, AlertTriangle, XCircle, CheckCircle2, Plus, Eye, ShieldAlert } from 'lucide-react';
import { Button, Card, KpiCard, Tr, Td } from '../../components/ui';


const MOCK_CASES = [
  { id:1, emp_id:'EMP-001', type:'warning', reason:'تأخير متكرر', date:'2026-02-10', status:'open', severity:'low' },
  { id:2, emp_id:'EMP-002', type:'suspension', reason:'غياب بدون إذن', date:'2026-01-20', status:'closed', severity:'high' },
  { id:3, emp_id:'EMP-003', type:'warning', reason:'سلوك غير لائق', date:'2026-03-01', status:'open', severity:'medium' },
  { id:4, emp_id:'EMP-004', type:'termination', reason:'خرق سياسة الشركة', date:'2026-02-28', status:'closed', severity:'high' },
];

/* ─── Dynamic Badge ─── */
function DynBadge({ label, color = '#4A7AAB' }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

export default function DisciplinaryPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [cases] = useState(MOCK_CASES);

  const open   = cases.filter(c=>c.status==='open').length;
  const closed = cases.filter(c=>c.status==='closed').length;
  const high   = cases.filter(c=>c.severity==='high').length;

  const severityColor = s => s==='high'?'#EF4444':s==='medium'?'#6B8DB5':'#4A7AAB';
  const severityLabel = (s,lang) => ({ high:lang==='ar'?'عالي':'High', medium:lang==='ar'?'متوسط':'Medium', low:lang==='ar'?'منخفض':'Low' }[s]||s);
  const typeLabel     = (t,lang) => ({ warning:lang==='ar'?'إنذار':'Warning', suspension:lang==='ar'?'إيقاف':'Suspension', termination:lang==='ar'?'فصل':'Termination' }[t]||t);
  const statusLabel   = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-7 py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[46px] h-[46px] rounded-[13px] bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shadow-md">
            <Shield size={22} color="#fff" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{lang==='ar'?'الشؤون التأديبية':'Disciplinary'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة الحالات التأديبية':'Manage disciplinary cases'}</p>
          </div>
        </div>
        <Button size="md">
          <Plus size={16} />{lang==='ar'?'+ حالة جديدة':'+ New Case'}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Shield}       label={lang==='ar'?'إجمالي الحالات':'Total Cases'} value={cases.length} color="#1B3347" />
        <KpiCard icon={AlertTriangle} label={lang==='ar'?'مفتوحة':'Open'}           value={open}         color="#6B8DB5" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'خطورة عالية':'High Severity'} value={high}         color="#EF4444" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مغلقة':'Closed'}          value={closed}       color="#4A7AAB" />
      </div>

      <Card className="!rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-edge dark:border-edge-dark">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'سجل الحالات':'Cases Log'}</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
              {[lang==='ar'?'الموظف':'Employee', lang==='ar'?'النوع':'Type', lang==='ar'?'السبب':'Reason', lang==='ar'?'التاريخ':'Date', lang==='ar'?'الخطورة':'Severity', lang==='ar'?'الحالة':'Status'].map((h,i)=>(
                <th key={i} className={`text-[11px] font-bold text-content-muted dark:text-content-muted-dark px-3.5 py-2.5 uppercase tracking-wider ${isRTL?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="text-center py-16 px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <ShieldAlert size={24} color="#4A7AAB" />
                    </div>
                    <p className="m-0 mb-1.5 text-[15px] font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد مخالفات تأديبية':'No Disciplinary Records'}</p>
                    <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تسجيل أي مخالفات':'No disciplinary records found'}</p>
                  </div>
                </td>
              </tr>
            ) : cases.map(cas => {
              const emp = MOCK_EMPLOYEES.find(e=>e.employee_id===cas.emp_id||e.id===cas.emp_id);
              const name = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : cas.emp_id;
              return (
                <Tr key={cas.id}>
                  <Td className="font-semibold">{name}</Td>
                  <Td><DynBadge label={typeLabel(cas.type,lang)} color="#4A7AAB" /></Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{cas.reason}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{cas.date}</Td>
                  <Td><DynBadge label={severityLabel(cas.severity,lang)} color={severityColor(cas.severity)} /></Td>
                  <Td><DynBadge label={statusLabel(cas.status,lang)} color={cas.status==='open'?'#6B8DB5':'#4A7AAB'} /></Td>
                </Tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
