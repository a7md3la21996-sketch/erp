import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Phone, Clock, AlertTriangle, CheckSquare, Filter,
  Search, UserPlus, Flame, Wind, Snowflake, Thermometer,
  BarChart3, TrendingUp, Timer, Bell, ChevronDown, X,
  RefreshCw, Upload, Plus, Eye, Zap
} from 'lucide-react';
import { P } from '../../config/roles';

// ── Constants ──────────────────────────────────────────────────────────────
const SOURCES = {
  google:   { ar: 'جوجل',    en: 'Google',   weight: 3,   color: '#EF4444', seniorOnly: true },
  tiktok:   { ar: 'تيك توك', en: 'TikTok',   weight: 2.5, color: '#2B4C6F' },
  meta:     { ar: 'ميتا',    en: 'Meta',     weight: 2,   color: '#4A7AAB' },
  organic:  { ar: 'أورجانيك',en: 'Organic',  weight: 1.5, color: '#6B8DB5' },
  cold_call:{ ar: 'كولد كول',en: 'Cold Call',weight: 1,   color: '#8BA8C8' },
};

const LEVELS = {
  top_senior: { ar: 'Top Performer Senior', en: 'Top Performer Senior', weight: 10, dailyCap: 10 },
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
  if (mins < 60)    return { label: `${mins}د`,           color: '#4A7AAB', dot: '🟢', level: 'fresh' };
  if (mins < 1440)  return { label: `${Math.floor(mins/60)}س`, color: '#F97316', dot: '🟡', level: 'warn'  };
  return              { label: `${Math.floor(mins/1440)}ي`,color: '#EF4444', dot: '🔴', level: 'old'   };
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
  const { theme } = useTheme();
  const { hasPermission, user } = useAuth();
  const lang  = i18n.language;
  const isDark = theme === 'dark';
  const isRTL  = lang === 'ar';

  const canViewFresh   = hasPermission(P.POOL_VIEW_FRESH);
  const canAssign      = hasPermission(P.POOL_ASSIGN);
  const canManage      = hasPermission(P.POOL_MANAGE);

  const [leads, setLeads]             = useState(makeMockLeads);
  const [selected, setSelected]       = useState([]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [agingFilter, setAgingFilter] = useState('all');
  const [search, setSearch]           = useState('');
  const [assignModal, setAssignModal] = useState(null); // lead or 'bulk'
  const [addModal, setAddModal]       = useState(false);
  const [newLead, setNewLead]         = useState({ name: '', phone: '', source: 'cold_call' });
  const [tick, setTick]               = useState(0);

  // Tick every 30s to update aging/SLA
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const c = {
    bg:      isDark ? '#152232' : '#f9fafb',
    cardBg:  isDark ? '#1a2234' : '#ffffff',
    border:  isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:    isDark ? '#E2EAF4' : '#111827',
    muted:   isDark ? '#8BA8C8' : '#6b7280',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    hover:   isDark ? 'rgba(74,122,171,0.06)' : '#f8fafc',
    accent:  '#4A7AAB',
    primary: '#2B4C6F',
  };

  // Filter leads based on permissions and filters
  const visible = useMemo(() => {
    return leads.filter(l => {
      if (!canViewFresh && l.type === 'fresh') return false;
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;
      if (agingFilter !== 'all') {
        const aging = getAging(l.created_at);
        if (agingFilter !== aging.level) return false;
      }
      if (search && !l.name.includes(search) && !l.phone.includes(search)) return false;
      return true;
    }).sort((a, b) => {
      // Pool Priority Queue: Score DESC, then Aging ASC
      const scoreDiff = getLeadScore(b) - getLeadScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [leads, canViewFresh, sourceFilter, typeFilter, agingFilter, search, tick]);

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
    const agent = MOCK_AGENTS.find(a => a.id === agentId);
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
      team: 'team1',
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
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'بركة الليدز' : 'Lead Pool'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{lang === 'ar' ? 'إدارة وتوزيع الليدز' : 'Manage & distribute leads'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {selected.length > 0 && canAssign && (
            <button onClick={() => setAssignModal('bulk')} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              border: 'none', cursor: 'pointer', background: c.accent, color: '#fff', fontSize: 13, fontWeight: 600,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}>
              <UserPlus size={15} />
              {lang === 'ar' ? `توزيع (${selected.length})` : `Assign (${selected.length})`}
            </button>
          )}
          <button onClick={() => setAddModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            border: 'none', cursor: 'pointer', background: c.primary, color: '#fff', fontSize: 13, fontWeight: 600,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}>
            <Plus size={15} />
            {lang === 'ar' ? 'كولد كول جديد' : 'Add Cold Call'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: lang === 'ar' ? 'إجمالي' : 'Total',         value: stats.total,       icon: Users,        color: c.accent },
          { label: lang === 'ar' ? 'فريش' : 'Fresh',           value: stats.fresh,       icon: Flame,        color: '#EF4444', hide: !canViewFresh },
          { label: lang === 'ar' ? 'كولد كول' : 'Cold Calls',  value: stats.cold,        icon: Phone,        color: c.primary },
          { label: lang === 'ar' ? 'تعدى SLA' : 'SLA Breached',value: stats.slaBreached, icon: AlertTriangle,color: '#EF4444' },
          { label: lang === 'ar' ? 'متوسط انتظار' : 'Avg Wait', value: `${stats.avgWait}د`, icon: Clock,     color: '#6B8DB5' },
        ].filter(s => !s.hide).map((s, i) => {
          const Ic = s.icon;
          return (
            <div key={i} style={{ background: c.cardBg, borderRadius: 10, padding: '12px 14px', border: '1px solid ' + c.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <Ic size={14} color={s.color} />
                <span style={{ fontSize: 11, color: c.muted }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.text, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* SLA Warning */}
      {stats.slaBreached > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Bell size={15} color="#EF4444" />
          <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>
            {lang === 'ar' ? `${stats.slaBreached} ليد تعدى وقت SLA — يحتاج توزيع عاجل` : `${stats.slaBreached} leads breached SLA — urgent assignment needed`}
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: c.cardBg, borderRadius: 12, padding: '10px 14px', marginBottom: 12, border: '1px solid ' + c.border, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', [isRTL?'right':'left']: 10, top: '50%', transform: 'translateY(-50%)', color: c.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'بحث...' : 'Search...'} style={{
            width: '100%', padding: isRTL ? '7px 30px 7px 10px' : '7px 10px 7px 30px',
            borderRadius: 7, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }} />
        </div>

        {/* Type filter */}
        {canViewFresh && ['all','fresh','cold_call'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid ' + (typeFilter === t ? c.accent : c.border),
            background: typeFilter === t ? c.accent + '18' : 'transparent', color: typeFilter === t ? c.accent : c.muted,
            fontSize: 12, fontWeight: typeFilter === t ? 600 : 400, cursor: 'pointer',
          }}>
            {t === 'all' ? (lang === 'ar' ? 'الكل' : 'All') : t === 'fresh' ? (lang === 'ar' ? 'فريش' : 'Fresh') : (lang === 'ar' ? 'كولد كول' : 'Cold Call')}
          </button>
        ))}

        {/* Source filter */}
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{
          padding: '6px 10px', borderRadius: 7, border: '1px solid ' + c.border,
          background: c.inputBg, color: c.text, fontSize: 12, outline: 'none',
        }}>
          <option value="all">{lang === 'ar' ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCES).map(([k, v]) => (
            <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
          ))}
        </select>

        {/* Aging filter */}
        {['all','fresh','warn','old'].map(a => (
          <button key={a} onClick={() => setAgingFilter(a)} style={{
            padding: '5px 10px', borderRadius: 6, border: '1px solid ' + (agingFilter === a ? c.accent : c.border),
            background: agingFilter === a ? c.accent + '18' : 'transparent', color: agingFilter === a ? c.accent : c.muted,
            fontSize: 12, cursor: 'pointer',
          }}>
            {a === 'all' ? '⚪' : a === 'fresh' ? '🟢' : a === 'warn' ? '🟡' : '🔴'}
          </button>
        ))}

        {/* Select all */}
        {canAssign && (
          <button onClick={toggleAll} style={{
            padding: '5px 10px', borderRadius: 6, border: '1px solid ' + c.border,
            background: 'transparent', color: c.muted, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <CheckSquare size={13} />
            {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
          </button>
        )}
      </div>

      {/* Leads List */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: c.muted }}>
            <Zap size={32} color={c.border} style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 14 }}>{lang === 'ar' ? 'لا توجد ليدز في الـ Pool' : 'No leads in pool'}</p>
          </div>
        ) : visible.map((lead, idx) => {
          const aging   = getAging(lead.created_at);
          const sla     = getSLAStatus(lead);
          const src     = SOURCES[lead.source];
          const score   = getLeadScore(lead);
          const isSel   = selected.includes(lead.id);
          const isReserved = lead.reserved_by && new Date(lead.reserved_until) > new Date();

          return (
            <div key={lead.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: idx < visible.length - 1 ? '1px solid ' + c.border : 'none',
              background: isSel ? c.accent + '08' : isReserved ? 'rgba(239,68,68,0.04)' : 'transparent',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = c.hover; }}
              onMouseLeave={e => { e.currentTarget.style.background = isSel ? c.accent + '08' : isReserved ? 'rgba(239,68,68,0.04)' : 'transparent'; }}
            >
              {/* Checkbox */}
              {canAssign && (
                <input type="checkbox" checked={isSel} onChange={() => toggleSelect(lead.id)}
                  style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0, accentColor: c.accent }} />
              )}

              {/* Aging dot */}
              <div style={{ fontSize: 14, flexShrink: 0 }}>{aging.dot}</div>

              {/* Lead info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{lead.name}</span>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 6, background: (src?.color || c.accent) + '18', color: src?.color || c.accent, fontWeight: 500 }}>
                    {lang === 'ar' ? src?.ar : src?.en}
                  </span>
                  {lead.type === 'fresh' && canViewFresh && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#EF444418', color: '#EF4444', fontWeight: 600 }}>
                      {lang === 'ar' ? 'فريش' : 'Fresh'}
                    </span>
                  )}
                  {isReserved && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#F9731618', color: '#F97316' }}>
                      {lang === 'ar' ? 'محجوز' : 'Reserved'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 12, color: c.muted }}>{lead.phone}</span>
                  <span style={{ fontSize: 11, color: aging.color, fontWeight: 500 }}>
                    <Clock size={10} style={{ display: 'inline', marginLeft: 3 }} />
                    {aging.label} {lang === 'ar' ? 'في الانتظار' : 'waiting'}
                  </span>
                </div>

                {/* SLA Bar */}
                <div style={{ marginTop: 5, maxWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: c.muted }}>SLA</span>
                    <span style={{ fontSize: 10, color: sla.breached ? '#EF4444' : c.muted, fontWeight: sla.breached ? 700 : 400 }}>
                      {sla.breached ? (lang === 'ar' ? 'تعدى الوقت' : 'Breached') : `${sla.remaining}د`}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: c.border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: sla.pct + '%', borderRadius: 2, background: sla.breached ? '#EF4444' : sla.pct > 75 ? '#F97316' : c.accent, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </div>

              {/* Score */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: score > 75 ? '#EF4444' : score > 50 ? '#F97316' : c.accent }}>{score}</div>
                <div style={{ fontSize: 10, color: c.muted }}>{lang === 'ar' ? 'سكور' : 'Score'}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {!isReserved && (
                  <button onClick={() => handleReserve(lead)} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid ' + c.border,
                    background: 'transparent', color: c.muted, fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Eye size={12} />
                    {lang === 'ar' ? 'حجز' : 'Reserve'}
                  </button>
                )}
                {canAssign && (
                  <button onClick={() => setAssignModal([lead.id])} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none',
                    background: c.primary, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <UserPlus size={12} />
                    {lang === 'ar' ? 'توزيع' : 'Assign'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: c.cardBg, borderRadius: 14, padding: 24, width: 420, maxWidth: '90vw', border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text }}>
                {lang === 'ar' ? `توزيع ${assignModal === 'bulk' ? selected.length + ' ليدز' : 'ليد'}` : `Assign ${assignModal === 'bulk' ? selected.length + ' leads' : 'lead'}`}
              </h3>
              <button onClick={() => setAssignModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c.muted }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MOCK_AGENTS.map(agent => {
                const level = LEVELS[agent.level];
                const atCap = agent.today_count >= level.dailyCap;
                return (
                  <button key={agent.id} onClick={() => !atCap && handleAssign(assignModal === 'bulk' ? selected : assignModal, agent.id)}
                    disabled={atCap}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8, border: '1px solid ' + c.border,
                      background: atCap ? c.hover : 'transparent', cursor: atCap ? 'not-allowed' : 'pointer',
                      opacity: atCap ? 0.5 : 1, flexDirection: isRTL ? 'row-reverse' : 'row',
                    }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? agent.name_ar : agent.name_en}</div>
                      <div style={{ fontSize: 11, color: c.muted }}>{lang === 'ar' ? level.ar : level.en} · وزن {level.weight}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: atCap ? '#EF4444' : c.accent, fontWeight: 600 }}>
                        {agent.today_count}/{level.dailyCap}
                      </div>
                      <div style={{ fontSize: 10, color: c.muted }}>{lang === 'ar' ? 'اليوم' : 'today'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Cold Call Modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: c.cardBg, borderRadius: 14, padding: 24, width: 380, maxWidth: '90vw', border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'إضافة كولد كول' : 'Add Cold Call'}</h3>
              <button onClick={() => setAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c.muted }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={newLead.name} onChange={e => setNewLead(f => ({...f, name: e.target.value}))}
                placeholder={lang === 'ar' ? 'الاسم' : 'Name'} style={{
                  padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border,
                  background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', direction: isRTL ? 'rtl' : 'ltr',
                }} />
              <input value={newLead.phone} onChange={e => setNewLead(f => ({...f, phone: e.target.value}))}
                placeholder={lang === 'ar' ? 'رقم الهاتف' : 'Phone'} style={{
                  padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border,
                  background: c.inputBg, color: c.text, fontSize: 13, outline: 'none',
                }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
                <button onClick={() => setAddModal(false)} style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid ' + c.border,
                  background: 'transparent', color: c.muted, fontSize: 13, cursor: 'pointer',
                }}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={handleAddCold} disabled={!newLead.name || !newLead.phone} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: c.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: !newLead.name || !newLead.phone ? 0.6 : 1,
                }}>{lang === 'ar' ? 'إضافة' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
