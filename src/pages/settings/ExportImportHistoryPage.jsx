import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  FileText, Download, Upload, Trash2, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Search, Filter, RefreshCw,
} from 'lucide-react';
import { getHistory, getStats, clearHistory } from '../../services/exportImportHistoryService';

const ENTITY_LABELS = {
  contacts:       { ar: 'جهات الاتصال',  en: 'Contacts' },
  opportunities:  { ar: 'الفرص البيعية',  en: 'Opportunities' },
  invoices:       { ar: 'الفواتير',       en: 'Invoices' },
  deals:          { ar: 'الصفقات',        en: 'Deals' },
  employees:      { ar: 'الموظفين',       en: 'Employees' },
  tasks:          { ar: 'المهام',         en: 'Tasks' },
  activities:     { ar: 'الأنشطة',        en: 'Activities' },
  expenses:       { ar: 'المصروفات',      en: 'Expenses' },
  campaigns:      { ar: 'الحملات',        en: 'Campaigns' },
};

const FORMAT_COLORS = {
  xlsx: '#22c55e',
  csv:  '#3b82f6',
  json: '#a855f7',
  pdf:  '#ef4444',
};

const PAGE_SIZE = 20;

export default function ExportImportHistoryPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, totalExports: 0, totalImports: 0, successRate: 0, mostActiveEntity: null });
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const offset = (page - 1) * PAGE_SIZE;
    const result = getHistory({ limit: PAGE_SIZE, offset, type: typeFilter, entity: entityFilter, search });
    setData(result.data);
    setTotal(result.total);
    setStats(getStats());
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, typeFilter, entityFilter, search]);
  useEffect(() => { setPage(1); }, [typeFilter, entityFilter, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleClear = () => {
    clearHistory();
    setShowConfirm(false);
    setPage(1);
    load();
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getEntityLabel = (entity) => {
    const e = ENTITY_LABELS[entity];
    if (!e) return entity || '-';
    return isRTL ? e.ar : e.en;
  };

  // ── Styles ────────────────────────────────────────────────────────────
  const cardBg = isDark ? '#1e1e2e' : '#fff';
  const cardBorder = isDark ? '#2e2e3e' : '#e5e7eb';
  const pageBg = isDark ? '#0f0f1a' : '#f3f4f6';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1a1a2e' : '#fff';
  const inputBorder = isDark ? '#2e2e3e' : '#d1d5db';
  const rowHover = isDark ? '#252538' : '#f8fafc';
  const headerBg = isDark ? '#161625' : '#f1f5f9';

  const statusConfig = {
    success: { color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', icon: CheckCircle, ar: 'نجاح', en: 'Success' },
    failed:  { color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', icon: XCircle, ar: 'فشل', en: 'Failed' },
    partial: { color: '#eab308', bg: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)', icon: AlertTriangle, ar: 'جزئي', en: 'Partial' },
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px', minHeight: '100vh', background: pageBg }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={20} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'سجل التصدير والاستيراد' : 'Export / Import History'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: textSecondary }}>
              {isRTL ? 'تتبع جميع عمليات التصدير والاستيراد' : 'Track all export and import operations'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${cardBorder}`,
            background: cardBg, color: textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <RefreshCw size={14} /> {isRTL ? 'تحديث' : 'Refresh'}
          </button>
          <button onClick={() => setShowConfirm(true)} style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
            background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
            color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <Trash2 size={14} /> {isRTL ? 'مسح السجل' : 'Clear History'}
          </button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: isRTL ? 'إجمالي التصديرات' : 'Total Exports', value: stats.totalExports, icon: Download, color: '#3b82f6' },
          { label: isRTL ? 'إجمالي الاستيرادات' : 'Total Imports', value: stats.totalImports, icon: Upload, color: '#8b5cf6' },
          { label: isRTL ? 'نسبة النجاح' : 'Success Rate', value: `${stats.successRate}%`, icon: CheckCircle, color: '#22c55e' },
          { label: isRTL ? 'الأكثر نشاطاً' : 'Most Active', value: stats.mostActiveEntity ? getEntityLabel(stats.mostActiveEntity) : '-', icon: FileText, color: '#f59e0b' },
        ].map((card, i) => (
          <div key={i} style={{
            background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: 20,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: isDark ? `${card.color}20` : `${card.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <card.icon size={20} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: textPrimary }}>{card.value}</div>
              <div style={{ fontSize: 12, color: textSecondary }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div style={{
        background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12,
        padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={14} color={textSecondary} style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 10 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث بالاسم أو الملف...' : 'Search by name or file...'}
            style={{
              width: '100%', padding: '8px 12px', [isRTL ? 'paddingRight' : 'paddingLeft']: 32,
              borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary,
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: `1px solid ${inputBorder}`,
            background: inputBg, color: textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">{isRTL ? 'الكل' : 'All Types'}</option>
          <option value="export">{isRTL ? 'تصدير' : 'Export'}</option>
          <option value="import">{isRTL ? 'استيراد' : 'Import'}</option>
        </select>
        <select
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: `1px solid ${inputBorder}`,
            background: inputBg, color: textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">{isRTL ? 'كل الكيانات' : 'All Entities'}</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
          ))}
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div style={{
        background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: textSecondary }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : data.length === 0 ? (
          /* ── Empty State ─────────────────────────── */
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={28} color={textSecondary} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: textPrimary, fontWeight: 600 }}>
              {isRTL ? 'لا يوجد سجلات' : 'No Records Found'}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: textSecondary }}>
              {isRTL ? 'لم يتم تسجيل أي عمليات تصدير أو استيراد بعد' : 'No export or import operations have been logged yet'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: headerBg }}>
                    {[
                      isRTL ? 'النوع' : 'Type',
                      isRTL ? 'الكيان' : 'Entity',
                      isRTL ? 'اسم الملف' : 'File Name',
                      isRTL ? 'الصيغة' : 'Format',
                      isRTL ? 'السجلات' : 'Records',
                      isRTL ? 'الحالة' : 'Status',
                      isRTL ? 'التاريخ' : 'Date',
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: '12px 16px', textAlign: isRTL ? 'right' : 'left',
                        color: textSecondary, fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
                        borderBottom: `1px solid ${cardBorder}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => {
                    const isExpanded = expandedId === row.id;
                    const sc = statusConfig[row.status] || statusConfig.success;
                    const StatusIcon = sc.icon;
                    const TypeIcon = row.type === 'export' ? Download : Upload;
                    const typeColor = row.type === 'export' ? '#3b82f6' : '#8b5cf6';
                    const fmtColor = FORMAT_COLORS[row.format] || textSecondary;

                    return (
                      <tr key={row.id} onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        style={{ cursor: 'pointer', borderBottom: `1px solid ${cardBorder}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Type */}
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 8,
                              background: isDark ? `${typeColor}20` : `${typeColor}10`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <TypeIcon size={14} color={typeColor} />
                            </div>
                            <span style={{ color: textPrimary, fontWeight: 500 }}>
                              {row.type === 'export' ? (isRTL ? 'تصدير' : 'Export') : (isRTL ? 'استيراد' : 'Import')}
                            </span>
                          </div>
                        </td>
                        {/* Entity */}
                        <td style={{ padding: '12px 16px', color: textPrimary }}>{getEntityLabel(row.entity)}</td>
                        {/* File Name */}
                        <td style={{ padding: '12px 16px', color: textPrimary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.fileName || '-'}
                        </td>
                        {/* Format Badge */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: isDark ? `${fmtColor}20` : `${fmtColor}12`,
                            color: fmtColor, textTransform: 'uppercase',
                          }}>{row.format}</span>
                        </td>
                        {/* Record Count */}
                        <td style={{ padding: '12px 16px', color: textPrimary, fontWeight: 500 }}>
                          {row.recordCount?.toLocaleString() || '0'}
                        </td>
                        {/* Status Badge */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            background: sc.bg, color: sc.color,
                          }}>
                            <StatusIcon size={13} />
                            {isRTL ? sc.ar : sc.en}
                          </span>
                        </td>
                        {/* Date */}
                        <td style={{ padding: '12px 16px', color: textSecondary, whiteSpace: 'nowrap', fontSize: 12 }}>
                          {formatDate(row.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Expanded Error Details ────────────────── */}
            {expandedId && (() => {
              const row = data.find(r => r.id === expandedId);
              if (!row) return null;
              return (
                <div style={{
                  padding: '16px 20px', background: headerBg, borderTop: `1px solid ${cardBorder}`,
                }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                    <div>
                      <span style={{ color: textSecondary }}>{isRTL ? 'المستخدم: ' : 'User: '}</span>
                      <span style={{ color: textPrimary, fontWeight: 500 }}>{row.user_name}</span>
                    </div>
                    {row.type === 'import' && (
                      <>
                        <div>
                          <span style={{ color: textSecondary }}>{isRTL ? 'ناجح: ' : 'Success: '}</span>
                          <span style={{ color: '#22c55e', fontWeight: 500 }}>{row.successCount || 0}</span>
                        </div>
                        <div>
                          <span style={{ color: textSecondary }}>{isRTL ? 'فاشل: ' : 'Failed: '}</span>
                          <span style={{ color: '#ef4444', fontWeight: 500 }}>{row.failedCount || 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {row.errors && row.errors.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>
                        {isRTL ? 'الأخطاء:' : 'Errors:'}
                      </div>
                      <div style={{
                        background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12,
                        maxHeight: 160, overflowY: 'auto',
                      }}>
                        {row.errors.map((err, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#ef4444', padding: '2px 0' }}>
                            {typeof err === 'string' ? err : JSON.stringify(err)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Pagination ───────────────────────────── */}
            <div style={{
              padding: '12px 18px', borderTop: `1px solid ${cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: textSecondary }}>
                {isRTL
                  ? `عرض ${Math.min((page - 1) * PAGE_SIZE + 1, total)} - ${Math.min(page * PAGE_SIZE, total)} من ${total}`
                  : `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, total)} - ${Math.min(page * PAGE_SIZE, total)} of ${total}`}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: `1px solid ${inputBorder}`,
                    background: inputBg, color: page <= 1 ? textSecondary : textPrimary,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13, opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  {isRTL ? 'السابق' : 'Prev'}
                </button>
                <span style={{
                  padding: '6px 14px', fontSize: 13, color: textPrimary,
                  display: 'flex', alignItems: 'center',
                }}>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: `1px solid ${inputBorder}`,
                    background: inputBg, color: page >= totalPages ? textSecondary : textPrimary,
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13, opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  {isRTL ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Confirm Clear Dialog ───────────────────────── */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: cardBg, borderRadius: 14, padding: 28, maxWidth: 400, width: '90%',
            border: `1px solid ${cardBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={18} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, color: textPrimary }}>
                {isRTL ? 'مسح السجل' : 'Clear History'}
              </h3>
            </div>
            <p style={{ fontSize: 14, color: textSecondary, margin: '0 0 20px', lineHeight: 1.6 }}>
              {isRTL
                ? 'هل أنت متأكد من مسح جميع سجلات التصدير والاستيراد؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to clear all export/import history? This action cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirm(false)} style={{
                padding: '8px 20px', borderRadius: 8, border: `1px solid ${inputBorder}`,
                background: 'transparent', color: textPrimary, cursor: 'pointer', fontSize: 13,
              }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleClear} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                {isRTL ? 'مسح' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
