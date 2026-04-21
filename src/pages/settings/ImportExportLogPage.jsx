import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Clock, User, FileText, CheckCircle, XCircle, AlertTriangle, Hash } from 'lucide-react';
import { Card, PageSkeleton, Pagination } from '../../components/ui';
import supabase from '../../lib/supabase';

export default function ImportExportLogPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase.from('import_export_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        if (filter !== 'all') q = q.eq('type', filter);
        const { data, count } = await q.range((page - 1) * pageSize, page * pageSize - 1);
        setLogs(data || []);
        setTotalCount(count || 0);
      } catch {}
      setLoading(false);
    })();
  }, [filter, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const statusBadge = (status) => {
    const cfg = { completed: { icon: CheckCircle, color: '#10B981', label: isRTL ? 'مكتمل' : 'Completed' }, partial: { icon: AlertTriangle, color: '#F59E0B', label: isRTL ? 'جزئي' : 'Partial' }, failed: { icon: XCircle, color: '#EF4444', label: isRTL ? 'فشل' : 'Failed' } };
    const c = cfg[status] || cfg.completed;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: c.color, background: c.color + '18' }}>
        <c.icon size={10} /> {c.label}
      </span>
    );
  };

  if (loading) return <div className="p-5"><PageSkeleton hasKpis={false} tableRows={8} tableCols={5} /></div>;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <FileText size={22} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'سجل الاستيراد والتصدير' : 'Import & Export Log'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'تتبع جميع عمليات الاستيراد والتصدير' : 'Track all import and export operations'}</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'all', label: isRTL ? 'الكل' : 'All', icon: null },
          { value: 'import', label: isRTL ? 'استيراد' : 'Import', icon: Upload },
          { value: 'export', label: isRTL ? 'تصدير' : 'Export', icon: Download },
        ].map(f => (
          <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${
              filter === f.value
                ? 'border border-brand-500 bg-brand-500/[0.08] text-brand-500 font-bold'
                : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'
            }`}>
            {f.icon && <f.icon size={12} />}
            {f.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={32} className="mx-auto mb-3 text-content-muted dark:text-content-muted-dark opacity-30" />
            <p className="text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد سجلات' : 'No logs yet'}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-edge dark:border-edge-dark">
                    <th className="px-4 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'النوع' : 'Type'}</th>
                    <th className="px-4 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'بواسطة' : 'By'}</th>
                    <th className="px-4 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الملف' : 'File'}</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي' : 'Total'}</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'نجح' : 'Success'}</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'فشل' : 'Failed'}</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-2.5 text-start font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'التاريخ' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-edge/30 dark:border-edge-dark/30 hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {log.type === 'import' ? <Upload size={13} className="text-brand-500" /> : <Download size={13} className="text-emerald-500" />}
                          <span className="font-semibold text-content dark:text-content-dark">
                            {log.type === 'import' ? (isRTL ? 'استيراد' : 'Import') : (isRTL ? 'تصدير' : 'Export')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-content dark:text-content-dark font-medium">{log.user_name || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-content-muted dark:text-content-muted-dark">{log.file_name || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold text-content dark:text-content-dark">{log.total_records || 0}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-500">{log.success_count || 0}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-500">{log.failed_count || 0}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(log.status)}</td>
                      <td className="px-4 py-3 text-content-muted dark:text-content-muted-dark text-[11px]">{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-edge dark:divide-edge-dark">
              {logs.map(log => (
                <div key={log.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.type === 'import' ? <Upload size={14} className="text-brand-500" /> : <Download size={14} className="text-emerald-500" />}
                      <span className="text-sm font-bold text-content dark:text-content-dark">
                        {log.type === 'import' ? (isRTL ? 'استيراد' : 'Import') : (isRTL ? 'تصدير' : 'Export')}
                      </span>
                      {statusBadge(log.status)}
                    </div>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{fmtDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="flex items-center gap-1 text-content dark:text-content-dark"><User size={11} /> {log.user_name || '—'}</span>
                    <span className="flex items-center gap-1 text-emerald-500"><CheckCircle size={11} /> {log.success_count || 0}</span>
                    {log.failed_count > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle size={11} /> {log.failed_count}</span>}
                    <span className="text-content-muted dark:text-content-muted-dark"><Hash size={11} className="inline" /> {log.total_records || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
