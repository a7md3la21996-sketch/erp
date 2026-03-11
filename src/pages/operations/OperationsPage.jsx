import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart2, FileCheck, Banknote, KeyRound, Headphones,
  AlertTriangle, Clock, CheckCircle, Plus, Search,
  DollarSign, TrendingUp, PieChart, Building2,
  Star, Phone, MessageSquare, FileText, Eye, ArrowRight,
  X, ClipboardCheck, Wrench, HelpCircle,
  Edit3, AlertCircle,
} from 'lucide-react';
import {
  DEAL_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, HANDOVER_STATUS_CONFIG,
  TICKET_STATUS_CONFIG, TICKET_TYPE_CONFIG, PRIORITY_CONFIG, DOCUMENT_CHECKLIST,
  MOCK_OPS_DEALS, MOCK_INSTALLMENTS, MOCK_HANDOVERS, MOCK_TICKETS,
  MOCK_OPS_ACTIVITY, fmtMoney, fmtMoneyShort, daysSince, daysUntil,
} from '../../data/operations_mock_data';
import { getWonDeals } from '../../services/dealsService';
import { useTheme } from '../../contexts/ThemeContext';
import KpiCard from '../../components/ui/KpiCard';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import Input, { Select } from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal, { ModalFooter } from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import ExportButton from '../../components/ui/ExportButton';

// ── Tabs ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',     ar: 'نظرة عامة',         en: 'Overview',        Icon: BarChart2 },
  { id: 'deals',        ar: 'معالجة الصفقات',     en: 'Deal Processing', Icon: FileCheck },
  { id: 'payments',     ar: 'المدفوعات',          en: 'Payments',        Icon: Banknote },
  { id: 'handover',     ar: 'التسليمات',          en: 'Handover',        Icon: KeyRound },
  { id: 'after_sales',  ar: 'خدمة ما بعد البيع',  en: 'After-Sales',     Icon: Headphones },
];

// ── Activity type icons & colors ────────────────────────────────────────
const ACT_TYPE = {
  deal_created:       { icon: Plus,         color: '#4A7AAB' },
  deal_status_change: { icon: ArrowRight,   color: '#2B4C6F' },
  payment_received:   { icon: DollarSign,   color: '#1B3347' },
  ticket_opened:      { icon: AlertCircle,  color: '#EF4444' },
  ticket_resolved:    { icon: CheckCircle,  color: '#4A7AAB' },
  handover_update:    { icon: KeyRound,     color: '#6B8DB5' },
  document_uploaded:  { icon: FileText,     color: '#8BA8C8' },
};

const TICKET_TYPE_ICONS = { complaint: AlertTriangle, maintenance: Wrench, inquiry: HelpCircle, modification: Edit3 };

// ── initials helper ─────────────────────────────────────────────────────
const initials = (n) => (n || '').trim().split(' ').map(w => w[0]).slice(0, 2).join('') || '?';
const ACOLORS = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8'];


