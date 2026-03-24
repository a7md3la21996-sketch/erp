import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { KpiCard, Pagination } from '../../components/ui';
import {
  Shield, Timer, Clock, AlertTriangle, CheckCircle2, Plus, Edit2, Trash2,
  Search, X, ChevronDown, BarChart3, ListChecks, Play, Check, XCircle,
  ArrowUpRight, Zap, Layers,
} from 'lucide-react';
import {
  getPolicies, getPolicy, createPolicy, updatePolicy, deletePolicy,
  getTickets, createTicket, respondToTicket, resolveTicket,
  checkBreaches, getStats, getSLAPerformance,
} from '../../services/slaService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const STATUS_COLORS = { open: '#3b82f6', in_progress: '#8b5cf6', resolved: '#22c55e', breached: '#ef4444', escalated: '#f97316' };

function formatMinutes(mins, isRTL) {
  if (mins >= 1440) {
    const d = Math.floor(mins / 1440);
    const h = Math.round((mins % 1440) / 60);
    return isRTL
      ? `${d} يوم${h > 0 ? ` و ${h} ساعة` : ''}`
      : `${d}d${h > 0 ? ` ${h}h` : ''}`;
  }
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return isRTL
      ? `${h} ساعة${m > 0 ? ` و ${m} دقيقة` : ''}`
      : `${h}h${m > 0 ? ` ${m}m` : ''}`;
  }
  return isRTL ? `${mins} دقيقة` : `${mins}m`;
}

function getTimeRemaining(deadline) {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end - now;
  if (diff <= 0) return { text: 'Overdue', color: '#ef4444', minutes: 0 };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { text: `${mins}m`, color: mins < 15 ? '#ef4444' : mins < 30 ? '#eab308' : '#22c55e', minutes: mins };
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { text: `${hrs}h ${remMins}m`, color: hrs < 1 ? '#eab308' : '#22c55e', minutes: mins };
}

const ENTITIES = [
  { value: 'opportunity', ar: 'فرصة بيعية', en: 'Opportunity' },
  { value: 'contact', ar: 'جهة اتصال', en: 'Contact' },
  { value: 'task', ar: 'مهمة', en: 'Task' },
  { value: 'ticket', ar: 'تذكرة', en: 'Ticket' },
];

const PRIORITIES = [
  { value: 'urgent', ar: 'عاجل', en: 'Urgent' },
  { value: 'high', ar: 'عالي', en: 'High' },
  { value: 'medium', ar: 'متوسط', en: 'Medium' },
  { value: 'low', ar: 'منخفض', en: 'Low' },
];

const STATUSES = [
  { value: 'open', ar: 'مفتوح', en: 'Open' },
  { value: 'in_progress', ar: 'قيد التنفيذ', en: 'In Progress' },
  { value: 'resolved', ar: 'تم الحل', en: 'Resolved' },
  { value: 'breached', ar: 'منتهك', en: 'Breached' },
  { value: 'escalated', ar: 'مُصعَّد', en: 'Escalated' },
];

const ROLES = ['manager', 'director', 'admin', 'support_lead', 'cto'];

