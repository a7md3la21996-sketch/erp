import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../services/reportExportService';

// Per-agent ACTIVITY/work breakdown over a selectable date range (managers).
// Counts calls / whatsapp / meetings / emails / notes / status-changes + deals
// each agent logged in the window. Server-aggregated, RLS-scoped.
const COLS = [
  { key: 'calls',            ar: 'مكالمات',      en: 'Calls',     color: '#185FA5' },
  { key: 'whatsapp',         ar: 'واتساب',        en: 'WhatsApp',  color: '#0F6E56' },
  { key: 'meetings',         ar: 'اجتماعات',      en: 'Meetings',  color: '#854F0B' },
  { key: 'emails',           ar: 'إيميل',         en: 'Emails' },
  { key: 'notes',            ar: 'ملاحظات',       en: 'Notes' },
  { key: 'status_changes',   ar: 'تغيير حالة',    en: 'Status Δ' },
  { key: 'total_activities', ar: 'إجمالي النشاط', en: 'Total',     strong: true },
  { key: 'deals',            ar: 'صفقات',         en: 'Deals',     color: '#3B6D11' },
];

// Response-rate group — counted over DISTINCT leads (from get_agent_activity_
// breakdown: leads_reached / leads_responded), NOT activity counts. "responded"
// = the customer engaged back (answered call / replied whatsapp / completed
// meeting). Rendered as a separate group after the activity counts.
const RESP_COLS = [
  { key: 'leads_responded', ar: 'ردّوا',      en: 'Responded', color: '#0F6E56' },
  { key: 'no_response',     ar: 'مردّوش',      en: 'No reply',  color: '#B4232A' },
  { key: 'resp_pct',        ar: 'نسبة الرد',   en: 'Response %', pct: true, strong: true },
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
  // last 30
  const from = new Date(start); from.setDate(from.getDate() - 30);
  return { from: localISO(from), to: localISO(now) };
}

export default function AgentActivityTab({ lang, isRTL }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('week');
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
      const { data, error } = await supabase.rpc('get_agent_activity_breakdown', { p_from: from, p_to: to });
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

  // Derive the response columns per row: no_response = reached − responded.
  const displayRows = rows.map(r => {
    const reached = Number(r.leads_reached) || 0;
    const responded = Number(r.leads_responded) || 0;
    return { ...r, _reached: reached, leads_responded: responded, no_response: Math.max(0, reached - responded) };
  });

  const totals = [...COLS, { key: 'leads_responded' }, { key: 'no_response' }].reduce((acc, c) => {
    acc[c.key] = displayRows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    return acc;
  }, {});
  const totalReached = displayRows.reduce((s, r) => s + (r._reached || 0), 0);
  const pctOf = (responded, reached) => (reached > 0 ? Math.round((responded / reached) * 100) : null);
  const pctColor = (p) => (p == null ? undefined : p >= 50 ? '#0F6E56' : p >= 25 ? '#854F0B' : '#B4232A');

  const handleExport = () => {
    const agentLabel = isRTL ? 'الموظف' : 'Agent';
    const allCols = [...COLS, ...RESP_COLS];
    const data = displayRows.map(r => {
      const o = { [agentLabel]: r.agent_name || '—' };
      allCols.forEach(c => {
        if (c.pct) { const p = pctOf(Number(r.leads_responded) || 0, Number(r._reached) || 0); o[isRTL ? c.ar : c.en] = p == null ? '' : p + '%'; }
        else o[isRTL ? c.ar : c.en] = Number(r[c.key]) || 0;
      });
      return o;
    });
    const columns = [{ key: agentLabel, label: agentLabel }, ...allCols.map(c => ({ key: isRTL ? c.ar : c.en, label: isRTL ? c.ar : c.en }))];
    exportToCSV(data, columns, isRTL ? 'نشاط-الموظفين' : 'agent-activity');
  };

  // Render a response-group cell (Responded / No-reply / Response %). isFirst
  // draws the divider that separates the group from the activity counts.
  const respCell = (rowObj, c, isFirst) => {
    const border = isFirst ? 'border-s border-edge dark:border-edge-dark' : '';
    if (c.pct) {
      const p = pctOf(Number(rowObj.leads_responded) || 0, Number(rowObj._reached) || 0);
      return (
        <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums font-bold ${border}`} style={{ color: pctColor(p) }}>
          {p == null ? '—' : p + '%'}
        </td>
      );
    }
    const n = Number(rowObj[c.key]) || 0;
    const dim = n === 0 ? 'text-content-muted/50 dark:text-content-muted-dark/50' : '';
    return (
      <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums ${dim} ${border}`}
        style={c.color && n > 0 ? { color: c.color } : undefined}>{n.toLocaleString()}</td>
    );
  };

  const cell = (v, c) => {
    const n = Number(v) || 0;
    const dim = n === 0 ? 'text-content-muted/50 dark:text-content-muted-dark/50' : 'text-content dark:text-content-dark';
    return (
      <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums ${c.strong ? 'font-bold' : ''} ${dim}`}
        style={c.color && n > 0 ? { color: c.color } : undefined}>{n.toLocaleString()}</td>
    );
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">{isRTL ? 'نشاط الموظفين' : 'Team Activity'}</h2>
          <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${rows.length} موظف · شغلهم خلال الفترة المختارة` : `${rows.length} agents · work done in the selected period`}
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

      {loading ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا يوجد نشاط في الفترة دي' : 'No activity in this period'}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge dark:border-edge-dark">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-surface-bg-dark">
                <th className="px-3 py-2 text-start sticky start-0 bg-surface-bg dark:bg-surface-bg-dark text-content dark:text-content-dark font-bold border-e border-edge dark:border-edge-dark border-b">{isRTL ? 'الموظف' : 'Agent'}</th>
                {COLS.map(c => (
                  <th key={c.key} className="px-2.5 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark">{isRTL ? c.ar : c.en}</th>
                ))}
                {RESP_COLS.map((c, i) => (
                  <th key={c.key} className={`px-2.5 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark ${i === 0 ? 'border-s' : ''}`}>{isRTL ? c.ar : c.en}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-edge dark:border-edge-dark bg-brand-500/[0.04] font-semibold">
                <td className="px-3 py-2 text-start sticky start-0 bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark border-e border-edge dark:border-edge-dark">{isRTL ? 'الإجمالي' : 'Total'}</td>
                {COLS.map(c => cell(totals[c.key], c))}
                {RESP_COLS.map((c, i) => respCell({ leads_responded: totals.leads_responded, no_response: totals.no_response, _reached: totalReached }, c, i === 0))}
              </tr>
              {displayRows.map(r => (
                <tr key={r.agent_id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-surface-bg/50 dark:hover:bg-surface-bg-dark/50">
                  <td className="px-3 py-2 text-start sticky start-0 bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark font-medium whitespace-nowrap border-e border-edge dark:border-edge-dark">{r.agent_name || '—'}</td>
                  {COLS.map(c => cell(r[c.key], c))}
                  {RESP_COLS.map((c, i) => respCell(r, c, i === 0))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
