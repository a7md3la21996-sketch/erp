import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { SmartFilter, applySmartFilters, KpiCard, Card, ExportButton, Pagination, Modal, ModalFooter, Button, Input, Select, Textarea } from '../../components/ui';
import { fmtMoney, fmtFull } from '../../utils/formatting';
import { thCls, tdCls } from '../../utils/tableStyles';
import {
  DollarSign, Clock, CheckCircle, Banknote, XCircle,
  Users, Building2, ArrowDownToLine, ArrowUpFromLine,
  ChevronDown, ChevronUp, BarChart3,
  CalendarClock, Plus, AlertTriangle, Check, Trash2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  MOCK_AGENT_COMMISSIONS,
  MOCK_COMPANY_COMMISSIONS,
  COMMISSION_STATUS,
} from '../../data/finance_mock_data';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import {
  fetchInstallments,
  createInstallment,
  updateInstallment,
  deleteInstallment,
  getInstallmentStats,
} from '../../services/commissionInstallmentsService';

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

// ── Installment status config ─────────────────────────────────────────────
const INSTALLMENT_STATUS = {
  pending:   { ar: 'معلق',   en: 'Pending',   color: '#D97706' },
  paid:      { ar: 'مدفوع',  en: 'Paid',      color: '#059669' },
  overdue:   { ar: 'متأخر',  en: 'Overdue',   color: '#EF4444' },
  cancelled: { ar: 'ملغي',   en: 'Cancelled', color: '#6B7280' },
};

// ── Empty installment form ────────────────────────────────────────────────
const EMPTY_INST_FORM = {
  deal_id: '', deal_name: '', developer_name: '',
  total_commission: '', installment_number: '1', installments_total: '1',
  amount: '', due_date: '', status: 'pending', notes: '',
};

// ── Tab definitions ───────────────────────────────────────────────────────
const TABS = [
  { id: 'agent', ar: 'عمولات السيلز', en: 'Agent Commissions', icon: Users },
  { id: 'company', ar: 'عمولات الشركة', en: 'Company Commissions', icon: Building2 },
  { id: 'by_developer', ar: 'عمولات بالمطور', en: 'By Developer', icon: BarChart3 },
  { id: 'installments', ar: 'أقساط العمولات', en: 'Commission Installments', icon: CalendarClock },
];

// ── Bar chart colors ─────────────────────────────────────────────────────
const DEV_CHART_COLORS = ['#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8', '#1B3347', '#3D6B8E', '#5A92B5', '#7AB0D0'];

