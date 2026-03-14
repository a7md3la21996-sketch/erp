import { useState, useEffect, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import supabase from '../../lib/supabase';
import {
  History, ChevronDown, ChevronUp, Plus, Pencil, Trash2, RefreshCw,
  Ban, UserCheck, Users2, Merge, Upload, Thermometer, ArrowRightLeft,
  Activity, Calendar, User, BarChart3, Download,
} from 'lucide-react';
import { Button, Badge, Table, Th, Td, Tr, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';
import { ACTION_TYPES, getLocalAuditLogs } from '../../services/auditService';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

const ACTION_CONFIG = {
  create:             { variant: 'success', icon: Plus,           ar: 'إنشاء',               en: 'Create' },
  update:             { variant: 'default', icon: Pencil,         ar: 'تعديل',               en: 'Update' },
  delete:             { variant: 'danger',  icon: Trash2,         ar: 'حذف',                 en: 'Delete' },
  status_change:      { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير حالة',           en: 'Status Change' },
  type_change:        { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير نوع',           en: 'Type Change' },
  blacklist:          { variant: 'danger',  icon: Ban,            ar: 'بلاك ليست',           en: 'Blacklisted' },
  unblacklist:        { variant: 'success', icon: Ban,            ar: 'إلغاء بلاك ليست',     en: 'Unblacklisted' },
  reassign:           { variant: 'default', icon: UserCheck,      ar: 'إعادة تعيين',         en: 'Reassigned' },
  bulk_reassign:      { variant: 'default', icon: Users2,         ar: 'إعادة تعيين جماعي',   en: 'Bulk Reassign' },
  bulk_delete:        { variant: 'danger',  icon: Trash2,         ar: 'حذف جماعي',           en: 'Bulk Delete' },
  merge:              { variant: 'default', icon: Merge,          ar: 'دمج',                 en: 'Merge' },
  import:             { variant: 'success', icon: Upload,         ar: 'استيراد',              en: 'Import' },
  stage_change:       { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير مرحلة',         en: 'Stage Change' },
  temperature_change: { variant: 'default', icon: Thermometer,    ar: 'تغيير حرارة',         en: 'Temperature Change' },
  score_change:       { variant: 'default', icon: BarChart3,      ar: 'تغيير تقييم',         en: 'Score Change' },
  assign:             { variant: 'default', icon: UserCheck,      ar: 'تعيين',               en: 'Assigned' },
  batch_call:         { variant: 'default', icon: Plus,           ar: 'اتصال جماعي',         en: 'Batch Call' },
  note:               { variant: 'default', icon: Pencil,         ar: 'ملاحظة',              en: 'Note' },
};

const ENTITY_LABELS = {
  contact:       { ar: 'جهة اتصال',  en: 'Contact' },
  opportunity:   { ar: 'فرصة',       en: 'Opportunity' },
  task:          { ar: 'مهمة',       en: 'Task' },
  activity:      { ar: 'نشاط',       en: 'Activity' },
  employee:      { ar: 'موظف',       en: 'Employee' },
  invoice:       { ar: 'فاتورة',     en: 'Invoice' },
  deal:          { ar: 'صفقة',       en: 'Deal' },
  campaign:      { ar: 'حملة',       en: 'Campaign' },
  leave_request: { ar: 'طلب إجازة',  en: 'Leave Request' },
  expense:       { ar: 'مصروف',      en: 'Expense' },
  journal_entry: { ar: 'قيد يومي',   en: 'Journal Entry' },
  ticket:        { ar: 'تذكرة',      en: 'Ticket' },
  backup:        { ar: 'نسخة احتياطية', en: 'Backup' },
};

const BASE_SMART_FIELDS = [
  {
    id: 'action', label: 'الإجراء', labelEn: 'Action', type: 'select',
    options: Object.entries(ACTION_CONFIG).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
  },
  {
    id: 'entity', label: 'الكيان', labelEn: 'Entity', type: 'select',
    options: Object.entries(ENTITY_LABELS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
  },
  { id: 'entity_name', label: 'الاسم', labelEn: 'Name', type: 'text' },
  { id: 'description', label: 'الوصف', labelEn: 'Description', type: 'text' },
  { id: 'created_at', label: 'التاريخ', labelEn: 'Date', type: 'date' },
];

export default function AuditLogPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [userOptions, setUserOptions] = useState([]);

  // Build SMART_FIELDS with dynamic user options
  const smartFields = useMemo(() => [
    ...BASE_SMART_FIELDS,
    {
      id: 'user_id', label: 'بواسطة', labelEn: 'Done By', type: 'select',
      options: userOptions,
    },
  ], [userOptions]);

  // Fetch distinct users from audit_logs + localStorage on mount
  useEffect(() => {
    (async () => {
      const map = new Map();
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('user_id, users:user_id (full_name_ar, full_name_en)')
          .order('created_at', { ascending: false });
        if (data) {
          data.forEach(row => {
            if (row.user_id && !map.has(row.user_id)) {
              const u = row.users || {};
              map.set(row.user_id, { value: row.user_id, label: u.full_name_ar || row.user_id, labelEn: u.full_name_en || row.user_id });
            }
          });
        }
      } catch { /* ignore */ }
      const { data: localLogs } = getLocalAuditLogs({ limit: 500 });
      localLogs.forEach(l => {
        if (l.user_name && !map.has(l.user_name)) {
          map.set(l.user_name, { value: l.user_name, label: l.user_name, labelEn: l.user_name });
        }
      });
      setUserOptions([...map.values()]);
    })();
  }, []);

  const filterAction = useMemo(() => {
    const f = smartFilters.find(f => f.field === 'action' && f.operator === 'is');
    return f?.value || '';
  }, [smartFilters]);

  const filterEntity = useMemo(() => {
    const f = smartFilters.find(f => f.field === 'entity' && f.operator === 'is');
    return f?.value || '';
  }, [smartFilters]);

  const filterUserId = useMemo(() => {
    const f = smartFilters.find(f => f.field === 'user_id' && f.operator === 'is');
    return f?.value || '';
  }, [smartFilters]);

  const fetchLogs = async () => {
    setLoading(true);
    let allLogs = [];

    try {
      let query = supabase
        .from('audit_logs')
        .select('*, users:user_id (full_name_ar, full_name_en)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterAction) query = query.eq('action', filterAction);
      if (filterEntity) query = query.eq('entity', filterEntity);
      if (filterUserId) query = query.eq('user_id', filterUserId);
      if (search) query = query.or(`description.ilike.%${search}%,entity.ilike.%${search}%`);

      const { data, error } = await query;
      if (!error && data) {
        allLogs = data.map(row => ({
          ...row,
          _user_name_ar: row.users?.full_name_ar || '',
          _user_name_en: row.users?.full_name_en || '',
        }));
      }
    } catch { /* ignore */ }

    const { data: localLogs } = getLocalAuditLogs({ limit: 500, action: filterAction, entity: filterEntity, search });
    const supaIds = new Set(allLogs.map(l => l.id));
    const uniqueLocal = localLogs.filter(l => !supaIds.has(l.id)).map(l => ({
      ...l,
      _user_name_ar: l.user_name || '',
      _user_name_en: l.user_name || '',
    }));

    allLogs = [...allLogs, ...uniqueLocal].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setLogs(allLogs);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filterAction, filterEntity, filterUserId]);

  const handleSearchChange = (val) => setSearch(val);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = logs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.description || '').toLowerCase().includes(q) ||
        (l.entity_name || '').toLowerCase().includes(q) ||
        (l._user_name_ar || '').includes(q) ||
        (l._user_name_en || '').toLowerCase().includes(q)
      );
    }
    result = applySmartFilters(result, smartFilters.filter(f => !['action', 'entity', 'user_id'].includes(f.field)), smartFields);
    return result;
  }, [logs, search, smartFilters, smartFields]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── KPI computations ──
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const todayCount = logs.filter(l => (l.created_at || '').slice(0, 10) === todayStr).length;

    const users = new Set();
    const entityCount = {};
    logs.forEach(l => {
      if (l.user_name || l._user_name_en) users.add(l.user_name || l._user_name_en);
      if (l.entity) entityCount[l.entity] = (entityCount[l.entity] || 0) + 1;
    });

    let mostActiveEntity = '—';
    let maxCount = 0;
    Object.entries(entityCount).forEach(([e, c]) => {
      if (c > maxCount) { maxCount = c; mostActiveEntity = e; }
    });
    const mostActiveLabel = ENTITY_LABELS[mostActiveEntity]
      ? (isRTL ? ENTITY_LABELS[mostActiveEntity].ar : ENTITY_LABELS[mostActiveEntity].en)
      : mostActiveEntity;

    return { total: logs.length, today: todayCount, users: users.size, mostActive: mostActiveLabel, mostActiveCount: maxCount };
  }, [logs, isRTL]);

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Export handler
  const handleExport = async (type) => {
    const rows = filtered.map(l => ({
      [isRTL ? 'التاريخ' : 'Date']: l.created_at ? new Date(l.created_at).toLocaleString() : '',
      [isRTL ? 'بواسطة' : 'User']: isRTL ? (l._user_name_ar || l.user_name || '') : (l._user_name_en || l.user_name || ''),
      [isRTL ? 'الإجراء' : 'Action']: isRTL ? (ACTION_CONFIG[l.action]?.ar || l.action) : (ACTION_CONFIG[l.action]?.en || l.action),
      [isRTL ? 'الكيان' : 'Entity']: isRTL ? (ENTITY_LABELS[l.entity]?.ar || l.entity) : (ENTITY_LABELS[l.entity]?.en || l.entity),
      [isRTL ? 'الاسم' : 'Name']: l.entity_name || '',
      [isRTL ? 'الوصف' : 'Description']: l.description || '',
    }));
    if (type === 'excel') {
      await exportToExcel(rows, isRTL ? 'سجل_التدقيق' : 'audit_log', isRTL ? 'السجل' : 'Log');
    } else {
      exportToCSV(rows, isRTL ? 'سجل_التدقيق' : 'audit_log');
    }
  };

  // ── Styles ──
  const kpiCard = (accent) => ({
    background: isDark ? '#1a2332' : '#ffffff',
    border: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`,
    borderTop: `3px solid ${accent}`,
    borderRadius: 12,
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  });

  const iconWrap = (bg) => ({
    width: 40,
    height: 40,
    borderRadius: 10,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  const kpiLabel = { margin: 0, fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' };
  const kpiValue = { margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' };
  const kpiSub = { margin: 0, fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <History size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'سجل التدقيق' : 'Audit Log'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'جميع التغييرات في النظام' : 'All system changes'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <ExportButton
              data={filtered}
              filename={isRTL ? 'سجل_التدقيق' : 'audit_log'}
              title={isRTL ? 'سجل التدقيق' : 'Audit Log'}
              columns={[
                { header: isRTL ? 'الإجراء' : 'Action', key: r => isRTL ? ACTION_CONFIG[r.action]?.ar : ACTION_CONFIG[r.action]?.en },
                { header: isRTL ? 'الكيان' : 'Entity', key: r => isRTL ? (ENTITY_LABELS[r.entity]?.ar || r.entity) : (ENTITY_LABELS[r.entity]?.en || r.entity) },
                { header: isRTL ? 'الاسم' : 'Name', key: 'entity_name' },
                { header: isRTL ? 'الوصف' : 'Description', key: 'description' },
                { header: isRTL ? 'بواسطة' : 'Done By', key: r => isRTL ? (r._user_name_ar || '') : (r._user_name_en || '') },
                { header: isRTL ? 'التاريخ' : 'Date', key: 'created_at' },
              ]}
            />
          </div>
          <Button variant="secondary" onClick={() => { setPage(1); fetchLogs(); }}>
            <RefreshCw size={14} />{isRTL ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={kpiCard('#4A7AAB')}>
          <div style={iconWrap('rgba(74,122,171,0.12)')}>
            <BarChart3 size={20} color="#4A7AAB" />
          </div>
          <div>
            <p style={kpiLabel}>{isRTL ? 'إجمالي السجلات' : 'Total Logs'}</p>
            <p style={kpiValue}>{kpis.total}</p>
          </div>
        </div>

        <div style={kpiCard('#10b981')}>
          <div style={iconWrap('rgba(16,185,129,0.12)')}>
            <Calendar size={20} color="#10b981" />
          </div>
          <div>
            <p style={kpiLabel}>{isRTL ? 'إجراءات اليوم' : "Today's Actions"}</p>
            <p style={kpiValue}>{kpis.today}</p>
          </div>
        </div>

        <div style={kpiCard('#8b5cf6')}>
          <div style={iconWrap('rgba(139,92,246,0.12)')}>
            <User size={20} color="#8b5cf6" />
          </div>
          <div>
            <p style={kpiLabel}>{isRTL ? 'المستخدمين النشطين' : 'Unique Users'}</p>
            <p style={kpiValue}>{kpis.users}</p>
          </div>
        </div>

        <div style={kpiCard('#f59e0b')}>
          <div style={iconWrap('rgba(245,158,11,0.12)')}>
            <Activity size={20} color="#f59e0b" />
          </div>
          <div>
            <p style={kpiLabel}>{isRTL ? 'الأكثر نشاطاً' : 'Most Active Entity'}</p>
            <p style={{ ...kpiValue, fontSize: 16 }}>{kpis.mostActive}</p>
            {kpis.mostActiveCount > 0 && (
              <p style={kpiSub}>{kpis.mostActiveCount} {isRTL ? 'إجراء' : 'actions'}</p>
            )}
          </div>
        </div>
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={smartFields}
        filters={smartFilters}
        onFiltersChange={(f) => { setSmartFilters(f); setPage(1); }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={isRTL ? 'بحث في السجل...' : 'Search logs...'}
        resultsCount={filtered.length}
      />

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <Table>
          <thead>
            <tr>
              <Th>{isRTL ? 'التاريخ' : 'Date/Time'}</Th>
              <Th>{isRTL ? 'بواسطة' : 'User'}</Th>
              <Th>{isRTL ? 'الإجراء' : 'Action'}</Th>
              <Th>{isRTL ? 'الكيان' : 'Entity Type'}</Th>
              <Th>{isRTL ? 'الاسم' : 'Entity Name'}</Th>
              <Th>{isRTL ? 'الوصف' : 'Description'}</Th>
              <Th style={{ width: 36 }}></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <Tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Td key={j}>
                      <div className="h-3.5 rounded-md bg-gray-100 dark:bg-white/5 animate-pulse" />
                    </Td>
                  ))}
                </Tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center !py-10 text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'لا توجد سجلات' : 'No logs found'}
                </Td>
              </tr>
            ) : (
              paged.map(log => {
                const ac = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
                const AIcon = ac.icon;
                const entityLabel = ENTITY_LABELS[log.entity] || { ar: log.entity, en: log.entity };
                const isExpanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <Tr className={log.changes ? 'cursor-pointer' : ''} onClick={() => log.changes && setExpandedId(isExpanded ? null : log.id)}>
                      <Td className="text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap">{formatDate(log.created_at)}</Td>
                      <Td className="text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap">{isRTL ? (log._user_name_ar || log.user_name || '—') : (log._user_name_en || log.user_name || '—')}</Td>
                      <Td>
                        <Badge variant={ac.variant} size="sm">
                          <AIcon size={12} />{isRTL ? ac.ar : ac.en}
                        </Badge>
                      </Td>
                      <Td>{isRTL ? entityLabel.ar : entityLabel.en}</Td>
                      <Td className="text-xs font-semibold text-content dark:text-content-dark">{log.entity_name || '—'}</Td>
                      <Td className="max-w-[280px] truncate">{log.description || '—'}</Td>
                      <Td>
                        {log.changes && (isExpanded
                          ? <ChevronUp size={14} className="text-content-muted dark:text-content-muted-dark" />
                          : <ChevronDown size={14} className="text-content-muted dark:text-content-muted-dark" />
                        )}
                      </Td>
                    </Tr>
                    {isExpanded && log.changes && (
                      <tr>
                        <td colSpan={7} className="px-3.5 pb-3.5 bg-gray-50 dark:bg-brand-500/[0.04]">
                          <div className="rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr>
                                  <Th className="!text-[10px]">{isRTL ? 'الحقل' : 'Field'}</Th>
                                  <Th className="!text-[10px]">{isRTL ? 'القيمة القديمة' : 'Old Value'}</Th>
                                  <Th className="!text-[10px]">{isRTL ? 'القيمة الجديدة' : 'New Value'}</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(log.changes).map(([field, val]) => (
                                  <Tr key={field}>
                                    <Td className="!text-xs font-semibold">{field}</Td>
                                    <Td className="!text-xs" style={{ color: '#ef4444' }}>{val.from != null ? String(val.from) : '—'}</Td>
                                    <Td className="!text-xs" style={{ color: '#10b981' }}>{val.to != null ? String(val.to) : '—'}</Td>
                                  </Tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          totalItems={filtered.length}
        />
      )}
    </div>
  );
}
