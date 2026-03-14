import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { fetchLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../../services/leaveService';
import { CalendarOff, Clock, CheckCircle2, XCircle, Plus, Check, X } from 'lucide-react';
import { KpiCard, Badge, Button, Card, CardHeader, Table, Th, Td, Tr, PageSkeleton, ExportButton, Pagination } from '../../components/ui';

export default function LeavePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    Promise.all([fetchLeaveRequests(), fetchEmployees()]).then(([l, e]) => {
      setLeaves(l); setEmployees(e); setLoading(false);
    });
  }, []);

  const pending  = leaves.filter(l=>l.status==='pending').length;
  const approved = leaves.filter(l=>l.status==='approved').length;
  const rejected = leaves.filter(l=>l.status==='rejected').length;

  const approve = async (id) => {
    await approveLeaveRequest(id);
    setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:'approved'}:l));
  };
  const reject = async (id) => {
    await rejectLeaveRequest(id);
    setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:'rejected'}:l));
  };

  const totalPages = Math.max(1, Math.ceil(leaves.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = leaves.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const statusColor = s => s==='approved'?'#4A7AAB':s==='pending'?'#6B8DB5':'#EF4444';
  const statusLabel = (s,lang) => ({ approved:lang==='ar'?'موافق':'Approved', pending:lang==='ar'?'معلق':'Pending', rejected:lang==='ar'?'مرفوض':'Rejected' }[s]||s);
  const typeLabel   = (t,lang) => ({ annual:lang==='ar'?'سنوية':'Annual', sick:lang==='ar'?'مرضية':'Sick', unpaid:lang==='ar'?'بدون راتب':'Unpaid', emergency:lang==='ar'?'طارئة':'Emergency' }[t]||t);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={7} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <CalendarOff size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'الإجازات':'Leave Management'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة طلبات الإجازات':'Manage leave requests'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={leaves}
            filename={isRTL ? 'الإجازات' : 'leaves'}
            title={isRTL ? 'الإجازات' : 'Leave Management'}
            columns={[
              { header: isRTL ? 'رقم الموظف' : 'Employee ID', key: r => r.employee_id || r.emp_id },
              { header: isRTL ? 'النوع' : 'Type', key: r => typeLabel(r.type, lang) },
              { header: isRTL ? 'الأيام' : 'Days', key: 'days' },
              { header: isRTL ? 'من' : 'From', key: r => r.start_date || r.from },
              { header: isRTL ? 'إلى' : 'To', key: r => r.end_date || r.to },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
            ]}
          />
          <Button size="md"><Plus size={16}/>{lang==='ar'?'+ طلب إجازة':'+ Request Leave'}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={CalendarOff}  label={lang==='ar'?'إجمالي الطلبات':'Total Requests'} value={leaves.length} color="#1B3347" />
        <KpiCard icon={Clock}        label={lang==='ar'?'معلقة':'Pending'} value={pending} color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'موافق عليها':'Approved'} value={approved} color="#4A7AAB" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'مرفوضة':'Rejected'} value={rejected} color="#EF4444" />
      </div>

      {/* Leave Balances */}
      <Card className="p-5 mb-4">
        <p className="m-0 mb-3.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'أرصدة الإجازات':'Leave Balances'}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {employees.slice(0,6).map(emp => {
            const bal = emp.leave_balance ?? 21; const pct = Math.round(bal/21*100);
            const name = (isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar;
            const initials = name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'??';
            return (
              <div key={emp.id} className="p-3 rounded-xl border border-edge dark:border-edge-dark bg-[#F8FAFC] dark:bg-brand-500/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#2B4C6F] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{initials}</span>
                  </div>
                  <span className="text-xs font-semibold text-content dark:text-content-dark">{name}</span>
                </div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'الرصيد':'Balance'}</span>
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
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>{leaves.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 px-5">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <CalendarOff size={24} color='#4A7AAB' />
                </div>
                <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد طلبات إجازة':'No Leave Requests'}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تقديم أي طلبات إجازة بعد':'No leave requests submitted yet'}</p>
              </td></tr>
            ) : paged.map(lv => {
            const emp = employees.find(e=>e.id===lv.employee_id||e.employee_id===lv.emp_id);
            const name = emp?((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar):(lv.employee_id||lv.emp_id);
            return (
              <Tr key={lv.id}>
                <Td className="font-semibold">{name}</Td>
                <Td><Badge style={{ background:statusColor(lv.status)+'18', color:'#4A7AAB', border:'1px solid #4A7AAB35' }}>{typeLabel(lv.type,lang)}</Badge></Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{lv.start_date||lv.from}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{lv.end_date||lv.to}</Td>
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
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={leaves.length} />
      </Card>
    </div>
  );
}
