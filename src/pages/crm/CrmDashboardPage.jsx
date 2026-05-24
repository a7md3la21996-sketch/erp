import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { useToast } from '../../contexts/ToastContext';
import supabase from '../../lib/supabase';
import {
  Users, Target, CheckSquare, Flame, AlertCircle, TrendingUp,
  Calendar, ChevronRight, RefreshCw, BarChart3, Activity,
  Search, Plus, Bell, ArrowUp, ArrowDown, Minus,
  Phone, FileText, MessageCircle, ArrowRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { PageSkeleton, Button } from '../../components/ui';
import { fetchContactStats, fetchOpportunityStats } from '../../services/dashboardService';
import { fetchTasks } from '../../services/tasksService';
import { reportError } from '../../utils/errorReporter';

const STAGE_COLORS = ['#4A7AAB', '#6B8DB5', '#92B0CC', '#F59E0B', '#10B981', '#059669', '#6B21A8'];

// sessionStorage cache for instant-feel tab returns. TTL is intentionally
// short — long enough that flipping to /contacts and back skips the
// full re-fetch, short enough that the data the user sees isn't
// meaningfully stale. The cache is also scoped per (userId, role) so
// no cross-account leak and so role upgrades invalidate naturally.
const DASHBOARD_CACHE_PREFIX = 'crm-dashboard';
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;

function readDashboardCache(userId, role) {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = sessionStorage.getItem(`${DASHBOARD_CACHE_PREFIX}:${userId}:${role}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > DASHBOARD_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch { return null; }
}

function writeDashboardCache(userId, role, data) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    sessionStorage.setItem(
      `${DASHBOARD_CACHE_PREFIX}:${userId}:${role}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch { /* quota exceeded — drop silently, fresh fetch still fires */ }
}

/**
 * CRM Dashboard — single-screen overview tying contacts / opps / tasks /
 * activities into a sales rep's "what do I work on next" landing page.
 *
 * Sections (top to bottom):
 *   1. KPI cards row — leads, hot, open opps, tasks due today, new-this-month
 *   2. Today's Focus — tasks due today, overdue tasks, stale leads
 *   3. Upcoming — pending tasks in the next 48h (hidden when empty)
 *   4. Pipeline + Activity chart — funnel by stage, 14-day activity bars
 *   5. Recent Activity Feed — last 15 events with actor / contact / time
 *   6. Top Performers (managers+) — leaderboard for the month
 *   7. Lost Deal Reasons (managers+) — why deals slipped this month
 *   8. Source Performance (managers+) — leads + conversion by source
 *
 * Role-aware: sales_agent sees own data, leader/manager see team, admin/ops
 * see everything. Driven by the existing dashboardService applyRoleFilter
 * — no per-page role logic here.
 */
export default function CrmDashboardPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { lostReasons: configLostReasons } = useSystemConfig();
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
  const [recentFeed, setRecentFeed] = useState([]);
  // Map of {userId: {id, name, leads}} for contacts assigned + created
  // this month. Combined with stats.opp.rawOpps below to rank top
  // performers. Empty for sales_agent (they shouldn't see this section).
  const [leadsByUser, setLeadsByUser] = useState({});
  // Raw closed_lost opps closed this month, with the lost_reason field.
  // rawOpps from dashboardService doesn't select lost_reason so this is
  // a dedicated fetch — small slice, narrow column set, cheap query.
  const [lostThisMonth, setLostThisMonth] = useState([]);
  // {fresh, aging, old} — counts of non-disqualified leads by age bucket.
  // Powers the Lead Aging section. RLS handles scoping; sales_agent
  // additionally gets an assigned_to filter inside the loader.
  const [agingBuckets, setAgingBuckets] = useState({ fresh: 0, aging: 0, old: 0 });
  // Count of active leads older than the SLA window that still have
  // no first-touch activity. Powers the SLA Breaches alert section.
  const [slaBreachCount, setSlaBreachCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  // True once we've successfully rendered real (non-skeleton) data from
  // either the sessionStorage cache or a completed loadAll. Drives the
  // page-skeleton suppression so subsequent refreshes don't blank the
  // page out — stale data stays visible during background refetch.
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  const hydratedRef = useRef(false);

  const ctx = useMemo(() => ({
    role: profile?.role,
    userId: profile?.id,
    teamId: profile?.team_id,
  }), [profile?.role, profile?.id, profile?.team_id]);

  // Hydrate from sessionStorage cache once per mount. Runs as soon as
  // ctx is populated (i.e. profile has resolved). If a fresh cache is
  // present, we render real data immediately and rely on the background
  // loadAll below to refresh it — the user never sees a skeleton on
  // tab-switch returns.
  useEffect(() => {
    if (hydratedRef.current || !ctx.userId) return;
    const cached = readDashboardCache(ctx.userId, ctx.role);
    hydratedRef.current = true;
    if (!cached) return;
    if (cached.stats) setStats(cached.stats);
    if (cached.todayTasks) setTodayTasks(cached.todayTasks);
    if (cached.overdueTasks) setOverdueTasks(cached.overdueTasks);
    if (cached.staleLeads) setStaleLeads(cached.staleLeads);
    if (cached.activityByDay) setActivityByDay(cached.activityByDay);
    if (cached.sourceBreakdown) setSourceBreakdown(cached.sourceBreakdown);
    if (cached.upcomingTasks) setUpcomingTasks(cached.upcomingTasks);
    if (cached.recentFeed) setRecentFeed(cached.recentFeed);
    if (cached.leadsByUser) setLeadsByUser(cached.leadsByUser);
    if (cached.lostThisMonth) setLostThisMonth(cached.lostThisMonth);
    if (cached.agingBuckets) setAgingBuckets(cached.agingBuckets);
    if (typeof cached.slaBreachCount === 'number') setSlaBreachCount(cached.slaBreachCount);
    setHasEverLoaded(true);
  }, [ctx.userId, ctx.role]);

  // Monotonically-increasing call id used to drop stale loadAll results.
  // Each invocation snapshots its id; after all fetches resolve, it
  // compares to the current ref — if a newer call has started, the old
  // one drops its writes instead of overwriting fresher state.
  const loadIdRef = useRef(0);
  // isRTL is read inside loadAll's error path only; keeping it as a ref
  // means language switches don't recreate loadAll → don't fire useEffect
  // → don't refetch every panel for nothing.
  const isRTLRef = useRef(isRTL);
  useEffect(() => { isRTLRef.current = isRTL; }, [isRTL]);

  const loadAll = useCallback(async () => {
    if (!ctx.userId) return;
    const myLoadId = ++loadIdRef.current;
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

      const isManagerPlus = ['admin', 'operations', 'sales_director', 'sales_manager', 'team_leader'].includes(ctx.role);

      // Parallel-fetch every panel. Each one's failure is reported but
      // doesn't block the others — partial data is better than a blank page.
      const [
        contactStats, oppStats, hotCountRes, lastMonthRes,
        todayTasksRes, overdueTasksRes, staleLeadsRes,
        activityRes, sourceRes, upcomingRes, recentFeedRes, leadsByUserRes, lostRes,
        agingRes, slaRes,
      ] = await Promise.allSettled([
        fetchContactStats(ctx),
        fetchOpportunityStats(ctx),
        loadHotLeadsCount(ctx),
        loadLastMonthNewCount(ctx),
        fetchTasks({ ...ctx, dueDateFrom: todayStart, dueDateTo: todayEnd, status: 'pending', pageSize: 5, page: 1 }),
        fetchTasks({ ...ctx, overdueOnly: true, status: 'pending', pageSize: 5, page: 1 }),
        loadStaleLeads(ctx, sevenDaysAgo),
        loadActivityByDay(ctx, fourteenDaysAgo),
        isManagerPlus ? loadSourceBreakdown(ctx) : Promise.resolve([]),
        fetchTasks({ ...ctx, dueDateFrom: todayEnd, dueDateTo: upcomingEnd, status: 'pending', pageSize: 5, page: 1 }),
        loadRecentActivityFeed(ctx),
        isManagerPlus ? loadLeadsThisMonthByUser() : Promise.resolve({}),
        isManagerPlus ? loadLostThisMonth() : Promise.resolve([]),
        loadAgingBuckets(ctx),
        loadSlaBreaches(ctx),
      ]);

      // Drop writes if a newer load has started — protects against the
      // refresh-twice-fast race that would otherwise let stale data
      // overwrite the freshest result.
      if (myLoadId !== loadIdRef.current) return;

      // Compute every next-state value once so we can both setState
      // and write the same snapshot to cache without re-deriving.
      const nextStats = {
        contact: contactStats.status === 'fulfilled' ? contactStats.value : null,
        opp: oppStats.status === 'fulfilled' ? oppStats.value : null,
        hotCount: hotCountRes.status === 'fulfilled' ? hotCountRes.value : 0,
        lastMonthCount: lastMonthRes.status === 'fulfilled' ? lastMonthRes.value : 0,
      };
      const nextTodayTasks = todayTasksRes.status === 'fulfilled' ? (todayTasksRes.value?.data || todayTasksRes.value || []) : [];
      const nextOverdueTasks = overdueTasksRes.status === 'fulfilled' ? (overdueTasksRes.value?.data || overdueTasksRes.value || []) : [];
      const nextStaleLeads = staleLeadsRes.status === 'fulfilled' ? staleLeadsRes.value : [];
      const nextActivityByDay = activityRes.status === 'fulfilled' ? activityRes.value : [];
      const nextSourceBreakdown = sourceRes.status === 'fulfilled' ? sourceRes.value : [];
      const nextUpcomingTasks = upcomingRes.status === 'fulfilled' ? (upcomingRes.value?.data || upcomingRes.value || []) : [];
      const nextRecentFeed = recentFeedRes.status === 'fulfilled' ? recentFeedRes.value : [];
      const nextLeadsByUser = leadsByUserRes.status === 'fulfilled' ? leadsByUserRes.value : {};
      const nextLostThisMonth = lostRes.status === 'fulfilled' ? lostRes.value : [];
      const nextAgingBuckets = agingRes.status === 'fulfilled' ? agingRes.value : { fresh: 0, aging: 0, old: 0 };
      const nextSlaBreachCount = slaRes.status === 'fulfilled' ? slaRes.value : 0;

      setStats(nextStats);
      setTodayTasks(nextTodayTasks);
      setOverdueTasks(nextOverdueTasks);
      setStaleLeads(nextStaleLeads);
      setActivityByDay(nextActivityByDay);
      setSourceBreakdown(nextSourceBreakdown);
      setUpcomingTasks(nextUpcomingTasks);
      setRecentFeed(nextRecentFeed);
      setLeadsByUser(nextLeadsByUser);
      setLostThisMonth(nextLostThisMonth);
      setAgingBuckets(nextAgingBuckets);
      setSlaBreachCount(nextSlaBreachCount);
      setHasEverLoaded(true);

      writeDashboardCache(ctx.userId, ctx.role, {
        stats: nextStats,
        todayTasks: nextTodayTasks,
        overdueTasks: nextOverdueTasks,
        staleLeads: nextStaleLeads,
        activityByDay: nextActivityByDay,
        sourceBreakdown: nextSourceBreakdown,
        upcomingTasks: nextUpcomingTasks,
        recentFeed: nextRecentFeed,
        leadsByUser: nextLeadsByUser,
        lostThisMonth: nextLostThisMonth,
        agingBuckets: nextAgingBuckets,
        slaBreachCount: nextSlaBreachCount,
      });
    } catch (err) {
      reportError('CrmDashboardPage', 'loadAll', err);
      toast.error(isRTLRef.current ? 'فشل تحميل البيانات' : 'Failed to load dashboard');
    } finally {
      // Only the latest call resets loading — stale calls leave it alone
      // so the in-flight load's UI state isn't yanked out from under it.
      if (myLoadId === loadIdRef.current) setLoading(false);
    }
  }, [ctx, toast]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  // Auto-refresh every 5 minutes when the tab is in the foreground.
  // Skipping hidden tabs keeps idle/background sessions from hammering
  // the API; the dashboard refreshes naturally the moment the user
  // comes back to the tab via the visibilitychange listener below.
  useEffect(() => {
    const FIVE_MIN = 5 * 60 * 1000;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        setRefreshKey(k => k + 1);
      }
    };
    const id = setInterval(tick, FIVE_MIN);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // ── derived values via hooks. All hooks must run on every render —
  // keep them above the loading early-return below or React throws #310
  // ("rendered more hooks than during the previous render").

  // Top Performers — only computed for manager+/admin/ops, otherwise the
  // section never renders and the work is skipped. Combines leadsByUser
  // (this month, from a dedicated query) with rawOpps (already fetched)
  // to count open opportunities + wins per user. Ranking favours wins
  // because closed deals matter most; leads tie-break.
  const topPerformers = useMemo(() => {
    const isManagerPlus = ['admin', 'operations', 'sales_director', 'sales_manager', 'team_leader'].includes(profile?.role);
    if (!isManagerPlus) return [];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const opps = stats.opp?.rawOpps || [];
    const oppsByUser = {};
    const winsByUser = {};
    opps.forEach(o => {
      if (!o.assigned_to) return;
      // "Opps" column shows open pipeline only — closed/cancelled deals
      // are reflected in the "Wins" column or excluded entirely.
      const isOpen = !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage);
      if (isOpen) oppsByUser[o.assigned_to] = (oppsByUser[o.assigned_to] || 0) + 1;
      const closedAt = new Date(o.stage_changed_at || o.created_at).getTime();
      if (o.stage === 'closed_won' && closedAt >= monthStart) {
        winsByUser[o.assigned_to] = (winsByUser[o.assigned_to] || 0) + 1;
      }
    });
    const userIds = new Set([
      ...Object.keys(leadsByUser),
      ...Object.keys(oppsByUser),
    ]);
    return [...userIds]
      .map(id => ({
        id,
        name: leadsByUser[id]?.name || '—',
        leads: leadsByUser[id]?.leads || 0,
        opps: oppsByUser[id] || 0,
        wins: winsByUser[id] || 0,
      }))
      .filter(r => r.leads + r.opps + r.wins > 0)
      .sort((a, b) => (b.wins * 3 + b.opps + b.leads * 0.5) - (a.wins * 3 + a.opps + a.leads * 0.5))
      .slice(0, 5);
  }, [profile?.role, leadsByUser, stats.opp?.rawOpps]);

  // Reason → label map (ar/en) from system config. Falls back to the raw
  // key when no config entry exists (drift safety).
  const lostReasonsMap = useMemo(() => {
    const m = {};
    (configLostReasons || []).forEach(r => { m[r.key] = r; });
    return m;
  }, [configLostReasons]);

  // Group lost-this-month opps by reason → sorted list of {key, label, count, pct}.
  // The "no reason" bucket is kept distinct so reps can see when reasons
  // aren't being captured.
  const lostReasonBreakdown = useMemo(() => {
    if (lostThisMonth.length === 0) return [];
    const counts = {};
    lostThisMonth.forEach(o => {
      const key = o.lost_reason || '__no_reason__';
      counts[key] = (counts[key] || 0) + 1;
    });
    const total = lostThisMonth.length;
    return Object.entries(counts)
      .map(([key, count]) => {
        const labelSource = key === '__no_reason__'
          ? null
          : lostReasonsMap[key];
        const label = labelSource
          ? (isRTL ? labelSource.label_ar : labelSource.label_en)
          : key === '__no_reason__'
            ? (isRTL ? 'لم يُذكر سبب' : 'No reason given')
            : key;
        return { key, label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
      })
      .sort((a, b) => b.count - a.count);
  }, [lostThisMonth, lostReasonsMap, isRTL]);

  // Conversion funnel: this-month new leads → opps created this month →
  // wins closed this month. Uses contact stats + rawOpps so no extra
  // query needed. Conversion rates are computed cumulative (lead→opp,
  // opp→win) for the most meaningful drop-off readout.
  const funnelData = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const leads = stats.contact?.newLeadsThisMonth ?? 0;
    const rawOpps = stats.opp?.rawOpps || [];
    const oppsThisMonth = rawOpps.filter(o => new Date(o.created_at).getTime() >= monthStart).length;
    const winsThisMonth = stats.opp?.closedThisMonth ?? 0;
    const leadToOpp = leads > 0 ? Math.round((oppsThisMonth / leads) * 100) : 0;
    const oppToWin = oppsThisMonth > 0 ? Math.round((winsThisMonth / oppsThisMonth) * 100) : 0;
    return { leads, opps: oppsThisMonth, wins: winsThisMonth, leadToOpp, oppToWin };
  }, [stats.contact?.newLeadsThisMonth, stats.opp?.rawOpps, stats.opp?.closedThisMonth]);

  // Revenue per month for the last 6 calendar months, derived entirely
  // from rawOpps (closed_won + stage_changed_at or created_at within
  // the month). Months are emitted oldest-first for natural chart flow.
  const revenueTrend = useMemo(() => {
    const rawOpps = stats.opp?.rawOpps || [];
    const now = new Date();
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      const monthRevenue = rawOpps
        .filter(o => o.stage === 'closed_won')
        .filter(o => {
          const t = new Date(o.stage_changed_at || o.created_at).getTime();
          return t >= start && t < end;
        })
        .reduce((sum, o) => sum + (parseFloat(o.deal_value || o.budget) || 0), 0);
      const label = new Date(start).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });
      out.push({ month: label, revenue: monthRevenue });
    }
    return out;
  }, [stats.opp?.rawOpps, isRTL]);

  // Show page skeleton only on the very first load with no cache. Once
  // we've ever rendered real data (from cache hydration or a completed
  // fetch), subsequent background refreshes update the page in place —
  // the user keeps seeing stale data rather than a wiped layout.
  if (loading && !hasEverLoaded) return <PageSkeleton />;

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
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 sm:p-6 max-w-[1400px] mx-auto pb-24 sm:pb-6">
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
          {/* Hide add-buttons on mobile — they live in the bottom FAB bar
              instead so the header stays compact and the thumb-reach
              zone has the primary actions. */}
          <Link to="/contacts" className="no-underline hidden sm:block">
            <Button variant="primary" size="sm">
              <Plus size={14} /> {isRTL ? 'عميل جديد' : 'Add Lead'}
            </Button>
          </Link>
          <Link to="/tasks" className="no-underline hidden sm:block">
            <Button variant="secondary" size="sm">
              <Plus size={14} /> {isRTL ? 'مهمة جديدة' : 'Add Task'}
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {isRTL ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI cards row — horizontal scroll on mobile (snap per card),
          flips to grid at sm and above. The negative margin + padding
          on the mobile flex makes the scroll track bleed to the edges
          of the screen so cards aren't visually cramped in the page
          container's padding. */}
      <div className="flex sm:grid gap-3 mb-6 overflow-x-auto sm:overflow-visible sm:grid-cols-3 lg:grid-cols-5 -mx-4 sm:mx-0 px-4 sm:px-0 snap-x snap-mandatory sm:snap-none">
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard
          label={isRTL ? 'إجمالي العملاء' : 'Total Leads'}
          value={stats.contact?.totalLeads ?? 0}
          icon={Users}
          color="brand"
          to="/contacts"
          description={isRTL
            ? 'كل العملاء غير المحذوفين في نطاق صلاحياتك.'
            : 'All non-deleted leads in your permission scope.'}
        />
        </div>
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard
          label={isRTL ? 'العملاء الواعدون' : 'Hot Leads'}
          value={stats.hotCount ?? 0}
          icon={Flame}
          color="red"
          to="/contacts?temp=hot"
          description={isRTL
            ? 'عملاء مصنفون "Hot" — أعلى أولوية للمتابعة.'
            : 'Leads marked Hot — highest follow-up priority.'}
        />
        </div>
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard
          label={isRTL ? 'الفرص المفتوحة' : 'Open Opportunities'}
          value={stats.opp?.activeOpps ?? 0}
          sublabel={openValue ? formatCurrency(openValue) : null}
          icon={Target}
          color="emerald"
          to="/crm/opportunities"
          description={isRTL
            ? 'الفرص غير المغلقة. الرقم أسفل = إجمالي القيمة المتوقعة.'
            : 'Opportunities not closed/cancelled. Subtitle = total open pipeline value.'}
        />
        </div>
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard
          label={isRTL ? 'مهام اليوم' : 'Tasks Due Today'}
          value={todayTasks.length}
          icon={CheckSquare}
          color="amber"
          to="/tasks"
          description={isRTL
            ? 'مهام معلقة مستحقة اليوم.'
            : 'Pending tasks due today.'}
        />
        </div>
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard
          label={isRTL ? 'جدد هذا الشهر' : 'New This Month'}
          value={stats.contact?.newLeadsThisMonth ?? 0}
          icon={TrendingUp}
          color="purple"
          to="/contacts"
          delta={buildDelta(stats.contact?.newLeadsThisMonth ?? 0, stats.lastMonthCount ?? 0, isRTL)}
          description={isRTL
            ? 'عملاء أُضيفوا منذ بداية الشهر. الشارة = الفرق عن الشهر السابق.'
            : 'Leads created since the 1st. Badge = delta vs. previous month.'}
        />
        </div>
      </div>

      {/* SLA breach alert — leads created more than SLA_HOURS ago that
          still have zero activity. Only renders when count > 0 so a
          well-handled day stays quiet. Links into the "never contacted"
          filter on the leads page. */}
      {slaBreachCount > 0 && (
        <Link
          to="/contacts?activity=never"
          className="block no-underline mb-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 rounded-xl p-3 sm:p-4 transition-colors"
          title={isRTL ? `عملاء بدون أي تواصل خلال أكثر من ${SLA_HOURS} ساعات` : `Leads with no activity for more than ${SLA_HOURS} hours`}
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/20 text-red-500 border border-red-500/30 shrink-0">
              <AlertCircle size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-500">
                {isRTL
                  ? `${slaBreachCount} عميل بحاجة لأول تواصل (>${SLA_HOURS}س)`
                  : `${slaBreachCount} leads need first contact (>${SLA_HOURS}h)`}
              </div>
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">
                {isRTL
                  ? 'تجاوزوا نافذة الاستجابة المعتمدة دون أي نشاط مسجَّل.'
                  : 'Exceeded the response window with no activity logged.'}
              </div>
            </div>
            <ChevronRight size={16} className={`text-red-500 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
          </div>
        </Link>
      )}

      {/* Lead Aging — distribution of non-disqualified leads by age.
          Hidden if all three buckets are empty (a totally fresh tenant
          or no permission to see any leads). */}
      {(agingBuckets.fresh + agingBuckets.aging + agingBuckets.old > 0) && (
        <Section title={isRTL ? 'عمر العملاء' : 'Lead Aging'} icon={Calendar} compact>
          <div className="grid grid-cols-3 gap-3">
            <AgingBucket
              label={isRTL ? 'حديثة' : 'Fresh'}
              sub={isRTL ? '0-7 أيام' : '0–7 days'}
              count={agingBuckets.fresh}
              tone="emerald"
            />
            <AgingBucket
              label={isRTL ? 'في الانتظار' : 'Aging'}
              sub={isRTL ? '7-30 يوم' : '7–30 days'}
              count={agingBuckets.aging}
              tone="amber"
            />
            <AgingBucket
              label={isRTL ? 'قديمة' : 'Old'}
              sub={isRTL ? '30+ يوم' : '30+ days'}
              count={agingBuckets.old}
              tone="red"
            />
          </div>
        </Section>
      )}

      {/* Conversion Funnel — leads/opps/wins this month with the two
          drop-off rates that matter. Hidden when there's nothing to
          measure yet (a fresh tenant with zero leads). */}
      {funnelData.leads > 0 && (
        <Section title={isRTL ? 'قمع التحويل (هذا الشهر)' : 'Conversion Funnel (This Month)'} icon={Target} compact>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <FunnelStep label={isRTL ? 'عملاء' : 'Leads'}      value={funnelData.leads} tone="brand" />
            <FunnelStep
              label={isRTL ? 'فرص' : 'Opps'}
              value={funnelData.opps}
              tone="amber"
              conversion={funnelData.leadToOpp}
              isRTL={isRTL}
            />
            <FunnelStep
              label={isRTL ? 'صفقات' : 'Wins'}
              value={funnelData.wins}
              tone="emerald"
              conversion={funnelData.oppToWin}
              isRTL={isRTL}
            />
          </div>
        </Section>
      )}

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
                  <Pie
                    data={pipelineData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, value }) => `${name}: ${value}`}
                    onClick={(d) => d?.name && navigate(`/crm/opportunities?stage=${encodeURIComponent(d.name)}`)}
                    style={{ cursor: 'pointer' }}
                  >
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

      {/* Revenue trend — closed_won totals across the last 6 calendar
          months. Derived entirely from rawOpps so no extra query.
          Hidden when every bucket is zero (a healthy "hide noise" check). */}
      {revenueTrend.some(m => m.revenue > 0) && (
        <Section title={isRTL ? 'الإيرادات (آخر 6 شهور)' : 'Revenue (Last 6 Months)'} icon={TrendingUp} compact>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Recent activity feed — most recent 15 events. RLS already
          constrains visibility per role, so we just render whatever
          comes back. Hidden when there's nothing to show. */}
      {recentFeed.length > 0 && (
        <Section title={isRTL ? 'آخر النشاطات' : 'Recent Activity'} icon={Activity}>
          <ul className="list-none p-0 m-0 divide-y divide-edge/40 dark:divide-edge-dark/40">
            {recentFeed.map((a) => {
              const meta = getActivityMeta(a.type, isRTL);
              const actor = isRTL
                ? (a.user_name_ar || a.user_name_en || 'مستخدم')
                : (a.user_name_en || a.user_name_ar || 'User');
              const Icon = meta.icon;
              const node = (
                <div className="flex items-start gap-3 py-2.5 px-1 hover:bg-surface-bg dark:hover:bg-surface-bg-dark rounded transition-colors">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand-500/10 text-brand-500 border border-brand-500/20 shrink-0 mt-0.5">
                    <Icon size={13} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-content dark:text-content-dark">
                      <span className="font-semibold">{actor}</span>
                      <span className="text-content-muted dark:text-content-muted-dark"> · {meta.label}</span>
                      {a.contact_name && (
                        <>
                          <span className="text-content-muted dark:text-content-muted-dark"> {isRTL ? 'مع' : 'with'} </span>
                          <span className="font-medium">{a.contact_name}</span>
                        </>
                      )}
                    </div>
                    {a.notes && (
                      <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5 truncate">{a.notes}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap mt-0.5">
                    {formatRelativeTime(a.created_at, isRTL)}
                  </span>
                </div>
              );
              return (
                <li key={a.id}>
                  {a.contact_id
                    ? <Link to={`/contacts?highlight=${a.contact_id}`} className="no-underline block">{node}</Link>
                    : node}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Top Performers — managers+ only. Ranked by wins this month
          (3x weight), open opps, and new leads (0.5x). Hidden when
          there's no activity yet to rank. */}
      {topPerformers.length > 0 && (
        <Section title={isRTL ? 'الأفضل أداءً (هذا الشهر)' : 'Top Performers (This Month)'} icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark">
                  <th className="text-start py-2 px-3 w-8">#</th>
                  <th className="text-start py-2 px-3">{isRTL ? 'الموظف' : 'Member'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'عملاء جدد' : 'New Leads'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'فرص' : 'Opps'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'صفقات' : 'Wins'}</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((p, i) => {
                  // Clickable when we have a real name to drill on. The
                  // dashboard's "—" sentinel means the assigned_to_name
                  // column was null for this user, so the smart filter
                  // wouldn't match anything — skip the navigate in that case.
                  const canDrill = p.name && p.name !== '—';
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-edge/30 dark:border-edge-dark/30 ${canDrill ? 'cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark' : ''}`}
                      onClick={canDrill
                        ? () => navigate('/contacts', { state: { drillDown: { field: 'assigned_to_name', value: p.name } } })
                        : undefined}
                      title={canDrill ? (isRTL ? `عرض عملاء ${p.name}` : `View leads assigned to ${p.name}`) : undefined}
                    >
                      <td className="py-2 px-3 text-content-muted dark:text-content-muted-dark font-semibold">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-content dark:text-content-dark">{p.name}</td>
                      <td className="py-2 px-3 text-end text-content dark:text-content-dark">{p.leads}</td>
                      <td className="py-2 px-3 text-end text-content dark:text-content-dark">{p.opps}</td>
                      <td className="py-2 px-3 text-end font-semibold text-emerald-500">{p.wins}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Lost deals breakdown — managers+ only. Horizontal-bar list
          showing why deals slipped this month. Hidden when nothing was
          lost so a healthy month doesn't trigger a misleading empty card. */}
      {lostReasonBreakdown.length > 0 && (
        <Section title={isRTL ? 'أسباب خسارة الصفقات (هذا الشهر)' : 'Lost Deal Reasons (This Month)'} icon={AlertCircle}>
          <ul className="list-none p-0 m-0 space-y-2">
            {lostReasonBreakdown.map((r) => (
              <li key={r.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-content dark:text-content-dark font-medium truncate">{r.label}</span>
                  <span className="text-content-muted dark:text-content-muted-dark whitespace-nowrap ms-2">
                    {r.count} · {r.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-edge/40 dark:bg-edge-dark/40 overflow-hidden">
                  <div
                    className="h-full bg-red-500/70 rounded-full transition-all"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Mobile FAB action bar — fixed at the bottom on phones, hidden
          on sm+. Mirrors the desktop header's primary actions so the
          thumb-reach zone always has Add Lead / Add Task / Refresh.
          The pb-24 on the page wrapper above reserves space so the
          bar never overlaps the last section. */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur border-t border-edge dark:border-edge-dark px-3 py-2 flex items-center gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <Link to="/contacts" className="no-underline flex-1">
          <Button variant="primary" size="sm" className="w-full justify-center">
            <Plus size={14} /> {isRTL ? 'عميل' : 'Lead'}
          </Button>
        </Link>
        <Link to="/tasks" className="no-underline flex-1">
          <Button variant="secondary" size="sm" className="w-full justify-center">
            <Plus size={14} /> {isRTL ? 'مهمة' : 'Task'}
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="shrink-0"
          title={isRTL ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Source breakdown — managers+ only */}
      {sourceBreakdown.length > 0 && (
        <Section title={isRTL ? 'أداء المصادر' : 'Source Performance'} icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark">
                  <th className="text-start py-2 px-3">{isRTL ? 'المصدر' : 'Source'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'عدد العملاء' : 'Leads'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'فرص' : 'Opps'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'تحويل' : 'Conv %'}</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.map(s => (
                  <tr
                    key={s.source}
                    className="border-b border-edge/30 dark:border-edge-dark/30 cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark"
                    onClick={() => navigate('/contacts', { state: { drillDown: { field: 'source', value: s.source } } })}
                    title={isRTL ? `عرض عملاء من مصدر ${s.source}` : `View leads from ${s.source}`}
                  >
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

// SLA constant — leads created more than SLA_HOURS ago with no first
// activity are considered "breached" and need urgent follow-up. The
// 4-hour figure matches industry SaaS norms; could move to system config
// later when there's a per-org override use case.
const SLA_HOURS = 4;

// Count of active leads where:
//   - last_activity_at IS NULL (no touch ever — proxy for first-contact SLA)
//   - created_at older than now - SLA_HOURS
//   - not disqualified, not deleted
async function loadSlaBreaches(ctx) {
  const cutoff = new Date(Date.now() - SLA_HOURS * 3600000).toISOString();
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .neq('contact_status', 'disqualified')
    .is('last_activity_at', null)
    .lt('created_at', cutoff);
  if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
  const { count, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadSlaBreaches', error); return 0; }
  return count || 0;
}

// Three count-only queries bucketing non-disqualified leads by age:
// 0-7 days (fresh), 7-30 days (aging), 30+ days (old). Helps managers
// see how much of the pipeline is going stale.
async function loadAgingBuckets(ctx) {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000).toISOString();
  const d30 = new Date(now - 30 * 86400000).toISOString();

  const base = () => {
    let q = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .neq('contact_status', 'disqualified');
    if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
    return q;
  };
  const [fresh, aging, old] = await Promise.all([
    base().gte('created_at', d7),
    base().lt('created_at', d7).gte('created_at', d30),
    base().lt('created_at', d30),
  ]);
  if (fresh.error) reportError('CrmDashboardPage', 'loadAgingBuckets:fresh', fresh.error);
  if (aging.error) reportError('CrmDashboardPage', 'loadAgingBuckets:aging', aging.error);
  if (old.error)   reportError('CrmDashboardPage', 'loadAgingBuckets:old',   old.error);
  return {
    fresh: fresh.count || 0,
    aging: aging.count || 0,
    old: old.count || 0,
  };
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

// Closed-lost opportunities in the current month, with the reason field
// so the dashboard can group them. Uses stage_changed_at when present,
// else falls back to created_at — matches the existing computeOppStats
// convention in dashboardService.
async function loadLostThisMonth() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, lost_reason, stage_changed_at, created_at')
    .eq('stage', 'closed_lost')
    .or(`stage_changed_at.gte.${monthStart},and(stage_changed_at.is.null,created_at.gte.${monthStart})`);
  if (error) { reportError('CrmDashboardPage', 'loadLostThisMonth', error); return []; }
  return data || [];
}

// Group contacts created in the current calendar month by assigned_to.
// Uses the denormalized assigned_to_name to avoid a users join. RLS
// scopes which contacts come back (admin/ops see all; team-leaders +
// managers see their team), so the totals naturally reflect the
// viewer's permitted slice.
async function loadLeadsThisMonthByUser() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from('contacts')
    .select('assigned_to, assigned_to_name')
    .eq('is_deleted', false)
    .gte('created_at', monthStart)
    .not('assigned_to', 'is', null);
  if (error) { reportError('CrmDashboardPage', 'loadLeadsThisMonthByUser', error); return {}; }
  const byUser = {};
  (data || []).forEach(c => {
    if (!byUser[c.assigned_to]) {
      byUser[c.assigned_to] = { id: c.assigned_to, name: c.assigned_to_name || '—', leads: 0 };
    }
    byUser[c.assigned_to].leads += 1;
    // Fallback rescue if the first row had a null name but a later one
    // for the same user has it filled in (drift recovery).
    if (!byUser[c.assigned_to].name || byUser[c.assigned_to].name === '—') {
      if (c.assigned_to_name) byUser[c.assigned_to].name = c.assigned_to_name;
    }
  });
  return byUser;
}

// Last 15 activities ordered newest-first, with a batch contact-name
// lookup so we can show "did X to Lead Y" without a per-row roundtrip.
// RLS on the activities table already constrains visibility per role —
// the sales_agent guard below is belt-and-suspenders for cases where
// RLS lets through joined rows we don't want to surface in the feed.
async function loadRecentActivityFeed(ctx) {
  let q = supabase
    .from('activities')
    .select('id, type, notes, created_at, user_name_en, user_name_ar, contact_id')
    .order('created_at', { ascending: false })
    .limit(15);
  if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('user_id', ctx.userId);
  const { data, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadRecentActivityFeed', error); return []; }
  const rows = data || [];
  const contactIds = [...new Set(rows.map(a => a.contact_id).filter(Boolean))];
  let nameById = {};
  if (contactIds.length) {
    const { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .select('id, full_name, phone')
      .in('id', contactIds);
    if (contactsErr) reportError('CrmDashboardPage', 'loadRecentActivityFeed:contacts', contactsErr);
    nameById = Object.fromEntries((contacts || []).map(c => [c.id, c.full_name || c.phone]));
  }
  return rows.map(a => ({ ...a, contact_name: a.contact_id ? nameById[a.contact_id] : null }));
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

function formatRelativeTime(iso, isRTL) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return isRTL ? 'الآن' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return isRTL ? `منذ ${min} د` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isRTL ? `منذ ${hr} س` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return isRTL ? `منذ ${day} يوم` : `${day}d ago`;
  return formatDate(iso);
}

// Map an activity row's `type` value to a presentation icon + label.
// Unknown types fall back to the generic Activity icon — better than
// throwing on schema drift.
const ACTIVITY_TYPE_META = {
  call:           { icon: Phone,          ar: 'اتصال',         en: 'Call' },
  note:           { icon: FileText,       ar: 'ملاحظة',         en: 'Note' },
  whatsapp:       { icon: MessageCircle,  ar: 'واتساب',         en: 'WhatsApp' },
  status_change:  { icon: ArrowRight,     ar: 'تغيير حالة',     en: 'Status change' },
  reassignment:   { icon: Users,          ar: 'إعادة تعيين',    en: 'Reassignment' },
};
function getActivityMeta(type, isRTL) {
  const m = ACTIVITY_TYPE_META[type] || { icon: Activity, ar: type || 'نشاط', en: type || 'Activity' };
  return { icon: m.icon, label: isRTL ? m.ar : m.en };
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

function KpiCard({ label, value, sublabel, icon: Icon, color = 'brand', to, delta, description }) {
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
    <div title={description} className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-3 sm:p-4 hover:border-brand-500/30 transition-colors">
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

function FunnelStep({ label, value, tone = 'brand', conversion, isRTL }) {
  const toneMap = {
    brand:   'bg-brand-500/10   border-brand-500/30   text-brand-500',
    amber:   'bg-amber-500/10   border-amber-500/30   text-amber-500',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  };
  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${toneMap[tone] || toneMap.brand}`}>
      <div className="text-[11px] font-semibold mb-1">{label}</div>
      <div className="text-2xl font-bold text-content dark:text-content-dark leading-none">{value.toLocaleString()}</div>
      {conversion != null && (
        <div className="text-[10px] mt-2 text-content-muted dark:text-content-muted-dark">
          {conversion}% {isRTL ? 'تحويل' : 'conversion'}
        </div>
      )}
    </div>
  );
}

function AgingBucket({ label, sub, count, tone = 'brand' }) {
  const toneMap = {
    emerald: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
    amber:   'text-amber-500   border-amber-500/20   bg-amber-500/5',
    red:     'text-red-500     border-red-500/20     bg-red-500/5',
    brand:   'text-brand-500   border-brand-500/20   bg-brand-500/5',
  };
  return (
    <div className={`rounded-lg border p-3 ${toneMap[tone] || toneMap.brand}`}>
      <div className="text-[11px] font-semibold mb-0.5">{label}</div>
      <div className="text-xl font-bold text-content dark:text-content-dark leading-none">{count.toLocaleString()}</div>
      <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-1">{sub}</div>
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
