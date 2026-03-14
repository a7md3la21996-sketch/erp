import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { SmartFilter, applySmartFilters, KpiCard, Card, ExportButton } from '../../components/ui';
import { fmtMoney, fmtFull } from '../../utils/formatting';
import { thCls, tdCls } from '../../utils/tableStyles';
import {
  DollarSign, Clock, CheckCircle, Banknote, XCircle,
  Users, Building2, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import {
  MOCK_AGENT_COMMISSIONS,
  MOCK_COMPANY_COMMISSIONS,
  COMMISSION_STATUS,
} from '../../data/finance_mock_data';

// ── Storage keys ──────────────────────────────────────────────────────────
const STORAGE_KEY_AGENT = 'platform_agent_commissions';
const STORAGE_KEY_COMPANY = 'platform_company_commissions';

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtRate = (row) => {
  if (row.calc_method === 'per_million') return `${fmtFull(row.rate)}/M`;
  if (typeof row.rate === 'number' && row.rate < 1) return `${(row.rate * 100).toFixed(1)}%`;
  return `${(row.rate * 100).toFixed(1)}%`;
};

const loadData = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [...fallback];
};

const saveData = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
};

// ── Tab definitions ───────────────────────────────────────────────────────
const TABS = [
  { id: 'agent', ar: 'عمولات السيلز', en: 'Agent Commissions', icon: Users },
  { id: 'company', ar: 'عمولات الشركة', en: 'Company Commissions', icon: Building2 },
];

