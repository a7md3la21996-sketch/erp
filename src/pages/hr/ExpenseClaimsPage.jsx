import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getClaims, createClaim, updateClaim, deleteClaim, approveClaim, rejectClaim,
  markClaimPaid, getClaimStats, EXPENSE_CATEGORIES, seedExpenseClaims,
} from '../../services/expenseClaimService';
import { approveRequest, rejectRequest, getApprovalByEntity } from '../../services/approvalService';
import { logAction } from '../../services/auditService';
import { KpiCard } from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import SmartFilter, { applySmartFilters } from '../../components/ui/SmartFilter';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import {
  Receipt, Plus, X, Trash2, Edit3, CheckCircle2, XCircle, Clock,
  DollarSign, ChevronDown, ChevronUp, CreditCard, AlertCircle,
  CalendarDays, FileText, Ban,
} from 'lucide-react';

const PAGE_SIZE_DEFAULT = 25;

const STATUS_CONFIG = {
  pending:  { ar: 'معلق',     en: 'Pending',  color: '#F59E0B', icon: Clock },
  approved: { ar: 'موافق عليه', en: 'Approved', color: '#10B981', icon: CheckCircle2 },
  rejected: { ar: 'مرفوض',    en: 'Rejected', color: '#EF4444', icon: XCircle },
  paid:     { ar: 'مدفوع',    en: 'Paid',     color: '#4A7AAB', icon: CreditCard },
};

