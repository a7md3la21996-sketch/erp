import { useState, useEffect, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import supabase from '../../lib/supabase';
import { History, ChevronDown, ChevronUp, Plus, Pencil, Trash2, RefreshCw, Ban, UserCheck, Users2, Merge, Upload, Thermometer, ArrowRightLeft, Info } from 'lucide-react';
import { Button, Badge, Table, Th, Td, Tr, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';
import { ACTION_TYPES, getLocalAuditLogs } from '../../services/auditService';

const ACTION_CONFIG = {
  create:           { variant: 'success', icon: Plus,           ar: 'إنشاء',               en: 'Create' },
  update:           { variant: 'default', icon: Pencil,         ar: 'تعديل',               en: 'Update' },
  delete:           { variant: 'danger',  icon: Trash2,         ar: 'حذف',                 en: 'Delete' },
  status_change:    { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير حالة',           en: 'Status Change' },
  type_change:      { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير نوع',           en: 'Type Change' },
  blacklist:        { variant: 'danger',  icon: Ban,            ar: 'بلاك ليست',           en: 'Blacklisted' },
  unblacklist:      { variant: 'success', icon: Ban,            ar: 'إلغاء بلاك ليست',     en: 'Unblacklisted' },
  reassign:         { variant: 'default', icon: UserCheck,      ar: 'إعادة تعيين',         en: 'Reassigned' },
  bulk_reassign:    { variant: 'default', icon: Users2,         ar: 'إعادة تعيين جماعي',   en: 'Bulk Reassign' },
  bulk_delete:      { variant: 'danger',  icon: Trash2,         ar: 'حذف جماعي',           en: 'Bulk Delete' },
  merge:            { variant: 'default', icon: Merge,          ar: 'دمج',                 en: 'Merge' },
  import:           { variant: 'success', icon: Upload,         ar: 'استيراد',              en: 'Import' },
  stage_change:     { variant: 'default', icon: ArrowRightLeft, ar: 'تغيير مرحلة',         en: 'Stage Change' },
  temperature_change: { variant: 'default', icon: Thermometer,  ar: 'تغيير حرارة',         en: 'Temperature Change' },
  batch_call:       { variant: 'default', icon: Plus,           ar: 'اتصال جماعي',         en: 'Batch Call' },
};

const ENTITY_LABELS = {
  contact: { ar: 'جهة اتصال', en: 'Contact' },
  opportunity: { ar: 'فرصة', en: 'Opportunity' },
  task: { ar: 'مهمة', en: 'Task' },
  activity: { ar: 'نشاط', en: 'Activity' },
  employee: { ar: 'موظف', en: 'Employee' },
  invoice: { ar: 'فاتورة', en: 'Invoice' },
  deal: { ar: 'صفقة', en: 'Deal' },
  campaign: { ar: 'حملة', en: 'Campaign' },
  leave_request: { ar: 'طلب إجازة', en: 'Leave Request' },
  expense: { ar: 'مصروف', en: 'Expense' },
  journal_entry: { ar: 'قيد يومي', en: 'Journal Entry' },
  ticket: { ar: 'تذكرة', en: 'Ticket' },
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

  // Fetch distinct users from audit_logs + localStorage on mount
  useEffect(() => {
    (async () => {
      const map = new Map();
      // From Supabase
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
      // From localStorage
      const { data: localLogs } = getLocalAuditLogs({ limit: 500 });
      localLogs.forEach(l => {
        if (l.user_name && !map.has(l.user_name)) {
          map.set(l.user_name, { value: l.user_name, label: l.user_name, labelEn: l.user_name });
        }
      });
      setUserOptions([...map.values()]);
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
    let allLogs = [];

    // Fetch from Supabase
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, users:user_id (full_name_ar, full_name_en)')
        .order('created_at', { ascending: false })
        .limit(200);

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

    // Merge with localStorage logs
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

  useEffect(() => { fetchLogs(); }, [page, filterAction, filterEntity, filterUserId]);

  const handleSearchKeyDown = (e) => {
    if (e?.key === 'Enter') { setPage(0); fetchLogs(); }
  };

  // We override onSearchChange to also handle Enter-based searching
  const handleSearchChange = (val) => {
    setSearch(val);
  };

  // Client-side filtering for text/date fields
  const filtered = useMemo(() => {
    let result = logs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => (l.description || '').toLowerCase().includes(q) || (l.entity_name || '').toLowerCase().includes(q) || (l._user_name_ar || '').includes(q) || (l._user_name_en || '').toLowerCase().includes(q));
    }
    result = applySmartFilters(result, smartFilters.filter(f => !['action', 'entity', 'user_id'].includes(f.field)), smartFields);
    return result;
  }, [logs, search, smartFilters, smartFields]);

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
              { header: isRTL ? 'الاسم' : 'Name', key: 'entity_name' },
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
        resultsCount={filtered.length}
      />

      {/* Table */}
      <Table>
        <thead>
          <tr>
            <Th>{isRTL ? 'الإجراء' : 'Action'}</Th>
            <Th>{isRTL ? 'الكيان' : 'Entity'}</Th>
            <Th>{isRTL ? 'الاسم' : 'Name'}</Th>
            <Th>{isRTL ? 'الوصف' : 'Description'}</Th>
            <Th>{isRTL ? 'بواسطة' : 'Done By'}</Th>
            <Th>{isRTL ? 'التاريخ' : 'Date'}</Th>
            <Th className="w-10"></Th>
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
          ) : filtered.length === 0 ? (
            <tr>
              <Td colSpan={7} className="text-center !py-10 text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'لا توجد سجلات' : 'No logs found'}
              </Td>
            </tr>
          ) : (
            filtered.map(log => {
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
                    <Td className="text-xs font-semibold text-content dark:text-content-dark">{log.entity_name || '—'}</Td>
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
