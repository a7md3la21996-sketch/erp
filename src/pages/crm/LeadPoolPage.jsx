import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Phone, Clock, AlertTriangle, CheckSquare, Filter,
  Search, UserPlus, Flame, Bell, X, Lock,
  Plus, Zap
} from 'lucide-react';
import { P } from '../../config/roles';
import { Button, Card, Input, Select, Badge, KpiCard, Modal, ModalFooter, FilterPill } from '../../components/ui';

// ── Constants ──────────────────────────────────────────────────────────────
const SOURCES = {
  google:   { ar: 'جوجل',    en: 'Google',   weight: 3,   color: '#EF4444', seniorOnly: true },
  tiktok:   { ar: 'تيك توك', en: 'TikTok',   weight: 2.5, color: '#2B4C6F' },
  meta:     { ar: 'ميتا',    en: 'Meta',     weight: 2,   color: '#4A7AAB' },
  organic:  { ar: 'أورجانيك',en: 'Organic',  weight: 1.5, color: '#6B8DB5' },
  cold_call:{ ar: 'كولد كول',en: 'Cold Call',weight: 1,   color: '#8BA8C8' },
};

const LEVELS = {
  top_senior: { ar: 'توب سينيور', en: 'Top Performer Senior', weight: 10, dailyCap: 10 },
  senior:     { ar: 'سينيور',    en: 'Senior',     weight: 8,  dailyCap: 8  },
  mid_senior: { ar: 'ميد سينيور',en: 'Mid Senior',  weight: 6,  dailyCap: 6  },
  junior:     { ar: 'جونيور',    en: 'Junior',      weight: 4,  dailyCap: 4  },
  mid_junior: { ar: 'ميد جونيور',en: 'Mid Junior',  weight: 2,  dailyCap: 2  },
  fresh:      { ar: 'فريش',      en: 'Fresh',       weight: 0,  dailyCap: 0  },
};

const SLA_MINUTES = { google: 15, tiktok: 20, meta: 30, organic: 60, cold_call: 1440 };

// ── Mock Sales Team ────────────────────────────────────────────────────────
const MOCK_AGENTS = [
  { id: 'a1', name_ar: 'سارة علي',     name_en: 'Sara Ali',      level: 'senior',     team: 'team1', today_count: 3 },
  { id: 'a2', name_ar: 'محمد خالد',    name_en: 'Mohamed Khaled',level: 'mid_senior', team: 'team1', today_count: 2 },
  { id: 'a3', name_ar: 'علي حسن',      name_en: 'Ali Hassan',    level: 'junior',     team: 'team2', today_count: 1 },
  { id: 'a4', name_ar: 'ريم أحمد',     name_en: 'Reem Ahmed',    level: 'mid_junior', team: 'team2', today_count: 1 },
  { id: 'a5', name_ar: 'كريم مصطفى',   name_en: 'Karim Mostafa', level: 'top_senior', team: 'team1', today_count: 5 },
];

