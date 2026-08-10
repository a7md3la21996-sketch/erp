import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../services/reportExportService';

// Per-sales-agent breakdown sheet (managers). One row per agent with their lead
// categories, follow-up buckets, and status counts — all server-aggregated via
// get_per_agent_breakdown (SECURITY INVOKER, RLS-scoped: agent→self,
// manager→team, admin→all). No 1000-row client cap.
const COLS = [
  { key: 'total_leads',       ar: 'الإجمالي',       en: 'Total',        group: 'leads',    strong: true },
  { key: 'fresh',             ar: 'فريش',            en: 'Fresh',        group: 'leads' },
  { key: 'untouched_fresh',   ar: 'فريش لم يُلمس',   en: 'Untouched',    group: 'leads' },
  { key: 'rotation',          ar: 'تدوير',           en: 'Rotation',     group: 'leads' },
  { key: 'distributed',       ar: 'موزّع',           en: 'Distributed',  group: 'leads' },
  { key: 'cold_calls',        ar: 'كولد',            en: 'Cold',         group: 'leads' },
  { key: 'overdue',           ar: 'متأخرة',          en: 'Overdue',      group: 'followup', color: '#D6403B' },
  { key: 'today',             ar: 'اليوم',           en: 'Today',        group: 'followup', color: '#C9860A' },
  { key: 'upcoming',          ar: 'قادمة',           en: 'Upcoming',     group: 'followup', color: '#158A57' },
  { key: 's_new',             ar: 'جديد',            en: 'New',          group: 'status' },
  { key: 's_contacted',       ar: 'تم التواصل',      en: 'Contacted',    group: 'status' },
  { key: 's_following',       ar: 'متابعة',          en: 'Following',    group: 'status' },
  { key: 's_has_opportunity', ar: 'لديه فرصة',       en: 'Has Opp',      group: 'status' },
  { key: 's_disqualified',    ar: 'غير مؤهل',        en: 'Disqualified', group: 'status' },
];

const GROUPS = [
  { id: 'leads',    ar: 'الليدز',     en: 'Leads' },
  { id: 'followup', ar: 'المتابعات',  en: 'Follow-up' },
  { id: 'status',   ar: 'الحالات',    en: 'Statuses' },
];

export default function AgentBreakdownTab({ lang, isRTL }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const { data, error } = await supabase.rpc('get_per_agent_breakdown', {
        p_today_start: todayStart.toISOString(),
        p_tomorrow_start: tomorrowStart.toISOString(),
      });
      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(isRTL ? `تعذّر تحميل التقرير: ${err.message || ''}` : `Failed to load: ${err.message || ''}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast, isRTL]);

  useEffect(() => { load(); }, [load]);

  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    return acc;
  }, {});

  const handleExport = () => {
    const agentLabel = isRTL ? 'السيلز' : 'Agent';
    const data = rows.map(r => {
      const o = { [agentLabel]: r.agent_name || '—' };
      COLS.forEach(c => { o[isRTL ? c.ar : c.en] = Number(r[c.key]) || 0; });
      return o;
    });
    const columns = [{ key: agentLabel, label: agentLabel }, ...COLS.map(c => ({ key: isRTL ? c.ar : c.en, label: isRTL ? c.ar : c.en }))];
    exportToCSV(data, columns, isRTL ? 'تقرير-السيلز' : 'agent-breakdown');
  };

  const cell = (v, c) => {
    const n = Number(v) || 0;
    const dim = n === 0 ? 'text-content-muted/50 dark:text-content-muted-dark/50' : 'text-content dark:text-content-dark';
    return (
      <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums ${c.strong ? 'font-bold' : ''} ${dim}`}
        style={c.color && n > 0 ? { color: c.color } : undefined}>
        {n.toLocaleString()}
      </td>
    );
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">{isRTL ? 'أداء وتوزيع السيلز' : 'Sales Agent Breakdown'}</h2>
          <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${rows.length} موظف · كل أرقامه في شيت واحد` : `${rows.length} agents · all their numbers in one sheet`}
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

      {loading ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا توجد بيانات' : 'No data'}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge dark:border-edge-dark">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-surface-bg-dark">
                <th rowSpan={2} className="px-3 py-2 text-start sticky start-0 bg-surface-bg dark:bg-surface-bg-dark text-content dark:text-content-dark font-bold border-e border-edge dark:border-edge-dark">{isRTL ? 'السيلز' : 'Agent'}</th>
                {GROUPS.map(g => (
                  <th key={g.id} colSpan={COLS.filter(c => c.group === g.id).length}
                    className="px-2 py-1.5 text-center text-[11px] font-bold text-content-muted dark:text-content-muted-dark border-b border-s border-edge dark:border-edge-dark">
                    {isRTL ? g.ar : g.en}
                  </th>
                ))}
              </tr>
              <tr className="bg-surface-bg dark:bg-surface-bg-dark">
                {COLS.map(c => (
                  <th key={c.key} className="px-2.5 py-1.5 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark whitespace-nowrap border-b border-edge dark:border-edge-dark">
                    {isRTL ? c.ar : c.en}
                  </th>
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