// ── Component ─────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState('agent');
  const [agentPage, setAgentPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const PAGE_SIZE = 25;

  // ── Data state with localStorage persistence ──
  const [agentData, setAgentData] = useState(() => loadData(STORAGE_KEY_AGENT, MOCK_AGENT_COMMISSIONS));
  const [companyData, setCompanyData] = useState(() => loadData(STORAGE_KEY_COMPANY, MOCK_COMPANY_COMMISSIONS));

  // ── Filter state ──
  const [agentSearch, setAgentSearch] = useState('');
  const [agentFilters, setAgentFilters] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [companyFilters, setCompanyFilters] = useState([]);

  // ── Hover row ──
  const [hoveredRow, setHoveredRow] = useState(null);

  // ── Filter field definitions ──
  const statusOptions = Object.entries(COMMISSION_STATUS).map(([k, v]) => ({
    value: k,
    label: lang === 'ar' ? v.ar : v.en,
    labelEn: v.en,
  }));

  const agentFields = useMemo(() => {
    const agents = [...new Set(agentData.map(a => lang === 'ar' ? a.agent_ar : a.agent_en))];
    return [
      {
        id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
        options: statusOptions,
      },
      {
        id: lang === 'ar' ? 'agent_ar' : 'agent_en',
        label: 'السيلز', labelEn: 'Agent', type: 'select',
        options: agents.map(a => ({ value: a, label: a, labelEn: a })),
      },
    ];
  }, [agentData, lang]);

  const companyFields = useMemo(() => {
    const devs = [...new Set(companyData.map(c => lang === 'ar' ? c.developer_ar : c.developer_en))];
    return [
      {
        id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
        options: statusOptions,
      },
      {
        id: lang === 'ar' ? 'developer_ar' : 'developer_en',
        label: 'المطور', labelEn: 'Developer', type: 'select',
        options: devs.map(d => ({ value: d, label: d, labelEn: d })),
      },
    ];
  }, [companyData, lang]);

  // ── Filtered data ──
  const filteredAgents = useMemo(() => {
    let d = applySmartFilters(agentData, agentFilters, agentFields);
    if (agentSearch.trim()) {
      const q = agentSearch.toLowerCase();
      d = d.filter(r =>
        r.agent_ar.toLowerCase().includes(q) ||
        r.agent_en.toLowerCase().includes(q) ||
        r.deal_ref.toLowerCase().includes(q)
      );
    }
    return d;
  }, [agentData, agentFilters, agentFields, agentSearch]);

  const filteredCompany = useMemo(() => {
    let d = applySmartFilters(companyData, companyFilters, companyFields);
    if (companySearch.trim()) {
      const q = companySearch.toLowerCase();
      d = d.filter(r =>
        r.developer_ar.toLowerCase().includes(q) ||
        r.developer_en.toLowerCase().includes(q) ||
        r.project_ar.toLowerCase().includes(q) ||
        r.project_en.toLowerCase().includes(q) ||
        r.deal_ref.toLowerCase().includes(q)
      );
    }
    return d;
  }, [companyData, companyFilters, companyFields, companySearch]);

  // ── Pagination ──
  const agentTotalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const agentSafePage = Math.min(agentPage, agentTotalPages);
  const pagedAgents = filteredAgents.slice((agentSafePage - 1) * PAGE_SIZE, agentSafePage * PAGE_SIZE);

  const companyTotalPages = Math.max(1, Math.ceil(filteredCompany.length / PAGE_SIZE));
  const companySafePage = Math.min(companyPage, companyTotalPages);
  const pagedCompany = filteredCompany.slice((companySafePage - 1) * PAGE_SIZE, companySafePage * PAGE_SIZE);

  useEffect(() => { setAgentPage(1); }, [agentFilters, agentSearch]);
  useEffect(() => { setCompanyPage(1); }, [companyFilters, companySearch]);

  // ── KPI helpers ──
  const calcKpis = (data) => {
    const total = data.reduce((s, r) => s + r.amount, 0);
    const pending = data.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
    const approved = data.filter(r => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
    const paid = data.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
    return { total, pending, approved, paid };
  };

  const agentKpis = calcKpis(filteredAgents);
  const companyKpis = calcKpis(filteredCompany);
  const kpis = tab === 'agent' ? agentKpis : companyKpis;

  // ── Status badge ──
  const StatusBadge = ({ status }) => {
    const s = COMMISSION_STATUS[status];
    if (!s) return null;
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ background: `${s.color}18`, color: s.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
        {lang === 'ar' ? s.ar : s.en}
      </span>
    );
  };

  // ── Row hover ──
  const rowCls = (id) =>
    `transition-colors duration-100 cursor-pointer ${hoveredRow === id ? 'bg-brand-500/[0.04] dark:bg-brand-500/[0.08]' : ''}`;

  // ──────────────── RENDER ────────────────
  return (
    <div className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <DollarSign size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content dark:text-content-dark m-0">
              {lang === 'ar' ? 'العمولات' : 'Commissions'}
            </h1>
            <p className="text-xs text-content-muted dark:text-content-muted-dark mt-0 m-0">
              {lang === 'ar' ? 'إدارة عمولات السيلز والمطورين' : 'Manage agent & developer commissions'}
            </p>
          </div>
        </div>
        <ExportButton
          data={tab === 'agent' ? filteredAgents : filteredCompany}
          filename={tab === 'agent' ? 'agent-commissions' : 'company-commissions'}
          title={lang === 'ar' ? 'العمولات' : 'Commissions'}
          columns={tab === 'agent' ? [
            { key: 'deal_ref', label: lang === 'ar' ? 'رقم الصفقة' : 'Deal Ref' },
            { key: lang === 'ar' ? 'agent_ar' : 'agent_en', label: lang === 'ar' ? 'السيلز' : 'Agent' },
            { key: 'amount', label: lang === 'ar' ? 'المبلغ' : 'Amount' },
            { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status' },
          ] : [
            { key: 'deal_ref', label: lang === 'ar' ? 'رقم الصفقة' : 'Deal Ref' },
            { key: lang === 'ar' ? 'developer_ar' : 'developer_en', label: lang === 'ar' ? 'المطور' : 'Developer' },
            { key: 'amount', label: lang === 'ar' ? 'المبلغ' : 'Amount' },
            { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status' },
          ]}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 bg-surface-card dark:bg-surface-card-dark rounded-xl p-1 border border-edge dark:border-edge-dark w-full md:w-fit overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-brand-500/[0.08]'
              }`}
            >
              <Icon size={16} />
              {lang === 'ar' ? t.ar : t.en}
            </button>
          );
        })}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon={DollarSign}
          label={lang === 'ar' ? 'إجمالي العمولات' : 'Total Commissions'}
          value={fmtMoney(kpis.total)}
          sub={`${fmtFull(kpis.total)} EGP`}
          color="#4A7AAB"
        />
        <KpiCard
          icon={Clock}
          label={lang === 'ar' ? 'معلق' : 'Pending'}
          value={fmtMoney(kpis.pending)}
          sub={`${fmtFull(kpis.pending)} EGP`}
          color="#6B8DB5"
        />
        <KpiCard
          icon={CheckCircle}
          label={lang === 'ar' ? 'معتمد' : 'Approved'}
          value={fmtMoney(kpis.approved)}
          sub={`${fmtFull(kpis.approved)} EGP`}
          color="#4A7AAB"
        />
        <KpiCard
          icon={Banknote}
          label={lang === 'ar' ? 'مصروف' : 'Paid'}
          value={fmtMoney(kpis.paid)}
          sub={`${fmtFull(kpis.paid)} EGP`}
          color="#2B4C6F"
        />
      </div>

      {/* ── SmartFilter ── */}
      <div className="mb-4">
        <SmartFilter
          fields={tab === 'agent' ? agentFields : companyFields}
          filters={tab === 'agent' ? agentFilters : companyFilters}
          onFiltersChange={tab === 'agent' ? setAgentFilters : setCompanyFilters}
          search={tab === 'agent' ? agentSearch : companySearch}
          onSearchChange={tab === 'agent' ? setAgentSearch : setCompanySearch}
          searchPlaceholder={lang === 'ar' ? 'بحث...' : 'Search...'}
          resultsCount={tab === 'agent' ? filteredAgents.length : filteredCompany.length}
        />
      </div>

      {/* ── Table (desktop) ── */}
      <div className="hidden md:block rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'agent' ? (
            /* ── Agent Commissions Table ── */
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>{lang === 'ar' ? 'السيلز' : 'Agent'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'رقم الصفقة' : 'Deal Ref'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'قيمة الصفقة' : 'Deal Value'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'المعدل' : 'Rate'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'مبلغ العمولة' : 'Commission'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
                      {lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}
                    </td>
                  </tr>
                )}
                {pagedAgents.map((r, i) => (
                  <tr
                    key={r.id}
                    className={rowCls(r.id)}
                    onMouseEnter={() => setHoveredRow(r.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{(agentSafePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className={tdCls + ' font-semibold'}>{lang === 'ar' ? r.agent_ar : r.agent_en}</td>
                    <td className={tdCls}>
                      <span className="px-2 py-0.5 rounded bg-brand-500/[0.08] text-brand-500 text-xs font-mono font-semibold">{r.deal_ref}</span>
                    </td>
                    <td className={tdCls}>{fmtFull(r.deal_value)}</td>
                    <td className={tdCls}>{fmtRate(r)}</td>
                    <td className={tdCls + ' font-bold'}>{fmtFull(r.amount)}</td>
                    <td className={tdCls}><StatusBadge status={r.status} /></td>
                    <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ── Company Commissions Table ── */
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>{lang === 'ar' ? 'المطور' : 'Developer'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'المشروع' : 'Project'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'رقم الصفقة' : 'Deal Ref'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'قيمة الصفقة' : 'Deal Value'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'النسبة' : 'Rate'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'مبلغ العمولة' : 'Commission'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'تم التحصيل' : 'Collected'}</th>
                  <th className={thCls}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompany.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
                      {lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}
                    </td>
                  </tr>
                )}
                {pagedCompany.map((r, i) => (
                  <tr
                    key={r.id}
                    className={rowCls(r.id)}
                    onMouseEnter={() => setHoveredRow(r.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{(companySafePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className={tdCls + ' font-semibold'}>{lang === 'ar' ? r.developer_ar : r.developer_en}</td>
                    <td className={tdCls}>{lang === 'ar' ? r.project_ar : r.project_en}</td>
                    <td className={tdCls}>
                      <span className="px-2 py-0.5 rounded bg-brand-500/[0.08] text-brand-500 text-xs font-mono font-semibold">{r.deal_ref}</span>
                    </td>
                    <td className={tdCls}>{fmtFull(r.deal_value)}</td>
                    <td className={tdCls}>{(r.rate * 100).toFixed(1)}%</td>
                    <td className={tdCls + ' font-bold'}>{fmtFull(r.amount)}</td>
                    <td className={tdCls}><StatusBadge status={r.status} /></td>
                    <td className={tdCls}>
                      {r.collected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#2B4C6F' }}>
                          <ArrowDownToLine size={14} />
                          {lang === 'ar' ? 'نعم' : 'Yes'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                          <Clock size={14} />
                          {lang === 'ar' ? 'لا' : 'No'}
                        </span>
                      )}
                    </td>
                    <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Pagination (desktop) ── */}
      {tab === 'agent' && agentTotalPages > 1 && (
        <div className="hidden md:flex justify-center items-center gap-2 py-4">
          <button
            disabled={agentSafePage === 1}
            onClick={() => setAgentPage(p => p - 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${agentSafePage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? '← السابق' : '← Prev'}
          </button>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${agentSafePage} من ${agentTotalPages}` : `${agentSafePage} of ${agentTotalPages}`}
          </span>
          <button
            disabled={agentSafePage === agentTotalPages}
            onClick={() => setAgentPage(p => p + 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${agentSafePage === agentTotalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}
      {tab === 'company' && companyTotalPages > 1 && (
        <div className="hidden md:flex justify-center items-center gap-2 py-4">
          <button
            disabled={companySafePage === 1}
            onClick={() => setCompanyPage(p => p - 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${companySafePage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? '← السابق' : '← Prev'}
          </button>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${companySafePage} من ${companyTotalPages}` : `${companySafePage} of ${companyTotalPages}`}
          </span>
          <button
            disabled={companySafePage === companyTotalPages}
            onClick={() => setCompanyPage(p => p + 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${companySafePage === companyTotalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}

      {/* ── Mobile Card View ── */}
      <div className="md:hidden flex flex-col gap-3">
        {tab === 'agent' ? (
          filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
              {lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}
            </div>
          ) : (
            pagedAgents.map(r => (
              <div
                key={r.id}
                className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-content dark:text-content-dark">
                    {lang === 'ar' ? r.agent_ar : r.agent_en}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الصفقة' : 'Deal'}</span>
                    <p className="m-0 mt-0.5 font-mono font-semibold text-brand-500">{r.deal_ref}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'قيمة الصفقة' : 'Deal Value'}</span>
                    <p className="m-0 mt-0.5 font-semibold text-content dark:text-content-dark">{fmtFull(r.deal_value)}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'المعدل' : 'Rate'}</span>
                    <p className="m-0 mt-0.5 font-semibold text-content dark:text-content-dark">{fmtRate(r)}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'العمولة' : 'Commission'}</span>
                    <p className="m-0 mt-0.5 font-bold text-content dark:text-content-dark">{fmtFull(r.amount)}</p>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-content-muted dark:text-content-muted-dark">{r.date}</div>
              </div>
            ))
          )
        ) : (
          filteredCompany.length === 0 ? (
            <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
              {lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}
            </div>
          ) : (
            pagedCompany.map(r => (
              <div
                key={r.id}
                className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-content dark:text-content-dark">
                    {lang === 'ar' ? r.developer_ar : r.developer_en}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="m-0 mb-3 text-xs text-content-muted dark:text-content-muted-dark">
                  {lang === 'ar' ? r.project_ar : r.project_en}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الصفقة' : 'Deal'}</span>
                    <p className="m-0 mt-0.5 font-mono font-semibold text-brand-500">{r.deal_ref}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'قيمة الصفقة' : 'Deal Value'}</span>
                    <p className="m-0 mt-0.5 font-semibold text-content dark:text-content-dark">{fmtFull(r.deal_value)}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'النسبة' : 'Rate'}</span>
                    <p className="m-0 mt-0.5 font-semibold text-content dark:text-content-dark">{(r.rate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'العمولة' : 'Commission'}</span>
                    <p className="m-0 mt-0.5 font-bold text-content dark:text-content-dark">{fmtFull(r.amount)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-edge dark:border-edge-dark">
                  <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{r.date}</span>
                  <span className="text-[11px] font-semibold" style={{ color: r.collected ? '#2B4C6F' : '#6B8DB5' }}>
                    {r.collected
                      ? (lang === 'ar' ? 'تم التحصيل' : 'Collected')
                      : (lang === 'ar' ? 'لم يُحصّل' : 'Not Collected')}
                  </span>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* ── Pagination (mobile) ── */}
      {tab === 'agent' && agentTotalPages > 1 && (
        <div className="md:hidden flex justify-center items-center gap-2 py-4">
          <button
            disabled={agentSafePage === 1}
            onClick={() => setAgentPage(p => p - 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${agentSafePage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? '← السابق' : '← Prev'}
          </button>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${agentSafePage} من ${agentTotalPages}` : `${agentSafePage} of ${agentTotalPages}`}
          </span>
          <button
            disabled={agentSafePage === agentTotalPages}
            onClick={() => setAgentPage(p => p + 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${agentSafePage === agentTotalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}
      {tab === 'company' && companyTotalPages > 1 && (
        <div className="md:hidden flex justify-center items-center gap-2 py-4">
          <button
            disabled={companySafePage === 1}
            onClick={() => setCompanyPage(p => p - 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${companySafePage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? '← السابق' : '← Prev'}
          </button>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${companySafePage} من ${companyTotalPages}` : `${companySafePage} of ${companyTotalPages}`}
          </span>
          <button
            disabled={companySafePage === companyTotalPages}
            onClick={() => setCompanyPage(p => p + 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${companySafePage === companyTotalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-500/[0.08] cursor-pointer'} text-content dark:text-content-dark`}
          >
            {isRTL ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}

      {/* ── Summary Bar ── */}
      <div className="mt-4 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className="font-bold text-content dark:text-content-dark">
          {lang === 'ar' ? 'الملخص' : 'Summary'}
        </span>
        <span className="text-content-muted dark:text-content-muted-dark">
          {lang === 'ar' ? 'إجمالي:' : 'Total:'}{' '}
          <span className="font-bold text-content dark:text-content-dark">{fmtFull(kpis.total)} EGP</span>
        </span>
        <span className="text-content-muted dark:text-content-muted-dark">
          {lang === 'ar' ? 'معلق:' : 'Pending:'}{' '}
          <span className="font-semibold" style={{ color: '#6B8DB5' }}>{fmtFull(kpis.pending)} EGP</span>
        </span>
        <span className="text-content-muted dark:text-content-muted-dark">
          {lang === 'ar' ? 'معتمد:' : 'Approved:'}{' '}
          <span className="font-semibold" style={{ color: '#4A7AAB' }}>{fmtFull(kpis.approved)} EGP</span>
        </span>
        <span className="text-content-muted dark:text-content-muted-dark">
          {lang === 'ar' ? 'مصروف:' : 'Paid:'}{' '}
          <span className="font-semibold" style={{ color: '#2B4C6F' }}>{fmtFull(kpis.paid)} EGP</span>
        </span>
        <span className="ms-auto text-content-muted dark:text-content-muted-dark">
          {tab === 'agent' ? filteredAgents.length : filteredCompany.length}{' '}
          {lang === 'ar' ? 'سجل' : 'records'}
        </span>
      </div>
    </div>
  );
}
