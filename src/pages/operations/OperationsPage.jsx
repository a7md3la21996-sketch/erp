import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  BarChart2, FileCheck, Banknote, KeyRound, Headphones,
  AlertTriangle, Clock, CheckCircle, Plus, Search, Filter,
  ChevronDown, DollarSign, TrendingUp, PieChart, Building2,
  Star, Phone, MessageSquare, FileText, Eye, ArrowRight,
  ChevronRight, User, Calendar, Hash, CreditCard, Send,
  Printer, MoreVertical, X, ClipboardCheck, Wrench, HelpCircle,
  Edit3, AlertCircle, ChevronLeft,
} from 'lucide-react';
import {
  DEAL_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, HANDOVER_STATUS_CONFIG,
  TICKET_STATUS_CONFIG, TICKET_TYPE_CONFIG, PRIORITY_CONFIG, DOCUMENT_CHECKLIST,
  MOCK_OPS_DEALS, MOCK_INSTALLMENTS, MOCK_HANDOVERS, MOCK_TICKETS,
  MOCK_OPS_ACTIVITY, fmtMoney, fmtMoneyShort, daysSince, daysUntil,
} from '../../data/operations_mock_data';

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

  const c = ds;

  // ── Derived KPIs ────────────────────────────────────────────────────
  const activeDeals      = MOCK_OPS_DEALS.filter(d => d.status !== 'completed' && d.status !== 'cancelled').length;
  const newDeals         = MOCK_OPS_DEALS.filter(d => d.status === 'new_deal').length;
  const underReview      = MOCK_OPS_DEALS.filter(d => d.status === 'under_review').length;
  const awaitingSign     = MOCK_OPS_DEALS.filter(d => d.status === 'contract_prep').length;
  const completedDeals   = MOCK_OPS_DEALS.filter(d => d.status === 'completed').length;

  const overduePayments  = MOCK_INSTALLMENTS.filter(i => i.status === 'overdue');
  const overdueSum       = overduePayments.reduce((s, i) => s + i.amount, 0);
  const duePayments      = MOCK_INSTALLMENTS.filter(i => i.status === 'due');
  const paidThisMonth    = MOCK_INSTALLMENTS.filter(i => i.status === 'paid' && i.paid_date?.startsWith('2026-03'));
  const paidSum          = paidThisMonth.reduce((s, i) => s + i.amount, 0);
  const totalDue         = MOCK_INSTALLMENTS.filter(i => ['due', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPaid        = MOCK_INSTALLMENTS.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const collectionRate   = totalPaid + totalDue > 0 ? Math.round((totalPaid / (totalPaid + totalDue)) * 100) : 0;

  const handoverThisMonth = MOCK_HANDOVERS.filter(h => h.expected_handover?.startsWith('2026-03') || h.expected_handover?.startsWith('2026-04')).length;
  const openTickets      = MOCK_TICKETS.filter(t => ['open', 'in_progress'].includes(t.status)).length;
  const complaints       = MOCK_TICKETS.filter(t => t.type === 'complaint' && ['open', 'in_progress'].includes(t.status)).length;
  const resolvedTickets  = MOCK_TICKETS.filter(t => t.resolved_at);
  const avgRating        = resolvedTickets.filter(t => t.rating).length > 0
    ? (resolvedTickets.filter(t => t.rating).reduce((s, t) => s + t.rating, 0) / resolvedTickets.filter(t => t.rating).length).toFixed(1)
    : '-';

  // ── Filtered data ───────────────────────────────────────────────────
  const filteredDeals = useMemo(() => {
    let d = MOCK_OPS_DEALS;
    if (dealFilter !== 'all') d = d.filter(deal => deal.status === dealFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      d = d.filter(deal => deal.client_ar.includes(s) || deal.client_en.toLowerCase().includes(s) || deal.deal_number.toLowerCase().includes(s) || deal.project_ar.includes(s));
    }
    return d;
  }, [dealFilter, searchTerm]);

  const filteredPayments = useMemo(() => {
    let p = MOCK_INSTALLMENTS;
    if (payFilter !== 'all') p = p.filter(i => i.status === payFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      p = p.filter(i => i.client_ar.includes(s) || i.client_en.toLowerCase().includes(s) || i.deal_number.toLowerCase().includes(s));
    }
    return p;
  }, [payFilter, searchTerm]);

  const filteredHandovers = useMemo(() => {
    let h = MOCK_HANDOVERS;
    if (handoverFilter !== 'all') h = h.filter(ho => ho.status === handoverFilter);
    return h;
  }, [handoverFilter]);

  const filteredTickets = useMemo(() => {
    let t = MOCK_TICKETS;
    if (ticketFilter !== 'all') t = t.filter(tk => tk.status === ticketFilter);
    return t;
  }, [ticketFilter]);

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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
        {isRTL ? cfg.ar : cfg.en}
      </span>
    );
  }

  function FilterPills({ items, active, onChange }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => onChange('all')} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${active === 'all' ? c.accent : c.border}`, background: active === 'all' ? c.accent + '18' : 'transparent', color: active === 'all' ? c.accent : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}>
          {isRTL ? 'الكل' : 'All'}
        </button>
        {items.map(([key, cfg]) => (
          <button key={key} onClick={() => onChange(key)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${active === key ? cfg.color + '60' : c.border}`, background: active === key ? cfg.bg : 'transparent', color: active === key ? cfg.color : c.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}>
            {isRTL ? cfg.ar : cfg.en}
          </button>
        ))}
      </div>
    );
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
    const dealInstallments = MOCK_INSTALLMENTS.filter(i => i.deal_id === deal.id);
    const dealHandover = MOCK_HANDOVERS.find(h => h.deal_id === deal.id);
    const totalDocs = DOCUMENT_CHECKLIST.filter(d => d.required).length;
    const doneDocs = DOCUMENT_CHECKLIST.filter(d => d.required && deal.documents[d.key]).length;
    return (
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: c.card, zIndex: 1000, boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>
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
        </div>
      </div>
    );
  }

  // ── OVERVIEW TAB ────────────────────────────────────────────────────
  function renderOverview() {
    const sortedActivity = [...MOCK_OPS_ACTIVITY].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const pipelineCounts = Object.entries(DEAL_STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([key, cfg]) => ({
      key, label: isRTL ? cfg.ar : cfg.en, color: cfg.color, count: MOCK_OPS_DEALS.filter(d => d.status === key).length,
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
        </div>
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[isRTL?'#':'#', isRTL?'العميل':'Client', isRTL?'المشروع':'Project', isRTL?'الوحدة':'Unit', isRTL?'القيمة':'Value', isRTL?'المستندات':'Docs', isRTL?'الحالة':'Status', isRTL?'':''].map((h, i) => (
                    <th key={i} style={{ padding: '12px 14px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: c.muted, fontSize: 12, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
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
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted, fontWeight: 600 }}>{deal.deal_number}</td>
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
        </div>
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[isRTL?'الصفقة':'Deal', isRTL?'العميل':'Client', isRTL?'المشروع':'Project', isRTL?'القسط':'Inst.', isRTL?'المبلغ':'Amount', isRTL?'تاريخ الاستحقاق':'Due Date', isRTL?'الحالة':'Status', isRTL?'إيصال':'Receipt'].map((h, i) => (
                    <th key={i} style={{ padding: '12px 14px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: c.muted, fontSize: 12, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
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
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, color: c.muted }}>{inst.receipt || '—'}</td>
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
          {filteredHandovers.map(ho => {
            const hCfg = HANDOVER_STATUS_CONFIG[ho.status] || {};
            const dLeft = daysUntil(ho.expected_handover);
            const [cardHov, setCardHov] = useState(false);
            return (
              <div key={ho.id}
                onMouseEnter={() => setCardHov(true)} onMouseLeave={() => setCardHov(false)}
                style={{ background: c.card, borderRadius: 14, border: `1px solid ${cardHov ? hCfg.color + '60' : c.border}`, padding: 20, transition: 'all 0.2s', transform: cardHov ? 'translateY(-2px)' : 'none', boxShadow: cardHov ? '0 8px 24px rgba(0,0,0,0.08)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: c.text }}>{isRTL ? ho.client_ar : ho.client_en}</h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: c.muted }}>{ho.deal_number} — {ho.unit_code}</p>
                  </div>
                  <StatusBadge status={ho.status} config={HANDOVER_STATUS_CONFIG} />
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
                {ho.notes_ar && <p style={{ margin: '10px 0 0', fontSize: 11, color: c.muted, textAlign: isRTL ? 'right' : 'left' }}>{isRTL ? ho.notes_ar : ho.notes_ar}</p>}
              </div>
            );
          })}
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
        </div>
        <div style={{ background: c.card, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[isRTL?'#':'#', isRTL?'العميل':'Client', isRTL?'النوع':'Type', isRTL?'الموضوع':'Subject', isRTL?'الأولوية':'Priority', isRTL?'مسؤول':'Assigned', isRTL?'التاريخ':'Date', isRTL?'الحالة':'Status', isRTL?'التقييم':'Rating'].map((h, i) => (
                    <th key={i} style={{ padding: '12px 14px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: c.muted, fontSize: 12, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
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

  // ── Main Render ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>
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
          <div onClick={() => setSelectedDeal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
          <DealDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
        </>
      )}
    </div>
  );
}
