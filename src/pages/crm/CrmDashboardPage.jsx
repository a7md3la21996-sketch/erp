import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import supabase from '../../lib/supabase';
import {
  Users, Target, CheckSquare, Flame, AlertCircle, TrendingUp,
  Calendar, ChevronRight, RefreshCw, BarChart3, Activity,
  Search, Plus, Bell, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { PageSkeleton, Button } from '../../components/ui';
import { fetchContactStats, fetchOpportunityStats } from '../../services/dashboardService';
import { fetchTasks } from '../../services/tasksService';
import { reportError } from '../../utils/errorReporter';

const STAGE_COLORS = ['#4A7AAB', '#6B8DB5', '#92B0CC', '#F59E0B', '#10B981', '#059669', '#6B21A8'];

/**
 * CRM Dashboard — single-screen overview tying contacts / opps / tasks /
 * activities into a sales rep's "what do I work on next" landing page.
 *
 * Sections (top to bottom):
 *   1. KPI cards row — leads, hot, open opps, tasks due, this-week leads
 *   2. Today's Focus — tasks due today, overdue tasks, stale leads
 *   3. Pipeline — funnel by stage, total open value
 *   4. Recent Activity (last 14 days) — bar chart of calls/notes per day
 *   5. Source breakdown (managers+) — leads + conversion by source
 *
 * Role-aware: sales_agent sees own data, leader/manager see team, admin/ops
 * see everything. Driven by the existing dashboardService applyRoleFilter
 * — no per-page role logic here.
 */
export default function CrmDashboardPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const [loading, setLoading] = useState(true);
  // task stats were initially fetched but nothing on the page renders
  // them yet — Today's Focus uses todayTasks/overdueTasks lists directly.
  // Leaving them out of stats avoids dead state + a pointless query.
  // lastMonthCount drives the period-comparison badge on the
  // "New This Month" KPI card — count of contacts created last calendar
  // month, regardless of where in the current month we are.
  const [stats, setStats] = useState({ contact: null, opp: null, hotCount: 0, lastMonthCount: 0 });
  const [todayTasks, setTodayTasks] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [staleLeads, setStaleLeads] = useState([]);
  const [activityByDay, setActivityByDay] = useState([]);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState('');

  const ctx = useMemo(() => ({
    role: profile?.role,
    userId: profile?.id,
    teamId: profile?.team_id,
  }), [profile?.role, profile?.id, profile?.team_id]);

  const loadAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      // "Upcoming" = the 48-hour window *after* today ends — so tomorrow
      // + the day after. Excludes today (which has its own focus column).
      const upcomingEnd = new Date(new Date(todayEnd).getTime() + 48 * 3600000).toISOString();

      // Parallel-fetch every panel. Each one's failure is reported but
      // doesn't block the others — partial data is better than a blank page.
      const [
        contactStats, oppStats, hotCountRes, lastMonthRes,
        todayTasksRes, overdueTasksRes, staleLeadsRes,
        activityRes, sourceRes, upcomingRes,
      ] = await Promise.allSettled([
        fetchContactStats(ctx),
        fetchOpportunityStats(ctx),
        loadHotLeadsCount(ctx),
        loadLastMonthNewCount(ctx),
        fetchTasks({ ...ctx, dueDateFrom: todayStart, dueDateTo: todayEnd, status: 'pending', pageSize: 5, page: 1 }),
        fetchTasks({ ...ctx, overdueOnly: true, status: 'pending', pageSize: 5, page: 1 }),
        loadStaleLeads(ctx, sevenDaysAgo),
        loadActivityByDay(ctx, fourteenDaysAgo),
        ['admin', 'operations', 'sales_director', 'sales_manager', 'team_leader'].includes(profile?.role)
          ? loadSourceBreakdown(ctx)
          : Promise.resolve([]),
        fetchTasks({ ...ctx, dueDateFrom: todayEnd, dueDateTo: upcomingEnd, status: 'pending', pageSize: 5, page: 1 }),
      ]);

      setStats({
        contact: contactStats.status === 'fulfilled' ? contactStats.value : null,
        opp: oppStats.status === 'fulfilled' ? oppStats.value : null,
        hotCount: hotCountRes.status === 'fulfilled' ? hotCountRes.value : 0,
        lastMonthCount: lastMonthRes.status === 'fulfilled' ? lastMonthRes.value : 0,
      });
      setTodayTasks(todayTasksRes.status === 'fulfilled' ? (todayTasksRes.value?.data || todayTasksRes.value || []) : []);
      setOverdueTasks(overdueTasksRes.status === 'fulfilled' ? (overdueTasksRes.value?.data || overdueTasksRes.value || []) : []);
      setStaleLeads(staleLeadsRes.status === 'fulfilled' ? staleLeadsRes.value : []);
      setActivityByDay(activityRes.status === 'fulfilled' ? activityRes.value : []);
      setSourceBreakdown(sourceRes.status === 'fulfilled' ? sourceRes.value : []);
      setUpcomingTasks(upcomingRes.status === 'fulfilled' ? (upcomingRes.value?.data || upcomingRes.value || []) : []);
    } catch (err) {
      reportError('CrmDashboardPage', 'loadAll', err);
      toast.error(isRTL ? 'فشل تحميل البيانات' : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [profile, ctx, toast, isRTL]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  if (loading && !stats.contact) return <PageSkeleton />;

  // stageCounts is the raw {stage: count} map. Filter out closed stages so
  // the pipeline pie reflects only opportunities still in play.
  const pipelineData = stats.opp?.stageCounts
    ? Object.entries(stats.opp.stageCounts)
        .filter(([name]) => !['closed_won', 'closed_lost', 'cancelled'].includes(name))
        .map(([name, value], i) => ({ name, value, fill: STAGE_COLORS[i % STAGE_COLORS.length] }))
    : [];
  // openValue = sum of budget across opps that aren't closed/cancelled.
  const openValue = (stats.opp?.rawOpps || [])
    .filter(o => !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage))
    .reduce((sum, o) => sum + (parseFloat(o.deal_value || o.budget) || 0), 0);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'مساء النور' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();
  const displayName = profile?.full_name_ar || profile?.full_name_en || profile?.email || '';

  // Submit the header search by jumping to the leads page with `q` set —
  // ContactsPage already reads `searchParams.get('q')` on mount.
  const submitSearch = (e) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    navigate(`/contacts?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 sm:mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-content dark:text-content-dark m-0">
            {greeting}{displayName ? `, ${displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-content-muted dark:text-content-muted-dark mt-1 mb-0">
            {isRTL ? 'نظرة عامة على إدارة العملاء الخاصة بك' : 'Your CRM at a glance'}
          </p>
        </div>

        {/* Quick Actions: search + add-lead + add-task + refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <form onSubmit={submitSearch} className="relative">
            <Search size={14} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-2.5' : 'left-2.5'} text-content-muted dark:text-content-muted-dark pointer-events-none`} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={isRTL ? 'ابحث في العملاء…' : 'Search leads…'}
              className={`h-8 text-xs rounded-md bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark placeholder:text-content-muted dark:placeholder:text-content-muted-dark focus:outline-none focus:border-brand-500 ${isRTL ? 'pr-8 pl-2' : 'pl-8 pr-2'} w-40 sm:w-56`}
            />
          </form>
          <Link to="/contacts" className="no-underline">
            <Button variant="primary" size="sm">
              <Plus size={14} /> {isRTL ? 'عميل جديد' : 'Add Lead'}
            </Button>
          </Link>
          <Link to="/tasks" className="no-underline">
            <Button variant="secondary" size="sm">
              <Plus size={14} /> {isRTL ? 'مهمة جديدة' : 'Add Task'}
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {isRTL ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard
          label={isRTL ? 'إجمالي العملاء' : 'Total Leads'}
          value={stats.contact?.totalLeads ?? 0}
          icon={Users}
          color="brand"
          to="/contacts"
        />
        <KpiCard
          label={isRTL ? 'Hot Leads' : 'Hot Leads'}
          value={stats.hotCount ?? 0}
          icon={Flame}
          color="red"
          to="/contacts?temp=hot"
        />
        <KpiCard
          label={isRTL ? 'الفرص المفتوحة' : 'Open Opportunities'}
          value={stats.opp?.activeOpps ?? 0}
          sublabel={openValue ? formatCurrency(openValue) : null}
          icon={Target}
          color="emerald"
          to="/crm/opportunities"
        />
        <KpiCard
          label={isRTL ? 'مهام اليوم' : 'Tasks Due Today'}
          value={todayTasks.length}
          icon={CheckSquare}
          color="amber"
          to="/tasks"
        />
        <KpiCard
          label={isRTL ? 'جدد هذا الشهر' : 'New This Month'}
          value={stats.contact?.newLeadsThisMonth ?? 0}
          icon={TrendingUp}
          color="purple"
          to="/contacts"
          delta={buildDelta(stats.contact?.newLeadsThisMonth ?? 0, stats.lastMonthCount ?? 0, isRTL)}
        />
      </div>

      {/* Today's Focus */}
      <Section
        title={isRTL ? 'ركز على دلوقتي' : "Today's Focus"}
        icon={Calendar}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <FocusList
            title={isRTL ? 'مهام مستحقة اليوم' : 'Due Today'}
            items={todayTasks}
            renderItem={(t) => ({
              primary: t.title,
              secondary: t.contact_name || (isRTL ? 'بدون عميل' : 'No contact'),
              meta: t.priority,
              to: t.contact_id ? `/contacts?highlight=${t.contact_id}` : '/tasks',
            })}
            emptyMessage={isRTL ? 'مفيش مهام اليوم — استمتع!' : 'No tasks today — enjoy!'}
          />
          <FocusList
            title={isRTL ? 'مهام متأخرة' : 'Overdue Tasks'}
            items={overdueTasks}
            renderItem={(t) => ({
              primary: t.title,
              secondary: t.due_date ? formatDate(t.due_date) : null,
              meta: t.priority,
              to: t.contact_id ? `/contacts?highlight=${t.contact_id}` : '/tasks',
              flag: 'red',
            })}
            emptyMessage={isRTL ? 'مفيش متأخرات' : 'Nothing overdue'}
          />
          <FocusList
            title={isRTL ? 'عملاء بدون متابعة (7 أيام+)' : 'Stale Leads (7d+)'}
            items={staleLeads}
            renderItem={(c) => ({
              primary: c.full_name || c.phone,
              secondary: c.last_activity_at ? `${daysSince(c.last_activity_at)} ${isRTL ? 'يوم' : 'd ago'}` : (isRTL ? 'لا يوجد نشاط' : 'No activity'),
              meta: c.contact_status,
              to: `/contacts?highlight=${c.id}`,
            })}
            emptyMessage={isRTL ? 'كل العملاء تتم متابعتهم 👏' : 'Every lead is being followed up 👏'}
          />
        </div>
      </Section>

      {/* Upcoming reminders — tasks due in the next 48h (after today). Only
          render the section when there's actually something coming, so an
          empty pipeline doesn't add a useless empty card. */}
      {upcomingTasks.length > 0 && (
        <Section title={isRTL ? 'قادم خلال 48 ساعة' : 'Upcoming (next 48h)'} icon={Bell}>
          <FocusList
            title={isRTL ? 'مهام قادمة' : 'Coming up'}
            items={upcomingTasks}
            renderItem={(t) => ({
              primary: t.title,
              secondary: [t.contact_name, t.due_date ? formatDate(t.due_date) : null].filter(Boolean).join(' • '),
              meta: t.priority,
              to: t.contact_id ? `/contacts?highlight=${t.contact_id}` : '/tasks',
            })}
            emptyMessage={isRTL ? 'لا يوجد قادم' : 'Nothing upcoming'}
          />
        </Section>
      )}

      {/* Pipeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <Section title={isRTL ? 'خط البيع' : 'Pipeline'} icon={BarChart3} compact>
          {pipelineData.length === 0 ? (
            <EmptyState message={isRTL ? 'مفيش فرص حالياً' : 'No opportunities yet'} />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pipelineData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {pipelineData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title={isRTL ? 'النشاط (14 يوم)' : 'Activity (14 days)'} icon={Activity} compact>
          {activityByDay.length === 0 ? (
            <EmptyState message={isRTL ? 'مفيش نشاط مسجل' : 'No activity yet'} />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityByDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4A7AAB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      {/* Source breakdown — managers+ only */}
      {sourceBreakdown.length > 0 && (
        <Section title={isRTL ? 'أداء المصادر' : 'Source Performance'} icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark">
                  <th className="text-start py-2 px-3">{isRTL ? 'المصدر' : 'Source'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'عدد leads' : 'Leads'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'فرص' : 'Opps'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'تحويل' : 'Conv %'}</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.map(s => (
                  <tr key={s.source} className="border-b border-edge/30 dark:border-edge-dark/30">
                    <td className="py-2 px-3 font-medium text-content dark:text-content-dark">{s.source}</td>
                    <td className="py-2 px-3 text-end text-content dark:text-content-dark">{s.leads}</td>
                    <td className="py-2 px-3 text-end text-content dark:text-content-dark">{s.opps}</td>
                    <td className="py-2 px-3 text-end font-semibold text-emerald-500">{s.conversion.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

// New leads created during the previous calendar month (e.g. if today is
// May 24, this counts everything created between Apr 1 00:00 and May 1 00:00).
// Drives the period-comparison delta on the "New This Month" KPI card.
async function loadLastMonthNewCount(ctx) {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .gte('created_at', lastMonthStart)
    .lt('created_at', thisMonthStart);
  if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
  const { count, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadLastMonthNewCount', error); return 0; }
  return count || 0;
}

async function loadHotLeadsCount(ctx) {
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('temperature', 'hot')
    .eq('is_deleted', false)
    .neq('contact_status', 'disqualified');
  if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
  const { count, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadHotLeadsCount', error); return 0; }
  return count || 0;
}

async function loadStaleLeads(ctx, sevenDaysAgo) {
  let query = supabase
    .from('contacts')
    .select('id, full_name, phone, contact_status, last_activity_at, assigned_to')
    .eq('is_deleted', false)
    .neq('contact_status', 'disqualified')
    .or(`last_activity_at.lt.${sevenDaysAgo},last_activity_at.is.null`)
    .order('last_activity_at', { ascending: true, nullsFirst: true })
    .limit(5);
  if (ctx.role === 'sales_agent' && ctx.userId) query = query.eq('assigned_to', ctx.userId);
  const { data, error } = await query;
  if (error) { reportError('CrmDashboardPage', 'loadStaleLeads', error); return []; }
  return data || [];
}

async function loadActivityByDay(ctx, sinceIso) {
  // Only need created_at for the daily-buckets grouping. The earlier query
  // also selected user_id which was used nowhere — pure wasted bandwidth.
  let query = supabase
    .from('activities')
    .select('created_at')
    .gte('created_at', sinceIso);
  if (ctx.role === 'sales_agent' && ctx.userId) query = query.eq('user_id', ctx.userId);
  const { data, error } = await query;
  if (error) { reportError('CrmDashboardPage', 'loadActivityByDay', error); return []; }
  // Group by day (YYYY-MM-DD)
  const byDay = {};
  (data || []).forEach(a => {
    if (!a.created_at) return;
    const day = a.created_at.slice(5, 10); // MM-DD
    byDay[day] = (byDay[day] || 0) + 1;
  });
  // Fill missing days with 0 so the bar chart has a continuous x-axis
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(5, 10);
    out.push({ day: key, count: byDay[key] || 0 });
  }
  return out;
}

async function loadSourceBreakdown(ctx) {
  // Pull contacts + opps in parallel, then aggregate client-side. The
  // counts respect RLS so each role only sees their scope.
  let contactQuery = supabase.from('contacts').select('id, source').eq('is_deleted', false);
  let oppQuery = supabase.from('opportunities').select('contact_id');
  if (ctx.role === 'sales_agent' && ctx.userId) {
    contactQuery = contactQuery.eq('assigned_to', ctx.userId);
    oppQuery = oppQuery.eq('assigned_to', ctx.userId);
  }
  const [{ data: contacts }, { data: opps }] = await Promise.all([contactQuery, oppQuery]);
  if (!contacts) return [];
  // Normalize source so "Facebook" and "facebook" group together — the DB
  // has both casings depending on which import script wrote the row. Use
  // the lowercased key for grouping, keep the most common original spelling
  // as the display label.
  const contactsBySource = {};
  contacts.forEach(c => {
    const original = c.source || 'unknown';
    const key = original.toLowerCase();
    contactsBySource[key] = contactsBySource[key] || { leads: 0, contactIds: new Set(), label: original };
    contactsBySource[key].leads += 1;
    contactsBySource[key].contactIds.add(c.id);
  });
  const oppContactIds = new Set((opps || []).map(o => o.contact_id).filter(Boolean));
  const rows = Object.values(contactsBySource).map(v => {
    const oppsForSource = [...v.contactIds].filter(id => oppContactIds.has(id)).length;
    return {
      source: v.label,
      leads: v.leads,
      opps: oppsForSource,
      conversion: v.leads > 0 ? (oppsForSource / v.leads) * 100 : 0,
    };
  });
  return rows.sort((a, b) => b.leads - a.leads).slice(0, 8);
}

function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

function formatCurrency(n) {
  if (n == null) return '';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

// Build a small {direction, label, tone} object for the period-comparison
// badge on a KPI card. Returns null when there's nothing meaningful to
// compare against (e.g. last month was also zero — no signal).
function buildDelta(current, previous, isRTL) {
  if (!previous && !current) return null;
  if (!previous) return { direction: 'up', label: isRTL ? 'جديد' : 'new', tone: 'pos' };
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (diff === 0) return { direction: 'flat', label: isRTL ? 'بدون تغيير' : 'flat', tone: 'neutral' };
  const sign = diff > 0 ? '+' : '';
  return {
    direction: diff > 0 ? 'up' : 'down',
    label: `${sign}${pct}%`,
    tone: diff > 0 ? 'pos' : 'neg',
  };
}

// ── presentation components ────────────────────────────────────────────────

function KpiCard({ label, value, sublabel, icon: Icon, color = 'brand', to, delta }) {
  const colorMap = {
    brand: 'text-brand-500 bg-brand-500/10 border-brand-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  };
  const DeltaIcon = delta?.direction === 'up' ? ArrowUp : delta?.direction === 'down' ? ArrowDown : Minus;
  const deltaToneClass = delta?.tone === 'pos'
    ? 'text-emerald-500'
    : delta?.tone === 'neg'
      ? 'text-red-500'
      : 'text-content-muted dark:text-content-muted-dark';
  const content = (
    <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-3 sm:p-4 hover:border-brand-500/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-medium">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center border ${colorMap[color] || colorMap.brand}`}>
          <Icon size={14} />
        </span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-content dark:text-content-dark leading-tight">{value.toLocaleString()}</div>
      {sublabel && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-1">{sublabel}</div>}
      {delta && (
        <div className={`text-[11px] font-medium mt-1 inline-flex items-center gap-0.5 ${deltaToneClass}`}>
          <DeltaIcon size={11} /> {delta.label}
        </div>
      )}
    </div>
  );
  return to ? <Link to={to} className="block no-underline">{content}</Link> : content;
}

function Section({ title, icon: Icon, compact = false, children }) {
  return (
    <section className={`bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} mb-3`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-content-muted dark:text-content-muted-dark" />}
        <h2 className="text-sm font-bold text-content dark:text-content-dark m-0">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FocusList({ title, items, renderItem, emptyMessage }) {
  return (
    <div className="bg-surface-bg dark:bg-surface-bg-dark rounded-lg p-3 border border-edge/50 dark:border-edge-dark/50">
      <h3 className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-2 mt-0">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-content-muted dark:text-content-muted-dark italic my-2">{emptyMessage}</p>
      ) : (
        <ul className="list-none p-0 m-0 space-y-1.5">
          {items.map((item, i) => {
            const r = renderItem(item);
            const node = (
              <div className={`flex items-start justify-between gap-2 p-2 rounded hover:bg-surface-card dark:hover:bg-surface-card-dark transition-colors ${r.flag === 'red' ? 'border-s-2 border-red-500/40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-content dark:text-content-dark truncate">{r.primary}</div>
                  {r.secondary && <div className="text-[10px] text-content-muted dark:text-content-muted-dark truncate">{r.secondary}</div>}
                </div>
                {r.meta && <span className="text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">{r.meta}</span>}
                {r.to && <ChevronRight size={12} className="text-content-muted dark:text-content-muted-dark mt-1 shrink-0" />}
              </div>
            );
            return <li key={i}>{r.to ? <Link to={r.to} className="no-underline">{node}</Link> : node}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-content-muted dark:text-content-muted-dark text-xs">
      <AlertCircle size={14} className="me-1.5" /> {message}
    </div>
  );
}