// ── Mock Pool Data ─────────────────────────────────────────────────────────
function makeMockLeads() {
  const now = Date.now();
  return [
    { id: 'l1', name: 'أحمد محمد السيد',   phone: '01012345678', source: 'google',    type: 'fresh',     score: 90, created_at: new Date(now - 8*60*1000).toISOString(),   assigned_to: null, team: 'team1', reserved_by: null, reserved_until: null },
    { id: 'l2', name: 'منى عبدالله حسن',   phone: '01123456789', source: 'meta',      type: 'fresh',     score: 72, created_at: new Date(now - 45*60*1000).toISOString(),  assigned_to: null, team: 'team1', reserved_by: null, reserved_until: null },
    { id: 'l3', name: 'خالد إبراهيم عمر',  phone: '01234567890', source: 'cold_call', type: 'cold_call', score: 30, created_at: new Date(now - 3*60*60*1000).toISOString(), assigned_to: null, team: 'team2', reserved_by: null, reserved_until: null },
    { id: 'l4', name: 'هدى محمود طه',      phone: '01087654321', source: 'tiktok',    type: 'fresh',     score: 65, created_at: new Date(now - 2*60*60*1000).toISOString(), assigned_to: null, team: 'team1', reserved_by: null, reserved_until: null },
    { id: 'l5', name: 'يوسف رمضان علي',    phone: '01099887766', source: 'organic',   type: 'fresh',     score: 45, created_at: new Date(now - 26*60*60*1000).toISOString(),assigned_to: null, team: 'team2', reserved_by: null, reserved_until: null },
    { id: 'l6', name: 'نادية سامي عيسى',   phone: '01144556677', source: 'cold_call', type: 'cold_call', score: 20, created_at: new Date(now - 5*60*1000).toISOString(),   assigned_to: null, team: 'team2', reserved_by: null, reserved_until: null },
    { id: 'l7', name: 'طارق جمال حلمي',    phone: '01277889900', source: 'meta',      type: 'fresh',     score: 78, created_at: new Date(now - 90*60*1000).toISOString(),  assigned_to: null, team: 'team1', reserved_by: null, reserved_until: null },
    { id: 'l8', name: 'إيمان حسين فوزي',   phone: '01055443322', source: 'google',    type: 'fresh',     score: 88, created_at: new Date(now - 12*60*1000).toISOString(),  assigned_to: null, team: 'team1', reserved_by: null, reserved_until: null },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getAging(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 60)    return { label: `${mins}د`,           color: '#4A7AAB', dot: 'fresh', level: 'fresh' };
  if (mins < 1440)  return { label: `${Math.floor(mins / 60)}س`, color: '#6B8DB5', dot: 'warn',  level: 'warn'  };
  return              { label: `${Math.floor(mins / 1440)}ي`, color: '#EF4444', dot: 'old',   level: 'old'   };
}

function getSLAStatus(lead) {
  const sla = SLA_MINUTES[lead.source] || 60;
  const elapsed = Math.floor((Date.now() - new Date(lead.created_at)) / 60000);
  const pct = Math.min((elapsed / sla) * 100, 100);
  const remaining = Math.max(sla - elapsed, 0);
  return { pct, remaining, breached: elapsed > sla, elapsed };
}

function getLeadScore(lead) {
  const srcWeight = SOURCES[lead.source]?.weight || 1;
  return Math.min(Math.round(lead.score + srcWeight * 5), 100);
}

export default function LeadPoolPage() {
  const { i18n } = useTranslation();
  const { hasPermission, user } = useAuth();
  const lang  = i18n.language;
  const isRTL  = lang === 'ar';

  const canViewFresh   = hasPermission(P.POOL_VIEW_FRESH);
  const canAssign      = hasPermission(P.POOL_ASSIGN);
  const canManage      = hasPermission(P.POOL_MANAGE);
  const canViewAll     = canManage; // managers/directors see all teams

  const [leads, setLeads]             = useState(() => makeMockLeads());
  const [selected, setSelected]       = useState([]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [agingFilter, setAgingFilter] = useState('all');
  const [search, setSearch]           = useState('');
  const [poolScope, setPoolScope]     = useState('my_team'); // 'my_team' | 'all'
  const [assignModal, setAssignModal] = useState(null); // lead or 'bulk'
  const [addModal, setAddModal]       = useState(false);
  const [newLead, setNewLead]         = useState({ name: '', phone: '', source: 'cold_call' });
  const [tick, setTick]               = useState(0);

  // Tick every 30s to update aging/SLA
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Filter leads based on permissions and filters
  const visible = useMemo(() => {
    return leads.filter(l => {
      if (!canViewFresh && l.type === 'fresh') return false;
      if (canViewAll && poolScope === 'my_team' && l.team !== (user?.team_id || 'team1')) return false;
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;
      if (agingFilter !== 'all') {
        const aging = getAging(l.created_at);
        if (agingFilter !== aging.level) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const src = SOURCES[l.source];
        if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q) && !(src?.ar.includes(q)) && !(src?.en.toLowerCase().includes(q))) return false;
      }
      return true;
    }).sort((a, b) => {
      // Pool Priority Queue: Score DESC, then Aging ASC
      const scoreDiff = getLeadScore(b) - getLeadScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [leads, canViewFresh, canViewAll, poolScope, sourceFilter, typeFilter, agingFilter, search, tick, user?.team_id]);

  // Stats
  const stats = useMemo(() => {
    const fresh = leads.filter(l => l.type === 'fresh');
    const cold  = leads.filter(l => l.type === 'cold_call');
    const slaBreached = leads.filter(l => getSLAStatus(l).breached);
    const avgWait = leads.length ? Math.round(leads.reduce((s, l) => s + (Date.now() - new Date(l.created_at)) / 60000, 0) / leads.length) : 0;
    return { total: leads.length, fresh: fresh.length, cold: cold.length, slaBreached: slaBreached.length, avgWait };
  }, [leads, tick]);

  const handleReserve = (lead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? {
      ...l, reserved_by: user?.id || 'me',
      reserved_until: new Date(Date.now() + 5*60*1000).toISOString()
    } : l));
  };

  const handleAssign = (leadIds, agentId) => {
    setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
    setSelected([]);
    setAssignModal(null);
  };

  const handleAddCold = () => {
    if (!newLead.name || !newLead.phone) return;
    const lead = {
      id: Date.now().toString(),
      name: newLead.name,
      phone: newLead.phone,
      source: 'cold_call',
      type: 'cold_call',
      score: 25,
      created_at: new Date().toISOString(),
      assigned_to: null,
      team: user?.team_id || 'team1',
      reserved_by: null,
      reserved_until: null,
    };
    setLeads(prev => [lead, ...prev]);
    setNewLead({ name: '', phone: '', source: 'cold_call' });
    setAddModal(false);
  };

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(prev => prev.length === visible.length ? [] : visible.map(l => l.id));

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Zap size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'بركة الليدز' : 'Lead Pool'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'إدارة وتوزيع الليدز' : 'Manage & distribute leads'}</p>
          </div>
        </div>
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {selected.length > 0 && canAssign && (
            <Button variant="primary" size="sm" onClick={() => setAssignModal('bulk')} className={isRTL ? 'flex-row-reverse' : ''}>
              <UserPlus size={15} />
              {lang === 'ar' ? `توزيع (${selected.length})` : `Assign (${selected.length})`}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setAddModal(true)} className={isRTL ? 'flex-row-reverse' : ''}>
            <Plus size={15} />
            {lang === 'ar' ? 'كولد كول جديد' : 'Add Cold Call'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
        {[
          { label: lang === 'ar' ? 'إجمالي' : 'Total',         value: stats.total,       icon: Users,        color: '#4A7AAB' },
          { label: lang === 'ar' ? 'فريش' : 'Fresh',           value: stats.fresh,       icon: Flame,        color: '#EF4444', hide: !canViewFresh },
          { label: lang === 'ar' ? 'كولد كول' : 'Cold Calls',  value: stats.cold,        icon: Phone,        color: '#2B4C6F' },
          { label: lang === 'ar' ? 'تعدى SLA' : 'SLA Breached',value: stats.slaBreached, icon: AlertTriangle,color: '#EF4444' },
          { label: lang === 'ar' ? 'متوسط انتظار' : 'Avg Wait', value: `${stats.avgWait}د`, icon: Clock,     color: '#6B8DB5' },
        ].filter(s => !s.hide).map((s, i) => (
          <KpiCard key={i} icon={s.icon} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      {/* SLA Warning */}
      {stats.slaBreached > 0 && (
        <div className={`bg-red-500/[0.08] border border-red-500/30 rounded-xl px-3.5 py-2.5 mb-3.5 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Bell size={15} color="#EF4444" />
          <span className="text-xs text-red-500 font-semibold">
            {lang === 'ar' ? `${stats.slaBreached} ليد تعدى وقت SLA — يحتاج توزيع عاجل` : `${stats.slaBreached} leads breached SLA — urgent assignment needed`}
          </span>
        </div>
      )}

      {/* Filters */}
      <Card className={`px-3.5 py-2.5 mb-3 flex gap-2 flex-wrap items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark start-2.5" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
            size="sm"
            className="ps-[30px] pe-2.5"
          />
        </div>

        {/* Type filter */}
        {canViewFresh && ['all','fresh','cold_call'].map(t => (
          <FilterPill
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            label={t === 'all' ? (lang === 'ar' ? 'الكل' : 'All') : t === 'fresh' ? (lang === 'ar' ? 'فريش' : 'Fresh') : (lang === 'ar' ? 'كولد كول' : 'Cold Call')}
          />
        ))}

        {/* Source filter */}
        <Select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} size="sm" className="w-auto flex-none">
          <option value="all">{lang === 'ar' ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCES).map(([k, v]) => (
            <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
          ))}
        </Select>

        {/* Aging filter */}
        {['all','fresh','warn','old'].map(a => (
          <FilterPill
            key={a}
            active={agingFilter === a}
            onClick={() => setAgingFilter(a)}
            label={a === 'all' ? (lang === 'ar' ? 'الكل' : 'All') : a === 'fresh' ? (lang === 'ar' ? 'جديد' : 'Fresh') : a === 'warn' ? (lang === 'ar' ? 'تحذير' : 'Warn') : (lang === 'ar' ? 'قديم' : 'Old')}
          />
        ))}

        {/* Team / Global Pool Toggle — visible to managers only */}
        {canViewAll && (
          <div className="flex rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            {[
              { value: 'my_team', ar: 'تيمي', en: 'My Team' },
              { value: 'all',     ar: 'الكل',  en: 'All Teams' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setPoolScope(opt.value)} className={`
                px-3.5 py-[7px] text-xs font-semibold border-none cursor-pointer transition-all duration-150
                ${poolScope === opt.value
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}
              `}>
                {lang === 'ar' ? opt.ar : opt.en}
              </button>
            ))}
          </div>
        )}

        {/* Select all */}
        {canAssign && (
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            <CheckSquare size={13} />
            {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
          </Button>
        )}
      </Card>

      {/* Leads List */}
      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <div className="text-center py-[60px] px-5">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <Users size={24} color='#4A7AAB' />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد ليدز في الـ Pool':'No Leads in Pool'}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي ليدز بعد أو جرّب تغيير الفلتر':'No leads found, try changing the filter'}</p>
          </div>
        ) : visible.map((lead, idx) => {
          const aging   = getAging(lead.created_at);
          const sla     = getSLAStatus(lead);
          const src     = SOURCES[lead.source];
          const score   = getLeadScore(lead);
          const isSel   = selected.includes(lead.id);
          const isReserved = lead.reserved_by && new Date(lead.reserved_until) > new Date();

          return (
            <div key={lead.id} className={`
              flex items-center gap-3 px-4 py-3 transition-colors duration-150
              ${idx < visible.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''}
              ${isSel ? 'bg-brand-500/[0.08]' : isReserved ? 'bg-red-500/[0.04]' : 'hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.07]'}
              ${isRTL ? 'flex-row-reverse' : ''}
            `}>
              {/* Checkbox */}
              {canAssign && (
                <input type="checkbox" checked={isSel} onChange={() => toggleSelect(lead.id)}
                  className="w-[15px] h-[15px] cursor-pointer shrink-0 accent-brand-500" />
              )}

              {/* Aging dot */}
              <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: aging.color }} />

              {/* Lead info */}
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-semibold text-content dark:text-content-dark">{lead.name}</span>
                  <Badge size="sm" style={{ background: (src?.color || '#4A7AAB') + '18', color: src?.color || '#4A7AAB' }}>
                    {lang === 'ar' ? src?.ar : src?.en}
                  </Badge>
                  {lead.type === 'fresh' && canViewFresh && (
                    <Badge variant="danger" size="sm">{lang === 'ar' ? 'فريش' : 'Fresh'}</Badge>
                  )}
                  {isReserved && (
                    <Badge variant="info" size="sm">{lang === 'ar' ? 'محجوز' : 'Reserved'}</Badge>
                  )}
                </div>
                <div className={`flex items-center gap-2.5 mt-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">{lead.phone}</span>
                  <span className="text-xs font-medium" style={{ color: aging.color }}>
                    <Clock size={10} className="inline ms-0.5" />
                    {aging.label} {lang === 'ar' ? 'في الانتظار' : 'waiting'}
                  </span>
                </div>

                {/* SLA Bar */}
                <div className="mt-1.5 max-w-[200px]">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark">SLA</span>
                    <span className={`text-[10px] ${sla.breached ? 'text-red-500 font-bold' : 'text-content-muted dark:text-content-muted-dark font-normal'}`}>
                      {sla.breached ? (lang === 'ar' ? 'تعدى الوقت' : 'Breached') : sla.remaining >= 1440 ? `${Math.floor(sla.remaining / 1440)}${lang === 'ar' ? 'ي' : 'd'}` : sla.remaining >= 60 ? `${Math.floor(sla.remaining / 60)}${lang === 'ar' ? 'س' : 'h'}` : `${sla.remaining}${lang === 'ar' ? 'د' : 'm'}`}
                    </span>
                  </div>
                  <div className="h-[3px] rounded-sm bg-edge dark:bg-edge-dark overflow-hidden">
                    <div className={`h-full rounded-sm transition-[width] duration-300 ${sla.breached ? 'bg-red-500' : sla.pct > 75 ? 'bg-[#6B8DB5]' : 'bg-brand-500'}`} style={{ width: sla.pct + '%' }} />
                  </div>
                </div>
              </div>

              {/* Score */}
              <div className="text-center shrink-0">
                <div className={`text-lg font-bold ${score > 75 ? 'text-red-500' : score > 50 ? 'text-[#6B8DB5]' : 'text-brand-500'}`}>{score}</div>
                <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'سكور' : 'Score'}</div>
              </div>

              {/* Actions */}
              <div className={`flex gap-1.5 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {!isReserved && (
                  <Button variant="ghost" size="sm" onClick={() => handleReserve(lead)}>
                    <Lock size={12} />
                    {lang === 'ar' ? 'حجز' : 'Reserve'}
                  </Button>
                )}
                {canAssign && (
                  <Button variant="primary" size="sm" onClick={() => setAssignModal([lead.id])}>
                    <UserPlus size={12} />
                    {lang === 'ar' ? 'توزيع' : 'Assign'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Assign Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={lang === 'ar' ? `توزيع ${assignModal === 'bulk' ? selected.length + ' ليدز' : 'ليد'}` : `Assign ${assignModal === 'bulk' ? selected.length + ' leads' : 'lead'}`}
        width="max-w-md"
      >
        <div className="flex flex-col gap-2">
          {MOCK_AGENTS.map(agent => {
            const level = LEVELS[agent.level];
            const atCap = agent.today_count >= level.dailyCap;
            return (
              <button key={agent.id} onClick={() => !atCap && handleAssign(assignModal === 'bulk' ? selected : assignModal, agent.id)}
                disabled={atCap}
                className={`
                  flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-edge dark:border-edge-dark
                  transition-colors cursor-pointer
                  ${atCap ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-brand-500/[0.07]' : 'bg-transparent hover:bg-gray-50 dark:hover:bg-brand-500/[0.07]'}
                  ${isRTL ? 'flex-row-reverse' : ''}
                `}>
                <div className="text-start">
                  <div className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? agent.name_ar : agent.name_en}</div>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? level.ar : level.en} · وزن {level.weight}</div>
                </div>
                <div className="text-center">
                  <div className={`text-xs font-semibold ${atCap ? 'text-red-500' : 'text-brand-500'}`}>
                    {agent.today_count}/{level.dailyCap}
                  </div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'اليوم' : 'today'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Add Cold Call Modal */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title={lang === 'ar' ? 'إضافة كولد كول' : 'Add Cold Call'}
        width="max-w-sm"
      >
        <div className="flex flex-col gap-3">
          <Input
            value={newLead.name}
            onChange={e => setNewLead(f => ({...f, name: e.target.value}))}
            placeholder={lang === 'ar' ? 'الاسم' : 'Name'}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <Input
            value={newLead.phone}
            onChange={e => setNewLead(f => ({...f, phone: e.target.value}))}
            placeholder={lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
          />
          <ModalFooter className={isRTL ? 'justify-start' : 'justify-end'}>
            <Button variant="secondary" size="sm" onClick={() => setAddModal(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddCold} disabled={!newLead.name || !newLead.phone}>
              {lang === 'ar' ? 'إضافة' : 'Add'}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
