import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Calendar, CheckSquare, Clock } from 'lucide-react';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../services/reportExportService';

// Per-agent MEETINGS breakdown over a selectable date range (managers only —
// registered under MANAGER_ONLY_TABS, so a sales agent never sees a peer's
// numbers). Booked (scheduled) vs Happened (completed), split by type, plus
// upcoming calendar count. Server-aggregated + RLS-scoped via get_meetings_breakdown.
const COLS = [
  { key: 'booked',     ar: 'اتحددت',   en: 'Booked',     color: '#185FA5', strong: true },
  { key: 'happened',   ar: 'حصلت',      en: 'Happened',   color: '#0F6E56' },
  { key: 'site_visit', ar: 'معاينة',    en: 'Site visit', color: '#854F0B' },
  { key: 'office',     ar: 'مكتب',      en: 'Office' },
  { key: 'online',     ar: 'أونلاين',   en: 'Online' },
  { key: 'total',      ar: 'الإجمالي',  en: 'Total',      strong: true },
  { key: 'upcoming',   ar: 'قادمة',     en: 'Upcoming',   color: '#534AB7' },
];

const localISO = (d) => d.toISOString();
function rangeBounds(key) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (key === 'today') {
    const to = new Date(start); to.setDate(to.getDate() + 1);
    return { from: localISO(start), to: localISO(to) };
  }
  if (key === 'week') {
    const from = new Date(start); from.setDate(from.getDate() - 6);
    return { from: localISO(from), to: localISO(now) };
  }
  if (key === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: localISO(from), to: localISO(now) };
  }
  const from = new Date(start); from.setDate(from.getDate() - 30);
  return { from: localISO(from), to: localISO(now) };
}

export default function MeetingsTab({ lang, isRTL }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const PRESETS = [
    { key: 'today', ar: 'اليوم', en: 'Today' },
    { key: 'week',  ar: 'آخر 7 أيام', en: 'Last 7 days' },
    { key: 'month', ar: 'الشهر الحالي', en: 'This month' },
    { key: 'last30', ar: 'آخر 30 يوم', en: 'Last 30 days' },
    { key: 'custom', ar: 'مخصص', en: 'Custom' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let from, to;
      if (range === 'custom') {
        if (!customFrom || !customTo) { setRows([]); setLoading(false); return; }
        from = new Date(customFrom + 'T00:00:00').toISOString();
        to = new Date(customTo + 'T23:59:59').toISOString();
      } else {
        ({ from, to } = rangeBounds(range));
      }
      const { data, error } = await supabase.rpc('get_meetings_breakdown', { p_from: from, p_to: to });
      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(isRTL ? `تعذّر تحميل التقرير: ${err.message || ''}` : `Failed to load: ${err.message || ''}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo, toast, isRTL]);

  useEffect(() => { load(); }, [load]);

  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    return acc;
  }, {});

  const handleExport = () => {
    const agentLabel = isRTL ? 'الموظف' : 'Agent';
    const data = rows.map(r => {
      const o = { [agentLabel]: r.agent_name || '—' };
      COLS.forEach(c => { o[isRTL ? c.ar : c.en] = Number(r[c.key]) || 0; });
      return o;
    });
    const columns = [{ key: agentLabel, label: agentLabel }, ...COLS.map(c => ({ key: isRTL ? c.ar : c.en, label: isRTL ? c.ar : c.en }))];
    exportToCSV(data, columns, isRTL ? 'الاجتماعات' : 'meetings');
  };

  const cell = (v, c) => {
    const n = Number(v) || 0;
    const dim = n === 0 ? 'text-content-muted/50 dark:text-content-muted-dark/50' : 'text-content dark:text-content-dark';
    return (
      <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums ${c.strong ? 'font-bold' : ''} ${dim}`}
        style={c.color && n > 0 ? { color: c.color } : undefined}>{n.toLocaleString()}</td>
    );
  };

  const kpis = [
    { label: isRTL ? 'اتحددت' : 'Booked', value: totals.booked, sub: isRTL ? 'مواعيد اتسجّلت في الفترة' : 'booked in period', icon: Calendar, color: '#185FA5' },
    { label: isRTL ? 'حصلت' : 'Happened', value: totals.happened, sub: isRTL ? 'مقابلات تمّت' : 'completed', icon: CheckSquare, color: '#0F6E56' },
    { label: isRTL ? 'قادمة' : 'Upcoming', value: totals.upcoming, sub: isRTL ? 'مجدولة في المستقبل' : 'future scheduled', icon: Clock, color: '#534AB7' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">{isRTL ? 'الاجتماعات' : 'Meetings'}</h2>
          <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${rows.length} موظف · مواعيد ومقابلات خلال الفترة المختارة` : `${rows.length} agents · meetings booked & held in the selected period`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-xs font-semibold cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {isRTL ? 'تحديث' : 'Refresh'}
          </button>
          <button onClick={handleExport} disabled={!rows.length}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border-none bg-brand-500 text-white text-xs font-semibold cursor-pointer hover:bg-brand-600 disabled:opacity-50">
            <Download size={14} /> {isRTL ? 'تصدير Excel' : 'Export'}
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => setRange(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
              range === p.key ? 'bg-brand-500 text-white border-brand-500'
              : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/40'}`}>
            {isRTL ? p.ar : p.en}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="h-9 px-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs" />
            <span className="text-content-muted dark:text-content-muted-dark text-xs">→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="h-9 px-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs" />
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-medium">{k.label}</span>
                <Icon size={15} style={{ color: k.color }} />
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: k.color }}>{(k.value || 0).toLocaleString()}</div>
              <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا يوجد اجتماعات في الفترة دي' : 'No meetings in this period'}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge dark:border-edge-dark">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-surface-bg-dark">
                <th className="px-3 py-2 text-start sticky start-0 bg-surface-bg dark:bg-surface-bg-dark text-content dark:text-content-dark font-bold border-e border-edge dark:border-edge-dark border-b">{isRTL ? 'الموظف' : 'Agent'}</th>
                {COLS.map(c => (
                  <th key={c.key} className="px-2.5 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark">{isRTL ? c.ar : c.en}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-edge dark:border-edge-dark bg-brand-500/[0.04] font-semibold">
                <td className="px-3 py-2 text-start sticky start-0 bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark border-e border-edge dark:border-edge-dark">{isRTL ? 'الإجمالي' : 'Total'}</td>
                {COLS.map(c => cell(totals[c.key], c))}
              </tr>
              {rows.map(r => (
                <tr key={r.agent_id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-surface-bg/50 dark:hover:bg-surface-bg-dark/50">
                  <td className="px-3 py-2 text-start sticky start-0 bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark font-medium whitespace-nowrap border-e border-edge dark:border-edge-dark">{r.agent_name || '—'}</td>
                  {COLS.map(c => cell(r[c.key], c))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