// ── Main Component ────────────────────────────────────────────────────
export default function SLAManagementPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ complianceRate: 100, avgResponseTime: 0, avgResolutionTime: 0, totalBreached: 0, activeTickets: 0 });
  const [perfData, setPerfData] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [policies, setPolicies] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [filters, setFilters] = useState({ status: '', priority: '', entity: '', search: '' });
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showCreateTicket, setShowCreateTicket] = useState(false);

  const loadData = useCallback(async () => {
    await checkBreaches();
    const statsResult = await getStats();
    setStats(statsResult && typeof statsResult === 'object' ? statsResult : { complianceRate: 100, avgResponseTime: 0, avgResolutionTime: 0, totalBreached: 0, activeTickets: 0 });
    const perfResult = await getSLAPerformance(30);
    setPerfData(Array.isArray(perfResult) ? perfResult : []);
    const policiesResult = await getPolicies();
    setPolicies(Array.isArray(policiesResult) ? policiesResult : []);
    const offset = (page - 1) * pageSize;
    const result = await getTickets({
      limit: pageSize, offset,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      entity: filters.entity || undefined,
      search: filters.search || undefined,
    });
    if (result && typeof result === 'object') {
      setTickets(Array.isArray(result.data) ? result.data : []);
      setTicketTotal(result.total || 0);
    }
  }, [page, pageSize, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('platform_sla_changed', handler);
    return () => window.removeEventListener('platform_sla_changed', handler);
  }, [loadData]);

  // Periodic breach check
  useEffect(() => {
    const interval = setInterval(() => { checkBreaches().then(() => loadData()); }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalPages = Math.ceil(ticketTotal / pageSize);

  const complianceColor = stats.complianceRate >= 90 ? '#22c55e' : stats.complianceRate >= 70 ? '#eab308' : '#ef4444';

  // ── Styles ──────────────────────────────────────────────────────────
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const surfaceBg = isDark ? '#0f172a' : '#f1f5f9';

  const tabStyle = (active) => ({
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? (isDark ? '#3b82f6' : '#3b82f6') : 'transparent',
    color: active ? '#ffffff' : textSecondary,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  const btnPrimary = {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 6,
  };

  const btnSecondary = {
    background: isDark ? '#1e293b' : '#f1f5f9', color: textPrimary,
    border: `1px solid ${borderColor}`, borderRadius: 8,
    padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 4,
  };

  const badgeStyle = (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: `${color}20`, color,
  });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={24} color="#3b82f6" />
            {isRTL ? 'إدارة اتفاقيات مستوى الخدمة' : 'SLA Management'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: textSecondary }}>
            {isRTL ? 'مراقبة وإدارة اتفاقيات مستوى الخدمة' : 'Monitor and manage service level agreements'}
          </p>
        </div>
        {activeTab === 'dashboard' && (
          <button style={btnPrimary} onClick={() => setShowCreateTicket(true)}>
            <Plus size={16} /> {isRTL ? 'تذكرة جديدة' : 'New Ticket'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button style={tabStyle(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>
          <BarChart3 size={16} /> {isRTL ? 'لوحة المتابعة' : 'Dashboard'}
        </button>
        <button style={tabStyle(activeTab === 'policies')} onClick={() => setActiveTab('policies')}>
          <ListChecks size={16} /> {isRTL ? 'السياسات' : 'Policies'}
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <DashboardTab
          stats={stats} perfData={perfData} tickets={tickets} ticketTotal={ticketTotal}
          page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize}
          totalPages={totalPages} filters={filters} setFilters={setFilters}
          complianceColor={complianceColor} isDark={isDark} isRTL={isRTL}
          cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary}
          textSecondary={textSecondary} inputBg={inputBg} surfaceBg={surfaceBg}
          btnSecondary={btnSecondary} badgeStyle={badgeStyle} loadData={loadData}
        />
      ) : (
        <PoliciesTab
          policies={policies} isDark={isDark} isRTL={isRTL}
          cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary}
          textSecondary={textSecondary} badgeStyle={badgeStyle} btnPrimary={btnPrimary}
          showPolicyModal={showPolicyModal} setShowPolicyModal={setShowPolicyModal}
          editingPolicy={editingPolicy} setEditingPolicy={setEditingPolicy}
          showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm}
          loadData={loadData} surfaceBg={surfaceBg} inputBg={inputBg}
        />
      )}

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <CreateTicketModal
          onClose={() => setShowCreateTicket(false)}
          onCreated={loadData}
          isDark={isDark} isRTL={isRTL}
          cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary}
          textSecondary={textSecondary} inputBg={inputBg} btnPrimary={btnPrimary}
        />
      )}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────
