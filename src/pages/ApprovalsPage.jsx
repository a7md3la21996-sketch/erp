import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Shield,
  Search, X, ChevronRight, FileText,
  CheckSquare, Square,
} from 'lucide-react';
import {
  getApprovals, approveRequest, rejectRequest, getApprovalStats,
  escalateStaleApprovals, APPROVAL_TYPES, TYPE_LABELS,
} from '../services/approvalService';
import { Button, KpiCard, PageSkeleton, Pagination } from '../components/ui';

const STATUS_CONFIG = {
  pending:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  label: { ar: 'معلق',     en: 'Pending' },   icon: Clock },
  approved:  { color: '#10B981', bg: 'rgba(16,185,129,0.1)',  label: { ar: 'موافق',     en: 'Approved' },  icon: CheckCircle },
  rejected:  { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   label: { ar: 'مرفوض',     en: 'Rejected' },  icon: XCircle },
  escalated: { color: '#F97316', bg: 'rgba(249,115,22,0.1)',  label: { ar: 'متصاعد',    en: 'Escalated' }, icon: AlertTriangle },
};

const PRIORITY_CONFIG = {
  normal: { color: '#64748B', label: { ar: 'عادي', en: 'Normal' } },
  urgent: { color: '#EF4444', label: { ar: 'عاجل', en: 'Urgent' } },
};

function fmtAmount(v) {
  if (!v) return '--';
  return Number(v).toLocaleString() + ' EGP';
}

