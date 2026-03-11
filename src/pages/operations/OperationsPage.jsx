import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
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

function useDS() {
  const { theme } = useTheme(); const dark = theme==='dark';
  return { dark, bg:dark?'#152232':'#F0F4F8', card:dark?'#1a2234':'#ffffff', border:dark?'rgba(74,122,171,0.2)':'#E2E8F0', text:dark?'#E2EAF4':'#1A2B3C', muted:dark?'#8BA8C8':'#64748B', input:dark?'#0F1E2D':'#ffffff', rowHover:dark?'rgba(74,122,171,0.07)':'#F8FAFC', thBg:dark?'rgba(74,122,171,0.08)':'#F8FAFC', accent:'#4A7AAB', primary:'#2B4C6F' };
}

function HandoverCard({ ho, c, isRTL, isDark }) {
  const [cardHov, setCardHov] = useState(false);
  const hCfg = HANDOVER_STATUS_CONFIG[ho.status] || {};
  const dLeft = daysUntil(ho.expected_handover);
  return (
    <div onMouseEnter={() => setCardHov(true)} onMouseLeave={() => setCardHov(false)}
      style={{ background: c.card, borderRadius: 14, border: `1px solid ${cardHov ? hCfg.color + '60' : c.border}`, padding: 20, transition: 'all 0.2s', transform: cardHov ? 'translateY(-2px)' : 'none', boxShadow: cardHov ? '0 8px 24px rgba(0,0,0,0.08)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: c.text }}>{isRTL ? ho.client_ar : ho.client_en}</h4>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: c.muted }}>{ho.deal_number} — {ho.unit_code}</p>
        </div>
        <StatusBadgeStatic status={ho.status} config={HANDOVER_STATUS_CONFIG} isRTL={isRTL} />
      </div>
      {[
        [isRTL ? 'المشروع' : 'Project', isRTL ? ho.project_ar : ho.project_en],
        [isRTL ? 'المطور' : 'Developer', isRTL ? ho.developer_ar : ho.developer_en],
        [isRTL ? 'تاريخ الحجز' : 'Reserved', ho.reserved_date],
        [isRTL ? 'التسليم المتوقع' : 'Expected', ho.expected_handover],
      ].map(([label, val], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <span style={{ color: c.muted }}>{label}</span>
          <span style={{ fontWeight: 600, color: c.text }}>{val}</span>
        </div>
      ))}
      {dLeft !== null && ho.status !== 'handed_over' && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: dLeft < 0 ? 'rgba(239,68,68,0.08)' : dLeft < 30 ? 'rgba(249,115,22,0.08)' : 'rgba(74,122,171,0.08)', textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: dLeft < 0 ? '#EF4444' : dLeft < 30 ? '#F97316' : '#4A7AAB' }}>
            {dLeft < 0 ? (isRTL ? `متأخر ${Math.abs(dLeft)} يوم` : `${Math.abs(dLeft)}d overdue`) : (isRTL ? `متبقي ${dLeft} يوم` : `${dLeft} days left`)}
          </span>
        </div>
      )}
      {ho.dev_phone && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <a href={`tel:${ho.dev_phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: c.accent + '15', color: c.accent, fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s' }}>
            <Phone size={14} /> {isRTL ? 'اتصل بالمطور' : 'Call Developer'}
          </a>
          <a href={`https://wa.me/2${ho.dev_phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: '#25D36615', color: '#25D366', fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s' }}>
            <MessageSquare size={14} /> {isRTL ? 'واتساب' : 'WhatsApp'}
          </a>
        </div>
      )}
      {ho.notes_ar && <p style={{ margin: '10px 0 0', fontSize: 11, color: c.muted, textAlign: isRTL ? 'right' : 'left' }}>{ho.notes_ar}</p>}
    </div>
  );
}

function StatusBadgeStatic({ status, config, isRTL }) {
  const cfg = config[status];
  if (!cfg) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.color + '18', border: `1px solid ${cfg.color}35`, whiteSpace: 'nowrap' }}>
      {isRTL ? cfg.ar : cfg.en}
    </span>
  );
}