function HandoverCard({ ho, isRTL, isDark }) {
  const [cardHov, setCardHov] = useState(false);
  const hCfg = HANDOVER_STATUS_CONFIG[ho.status] || {};
  const dLeft = daysUntil(ho.expected_handover);
  return (
    <div
      onMouseEnter={() => setCardHov(true)}
      onMouseLeave={() => setCardHov(false)}
      className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-5 transition-all duration-200"
      style={{
        borderColor: cardHov ? `${hCfg.color}60` : undefined,
        transform: cardHov ? 'translateY(-2px)' : 'none',
        boxShadow: cardHov ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div className={`flex justify-between items-start mb-3.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h4 className="m-0 text-[15px] font-bold text-content dark:text-content-dark">{isRTL ? ho.client_ar : ho.client_en}</h4>
          <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">{ho.deal_number} — {ho.unit_code}</p>
        </div>
        <StatusBadgeStatic status={ho.status} config={HANDOVER_STATUS_CONFIG} isRTL={isRTL} />
      </div>
      {[
        [isRTL ? 'المشروع' : 'Project', isRTL ? ho.project_ar : ho.project_en],
        [isRTL ? 'المطور' : 'Developer', isRTL ? ho.developer_ar : ho.developer_en],
        [isRTL ? 'تاريخ الحجز' : 'Reserved', ho.reserved_date],
        [isRTL ? 'التسليم المتوقع' : 'Expected', ho.expected_handover],
      ].map(([label, val], i) => (
        <div key={i} className={`flex justify-between py-1.5 text-xs ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-content-muted dark:text-content-muted-dark">{label}</span>
          <span className="font-semibold text-content dark:text-content-dark">{val}</span>
        </div>
      ))}
      {dLeft !== null && ho.status !== 'handed_over' && (
        <div
          className="mt-2.5 px-3 py-2 rounded-lg text-center"
          style={{
            background: dLeft < 0 ? 'rgba(239,68,68,0.08)' : dLeft < 30 ? 'rgba(249,115,22,0.08)' : 'rgba(74,122,171,0.08)',
          }}
        >
          <span
            className="text-xs font-bold"
            style={{ color: dLeft < 0 ? '#EF4444' : dLeft < 30 ? '#F97316' : '#4A7AAB' }}
          >
            {dLeft < 0 ? (isRTL ? `متأخر ${Math.abs(dLeft)} يوم` : `${Math.abs(dLeft)}d overdue`) : (isRTL ? `متبقي ${dLeft} يوم` : `${dLeft} days left`)}
          </span>
        </div>
      )}
      {ho.dev_phone && (
        <div className="flex gap-2 mt-3">
          <a href={`tel:${ho.dev_phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-500/[0.15] text-brand-500 text-xs font-semibold no-underline transition-colors duration-200 hover:bg-brand-500/25">
            <Phone size={14} /> {isRTL ? 'اتصل بالمطور' : 'Call Developer'}
          </a>
          <a href={`https://wa.me/2${ho.dev_phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold no-underline transition-colors duration-200" style={{ background: '#25D36615', color: '#25D366' }}>
            <MessageSquare size={14} /> {isRTL ? 'واتساب' : 'WhatsApp'}
          </a>
        </div>
      )}
      {ho.notes_ar && <p className={`m-0 mt-2.5 text-[11px] text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>{ho.notes_ar}</p>}
    </div>
  );
}

function StatusBadgeStatic({ status, config, isRTL }) {
  const cfg = config[status];
  if (!cfg) return null;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.color + '18', border: `1px solid ${cfg.color}35` }}
    >
      {isRTL ? cfg.ar : cfg.en}
    </span>
  );
}

export default function OperationsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === 'ar';
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('overview');
  const [dealFilter, setDealFilter] = useState('all');
  const [payFilter, setPayFilter] = useState('all');
  const [handoverFilter, setHandoverFilter] = useState('all');
  const [ticketFilter, setTicketFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoverRow, setHoverRow] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  // Local state for interactive data
  const [deals, setDeals] = useState(() => {
    const wonDeals = getWonDeals();
    return [...wonDeals, ...MOCK_OPS_DEALS];
  });
  const [tickets, setTickets] = useState(MOCK_TICKETS);
  const [installments, setInstallments] = useState(MOCK_INSTALLMENTS);

  // ── Derived KPIs ────────────────────────────────────────────────────
  const activeDeals      = deals.filter(d => d.status !== 'completed' && d.status !== 'cancelled').length;
  const newDeals         = deals.filter(d => d.status === 'new_deal').length;
  const underReview      = deals.filter(d => d.status === 'under_review').length;
  const awaitingSign     = deals.filter(d => d.status === 'contract_prep').length;
  const completedDeals   = deals.filter(d => d.status === 'completed').length;

  const overduePayments  = installments.filter(i => i.status === 'overdue');
  const overdueSum       = overduePayments.reduce((s, i) => s + i.amount, 0);
  const paidThisMonth    = installments.filter(i => i.status === 'paid' && i.paid_date?.startsWith('2026-03'));
  const paidSum          = paidThisMonth.reduce((s, i) => s + i.amount, 0);
  const totalDue         = installments.filter(i => ['due', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPaid        = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const collectionRate   = totalPaid + totalDue > 0 ? Math.round((totalPaid / (totalPaid + totalDue)) * 100) : 0;

  const handoverThisMonth = MOCK_HANDOVERS.filter(h => h.expected_handover?.startsWith('2026-03') || h.expected_handover?.startsWith('2026-04')).length;
  const openTickets      = tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
  const complaints       = tickets.filter(t => t.type === 'complaint' && ['open', 'in_progress'].includes(t.status)).length;
  const resolvedTickets  = tickets.filter(t => t.resolved_at);
  const avgRating        = resolvedTickets.filter(t => t.rating).length > 0
    ? (resolvedTickets.filter(t => t.rating).reduce((s, t) => s + t.rating, 0) / resolvedTickets.filter(t => t.rating).length).toFixed(1)
    : '-';

  // ── Handlers ──────────────────────────────────────────────────────
  const advanceDeal = (dealId) => {
    const order = ['new_deal','under_review','docs_collection','contract_prep','contract_signed','completed'];
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const idx = order.indexOf(d.status);
      if (idx < 0 || idx >= order.length - 1) return d;
      return { ...d, status: order[idx + 1] };
    }));
    setSelectedDeal(prev => {
      if (!prev || prev.id !== dealId) return prev;
      const idx = order.indexOf(prev.status);
      if (idx < 0 || idx >= order.length - 1) return prev;
      return { ...prev, status: order[idx + 1] };
    });
  };

  const cancelDeal = (dealId) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: 'cancelled' } : d));
    setSelectedDeal(null);
  };

  const addDeal = (deal) => {
    setDeals(prev => [deal, ...prev]);
    setShowDealModal(false);
  };

  const addTicket = (ticket) => {
    setTickets(prev => [ticket, ...prev]);
    setShowTicketModal(false);
  };

  const recordPayment = (instId) => {
    const today = new Date().toISOString().split('T')[0];
    setInstallments(prev => prev.map(i => i.id === instId ? { ...i, status: 'paid', paid_date: today, method: 'bank_transfer', receipt: `R-${Date.now().toString().slice(-6)}` } : i));
    setShowPaymentModal(false);
  };

  // ── Filtered data ───────────────────────────────────────────────────
  const filteredDeals = useMemo(() => {
    let d = deals;
    if (dealFilter !== 'all') d = d.filter(deal => deal.status === dealFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      d = d.filter(deal => deal.client_ar.includes(s) || deal.client_en.toLowerCase().includes(s) || deal.deal_number.toLowerCase().includes(s) || deal.project_ar.includes(s));
    }
    return d;
  }, [dealFilter, searchTerm, deals]);

  const filteredPayments = useMemo(() => {
    let p = installments;
    if (payFilter !== 'all') p = p.filter(i => i.status === payFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      p = p.filter(i => i.client_ar.includes(s) || i.client_en.toLowerCase().includes(s) || i.deal_number.toLowerCase().includes(s));
    }
    return p;
  }, [payFilter, searchTerm, installments]);

  const filteredHandovers = useMemo(() => {
    let h = MOCK_HANDOVERS;
    if (handoverFilter !== 'all') h = h.filter(ho => ho.status === handoverFilter);
    return h;
  }, [handoverFilter]);

  const filteredTickets = useMemo(() => {
    let t = tickets;
    if (ticketFilter !== 'all') t = t.filter(tk => tk.status === ticketFilter);
    return t;
  }, [ticketFilter, tickets]);

  // ── Shared Components ───────────────────────────────────────────────
  function StatusBadge({ status, config }) {
    const cfg = config[status];
    if (!cfg) return null;
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
        style={{ color: cfg.color, background: cfg.color + '18', border: `1px solid ${cfg.color}35` }}
      >
        {isRTL ? cfg.ar : cfg.en}
      </span>
    );
  }

  function FilterPills({ items, active, onChange }) {
    return (
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onChange('all')}
          className={`px-3 py-1 rounded-md border text-xs cursor-pointer transition-all duration-150 font-cairo ${
            active === 'all'
              ? 'border-brand-500/60 bg-brand-500/[0.15] text-brand-500 font-semibold'
              : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark font-normal'
          }`}
        >
          {isRTL ? 'الكل' : 'All'}
        </button>
        {items.map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="px-3 py-1 rounded-md border text-xs cursor-pointer transition-all duration-150 font-cairo"
            style={{
              borderColor: active === key ? cfg.color + '60' : undefined,
              background: active === key ? cfg.color + '15' : 'transparent',
              color: active === key ? cfg.color : undefined,
              fontWeight: active === key ? 600 : 400,
            }}
          >
            {isRTL ? cfg.ar : cfg.en}
          </button>
        ))}
      </div>
    );
  }

  function AddBtn({ label, onClick }) {
    return (
      <Button variant="primary" size="md" onClick={onClick} className="whitespace-nowrap">
        {label}
      </Button>
    );
  }

  function SearchBar({ placeholder }) {
    return (
      <div className="relative flex-[0_1_280px]">
        <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark ${isRTL ? 'right-3' : 'left-3'}`} />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          size="md"
          className={isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}
        />
      </div>
    );
  }

  // ── Deal Detail Drawer ──────────────────────────────────────────────
  function DealDrawer({ deal, onClose }) {
    if (!deal) return null;
    const sCfg = DEAL_STATUS_CONFIG[deal.status] || {};
    const dealInstallments = installments.filter(i => i.deal_id === deal.id);
    const totalDocs = DOCUMENT_CHECKLIST.filter(d => d.required).length;
    const doneDocs = DOCUMENT_CHECKLIST.filter(d => d.required && deal.documents[d.key]).length;
    return (
      <div
        className={`fixed top-0 bottom-0 w-full max-w-[520px] bg-surface-card dark:bg-surface-card-dark z-[200] shadow-[-8px_0_40px_rgba(0,0,0,0.2)] overflow-y-auto ${isRTL ? 'left-0' : 'right-0'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="sticky top-0 bg-surface-card dark:bg-surface-card-dark z-[1] px-6 py-5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <div>
            <h2 className="m-0 text-lg font-extrabold text-content dark:text-content-dark">{deal.deal_number}</h2>
            <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? deal.client_ar : deal.client_en}</p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          {/* Status */}
          <div className="rounded-xl px-4 py-3.5 flex items-center gap-2.5" style={{ background: sCfg.bg }}>
            <div className="w-2 h-2 rounded-full" style={{ background: sCfg.color }} />
            <span className="text-sm font-bold" style={{ color: sCfg.color }}>{isRTL ? sCfg.ar : sCfg.en}</span>
          </div>
          {/* Info grid */}
          {[
            [isRTL ? 'المشروع' : 'Project', isRTL ? deal.project_ar : deal.project_en],
            [isRTL ? 'المطور' : 'Developer', isRTL ? deal.developer_ar : deal.developer_en],
            [isRTL ? 'الوحدة' : 'Unit', `${deal.unit_code} — ${isRTL ? deal.unit_type_ar : deal.unit_type_en}`],
            [isRTL ? 'السيلز' : 'Agent', isRTL ? deal.agent_ar : deal.agent_en],
            [isRTL ? 'قيمة الصفقة' : 'Deal Value', fmtMoney(deal.deal_value)],
            [isRTL ? 'المقدم' : 'Down Payment', fmtMoney(deal.down_payment)],
            [isRTL ? 'عدد الأقساط' : 'Installments', deal.installments_count],
            [isRTL ? 'قيمة القسط' : 'Per Installment', fmtMoney(Math.round((deal.deal_value - deal.down_payment) / deal.installments_count))],
          ].map(([label, val], i) => (
            <div key={i} className="flex justify-between py-2 border-b border-edge dark:border-edge-dark">
              <span className="text-[13px] text-content-muted dark:text-content-muted-dark">{label}</span>
              <span className="text-[13px] font-semibold text-content dark:text-content-dark">{val}</span>
            </div>
          ))}
          {/* Documents checklist */}
          <div>
            <h3 className="m-0 mb-3 text-sm font-bold text-content dark:text-content-dark">{isRTL ? `المستندات (${doneDocs}/${totalDocs})` : `Documents (${doneDocs}/${totalDocs})`}</h3>
            <div className="flex flex-col gap-2">
              {DOCUMENT_CHECKLIST.map(doc => {
                const done = deal.documents[doc.key];
                return (
                  <div
                    key={doc.key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                      done
                        ? 'bg-brand-500/10 dark:bg-brand-500/10 border-brand-500/30'
                        : 'bg-red-500/[0.05] dark:bg-red-500/[0.05] border-red-500/[0.19]'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                      done ? 'bg-brand-500' : 'bg-transparent border-2 border-edge dark:border-edge-dark'
                    }`}>
                      {done && <CheckCircle size={14} color="#fff" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${done ? 'text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}>
                      {isRTL ? doc.ar : doc.en}
                    </span>
                    {doc.required && !done && <span className="text-[10px] text-red-500 font-semibold">{isRTL ? 'مطلوب' : 'Required'}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Installments in drawer */}
          {dealInstallments.length > 0 && (
            <div>
              <h3 className="m-0 mb-3 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الأقساط' : 'Installments'}</h3>
              {dealInstallments.map(inst => {
                const pCfg = PAYMENT_STATUS_CONFIG[inst.status] || {};
                return (
                  <div key={inst.id} className="flex justify-between items-center px-3 py-2.5 rounded-lg mb-1.5 bg-[#F8FAFC] dark:bg-brand-500/[0.05] border border-edge dark:border-edge-dark">
                    <div>
                      <span className="text-[13px] font-semibold text-content dark:text-content-dark">{isRTL ? `قسط ${inst.num}` : `Inst. ${inst.num}`}</span>
                      <span className={`text-xs text-content-muted dark:text-content-muted-dark ${isRTL ? 'ml-2' : 'mr-2'}`}> — {inst.due_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-content dark:text-content-dark">{fmtMoneyShort(inst.amount)}</span>
                      <StatusBadge status={inst.status} config={PAYMENT_STATUS_CONFIG} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Action buttons */}
          {deal.status !== 'completed' && deal.status !== 'cancelled' && (
            <div className="flex gap-2.5 mt-2">
              <Button variant="primary" size="md" onClick={() => advanceDeal(deal.id)} className="flex-1 justify-center">
                <ArrowRight size={16} /> {isRTL ? 'نقل للمرحلة التالية' : 'Advance Status'}
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => { if (window.confirm(isRTL ? 'هل أنت متأكد من إلغاء الصفقة؟' : 'Cancel this deal?')) cancelDeal(deal.id); }}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          )}
          {deal.status === 'completed' && (
            <div className="px-4 py-3.5 rounded-[10px] bg-brand-500/[0.08] text-center">
              <CheckCircle size={20} color="#4A7AAB" className="mb-1" />
              <p className="m-0 text-[13px] font-bold text-brand-500">{isRTL ? 'الصفقة مكتملة' : 'Deal Completed'}</p>
            </div>
          )}
          {deal.status === 'cancelled' && (
            <div className="px-4 py-3.5 rounded-[10px] bg-red-500/[0.08] text-center">
              <X size={20} color="#EF4444" className="mb-1" />
              <p className="m-0 text-[13px] font-bold text-red-500">{isRTL ? 'الصفقة ملغية' : 'Deal Cancelled'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── OVERVIEW TAB ────────────────────────────────────────────────────
  function renderOverview() {
    const sortedActivity = [...MOCK_OPS_ACTIVITY].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const pipelineCounts = Object.entries(DEAL_STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([key, cfg]) => ({
      key, label: isRTL ? cfg.ar : cfg.en, color: cfg.color, count: deals.filter(d => d.status === key).length,
    }));
    const totalPipeline = Math.max(pipelineCounts.reduce((s, p) => s + p.count, 0), 1);
    return (
      <>
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          <KpiCard icon={FileCheck} label={isRTL ? 'صفقات نشطة' : 'Active Deals'} value={activeDeals} sub={isRTL ? `${newDeals} جديدة` : `${newDeals} new`} color="#4A7AAB" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'أقساط متأخرة' : 'Overdue Payments'} value={overduePayments.length} sub={fmtMoney(overdueSum)} color="#EF4444" />
          <KpiCard icon={KeyRound} label={isRTL ? 'تسليمات قريبة' : 'Upcoming Handovers'} value={handoverThisMonth} color="#2B4C6F" />
          <KpiCard icon={Headphones} label={isRTL ? 'تذاكر مفتوحة' : 'Open Tickets'} value={openTickets} sub={isRTL ? `${complaints} شكوى` : `${complaints} complaints`} color="#F97316" />
        </div>
        {/* Pipeline bar */}
        <Card className="p-5 mb-6">
          <h3 className={`m-0 mb-4 text-sm font-bold text-content dark:text-content-dark ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'خط سير الصفقات' : 'Deal Pipeline'}</h3>
          <div className="flex rounded-lg overflow-hidden h-7">
            {pipelineCounts.filter(p => p.count > 0).map(p => (
              <div key={p.key} title={`${p.label}: ${p.count}`} className="flex items-center justify-center transition-all duration-300" style={{ flex: p.count, background: p.color, minWidth: p.count > 0 ? 32 : 0 }}>
                <span className="text-[11px] font-bold text-white">{p.count}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 flex-wrap mt-3">
            {pipelineCounts.filter(p => p.count > 0).map(p => (
              <div key={p.key} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{p.label} ({p.count})</span>
              </div>
            ))}
          </div>
        </Card>
        {/* Activity timeline */}
        <Card className="p-5">
          <h3 className={`m-0 mb-4 text-sm font-bold text-content dark:text-content-dark ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'آخر الأنشطة' : 'Recent Activity'}</h3>
          <div className="flex flex-col">
            {sortedActivity.map((act, idx) => {
              const actCfg = ACT_TYPE[act.type] || { icon: Clock, color: '#8BA8C8' };
              const ActIcon = actCfg.icon;
              const time = new Date(act.timestamp);
              const timeStr = `${time.getDate()}/${time.getMonth() + 1} ${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={act.id} className={`flex gap-3.5 py-3 ${idx < sortedActivity.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''} ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: actCfg.color + '18' }}>
                    <ActIcon size={16} color={actCfg.color} />
                  </div>
                  <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <p className="m-0 text-[13px] text-content dark:text-content-dark leading-normal">{isRTL ? act.description_ar : act.description_en}</p>
                    <p className="m-0 mt-0.5 text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? act.user_ar : act.user_en} — {timeStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </>
    );
  }

  // ── DEALS TAB ───────────────────────────────────────────────────────
  function renderDeals() {
    return (
      <>
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          <KpiCard icon={Plus} label={isRTL ? 'صفقات جديدة' : 'New Deals'} value={newDeals} color="#4A7AAB" />
          <KpiCard icon={Clock} label={isRTL ? 'قيد المراجعة' : 'Under Review'} value={underReview} color="#6B8DB5" />
          <KpiCard icon={FileText} label={isRTL ? 'بانتظار التوقيع' : 'Awaiting Signature'} value={awaitingSign} color="#2B4C6F" />
          <KpiCard icon={CheckCircle} label={isRTL ? 'مكتملة' : 'Completed'} value={completedDeals} color="#1B3347" />
        </div>
        <div className={`flex gap-3 items-center flex-wrap mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <FilterPills items={Object.entries(DEAL_STATUS_CONFIG)} active={dealFilter} onChange={setDealFilter} />
          <div className="flex-1" />
          <SearchBar placeholder={isRTL ? 'بحث بالاسم أو رقم الصفقة...' : 'Search by name or deal #...'} />
          <AddBtn label={isRTL ? '+ صفقة جديدة' : '+ New Deal'} onClick={() => setShowDealModal(true)} />
        </div>
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'قائمة الصفقات' : 'Deals List'}</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" dir={isRTL ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
                  {[isRTL?'#':'#', isRTL?'العميل':'Client', isRTL?'المشروع':'Project', isRTL?'الوحدة':'Unit', isRTL?'القيمة':'Value', isRTL?'المستندات':'Docs', isRTL?'الحالة':'Status', isRTL?'':''].map((h, i) => (
                    <th key={i} className={`px-3.5 py-2.5 font-bold text-content-muted dark:text-content-muted-dark text-[11px] uppercase tracking-wider whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map(deal => {
                  const reqDocs = DOCUMENT_CHECKLIST.filter(d => d.required);
                  const doneDocs = reqDocs.filter(d => deal.documents[d.key]).length;
                  return (
                    <tr
                      key={deal.id}
                      onMouseEnter={() => setHoverRow(deal.id)}
                      onMouseLeave={() => setHoverRow(null)}
                      onClick={() => setSelectedDeal(deal)}
                      className="cursor-pointer transition-colors duration-150 hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.07]"
                    >
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-semibold">
                        {deal.deal_number}
                        {deal.opportunity_id && <span className="ms-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/[0.12] text-emerald-500">CRM</span>}
                      </td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark">
                        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: ACOLORS[deal.id.charCodeAt(5) % ACOLORS.length] }}>{initials(isRTL ? deal.client_ar : deal.client_en)}</div>
                          <div className={isRTL ? 'text-right' : 'text-left'}>
                            <div className="font-semibold text-content dark:text-content-dark">{isRTL ? deal.client_ar : deal.client_en}</div>
                            <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? deal.agent_ar : deal.agent_en}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content dark:text-content-dark">{isRTL ? deal.project_ar : deal.project_en}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark">{deal.unit_code}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark font-bold text-content dark:text-content-dark whitespace-nowrap">{fmtMoneyShort(deal.deal_value)}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-semibold ${doneDocs === reqDocs.length ? 'text-brand-500' : 'text-red-500'}`}>{doneDocs}/{reqDocs.length}</span>
                          <div className="w-10 h-1 rounded-sm bg-edge dark:bg-edge-dark">
                            <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${(doneDocs / reqDocs.length) * 100}%`, background: doneDocs === reqDocs.length ? '#4A7AAB' : '#F97316' }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark"><StatusBadge status={deal.status} config={DEAL_STATUS_CONFIG} /></td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark">
                        <button className="bg-transparent border-none cursor-pointer text-brand-500 p-1"><Eye size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {filteredDeals.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد صفقات' : 'No deals found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }

  // ── PAYMENTS TAB ────────────────────────────────────────────────────
  function renderPayments() {
    return (
      <>
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          <KpiCard icon={DollarSign} label={isRTL ? 'إجمالي المستحق' : 'Total Due'} value={fmtMoneyShort(totalDue)} color="#4A7AAB" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'متأخر السداد' : 'Overdue'} value={overduePayments.length} sub={fmtMoney(overdueSum)} color="#EF4444" />
          <KpiCard icon={TrendingUp} label={isRTL ? 'محصّل هذا الشهر' : 'Collected This Month'} value={fmtMoneyShort(paidSum)} color="#2B4C6F" />
          <KpiCard icon={PieChart} label={isRTL ? 'نسبة التحصيل' : 'Collection Rate'} value={`${collectionRate}%`} color="#1B3347" />
        </div>
        <div className={`flex gap-3 items-center flex-wrap mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <FilterPills items={Object.entries(PAYMENT_STATUS_CONFIG)} active={payFilter} onChange={setPayFilter} />
          <div className="flex-1" />
          <SearchBar placeholder={isRTL ? 'بحث...' : 'Search...'} />
          <AddBtn label={isRTL ? '+ تسجيل دفعة' : '+ Record Payment'} onClick={() => setShowPaymentModal(true)} />
        </div>
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'جدول المدفوعات' : 'Payments Schedule'}</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" dir={isRTL ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
                  {[isRTL?'الصفقة':'Deal', isRTL?'العميل':'Client', isRTL?'المشروع':'Project', isRTL?'القسط':'Inst.', isRTL?'المبلغ':'Amount', isRTL?'تاريخ الاستحقاق':'Due Date', isRTL?'الحالة':'Status', isRTL?'إيصال':'Receipt'].map((h, i) => (
                    <th key={i} className={`px-3.5 py-2.5 font-bold text-content-muted dark:text-content-muted-dark text-[11px] uppercase tracking-wider whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(inst => {
                  const isOverdue = inst.status === 'overdue';
                  const overdueDays = isOverdue ? daysSince(inst.due_date) : 0;
                  return (
                    <tr
                      key={inst.id}
                      onMouseEnter={() => setHoverRow(inst.id)}
                      onMouseLeave={() => setHoverRow(null)}
                      className={`transition-colors duration-150 ${isOverdue ? 'bg-red-500/[0.05] dark:bg-red-500/[0.05]' : ''} hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.07]`}
                    >
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-semibold">{inst.deal_number}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark font-semibold text-content dark:text-content-dark">{isRTL ? inst.client_ar : inst.client_en}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark">{isRTL ? inst.project_ar : inst.project_en}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content dark:text-content-dark text-center">{inst.num}/{inst.total}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark font-bold text-content dark:text-content-dark whitespace-nowrap">{fmtMoney(inst.amount)}</td>
                      <td className={`px-3.5 py-3 border-b border-edge dark:border-edge-dark whitespace-nowrap ${isOverdue ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                        {inst.due_date}
                        {isOverdue && <span className="text-[10px] font-bold text-red-500 block">{isRTL ? `متأخر ${overdueDays} يوم` : `${overdueDays}d overdue`}</span>}
                      </td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark"><StatusBadge status={inst.status} config={PAYMENT_STATUS_CONFIG} /></td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark">
                        {inst.receipt ? inst.receipt : ['due','overdue'].includes(inst.status) ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); recordPayment(inst.id); }}
                            className="px-2.5 py-1 rounded-md border-none bg-brand-800 text-white text-[11px] font-semibold cursor-pointer font-cairo whitespace-nowrap"
                          >
                            {isRTL ? 'تأكيد الدفع' : 'Confirm'}
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {filteredPayments.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد مدفوعات' : 'No payments found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }

  // ── HANDOVER TAB ────────────────────────────────────────────────────
  function renderHandover() {
    const reservedCount = MOCK_HANDOVERS.filter(h => ['reserved', 'developer_confirmed'].includes(h.status)).length;
    const constructionCount = MOCK_HANDOVERS.filter(h => ['under_construction', 'finishing'].includes(h.status)).length;
    const handedCount = MOCK_HANDOVERS.filter(h => h.status === 'handed_over').length;
    return (
      <>
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          <KpiCard icon={Building2} label={isRTL ? 'وحدات محجوزة' : 'Reserved Units'} value={reservedCount} color="#4A7AAB" />
          <KpiCard icon={Clock} label={isRTL ? 'تحت الإنشاء' : 'Under Construction'} value={constructionCount} color="#6B8DB5" />
          <KpiCard icon={KeyRound} label={isRTL ? 'جاهز للتسليم' : 'Ready'} value={MOCK_HANDOVERS.filter(h => h.status === 'ready').length} color="#2B4C6F" />
          <KpiCard icon={CheckCircle} label={isRTL ? 'تم التسليم' : 'Handed Over'} value={handedCount} color="#1B3347" />
        </div>
        <div className={`flex gap-3 items-center flex-wrap mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <FilterPills items={Object.entries(HANDOVER_STATUS_CONFIG)} active={handoverFilter} onChange={setHandoverFilter} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {filteredHandovers.map(ho => (
            <HandoverCard key={ho.id} ho={ho} isRTL={isRTL} isDark={isDark} />
          ))}
          {filteredHandovers.length === 0 && (
            <div className="p-10 text-center text-content-muted dark:text-content-muted-dark col-span-full">{isRTL ? 'لا توجد تسليمات' : 'No handovers found'}</div>
          )}
        </div>
      </>
    );
  }

  // ── AFTER-SALES TAB ─────────────────────────────────────────────────
  function renderAfterSales() {
    return (
      <>
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          <KpiCard icon={AlertCircle} label={isRTL ? 'تذاكر مفتوحة' : 'Open Tickets'} value={openTickets} color="#EF4444" />
          <KpiCard icon={Clock} label={isRTL ? 'متوسط وقت الحل' : 'Avg Resolution'} value={resolvedTickets.length > 0 ? `${Math.round(resolvedTickets.reduce((s, t) => s + daysSince(t.created_at) - (daysSince(t.resolved_at) || 0), 0) / resolvedTickets.length)}d` : '-'} color="#4A7AAB" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'شكاوى مفتوحة' : 'Open Complaints'} value={complaints} color="#F97316" />
          <KpiCard icon={Star} label={isRTL ? 'رضا العملاء' : 'Satisfaction'} value={`${avgRating}/5`} color="#2B4C6F" />
        </div>
        <div className={`flex gap-3 items-center flex-wrap mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <FilterPills items={Object.entries(TICKET_STATUS_CONFIG)} active={ticketFilter} onChange={setTicketFilter} />
          <div className="flex-1" />
          <AddBtn label={isRTL ? '+ تذكرة جديدة' : '+ New Ticket'} onClick={() => setShowTicketModal(true)} />
        </div>
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'قائمة التذاكر' : 'Tickets List'}</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" dir={isRTL ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
                  {[isRTL?'#':'#', isRTL?'العميل':'Client', isRTL?'النوع':'Type', isRTL?'الموضوع':'Subject', isRTL?'الأولوية':'Priority', isRTL?'مسؤول':'Assigned', isRTL?'التاريخ':'Date', isRTL?'الحالة':'Status', isRTL?'التقييم':'Rating'].map((h, i) => (
                    <th key={i} className={`px-3.5 py-2.5 font-bold text-content-muted dark:text-content-muted-dark text-[11px] uppercase tracking-wider whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(tk => {
                  const typeCfg = TICKET_TYPE_CONFIG[tk.type] || {};
                  const prioCfg = PRIORITY_CONFIG[tk.priority] || {};
                  const TypeIcon = TICKET_TYPE_ICONS[tk.type] || HelpCircle;
                  return (
                    <tr
                      key={tk.id}
                      onMouseEnter={() => setHoverRow(tk.id)}
                      onMouseLeave={() => setHoverRow(null)}
                      className="transition-colors duration-150 hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.07]"
                    >
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-semibold">{tk.ticket_number}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark font-semibold text-content dark:text-content-dark">{isRTL ? tk.client_ar : tk.client_en}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: typeCfg.color + '15', color: typeCfg.color }}>
                          <TypeIcon size={12} /> {isRTL ? typeCfg.ar : typeCfg.en}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content dark:text-content-dark max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{isRTL ? tk.subject_ar : tk.subject_en}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark">
                        <span className="text-[11px] font-semibold" style={{ color: prioCfg.color }}>{isRTL ? prioCfg.ar : prioCfg.en}</span>
                      </td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark">{isRTL ? tk.assigned_ar : tk.assigned_en}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark whitespace-nowrap">{tk.created_at}</td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark"><StatusBadge status={tk.status} config={TICKET_STATUS_CONFIG} /></td>
                      <td className="px-3.5 py-3 border-b border-edge dark:border-edge-dark text-center">
                        {tk.rating ? (
                          <div className="flex items-center gap-0.5 justify-center">
                            <Star size={13} color="#F59E0B" fill="#F59E0B" />
                            <span className="text-xs font-bold text-content dark:text-content-dark">{tk.rating}</span>
                          </div>
                        ) : <span className="text-content-muted dark:text-content-muted-dark">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredTickets.length === 0 && (
                  <tr><td colSpan={9} className="p-10 text-center text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد تذاكر' : 'No tickets found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }

  // ── Modals ─────────────────────────────────────────────────────────
  const AGENTS = ['أحمد محمد','سارة علي','محمود حسن','نورا احمد','خالد عمر'];
  const PROJECTS = [{ar:'سيليا العاصمة الادارية',en:'Celia New Capital',dev_ar:'طلعت مصطفى',dev_en:'Talaat Moustafa'},{ar:'ريفان الشيخ زايد',en:'Rivan Sheikh Zayed',dev_ar:'ريبورتاج',dev_en:'Reportage'},{ar:'بلو تري المرج',en:'Blue Tree El Marg',dev_ar:'سيتي إيدج',dev_en:'City Edge'},{ar:'تاون جيت 6 اكتوبر',en:'Town Gate October',dev_ar:'اورا',dev_en:'ORA'}];

  function FieldLabel({ children }) {
    return <label className="block text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{children}</label>;
  }

  function AddDealModal() {
    const [form, setForm] = useState({ client_ar:'', client_en:'', phone:'', agent:'', project:0, unit_code:'', unit_type_ar:'شقة', deal_value:'', down_payment:'', installments_count:'8' });
    const set = (k,v) => setForm(p=>({...p,[k]:v}));
    const proj = PROJECTS[form.project] || PROJECTS[0];
    const submit = () => {
      if (!form.client_ar || !form.deal_value) return;
      addDeal({
        id: `deal-new-${Date.now()}`, deal_number: `D-2026-${String(deals.length+1).padStart(3,'0')}`,
        client_ar: form.client_ar, client_en: form.client_en || form.client_ar, phone: form.phone,
        agent_ar: form.agent || AGENTS[0], agent_en: form.agent,
        project_ar: proj.ar, project_en: proj.en, developer_ar: proj.dev_ar, developer_en: proj.dev_en,
        unit_code: form.unit_code, unit_type_ar: form.unit_type_ar, unit_type_en: 'Unit',
        deal_value: Number(form.deal_value), down_payment: Number(form.down_payment) || 0,
        installments_count: Number(form.installments_count) || 8,
        status: 'new_deal', created_at: new Date().toISOString().split('T')[0],
        documents: { national_id:false, reservation_form:false, down_payment_receipt:false, contract:false, developer_receipt:false },
      });
    };
    return (
      <Modal open={true} title={isRTL?'صفقة جديدة':'New Deal'} onClose={()=>setShowDealModal(false)} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div><FieldLabel>{isRTL?'اسم العميل (عربي)':'Client Name (Arabic)'}</FieldLabel><Input value={form.client_ar} onChange={e=>set('client_ar',e.target.value)} placeholder={isRTL?'محمد أحمد':'Mohamed Ahmed'} /></div>
          <div><FieldLabel>{isRTL?'رقم الموبايل':'Phone'}</FieldLabel><Input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="01xxxxxxxxx" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>{isRTL?'المشروع':'Project'}</FieldLabel><Select value={form.project} onChange={e=>set('project',Number(e.target.value))}>{PROJECTS.map((p,i)=><option key={i} value={i}>{isRTL?p.ar:p.en}</option>)}</Select></div>
            <div><FieldLabel>{isRTL?'كود الوحدة':'Unit Code'}</FieldLabel><Input value={form.unit_code} onChange={e=>set('unit_code',e.target.value)} placeholder="A-101" /></div>
          </div>
          <div><FieldLabel>{isRTL?'السيلز':'Agent'}</FieldLabel><Select value={form.agent} onChange={e=>set('agent',e.target.value)}><option value="">{isRTL?'اختر':'Select'}</option>{AGENTS.map(a=><option key={a} value={a}>{a}</option>)}</Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>{isRTL?'قيمة الصفقة':'Deal Value'}</FieldLabel><Input type="number" value={form.deal_value} onChange={e=>set('deal_value',e.target.value)} placeholder="2,500,000" /></div>
            <div><FieldLabel>{isRTL?'المقدم':'Down Payment'}</FieldLabel><Input type="number" value={form.down_payment} onChange={e=>set('down_payment',e.target.value)} placeholder="500,000" /></div>
          </div>
          <div><FieldLabel>{isRTL?'عدد الأقساط':'Installments'}</FieldLabel><Input type="number" value={form.installments_count} onChange={e=>set('installments_count',e.target.value)} /></div>
          <Button variant="primary" size="lg" onClick={submit} className="w-full justify-center">{isRTL?'إضافة الصفقة':'Add Deal'}</Button>
        </div>
      </Modal>
    );
  }

  function AddTicketModal() {
    const [form, setForm] = useState({ client_ar:'', type:'inquiry', priority:'medium', subject_ar:'', assigned:'' });
    const set = (k,v) => setForm(p=>({...p,[k]:v}));
    const submit = () => {
      if (!form.client_ar || !form.subject_ar) return;
      addTicket({
        id: `tkt-new-${Date.now()}`, ticket_number: `T-2026-${String(tickets.length+1).padStart(3,'0')}`,
        deal_id: null, client_ar: form.client_ar, client_en: form.client_ar,
        type: form.type, priority: form.priority,
        subject_ar: form.subject_ar, subject_en: form.subject_ar,
        assigned_ar: form.assigned || AGENTS[0], assigned_en: form.assigned,
        status: 'open', created_at: new Date().toISOString().split('T')[0],
        resolved_at: null, rating: null,
      });
    };
    return (
      <Modal open={true} title={isRTL?'تذكرة جديدة':'New Ticket'} onClose={()=>setShowTicketModal(false)} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div><FieldLabel>{isRTL?'اسم العميل':'Client Name'}</FieldLabel><Input value={form.client_ar} onChange={e=>set('client_ar',e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>{isRTL?'النوع':'Type'}</FieldLabel><Select value={form.type} onChange={e=>set('type',e.target.value)}>{Object.entries(TICKET_TYPE_CONFIG).map(([k,v])=><option key={k} value={k}>{isRTL?v.ar:v.en}</option>)}</Select></div>
            <div><FieldLabel>{isRTL?'الأولوية':'Priority'}</FieldLabel><Select value={form.priority} onChange={e=>set('priority',e.target.value)}>{Object.entries(PRIORITY_CONFIG).map(([k,v])=><option key={k} value={k}>{isRTL?v.ar:v.en}</option>)}</Select></div>
          </div>
          <div><FieldLabel>{isRTL?'الموضوع':'Subject'}</FieldLabel><Input value={form.subject_ar} onChange={e=>set('subject_ar',e.target.value)} /></div>
          <div><FieldLabel>{isRTL?'المسؤول':'Assigned To'}</FieldLabel><Select value={form.assigned} onChange={e=>set('assigned',e.target.value)}><option value="">{isRTL?'اختر':'Select'}</option>{AGENTS.map(a=><option key={a} value={a}>{a}</option>)}</Select></div>
          <Button variant="primary" size="lg" onClick={submit} className="w-full justify-center">{isRTL?'فتح التذكرة':'Open Ticket'}</Button>
        </div>
      </Modal>
    );
  }

  function RecordPaymentModal() {
    const unpaid = installments.filter(i => ['due','overdue','upcoming'].includes(i.status));
    const [selected, setSelected] = useState('');
    return (
      <Modal open={true} title={isRTL?'تسجيل دفعة':'Record Payment'} onClose={()=>setShowPaymentModal(false)} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div><FieldLabel>{isRTL?'اختر القسط':'Select Installment'}</FieldLabel>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {unpaid.map(inst => {
                const isOv = inst.status === 'overdue';
                const active = selected === inst.id;
                return (
                  <div
                    key={inst.id}
                    onClick={()=>setSelected(inst.id)}
                    className={`px-3.5 py-3 rounded-[10px] border-2 cursor-pointer transition-all duration-200 ${
                      active
                        ? 'border-brand-500 bg-brand-500/10'
                        : isOv
                          ? 'border-edge dark:border-edge-dark bg-red-500/[0.04]'
                          : 'border-edge dark:border-edge-dark bg-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-[13px] font-semibold text-content dark:text-content-dark">{isRTL?inst.client_ar:inst.client_en}</div>
                        <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{inst.deal_number} — {isRTL?`قسط ${inst.num}/${inst.total}`:`Inst. ${inst.num}/${inst.total}`}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-content dark:text-content-dark">{fmtMoneyShort(inst.amount)}</div>
                        <div className={`text-[11px] ${isOv ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>{inst.due_date}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {unpaid.length === 0 && <p className="text-center text-content-muted dark:text-content-muted-dark p-5">{isRTL?'لا توجد أقساط مستحقة':'No pending installments'}</p>}
            </div>
          </div>
          {selected && <Button variant="primary" size="lg" onClick={()=>recordPayment(selected)} className="w-full justify-center">{isRTL?'تأكيد الدفع':'Confirm Payment'}</Button>}
        </div>
      </Modal>
    );
  }

  // ── Main Render ─────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-7 py-6 min-h-screen bg-surface-bg dark:bg-surface-bg-dark">
      {/* Page Header */}
      <div className={`flex justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-[46px] h-[46px] rounded-[13px] bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shadow-[0_4px_12px_rgba(74,122,171,0.3)]">
            <ClipboardCheck size={22} color="#fff" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{isRTL ? 'العمليات' : 'Operations'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'إدارة الصفقات والمدفوعات والتسليمات' : 'Manage deals, payments & handovers'}</p>
          </div>
        </div>
        <ExportButton
          data={deals}
          filename={isRTL ? 'العمليات' : 'operations'}
          title={isRTL ? 'العمليات' : 'Operations'}
          columns={[
            { header: isRTL ? 'العميل' : 'Client', key: 'client_name' },
            { header: isRTL ? 'المشروع' : 'Project', key: 'project' },
            { header: isRTL ? 'الوحدة' : 'Unit', key: 'unit' },
            { header: isRTL ? 'القيمة' : 'Value', key: 'deal_value' },
            { header: isRTL ? 'الحالة' : 'Status', key: 'status' },
          ]}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-brand-500/[0.08] p-1 rounded-xl flex-wrap">
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const TabIcon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-[18px] py-2.5 rounded-[10px] border-none cursor-pointer text-[13px] font-cairo whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'font-bold bg-surface-card dark:bg-surface-card-dark text-brand-500 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'font-medium bg-transparent text-content-muted dark:text-content-muted-dark'
              }`}
            >
              <TabIcon size={16} />
              {isRTL ? tab.ar : tab.en}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'deals' && renderDeals()}
      {activeTab === 'payments' && renderPayments()}
      {activeTab === 'handover' && renderHandover()}
      {activeTab === 'after_sales' && renderAfterSales()}

      {/* Drawer overlay */}
      {selectedDeal && (
        <>
          <div onClick={() => setSelectedDeal(null)} className="fixed inset-0 bg-black/50 z-[200]" />
          <DealDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
        </>
      )}

      {/* Modals */}
      {showDealModal && <AddDealModal />}
      {showTicketModal && <AddTicketModal />}
      {showPaymentModal && <RecordPaymentModal />}
    </div>
  );
}
