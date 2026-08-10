import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, ArrowRightLeft, UserPlus, UserMinus } from 'lucide-react';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../services/reportExportService';

// Per-agent LEAD DISTRIBUTION (reassignment) breakdown over a date range.
// Managers only (registered under MANAGER_ONLY_TABS). Separate from "Team
// Activity" on purpose: reassignments are distribution, not outreach.
//   • Received  — leads assigned TO the agent   (to_user_id)
//   • Given     — leads moved AWAY from the agent (from_user_id)
//   • Net       — received − given
// Aggregated client-side over RLS-scoped rows (admin/ops see everything; a
// team lead sees their scope). Row volume is bounded by the selected period.
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

export default function ReassignmentsTab({ lang, isRTL }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [totalMoves, setTotalMoves] = useState(0);
  const [topActor, setTopActor] = useState(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('month');
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

      // Server-aggregated + RLS-scoped. A broad client scan of `activities`
      // under RLS times out (500), so all the work happens in the RPC.
      const { data, error } = await supabase.rpc('get_reassignment_breakdown', { p_from: from, p_to: to });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '404') { setNeedsMigration(true); setRows([]); setTotalMoves(0); setTopActor(null); return; }
        throw error;
      }
      setNeedsMigration(false);
      const list = (Array.isArray(data?.rows) ? data.rows : []).map(r => ({
        id: r.agent_id, name: r.agent_name || (isRTL ? 'غير معروف' : 'Unknown'),
        received: Number(r.received) || 0, given: Number(r.given) || 0,
        net: (Number(r.received) || 0) - (Number(r.given) || 0),
      }));
      setRows(list);
      setTotalMoves(Number(data?.total_moves) || 0);
      setTopActor(data?.top_actor ? { name: data.top_actor.name || '—', count: Number(data.top_actor.count) || 0 } : null);
    } catch (err) {
      toast.error(isRTL ? `تعذّر تحميل التقرير: ${err.message || ''}` : `Failed to load: ${err.message || ''}`);
      setRows([]); setTotalMoves(0); setTopActor(null);
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo, toast, isRTL]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    const agentLabel = isRTL ? 'الموظف' : 'Agent';
    const data = rows.map(r => ({
      [agentLabel]: r.name,
      [isRTL ? 'استلم' : 'Received']: r.received,
      [isRTL ? 'اتنقل منه' : 'Given']: r.given,
      [isRTL ? 'الصافي' : 'Net']: r.net,
    }));
    exportToCSV(data, [
      { key: agentLabel, label: agentLabel },
      { key: isRTL ? 'استلم' : 'Received', label: isRTL ? 'استلم' : 'Received' },
      { key: isRTL ? 'اتنقل منه' : 'Given', label: isRTL ? 'اتنقل منه' : 'Given' },
      { key: isRTL ? 'الصافي' : 'Net', label: isRTL ? 'الصافي' : 'Net' },
    ], isRTL ? 'التوزيعات' : 'reassignments');
  };

  const kpis = [
    { label: isRTL ? 'إجمالي التوزيعات' : 'Total moves', value: totalMoves, sub: isRTL ? 'إعادة إسناد في الفترة' : 'reassignments in period', icon: ArrowRightLeft, color: '#185FA5' },
    { label: isRTL ? 'موظفين استلموا' : 'Received by', value: rows.filter(r => r.received > 0).length, sub: isRTL ? 'عدد الموظفين' : 'agents', icon: UserPlus, color: '#0F6E56' },
    { label: isRTL ? 'الأكثر توزيعاً' : 'Top distributor', value: topActor?.count || 0, sub: topActor?.name || '—', icon: UserMinus, color: '#854F0B' },
  ];

  const numCell = (v, strong, color) => {
    const n = Number(v) || 0;
    const dim = n === 0 ? 'text-content-muted/50 dark:text-content-muted-dark/50' : 'text-content dark:text-content-dark';
    return <td className={`px-2.5 py-2 text-center tabular-nums ${strong ? 'font-bold' : ''} ${dim}`}
      style={color && n > 0 ? { color } : undefined}>{n.toLocaleString()}</td>;
  };

  const totals = rows.reduce((a, r) => ({ received: a.received + r.received, given: a.given + r.given }), { received: 0, given: 0 });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">{isRTL ? 'التوزيعات' : 'Distribution'}</h2>
          <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${rows.length} موظف · إعادة إسناد الليدز خلال الفترة (مش تواصل)` : `${rows.length} agents · lead reassignments in the period (not outreach)`}
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
              <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 truncate">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {needsMigration && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
          {isRTL
            ? 'التقرير محتاج تطبيق دالة قاعدة البيانات get_reassignment_breakdown في Supabase SQL Editor.'
            : 'This report needs the get_reassignment_breakdown function applied in Supabase SQL Editor.'}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا يوجد توزيعات في الفترة دي' : 'No reassignments in this period'}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge dark:border-edge-dark">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-surface-bg-dark">
                <th className="px-3 py-2 text-start sticky start-0 bg-surface-bg dark:bg-surface-bg-dark text-content dark:text-content-dark font-bold border-e border-edge dark:border-edge-dark border-b">{isRTL ? 'الموظف' : 'Agent'}</th>
                <th className="px-2.5 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark">{isRTL ? 'استلم' : 'Received'}</th>
                <th className="px-2.5 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark">{isRTL ? 'اتنقل منه' : 'Given'}</th>
                <th className="px-2.5 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark">{isRTL ? 'الصافي' : 'Net'}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-edge dark:border-edge-dark bg-brand-500/[0.04] font-semibold">
                <td className="px-3 py-2 text-start sticky start-0 bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark border-e border-edge dark:border-edge-dark">{isRTL ? 'الإجمالي' : 'Total'}</td>
                {numCell(totals.received, true, '#0F6E56')}
                {numCell(totals.given, true, '#854F0B')}
                {numCell(totals.received - totals.given, true)}
              </tr>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-edge/50 dark:border-edge-dark/50 hover:bg-surface-bg/50 dark:hover:bg-surface-bg-dark/50">
                  <td className="px-3 py-2 text-start sticky start-0 bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark font-medium whitespace-nowrap border-e border-edge dark:border-edge-dark">{r.name}</td>
                  {numCell(r.received, false, '#0F6E56')}
                  {numCell(r.given, false, '#854F0B')}
                  {numCell(r.net, false)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
