import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Phone, Clock, AlertTriangle, CheckSquare,
  Search, UserPlus, Flame, Bell, Lock,
  Plus, Zap
} from 'lucide-react';
import { P } from '../../config/roles';
import { Button, Card, Badge, KpiCard, Modal, ModalFooter, Input, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { logAction } from '../../services/auditService';

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

// ── Sales Team (loaded from localStorage) ──────────────────────
function loadAgents() {
  try {
    const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
    const names = new Set();
    const agents = [];
    contacts.forEach(c => {
      const name = c.assigned_to_name?.trim();
      if (name && !names.has(name)) {
        names.add(name);
        agents.push({ id: name, name_ar: name, name_en: name, level: 'senior', today_count: 0 });
      }
    });
    return agents;
  } catch { return []; }
}

// ── Pool Data (localStorage) ──────────────────────────────────────────────
function loadLeads() {
  try {
    return JSON.parse(localStorage.getItem('platform_lead_pool') || '[]');
  } catch { return []; }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getAging(dateStr) {
  if (!dateStr) return { label: '—', color: '#6B8DB5', dot: 'warn', level: 'warn' };
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (isNaN(mins)) return { label: '—', color: '#6B8DB5', dot: 'warn', level: 'warn' };
  if (mins < 60)    return { label: `${mins}د`,           color: '#4A7AAB', dot: 'fresh', level: 'fresh' };
  if (mins < 1440)  return { label: `${Math.floor(mins / 60)}س`, color: '#6B8DB5', dot: 'warn',  level: 'warn'  };
  return              { label: `${Math.floor(mins / 1440)}ي`, color: '#EF4444', dot: 'old',   level: 'old'   };
}

function getSLAStatus(lead) {
  const sla = SLA_MINUTES[lead.source] || 60;
  const elapsed = lead.created_at ? Math.floor((Date.now() - new Date(lead.created_at)) / 60000) : 0;
  if (isNaN(elapsed)) return { pct: 0, remaining: sla, breached: false, elapsed: 0 };
  const pct = Math.min((elapsed / sla) * 100, 100);
  const remaining = Math.max(sla - elapsed, 0);
  return { pct, remaining, breached: elapsed > sla, elapsed };
}

function getLeadScore(lead) {
  const srcWeight = SOURCES[lead.source]?.weight || 1;
  return Math.min(Math.round(lead.score + srcWeight * 5), 100);
}

// ── SmartFilter field definitions (static parts) ──────────────────────────
const SMART_FIELDS_STATIC = [
  {
    id: 'source', label: 'المصدر', labelEn: 'Source', type: 'select',
    options: Object.entries(SOURCES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
  },
  {
    id: 'type', label: 'النوع', labelEn: 'Type', type: 'select',
    options: [
      { value: 'fresh', label: 'فريش', labelEn: 'Fresh' },
      { value: 'cold_call', label: 'كولد كول', labelEn: 'Cold Call' },
    ],
  },
  {
    id: '_aging_level', label: 'العمر', labelEn: 'Aging', type: 'select',
    options: [
      { value: 'fresh', label: 'جديد', labelEn: 'Fresh' },
      { value: 'warn', label: 'تحذير', labelEn: 'Warn' },
      { value: 'old', label: 'قديم', labelEn: 'Old' },
    ],
  },
  { id: 'score', label: 'السكور', labelEn: 'Score', type: 'number' },
  { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created At', type: 'date' },
];

export default function LeadPoolPage() {
  const { i18n } = useTranslation();
  const { hasPermission, user, profile } = useAuth();
  const lang  = i18n.language;
  const isRTL  = lang === 'ar';

  const { auditFields, applyAuditFilters } = useAuditFilter('lead');

  const canViewFresh   = hasPermission(P.POOL_VIEW_FRESH);
  const canAssign      = hasPermission(P.POOL_ASSIGN);
  const canManage      = hasPermission(P.POOL_MANAGE);
  const canViewAll     = canManage; // managers/directors see all teams

  const [leads, setLeads]             = useState(() => loadLeads());
  const agentsList = useMemo(() => loadAgents(), []);

  // Persist leads to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem('platform_lead_pool', JSON.stringify(leads)); } catch { /* quota */ }
  }, [leads]);

  const assignedToOptions = useMemo(() =>
    [...new Set(leads.map(l => l.assigned_to).filter(Boolean))].map(name => ({ value: name, label: name, labelEn: name })),
  [leads]);

  const SMART_FIELDS = useMemo(() => [
    ...SMART_FIELDS_STATIC,
    { id: 'assigned_to', label: 'المسؤول', labelEn: 'Assigned To', type: 'select', options: assignedToOptions },
    ...auditFields,
  ], [assignedToOptions, auditFields]);
  const [selected, setSelected]       = useState([]);
  const [smartFilters, setSmartFilters] = useState([]);
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(25);
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
    // First apply permission + scope filters
    let result = leads.filter(l => {
      if (!canViewFresh && l.type === 'fresh') return false;
      if (poolScope === 'my_team' && l.team !== (user?.team_id || 'team1')) return false;
      return true;
    });

    // Add computed _aging_level for SmartFilter
    result = result.map(l => ({ ...l, _aging_level: getAging(l.created_at).level }));

    // Apply smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => {
        const src = SOURCES[l.source];
        return l.name.toLowerCase().includes(q) || l.phone.includes(q) || src?.ar.includes(q) || src?.en.toLowerCase().includes(q);
      });
    }

    // Sort: Score DESC, then Aging ASC
    return result.sort((a, b) => {
      const scoreDiff = getLeadScore(b) - getLeadScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [leads, canViewFresh, canViewAll, poolScope, smartFilters, search, tick, user?.team_id]);

  useEffect(() => { setPage(1); setSelected([]); }, [smartFilters, search, poolScope, pageSize]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedData = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // Stats
  const stats = useMemo(() => {
    const fresh = leads.filter(l => l.type === 'fresh');
    const cold  = leads.filter(l => l.type === 'cold_call');
    const slaBreached = leads.filter(l => getSLAStatus(l).breached);
    const stale = leads.filter(l => {
      if (!l.created_at) return false;
      const hrs = (Date.now() - new Date(l.created_at)) / 3600000;
      return hrs > 48 && !l.assigned_to; // unassigned for 48+ hours = stale
    });
    const avgWait = leads.length ? Math.round(leads.reduce((s, l) => s + (Date.now() - new Date(l.created_at)) / 60000, 0) / leads.length) : 0;
    return { total: leads.length, fresh: fresh.length, cold: cold.length, slaBreached: slaBreached.length, stale: stale.length, avgWait };
  }, [leads, tick]);

  const handleReserve = (lead) => {
    const userName = profile?.full_name_ar || profile?.full_name_en || '';
    logAction({ action: 'assign', entity: 'lead', entityId: lead.id, entityName: lead.name || '', description: 'Reserved lead for 5 minutes', userName });
    setLeads(prev => prev.map(l => l.id === lead.id ? {
      ...l, reserved_by: user?.id || 'me',
      reserved_until: new Date(Date.now() + 5*60*1000).toISOString()
    } : l));
  };

  const handleAssign = (leadIds, agentId) => {
    // Filter out reserved leads from bulk assignment
    const idsToAssign = (Array.isArray(leadIds) ? leadIds : [leadIds]).filter(id => {
      const lead = leads.find(l => l.id === id);
      return !lead?.reserved_by || new Date(lead.reserved_until) <= new Date();
    });
    if (idsToAssign.length === 0) return;
    const agent = agentsList.find(a => a.id === agentId);
    const agentName = agent ? (lang === 'ar' ? agent.name_ar : agent.name_en) : agentId;
    const userName = profile?.full_name_ar || profile?.full_name_en || '';
    const isBulk = idsToAssign.length > 1;

    if (isBulk) {
      logAction({ action: 'bulk_reassign', entity: 'lead', entityId: idsToAssign.join(','), entityName: `${idsToAssign.length} leads`, description: `Bulk assigned ${idsToAssign.length} leads to ${agentName}`, userName });
    } else {
      const leadId = idsToAssign[0];
      const lead = leads.find(l => l.id === leadId);
      logAction({ action: 'assign', entity: 'lead', entityId: leadId, entityName: lead?.name || '', description: `Assigned lead to ${agentName}`, userName });
    }

    setLeads(prev => prev.filter(l => !idsToAssign.includes(l.id)));
    setSelected([]);
    setAssignModal(null);
  };

  const handleAutoDistribute = () => {
    if (!agentsList.length || !visible.length) return;
    const unassigned = visible.filter(l => !l.assigned_to && (!l.reserved_by || new Date(l.reserved_until) <= new Date()));
    if (!unassigned.length) return;

    // Build agent capacity map based on weights and daily caps
    const agentCaps = agentsList.map(a => {
      const level = LEVELS[a.level] || LEVELS.junior;
      const remaining = Math.max(level.dailyCap - (a.today_count || 0), 0);
      return { ...a, weight: level.weight, remaining, assigned: 0 };
    }).filter(a => a.remaining > 0 && a.weight > 0);

    if (!agentCaps.length) return;

    const totalWeight = agentCaps.reduce((s, a) => s + a.weight, 0);
    const idsToRemove = [];
    const userName = profile?.full_name_ar || profile?.full_name_en || '';

    // Sort leads by score desc (best leads first)
    const sorted = [...unassigned].sort((a, b) => getLeadScore(b) - getLeadScore(a));

    // Check source restrictions (Google → senior only)
    sorted.forEach(lead => {
      const srcConfig = SOURCES[lead.source];
      let eligible = agentCaps;
      if (srcConfig?.seniorOnly) {
        eligible = agentCaps.filter(a => ['top_senior', 'senior'].includes(a.level));
      }
      if (!eligible.length) eligible = agentCaps;

      // Weighted random pick among eligible agents with remaining capacity
      const available = eligible.filter(a => a.remaining - a.assigned > 0);
      if (!available.length) return;

      const weightSum = available.reduce((s, a) => s + a.weight, 0);
      let rand = Math.random() * weightSum;
      let chosen = available[0];
      for (const a of available) {
        rand -= a.weight;
        if (rand <= 0) { chosen = a; break; }
      }

      chosen.assigned++;
      idsToRemove.push(lead.id);
    });

    if (idsToRemove.length > 0) {
      logAction({ action: 'auto_distribute', entity: 'lead', entityId: idsToRemove.join(','), entityName: `${idsToRemove.length} leads`, description: `Auto-distributed ${idsToRemove.length} leads to ${agentCaps.filter(a => a.assigned > 0).length} agents`, userName });
      setLeads(prev => prev.filter(l => !idsToRemove.includes(l.id)));
      setSelected([]);
    }
  };

  const handleAddCold = () => {
    if (!newLead.name || !newLead.phone || newLead.phone.replace(/\D/g, '').length < 8) return;
    const lead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
    const userName = profile?.full_name_ar || profile?.full_name_en || '';
    logAction({ action: 'assign', entity: 'lead', entityId: lead.id, entityName: lead.name || '', description: 'Added new cold call lead to pool', userName });
    setLeads(prev => [lead, ...prev]);
    setNewLead({ name: '', phone: '', source: 'cold_call' });
    setAddModal(false);
  };

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(prev => prev.length === paginatedData.length ? [] : paginatedData.map(l => l.id));

  const poolScopeToggle = canViewAll ? (
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
  ) : null;

  const selectAllBtn = canAssign ? (
    <Button variant="ghost" size="sm" onClick={toggleAll}>
      <CheckSquare size={13} />
      {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
    </Button>
  ) : null;

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Zap size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'توزيع الليدز' : 'Lead Distribution'}</h1>
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
          {canManage && visible.filter(l => !l.assigned_to).length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleAutoDistribute} className={isRTL ? 'flex-row-reverse' : ''}>
              <Zap size={15} />
              {lang === 'ar' ? `توزيع تلقائي (${visible.filter(l => !l.assigned_to).length})` : `Auto-assign (${visible.filter(l => !l.assigned_to).length})`}
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

      {/* Stale leads warning */}
      {stats.stale > 0 && canManage && (
        <div className={`bg-amber-500/[0.08] border border-amber-500/30 rounded-xl px-3.5 py-2.5 mb-3.5 flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Clock size={15} color="#F59E0B" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              {lang === 'ar' ? `${stats.stale} ليد راكد (أكثر من 48 ساعة بدون توزيع)` : `${stats.stale} stale leads (48+ hours unassigned)`}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleAutoDistribute} className="text-xs shrink-0">
            {lang === 'ar' ? 'وزّعهم الآن' : 'Assign now'}
          </Button>
        </div>
      )}

      {/* SmartFilter */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'بحث بالاسم أو الموبايل...' : 'Search by name or phone...'}
        resultsCount={visible.length}
        extraActions={<>{poolScopeToggle}{selectAllBtn}</>}
      />

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
        ) : paginatedData.map((lead, idx) => {
          const aging   = getAging(lead.created_at);
          const sla     = getSLAStatus(lead);
          const src     = SOURCES[lead.source];
          const score   = getLeadScore(lead);
          const isSel   = selected.includes(lead.id);
          const isReserved = lead.reserved_by && new Date(lead.reserved_until) > new Date();

          return (
            <div key={lead.id} className={`
              flex items-center gap-3 px-4 py-3 transition-colors duration-150
              ${idx < paginatedData.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''}
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

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={visible.length}
      />

      {/* Assign Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={lang === 'ar' ? `توزيع ${assignModal === 'bulk' ? selected.length + ' ليدز' : 'ليد'}` : `Assign ${assignModal === 'bulk' ? selected.length + ' leads' : 'lead'}`}
        width="max-w-md"
      >
        <div className="flex flex-col gap-2">
          {agentsList.map(agent => {
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
