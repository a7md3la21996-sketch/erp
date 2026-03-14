import { useState, useEffect, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import supabase from '../../lib/supabase';
import { History, ChevronDown, ChevronUp, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button, Badge, Table, Th, Td, Tr, ExportButton, SmartFilter } from '../../components/ui';

const ACTION_CONFIG = {
  create: { variant: 'success', icon: Plus, ar: 'إنشاء', en: 'Create' },
  update: { variant: 'default', icon: Pencil, ar: 'تعديل', en: 'Update' },
  delete: { variant: 'danger', icon: Trash2, ar: 'حذف', en: 'Delete' },
};

const ENTITY_LABELS = {
  contact: { ar: 'جهة اتصال', en: 'Contact' },
  opportunity: { ar: 'فرصة', en: 'Opportunity' },
  task: { ar: 'مهمة', en: 'Task' },
  activity: { ar: 'نشاط', en: 'Activity' },
  employee: { ar: 'موظف', en: 'Employee' },
  invoice: { ar: 'فاتورة', en: 'Invoice' },
};

const BASE_SMART_FIELDS = [
  {
    id: 'action', label: 'الإجراء', labelEn: 'Action', type: 'select',
    options: [
      { value: 'create', label: 'إنشاء', labelEn: 'Create' },
      { value: 'update', label: 'تعديل', labelEn: 'Update' },
      { value: 'delete', label: 'حذف', labelEn: 'Delete' },
    ],
  },
  {
    id: 'entity', label: 'الكيان', labelEn: 'Entity', type: 'select',
    options: Object.entries(ENTITY_LABELS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
  },
  { id: 'description', label: 'الوصف', labelEn: 'Description', type: 'text' },
  { id: 'created_at', label: 'التاريخ', labelEn: 'Date', type: 'date' },
];

export default function AuditLogPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(0);
  const [userOptions, setUserOptions] = useState([]);
  const PAGE_SIZE = 30;

  // Build SMART_FIELDS with dynamic user options
  const smartFields = useMemo(() => [
    ...BASE_SMART_FIELDS,
    {
      id: 'user_id', label: 'بواسطة', labelEn: 'Done By', type: 'select',
      options: userOptions,
    },
  ], [userOptions]);

  // Fetch distinct users from audit_logs on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('user_id, users:user_id (full_name_ar, full_name_en)')
          .order('created_at', { ascending: false });
        if (data) {
          const map = new Map();
          data.forEach(row => {
            if (row.user_id && !map.has(row.user_id)) {
              const u = row.users || {};
              map.set(row.user_id, {
                value: row.user_id,
                label: u.full_name_ar || row.user_id,
                labelEn: u.full_name_en || row.user_id,
              });
            }
          });
          setUserOptions([...map.values()]);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Extract action and entity filter values from smartFilters for server-side filtering
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
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, users:user_id (full_name_ar, full_name_en)')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction) query = query.eq('action', filterAction);
      if (filterEntity) query = query.eq('entity', filterEntity);
      if (filterUserId) query = query.eq('user_id', filterUserId);
      if (search) query = query.or(`description.ilike.%${search}%,entity.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []).map(row => ({
        ...row,
        _user_name_ar: row.users?.full_name_ar || '',
        _user_name_en: row.users?.full_name_en || '',
      })));
    } catch {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [page, filterAction, filterEntity, filterUserId]);

  const handleSearchKeyDown = (e) => {
    if (e?.key === 'Enter') { setPage(0); fetchLogs(); }
  };

  // We override onSearchChange to also handle Enter-based searching
  const handleSearchChange = (val) => {
    setSearch(val);
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <History size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'سجل التعديلات' : 'Audit Log'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'جميع التغييرات في النظام' : 'All system changes'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={logs}
            filename={isRTL ? 'سجل_التعديلات' : 'audit_log'}
            title={isRTL ? 'سجل التعديلات' : 'Audit Log'}
            columns={[
              { header: isRTL ? 'الإجراء' : 'Action', key: r => isRTL ? ACTION_CONFIG[r.action]?.ar : ACTION_CONFIG[r.action]?.en },
              { header: isRTL ? 'الكيان' : 'Entity', key: r => isRTL ? (ENTITY_LABELS[r.entity]?.ar || r.entity) : (ENTITY_LABELS[r.entity]?.en || r.entity) },
              { header: isRTL ? 'الوصف' : 'Description', key: 'description' },
              { header: isRTL ? 'بواسطة' : 'Done By', key: r => isRTL ? (r._user_name_ar || '') : (r._user_name_en || '') },
              { header: isRTL ? 'التاريخ' : 'Date', key: 'created_at' },
            ]}
          />
          <Button variant="secondary" onClick={() => { setPage(0); fetchLogs(); }}>
            <RefreshCw size={14} />{isRTL ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={smartFields}
        filters={smartFilters}
        onFiltersChange={(f) => { setSmartFilters(f); setPage(0); }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={isRTL ? 'بحث في السجل... (Enter للبحث)' : 'Search logs... (Enter to search)'}
        resultsCount={logs.length}
      />

      {/* Table */}
      <Table>
        <thead>
          <tr>
            <Th>{isRTL ? 'الإجراء' : 'Action'}</Th>
            <Th>{isRTL ? 'الكيان' : 'Entity'}</Th>
            <Th>{isRTL ? 'الوصف' : 'Description'}</Th>
            <Th>{isRTL ? 'بواسطة' : 'Done By'}</Th>
            <Th>{isRTL ? 'التاريخ' : 'Date'}</Th>
            <Th className="w-10"></Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <Td key={j}>
                    <div className="h-3.5 rounded-md bg-gray-100 dark:bg-white/5 animate-pulse" />
                  </Td>
                ))}
              </Tr>
            ))
          ) : logs.length === 0 ? (
            <tr>
              <Td colSpan={6} className="text-center !py-10 text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'لا توجد سجلات' : 'No logs found'}
              </Td>
            </tr>
          ) : (
            logs.map(log => {
              const ac = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
              const AIcon = ac.icon;
              const entityLabel = ENTITY_LABELS[log.entity] || { ar: log.entity, en: log.entity };
              const isExpanded = expandedId === log.id;
              return (
                <Fragment key={log.id}>
                  <Tr className={log.changes ? 'cursor-pointer' : ''} onClick={() => log.changes && setExpandedId(isExpanded ? null : log.id)}>
                    <Td>
                      <Badge variant={ac.variant} size="sm">
                        <AIcon size={12} />{isRTL ? ac.ar : ac.en}
                      </Badge>
                    </Td>
                    <Td>{isRTL ? entityLabel.ar : entityLabel.en}</Td>
                    <Td className="max-w-[280px] truncate">{log.description || '—'}</Td>
                    <Td className="text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap">{isRTL ? (log._user_name_ar || '—') : (log._user_name_en || '—')}</Td>
                    <Td className="text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap">{formatDate(log.created_at)}</Td>
                    <Td>
                      {log.changes && (isExpanded
                        ? <ChevronUp size={14} className="text-content-muted dark:text-content-muted-dark" />
                        : <ChevronDown size={14} className="text-content-muted dark:text-content-muted-dark" />
                      )}
                    </Td>
                  </Tr>
                  {isExpanded && log.changes && (
                    <tr>
                      <td colSpan={6} className="px-3.5 pb-3.5 bg-gray-50 dark:bg-brand-500/[0.04]">
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
                                  <Td className="!text-xs text-red-500">{val.from != null ? String(val.from) : '—'}</Td>
                                  <Td className="!text-xs text-emerald-500">{val.to != null ? String(val.to) : '—'}</Td>
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

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div className="mt-3 px-4 py-3 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl flex justify-between items-center">
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `صفحة ${page + 1}` : `Page ${page + 1}`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              {isRTL ? 'السابق' : 'Previous'}
            </Button>
            <Button variant="secondary" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
              {isRTL ? 'التالي' : 'Next'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
