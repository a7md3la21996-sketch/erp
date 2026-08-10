import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../services/reportExportService';
import { thCls } from '../../utils/tableStyles';

// Status-transition report (managers): which leads moved from one status to
// another, who did it, and when. Sourced from audit_logs via
// get_status_transitions / get_status_transition_matrix (DEFINER + manager guard).
const STATUSES = [
  { id: 'new',             ar: 'جديد',       en: 'New',          color: '#2F6BD3' },
  { id: 'contacted',       ar: 'تم التواصل', en: 'Contacted',    color: '#5A63C4' },
  { id: 'following',       ar: 'متابعة',     en: 'Following',    color: '#C9860A' },
  { id: 'has_opportunity', ar: 'لديه فرصة',  en: 'Has Opp',      color: '#158A57' },
  { id: 'disqualified',    ar: 'غير مؤهل',   en: 'Disqualified', color: '#6B7280' },
];
const stLabel = (id, isRTL) => { const s = STATUSES.find(x => x.id === id); return s ? (isRTL ? s.ar : s.en) : (id || '—'); };
const stColor = (id) => STATUSES.find(x => x.id === id)?.color || '#9CA3AF';

function StatusChip({ id, isRTL }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
      style={{ color: stColor(id), backgroundColor: stColor(id) + '1A' }}>
      {stLabel(id, isRTL)}
    </span>
  );
}