function timeAgo(dateStr, lang) {
  if (!dateStr) return '--';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return lang === 'ar' ? 'الآن' : 'Just now';
  if (diff < 3600)  return lang === 'ar' ? `منذ ${Math.floor(diff/60)} د` : `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return lang === 'ar' ? `منذ ${Math.floor(diff/3600)} س` : `${Math.floor(diff/3600)}h ago`;
  return lang === 'ar' ? `منذ ${Math.floor(diff/86400)} يوم` : `${Math.floor(diff/86400)}d ago`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ApprovalsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';
  const userName = profile?.full_name_ar || profile?.full_name_en || '';

  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const refresh = useCallback(async () => {
    await escalateStaleApprovals();
    const filters = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (typeFilter !== 'all') filters.type = typeFilter;
    const approvalResult = await getApprovals(filters);
    setApprovals(Array.isArray(approvalResult) ? approvalResult : []);
    const statsResult = await getApprovalStats();
    setStats(statsResult && typeof statsResult === 'object' ? statsResult : {});
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    refresh().then(() => setLoading(false));
    const handler = () => refresh();
    window.addEventListener('platform_approval_change', handler);
    return () => window.removeEventListener('platform_approval_change', handler);
  }, [refresh]);

  const filtered = useMemo(() => {
    let list = approvals;
    if (priorityFilter !== 'all') list = list.filter(a => a.priority === priorityFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.entity_name || '').toLowerCase().includes(q) ||
        (a.requester_name || '').toLowerCase().includes(q) ||
        (a.approver_name || '').toLowerCase().includes(q) ||
        (a.type || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [approvals, priorityFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleApprove = async (id, comment) => {
    await approveRequest(id, userName, comment || actionComment);
    setActionComment('');
    if (selectedApproval?.id === id) {
      setSelectedApproval(prev => ({ ...prev, status: 'approved', resolved_at: new Date().toISOString(), comments: comment || actionComment }));
    }
    refresh();
  };

  const handleReject = async (id, comment) => {
    await rejectRequest(id, userName, comment || actionComment);
    setActionComment('');
    if (selectedApproval?.id === id) {
      setSelectedApproval(prev => ({ ...prev, status: 'rejected', resolved_at: new Date().toISOString(), comments: comment || actionComment }));
    }
    refresh();
  };

  const handleBulkApprove = async () => {
    await Promise.all([...bulkSelected].map(id => approveRequest(id, userName, '')));
    setBulkSelected(new Set());
    setBulkMode(false);
    refresh();
  };

  const handleBulkReject = async () => {
    await Promise.all([...bulkSelected].map(id => rejectRequest(id, userName, '')));
    setBulkSelected(new Set());
    setBulkMode(false);
    refresh();
  };

  const toggleBulk = (id) => {
    setBulkSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  if (loading) return <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={5} />;

  const cardBg = isDark ? '#1e293b' : '#fff';
  const cardBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)';
  const hoverBg = isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.02)';
  const brandColor = '#4A7AAB';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>{isRTL ? 'الموافقات' : 'Approvals'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: textSecondary }}>{isRTL ? 'إدارة طلبات الموافقة والسلاسل' : 'Manage approval requests & chains'}</p>
          </div>
        </div>
        {bulkMode && bulkSelected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: textSecondary }}>{bulkSelected.size} {isRTL ? 'محدد' : 'selected'}</span>
            <button onClick={handleBulkApprove} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} /> {isRTL ? 'موافقة الكل' : 'Approve All'}
            </button>
            <button onClick={handleBulkReject} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <XCircle size={14} /> {isRTL ? 'رفض الكل' : 'Reject All'}
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard icon={Clock} label={isRTL ? 'معلق' : 'Pending'} value={stats.pending || 0} color="#F59E0B" onClick={() => setStatusFilter('pending')} />
        <KpiCard icon={CheckCircle} label={isRTL ? 'موافق اليوم' : 'Approved Today'} value={stats.approvedToday || 0} color="#10B981" onClick={() => setStatusFilter('approved')} />
        <KpiCard icon={XCircle} label={isRTL ? 'مرفوض اليوم' : 'Rejected Today'} value={stats.rejectedToday || 0} color="#EF4444" onClick={() => setStatusFilter('rejected')} />
        <KpiCard icon={AlertTriangle} label={isRTL ? 'متوسط الاستجابة' : 'Avg Response'} value={stats.avgResponseHours ? `${stats.avgResponseHours}h` : '--'} color={brandColor} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 10, color: textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            style={{
              width: '100%', padding: '8px 12px', [isRTL ? 'paddingRight' : 'paddingLeft']: 34,
              borderRadius: 10, border: `1px solid ${inputBorder}`, background: inputBg,
              color: textPrimary, fontSize: 13, outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', top: 8, [isRTL ? 'left' : 'right']: 8, background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none', minWidth: 120 }}
        >
          <option value="all">{isRTL ? 'كل الحالات' : 'All Statuses'}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label[lang]}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none', minWidth: 120 }}
        >
          <option value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
          {APPROVAL_TYPES.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]?.[lang] || t}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none', minWidth: 120 }}
        >
          <option value="all">{isRTL ? 'كل الأولويات' : 'All Priorities'}</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label[lang]}</option>
          ))}
        </select>

        {/* Bulk toggle */}
        <button
          onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
          style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${bulkMode ? brandColor : inputBorder}`,
            background: bulkMode ? (isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)') : 'transparent',
            color: bulkMode ? brandColor : textSecondary,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <CheckSquare size={14} /> {isRTL ? 'تحديد متعدد' : 'Bulk Select'}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: cardBg, borderRadius: 14, border: `1px solid ${cardBorder}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                {bulkMode && <th style={{ padding: '12px 8px 12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}></th>}
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'الطلب' : 'Request'}</th>
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'النوع' : 'Type'}</th>
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'المبلغ' : 'Amount'}</th>
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'مقدم الطلب' : 'Requester'}</th>
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'الحالة' : 'Status'}</th>
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'الأولوية' : 'Priority'}</th>
                <th style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'التاريخ' : 'Date'}</th>
                <th style={{ padding: '12px 16px', width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={bulkMode ? 9 : 8} style={{ padding: 48, textAlign: 'center', color: textMuted, fontSize: 14 }}>
                    <Shield size={40} style={{ marginBottom: 8, opacity: 0.3 }} />
                    <div>{isRTL ? 'لا توجد طلبات موافقة' : 'No approval requests found'}</div>
                  </td>
                </tr>
              )}
              {pageData.map(a => {
                const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
                const StatusIcon = sc.icon;
                const pc = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal;
                const tl = TYPE_LABELS[a.type] || { ar: a.type, en: a.type };
                return (
                  <tr
                    key={a.id}
                    onClick={() => !bulkMode && setSelectedApproval(a)}
                    style={{ borderBottom: `1px solid ${cardBorder}`, cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {bulkMode && (
                      <td style={{ padding: '12px 8px 12px 16px' }}>
                        <button onClick={e => { e.stopPropagation(); toggleBulk(a.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: bulkSelected.has(a.id) ? brandColor : textMuted, padding: 0 }}>
                          {bulkSelected.has(a.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                    )}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: textPrimary, fontSize: 13 }}>{a.entity_name || '--'}</div>
                      <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>#{a.id.slice(-6)}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)', color: brandColor }}>
                        {tl[lang]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: textPrimary, fontWeight: 600 }}>{fmtAmount(a.amount)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(a.requester_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: textPrimary, fontSize: 13 }}>{a.requester_name || '--'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        <StatusIcon size={12} /> {sc.label[lang]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: pc.color }}>
                        {pc.label[lang]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: textMuted, fontSize: 12 }}>{timeAgo(a.created_at, lang)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <ChevronRight size={14} style={{ color: textMuted, transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > pageSize && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${cardBorder}` }}>
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} totalItems={filtered.length} />
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedApproval && (
        <ApprovalDrawer
          approval={selectedApproval}
          onClose={() => { setSelectedApproval(null); setActionComment(''); }}
          onApprove={handleApprove}
          onReject={handleReject}
          actionComment={actionComment}
          setActionComment={setActionComment}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
          userName={userName}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Detail Drawer
// ═══════════════════════════════════════════════
function ApprovalDrawer({ approval, onClose, onApprove, onReject, actionComment, setActionComment, isDark, isRTL, lang, userName }) {
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const cardBg = isDark ? '#1e293b' : '#fff';
  const panelBg = isDark ? '#0f172a' : '#f8fafc';
  const cardBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)';
  const brandColor = '#4A7AAB';

  const a = approval;
  const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;
  const tl = TYPE_LABELS[a.type] || { ar: a.type, en: a.type };
  const isPending = a.status === 'pending' || a.status === 'escalated';

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, transition: 'opacity 0.2s' }}
      />
      {/* Drawer */}
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed', top: 0, [isRTL ? 'left' : 'right']: 0,
          width: '100%', maxWidth: 520, height: '100vh',
          background: panelBg, zIndex: 201,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          overflowY: 'auto',
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StatusIcon size={18} style={{ color: sc.color }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>{a.entity_name || (isRTL ? 'طلب موافقة' : 'Approval Request')}</h2>
              <span style={{ fontSize: 11, color: textMuted }}>#{a.id.slice(-8)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {/* Info grid */}
          <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isRTL ? 'تفاصيل الطلب' : 'Request Details'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <InfoItem label={isRTL ? 'النوع' : 'Type'} value={tl[lang]} color={brandColor} isDark={isDark} />
              <InfoItem label={isRTL ? 'المبلغ' : 'Amount'} value={fmtAmount(a.amount)} isDark={isDark} />
              <InfoItem label={isRTL ? 'مقدم الطلب' : 'Requester'} value={a.requester_name || '--'} isDark={isDark} />
              <InfoItem label={isRTL ? 'المعتمد' : 'Approver'} value={a.approver_name || '--'} isDark={isDark} />
              <InfoItem label={isRTL ? 'تاريخ الطلب' : 'Requested'} value={fmtDate(a.created_at)} isDark={isDark} />
              <InfoItem label={isRTL ? 'الحالة' : 'Status'} value={sc.label[lang]} color={sc.color} isDark={isDark} />
              <InfoItem label={isRTL ? 'الأولوية' : 'Priority'} value={(PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal).label[lang]} color={(PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal).color} isDark={isDark} />
              {a.resolved_at && <InfoItem label={isRTL ? 'تاريخ الحل' : 'Resolved'} value={fmtDate(a.resolved_at)} isDark={isDark} />}
            </div>
            {a.notes && (
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 4 }}>{isRTL ? 'ملاحظات' : 'Notes'}</div>
                <div style={{ fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>{a.notes}</div>
              </div>
            )}
            {a.comments && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 4 }}>{isRTL ? 'تعليق المعتمد' : 'Approver Comment'}</div>
                <div style={{ fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>{a.comments}</div>
              </div>
            )}
          </div>

          {/* Approval Chain */}
          {a.chain?.length > 0 && (
            <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isRTL ? 'سلسلة الموافقة' : 'Approval Chain'}
              </h3>
              <div style={{ position: 'relative' }}>
                {a.chain.map((step, i) => {
                  if (!step) return null;
                  const stepSc = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
                  const StepIcon = stepSc.icon;
                  const isLast = i === a.chain.length - 1;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: isLast ? 0 : 24 }}>
                      {/* Vertical line */}
                      {!isLast && (
                        <div style={{
                          position: 'absolute',
                          [isRTL ? 'right' : 'left']: 13,
                          top: 28,
                          bottom: 0,
                          width: 2,
                          background: stepSc.color,
                          opacity: 0.3,
                        }} />
                      )}
                      {/* Icon */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: stepSc.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, border: `2px solid ${stepSc.color}`,
                      }}>
                        <StepIcon size={14} style={{ color: stepSc.color }} />
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, paddingTop: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                          {isRTL ? 'المستوى' : 'Level'} {step.level ?? i + 1}
                          <span style={{ fontSize: 11, fontWeight: 400, color: textMuted, marginInlineStart: 8 }}>{step.approver || '--'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: stepSc.color, fontWeight: 600, marginTop: 2 }}>
                          {stepSc.label[lang]}
                          {step.date && <span style={{ color: textMuted, fontWeight: 400, marginInlineStart: 8 }}>{fmtDate(step.date)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isRTL ? 'الجدول الزمني' : 'Timeline'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TimelineItem
                icon={<FileText size={12} />}
                color="#4A7AAB"
                title={isRTL ? 'تم إنشاء الطلب' : 'Request created'}
                detail={`${isRTL ? 'بواسطة' : 'by'} ${a.requester_name}`}
                date={fmtDate(a.created_at)}
                isDark={isDark}
              />
              {a.status === 'approved' && (
                <TimelineItem
                  icon={<CheckCircle size={12} />}
                  color="#10B981"
                  title={isRTL ? 'تمت الموافقة' : 'Approved'}
                  detail={`${isRTL ? 'بواسطة' : 'by'} ${a.approver_name}`}
                  date={fmtDate(a.resolved_at)}
                  isDark={isDark}
                />
              )}
              {a.status === 'rejected' && (
                <TimelineItem
                  icon={<XCircle size={12} />}
                  color="#EF4444"
                  title={isRTL ? 'تم الرفض' : 'Rejected'}
                  detail={`${isRTL ? 'بواسطة' : 'by'} ${a.approver_name}${a.comments ? ` - ${a.comments}` : ''}`}
                  date={fmtDate(a.resolved_at)}
                  isDark={isDark}
                />
              )}
              {a.status === 'escalated' && (
                <TimelineItem
                  icon={<AlertTriangle size={12} />}
                  color="#F97316"
                  title={isRTL ? 'تم التصعيد' : 'Escalated'}
                  detail={isRTL ? 'تجاوز وقت الانتظار المسموح' : 'Exceeded allowed wait time'}
                  date="--"
                  isDark={isDark}
                />
              )}
            </div>
          </div>

          {/* Action area */}
          {isPending && (
            <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isRTL ? 'اتخاذ إجراء' : 'Take Action'}
              </h3>
              <textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder={isRTL ? 'أضف تعليق أو سبب الرفض...' : 'Add comment or rejection reason...'}
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: textPrimary, fontSize: 13, outline: 'none', resize: 'vertical',
                  fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => onApprove(a.id, actionComment)}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: '#10B981', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <CheckCircle size={16} /> {isRTL ? 'موافقة' : 'Approve'}
                </button>
                <button
                  onClick={() => onReject(a.id, actionComment)}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <XCircle size={16} /> {isRTL ? 'رفض' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════
function InfoItem({ label, value, color, isDark }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || (isDark ? '#e2e8f0' : '#1e293b') }}>{value}</div>
    </div>
  );
}

function TimelineItem({ icon, color, title, detail, date, isDark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0, marginTop: 1 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>{title}</div>
        <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 1 }}>{detail}</div>
      </div>
      <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }}>{date}</div>
    </div>
  );
}
