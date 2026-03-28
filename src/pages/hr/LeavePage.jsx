import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { fetchLeaveRequests, approveLeaveRequest, rejectLeaveRequest, createLeaveRequest } from '../../services/leaveService';
import { createApproval, getApprovals, approveRequest, rejectRequest, getApprovalByEntity } from '../../services/approvalService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { CalendarOff, Clock, CheckCircle2, XCircle, Plus, Check, X, MessageSquare, User } from 'lucide-react';
import { KpiCard, Badge, Button, Card, CardHeader, Table, Th, Td, Tr, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';

/* ─── Inline ApprovalBadge Component ─── */
function ApprovalBadge({ status, approverName, comments, lang }) {
  const map = {
    pending:  { label_ar: 'بانتظار الموافقة', label_en: 'Pending Approval', color: '#F59E0B', bg: '#F59E0B18', icon: Clock },
    approved: { label_ar: 'تمت الموافقة',     label_en: 'Approved',         color: '#10B981', bg: '#10B98118', icon: CheckCircle2 },
    rejected: { label_ar: 'مرفوض',            label_en: 'Rejected',         color: '#EF4444', bg: '#EF444418', icon: XCircle },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}35` }}
      >
        <Icon size={12} />
        {lang === 'ar' ? s.label_ar : s.label_en}
      </div>
      {status !== 'pending' && approverName && (
        <div className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark">
          <User size={10} />
          <span>{approverName}</span>
        </div>
      )}
      {status !== 'pending' && comments && (
        <div className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark">
          <MessageSquare size={10} />
          <span className="truncate max-w-[140px]">{comments}</span>
        </div>
      )}
    </div>
  );
}

export default function LeavePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [rejectCommentId, setRejectCommentId] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqForm, setReqForm] = useState({ employee_id: '', type: 'annual', start_date: '', end_date: '', notes: '' });
  const [reqSaving, setReqSaving] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const { auditFields, applyAuditFilters } = useAuditFilter('leave');

  const loadApprovals = useCallback(async () => {
    const result = await getApprovals({ type: 'leave' });
    setApprovals(Array.isArray(result) ? result : []);
  }, []);

  useEffect(() => {
    Promise.all([fetchLeaveRequests(), fetchEmployees()]).then(([l, e]) => {
      setLeaves(l); setEmployees(e); setLoading(false);
    });
    loadApprovals();
  }, [loadApprovals]);

  // Listen for approval changes
  useEffect(() => {
    const handler = () => loadApprovals();
    window.addEventListener('platform_approval_change', handler);
    return () => window.removeEventListener('platform_approval_change', handler);
  }, [loadApprovals]);

  // Get the approval record for a leave request
  const getLeaveApproval = (leaveId) => {
    return approvals.find(a => a.data?.entity_id === leaveId) || null;
  };

  // Determine effective status: use approval record if exists, otherwise fall back to leave status
  const getEffectiveStatus = (lv) => {
    const approval = getLeaveApproval(lv.id);
    return approval ? approval.status : lv.status;
  };

  const pending  = leaves.filter(l => getEffectiveStatus(l) === 'pending').length;
  const approved = leaves.filter(l => getEffectiveStatus(l) === 'approved').length;
  const rejected = leaves.filter(l => getEffectiveStatus(l) === 'rejected').length;

  const approve = async (leaveId) => {
    const approval = getLeaveApproval(leaveId);
    if (approval) {
      // Approve via approval workflow
      await approveRequest(approval.id, lang === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager', '');
      loadApprovals();
    }
    // Also update the leave request itself
    await approveLeaveRequest(leaveId);
    setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status: 'approved' } : l));
  };

  const reject = async (leaveId) => {
    const approval = getLeaveApproval(leaveId);
    const comment = rejectCommentId === leaveId ? rejectComment : '';
    if (approval) {
      await rejectRequest(approval.id, lang === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager', comment);
      loadApprovals();
    }
    await rejectLeaveRequest(leaveId, comment);
    setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status: 'rejected' } : l));
    setRejectCommentId(null);
    setRejectComment('');
  };

  // Ensure existing pending leaves have approval records (migration for mock data)
  useEffect(() => {
    if (leaves.length && employees.length) {
      const createMissing = async () => {
        for (const lv of leaves) {
          if (lv.status === 'pending' && !getLeaveApproval(lv.id)) {
            const emp = employees.find(e => e.id === lv.employee_id || e.employee_id === lv.emp_id);
            const name = emp ? ((lang === 'ar' ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar) : (lv.employee_id || 'Employee');
            await createApproval({
              type: 'leave',
              requesterId: lv.employee_id || lv.emp_id || '',
              requesterName: name,
              data: { entity_id: lv.id, leave_type: lv.type, start_date: lv.start_date, end_date: lv.end_date, days: lv.days, reason: lv.reason },
              approverId: 'e1',
              approverName: lang === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager',
            });
          }
        }
        loadApprovals();
      };
      createMissing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves.length, employees.length]);

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'pending', label: 'معلق', labelEn: 'Pending' },
        { value: 'approved', label: 'موافق', labelEn: 'Approved' },
        { value: 'rejected', label: 'مرفوض', labelEn: 'Rejected' },
      ],
    },
    {
      id: 'approval_status', label: 'حالة الموافقة', labelEn: 'Approval Status', type: 'select',
      options: [
        { value: 'pending', label: 'بانتظار الموافقة', labelEn: 'Pending Approval' },
        { value: 'approved', label: 'تمت الموافقة', labelEn: 'Approved' },
        { value: 'rejected', label: 'مرفوض', labelEn: 'Rejected' },
      ],
    },
    {
      id: 'type', label: 'النوع', labelEn: 'Type', type: 'select',
      options: [
        { value: 'annual', label: 'سنوية', labelEn: 'Annual' },
        { value: 'sick', label: 'مرضية', labelEn: 'Sick' },
        { value: 'unpaid', label: 'بدون راتب', labelEn: 'Unpaid' },
        { value: 'emergency', label: 'طارئة', labelEn: 'Emergency' },
      ],
    },
    { id: 'start_date', label: 'من', labelEn: 'From', type: 'date' },
    { id: 'end_date', label: 'إلى', labelEn: 'To', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = leaves;
    // Handle approval_status filter manually since it comes from approvals, not leave data
    const approvalFilter = smartFilters.find(f => f.field === 'approval_status');
    if (approvalFilter) {
      result = result.filter(lv => {
        const approval = getLeaveApproval(lv.id);
        const effectiveStatus = approval ? approval.status : lv.status;
        return effectiveStatus === approvalFilter.value;
      });
    }
    const otherFilters = smartFilters.filter(f => f.field !== 'approval_status');
    result = applySmartFilters(result, otherFilters, SMART_FIELDS);
    result = applyAuditFilters(result, otherFilters);
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, smartFilters, SMART_FIELDS, approvals]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [smartFilters]);

  const statusColor = s => s==='approved'?'#10B981':s==='pending'?'#F59E0B':'#EF4444';
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
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(getEffectiveStatus(r), lang) },
            ]}
          />
          <Button size="md" onClick={() => setShowRequestModal(true)}><Plus size={16}/>{lang==='ar'?'+ طلب إجازة':'+ Request Leave'}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={CalendarOff}  label={lang==='ar'?'إجمالي الطلبات':'Total Requests'} value={leaves.length} color="#1B3347" />
        <KpiCard icon={Clock}        label={lang==='ar'?'بانتظار الموافقة':'Pending Approval'} value={pending} color="#F59E0B" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'موافق عليها':'Approved'} value={approved} color="#10B981" />
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

      {/* Smart Filters */}
      <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />

      {/* Leave Requests Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'طلبات الإجازة':'Leave Requests'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الموظف':'Employee',lang==='ar'?'النوع':'Type',lang==='ar'?'من':'From',lang==='ar'?'إلى':'To',lang==='ar'?'أيام':'Days',lang==='ar'?'حالة الموافقة':'Approval Status',''].map((h,i)=>(
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
            const approval = getLeaveApproval(lv.id);
            const effectiveStatus = approval ? approval.status : lv.status;
            return (
              <Tr key={lv.id}>
                <Td className="font-semibold">{name}</Td>
                <Td><Badge style={{ background:'#4A7AAB18', color:'#4A7AAB', border:'1px solid #4A7AAB35' }}>{typeLabel(lv.type,lang)}</Badge></Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{lv.start_date||lv.from}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{lv.end_date||lv.to}</Td>
                <Td className="font-bold text-brand-500">{lv.days}</Td>
                <Td>
                  <ApprovalBadge
                    status={effectiveStatus}
                    approverName={approval?.approver_name}
                    comments={approval?.comments}
                    lang={lang}
                  />
                </Td>
                <Td>{effectiveStatus==='pending'&&(
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button onClick={(e)=>{e.stopPropagation();approve(lv.id);}} className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-emerald-500/10 hover:border-emerald-500/40 flex items-center justify-center cursor-pointer transition-all duration-150" title={lang==='ar'?'موافقة':'Approve'}>
                        <Check size={13} className="text-emerald-500" />
                      </button>
                      <button onClick={(e)=>{e.stopPropagation(); rejectCommentId === lv.id ? reject(lv.id) : setRejectCommentId(lv.id);}} className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-red-500/10 hover:border-red-500/40 flex items-center justify-center cursor-pointer transition-all duration-150" title={lang==='ar'?'رفض':'Reject'}>
                        <X size={13} className="text-red-500" />
                      </button>
                    </div>
                    {rejectCommentId === lv.id && (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={rejectComment}
                          onChange={e => setRejectComment(e.target.value)}
                          placeholder={lang==='ar'?'سبب الرفض...':'Rejection reason...'}
                          className="flex-1 px-2 py-1 text-[11px] rounded-md border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark placeholder:text-content-muted dark:placeholder:text-content-muted-dark outline-none focus:border-brand-500"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') reject(lv.id); if (e.key === 'Escape') { setRejectCommentId(null); setRejectComment(''); } }}
                        />
                      </div>
                    )}
                  </div>
                )}</Td>
              </Tr>
            );
          })}</tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>

      {/* ── Leave Request Modal ── */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowRequestModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[480px] p-6">
            <h3 className="m-0 text-base font-bold text-content dark:text-content-dark mb-4">
              {lang === 'ar' ? 'طلب إجازة جديد' : 'New Leave Request'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الموظف' : 'Employee'}</label>
                <select value={reqForm.employee_id} onChange={e => setReqForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm">
                  <option value="">{isRTL ? 'اختر الموظف...' : 'Select employee...'}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{isRTL ? e.full_name_ar : (e.full_name_en || e.full_name_ar)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'نوع الإجازة' : 'Leave Type'}</label>
                <select value={reqForm.type} onChange={e => setReqForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm">
                  <option value="annual">{isRTL ? 'سنوية' : 'Annual'}</option>
                  <option value="sick">{isRTL ? 'مرضية' : 'Sick'}</option>
                  <option value="casual">{isRTL ? 'عارضة' : 'Casual'}</option>
                  <option value="unpaid">{isRTL ? 'بدون راتب' : 'Unpaid'}</option>
                </select>
              </div>
              <div />
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'من تاريخ' : 'Start Date'}</label>
                <input type="date" value={reqForm.start_date} onChange={e => setReqForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'إلى تاريخ' : 'End Date'}</label>
                <input type="date" value={reqForm.end_date} onChange={e => setReqForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea rows={2} value={reqForm.notes} onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-2.5 justify-end mt-5">
              <Button variant="secondary" onClick={() => setShowRequestModal(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button disabled={reqSaving || !reqForm.employee_id || !reqForm.start_date || !reqForm.end_date} onClick={async () => {
                setReqSaving(true);
                try {
                  const result = await createLeaveRequest(reqForm);
                  setLeaves(prev => [result, ...prev]);
                  setShowRequestModal(false);
                  setReqForm({ employee_id: '', type: 'annual', start_date: '', end_date: '', notes: '' });
                } catch {} finally { setReqSaving(false); }
              }}>
                {reqSaving ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال الطلب' : 'Submit Request')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
