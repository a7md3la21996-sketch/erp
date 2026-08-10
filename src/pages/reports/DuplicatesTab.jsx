import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Copy } from 'lucide-react';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../services/reportExportService';
import { thCls } from '../../utils/tableStyles';

// Duplicate-leads report (managers): live leads that share a phone number, with
// each copy's owner + status. Powered by get_duplicate_summary / get_duplicate_groups.
const ST = {
  new:             { ar: 'جديد',       en: 'New',             color: '#2F6BD3' },
  contacted:       { ar: 'تم التواصل', en: 'Contacted',       color: '#5A63C4' },
  following:       { ar: 'متابعة',     en: 'Following',        color: '#C9860A' },
  has_opportunity: { ar: 'لديه فرصة',  en: 'Has Opportunity', color: '#158A57' },
  disqualified:    { ar: 'غير مؤهل',   en: 'Disqualified',    color: '#6B7280' },
};
const stLabel = (s, isRTL) => (isRTL ? ST[s]?.ar : ST[s]?.en) || s || '—';
const stColor = (s) => ST[s]?.color || '#9CA3AF';

const FILTERS = [
  { key: 'all',    ar: 'الكل',          en: 'All' },
  { key: 'active', ar: 'فيها نشط',       en: 'Has active' },
  { key: 'opp',    ar: 'فيها فرصة',      en: 'Has opportunity' },
  { key: 'all_dq', ar: 'كلهم مرفوضين',  en: 'All disqualified' },
];

function Card({ label, value, color }) {
  return (
    <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark px-4 py-3 min-w-[130px]">
      <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">{label}</p>
      <p className="m-0 text-xl font-bold" style={{ color }}>{(value ?? 0).toLocaleString()}</p>
    </div>
  );
}

export default function DuplicatesTab({ lang, isRTL }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([
        supabase.rpc('get_duplicate_summary'),
        supabase.rpc('get_duplicate_groups', { p_filter: filter, p_limit: 1500 }),
      ]);
      if (s.error) throw s.error;
      if (g.error) throw g.error;
      setSummary(Array.isArray(s.data) ? s.data[0] : s.data);
      setRows(Array.isArray(g.data) ? g.data : []);
    } catch (err) {
      toast.error(isRTL ? `تعذّر تحميل التقرير: ${err.message || ''}` : `Failed to load: ${err.message || ''}`);
      setSummary(null); setRows([]);
    } finally { setLoading(false); }
  }, [filter, isRTL, toast]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    if (!rows.length) return;
    exportToCSV(rows.map(r => ({
      phone: r.phone, name: r.lead_name || '', copies: r.copies,
      detail: (r.detail || []).map(d => `${d.owner} — ${stLabel(d.status, isRTL)}`).join(' | '),
    })), [
      { header: isRTL ? 'الرقم' : 'Phone', key: 'phone' },
      { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
      { header: isRTL ? 'عدد النسخ' : 'Copies', key: 'copies' },
      { header: isRTL ? 'النسخ' : 'Copies detail', key: 'detail' },
    ], isRTL ? 'الأرقام-المكررة' : 'duplicate-leads');
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">
      {/* Summary cards */}
      <div className="flex flex-wrap gap-2.5">
        <Card label={isRTL ? 'أرقام مكرّرة' : 'Duplicate numbers'} value={summary?.total_numbers} color="#2F6BD3" />
        <Card label={isRTL ? 'إجمالي النسخ' : 'Total copies'} value={summary?.total_leads} color="#6B7280" />
        <Card label={isRTL ? 'كلهم مرفوضين' : 'All disqualified'} value={summary?.all_dq} color="#6B7280" />
        <Card label={isRTL ? 'نشط واحد + مرفوض' : 'One active + DQ'} value={summary?.one_active} color="#C9860A" />
        <Card label={isRTL ? 'أكتر من نشط' : 'Multiple active'} value={summary?.multi_active} color="#D6403B" />
        <Card label={isRTL ? 'فيها فرصة' : 'With opportunity'} value={summary?.with_opp} color="#158A57" />
      </div>

      {/* Filter + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
              filter === f.key ? 'bg-brand-500 text-white border-brand-500'
              : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark border-edge dark:border-edge-dark hover:text-content'}`}>
            {isRTL ? f.ar : f.en}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={load} className="h-8 px-3 flex items-center gap-1.5 text-xs rounded-lg bg-brand-500/10 text-brand-500 border border-brand-500/20 cursor-pointer hover:bg-brand-500/15">
          <RefreshCw size={13} /> {isRTL ? 'تحديث' : 'Refresh'}
        </button>
        <button onClick={handleExport} disabled={!rows.length} className="h-8 px-3 flex items-center gap-1.5 text-xs rounded-lg bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark cursor-pointer hover:text-content disabled:opacity-40">
          <Download size={13} /> {isRTL ? 'تصدير' : 'Export'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-x-auto">
        <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className={thCls}>{isRTL ? 'الرقم' : 'Phone'}</th>
              <th className={thCls}>{isRTL ? 'الاسم' : 'Name'}</th>
              <th className={thCls}>{isRTL ? 'النسخ' : '#'}</th>
              <th className={thCls}>{isRTL ? 'النسخ (المالك — الحالة)' : 'Copies (owner — status)'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'جاري التحميل…' : 'Loading…'}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد مكرّرات في هذا الفلتر' : 'No duplicates for this filter'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t border-edge/50 dark:border-edge-dark/50 hover:bg-surface-bg dark:hover:bg-brand-500/[0.04]">
                <td className="px-4 py-2.5 text-xs font-mono font-semibold text-content dark:text-content-dark whitespace-nowrap">{r.phone}</td>
                <td className="px-4 py-2.5 text-xs text-content dark:text-content-dark">{r.lead_name || '—'}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-brand-500">{r.copies}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(r.detail || []).map((d, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                        style={{ color: stColor(d.status), borderColor: stColor(d.status) + '55', backgroundColor: stColor(d.status) + '12' }}
                        title={`${d.owner} — ${stLabel(d.status, isRTL)}`}>
                        <span className="font-semibold text-content dark:text-content-dark">{d.owner}</span>
                        <span>·</span>
                        <span>{stLabel(d.status, isRTL)}</span>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length >= 1500 && (
        <p className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'عرض أول 1500 — صفِّ الفلتر أو صدّر للحصول على الكل.' : 'Showing first 1500 — filter or export for all.'}</p>
      )}
    </div>
  );
}