export default function StatusTransitionsTab({ lang, isRTL }) {
  const toast = useToast();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Default to the last 30 days so the first load is fast; user can widen.
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [fromStatus, setFromStatus] = useState('all');
  const [toStatus, setToStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState(monthAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const [matrix, setMatrix] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const bounds = useCallback(() => ({
    p_from_date: dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : null,
    p_to_date: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
  }), [dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = bounds();
      const [mx, dt] = await Promise.all([
        supabase.rpc('get_status_transition_matrix', { ...b, p_agent: null }),
        supabase.rpc('get_status_transitions', {
          p_from: fromStatus !== 'all' ? fromStatus : null,
          p_to: toStatus !== 'all' ? toStatus : null,
          ...b, p_agent: null, p_limit: 2000,
        }),
      ]);
      if (mx.error) throw mx.error;
      if (dt.error) throw dt.error;
      setMatrix(Array.isArray(mx.data) ? mx.data : []);
      setRows(Array.isArray(dt.data) ? dt.data : []);
    } catch (err) {
      toast.error(isRTL ? `تعذّر تحميل التقرير: ${err.message || ''}` : `Failed to load: ${err.message || ''}`);
      setMatrix([]); setRows([]);
    } finally {
      setLoading(false);
    }
  }, [bounds, fromStatus, toStatus, isRTL, toast]);

  useEffect(() => { load(); }, [load]);

  // Matrix as a from×to lookup for the grid.
  const cell = useMemo(() => {
    const m = {};
    matrix.forEach(r => { m[`${r.from_status}|${r.to_status}`] = Number(r.cnt) || 0; });
    return m;
  }, [matrix]);
  const rowTotal = (f) => STATUSES.reduce((s, t) => s + (cell[`${f}|${t.id}`] || 0), 0);
  const grandTotal = matrix.reduce((s, r) => s + (Number(r.cnt) || 0), 0);

  const handleExport = () => {
    if (!rows.length) return;
    exportToCSV(rows.map(r => ({
      lead: r.lead_name || '',
      from: stLabel(r.from_status, isRTL),
      to: stLabel(r.to_status, isRTL),
      by: r.changed_by || '',
      when: r.changed_at ? new Date(r.changed_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US') : '',
    })), [
      { header: isRTL ? 'العميل' : 'Lead', key: 'lead' },
      { header: isRTL ? 'من' : 'From', key: 'from' },
      { header: isRTL ? 'إلى' : 'To', key: 'to' },
      { header: isRTL ? 'بواسطة' : 'By', key: 'by' },
      { header: isRTL ? 'التاريخ' : 'When', key: 'when' },
    ], isRTL ? 'تحويلات-الحالة' : 'status-transitions');
  };

  const inputCls = 'h-9 px-2.5 text-xs rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark focus:outline-none focus:ring-1 focus:ring-brand-500/40';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'من حالة' : 'From'}</span>
          <select value={fromStatus} onChange={e => setFromStatus(e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="all">{isRTL ? 'الكل' : 'Any'}</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{isRTL ? s.ar : s.en}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'إلى حالة' : 'To'}</span>
          <select value={toStatus} onChange={e => setToStatus(e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="all">{isRTL ? 'الكل' : 'Any'}</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{isRTL ? s.ar : s.en}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'من تاريخ' : 'From date'}</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'إلى تاريخ' : 'To date'}</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <button onClick={load} className="h-9 px-3 flex items-center gap-1.5 text-xs rounded-lg bg-brand-500/10 text-brand-500 border border-brand-500/20 cursor-pointer hover:bg-brand-500/15">
          <RefreshCw size={13} /> {isRTL ? 'تحديث' : 'Refresh'}
        </button>
        <button onClick={handleExport} disabled={!rows.length} className="h-9 px-3 flex items-center gap-1.5 text-xs rounded-lg bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark cursor-pointer hover:text-content disabled:opacity-40">
          <Download size={13} /> {isRTL ? 'تصدير' : 'Export'}
        </button>
      </div>

      {/* Summary matrix (click a cell to filter the list) */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-x-auto">
        <p className="m-0 px-4 pt-3 text-xs font-bold text-content dark:text-content-dark">
          {isRTL ? 'مصفوفة التحويلات (من ← إلى)' : 'Transition matrix (from → to)'}
          <span className="text-content-muted dark:text-content-muted-dark font-normal ms-2">{isRTL ? `الإجمالي ${grandTotal.toLocaleString()}` : `total ${grandTotal.toLocaleString()}`}</span>
        </p>
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[560px] mt-2">
          <thead>
            <tr>
              <th className={thCls}>{isRTL ? 'من \\ إلى' : 'From \\ To'}</th>
              {STATUSES.map(t => <th key={t.id} className={thCls}><StatusChip id={t.id} isRTL={isRTL} /></th>)}
              <th className={thCls}>{isRTL ? 'إجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {STATUSES.map(f => (
              <tr key={f.id} className="border-t border-edge/50 dark:border-edge-dark/50">
                <td className="px-4 py-2"><StatusChip id={f.id} isRTL={isRTL} /></td>
                {STATUSES.map(t => {
                  const n = cell[`${f.id}|${t.id}`] || 0;
                  const same = f.id === t.id;
                  return (
                    <td key={t.id} className="px-4 py-2 text-center">
                      {same ? <span className="text-content-muted/40">—</span> : n > 0 ? (
                        <button onClick={() => { setFromStatus(f.id); setToStatus(t.id); }}
                          className="text-xs font-bold text-brand-500 hover:underline bg-transparent border-none cursor-pointer">
                          {n.toLocaleString()}
                        </button>
                      ) : <span className="text-content-muted/40 text-xs">0</span>}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center text-xs font-bold text-content dark:text-content-dark">{rowTotal(f.id).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail list */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
            {isRTL ? 'العملاء المتحوّلون' : 'Transitioned leads'}
            <span className="text-content-muted dark:text-content-muted-dark font-normal ms-2">
              {rows.length >= 2000 ? (isRTL ? '(أول 2000)' : '(first 2000)') : `(${rows.length})`}
            </span>
          </p>
        </div>
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className={thCls}>{isRTL ? 'العميل' : 'Lead'}</th>
              <th className={thCls}>{isRTL ? 'التحويل' : 'Transition'}</th>
              <th className={thCls}>{isRTL ? 'بواسطة' : 'By'}</th>
              <th className={thCls}>{isRTL ? 'التاريخ' : 'When'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'جاري التحميل…' : 'Loading…'}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد تحويلات في هذه الفترة' : 'No transitions in this range'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}
                onClick={() => r.contact_id && navigate(`/contacts?highlight=${r.contact_id}`)}
                className="border-t border-edge/50 dark:border-edge-dark/50 hover:bg-surface-bg dark:hover:bg-brand-500/[0.04] cursor-pointer">
                <td className="px-4 py-2.5 text-xs font-semibold text-brand-500 hover:underline">{r.lead_name || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <StatusChip id={r.from_status} isRTL={isRTL} />
                    <Arrow size={12} className="text-content-muted dark:text-content-muted-dark shrink-0" />
                    <StatusChip id={r.to_status} isRTL={isRTL} />
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-content dark:text-content-dark">{r.changed_by || '—'}</td>
                <td className="px-4 py-2.5 text-[11px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                  {r.changed_at ? new Date(r.changed_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