function DashboardTab({
  stats, perfData, tickets, ticketTotal, page, setPage, pageSize, setPageSize,
  totalPages, filters, setFilters, complianceColor, isDark, isRTL,
  cardBg, borderColor, textPrimary, textSecondary, inputBg, surfaceBg,
  btnSecondary, badgeStyle, loadData,
}) {
  return (
    <>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard icon={Shield} label={isRTL ? 'نسبة الامتثال' : 'Compliance Rate'} value={`${stats.complianceRate}%`} color={complianceColor} />
        <KpiCard icon={Clock} label={isRTL ? 'متوسط وقت الاستجابة' : 'Avg Response Time'} value={formatMinutes(stats.avgResponseTime, isRTL)} color="#3b82f6" />
        <KpiCard icon={Timer} label={isRTL ? 'متوسط وقت الحل' : 'Avg Resolution Time'} value={formatMinutes(stats.avgResolutionTime, isRTL)} color="#8b5cf6" />
        <KpiCard icon={Zap} label={isRTL ? 'تذاكر نشطة' : 'Active Tickets'} value={stats.activeTickets} color="#f97316" />
        <KpiCard icon={AlertTriangle} label={isRTL ? 'منتهكة' : 'Breached'} value={stats.totalBreached} color="#ef4444" />
      </div>

      {/* Performance Chart */}
      <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${borderColor}`, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'أداء الامتثال - آخر 30 يوم' : 'Compliance Performance - Last 30 Days'}
        </h3>
        {perfData.some(d => d.total > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={perfData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: textSecondary }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: textSecondary }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: textPrimary }}
              />
              <Bar dataKey="compliance" fill="#3b82f6" radius={[4, 4, 0, 0]} name={isRTL ? 'الامتثال %' : 'Compliance %'} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: textSecondary }}>
            <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد بيانات أداء بعد' : 'No performance data yet'}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: 10, top: '50%', transform: 'translateY(-50%)', color: textSecondary }} />
          <input
            value={filters.search}
            onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            style={{
              width: '100%', padding: '8px 12px', [isRTL ? 'paddingRight' : 'paddingLeft']: 34,
              borderRadius: 8, border: `1px solid ${borderColor}`, background: inputBg,
              color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        {[
          { key: 'status', options: STATUSES, label: isRTL ? 'الحالة' : 'Status' },
          { key: 'priority', options: PRIORITIES, label: isRTL ? 'الأولوية' : 'Priority' },
          { key: 'entity', options: ENTITIES, label: isRTL ? 'النوع' : 'Entity' },
        ].map(f => (
          <select
            key={f.key}
            value={filters[f.key]}
            onChange={e => { setFilters(prev => ({ ...prev, [f.key]: e.target.value })); setPage(1); }}
            style={{
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`,
              background: inputBg, color: textPrimary, fontSize: 13, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">{f.label}</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{isRTL ? o.ar : o.en}</option>
            ))}
          </select>
        ))}
        {(filters.status || filters.priority || filters.entity || filters.search) && (
          <button
            onClick={() => { setFilters({ status: '', priority: '', entity: '', search: '' }); setPage(1); }}
            style={{ ...btnSecondary, color: '#ef4444' }}
          >
            <X size={14} /> {isRTL ? 'مسح' : 'Clear'}
          </button>
        )}
      </div>

      {/* Tickets Table */}
      <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: textSecondary }}>
            <Shield size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
              {isRTL ? 'لا توجد تذاكر SLA' : 'No SLA tickets found'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>
              {isRTL ? 'أنشئ تذكرة جديدة لبدء التتبع' : 'Create a ticket to start tracking'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    {[
                      isRTL ? 'الكيان' : 'Entity',
                      isRTL ? 'المسؤول' : 'Assigned To',
                      isRTL ? 'الأولوية' : 'Priority',
                      isRTL ? 'الحالة' : 'Status',
                      isRTL ? 'الوقت المتبقي' : 'Time Remaining',
                      isRTL ? 'الاستجابة' : 'First Response',
                      isRTL ? 'إجراءات' : 'Actions',
                    ].map((h, i) => (
                      <th key={i} style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => {
                    const timeLeft = getTimeRemaining(ticket.resolutionDeadline);
                    const respTime = ticket.firstResponseAt ? null : getTimeRemaining(ticket.firstResponseDeadline);
                    const isBreached = ticket.breached;

                    return (
                      <tr key={ticket.id} style={{
                        borderBottom: `1px solid ${borderColor}`,
                        background: isBreached ? (isDark ? '#7f1d1d20' : '#fef2f2') : 'transparent',
                      }}>
                        <td style={{ padding: '12px 16px', color: textPrimary, fontWeight: 500 }}>
                          <div>{ticket.entityName}</div>
                          <div style={{ fontSize: 11, color: textSecondary }}>{
                            ENTITIES.find(e => e.value === ticket.entityType)?.[isRTL ? 'ar' : 'en'] || ticket.entityType
                          }</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: textPrimary }}>{ticket.assignedTo}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={badgeStyle(PRIORITY_COLORS[ticket.priority])}>
                            {PRIORITIES.find(p => p.value === ticket.priority)?.[isRTL ? 'ar' : 'en']}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={badgeStyle(STATUS_COLORS[ticket.status])}>
                            {STATUSES.find(s => s.value === ticket.status)?.[isRTL ? 'ar' : 'en']}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {ticket.status === 'resolved' ? (
                            <span style={{ color: '#22c55e', fontWeight: 500 }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />{isRTL ? 'تم الحل' : 'Resolved'}</span>
                          ) : (
                            <span style={{ color: timeLeft.color, fontWeight: 600, fontFamily: 'monospace' }}>{timeLeft.text}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {ticket.firstResponseAt ? (
                            <span style={{ color: '#22c55e', fontSize: 12 }}><Check size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 2 }} />{isRTL ? 'تمت' : 'Done'}</span>
                          ) : respTime ? (
                            <span style={{ color: respTime.color, fontWeight: 500, fontSize: 12, fontFamily: 'monospace' }}>{respTime.text}</span>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {!ticket.firstResponseAt && ticket.status !== 'resolved' && (
                              <button
                                onClick={async () => { await respondToTicket(ticket.id); loadData(); }}
                                title={isRTL ? 'استجابة' : 'Respond'}
                                style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11, color: '#3b82f6', borderColor: '#3b82f620' }}
                              >
                                <Play size={12} /> {isRTL ? 'استجابة' : 'Respond'}
                              </button>
                            )}
                            {ticket.status !== 'resolved' && (
                              <button
                                onClick={async () => { await resolveTicket(ticket.id); loadData(); }}
                                title={isRTL ? 'حل' : 'Resolve'}
                                style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11, color: '#22c55e', borderColor: '#22c55e20' }}
                              >
                                <CheckCircle2 size={12} /> {isRTL ? 'حل' : 'Resolve'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={v => { setPageSize(v); setPage(1); }}
              totalItems={ticketTotal}
            />
          </>
        )}
      </div>
    </>
  );
}

// ── Policies Tab ──────────────────────────────────────────────────────
function PoliciesTab({
  policies, isDark, isRTL, cardBg, borderColor, textPrimary, textSecondary,
  badgeStyle, btnPrimary, showPolicyModal, setShowPolicyModal,
  editingPolicy, setEditingPolicy, showDeleteConfirm, setShowDeleteConfirm,
  loadData, surfaceBg, inputBg,
}) {
  const handleDelete = async (id) => {
    await deletePolicy(id);
    setShowDeleteConfirm(null);
    loadData();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button style={btnPrimary} onClick={() => { setEditingPolicy(null); setShowPolicyModal(true); }}>
          <Plus size={16} /> {isRTL ? 'سياسة جديدة' : 'New Policy'}
        </button>
      </div>

      {policies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: textSecondary, background: cardBg, borderRadius: 12, border: `1px solid ${borderColor}` }}>
          <Shield size={56} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{isRTL ? 'لا توجد سياسات' : 'No policies found'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {policies.map(policy => (
            <div key={policy.id} style={{
              background: cardBg, borderRadius: 12, border: `1px solid ${borderColor}`,
              padding: 20, position: 'relative', transition: 'all 0.2s',
            }}>
              {policy.builtIn && (
                <span style={{
                  position: 'absolute', top: 12, [isRTL ? 'left' : 'right']: 12,
                  ...badgeStyle('#3b82f6'), fontSize: 10,
                }}>
                  {isRTL ? 'مدمج' : 'Built-in'}
                </span>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${PRIORITY_COLORS[policy.priority]}15`,
                }}>
                  <Shield size={18} color={PRIORITY_COLORS[policy.priority]} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: textPrimary }}>
                    {isRTL ? policy.name : (policy.nameEn || policy.name)}
                  </h3>
                  <span style={{ fontSize: 11, color: textSecondary }}>
                    {ENTITIES.find(e => e.value === policy.entity)?.[isRTL ? 'ar' : 'en']}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <span style={badgeStyle(PRIORITY_COLORS[policy.priority])}>
                  {PRIORITIES.find(p => p.value === policy.priority)?.[isRTL ? 'ar' : 'en']}
                </span>
                <span style={badgeStyle(policy.active ? '#22c55e' : '#94a3b8')}>
                  {policy.active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معطل' : 'Inactive')}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: surfaceBg, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: textSecondary, marginBottom: 2 }}>
                    {isRTL ? 'وقت الاستجابة' : 'Response Time'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                    {formatMinutes(policy.firstResponseTime, isRTL)}
                  </div>
                </div>
                <div style={{ background: surfaceBg, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: textSecondary, marginBottom: 2 }}>
                    {isRTL ? 'وقت الحل' : 'Resolution Time'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                    {formatMinutes(policy.resolutionTime, isRTL)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: textSecondary, marginBottom: 12 }}>
                <Layers size={12} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />
                {isRTL ? `${policy.escalationLevels?.length || 0} مستويات تصعيد` : `${policy.escalationLevels?.length || 0} escalation levels`}
              </div>

              <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${borderColor}`, paddingTop: 12 }}>
                <button
                  onClick={() => { setEditingPolicy(policy); setShowPolicyModal(true); }}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#3b82f6', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                  }}
                >
                  <Edit2 size={13} /> {isRTL ? 'تعديل' : 'Edit'}
                </button>
                {!policy.builtIn && (
                  <button
                    onClick={() => setShowDeleteConfirm(policy.id)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                    }}
                  >
                    <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={async () => { await updatePolicy(policy.id, { active: !policy.active }); loadData(); }}
                  style={{
                    background: policy.active ? '#22c55e20' : (isDark ? '#33415520' : '#f1f5f9'),
                    border: 'none', cursor: 'pointer', borderRadius: 20, width: 44, height: 24,
                    position: 'relative', transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: policy.active ? '#22c55e' : '#94a3b8',
                    position: 'absolute', top: 3,
                    [policy.active ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left')]: 3,
                    transition: 'all 0.2s',
                  }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <PolicyModal
          policy={editingPolicy}
          onClose={() => { setShowPolicyModal(false); setEditingPolicy(null); }}
          onSaved={loadData}
          isDark={isDark} isRTL={isRTL}
          cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary}
          textSecondary={textSecondary} inputBg={inputBg} btnPrimary={btnPrimary}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setShowDeleteConfirm(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: cardBg, borderRadius: 16, padding: 24, width: 400, maxWidth: '90vw',
            border: `1px solid ${borderColor}`,
          }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ef444420', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Trash2 size={24} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: textPrimary }}>
                {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: textSecondary }}>
                {isRTL ? 'هل أنت متأكد من حذف هذه السياسة؟ لا يمكن التراجع.' : 'Are you sure you want to delete this policy? This cannot be undone.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: `1px solid ${borderColor}`,
                  background: 'transparent', color: textPrimary, cursor: 'pointer', fontSize: 13,
                }}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                {isRTL ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Policy Modal ──────────────────────────────────────────────────────
function PolicyModal({ policy, onClose, onSaved, isDark, isRTL, cardBg, borderColor, textPrimary, textSecondary, inputBg, btnPrimary }) {
  const isEditing = !!policy;
  const [form, setForm] = useState({
    name: policy?.name || '',
    nameEn: policy?.nameEn || '',
    description: policy?.description || '',
    entity: policy?.entity || 'ticket',
    priority: policy?.priority || 'medium',
    firstResponseTime: policy?.firstResponseTime || 60,
    firstResponseUnit: (policy?.firstResponseTime || 60) >= 60 ? 'hours' : 'minutes',
    firstResponseValue: (policy?.firstResponseTime || 60) >= 60 ? Math.round((policy?.firstResponseTime || 60) / 60) : (policy?.firstResponseTime || 60),
    resolutionTime: policy?.resolutionTime || 480,
    resolutionUnit: (policy?.resolutionTime || 480) >= 60 ? 'hours' : 'minutes',
    resolutionValue: (policy?.resolutionTime || 480) >= 60 ? Math.round((policy?.resolutionTime || 480) / 60) : (policy?.resolutionTime || 480),
    escalationLevels: policy?.escalationLevels || [],
    active: policy?.active !== undefined ? policy.active : true,
  });

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${borderColor}`, background: inputBg,
    color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: textSecondary, marginBottom: 4 };

  const handleSave = async () => {
    const firstResponseTime = form.firstResponseUnit === 'hours' ? form.firstResponseValue * 60 : Number(form.firstResponseValue);
    const resolutionTime = form.resolutionUnit === 'hours' ? form.resolutionValue * 60 : Number(form.resolutionValue);

    const data = {
      name: form.name,
      nameEn: form.nameEn,
      description: form.description,
      entity: form.entity,
      priority: form.priority,
      firstResponseTime,
      resolutionTime,
      escalationLevels: form.escalationLevels,
      active: form.active,
    };

    if (isEditing) {
      await updatePolicy(policy.id, data);
    } else {
      await createPolicy(data);
    }
    onSaved();
    onClose();
  };

  const addEscalation = () => {
    const nextLevel = (form.escalationLevels.length || 0) + 1;
    setForm(f => ({
      ...f,
      escalationLevels: [...f.escalationLevels, { level: nextLevel, afterMinutes: 30, notifyRole: 'manager' }],
    }));
  };

  const removeEscalation = (idx) => {
    setForm(f => ({
      ...f,
      escalationLevels: f.escalationLevels.filter((_, i) => i !== idx).map((e, i) => ({ ...e, level: i + 1 })),
    }));
  };

  const updateEscalation = (idx, field, value) => {
    setForm(f => {
      const levels = [...f.escalationLevels];
      levels[idx] = { ...levels[idx], [field]: field === 'afterMinutes' ? Number(value) : value };
      return { ...f, escalationLevels: levels };
    });
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: cardBg, borderRadius: 16, width: 520, maxWidth: '95vw', maxHeight: '90vh',
        overflow: 'auto', border: `1px solid ${borderColor}`,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: textPrimary }}>
            {isEditing ? (isRTL ? 'تعديل السياسة' : 'Edit Policy') : (isRTL ? 'سياسة جديدة' : 'New Policy')}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSecondary, padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name AR / EN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="سياسة..." dir="rtl" />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
              <input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} style={inputStyle} placeholder="Policy..." dir="ltr" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>{isRTL ? 'الوصف' : 'Description'}</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          </div>

          {/* Entity + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'نوع الكيان' : 'Entity Type'}</label>
              <select value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value }))} style={inputStyle}>
                {ENTITIES.map(e => <option key={e.value} value={e.value}>{isRTL ? e.ar : e.en}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الأولوية' : 'Priority'}</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{isRTL ? p.ar : p.en}</option>)}
              </select>
            </div>
          </div>

          {/* Response Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'وقت الاستجابة الأولى' : 'First Response Time'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" min={1} value={form.firstResponseValue}
                  onChange={e => setForm(f => ({ ...f, firstResponseValue: Number(e.target.value) }))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={form.firstResponseUnit}
                  onChange={e => setForm(f => ({ ...f, firstResponseUnit: e.target.value }))}
                  style={{ ...inputStyle, width: 'auto', minWidth: 90 }}
                >
                  <option value="minutes">{isRTL ? 'دقائق' : 'Minutes'}</option>
                  <option value="hours">{isRTL ? 'ساعات' : 'Hours'}</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'وقت الحل' : 'Resolution Time'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" min={1} value={form.resolutionValue}
                  onChange={e => setForm(f => ({ ...f, resolutionValue: Number(e.target.value) }))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={form.resolutionUnit}
                  onChange={e => setForm(f => ({ ...f, resolutionUnit: e.target.value }))}
                  style={{ ...inputStyle, width: 'auto', minWidth: 90 }}
                >
                  <option value="minutes">{isRTL ? 'دقائق' : 'Minutes'}</option>
                  <option value="hours">{isRTL ? 'ساعات' : 'Hours'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Escalation Levels */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, margin: 0 }}>{isRTL ? 'مستويات التصعيد' : 'Escalation Levels'}</label>
              <button onClick={addEscalation} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#3b82f6', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Plus size={14} /> {isRTL ? 'إضافة' : 'Add'}
              </button>
            </div>
            {form.escalationLevels.map((esc, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
                background: isDark ? '#1e293b' : '#f8fafc', borderRadius: 8, padding: '8px 12px',
                border: `1px solid ${borderColor}`,
              }}>
                <span style={{ fontSize: 11, color: textSecondary, minWidth: 50 }}>
                  {isRTL ? `مستوى ${esc.level}` : `Level ${esc.level}`}
                </span>
                <input
                  type="number" min={1} value={esc.afterMinutes}
                  onChange={e => updateEscalation(idx, 'afterMinutes', e.target.value)}
                  style={{ ...inputStyle, width: 70, padding: '4px 8px' }}
                />
                <span style={{ fontSize: 11, color: textSecondary }}>{isRTL ? 'دقيقة' : 'min'}</span>
                <select
                  value={esc.notifyRole}
                  onChange={e => updateEscalation(idx, 'notifyRole', e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '4px 8px', flex: 1 }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button onClick={() => removeEscalation(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Active Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: textPrimary }}>{isRTL ? 'نشط' : 'Active'}</label>
            <button
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              style={{
                background: form.active ? '#22c55e20' : (isDark ? '#33415520' : '#f1f5f9'),
                border: 'none', cursor: 'pointer', borderRadius: 20, width: 44, height: 24,
                position: 'relative', transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: form.active ? '#22c55e' : '#94a3b8',
                position: 'absolute', top: 3,
                [form.active ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left')]: 3,
                transition: 'all 0.2s',
              }} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${borderColor}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, border: `1px solid ${borderColor}`,
            background: 'transparent', color: textPrimary, cursor: 'pointer', fontSize: 13,
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={!form.name && !form.nameEn} style={{
            ...btnPrimary, opacity: (!form.name && !form.nameEn) ? 0.5 : 1,
          }}>
            {isEditing ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Ticket Modal ───────────────────────────────────────────────
function CreateTicketModal({ onClose, onCreated, isDark, isRTL, cardBg, borderColor, textPrimary, textSecondary, inputBg, btnPrimary }) {
  const [policies, setPoliciesLocal] = useState([]);
  useEffect(() => {
    const load = async () => {
      const result = await getPolicies();
      const arr = Array.isArray(result) ? result.filter(p => p.active) : [];
      setPoliciesLocal(arr);
    };
    load();
  }, []);
  const [form, setForm] = useState({
    policyId: '',
    entityType: 'ticket',
    entityId: 'entity_' + Date.now(),
    entityName: '',
    assignedTo: '',
    priority: '',
  });
  useEffect(() => {
    if (policies.length > 0 && !form.policyId) {
      setForm(prev => ({ ...prev, policyId: policies[0]?.id || '' }));
    }
  }, [policies]);

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${borderColor}`, background: inputBg,
    color: textPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: textSecondary, marginBottom: 4 };

  const handleCreate = async () => {
    if (!form.entityName || !form.policyId) return;
    await createTicket(form);
    onCreated();
    onClose();
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: cardBg, borderRadius: 16, width: 460, maxWidth: '95vw',
        border: `1px solid ${borderColor}`,
      }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'تذكرة SLA جديدة' : 'New SLA Ticket'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSecondary, padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>{isRTL ? 'السياسة' : 'Policy'}</label>
            <select value={form.policyId} onChange={e => setForm(f => ({ ...f, policyId: e.target.value }))} style={inputStyle}>
              {policies.map(p => (
                <option key={p.id} value={p.id}>{isRTL ? p.name : (p.nameEn || p.name)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>{isRTL ? 'اسم الكيان' : 'Entity Name'}</label>
            <input value={form.entityName} onChange={e => setForm(f => ({ ...f, entityName: e.target.value }))} style={inputStyle} placeholder={isRTL ? 'مثال: تذكرة دعم #123' : 'e.g., Support Ticket #123'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'نوع الكيان' : 'Entity Type'}</label>
              <select value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))} style={inputStyle}>
                {ENTITIES.map(e => <option key={e.value} value={e.value}>{isRTL ? e.ar : e.en}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'المسؤول' : 'Assigned To'}</label>
              <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} style={inputStyle} placeholder={isRTL ? 'اسم الموظف' : 'Employee name'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>{isRTL ? 'الأولوية (اختياري - تؤخذ من السياسة)' : 'Priority (optional - defaults to policy)'}</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
              <option value="">{isRTL ? 'من السياسة' : 'From policy'}</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{isRTL ? p.ar : p.en}</option>)}
            </select>
          </div>
        </div>

        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${borderColor}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, border: `1px solid ${borderColor}`,
            background: 'transparent', color: textPrimary, cursor: 'pointer', fontSize: 13,
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleCreate} disabled={!form.entityName} style={{
            ...btnPrimary, opacity: !form.entityName ? 0.5 : 1,
          }}>
            <Plus size={16} /> {isRTL ? 'إنشاء' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