export default function OperationsPage() {
  const { i18n } = useTranslation();
  const ds = useDS();
  const isRTL = i18n.language === 'ar';
  const lang  = i18n.language;
  const isDark = ds.dark;

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

  const c = ds;

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
  function KpiCard({ icon: Icon, label, value, sub, color = '#4A7AAB' }) {
    const [hov, setHov] = useState(false);
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ background: c.card, borderRadius: 14, border: `1px solid ${hov ? color + '60' : c.border}`, padding: '18px 20px', position: 'relative', overflow: 'hidden', transform: hov ? 'translateY(-2px)' : 'none', boxShadow: hov ? `0 8px 24px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s ease' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 4, height: '100%', background: `linear-gradient(180deg, ${color}, transparent)`, borderRadius: '14px 0 0 14px', opacity: hov ? 1 : 0.6, transition: 'opacity 0.2s' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: c.muted, fontWeight: 500 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: c.text, lineHeight: 1 }}>{value}</p>
            {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: c.muted }}>{sub}</p>}
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: color + (hov ? '25' : '15'), display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            <Icon size={20} color={color} />
          </div>
        </div>
      </div>
    );
  }

  function StatusBadge({ status, config }) {
    const cfg = config[status];
    if (!cfg) return null;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.color + '18', border: `1px solid ${cfg.color}35`, whiteSpace: 'nowrap' }}>
        {isRTL ? cfg.ar : cfg.en}
      </span>
    );
  }

  function FilterPills({ items, active, onChange }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => onChange('all')} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${active === 'all' ? c.accent : c.border}`, background: active === 'all' ? c.accent + '15' : 'transparent', color: active === 'all' ? c.accent : c.muted, fontSize: 12, fontWeight: active === 'all' ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
          {isRTL ? 'الكل' : 'All'}
        </button>
        {items.map(([key, cfg]) => (
          <button key={key} onClick={() => onChange(key)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${active === key ? cfg.color + '60' : c.border}`, background: active === key ? cfg.color + '15' : 'transparent', color: active === key ? cfg.color : c.muted, fontSize: 12, fontWeight: active === key ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
            {isRTL ? cfg.ar : cfg.en}
          </button>
        ))}
      </div>
    );
  }

  function AddBtn({ label, onClick }) {
    const [hov, setHov] = useState(false);
    return <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: hov ? '#2B4C6F' : '#1B3347', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, transform: hov ? 'translateY(-1px)' : 'none', boxShadow: hov ? '0 6px 16px rgba(27,51,71,0.35)' : '0 2px 6px rgba(27,51,71,0.2)', transition: 'all 0.2s ease', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>;
  }

  function SearchBar({ placeholder }) {
    return (
      <div style={{ position: 'relative', flex: '0 1 280px' }}>
        <Search size={16} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: 12, top: '50%', transform: 'translateY(-50%)', color: c.muted }} />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: `8px 12px 8px ${isRTL ? '12px' : '36px'}`, paddingRight: isRTL ? 36 : 12, borderRadius: 10, border: `1px solid ${c.border}`, background: c.input, color: c.text, fontSize: 13, fontFamily: 'inherit', direction: isRTL ? 'rtl' : 'ltr', outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
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
      <div style={{ position: 'fixed', top: 0, [isRTL ? 'left' : 'right']: 0, bottom: 0, width: '100%', maxWidth: 520, background: c.card, zIndex: 200, boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={{ position: 'sticky', top: 0, background: c.card, zIndex: 1, padding: '20px 24px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: c.text }}>{deal.deal_number}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: c.muted }}>{isRTL ? deal.client_ar : deal.client_en}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status */}
          <div style={{ background: sCfg.bg, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: sCfg.color }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: sCfg.color }}>{isRTL ? sCfg.ar : sCfg.en}</span>
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
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.border}` }}>
              <span style={{ fontSize: 13, color: c.muted }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{val}</span>
            </div>
          ))}
          {/* Documents checklist */}
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}>{isRTL ? `المستندات (${doneDocs}/${totalDocs})` : `Documents (${doneDocs}/${totalDocs})`}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DOCUMENT_CHECKLIST.map(doc => {
                const done = deal.documents[doc.key];
                return (
                  <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: done ? (isDark ? 'rgba(74,122,171,0.1)' : '#F0F7FF') : (isDark ? 'rgba(239,68,68,0.05)' : '#FFF5F5'), border: `1px solid ${done ? c.accent + '30' : '#EF444430'}` }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: done ? '#4A7AAB' : 'transparent', border: done ? 'none' : `2px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {done && <CheckCircle size={14} color="#fff" />}
                    </div>
                    <span style={{ fontSize: 13, color: done ? c.text : c.muted, flex: 1 }}>{isRTL ? doc.ar : doc.en}</span>
                    {doc.required && !done && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>{isRTL ? 'مطلوب' : 'Required'}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Installments in drawer */}
          {dealInstallments.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}>{isRTL ? 'الأقساط' : 'Installments'}</h3>
              {dealInstallments.map(inst => {
                const pCfg = PAYMENT_STATUS_CONFIG[inst.status] || {};
                return (
                  <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: isDark ? 'rgba(74,122,171,0.05)' : '#F8FAFC', border: `1px solid ${c.border}` }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{isRTL ? `قسط ${inst.num}` : `Inst. ${inst.num}`}</span>
                      <span style={{ fontSize: 12, color: c.muted, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}> — {inst.due_date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{fmtMoneyShort(inst.amount)}</span>
                      <StatusBadge status={inst.status} config={PAYMENT_STATUS_CONFIG} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Action buttons */}
          {deal.status !== 'completed' && deal.status !== 'cancelled' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => advanceDeal(deal.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: 'none', background: '#1B3347', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(27,51,71,0.2)' }}>
                <ArrowRight size={16} /> {isRTL ? 'نقل للمرحلة التالية' : 'Advance Status'}
              </button>
              <button onClick={() => { if (window.confirm(isRTL ? 'هل أنت متأكد من إلغاء الصفقة؟' : 'Cancel this deal?')) cancelDeal(deal.id); }}
                style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid #EF4444`, background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          )}
          {deal.status === 'completed' && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(74,122,171,0.08)', textAlign: 'center' }}>
              <CheckCircle size={20} color="#4A7AAB" style={{ marginBottom: 4 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#4A7AAB' }}>{isRTL ? 'الصفقة مكتملة' : 'Deal Completed'}</p>
            </div>
          )}
          {deal.status === 'cancelled' && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', textAlign: 'center' }}>
              <X size={20} color="#EF4444" style={{ marginBottom: 4 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{isRTL ? 'الصفقة ملغية' : 'Deal Cancelled'}</p>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={FileCheck} label={isRTL ? 'صفقات نشطة' : 'Active Deals'} value={activeDeals} sub={isRTL ? `${newDeals} جديدة` : `${newDeals} new`} color="#4A7AAB" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'أقساط متأخرة' : 'Overdue Payments'} value={overduePayments.length} sub={fmtMoney(overdueSum)} color="#EF4444" />
          <KpiCard icon={KeyRound} label={isRTL ? 'تسليمات قريبة' : 'Upcoming Handovers'} value={handoverThisMonth} color="#2B4C6F" />
          <KpiCard icon={Headphones} label={isRTL ? 'تذاكر مفتوحة' : 'Open Tickets'} value={openTickets} sub={isRTL ? `${complaints} شكوى` : `${complaints} complaints`} color="#F97316" />
        </div>
        {/* Pipeline bar */}
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: c.text, textAlign: isRTL ? 'right' : 'left' }}>{isRTL ? 'خط سير الصفقات' : 'Deal Pipeline'}</h3>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28 }}>
            {pipelineCounts.filter(p => p.count > 0).map(p => (
              <div key={p.key} title={`${p.label}: ${p.count}`} style={{ flex: p.count, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'flex 0.3s', minWidth: p.count > 0 ? 32 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{p.count}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
            {pipelineCounts.filter(p => p.count > 0).map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: 11, color: c.muted }}>{p.label} ({p.count})</span>
              </div>
            ))}
          </div>
        </div>
        {/* Activity timeline */}
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: c.text, textAlign: isRTL ? 'right' : 'left' }}>{isRTL ? 'آخر الأنشطة' : 'Recent Activity'}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sortedActivity.map((act, idx) => {
              const actCfg = ACT_TYPE[act.type] || { icon: Clock, color: '#8BA8C8' };
              const ActIcon = actCfg.icon;
              const time = new Date(act.timestamp);
              const timeStr = `${time.getDate()}/${time.getMonth() + 1} ${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={act.id} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: idx < sortedActivity.length - 1 ? `1px solid ${c.border}` : 'none', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: actCfg.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ActIcon size={16} color={actCfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}>
                    <p style={{ margin: 0, fontSize: 13, color: c.text, lineHeight: 1.5 }}>{isRTL ? act.description_ar : act.description_en}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: c.muted }}>{isRTL ? act.user_ar : act.user_en} — {timeStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ── DEALS TAB ───────────────────────────────────────────────────────
  function renderDeals() {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={Plus} label={isRTL ? 'صفقات جديدة' : 'New Deals'} value={newDeals} color="#4A7AAB" />
          <KpiCard icon={Clock} label={isRTL ? 'قيد المراجعة' : 'Under Review'} value={underReview} color="#6B8DB5" />
          <KpiCard icon={FileText} label={isRTL ? 'بانتظار التوقيع' : 'Awaiting Signature'} value={awaitingSign} color="#2B4C6F" />
          <KpiCard icon={CheckCircle} label={isRTL ? 'مكتملة' : 'Completed'} value={completedDeals} color="#1B3347" />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <FilterPills items={Object.entries(DEAL_STATUS_CONFIG)} active={dealFilter} onChange={setDealFilter} />
          <div style={{ flex: 1 }} />
          <SearchBar placeholder={isRTL ? 'بحث بالاسم أو رقم الصفقة...' : 'Search by name or deal #...'} />
          <AddBtn label={isRTL ? '+ صفقة جديدة' : '+ New Deal'} onClick={() => setShowDealModal(true)} />
        </div>
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}` }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.text }}>{isRTL ? 'قائمة الصفقات' : 'Deals List'}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
              <thead>
                <tr style={{ background: c.thBg, borderBottom: `2px solid ${c.border}` }}>
                  {[isRTL?'#':'#', isRTL?'العميل':'Client', isRTL?'المشروع':'Project', isRTL?'الوحدة':'Unit', isRTL?'القيمة':'Value', isRTL?'المستندات':'Docs', isRTL?'الحالة':'Status', isRTL?'':''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: isRTL ? 'right' : 'left', fontWeight: 700, color: c.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map(deal => {
                  const reqDocs = DOCUMENT_CHECKLIST.filter(d => d.required);
                  const doneDocs = reqDocs.filter(d => deal.documents[d.key]).length;
                  return (
                    <tr key={deal.id}
                      onMouseEnter={() => setHoverRow(deal.id)} onMouseLeave={() => setHoverRow(null)}
                      onClick={() => setSelectedDeal(deal)}
                      style={{ background: hoverRow === deal.id ? c.rowHover : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted, fontWeight: 600 }}>
                        {deal.deal_number}
                        {deal.opportunity_id && <span style={{ marginInlineStart: 6, fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>CRM</span>}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: ACOLORS[deal.id.charCodeAt(5) % ACOLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(isRTL ? deal.client_ar : deal.client_en)}</div>
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontWeight: 600, color: c.text }}>{isRTL ? deal.client_ar : deal.client_en}</div>
                            <div style={{ fontSize: 11, color: c.muted }}>{isRTL ? deal.agent_ar : deal.agent_en}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.text }}>{isRTL ? deal.project_ar : deal.project_en}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>{deal.unit_code}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontWeight: 700, color: c.text, whiteSpace: 'nowrap' }}>{fmtMoneyShort(deal.deal_value)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: doneDocs === reqDocs.length ? '#4A7AAB' : '#EF4444' }}>{doneDocs}/{reqDocs.length}</span>
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: c.border }}>
                            <div style={{ width: `${(doneDocs / reqDocs.length) * 100}%`, height: '100%', borderRadius: 2, background: doneDocs === reqDocs.length ? '#4A7AAB' : '#F97316', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}><StatusBadge status={deal.status} config={DEAL_STATUS_CONFIG} /></td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.accent, padding: 4 }}><Eye size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {filteredDeals.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: c.muted }}>{isRTL ? 'لا توجد صفقات' : 'No deals found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  // ── PAYMENTS TAB ────────────────────────────────────────────────────
  function renderPayments() {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={DollarSign} label={isRTL ? 'إجمالي المستحق' : 'Total Due'} value={fmtMoneyShort(totalDue)} color="#4A7AAB" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'متأخر السداد' : 'Overdue'} value={overduePayments.length} sub={fmtMoney(overdueSum)} color="#EF4444" />
          <KpiCard icon={TrendingUp} label={isRTL ? 'محصّل هذا الشهر' : 'Collected This Month'} value={fmtMoneyShort(paidSum)} color="#2B4C6F" />
          <KpiCard icon={PieChart} label={isRTL ? 'نسبة التحصيل' : 'Collection Rate'} value={`${collectionRate}%`} color="#1B3347" />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <FilterPills items={Object.entries(PAYMENT_STATUS_CONFIG)} active={payFilter} onChange={setPayFilter} />
          <div style={{ flex: 1 }} />
          <SearchBar placeholder={isRTL ? 'بحث...' : 'Search...'} />
          <AddBtn label={isRTL ? '+ تسجيل دفعة' : '+ Record Payment'} onClick={() => setShowPaymentModal(true)} />
        </div>
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}` }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.text }}>{isRTL ? 'جدول المدفوعات' : 'Payments Schedule'}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
              <thead>
                <tr style={{ background: c.thBg, borderBottom: `2px solid ${c.border}` }}>
                  {[isRTL?'الصفقة':'Deal', isRTL?'العميل':'Client', isRTL?'المشروع':'Project', isRTL?'القسط':'Inst.', isRTL?'المبلغ':'Amount', isRTL?'تاريخ الاستحقاق':'Due Date', isRTL?'الحالة':'Status', isRTL?'إيصال':'Receipt'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: isRTL ? 'right' : 'left', fontWeight: 700, color: c.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(inst => {
                  const isOverdue = inst.status === 'overdue';
                  const overdueDays = isOverdue ? daysSince(inst.due_date) : 0;
                  return (
                    <tr key={inst.id}
                      onMouseEnter={() => setHoverRow(inst.id)} onMouseLeave={() => setHoverRow(null)}
                      style={{ background: hoverRow === inst.id ? c.rowHover : (isOverdue ? (isDark ? 'rgba(239,68,68,0.05)' : '#FFF5F5') : 'transparent'), transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted, fontWeight: 600 }}>{inst.deal_number}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontWeight: 600, color: c.text }}>{isRTL ? inst.client_ar : inst.client_en}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>{isRTL ? inst.project_ar : inst.project_en}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.text, textAlign: 'center' }}>{inst.num}/{inst.total}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontWeight: 700, color: c.text, whiteSpace: 'nowrap' }}>{fmtMoney(inst.amount)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: isOverdue ? '#EF4444' : c.muted, whiteSpace: 'nowrap' }}>
                        {inst.due_date}
                        {isOverdue && <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', display: 'block' }}>{isRTL ? `متأخر ${overdueDays} يوم` : `${overdueDays}d overdue`}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}><StatusBadge status={inst.status} config={PAYMENT_STATUS_CONFIG} /></td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>
                        {inst.receipt ? inst.receipt : ['due','overdue'].includes(inst.status) ? (
                          <button onClick={(e) => { e.stopPropagation(); recordPayment(inst.id); }}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            {isRTL ? 'تأكيد الدفع' : 'Confirm'}
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {filteredPayments.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: c.muted }}>{isRTL ? 'لا توجد مدفوعات' : 'No payments found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={Building2} label={isRTL ? 'وحدات محجوزة' : 'Reserved Units'} value={reservedCount} color="#4A7AAB" />
          <KpiCard icon={Clock} label={isRTL ? 'تحت الإنشاء' : 'Under Construction'} value={constructionCount} color="#6B8DB5" />
          <KpiCard icon={KeyRound} label={isRTL ? 'جاهز للتسليم' : 'Ready'} value={MOCK_HANDOVERS.filter(h => h.status === 'ready').length} color="#2B4C6F" />
          <KpiCard icon={CheckCircle} label={isRTL ? 'تم التسليم' : 'Handed Over'} value={handedCount} color="#1B3347" />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <FilterPills items={Object.entries(HANDOVER_STATUS_CONFIG)} active={handoverFilter} onChange={setHandoverFilter} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredHandovers.map(ho => (
            <HandoverCard key={ho.id} ho={ho} c={c} isRTL={isRTL} isDark={isDark} />
          ))}
          {filteredHandovers.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: c.muted, gridColumn: '1 / -1' }}>{isRTL ? 'لا توجد تسليمات' : 'No handovers found'}</div>
          )}
        </div>
      </>
    );
  }

  // ── AFTER-SALES TAB ─────────────────────────────────────────────────
  function renderAfterSales() {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={AlertCircle} label={isRTL ? 'تذاكر مفتوحة' : 'Open Tickets'} value={openTickets} color="#EF4444" />
          <KpiCard icon={Clock} label={isRTL ? 'متوسط وقت الحل' : 'Avg Resolution'} value={resolvedTickets.length > 0 ? `${Math.round(resolvedTickets.reduce((s, t) => s + daysSince(t.created_at) - (daysSince(t.resolved_at) || 0), 0) / resolvedTickets.length)}d` : '-'} color="#4A7AAB" />
          <KpiCard icon={AlertTriangle} label={isRTL ? 'شكاوى مفتوحة' : 'Open Complaints'} value={complaints} color="#F97316" />
          <KpiCard icon={Star} label={isRTL ? 'رضا العملاء' : 'Satisfaction'} value={`${avgRating}/5`} color="#2B4C6F" />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <FilterPills items={Object.entries(TICKET_STATUS_CONFIG)} active={ticketFilter} onChange={setTicketFilter} />
          <div style={{ flex: 1 }} />
          <AddBtn label={isRTL ? '+ تذكرة جديدة' : '+ New Ticket'} onClick={() => setShowTicketModal(true)} />
        </div>
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}` }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.text }}>{isRTL ? 'قائمة التذاكر' : 'Tickets List'}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
              <thead>
                <tr style={{ background: c.thBg, borderBottom: `2px solid ${c.border}` }}>
                  {[isRTL?'#':'#', isRTL?'العميل':'Client', isRTL?'النوع':'Type', isRTL?'الموضوع':'Subject', isRTL?'الأولوية':'Priority', isRTL?'مسؤول':'Assigned', isRTL?'التاريخ':'Date', isRTL?'الحالة':'Status', isRTL?'التقييم':'Rating'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: isRTL ? 'right' : 'left', fontWeight: 700, color: c.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(tk => {
                  const typeCfg = TICKET_TYPE_CONFIG[tk.type] || {};
                  const prioCfg = PRIORITY_CONFIG[tk.priority] || {};
                  const TypeIcon = TICKET_TYPE_ICONS[tk.type] || HelpCircle;
                  return (
                    <tr key={tk.id}
                      onMouseEnter={() => setHoverRow(tk.id)} onMouseLeave={() => setHoverRow(null)}
                      style={{ background: hoverRow === tk.id ? c.rowHover : 'transparent', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted, fontWeight: 600 }}>{tk.ticket_number}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontWeight: 600, color: c.text }}>{isRTL ? tk.client_ar : tk.client_en}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: typeCfg.color + '15', color: typeCfg.color, fontSize: 11, fontWeight: 600 }}>
                          <TypeIcon size={12} /> {isRTL ? typeCfg.ar : typeCfg.en}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isRTL ? tk.subject_ar : tk.subject_en}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: prioCfg.color }}>{isRTL ? prioCfg.ar : prioCfg.en}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>{isRTL ? tk.assigned_ar : tk.assigned_en}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted, whiteSpace: 'nowrap' }}>{tk.created_at}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}` }}><StatusBadge status={tk.status} config={TICKET_STATUS_CONFIG} /></td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, textAlign: 'center' }}>
                        {tk.rating ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                            <Star size={13} color="#F59E0B" fill="#F59E0B" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{tk.rating}</span>
                          </div>
                        ) : <span style={{ color: c.muted }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredTickets.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: c.muted }}>{isRTL ? 'لا توجد تذاكر' : 'No tickets found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  // ── Modals ─────────────────────────────────────────────────────────
  const AGENTS = ['أحمد محمد','سارة علي','محمود حسن','نورا احمد','خالد عمر'];
  const PROJECTS = [{ar:'سيليا العاصمة الادارية',en:'Celia New Capital',dev_ar:'طلعت مصطفى',dev_en:'Talaat Moustafa'},{ar:'ريفان الشيخ زايد',en:'Rivan Sheikh Zayed',dev_ar:'ريبورتاج',dev_en:'Reportage'},{ar:'بلو تري المرج',en:'Blue Tree El Marg',dev_ar:'سيتي إيدج',dev_en:'City Edge'},{ar:'تاون جيت 6 اكتوبر',en:'Town Gate October',dev_ar:'اورا',dev_en:'ORA'}];

  function ModalOverlay({ title, onClose, children }) {
    return (
      <>
        <div onClick={onClose} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1100 }} />
        <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', background:c.card, borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', zIndex:1101, direction:isRTL?'rtl':'ltr' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:`1px solid ${c.border}` }}>
            <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:c.text }}>{title}</h2>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:c.muted, padding:4 }}><X size={20} /></button>
          </div>
          <div style={{ padding:24 }}>{children}</div>
        </div>
      </>
    );
  }

  function FieldLabel({ children }) {
    return <label style={{ display:'block', fontSize:12, fontWeight:600, color:c.muted, marginBottom:6 }}>{children}</label>;
  }

  function FieldInput(props) {
    return <input {...props} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:`1px solid ${c.border}`, background:c.input, color:c.text, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', ...(props.style||{}) }} />;
  }

  function FieldSelect({ children, ...props }) {
    return <select {...props} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:`1px solid ${c.border}`, background:c.input, color:c.text, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', ...(props.style||{}) }}>{children}</select>;
  }

  function PrimaryBtn({ children, onClick, color='#1B3347' }) {
    const [h, setH] = useState(false);
    return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:h?'#2B4C6F':color, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transform:h?'translateY(-1px)':'none', boxShadow:h?'0 6px 16px rgba(27,51,71,0.35)':'0 2px 6px rgba(27,51,71,0.2)', transition:'all 0.2s' }}>{children}</button>;
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
      <ModalOverlay title={isRTL?'صفقة جديدة':'New Deal'} onClose={()=>setShowDealModal(false)}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div><FieldLabel>{isRTL?'اسم العميل (عربي)':'Client Name (Arabic)'}</FieldLabel><FieldInput value={form.client_ar} onChange={e=>set('client_ar',e.target.value)} placeholder={isRTL?'محمد أحمد':'Mohamed Ahmed'} /></div>
          <div><FieldLabel>{isRTL?'رقم الموبايل':'Phone'}</FieldLabel><FieldInput value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="01xxxxxxxxx" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><FieldLabel>{isRTL?'المشروع':'Project'}</FieldLabel><FieldSelect value={form.project} onChange={e=>set('project',Number(e.target.value))}>{PROJECTS.map((p,i)=><option key={i} value={i}>{isRTL?p.ar:p.en}</option>)}</FieldSelect></div>
            <div><FieldLabel>{isRTL?'كود الوحدة':'Unit Code'}</FieldLabel><FieldInput value={form.unit_code} onChange={e=>set('unit_code',e.target.value)} placeholder="A-101" /></div>
          </div>
          <div><FieldLabel>{isRTL?'السيلز':'Agent'}</FieldLabel><FieldSelect value={form.agent} onChange={e=>set('agent',e.target.value)}><option value="">{isRTL?'اختر':'Select'}</option>{AGENTS.map(a=><option key={a} value={a}>{a}</option>)}</FieldSelect></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><FieldLabel>{isRTL?'قيمة الصفقة':'Deal Value'}</FieldLabel><FieldInput type="number" value={form.deal_value} onChange={e=>set('deal_value',e.target.value)} placeholder="2,500,000" /></div>
            <div><FieldLabel>{isRTL?'المقدم':'Down Payment'}</FieldLabel><FieldInput type="number" value={form.down_payment} onChange={e=>set('down_payment',e.target.value)} placeholder="500,000" /></div>
          </div>
          <div><FieldLabel>{isRTL?'عدد الأقساط':'Installments'}</FieldLabel><FieldInput type="number" value={form.installments_count} onChange={e=>set('installments_count',e.target.value)} /></div>
          <PrimaryBtn onClick={submit}>{isRTL?'إضافة الصفقة':'Add Deal'}</PrimaryBtn>
        </div>
      </ModalOverlay>
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
      <ModalOverlay title={isRTL?'تذكرة جديدة':'New Ticket'} onClose={()=>setShowTicketModal(false)}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div><FieldLabel>{isRTL?'اسم العميل':'Client Name'}</FieldLabel><FieldInput value={form.client_ar} onChange={e=>set('client_ar',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><FieldLabel>{isRTL?'النوع':'Type'}</FieldLabel><FieldSelect value={form.type} onChange={e=>set('type',e.target.value)}>{Object.entries(TICKET_TYPE_CONFIG).map(([k,v])=><option key={k} value={k}>{isRTL?v.ar:v.en}</option>)}</FieldSelect></div>
            <div><FieldLabel>{isRTL?'الأولوية':'Priority'}</FieldLabel><FieldSelect value={form.priority} onChange={e=>set('priority',e.target.value)}>{Object.entries(PRIORITY_CONFIG).map(([k,v])=><option key={k} value={k}>{isRTL?v.ar:v.en}</option>)}</FieldSelect></div>
          </div>
          <div><FieldLabel>{isRTL?'الموضوع':'Subject'}</FieldLabel><FieldInput value={form.subject_ar} onChange={e=>set('subject_ar',e.target.value)} /></div>
          <div><FieldLabel>{isRTL?'المسؤول':'Assigned To'}</FieldLabel><FieldSelect value={form.assigned} onChange={e=>set('assigned',e.target.value)}><option value="">{isRTL?'اختر':'Select'}</option>{AGENTS.map(a=><option key={a} value={a}>{a}</option>)}</FieldSelect></div>
          <PrimaryBtn onClick={submit}>{isRTL?'فتح التذكرة':'Open Ticket'}</PrimaryBtn>
        </div>
      </ModalOverlay>
    );
  }

  function RecordPaymentModal() {
    const unpaid = installments.filter(i => ['due','overdue','upcoming'].includes(i.status));
    const [selected, setSelected] = useState('');
    return (
      <ModalOverlay title={isRTL?'تسجيل دفعة':'Record Payment'} onClose={()=>setShowPaymentModal(false)}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div><FieldLabel>{isRTL?'اختر القسط':'Select Installment'}</FieldLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:300, overflowY:'auto' }}>
              {unpaid.map(inst => {
                const isOv = inst.status === 'overdue';
                const active = selected === inst.id;
                return (
                  <div key={inst.id} onClick={()=>setSelected(inst.id)}
                    style={{ padding:'12px 14px', borderRadius:10, border:`2px solid ${active ? c.accent : c.border}`, background: active ? c.accent+'10' : (isOv ? 'rgba(239,68,68,0.04)' : 'transparent'), cursor:'pointer', transition:'all 0.2s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:c.text }}>{isRTL?inst.client_ar:inst.client_en}</div>
                        <div style={{ fontSize:11, color:c.muted }}>{inst.deal_number} — {isRTL?`قسط ${inst.num}/${inst.total}`:`Inst. ${inst.num}/${inst.total}`}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:c.text }}>{fmtMoneyShort(inst.amount)}</div>
                        <div style={{ fontSize:11, color:isOv?'#EF4444':c.muted }}>{inst.due_date}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {unpaid.length === 0 && <p style={{ textAlign:'center', color:c.muted, padding:20 }}>{isRTL?'لا توجد أقساط مستحقة':'No pending installments'}</p>}
            </div>
          </div>
          {selected && <PrimaryBtn onClick={()=>recordPayment(selected)} color="#2B4C6F">{isRTL?'تأكيد الدفع':'Confirm Payment'}</PrimaryBtn>}
        </div>
      </ModalOverlay>
    );
  }

  // ── Main Render ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: c.bg, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#1B3347,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(74,122,171,0.3)' }}>
            <ClipboardCheck size={22} color="#fff" />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.text }}>{isRTL ? 'العمليات' : 'Operations'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{isRTL ? 'إدارة الصفقات والمدفوعات والتسليمات' : 'Manage deals, payments & handovers'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: isDark ? 'rgba(74,122,171,0.08)' : '#F1F5F9', padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const TabIcon = tab.Icon;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500, background: active ? c.card : 'transparent', color: active ? c.accent : c.muted, boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
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
          <div onClick={() => setSelectedDeal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
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