export default function ExpenseClaimsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  // SmartFilter
  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);

  // Audit filter
  const { auditFields, applyAuditFilters } = useAuditFilter('expense');

  // ── Form state ──
  const emptyForm = { title: '', category: 'transportation', date: new Date().toISOString().slice(0, 10), description: '', receipt_ref: '', items: [{ description: '', amount: '' }] };
  const [form, setForm] = useState(emptyForm);

  // ── Load ──
  const reload = useCallback(async () => {
    seedExpenseClaims();
    const claimsResult = await getClaims();
    setClaims(Array.isArray(claimsResult) ? claimsResult : []);
    const statsResult = await getClaimStats();
    setStats(statsResult && typeof statsResult === 'object' ? statsResult : {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Listen for approval changes
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('platform_approval_change', handler);
    return () => window.removeEventListener('platform_approval_change', handler);
  }, [reload]);

  // ── Smart filter fields ──
  const smartFields = useMemo(() => [
    { id: 'category', label: 'الفئة', labelEn: 'Category', type: 'select', options: Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'employee_name', label: 'الموظف', labelEn: 'Employee', type: 'text' },
    { id: 'amount', label: 'المبلغ', labelEn: 'Amount', type: 'number' },
    { id: 'date', label: 'التاريخ', labelEn: 'Date', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  // ── Filtered data ──
  const filtered = useMemo(() => {
    let data = claims;
    // Status pill filter
    if (statusFilter !== 'all') data = data.filter(c => c.status === statusFilter);
    // Text search
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.employee_name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    // Smart filters
    data = applySmartFilters(data, smartFilters, smartFields);
    data = applyAuditFilters(data, smartFilters);
    return data;
  }, [claims, statusFilter, search, smartFilters, smartFields, applyAuditFilters]);

  // ── Pagination ──
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Status pill counts ──
  const statusCounts = useMemo(() => {
    const c = { all: claims.length, pending: 0, approved: 0, rejected: 0, paid: 0 };
    claims.forEach(cl => { if (c[cl.status] !== undefined) c[cl.status]++; });
    return c;
  }, [claims]);

  // ── Form helpers ──
  const openNew = () => { setEditingClaim(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (claim) => {
    setEditingClaim(claim);
    setForm({
      title: claim.title, category: claim.category, date: claim.date,
      description: claim.description, receipt_ref: claim.receipt_ref,
      items: claim.items.length ? claim.items.map(it => ({ ...it })) : [{ description: '', amount: '' }],
    });
    setShowModal(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', amount: '' }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, key, val) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [key]: val };
    return { ...f, items };
  });

  const totalAmount = form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    const cleanItems = form.items.filter(it => it.description.trim() && Number(it.amount) > 0).map(it => ({ description: it.description, amount: Number(it.amount) }));
    const amt = cleanItems.length ? cleanItems.reduce((s, it) => s + it.amount, 0) : totalAmount;

    if (editingClaim) {
      await updateClaim(editingClaim.id, { title: form.title, category: form.category, date: form.date, description: form.description, receipt_ref: form.receipt_ref, items: cleanItems, amount: amt });
    } else {
      await createClaim({ title: form.title, category: form.category, amount: amt, currency: 'EGP', date: form.date, description: form.description, receipt_ref: form.receipt_ref, items: cleanItems, employee_id: 'e1', employee_name: 'Ahmed Mohamed' });
    }
    setShowModal(false);
    reload();
  };

  const handleDelete = async (id) => { await deleteClaim(id); reload(); };

  const handleApprove = async (claim) => {
    await approveClaim(claim.id, 'Manager');
    const approval = await getApprovalByEntity('expense', claim.id);
    if (approval) await approveRequest(approval.id, 'Manager');
    reload();
  };

  const handleReject = async (claim) => {
    await rejectClaim(claim.id, 'Manager', rejectReason);
    const approval = await getApprovalByEntity('expense', claim.id);
    if (approval) await rejectRequest(approval.id, 'Manager', rejectReason);
    setRejectingId(null);
    setRejectReason('');
    reload();
  };

  const handleMarkPaid = async (claim) => {
    await markClaimPaid(claim.id, 'Finance');
    logAction({ action: 'update', entity: 'expense', entityId: claim.id, entityName: claim.title, description: `Marked claim as paid: ${claim.title}`, userName: 'Finance' });
    reload();
  };

  // ── Format helpers ──
  const fmtAmount = (amt, cur) => `${Number(amt).toLocaleString()} ${cur || 'EGP'}`;

  // ── Styles ──
  const bg = isDark ? '#0a1929' : '#f8fafc';
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const borderColor = isDark ? '#1e3a5f' : '#e2e8f0';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#132337' : '#ffffff';
  const hoverBg = isDark ? 'rgba(74,122,171,0.06)' : '#f8fafc';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '16px 28px', background: bg, minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={22} color="#4A7AAB" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'طلبات المصروفات' : 'Expense Claims'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: textSecondary }}>
              {isRTL ? 'إدارة ومتابعة طلبات صرف المصروفات' : 'Manage and track expense reimbursement requests'}
            </p>
          </div>
        </div>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> {isRTL ? 'طلب جديد' : 'New Claim'}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={FileText} label={isRTL ? 'إجمالي الطلبات' : 'Total Claims'} value={stats.totalCount || 0} sub={isRTL ? 'جميع الطلبات' : 'All claims'} color="#4A7AAB" />
        <KpiCard icon={Clock} label={isRTL ? 'معلقة' : 'Pending'} value={fmtAmount(stats.pendingAmount || 0)} sub={`${stats.pendingCount || 0} ${isRTL ? 'طلب' : 'claims'}`} color="#F59E0B" />
        <KpiCard icon={CheckCircle2} label={isRTL ? 'موافق عليها' : 'Approved'} value={fmtAmount(stats.approvedAmount || 0)} sub={`${stats.approvedCount || 0} ${isRTL ? 'طلب' : 'claims'}`} color="#10B981" />
        <KpiCard icon={XCircle} label={isRTL ? 'مرفوضة' : 'Rejected'} value={stats.rejectedCount || 0} sub={isRTL ? 'طلبات مرفوضة' : 'Rejected claims'} color="#EF4444" />
        <KpiCard icon={CalendarDays} label={isRTL ? 'هذا الشهر' : 'This Month'} value={fmtAmount(stats.thisMonthAmount || 0)} sub={`${stats.thisMonthCount || 0} ${isRTL ? 'طلب' : 'claims'}`} color="#6B8DB5" />
      </div>

      {/* ── Status Filter Pills ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',      ar: 'الكل',      en: 'All' },
          { key: 'pending',  ar: 'معلقة',     en: 'Pending' },
          { key: 'approved', ar: 'موافق عليها', en: 'Approved' },
          { key: 'rejected', ar: 'مرفوضة',    en: 'Rejected' },
          { key: 'paid',     ar: 'مدفوعة',    en: 'Paid' },
        ].map(pill => {
          const active = statusFilter === pill.key;
          const count = statusCounts[pill.key] || 0;
          const pillColor = pill.key === 'all' ? '#4A7AAB' : STATUS_CONFIG[pill.key]?.color || '#4A7AAB';
          return (
            <button key={pill.key} onClick={() => { setStatusFilter(pill.key); setPage(1); }} style={{
              padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? pillColor : borderColor}`,
              background: active ? `${pillColor}18` : 'transparent', color: active ? pillColor : textSecondary,
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isRTL ? pill.ar : pill.en}
              <span style={{ background: active ? pillColor : `${textSecondary}30`, color: active ? '#fff' : textSecondary, fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── SmartFilter ── */}
      <SmartFilter
        fields={smartFields}
        filters={smartFilters}
        onFiltersChange={f => { setSmartFilters(f); setPage(1); }}
        search={search}
        onSearchChange={v => { setSearch(v); setPage(1); }}
        searchPlaceholder={isRTL ? 'بحث في المصروفات...' : 'Search expenses...'}
        resultsCount={filtered.length}
      />

      {/* ── Claims Table ── */}
      <div style={{ background: cardBg, borderRadius: 14, border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                {[
                  isRTL ? 'التاريخ' : 'Date',
                  isRTL ? 'العنوان' : 'Title',
                  isRTL ? 'الفئة' : 'Category',
                  isRTL ? 'الموظف' : 'Employee',
                  isRTL ? 'المبلغ' : 'Amount',
                  isRTL ? 'الحالة' : 'Status',
                  isRTL ? 'المعتمد' : 'Approver',
                  isRTL ? 'إجراءات' : 'Actions',
                ].map((h, i) => (
                  <th key={i} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: isRTL ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: textSecondary, fontSize: 13 }}>
                  {isRTL ? 'لا توجد طلبات' : 'No claims found'}
                </td></tr>
              )}
              {paged.map(claim => {
                const cat = EXPENSE_CATEGORIES[claim.category] || EXPENSE_CATEGORIES.other;
                const st = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending;
                const StIcon = st.icon;
                const isExpanded = expandedId === claim.id;
                const isRejecting = rejectingId === claim.id;

                return (
                  <tbody key={claim.id}>
                    <tr onClick={() => setExpandedId(isExpanded ? null : claim.id)}
                      style={{ borderBottom: `1px solid ${borderColor}50`, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontSize: 12, color: textSecondary, textAlign: isRTL ? 'right' : 'left' }}>
                        {claim.date}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isExpanded ? <ChevronUp size={14} color={textSecondary} /> : <ChevronDown size={14} color={textSecondary} />}
                          <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{claim.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}30` }}>
                          {isRTL ? cat.ar : cat.en}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: textPrimary, textAlign: isRTL ? 'right' : 'left' }}>
                        {claim.employee_name}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: textPrimary, textAlign: isRTL ? 'right' : 'left' }}>
                        {fmtAmount(claim.amount, claim.currency)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                          <StIcon size={12} /> {isRTL ? st.ar : st.en}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: textSecondary, textAlign: isRTL ? 'right' : 'left' }}>
                        {claim.approver_name || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {claim.status === 'pending' && (
                            <>
                              <button onClick={() => openEdit(claim)} title={isRTL ? 'تعديل' : 'Edit'} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${borderColor}`, background: 'transparent', color: '#4A7AAB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                                <Edit3 size={12} />
                              </button>
                              <button onClick={() => handleDelete(claim.id)} title={isRTL ? 'حذف' : 'Delete'} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${borderColor}`, background: 'transparent', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                                <Trash2 size={12} />
                              </button>
                              <button onClick={() => handleApprove(claim)} title={isRTL ? 'موافقة' : 'Approve'} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #10B98130', background: '#10B98110', color: '#10B981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600 }}>
                                <CheckCircle2 size={12} /> {isRTL ? 'موافقة' : 'Approve'}
                              </button>
                              <button onClick={() => { setRejectingId(isRejecting ? null : claim.id); setRejectReason(''); }} title={isRTL ? 'رفض' : 'Reject'} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #EF444430', background: '#EF444410', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600 }}>
                                <Ban size={12} /> {isRTL ? 'رفض' : 'Reject'}
                              </button>
                            </>
                          )}
                          {claim.status === 'approved' && (
                            <button onClick={() => handleMarkPaid(claim)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #4A7AAB30', background: '#4A7AAB10', color: '#4A7AAB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600 }}>
                              <CreditCard size={12} /> {isRTL ? 'تم الدفع' : 'Mark Paid'}
                            </button>
                          )}
                        </div>
                        {/* Reject reason inline input */}
                        {isRejecting && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
                            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={isRTL ? 'سبب الرفض...' : 'Rejection reason...'}
                              style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 11, outline: 'none' }}
                              onKeyDown={e => e.key === 'Enter' && handleReject(claim)}
                            />
                            <button onClick={() => handleReject(claim)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              {isRTL ? 'تأكيد' : 'Confirm'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* ── Expanded Details ── */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <div style={{ padding: '16px 24px', background: isDark ? '#132337' : '#f1f5f9', borderBottom: `1px solid ${borderColor}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: claim.items.length ? 16 : 0 }}>
                              <div>
                                <p style={{ margin: 0, fontSize: 10, color: textSecondary, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{isRTL ? 'الوصف' : 'Description'}</p>
                                <p style={{ margin: 0, fontSize: 12, color: textPrimary }}>{claim.description || '—'}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: 10, color: textSecondary, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{isRTL ? 'مرجع الإيصال' : 'Receipt Ref'}</p>
                                <p style={{ margin: 0, fontSize: 12, color: textPrimary }}>{claim.receipt_ref || '—'}</p>
                              </div>
                              {claim.rejected_reason && (
                                <div>
                                  <p style={{ margin: 0, fontSize: 10, color: '#EF4444', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{isRTL ? 'سبب الرفض' : 'Rejection Reason'}</p>
                                  <p style={{ margin: 0, fontSize: 12, color: '#EF4444' }}>{claim.rejected_reason}</p>
                                </div>
                              )}
                              <div>
                                <p style={{ margin: 0, fontSize: 10, color: textSecondary, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{isRTL ? 'تاريخ الإنشاء' : 'Created At'}</p>
                                <p style={{ margin: 0, fontSize: 12, color: textPrimary }}>{new Date(claim.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            {/* Line items */}
                            {claim.items.length > 0 && (
                              <div>
                                <p style={{ margin: '0 0 8px', fontSize: 11, color: textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>{isRTL ? 'البنود' : 'Line Items'}</p>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: '6px 12px', fontSize: 10, color: textSecondary, textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${borderColor}` }}>{isRTL ? 'البيان' : 'Description'}</th>
                                      <th style={{ padding: '6px 12px', fontSize: 10, color: textSecondary, textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${borderColor}`, width: 120 }}>{isRTL ? 'المبلغ' : 'Amount'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {claim.items.map((it, i) => (
                                      <tr key={i}>
                                        <td style={{ padding: '6px 12px', fontSize: 12, color: textPrimary, borderBottom: `1px solid ${borderColor}50` }}>{it.description}</td>
                                        <td style={{ padding: '6px 12px', fontSize: 12, color: textPrimary, fontWeight: 600, borderBottom: `1px solid ${borderColor}50` }}>{fmtAmount(it.amount, claim.currency)}</td>
                                      </tr>
                                    ))}
                                    <tr>
                                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: textPrimary }}>{isRTL ? 'الإجمالي' : 'Total'}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 800, color: '#4A7AAB' }}>{fmtAmount(claim.amount, claim.currency)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={ps => { setPageSize(ps); setPage(1); }} totalItems={filtered.length} safePage={safePage} />
      </div>

      {/* ── New/Edit Claim Modal ── */}
      {showModal && (
        <div dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: cardBg, borderRadius: 16, border: `1px solid ${borderColor}`, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${borderColor}` }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>
                {editingClaim ? (isRTL ? 'تعديل طلب مصروف' : 'Edit Expense Claim') : (isRTL ? 'طلب مصروف جديد' : 'New Expense Claim')}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSecondary, padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            {/* Modal body */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>{isRTL ? 'العنوان' : 'Title'} *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={isRTL ? 'عنوان المصروف...' : 'Expense title...'} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {/* Category + Date row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>{isRTL ? 'الفئة' : 'Category'}</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>{isRTL ? 'التاريخ' : 'Date'}</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Line items */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{isRTL ? 'البنود' : 'Line Items'}</label>
                  <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${borderColor}`, background: 'transparent', color: '#4A7AAB', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={12} /> {isRTL ? 'إضافة بند' : 'Add Item'}
                  </button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder={isRTL ? 'البيان...' : 'Description...'} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 12, outline: 'none' }} />
                    <input type="number" value={item.amount} onChange={e => updateItem(idx, 'amount', e.target.value)} placeholder={isRTL ? 'المبلغ' : 'Amount'} style={{ width: 100, padding: '7px 10px', borderRadius: 6, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 12, outline: 'none' }} />
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', marginTop: 8, padding: '8px 12px', borderRadius: 8, background: isDark ? '#132337' : '#f1f5f9' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: textSecondary }}>{isRTL ? 'الإجمالي:' : 'Total:'}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#4A7AAB' }}>{totalAmount.toLocaleString()} EGP</span>
                </div>
              </div>
              {/* Receipt ref */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>{isRTL ? 'مرجع الإيصال' : 'Receipt Reference'}</label>
                <input value={form.receipt_ref} onChange={e => setForm(f => ({ ...f, receipt_ref: e.target.value }))} placeholder={isRTL ? 'رقم الإيصال...' : 'Receipt number...'} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder={isRTL ? 'تفاصيل إضافية...' : 'Additional details...'} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg, color: textPrimary, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            </div>
            {/* Modal footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: `1px solid ${borderColor}` }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${borderColor}`, background: 'transparent', color: textSecondary, fontSize: 13, cursor: 'pointer' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSubmit} disabled={!form.title.trim()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: form.title.trim() ? '#4A7AAB' : `${textSecondary}40`, color: '#fff', fontSize: 13, fontWeight: 600, cursor: form.title.trim() ? 'pointer' : 'not-allowed', opacity: form.title.trim() ? 1 : 0.6 }}>
                {editingClaim ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'تقديم الطلب' : 'Submit Claim')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
