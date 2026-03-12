import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import supabase from '../../lib/supabase';
import { History, Search, ChevronDown, ChevronUp, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button, Input, Select, Badge, Table, Th, Td, Tr, ExportButton } from '../../components/ui';

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

export default function AuditLogPage() {
  const { i18n } = useTranslation();
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
              { header: isRTL ? 'التاريخ' : 'Date', key: 'created_at' },
            ]}
          />
          <Button variant="secondary" onClick={() => { setPage(0); fetchLogs(); }}>
            <RefreshCw size={14} />{isRTL ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute top-2.5 text-content-muted dark:text-content-muted-dark ltr:left-3 rtl:right-3" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={isRTL ? 'بحث في السجل...' : 'Search logs...'}
            className="ltr:!pl-9 rtl:!pr-9"
          />
        </div>
        <Select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
          <option value="">{isRTL ? 'كل الإجراءات' : 'All Actions'}</option>
          <option value="create">{isRTL ? 'إنشاء' : 'Create'}</option>
          <option value="update">{isRTL ? 'تعديل' : 'Update'}</option>
          <option value="delete">{isRTL ? 'حذف' : 'Delete'}</option>
        </Select>
        <Select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }}>
          <option value="">{isRTL ? 'كل الكيانات' : 'All Entities'}</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <Table>
        <thead>
          <tr>
            <Th>{isRTL ? 'الإجراء' : 'Action'}</Th>
            <Th>{isRTL ? 'الكيان' : 'Entity'}</Th>
            <Th>{isRTL ? 'الوصف' : 'Description'}</Th>
            <Th>{isRTL ? 'التاريخ' : 'Date'}</Th>
            <Th className="w-10"></Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Tr key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <Td key={j}>
                    <div className="h-3.5 rounded-md bg-gray-100 dark:bg-white/5 animate-pulse" />
                  </Td>
                ))}
              </Tr>
            ))
          ) : logs.length === 0 ? (
            <tr>
              <Td colSpan={5} className="text-center !py-10 text-content-muted dark:text-content-muted-dark">
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
                      <td colSpan={5} className="px-3.5 pb-3.5 bg-gray-50 dark:bg-brand-500/[0.04]">
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