// ── Component ─────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { auditFields, applyAuditFilters } = useAuditFilter('commission');

  const [tab, setTab] = useState('agent');
  const [agentPage, setAgentPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  // ── Expanded developers (for by_developer tab) ──
  const [expandedDevs, setExpandedDevs] = useState({});
  const toggleDev = (devKey) => setExpandedDevs(prev => ({ ...prev, [devKey]: !prev[devKey] }));

  // ── Installments state ──
  const [installments, setInstallments] = useState([]);
  const [instStats, setInstStats] = useState({ totalDue: 0, totalPaid: 0, totalOverdue: 0, upcomingThisMonth: 0 });
  const [instFilterStatus, setInstFilterStatus] = useState('');
  const [instFilterDev, setInstFilterDev] = useState('');
  const [instSearch, setInstSearch] = useState('');
  const [instPage, setInstPage] = useState(1);
  const [showInstForm, setShowInstForm] = useState(false);
  const [instForm, setInstForm] = useState({ ...EMPTY_INST_FORM });
  const [instFormErrors, setInstFormErrors] = useState({});

  // ── Load installments ──
  const refreshInstallments = useCallback(() => {
    const filters = {};
    if (instFilterStatus) filters.status = instFilterStatus;
    if (instFilterDev) filters.developer_name = instFilterDev;
    setInstallments(fetchInstallments(filters));
    setInstStats(getInstallmentStats());
  }, [instFilterStatus, instFilterDev]);

  useEffect(() => { refreshInstallments(); }, [refreshInstallments]);

  const filteredInstallments = useMemo(() => {
    if (!instSearch.trim()) return installments;
    const q = instSearch.toLowerCase();
    return installments.filter(r =>
      (r.deal_name || '').toLowerCase().includes(q) ||
      (r.developer_name || '').toLowerCase().includes(q) ||
      (r.deal_id || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  }, [installments, instSearch]);

  const instTotalPages = Math.max(1, Math.ceil(filteredInstallments.length / pageSize));
  const instSafePage = Math.min(instPage, instTotalPages);
  const pagedInstallments = filteredInstallments.slice((instSafePage - 1) * pageSize, instSafePage * pageSize);

  useEffect(() => { setInstPage(1); }, [instFilterStatus, instFilterDev, instSearch]);

  const instDevelopers = useMemo(() => {
    const all = fetchInstallments({});
    return [...new Set(all.map(i => i.developer_name).filter(Boolean))];
  }, [installments]); // eslint-disable-line react-hooks/exhaustive-deps

  const openInstForm = () => { setInstForm({ ...EMPTY_INST_FORM }); setInstFormErrors({}); setShowInstForm(true); };

  const handleInstFormChange = (field, value) => {
    setInstForm(prev => ({ ...prev, [field]: value }));
    if (instFormErrors[field]) setInstFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validateInstForm = () => {
    const errs = {};
    if (!instForm.deal_name.trim()) errs.deal_name = true;
    if (!instForm.developer_name.trim()) errs.developer_name = true;
    if (!instForm.amount || Number(instForm.amount) <= 0) errs.amount = true;
    if (!instForm.due_date) errs.due_date = true;
    setInstFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitInstForm = () => {
    if (!validateInstForm()) return;
    createInstallment({ ...instForm, amount: Number(instForm.amount), total_commission: Number(instForm.total_commission) || 0, installment_number: Number(instForm.installment_number) || 1, installments_total: Number(instForm.installments_total) || 1 });
    setShowInstForm(false);
    refreshInstallments();
  };

  const markInstPaid = (id) => { updateInstallment(id, { status: 'paid', paid_date: new Date().toISOString().slice(0, 10) }); refreshInstallments(); };
  const cancelInst = (id) => { updateInstallment(id, { status: 'cancelled' }); refreshInstallments(); };
  const removeInst = (id) => { deleteInstallment(id); refreshInstallments(); };

  // ── Developer summary (computed from company commissions) ──
  const devSummary = useMemo(() => {
    const map = {};
    companyData.forEach(r => {
      const key = r.developer_en || r.developer_ar || 'Unknown';
      if (!map[key]) {
        map[key] = {
          developer_ar: r.developer_ar || key,
          developer_en: r.developer_en || key,
          projects: new Set(),
          deals: [],
          totalCommission: 0,
          paid: 0,
          pending: 0,
        };
      }
      const entry = map[key];
      if (r.project_en) entry.projects.add(r.project_en);
      if (r.project_ar) entry.projects.add(r.project_ar);
      entry.deals.push(r);
      entry.totalCommission += r.amount || 0;
      if (r.status === 'paid') entry.paid += r.amount || 0;
      else entry.pending += r.amount || 0;
    });
    // Convert sets to counts — each project has both ar and en in the set, so divide by 2
    return Object.values(map)
      .map(d => ({ ...d, projectCount: Math.max(1, Math.ceil(d.projects.size / 2)), projects: undefined }))
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [companyData]);

  const devChartData = useMemo(() =>
    devSummary.slice(0, 8).map(d => ({
      name: lang === 'ar' ? d.developer_ar : d.developer_en,
      value: d.totalCommission,
    })),
    [devSummary, lang]
  );

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
      { id: 'date', label: 'التاريخ', labelEn: 'Date', type: 'date' },
      ...auditFields,
    ];
  }, [agentData, lang, auditFields]);

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
      { id: 'date', label: 'التاريخ', labelEn: 'Date', type: 'date' },
      ...auditFields,
    ];
  }, [companyData, lang, auditFields]);

  // ── Filtered data ──
  const filteredAgents = useMemo(() => {
    let d = applySmartFilters(agentData, agentFilters, agentFields);
    d = applyAuditFilters(d, agentFilters);
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
    d = applyAuditFilters(d, companyFilters);
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
  const agentTotalPages = Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const agentSafePage = Math.min(agentPage, agentTotalPages);
  const pagedAgents = filteredAgents.slice((agentSafePage - 1) * pageSize, agentSafePage * pageSize);

  const companyTotalPages = Math.max(1, Math.ceil(filteredCompany.length / pageSize));
  const companySafePage = Math.min(companyPage, companyTotalPages);
  const pagedCompany = filteredCompany.slice((companySafePage - 1) * pageSize, companySafePage * pageSize);

  useEffect(() => { setAgentPage(1); }, [agentFilters, agentSearch, pageSize]);
  useEffect(() => { setCompanyPage(1); }, [companyFilters, companySearch, pageSize]);

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

  // ── Installment status badge ──
  const InstStatusBadge = ({ status }) => {
    const s = INSTALLMENT_STATUS[status];
    if (!s) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${s.color}18`, color: s.color }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
        {lang === 'ar' ? s.ar : s.en}
      </span>
    );
  };

  // ── Form field helper ──
  const FormField = ({ label, error, children }) => (
    <div>
      <label className="block text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1">{label}</label>
      {children}
      {error && <p className="m-0 mt-0.5 text-[10px] text-red-500">{lang === 'ar' ? 'مطلوب' : 'Required'}</p>}
    </div>
  );

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
        {tab === 'installments' ? (
          <Button variant="primary" size="sm" onClick={openInstForm}>
            <Plus size={16} />
            {lang === 'ar' ? 'إضافة قسط' : 'Add Installment'}
          </Button>
        ) : (
          <ExportButton
            data={tab === 'agent' ? filteredAgents : tab === 'by_developer' ? devSummary.map(d => ({
              developer: lang === 'ar' ? d.developer_ar : d.developer_en,
              projects: d.projectCount,
              deals: d.deals.length,
              total_commission: d.totalCommission,
              paid: d.paid,
              pending: d.pending,
            })) : filteredCompany}
            filename={tab === 'agent' ? 'agent-commissions' : tab === 'by_developer' ? 'commissions-by-developer' : 'company-commissions'}
            title={lang === 'ar' ? 'العمولات' : 'Commissions'}
            columns={tab === 'agent' ? [
              { key: 'deal_ref', label: lang === 'ar' ? 'رقم الصفقة' : 'Deal Ref' },
              { key: lang === 'ar' ? 'agent_ar' : 'agent_en', label: lang === 'ar' ? 'السيلز' : 'Agent' },
              { key: 'amount', label: lang === 'ar' ? 'المبلغ' : 'Amount' },
              { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status' },
            ] : tab === 'by_developer' ? [
              { key: 'developer', label: lang === 'ar' ? 'المطور' : 'Developer' },
              { key: 'projects', label: lang === 'ar' ? 'المشاريع' : 'Projects' },
              { key: 'deals', label: lang === 'ar' ? 'الصفقات' : 'Deals' },
              { key: 'total_commission', label: lang === 'ar' ? 'إجمالي العمولة' : 'Total Commission' },
              { key: 'paid', label: lang === 'ar' ? 'مصروف' : 'Paid' },
              { key: 'pending', label: lang === 'ar' ? 'معلق' : 'Pending' },
            ] : [
              { key: 'deal_ref', label: lang === 'ar' ? 'رقم الصفقة' : 'Deal Ref' },
              { key: lang === 'ar' ? 'developer_ar' : 'developer_en', label: lang === 'ar' ? 'المطور' : 'Developer' },
              { key: 'amount', label: lang === 'ar' ? 'المبلغ' : 'Amount' },
              { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status' },
            ]}
          />
        )}
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

      {/* ══════════════ INSTALLMENTS TAB ══════════════ */}
      {tab === 'installments' && (
        <>
          {/* ── Installments KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <KpiCard icon={DollarSign} label={lang === 'ar' ? 'إجمالي المستحق' : 'Total Due'} value={fmtMoney(instStats.totalDue)} sub={`${fmtFull(instStats.totalDue)} EGP`} color="#D97706" />
            <KpiCard icon={CheckCircle} label={lang === 'ar' ? 'تم التحصيل' : 'Paid'} value={fmtMoney(instStats.totalPaid)} sub={`${fmtFull(instStats.totalPaid)} EGP`} color="#059669" />
            <KpiCard icon={AlertTriangle} label={lang === 'ar' ? 'متأخر' : 'Overdue'} value={fmtMoney(instStats.totalOverdue)} sub={`${fmtFull(instStats.totalOverdue)} EGP`} color="#EF4444" />
            <KpiCard icon={CalendarClock} label={lang === 'ar' ? 'مستحق هذا الشهر' : 'Upcoming This Month'} value={fmtMoney(instStats.upcomingThisMonth)} sub={`${fmtFull(instStats.upcomingThisMonth)} EGP`} color="#4A7AAB" />
          </div>

          {/* ── Installments Filters ── */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input placeholder={lang === 'ar' ? 'بحث...' : 'Search...'} value={instSearch} onChange={e => setInstSearch(e.target.value)} size="sm" className="!w-52" />
            <Select size="sm" value={instFilterStatus} onChange={e => setInstFilterStatus(e.target.value)} className="!w-40">
              <option value="">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              {Object.entries(INSTALLMENT_STATUS).map(([k, v]) => (<option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>))}
            </Select>
            <Select size="sm" value={instFilterDev} onChange={e => setInstFilterDev(e.target.value)} className="!w-48">
              <option value="">{lang === 'ar' ? 'كل المطورين' : 'All Developers'}</option>
              {instDevelopers.map(d => (<option key={d} value={d}>{d}</option>))}
            </Select>
            <span className="text-xs text-content-muted dark:text-content-muted-dark ms-auto">{filteredInstallments.length} {lang === 'ar' ? 'سجل' : 'records'}</span>
          </div>

          {/* ── Installments Desktop Table ── */}
          <div className="hidden md:block rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>#</th>
                    <th className={thCls}>{lang === 'ar' ? 'الصفقة' : 'Deal'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'المطور' : 'Developer'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'إجمالي العمولة' : 'Total Commission'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'القسط' : 'Installment'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'تاريخ الدفع' : 'Paid Date'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstallments.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">{lang === 'ar' ? 'لا توجد أقساط' : 'No installments found'}</td></tr>
                  )}
                  {pagedInstallments.map((r, i) => (
                    <tr key={r.id} className={rowCls(r.id)} onMouseEnter={() => setHoveredRow(r.id)} onMouseLeave={() => setHoveredRow(null)}>
                      <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{(instSafePage - 1) * pageSize + i + 1}</td>
                      <td className={tdCls + ' font-semibold'}>{r.deal_name}</td>
                      <td className={tdCls}>{r.developer_name}</td>
                      <td className={tdCls}>{fmtFull(r.total_commission)}</td>
                      <td className={tdCls}><span className="px-2 py-0.5 rounded bg-brand-500/[0.08] text-brand-500 text-xs font-mono font-semibold">{r.installment_number}/{r.installments_total}</span></td>
                      <td className={tdCls + ' font-bold'}>{fmtFull(r.amount)}</td>
                      <td className={tdCls + ' text-xs'}>{r.due_date}</td>
                      <td className={tdCls}><InstStatusBadge status={r.status} /></td>
                      <td className={tdCls + ' text-xs text-content-muted dark:text-content-muted-dark'}>{r.paid_date || '—'}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1">
                          {(r.status === 'pending' || r.status === 'overdue') && (
                            <button onClick={() => markInstPaid(r.id)} title={lang === 'ar' ? 'تم الدفع' : 'Mark as Paid'} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"><Check size={15} /></button>
                          )}
                          {r.status === 'pending' && (
                            <button onClick={() => cancelInst(r.id)} title={lang === 'ar' ? 'إلغاء' : 'Cancel'} className="p-1.5 rounded-md text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 transition-colors cursor-pointer"><XCircle size={15} /></button>
                          )}
                          {r.status === 'cancelled' && (
                            <button onClick={() => removeInst(r.id)} title={lang === 'ar' ? 'حذف' : 'Delete'} className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Installments Mobile Cards ── */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredInstallments.length === 0 ? (
              <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">{lang === 'ar' ? 'لا توجد أقساط' : 'No installments found'}</div>
            ) : pagedInstallments.map(r => (
              <div key={r.id} className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-content dark:text-content-dark">{r.deal_name}</span>
                  <InstStatusBadge status={r.status} />
                </div>
                <p className="m-0 mb-3 text-xs text-content-muted dark:text-content-muted-dark">{r.developer_name}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'القسط' : 'Installment'}</span>
                    <p className="m-0 mt-0.5 font-mono font-semibold text-brand-500">{r.installment_number}/{r.installments_total}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'المبلغ' : 'Amount'}</span>
                    <p className="m-0 mt-0.5 font-bold text-content dark:text-content-dark">{fmtFull(r.amount)}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الاستحقاق' : 'Due'}</span>
                    <p className="m-0 mt-0.5 font-semibold text-content dark:text-content-dark">{r.due_date}</p>
                  </div>
                  <div>
                    <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'إجمالي العمولة' : 'Total Commission'}</span>
                    <p className="m-0 mt-0.5 font-semibold text-content dark:text-content-dark">{fmtFull(r.total_commission)}</p>
                  </div>
                </div>
                {(r.status === 'pending' || r.status === 'overdue') && (
                  <div className="mt-3 pt-2 border-t border-edge dark:border-edge-dark">
                    <button onClick={() => markInstPaid(r.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-semibold hover:bg-emerald-500/20 transition-colors cursor-pointer">
                      <Check size={14} /> {lang === 'ar' ? 'تم الدفع' : 'Mark as Paid'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Installments Pagination ── */}
          <Pagination page={instSafePage} totalPages={instTotalPages} onPageChange={setInstPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setInstPage(1); }} totalItems={filteredInstallments.length} />

          {/* ── Installments Summary Bar ── */}
          <div className="mt-4 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className="font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الملخص' : 'Summary'}</span>
            <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'مستحق:' : 'Due:'} <span className="font-bold" style={{ color: '#D97706' }}>{fmtFull(instStats.totalDue)} EGP</span></span>
            <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'مدفوع:' : 'Paid:'} <span className="font-semibold" style={{ color: '#059669' }}>{fmtFull(instStats.totalPaid)} EGP</span></span>
            <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'متأخر:' : 'Overdue:'} <span className="font-semibold" style={{ color: '#EF4444' }}>{fmtFull(instStats.totalOverdue)} EGP</span></span>
            <span className="ms-auto text-content-muted dark:text-content-muted-dark">{filteredInstallments.length} {lang === 'ar' ? 'سجل' : 'records'}</span>
          </div>

          {/* ── Add Installment Modal ── */}
          <Modal open={showInstForm} onClose={() => setShowInstForm(false)} title={lang === 'ar' ? 'إضافة قسط عمولة' : 'Add Commission Installment'} width="max-w-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={lang === 'ar' ? 'اسم الصفقة *' : 'Deal Name *'} error={instFormErrors.deal_name}>
                <Input value={instForm.deal_name} onChange={e => handleInstFormChange('deal_name', e.target.value)} placeholder={lang === 'ar' ? 'مثال: شقة R5-201' : 'e.g. Unit R5-201'} size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'رقم الصفقة' : 'Deal ID'}>
                <Input value={instForm.deal_id} onChange={e => handleInstFormChange('deal_id', e.target.value)} placeholder={lang === 'ar' ? 'اختياري' : 'Optional'} size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'اسم المطور *' : 'Developer Name *'} error={instFormErrors.developer_name}>
                <Input value={instForm.developer_name} onChange={e => handleInstFormChange('developer_name', e.target.value)} placeholder={lang === 'ar' ? 'مثال: ماونتن فيو' : 'e.g. Mountain View'} size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'إجمالي العمولة' : 'Total Commission'}>
                <Input type="number" value={instForm.total_commission} onChange={e => handleInstFormChange('total_commission', e.target.value)} placeholder="0" size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'رقم القسط' : 'Installment #'}>
                <Input type="number" min="1" value={instForm.installment_number} onChange={e => handleInstFormChange('installment_number', e.target.value)} size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'من إجمالي أقساط' : 'Of Total Installments'}>
                <Input type="number" min="1" value={instForm.installments_total} onChange={e => handleInstFormChange('installments_total', e.target.value)} size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'مبلغ القسط *' : 'Installment Amount *'} error={instFormErrors.amount}>
                <Input type="number" value={instForm.amount} onChange={e => handleInstFormChange('amount', e.target.value)} placeholder="0" size="sm" />
              </FormField>
              <FormField label={lang === 'ar' ? 'تاريخ الاستحقاق *' : 'Due Date *'} error={instFormErrors.due_date}>
                <Input type="date" value={instForm.due_date} onChange={e => handleInstFormChange('due_date', e.target.value)} size="sm" />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label={lang === 'ar' ? 'ملاحظات' : 'Notes'}>
                  <Textarea value={instForm.notes} onChange={e => handleInstFormChange('notes', e.target.value)} placeholder={lang === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'} size="sm" />
                </FormField>
              </div>
            </div>
            <ModalFooter>
              <Button variant="secondary" size="sm" onClick={() => setShowInstForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" onClick={submitInstForm}><Plus size={16} /> {lang === 'ar' ? 'إضافة القسط' : 'Add Installment'}</Button>
            </ModalFooter>
          </Modal>
        </>
      )}

      {/* ══════════════ AGENT / COMPANY / BY_DEVELOPER TABS ══════════════ */}
      {tab !== 'installments' && <>

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
      {tab !== 'by_developer' && <div className="mb-4">
        <SmartFilter
          fields={tab === 'agent' ? agentFields : companyFields}
          filters={tab === 'agent' ? agentFilters : companyFilters}
          onFiltersChange={tab === 'agent' ? setAgentFilters : setCompanyFilters}
          search={tab === 'agent' ? agentSearch : companySearch}
          onSearchChange={tab === 'agent' ? setAgentSearch : setCompanySearch}
          searchPlaceholder={lang === 'ar' ? 'بحث...' : 'Search...'}
          resultsCount={tab === 'agent' ? filteredAgents.length : filteredCompany.length}
        />
      </div>}

      {/* ── By Developer Tab (desktop + mobile) ── */}
      {tab === 'by_developer' && (
        <div className="space-y-5">
          {/* ── Bar Chart ── */}
          {devChartData.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-content dark:text-content-dark mb-4">
                {lang === 'ar' ? 'أعلى المطورين حسب العمولة' : 'Top Developers by Commission'}
              </h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={devChartData} layout="vertical" margin={{ left: isRTL ? 10 : 10, right: isRTL ? 10 : 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis type="number" tickFormatter={(v) => fmtMoney(v)} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip
                      formatter={(v) => [fmtFull(v) + ' EGP', lang === 'ar' ? 'العمولة' : 'Commission']}
                      contentStyle={{ background: isDark ? '#1e293b' : '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {devChartData.map((_, idx) => (
                        <Cell key={idx} fill={DEV_CHART_COLORS[idx % DEV_CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* ── Developer Summary Table ── */}
          <div className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls} style={{ width: 40 }}></th>
                    <th className={thCls}>{lang === 'ar' ? 'المطور' : 'Developer'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'المشاريع' : 'Projects'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'الصفقات' : 'Deals'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'إجمالي العمولة' : 'Total Commission'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'مصروف' : 'Paid'}</th>
                    <th className={thCls}>{lang === 'ar' ? 'معلق' : 'Pending'}</th>
                  </tr>
                </thead>
                <tbody>
                  {devSummary.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
                        {lang === 'ar' ? 'لا توجد بيانات — أضف عمولات شركة أولاً' : 'No data — add company commissions first'}
                      </td>
                    </tr>
                  )}
                  {devSummary.map((dev, idx) => {
                    const devKey = dev.developer_en;
                    const isExpanded = !!expandedDevs[devKey];
                    return (
                      <Fragment key={devKey}>
                        <tr
                          className={`cursor-pointer transition-colors duration-100 ${isExpanded ? 'bg-brand-500/[0.04] dark:bg-brand-500/[0.08]' : 'hover:bg-brand-500/[0.04] dark:hover:bg-brand-500/[0.08]'}`}
                          onClick={() => toggleDev(devKey)}
                        >
                          <td className={tdCls + ' text-center'}>
                            {isExpanded ? <ChevronUp size={16} className="text-brand-500 inline" /> : <ChevronDown size={16} className="text-content-muted dark:text-content-muted-dark inline" />}
                          </td>
                          <td className={tdCls + ' font-bold'}>{lang === 'ar' ? dev.developer_ar : dev.developer_en}</td>
                          <td className={tdCls}>
                            <span className="px-2 py-0.5 rounded bg-brand-500/[0.08] text-brand-500 text-xs font-semibold">{dev.projectCount}</span>
                          </td>
                          <td className={tdCls}>
                            <span className="px-2 py-0.5 rounded bg-brand-500/[0.08] text-brand-500 text-xs font-semibold">{dev.deals.length}</span>
                          </td>
                          <td className={tdCls + ' font-bold'}>{fmtFull(dev.totalCommission)} <span className="text-[10px] text-content-muted dark:text-content-muted-dark">EGP</span></td>
                          <td className={tdCls}>
                            <span className="font-semibold" style={{ color: '#2B4C6F' }}>{fmtFull(dev.paid)}</span>
                          </td>
                          <td className={tdCls}>
                            <span className="font-semibold" style={{ color: '#6B8DB5' }}>{fmtFull(dev.pending)}</span>
                          </td>
                        </tr>
                        {isExpanded && dev.deals.map((deal) => (
                          <tr key={deal.id} className="bg-gray-50/60 dark:bg-white/[0.02]">
                            <td className={tdCls}></td>
                            <td className={tdCls + ' text-xs text-content-muted dark:text-content-muted-dark ps-8'}>
                              {lang === 'ar' ? deal.project_ar : deal.project_en}
                            </td>
                            <td className={tdCls + ' text-xs'}>
                              <span className="px-2 py-0.5 rounded bg-brand-500/[0.08] text-brand-500 font-mono font-semibold">{deal.deal_ref}</span>
                            </td>
                            <td className={tdCls + ' text-xs'}>{fmtFull(deal.deal_value)}</td>
                            <td className={tdCls + ' text-xs font-semibold'}>{fmtFull(deal.amount)} EGP</td>
                            <td className={tdCls + ' text-xs'}><StatusBadge status={deal.status} /></td>
                            <td className={tdCls + ' text-xs text-content-muted dark:text-content-muted-dark'}>{deal.date}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile cards for by_developer ── */}
          <div className="md:hidden flex flex-col gap-3">
            {devSummary.length === 0 ? (
              <div className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
                {lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}
              </div>
            ) : devSummary.map((dev) => {
              const devKey = dev.developer_en;
              const isExpanded = !!expandedDevs[devKey];
              return (
                <div key={devKey} className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-4">
                  <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => toggleDev(devKey)}>
                    <span className="font-bold text-sm text-content dark:text-content-dark">
                      {lang === 'ar' ? dev.developer_ar : dev.developer_en}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-brand-500" /> : <ChevronDown size={16} className="text-content-muted" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'المشاريع' : 'Projects'}</span>
                      <p className="m-0 mt-0.5 font-bold text-content dark:text-content-dark">{dev.projectCount}</p>
                    </div>
                    <div>
                      <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الصفقات' : 'Deals'}</span>
                      <p className="m-0 mt-0.5 font-bold text-content dark:text-content-dark">{dev.deals.length}</p>
                    </div>
                    <div>
                      <span className="text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الإجمالي' : 'Total'}</span>
                      <p className="m-0 mt-0.5 font-bold text-content dark:text-content-dark">{fmtMoney(dev.totalCommission)}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span style={{ color: '#2B4C6F' }} className="font-semibold">{lang === 'ar' ? 'مصروف:' : 'Paid:'} {fmtFull(dev.paid)}</span>
                    <span style={{ color: '#6B8DB5' }} className="font-semibold">{lang === 'ar' ? 'معلق:' : 'Pending:'} {fmtFull(dev.pending)}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-edge dark:border-edge-dark space-y-2">
                      {dev.deals.map(deal => (
                        <div key={deal.id} className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono text-brand-500 font-semibold">{deal.deal_ref}</span>
                            <span className="ms-2 text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? deal.project_ar : deal.project_en}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{fmtFull(deal.amount)}</span>
                            <StatusBadge status={deal.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Table (desktop) ── */}
      {(tab === 'agent' || tab === 'company') && <div className="hidden md:block rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden">
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
                    <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{(agentSafePage - 1) * pageSize + i + 1}</td>
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
                    <td className={tdCls + ' text-content-muted dark:text-content-muted-dark text-xs'}>{(companySafePage - 1) * pageSize + i + 1}</td>
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
      </div>}

      {/* ── Pagination ── */}
      {tab === 'agent' && (
        <Pagination
          page={agentSafePage}
          totalPages={agentTotalPages}
          onPageChange={setAgentPage}
          pageSize={pageSize}
          onPageSizeChange={(s) => { setPageSize(s); setAgentPage(1); setCompanyPage(1); }}
          totalItems={filteredAgents.length}
        />
      )}
      {tab === 'company' && (
        <Pagination
          page={companySafePage}
          totalPages={companyTotalPages}
          onPageChange={setCompanyPage}
          pageSize={pageSize}
          onPageSizeChange={(s) => { setPageSize(s); setAgentPage(1); setCompanyPage(1); }}
          totalItems={filteredCompany.length}
        />
      )}

      {/* ── Mobile Card View ── */}
      {tab !== 'by_developer' && <div className="md:hidden flex flex-col gap-3">
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
      </div>}



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
          {tab === 'agent' ? filteredAgents.length : tab === 'by_developer' ? devSummary.length : filteredCompany.length}{' '}
          {lang === 'ar' ? (tab === 'by_developer' ? 'مطور' : 'سجل') : (tab === 'by_developer' ? 'developers' : 'records')}
        </span>
      </div>

      </>}
    </div>
  );
}
