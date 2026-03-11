import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import supabase from '../../lib/supabase';
import { History, Search, Filter, ChevronDown, ChevronUp, User, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';

const ACTION_CONFIG = {
  create: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: Plus, ar: 'إنشاء', en: 'Create' },
  update: { color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', icon: Pencil, ar: 'تعديل', en: 'Update' },
  delete: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: Trash2, ar: 'حذف', en: 'Delete' },
};

const ENTITY_LABELS = {
  contact: { ar: 'جهة اتصال', en: 'Contact' },
  opportunity: { ar: 'فرصة', en: 'Opportunity' },
  task: { ar: 'مهمة', en: 'Task' },
  activity: { ar: 'نشاط', en: 'Activity' },
  employee: { ar: 'موظف', en: 'Employee' },
  invoice: { ar: 'فاتورة', en: 'Invoice' },
};

export default function AuditLogPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const c = {
    bg: isDark ? '#0F1E2D' : '#F0F4F8',
    card: isDark ? '#1a2234' : '#ffffff',
    border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text: isDark ? '#E2EAF4' : '#1f2937',
    muted: isDark ? '#8BA8C8' : '#6b7280',
    input: isDark ? '#152232' : '#f9fafb',
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction) query = query.eq('action', filterAction);
      if (filterEntity) query = query.eq('entity', filterEntity);
      if (search) query = query.or(`description.ilike.%${search}%,entity.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [page, filterAction, filterEntity]);

  const handleSearch = () => { setPage(0); fetchLogs(); };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const th = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: c.muted, textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${c.border}`, background: isDark ? 'rgba(74,122,171,0.06)' : '#f8fafc' };
  const td = { padding: '10px 14px', fontSize: 13, color: c.text, borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}` };
  const selectStyle = { padding: '7px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.input, color: c.text, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' };

  return (
    <div style={{ padding: '24px 28px', background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <History size={20} color="#4A7AAB" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: c.text }}>{isRTL ? 'سجل التعديلات' : 'Audit Log'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{isRTL ? 'جميع التغييرات في النظام' : 'All system changes'}</p>
          </div>
        </div>
        <button onClick={() => { setPage(0); fetchLogs(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.card, color: c.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          <RefreshCw size={14} />{isRTL ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={16} color={c.muted} style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 12 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={isRTL ? 'بحث في السجل...' : 'Search logs...'}
            style={{ ...selectStyle, width: '100%', [isRTL ? 'paddingRight' : 'paddingLeft']: 36 }}
          />
        </div>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="">{isRTL ? 'كل الإجراءات' : 'All Actions'}</option>
          <option value="create">{isRTL ? 'إنشاء' : 'Create'}</option>
          <option value="update">{isRTL ? 'تعديل' : 'Update'}</option>
          <option value="delete">{isRTL ? 'حذف' : 'Delete'}</option>
        </select>
        <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="">{isRTL ? 'كل الكيانات' : 'All Entities'}</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>{isRTL ? 'الإجراء' : 'Action'}</th>
                <th style={th}>{isRTL ? 'الكيان' : 'Entity'}</th>
                <th style={th}>{isRTL ? 'الوصف' : 'Description'}</th>
                <th style={th}>{isRTL ? 'التاريخ' : 'Date'}</th>
                <th style={{ ...th, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} style={td}>
                        <div style={{ height: 14, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', animation: 'shimmer 1.5s infinite linear', backgroundSize: '800px 100%', backgroundImage: isDark ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)' : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: '40px 20px', color: c.muted }}>{isRTL ? 'لا توجد سجلات' : 'No logs found'}</td></tr>
              ) : (
                logs.map(log => {
                  const ac = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
                  const AIcon = ac.icon;
                  const entityLabel = ENTITY_LABELS[log.entity] || { ar: log.entity, en: log.entity };
                  const isExpanded = expandedId === log.id;
                  return (
                    <>
                      <tr key={log.id} style={{ cursor: log.changes ? 'pointer' : 'default' }} onClick={() => log.changes && setExpandedId(isExpanded ? null : log.id)}>
                        <td style={td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: ac.bg, color: ac.color, fontSize: 11, fontWeight: 600 }}>
                            <AIcon size={12} />{isRTL ? ac.ar : ac.en}
                          </span>
                        </td>
                        <td style={td}>{isRTL ? entityLabel.ar : entityLabel.en}</td>
                        <td style={{ ...td, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.description || '—'}</td>
                        <td style={{ ...td, fontSize: 12, color: c.muted, whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                        <td style={td}>{log.changes && (isExpanded ? <ChevronUp size={14} color={c.muted} /> : <ChevronDown size={14} color={c.muted} />)}</td>
                      </tr>
                      {isExpanded && log.changes && (
                        <tr key={log.id + '-details'}>
                          <td colSpan={5} style={{ padding: '0 14px 14px', background: isDark ? 'rgba(74,122,171,0.04)' : '#fafbfc' }}>
                            <div style={{ borderRadius: 10, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ ...th, fontSize: 10 }}>{isRTL ? 'الحقل' : 'Field'}</th>
                                    <th style={{ ...th, fontSize: 10 }}>{isRTL ? 'القيمة القديمة' : 'Old Value'}</th>
                                    <th style={{ ...th, fontSize: 10 }}>{isRTL ? 'القيمة الجديدة' : 'New Value'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(log.changes).map(([field, val]) => (
                                    <tr key={field}>
                                      <td style={{ ...td, fontSize: 12, fontWeight: 600 }}>{field}</td>
                                      <td style={{ ...td, fontSize: 12, color: '#EF4444' }}>{val.from != null ? String(val.from) : '—'}</td>
                                      <td style={{ ...td, fontSize: 12, color: '#10B981' }}>{val.to != null ? String(val.to) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: c.muted }}>{isRTL ? `صفحة ${page + 1}` : `Page ${page + 1}`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.card, color: c.muted, fontSize: 12, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontFamily: 'inherit' }}>
                {isRTL ? 'السابق' : 'Previous'}
              </button>
              <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.card, color: c.muted, fontSize: 12, cursor: logs.length < PAGE_SIZE ? 'default' : 'pointer', opacity: logs.length < PAGE_SIZE ? 0.4 : 1, fontFamily: 'inherit' }}>
                {isRTL ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
