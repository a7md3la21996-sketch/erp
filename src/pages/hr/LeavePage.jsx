import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { CalendarOff, Clock, CheckCircle2, XCircle, Plus, Check, X } from 'lucide-react';
import { KpiCard, Badge, Button, Card, CardHeader, Table, Th, Td, Tr } from '../../components/ui';

const MOCK_LEAVES = [
  { id:1, emp_id:'EMP-001', type:'annual', days:5, from:'2026-03-10', to:'2026-03-14', status:'pending', notes:'رحلة عائلية' },
  { id:2, emp_id:'EMP-002', type:'sick',   days:2, from:'2026-03-05', to:'2026-03-06', status:'approved', notes:'مرض' },
  { id:3, emp_id:'EMP-003', type:'annual', days:3, from:'2026-03-15', to:'2026-03-17', status:'pending', notes:'' },
  { id:4, emp_id:'EMP-004', type:'unpaid', days:1, from:'2026-03-20', to:'2026-03-20', status:'rejected', notes:'ظروف شخصية' },
  { id:5, emp_id:'EMP-005', type:'annual', days:7, from:'2026-03-22', to:'2026-03-28', status:'approved', notes:'إجازة سنوية' },
];

export default function LeavePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [leaves, setLeaves] = useState(MOCK_LEAVES);

  const pending  = leaves.filter(l=>l.status==='pending').length;
  const approved = leaves.filter(l=>l.status==='approved').length;
  const rejected = leaves.filter(l=>l.status==='rejected').length;

  const approve = id => setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:'approved'}:l));
  const reject  = id => setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:'rejected'}:l));

  const statusColor = s => s==='approved'?'#4A7AAB':s==='pending'?'#6B8DB5':'#EF4444';
  const statusLabel = (s,lang) => ({ approved:lang==='ar'?'موافق':'Approved', pending:lang==='ar'?'معلق':'Pending', rejected:lang==='ar'?'مرفوض':'Rejected' }[s]||s);
  const typeLabel   = (t,lang) => ({ annual:lang==='ar'?'سنوية':'Annual', sick:lang==='ar'?'مرضية':'Sick', unpaid:lang==='ar'?'بدون راتب':'Unpaid', emergency:lang==='ar'?'طارئة':'Emergency' }[t]||t);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shadow-md" style={{ background:'linear-gradient(135deg,#1B3347,#4A7AAB)' }}>
            <CalendarOff size={22} color="#fff" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{lang==='ar'?'الإجازات':'Leave Management'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة طلبات الإجازات':'Manage leave requests'}</p>
          </div>
        </div>
        <Button size="md"><Plus size={16}/>{lang==='ar'?'+ طلب إجازة':'+ Request Leave'}</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={CalendarOff}  label={lang==='ar'?'إجمالي الطلبات':'Total Requests'} value={leaves.length} color="#1B3347" />
        <KpiCard icon={Clock}        label={lang==='ar'?'معلقة':'Pending'} value={pending} color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'موافق عليها':'Approved'} value={approved} color="#4A7AAB" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'مرفوضة':'Rejected'} value={rejected} color="#EF4444" />
      </div>

      {/* Leave Balances */}
      <Card className="p-5 mb-4">
        <p className="m-0 mb-3.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'أرصدة الإجازات':'Leave Balances'}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {MOCK_EMPLOYEES.slice(0,6).map(emp => {
            const bal = emp.leave_balance ?? 21; const pct = Math.round(bal/21*100);
            const name = (isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar;
            const initials = name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'??';
            return (
              <div key={emp.id} className="p-3 rounded-[10px] border border-edge dark:border-edge-dark bg-[#F8FAFC] dark:bg-brand-500/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#2B4C6F] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{initials}</span>
                  </div>
                  <span className="text-xs font-semibold text-content dark:text-content-dark">{name}</span>
                </div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'الرصيد':'Balance'}</span>
                  <span className="text-xs font-bold text-brand-500">{bal} {lang==='ar'?'يوم':'days'}</span>
                </div>
                <div className="h-1 rounded-sm bg-slate-200 dark:bg-white/[0.08]">
                  <div className="h-full rounded-sm" style={{ width:pct+'%', background:pct>50?'#4A7AAB':pct>25?'#6B8DB5':'#EF4444' }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Leave Requests Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'طلبات الإجازة':'Leave Requests'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الموظف':'Employee',lang==='ar'?'النوع':'Type',lang==='ar'?'من':'From',lang==='ar'?'إلى':'To',lang==='ar'?'أيام':'Days',lang==='ar'?'الحالة':'Status',''].map((h,i)=>(
                <Th key={i} className={isRTL?'text-right':'text-left'}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>{leaves.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 px-5">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <CalendarOff size={24} color='#4A7AAB' />
                </div>
                <p className="m-0 mb-1.5 text-[15px] font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد طلبات إجازة':'No Leave Requests'}</p>
                <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تقديم أي طلبات إجازة بعد':'No leave requests submitted yet'}</p>
              </td></tr>
            ) : leaves.map(lv => {
            const emp = MOCK_EMPLOYEES.find(e=>e.employee_id===lv.emp_id);
            const name = emp?((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar):lv.emp_id;
            return (
              <Tr key={lv.id}>
                <Td className="font-semibold">{name}</Td>
                <Td><Badge style={{ background:statusColor(lv.status)+'18', color:'#4A7AAB', border:'1px solid #4A7AAB35' }}>{typeLabel(lv.type,lang)}</Badge></Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{lv.from}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{lv.to}</Td>
                <Td className="font-bold text-brand-500">{lv.days}</Td>
                <Td><Badge style={{ background:statusColor(lv.status)+'18', color:statusColor(lv.status), border:`1px solid ${statusColor(lv.status)}35` }}>{statusLabel(lv.status,lang)}</Badge></Td>
                <Td>{lv.status==='pending'&&(
                  <div className="flex gap-1.5">
                    <button onClick={(e)=>{e.stopPropagation();approve(lv.id);}} className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-500/10 hover:border-brand-500/40 flex items-center justify-center cursor-pointer transition-all duration-150">
                      <Check size={13} className="text-brand-500" />
                    </button>
                    <button onClick={(e)=>{e.stopPropagation();reject(lv.id);}} className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-red-500/10 hover:border-red-500/40 flex items-center justify-center cursor-pointer transition-all duration-150">
                      <X size={13} className="text-red-500" />
                    </button>
                  </div>
                )}</Td>
              </Tr>
            );
          })}</tbody>
        </Table>
      </Card>
    </div>
  );
}
