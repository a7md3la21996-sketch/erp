import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePageActions } from '../../contexts/PageActionsContext';
import { useGlobalFilter } from '../../contexts/GlobalFilterContext';
import { P, roleHasPermission } from '../../config/roles';
import { getTeamMemberIds } from '../../utils/teamHelper';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { useToast } from '../../contexts/ToastContext';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import supabase from '../../lib/supabase';
import { localDateStr, localMonthStartStr, localDayBounds } from '../../utils/dateTime';
import {
  Users, Target, CheckSquare, Flame, AlertCircle, TrendingUp,
  Calendar, ChevronRight, RefreshCw, Activity,
  Plus, Bell, ArrowUp, ArrowDown, Minus,
  Phone, FileText, MessageCircle, ArrowRight,
  Tag, Sparkles, Upload, Download, Zap,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PageSkeleton, Button } from '../../components/ui';
import { fetchContactStats, fetchDealStats } from '../../services/dashboardService';
import { fetchTasks } from '../../services/tasksService';
import { getEmployeeTargets, computeActuals, getDefaultTargets, METRIC_CONFIG } from '../../services/kpiTargetsService';
import { createContact, checkDuplicate } from '../../services/contactsService';
import AddContactModal from './contacts/AddContactModal';
import { reportError } from '../../utils/errorReporter';


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
    // Return {ts, data} so the hydration path can also restore the
    // lastUpdatedAt indicator — otherwise it would show "just now"
    // even for a 50s-old cache.
    return { ts: parsed.ts, ...parsed.data };
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
  const { profile, hasPermission } = useAuth();
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
  const [stats, setStats] = useState({ contact: null, deal: null, hotCount: 0, lastMonthCount: 0 });
  // "Leads lenses" — quick-jump counts (follow-up buckets + lead origins) that
  // deep-link into the pre-filtered Leads page. RLS-scoped via the RPCs, so a
  // sales_agent sees their own numbers, managers their team's.
  const [leadLens, setLeadLens] = useState({ overdue: 0, today: 0, upcoming: 0, fresh: 0, rotation: 0, distributed: 0, freshNew: 0, sNew: 0, sContacted: 0, sFollowing: 0, sHasOpp: 0, mAny: 0, mUpcoming: 0, mHappened: 0 });
  const [todayTasks, setTodayTasks] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [staleLeads, setStaleLeads] = useState([]);
  const [activityByDay, setActivityByDay] = useState([]);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [recentFeed, setRecentFeed] = useState([]);
  // Map of {userId: {id, name, leads}} for contacts assigned + created
  // this month. Combined with deal wins (matched by agent name) to rank top
  // performers. Empty for sales_agent (they shouldn't see this section).
  const [leadsByUser, setLeadsByUser] = useState({});
  // Leads disqualified this month, mapped to { lost_reason } from
  // contacts.disqualify_reason — dedicated narrow fetch, cheap query.
  const [lostThisMonth, setLostThisMonth] = useState([]);
  // {fresh, aging, old} — counts of non-disqualified leads by age bucket.
  // Powers the Lead Aging section. RLS handles scoping; sales_agent
  // additionally gets an assigned_to filter inside the loader.
  const [agingBuckets, setAgingBuckets] = useState({ fresh: 0, aging: 0, old: 0 });
  // Count of active leads older than the SLA window that still have
  // no first-touch activity. Powers the SLA Breaches alert section.
  const [slaBreachCount, setSlaBreachCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  // Section tab (all screen sizes) that keeps the page from becoming an
  // endless scroll of ~15 sections. Each tab groups related sections
  // (Today / Insights / Team). 'today' is the default because the most
  // common reason to open the page is to triage today's work.
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'today';
    try { return sessionStorage.getItem('crm-dashboard-tab') || 'today'; } catch { return 'today'; }
  });
  // Live counter of activities streamed in since the last loadAll
  // completed. Drives the "X جديد" badge on the Recent Activity feed.
  // Resets to 0 whenever recentFeed gets a fresh batch (loadAll finish).
  const [newActivityCount, setNewActivityCount] = useState(0);
  // Wall-time of the last successful load (or cache hydration). Drives
  // the "محدّث منذ Xم" indicator so users always see how fresh the
  // dashboard is. Ticked every 60s via the `now` state below so the
  // relative label stays accurate without a full re-render of children.
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  // True once we've successfully rendered real (non-skeleton) data from
  // either the sessionStorage cache or a completed loadAll. Drives the
  // page-skeleton suppression so subsequent refreshes don't blank the
  // page out — stale data stays visible during background refetch.
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  const hydratedRef = useRef(false);

  // Scope selector (managers+ only) — "view the dashboard as" a specific agent /
  // team / everyone. Drives ctx below, so the WHOLE page re-scopes. RLS still
  // limits what each viewer can actually see, so this can only narrow within a
  // manager's own visible set (admin/ops see all).
  //   { type:'all' }                         → my own role scope
  //   { type:'agent', id, name }             → that one person
  //   { type:'team',  teamId, role, name }   → that team (manager/leader scope)
  const [scopePeople, setScopePeople] = useState([]);
  const [scopeTeams, setScopeTeams] = useState([]);
  // The CRM dashboard's scope now follows the global header filter (the funnel):
  // pick an agent or a team there and the whole dashboard re-scopes. Derived from
  // GlobalFilterContext + the resolvable people/teams this user may scope to.
  const gf = useGlobalFilter();
  const viewScope = useMemo(() => {
    if (gf.agentName && gf.agentName !== 'all') {
      const p = scopePeople.find(u =>
        gf.agentName === (isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar))
        || gf.agentName === u.full_name_en || gf.agentName === u.full_name_ar);
      if (p) return { type: 'agent', id: p.id, role: p.role, name: gf.agentName };
      // Filter is active but the person hasn't resolved yet (async load race) —
      // show nothing, don't fall open to everyone.
      return { type: 'agent', id: null, name: gf.agentName, unresolved: true };
    }
    if (gf.teamId && gf.teamId !== 'all') {
      const t = scopeTeams.find(x => x.teamId === gf.teamId);
      if (t) return { type: 'team', teamId: t.teamId, role: 'team_leader', name: t.name, memberIds: t.memberIds, memberNames: t.memberNames };
      return { type: 'team', teamId: gf.teamId, memberIds: [], unresolved: true };
    }
    return { type: 'all' };
  }, [gf.agentName, gf.teamId, scopePeople, scopeTeams, isRTL]);

  const canScope = hasPermission(P.CRM_VIEW_TEAM);

  // Build a Leads-page URL that carries the current scope (a selected agent) so
  // clicking a lens card lands on the list already filtered to that agent.
  // (Team scope can't be expressed as one agent name, so it falls back to the
  // unfiltered list — the dashboard cards still showed the team's numbers.)
  const leadsUrl = (qs) => {
    let scopeParam = '';
    if (viewScope.type === 'agent' && viewScope.name) {
      scopeParam = `agent=${encodeURIComponent(viewScope.name)}`;
    } else if (viewScope.type === 'team' && viewScope.memberNames?.length) {
      // Carry the team's members so the Leads page filters to that team only.
      scopeParam = `agents=${encodeURIComponent(viewScope.memberNames.join('|'))}`;
    }
    const parts = [qs, scopeParam].filter(Boolean);
    return parts.length ? `/leads?${parts.join('&')}` : '/leads';
  };

  // Add Lead straight from the dashboard (the same modal the Leads page uses).
  const [showAddLead, setShowAddLead] = useState(false);
  const handleSaveLead = async (saveData) => {
    await createContact(saveData);            // throws on error → modal shows it
    setRefreshKey(k => k + 1);                // refresh the dashboard counts
  };

  // Surface the CRM actions in the top Header (replaces the old global filter).
  // The scope "view as" selector stays in-page (it's a dropdown, not a button).
  usePageActions([
    { id: 'add-lead', icon: Plus, labelAr: 'عميل جديد', labelEn: 'Add Lead', primary: true, hidden: !(hasPermission(P.CONTACTS_EDIT) || hasPermission(P.CONTACTS_EDIT_OWN)), onClick: () => setShowAddLead(true) },
    { id: 'import', icon: Upload, labelAr: 'استيراد', labelEn: 'Import', hidden: !hasPermission(P.CONTACTS_IMPORT), onClick: () => navigate('/leads?action=import') },
    { id: 'export', icon: Download, labelAr: 'تصدير', labelEn: 'Export', hidden: !hasPermission(P.CONTACTS_EXPORT), onClick: () => navigate('/leads?action=export') },
    { id: 'master-leads', icon: Users, labelAr: 'العملاء الموحّدين', labelEn: 'Master Leads', hidden: !hasPermission(P.POOL_SETTINGS), onClick: () => navigate('/crm/master-leads') },
    { id: 'refresh', icon: RefreshCw, labelAr: 'تحديث', labelEn: 'Refresh', onClick: () => setRefreshKey(k => k + 1) },
  ], [isRTL, profile?.role]);

  const ctx = useMemo(() => {
    if (viewScope.type === 'agent') return { role: 'sales_agent', userId: viewScope.id, teamId: null };
    if (viewScope.type === 'team') return { role: viewScope.role || 'sales_manager', userId: null, teamId: viewScope.teamId };
    return { role: profile?.role, userId: profile?.id, teamId: profile?.team_id };
    // Depend on viewScope's PRIMITIVE fields, not the object identity — the memo
    // returns a fresh {type:'all'} object on every scopePeople/scopeTeams setState
    // even when nothing changed, and depending on the object would rebuild ctx →
    // loadAll → re-run the whole ~17-request orchestration 2–3× per mount.
  }, [profile?.role, profile?.id, profile?.team_id, viewScope.type, viewScope.id, viewScope.role, viewScope.teamId]);

  // Fetch the people this user may scope to (their reports). RLS on contacts
  // still gates the actual data; this only populates the dropdown.
  useEffect(() => {
    if (!canScope) return;
    let cancelled = false;
    (async () => {
      try {
        // Include inactive accounts too — a manager often needs to pull a
        // deactivated agent's leads. They're marked "(inactive)" and sorted last.
        let q = supabase.from('users').select('id, full_name_en, full_name_ar, role, team_id, status')
          .in('role', ['sales_agent', 'team_leader', 'sales_manager', 'sales_director', 'operations']);
        // Scope to the user's full team hierarchy. getTeamMemberIds expands the
        // SAME way the rest of the dashboard does (sales_manager = 2 levels:
        // child teams + grandchild TL teams; team_leader = its child teams) so
        // agents in deeper teams don't go missing from this dropdown.
        if ((profile?.role === 'team_leader' || profile?.role === 'sales_manager') && profile?.team_id) {
          const memberIds = await getTeamMemberIds(profile.role, profile.team_id);
          q = q.in('id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);
        }
        const { data } = await q.order('full_name_en');
        if (cancelled || !data) return;
        const sorted = data
          .filter(u => u.id !== profile?.id)
          .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
        setScopePeople(sorted);
        // Build team options: group people by their team_id, name from departments.
        const { data: depts } = await supabase.from('departments').select('id, name_ar, name_en');
        if (cancelled) return;
        const deptName = {};
        (depts || []).forEach(d => { deptName[d.id] = isRTL ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar); });
        const byTeam = {};
        sorted.forEach(u => { if (u.team_id) (byTeam[u.team_id] = byTeam[u.team_id] || []).push(u.id); });
        setScopeTeams(
          Object.entries(byTeam)
            .filter(([tid, ids]) => ids.length > 0 && deptName[tid])
            .map(([tid, ids]) => ({
              teamId: tid, name: deptName[tid], memberIds: ids,
              memberNames: sorted.filter(u => ids.includes(u.id)).map(u => u.full_name_en).filter(Boolean),
            }))
        );
      } catch (e) { if (!isMissingRpc(e)) reportError('CrmDashboardPage', 'scopePeople', e); }
    })();
    return () => { cancelled = true; };
  }, [canScope, profile?.role, profile?.id, profile?.team_id]);

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
    if (typeof cached.ts === 'number') setLastUpdatedAt(cached.ts);
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
    // Bail only until we have SOME scope to load. Team scope legitimately has
    // userId === null (a team isn't one user) — the old `!ctx.userId` guard
    // made loadAll return immediately for every team, so Total Leads (and the
    // other loadAll stats) stayed frozen on the previous 'all' company total
    // while the lens numbers (a separate effect) still re-scoped. Allow the run
    // when a team is selected; still wait for profile on first mount ('all').
    if (!ctx.userId && !ctx.teamId) return;
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
      // Bounds for the one-shot counts RPC (local-day accurate, like the old
      // per-loader Date math they replace).
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
      const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

      const isManagerPlus = roleHasPermission(ctx.role, P.CRM_VIEW_TEAM);
      // Scope selector → the agent-id set every scoped loader uses to narrow to
      // the selected agent/team (so the WHOLE page follows the scope, not just
      // some cards). null = no narrowing (rely on RLS — the viewer's own slice).
      // null = no narrowing (type 'all'). A filter that's active but unresolved,
      // or a team that resolves to zero members, must show NOTHING — never fall
      // open to the whole company. Use an impossible uuid so `.in()` returns [].
      const NO_MATCH = ['00000000-0000-0000-0000-000000000000'];
      const scopeAgentIds = viewScope.type === 'all' ? null
        : viewScope.unresolved ? NO_MATCH
        : viewScope.type === 'agent' ? [viewScope.id]
        : (viewScope.memberIds?.length ? viewScope.memberIds : NO_MATCH);

      // Parallel-fetch every panel. Each one's failure is reported but
      // doesn't block the others — partial data is better than a blank page.
      const [
        countsRes, dealStatsRes,
        todayTasksRes, overdueTasksRes, staleLeadsRes,
        activityRes, sourceRes, upcomingRes, recentFeedRes, leadsByUserRes, lostRes,
      ] = await Promise.allSettled([
        // ONE RPC for all 8 contact counts (was 8 separate requests) — the
        // biggest single cut in the dashboard's request fan-out.
        loadDashboardCounts(ctx, scopeAgentIds, { monthStart, lastMonthStart, d7, d30 }),
        fetchDealStats(ctx, scopeAgentIds),
        fetchTasks({ ...ctx, dueDateFrom: todayStart, dueDateTo: todayEnd, status: 'pending', pageSize: 5, page: 1 }),
        fetchTasks({ ...ctx, overdueOnly: true, status: 'pending', pageSize: 5, page: 1 }),
        loadStaleLeads(ctx, sevenDaysAgo, scopeAgentIds),
        loadActivityByDay(ctx, fourteenDaysAgo, scopeAgentIds),
        isManagerPlus ? loadSourceBreakdown(ctx, scopeAgentIds) : Promise.resolve([]),
        fetchTasks({ ...ctx, dueDateFrom: todayEnd, dueDateTo: upcomingEnd, status: 'pending', pageSize: 5, page: 1 }),
        loadRecentActivityFeed(ctx, scopeAgentIds),
        isManagerPlus ? loadLeadsThisMonthByUser(scopeAgentIds) : Promise.resolve({}),
        isManagerPlus ? loadLostThisMonth(scopeAgentIds) : Promise.resolve([]),
      ]);
      const counts = countsRes.status === 'fulfilled' ? countsRes.value : null;

      // Drop writes if a newer load has started — protects against the
      // refresh-twice-fast race that would otherwise let stale data
      // overwrite the freshest result.
      if (myLoadId !== loadIdRef.current) return;

      // Compute every next-state value once so we can both setState
      // and write the same snapshot to cache without re-deriving.
      const nextStats = {
        contact: counts ? { totalLeads: counts.totalLeads, newLeadsThisMonth: counts.newThisMonth } : null,
        deal: dealStatsRes.status === 'fulfilled' ? dealStatsRes.value : null,
        hotCount: counts?.hotCount ?? 0,
        lastMonthCount: counts?.lastMonth ?? 0,
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
      const nextAgingBuckets = counts?.aging || { fresh: 0, aging: 0, old: 0 };
      const nextSlaBreachCount = counts?.slaBreach ?? 0;

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
      setLastUpdatedAt(Date.now());

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
  }, [ctx, toast, viewScope.type, viewScope.id, viewScope.teamId, viewScope.memberIds?.length]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  // Load the "Leads lenses" counts (follow-up + origin) independently of the
  // heavy loadAll orchestration. Three small RPCs; failures degrade to zeros.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { todayStart, tomorrowStart } = localDayBounds();
        // One scope → one agent-id array (person = [id], team = member ids,
        // everyone = null). Active-but-unresolved / empty team → never-match, so
        // the lenses show nothing instead of falling open to everyone.
        const NO_MATCH = ['00000000-0000-0000-0000-000000000000'];
        const agentIds = viewScope.type === 'all' ? null
          : viewScope.unresolved ? NO_MATCH
          : viewScope.type === 'agent' ? [viewScope.id]
          : (viewScope.memberIds?.length ? viewScope.memberIds : NO_MATCH);
        const [fu, cat, catNew, st, mt] = await Promise.all([
          supabase.rpc('get_followup_counts', { p_today_start: todayStart, p_tomorrow_start: tomorrowStart, p_agent_ids: agentIds }),
          supabase.rpc('get_lead_category_counts', { p_agent_ids: agentIds }),
          supabase.rpc('get_lead_category_counts', { p_agent_ids: agentIds, p_status: 'new' }),
          supabase.rpc('get_contact_stats', { p_agent_ids: agentIds }),
          supabase.rpc('get_meeting_lens_counts', { p_agent_ids: agentIds }).then(r => r, () => ({ data: null })),
        ]);
        if (cancelled) return;
        const f = fu.data || {}, c = cat.data || {}, cn = catNew.data || {};
        const s = (st.data && st.data.status) || {};
        const mm = (mt && mt.data) || {};
        setLeadLens({
          overdue: Number(f.overdue) || 0,
          today: Number(f.today) || 0,
          upcoming: Number(f.upcoming) || 0,
          fresh: Number(c.fresh) || 0,
          rotation: Number(c.rotation) || 0,
          distributed: Number(c.distributed) || 0,
          freshNew: Number(cn.fresh) || 0,
          sNew: Number(s.new) || 0,
          sContacted: Number(s.contacted) || 0,
          sFollowing: Number(s.following) || 0,
          sHasOpp: Number(s.has_opportunity) || 0,
          mAny: Number(mm.any) || 0,
          mUpcoming: Number(mm.upcoming) || 0,
          mHappened: Number(mm.happened) || 0,
        });
      } catch (e) { if (!isMissingRpc(e)) reportError('CrmDashboardPage', 'leadLens', e); }
    })();
    return () => { cancelled = true; };
    // memberIds?.length is in the deps so that a team whose member list
    // resolves a tick AFTER type/teamId (async scope load) re-runs the lens
    // fetch with the real members instead of staying on the empty/NO_MATCH
    // first pass — otherwise team follow-up/status counts render as zero.
  }, [refreshKey, viewScope.type, viewScope.id, viewScope.teamId, viewScope.memberIds?.length]);

  // Realtime: every INSERT on the activities table bumps the unread
  // counter, which the Recent Activity feed surfaces as a badge. The
  // counter resets when the feed itself is replaced by a fresh fetch
  // (see the recentFeed-dep effect just below). For sales_agent we
  // filter to events authored by them so the count matches what their
  // feed would actually show.
  useRealtimeSubscription('activities', useCallback((payload) => {
    if (payload.eventType !== 'INSERT') return;
    if (ctx.role === 'sales_agent' && ctx.userId && payload.new?.user_id !== ctx.userId) return;
    setNewActivityCount(c => c + 1);
  }, [ctx.role, ctx.userId]));

  // Whenever the feed is replaced (loadAll completed), clear the "new"
  // badge — those events are now part of the visible feed.
  useEffect(() => { setNewActivityCount(0); }, [recentFeed]);

  // Tick `now` once a minute so the "محدّث منذ Xم" indicator stays
  // fresh without re-fetching anything.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  // Persist the active section tab so switching to /contacts and back (or any
  // in-session navigation) returns the user to the same view instead of
  // resetting to Today.
  useEffect(() => {
    try { sessionStorage.setItem('crm-dashboard-tab', activeTab); } catch { /* quota — ignore */ }
  }, [activeTab]);

  // Guard: a stale persisted 'team' selection must not strand a non-manager on
  // an empty view (the Team tab is hidden for them). Fall back to Today.
  useEffect(() => {
    const isManagerView = hasPermission(P.CRM_VIEW_TEAM);
    if (activeTab === 'team' && !isManagerView) setActiveTab('today');
  }, [activeTab, profile?.role]);

  // ── derived values via hooks. All hooks must run on every render —
  // keep them above the loading early-return below or React throws #310
  // ("rendered more hooks than during the previous render").

  // Top Performers — only computed for manager+/admin/ops, otherwise the
  // section never renders and the work is skipped. Combines leadsByUser
  // (this month, from a dedicated query) with rawOpps (already fetched)
  // to count open opportunities + wins per user. Ranking favours wins
  // because closed deals matter most; leads tie-break.
  const topPerformers = useMemo(() => {
    const isManagerPlus = hasPermission(P.CRM_VIEW_TEAM);
    if (!isManagerPlus) return [];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    // Phase B: wins come from DEALS (this month). Deals carry agent NAMES, so we
    // match each member's name against the deal's agent_en/agent_ar.
    const rawDeals = stats.deal?.rawDeals || [];
    const monthDeals = rawDeals.filter(d => new Date(d.created_at).getTime() >= monthStart);
    return Object.keys(leadsByUser)
      .map(id => {
        const name = leadsByUser[id]?.name || '—';
        const wins = name === '—' ? 0 : monthDeals.filter(d => d.agent_en === name || d.agent_ar === name).length;
        return { id, name, leads: leadsByUser[id]?.leads || 0, wins };
      })
      .filter(r => r.leads + r.wins > 0)
      .sort((a, b) => (b.wins * 3 + b.leads * 0.5) - (a.wins * 3 + a.leads * 0.5))
      .slice(0, 5);
  }, [profile?.role, leadsByUser, stats.deal?.rawDeals]);

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
            : LOST_REASON_FALLBACK[key]
              ? (isRTL ? LOST_REASON_FALLBACK[key].ar : LOST_REASON_FALLBACK[key].en)
              : humanizeKey(key);
        return { key, label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
      })
      .sort((a, b) => b.count - a.count);
  }, [lostThisMonth, lostReasonsMap, isRTL]);

  // Conversion funnel (Phase B) — a consistent THIS-MONTH cohort: new leads →
  // deals opened this month → deals won this month. Previously the middle step
  // used the has_opportunity status *snapshot* (a current count, not this
  // month), which mixed timeframes and made the ratios drift. Deriving "opps"
  // from deals created this month (rawDeals) keeps all three steps on the same
  // clock. Conversion rates are cumulative (lead→opp, opp→win), clamped to 100%
  // since a deal can sit on a lead created in an earlier month.
  const funnelData = useMemo(() => {
    const leads = stats.contact?.newLeadsThisMonth ?? 0;
    // "opened" = ALL deals opened this month (any status), from fetchDealStats.
    // Must NOT be derived from rawDeals — that's won-only, which would make
    // opened == wins and a nonsensical ~100% opp→win rate.
    const oppsThisMonth = stats.deal?.openedThisMonth ?? 0;
    const winsThisMonth = stats.deal?.wonThisMonth ?? 0;
    const leadToOpp = leads > 0 ? Math.min(100, Math.round((oppsThisMonth / leads) * 100)) : 0;
    const oppToWin = oppsThisMonth > 0 ? Math.min(100, Math.round((winsThisMonth / oppsThisMonth) * 100)) : 0;
    return { leads, opps: oppsThisMonth, wins: winsThisMonth, leadToOpp, oppToWin };
  }, [stats.contact?.newLeadsThisMonth, stats.deal?.openedThisMonth, stats.deal?.wonThisMonth]);

  // Revenue per month for the last 6 calendar months (Phase B: from DEALS,
  // by deal_value within the month the deal CLOSED — rawDeals is won-only, so
  // bucket by the close timestamp updated_at, not when it opened). Oldest-first.
  const revenueTrend = useMemo(() => {
    const rawDeals = stats.deal?.rawDeals || [];
    const now = new Date();
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      const monthRevenue = rawDeals
        .filter(d => {
          const t = new Date(d.updated_at || d.created_at).getTime();
          return t >= start && t < end;
        })
        .reduce((sum, d) => sum + (parseFloat(d.deal_value) || 0), 0);
      const label = new Date(start).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });
      out.push({ month: label, revenue: monthRevenue });
    }
    return out;
  }, [stats.deal?.rawDeals, isRTL]);

  // Month-over-month delta for the Deals KPI card — derived from the already
  // loaded rawDeals (no extra query). Compares deals won this calendar month
  // vs last so the card shows momentum, like the Total Leads card does.
  const dealsDelta = useMemo(() => {
    const raw = stats.deal?.rawDeals || [];
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const wonThis = raw.filter(d => d.status === 'won' && new Date(d.updated_at || d.created_at).getTime() >= thisStart).length;
    const wonLast = raw.filter(d => { const t = new Date(d.updated_at || d.created_at).getTime(); return d.status === 'won' && t >= lastStart && t < thisStart; }).length;
    return buildDelta(wonThis, wonLast, isRTL);
  }, [stats.deal?.rawDeals, isRTL]);

  // Show page skeleton only on the very first load with no cache. Once
  // we've ever rendered real data (from cache hydration or a completed
  // fetch), subsequent background refreshes update the page in place —
  // the user keeps seeing stale data rather than a wiped layout.
  if (loading && !hasEverLoaded) return <PageSkeleton />;


  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'مساء النور' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();
  const displayName = (isRTL ? (profile?.full_name_ar || profile?.full_name_en) : (profile?.full_name_en || profile?.full_name_ar)) || profile?.email || '';

  // Section-tab visibility helper — applies on every screen size now.
  // Only the active tab's sections render; the rest are hidden. Returning
  // '' lets the wrapper fall back to its natural block display when active.
  const tabVisible = (tab) => activeTab === tab ? '' : 'hidden';

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
            {lastUpdatedAt && (
              <span className="ms-2 text-[11px] opacity-70" title={new Date(lastUpdatedAt).toLocaleString()}>
                · {isRTL ? `محدّث ${formatRelativeTime(new Date(lastUpdatedAt).toISOString(), isRTL, now)}` : `updated ${formatRelativeTime(new Date(lastUpdatedAt).toISOString(), isRTL, now)}`}
              </span>
            )}
          </p>
        </div>

        {/* Scope indicator — when a manager narrows the global filter to one
            agent or team, every number on the page is scoped to them. Surface
            that here so the figures are never silently misread as company-wide. */}
        {viewScope.type !== 'all' && viewScope.name && (
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20 px-3 py-1 text-xs font-semibold">
            <Users size={13} />
            <span>{isRTL ? 'بتشوف بيانات:' : 'Viewing:'} {viewScope.name}</span>
          </div>
        )}
      </div>

      {/* Attention strip — one-glance summary of what needs you today, as a
          segmented row of semantic-coloured stats (no emoji). Each cell deep-
          links (scope-aware). Replaces the old emoji "daily brief" banner. */}
      {(() => {
        const items = [
          { n: leadLens.overdue,  to: leadsUrl('followup=overdue'),          color: '#D6403B', label: isRTL ? 'متابعة متأخرة' : 'Overdue' },
          { n: leadLens.today,    to: leadsUrl('followup=today'),            color: '#C9860A', label: isRTL ? 'متابعة اليوم' : 'Due today' },
          { n: leadLens.upcoming, to: leadsUrl('followup=upcoming'),         color: '#5A63C4', label: isRTL ? 'متابعة قادمة' : 'Upcoming' },
          { n: leadLens.freshNew, to: leadsUrl('category=fresh&status=new'), color: '#158A57', label: isRTL ? 'فريش · جديد' : 'Fresh · new' },
          { n: stats.hotCount,    to: leadsUrl('temp=hot'),                  color: '#DD6327', label: isRTL ? 'عميل ساخن' : 'Hot' },
        ].filter(i => i.n > 0);
        if (items.length === 0) return (
          <div className="mb-4 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark px-4 py-3.5 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'كله تمام — لا يوجد شيء عاجل الآن' : 'All clear — nothing urgent right now'}
          </div>
        );
        return (
          <div className="mb-4 grid grid-cols-2 md:flex rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden divide-x divide-y md:divide-y-0 divide-edge dark:divide-edge-dark">
            {items.map((i, idx) => (
              <Link key={idx} to={i.to} className="no-underline flex-1 min-w-0 flex items-center gap-2.5 px-3.5 py-3.5 hover:bg-surface-bg/60 dark:hover:bg-white/[0.03] transition-colors">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: i.color, boxShadow: `0 0 0 3px ${i.color}22` }} />
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-none tabular-nums" style={{ color: i.color }}>{i.n.toLocaleString()}</span>
                  <span className="block text-[11px] text-content-muted dark:text-content-muted-dark mt-1 truncate">{i.label}</span>
                </span>
              </Link>
            ))}
          </div>
        );
      })()}

      {/* KPI cards row — horizontal scroll on mobile (snap per card),
          flips to grid at sm and above. The negative margin + padding
          on the mobile flex makes the scroll track bleed to the edges
          of the screen so cards aren't visually cramped in the page
          container's padding. */}
      <div className="flex sm:grid gap-3 mb-6 overflow-x-auto sm:overflow-visible sm:grid-cols-4 -mx-4 sm:mx-0 px-4 sm:px-0 snap-x snap-mandatory sm:snap-none">
        <div className="shrink-0 w-[200px] sm:w-auto sm:col-span-2 snap-start">
        <KpiCard hero label={isRTL ? 'إجمالي العملاء' : 'Total Leads'} value={stats.contact?.totalLeads ?? 0} icon={Users} color="brand" to={leadsUrl('')}
          delta={buildDelta(stats.contact?.newLeadsThisMonth ?? 0, stats.lastMonthCount ?? 0, isRTL)}
          description={isRTL ? 'كل العملاء في نطاقك. الشارة = جدد هذا الشهر مقابل الشهر السابق.' : 'All leads in your scope. Badge = new this month vs last.'} />
        </div>
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard label={isRTL ? 'عملاء واعدون' : 'Hot Leads'} value={stats.hotCount ?? 0} icon={Flame} color="red" to={leadsUrl('temp=hot')}
          description={isRTL ? 'عملاء "Hot" — أعلى أولوية.' : 'Hot leads — highest priority.'} />
        </div>
        <div className="shrink-0 w-[160px] sm:w-auto snap-start">
        <KpiCard label={isRTL ? 'صفقات الشهر' : 'Deals This Month'} value={stats.deal?.wonThisMonth ?? 0} icon={Target} color="emerald" to="/sales/deals"
          delta={dealsDelta}
          description={isRTL ? 'الصفقات اللي اتقفلت الشهر ده. الشارة = مقارنة بالشهر السابق.' : 'Deals closed this month. Badge = vs last month.'} />
        </div>
      </div>

      {/* Section tabs — organize the page into focused views (Today / Insights /
          Team) on EVERY screen size, not just mobile. Turns what was an endless
          desktop scroll of ~15 sections into three purposeful tabs; the KPI row
          and daily brief above stay pinned regardless of the active tab. The
          Team tab only appears for managers+ (agents have no team view). */}
      {(() => {
        const isManagerView = hasPermission(P.CRM_VIEW_TEAM);
        // Badge on "Today" = the count that genuinely needs action now
        // (overdue follow-ups + never-contacted SLA breaches) so the tab
        // nudges without the user having to open it.
        const urgentCount = (leadLens.overdue || 0) + (slaBreachCount || 0);
        const tabs = [
          { id: 'today',    label: isRTL ? 'اليوم' : 'Today',      icon: Sparkles,   badge: urgentCount },
          { id: 'insights', label: isRTL ? 'تحليلات' : 'Insights', icon: TrendingUp, badge: 0 },
          ...(isManagerView ? [{ id: 'team', label: isRTL ? 'الفريق' : 'Team', icon: Users, badge: 0 }] : []),
        ];
        return (
          <div
            role="tablist"
            aria-label={isRTL ? 'مجموعات أقسام لوحة CRM' : 'CRM dashboard section groups'}
            className="mb-5 inline-flex w-full sm:w-auto gap-1 bg-surface-bg dark:bg-surface-bg-dark rounded-xl p-1"
          >
            {tabs.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold py-2 sm:px-5 rounded-lg transition-colors ${
                    active
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-content-muted dark:text-content-muted-dark hover:bg-surface-card dark:hover:bg-surface-card-dark'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  {t.badge > 0 && (
                    <span className={`ms-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-red-500 text-white'}`}>
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ===== TODAY tab — daily lenses & actions (deep-link to Leads) ===== */}
      <div className={tabVisible('today')}>
      {/* Two-column mockup layout: action queues on the left (what to DO now),
          the lens summaries as compact stat-rows on the right (the numbers). */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        {/* LEFT — act now */}
        <div className="min-w-0">
          <Section title={isRTL ? 'أولويات اليوم' : 'Today\'s Priorities'} icon={Sparkles}>
            <p className="text-[11px] text-content-muted dark:text-content-muted-dark m-0 mb-3">{isRTL ? 'أهم العملاء للتواصل معهم الآن — الساخن أولاً، ثم الفريش الجديد.' : 'Call these first — hot leads, then untouched fresh.'}</p>
            <WorkQueueWidget profile={profile} navigate={navigate} isRTL={isRTL}
              scopeUserIds={viewScope.type === 'agent' ? [viewScope.id] : viewScope.type === 'team' ? viewScope.memberIds : null}
              scopeKey={viewScope.type === 'agent' ? `a:${viewScope.id}` : viewScope.type === 'team' ? `t:${viewScope.teamId}` : 'all'} />
          </Section>
          <Section title={isRTL ? 'عملاء بحاجة لاتصال' : 'Need a Call'} icon={Phone}>
            <p className="text-[11px] text-content-muted dark:text-content-muted-dark m-0 mb-3">{isRTL ? 'تحت المتابعة وبدون نشاط منذ ٣ أيام أو أكثر — بادر بالتواصل معهم.' : 'In follow-up with no activity for 3+ days — reach out before they go cold.'}</p>
            <NeedACallWidget profile={profile} navigate={navigate} isRTL={isRTL}
              scopeUserIds={viewScope.type === 'agent' ? [viewScope.id] : viewScope.type === 'team' ? viewScope.memberIds : null}
              scopeKey={viewScope.type === 'agent' ? `a:${viewScope.id}` : viewScope.type === 'team' ? `t:${viewScope.teamId}` : 'all'} />
          </Section>
        </div>

        {/* RIGHT — the numbers, as compact stat rows */}
        <div className="min-w-0">
          <Section title={isRTL ? 'حالة الليدز' : 'Lead Status'} icon={Activity} compact>
            <LensRow label={isRTL ? 'جديد' : 'New'} value={leadLens.sNew} color="#2F6BD3" to={leadsUrl('status=new')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'تم التواصل' : 'Contacted'} value={leadLens.sContacted} color="#C9860A" to={leadsUrl('status=contacted')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'متابعة' : 'Following'} value={leadLens.sFollowing} color="#5A63C4" to={leadsUrl('status=following')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'لديه فرصة' : 'Has opportunity'} value={leadLens.sHasOpp} color="#158A57" to={leadsUrl('status=has_opportunity')} navigate={navigate} isRTL={isRTL} />
          </Section>
          <Section title={isRTL ? 'الفريش وأنواع الليدز' : 'Fresh & Origins'} icon={Tag} compact>
            <LensRow label={isRTL ? 'فريش لم يتواصل معه أحد' : 'Untouched fresh'} value={leadLens.freshNew} color="#DD6327" to={leadsUrl('category=fresh&status=new')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'كل الفريش' : 'All fresh'} value={leadLens.fresh} color="#158A57" to={leadsUrl('category=fresh')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'روتيشن' : 'Rotation'} value={leadLens.rotation} color="#2F6BD3" to={leadsUrl('category=rotation')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'موزّع' : 'Distributed'} value={leadLens.distributed} color="#5A63C4" to={leadsUrl('category=distributed')} navigate={navigate} isRTL={isRTL} />
          </Section>
          <Section title={isRTL ? 'الاجتماعات' : 'Meetings'} icon={Calendar} compact>
            <LensRow label={isRTL ? 'اجتماع قادم' : 'Upcoming'} value={leadLens.mUpcoming} color="#2F6BD3" to={leadsUrl('meeting=upcoming')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'اجتماع حصل' : 'Happened'} value={leadLens.mHappened} color="#158A57" to={leadsUrl('meeting=happened')} navigate={navigate} isRTL={isRTL} />
            <LensRow label={isRTL ? 'أي اجتماع' : 'Any meeting'} value={leadLens.mAny} color="#9AA3AE" to={leadsUrl('meeting=any')} navigate={navigate} isRTL={isRTL} />
          </Section>
        </div>
      </div>
      </div>

      {/* ===== INSIGHTS tab — numbers (lenses-derived) ===== */}
      <div className={tabVisible('insights')}>
      {/* My Targets — this month's progress vs goal. */}
      {viewScope.type !== 'team' && (
        <Section title={viewScope.type === 'agent' && viewScope.name
          ? (isRTL ? `أهداف ${viewScope.name} (الشهر)` : `${viewScope.name}'s Targets (Month)`)
          : (isRTL ? 'أهدافي (الشهر)' : 'My Targets (Month)')} icon={Target} compact>
          <MyTargetsWidget profile={profile} isRTL={isRTL} scopeUserId={viewScope.type === 'agent' ? viewScope.id : null} scopeRole={viewScope.type === 'agent' ? viewScope.role : null} />
        </Section>
      )}

      {/* Recent Wins — last deals closed, for motivation + a quick pulse.
          Phase B: derived from the already-loaded deals (no extra fetch). */}
      {(() => {
        const won = [...(stats.deal?.rawDeals || [])]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        if (!won.length) return null;
        return (
          <Section title={isRTL ? 'آخر الصفقات المكسوبة' : 'Recent Wins'} icon={CheckSquare} compact>
            <div className="space-y-1.5">
              {won.map((d, i) => {
                const val = parseFloat(d.deal_value) || 0;
                const name = isRTL ? (d.client_ar || d.client_en) : (d.client_en || d.client_ar);
                const agent = isRTL ? (d.agent_ar || d.agent_en) : (d.agent_en || d.agent_ar);
                return (
                  <div key={d.id || i} className={`flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-bg dark:hover:bg-white/[0.04] transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><CheckSquare size={14} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-[13px] font-semibold text-content dark:text-content-dark truncate">{name || (isRTL ? 'صفقة' : 'Deal')}</p>
                      {agent && <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark truncate mt-0.5">{agent}</p>}
                    </div>
                    {val > 0 && <span className="text-[13px] font-bold text-emerald-500 shrink-0 tabular-nums">{(val / 1000).toFixed(0)}K</span>}
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })()}
      </div>

      {/* ===== TEAM tab — Team Activity (managers only) ===== */}
      {hasPermission(P.CRM_VIEW_TEAM) && (
        <div className={tabVisible('team')}>
          <Section title={isRTL ? 'نشاط الفريق اليوم' : "Team Activity Today"} icon={Users}>
            <TeamActivityList profile={profile} isRTL={isRTL}
              scopeUserNames={viewScope.type === 'agent' ? [viewScope.name] : viewScope.type === 'team' ? viewScope.memberNames : null}
              scopeKey={viewScope.type === 'agent' ? `a:${viewScope.id}` : viewScope.type === 'team' ? `t:${viewScope.teamId}` : 'all'} />
          </Section>
        </div>
      )}

      <div className={tabVisible('today')}>
      {/* SLA breach alert — leads created more than SLA_HOURS ago that
          still have zero activity. Only renders when count > 0 so a
          well-handled day stays quiet. Links into the "never contacted"
          filter on the leads page. */}
      {slaBreachCount > 0 && (
        <Link
          to={leadsUrl('activity=never')}
          className="block no-underline mb-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 rounded-xl p-3 sm:p-4 transition-colors"
          title={isRTL ? 'عملاء لم يُسجَّل لهم أي تواصل' : 'Leads with no activity logged'}
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/20 text-red-500 border border-red-500/30 shrink-0">
              <AlertCircle size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-500">
                {isRTL
                  ? `${slaBreachCount} عميل لم يتم التواصل معهم بعد`
                  : `${slaBreachCount} leads not contacted yet`}
              </div>
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">
                {isRTL
                  ? 'لا يوجد أي نشاط مُسجَّل لهم حتى الآن.'
                  : 'No activity has been logged for them yet.'}
              </div>
            </div>
            <ChevronRight size={16} className={`text-red-500 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
          </div>
        </Link>
      )}
      </div>

      <div className={tabVisible('insights')}>
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
              to={`/leads?from=${isoDaysAgo(7)}`}
              title={isRTL ? 'عملاء أُضيفوا خلال آخر 7 أيام' : 'Leads created in the last 7 days'}
            />
            <AgingBucket
              label={isRTL ? 'في الانتظار' : 'Aging'}
              sub={isRTL ? '7-30 يوم' : '7–30 days'}
              count={agingBuckets.aging}
              tone="amber"
              to={`/leads?from=${isoDaysAgo(30)}&to=${isoDaysAgo(7)}`}
              title={isRTL ? 'عملاء بين 7 و 30 يوم' : 'Leads between 7 and 30 days old'}
            />
            <AgingBucket
              label={isRTL ? 'قديمة' : 'Old'}
              sub={isRTL ? '30+ يوم' : '30+ days'}
              count={agingBuckets.old}
              tone="red"
              to={`/leads?to=${isoDaysAgo(30)}`}
              title={isRTL ? 'عملاء أقدم من 30 يوم بدون إغلاق' : 'Leads older than 30 days, not closed'}
            />
          </div>
        </Section>
      )}

      {/* Conversion Funnel — leads → deals opened → deals won this month, with
          the two drop-off rates that matter. Hidden when there's nothing to
          measure yet (a fresh tenant with zero leads). */}
      {funnelData.leads > 0 && (
        <Section title={isRTL ? 'قمع التحويل (هذا الشهر)' : 'Conversion Funnel (This Month)'} icon={Target} compact>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <FunnelStep
              label={isRTL ? 'عملاء' : 'Leads'}
              value={funnelData.leads}
              tone="brand"
              to={`/leads?from=${isoMonthStart()}`}
              title={isRTL ? 'عملاء جدد منذ بداية الشهر' : 'New leads since the start of the month'}
            />
            <FunnelStep
              label={isRTL ? 'صفقات مفتوحة' : 'Deals'}
              value={funnelData.opps}
              tone="amber"
              conversion={funnelData.leadToOpp}
              isRTL={isRTL}
              to="/sales/deals"
              title={isRTL
                ? `صفقات فُتحت هذا الشهر — نسبة التحويل من العملاء ${funnelData.leadToOpp}%`
                : `Deals opened this month — ${funnelData.leadToOpp}% lead-to-deal conversion`}
            />
            <FunnelStep
              label={isRTL ? 'مكسوبة' : 'Won'}
              value={funnelData.wins}
              tone="emerald"
              conversion={funnelData.oppToWin}
              isRTL={isRTL}
              to="/sales/deals"
              title={isRTL
                ? `صفقات أُغلقت هذا الشهر — نسبة التحويل من الصفقات المفتوحة ${funnelData.oppToWin}%`
                : `Deals won this month — ${funnelData.oppToWin}% deal-to-win conversion`}
            />
          </div>
        </Section>
      )}
      </div>

      <div className={tabVisible('today')}>
      {/* Today's Focus */}
      <Section
        title={isRTL ? 'ركّز على اليوم' : "Today's Focus"}
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
              to: t.contact_id ? `/leads?highlight=${t.contact_id}` : '/tasks',
            })}
            emptyMessage={isRTL ? 'لا توجد مهام اليوم — استمتع!' : 'No tasks today — enjoy!'}
          />
          <FocusList
            title={isRTL ? 'مهام متأخرة' : 'Overdue Tasks'}
            items={overdueTasks}
            renderItem={(t) => ({
              primary: t.title,
              secondary: t.due_date ? formatDate(t.due_date, isRTL) : null,
              meta: t.priority,
              to: t.contact_id ? `/leads?highlight=${t.contact_id}` : '/tasks',
              flag: 'red',
            })}
            emptyMessage={isRTL ? 'لا توجد مهام متأخرة' : 'Nothing overdue'}
          />
          <FocusList
            title={isRTL ? 'عملاء بدون متابعة (7 أيام+)' : 'Stale Leads (7d+)'}
            items={staleLeads}
            renderItem={(c) => ({
              primary: c.full_name || c.phone,
              secondary: c.last_activity_at ? `${daysSince(c.last_activity_at)} ${isRTL ? 'يوم' : 'd ago'}` : (isRTL ? 'لا يوجد نشاط' : 'No activity'),
              meta: c.contact_status,
              to: `/leads?highlight=${c.id}`,
            })}
            emptyMessage={isRTL ? 'كل العملاء تتم متابعتهم' : 'Every lead is being followed up'}
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
              secondary: [t.contact_name, t.due_date ? formatDate(t.due_date, isRTL) : null].filter(Boolean).join(' • '),
              meta: t.priority,
              to: t.contact_id ? `/leads?highlight=${t.contact_id}` : '/tasks',
            })}
            emptyMessage={isRTL ? 'لا يوجد قادم' : 'Nothing upcoming'}
          />
        </Section>
      )}
      </div>

      <div className={tabVisible('insights')}>
      {/* Activity (Pipeline-by-stage chart removed in Phase B — no opp stages) */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <Section title={isRTL ? 'النشاط (14 يوم)' : 'Activity (14 days)'} icon={Activity} compact>
          {activityByDay.length === 0 ? (
            <EmptyState message={isRTL ? 'لا يوجد نشاط مسجل' : 'No activity yet'} />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityByDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  {/* RTL: run the time axis right→left and move the Y scale to the right */}
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} reversed={isRTL} />
                  <YAxis tick={{ fontSize: 10 }} orientation={isRTL ? 'right' : 'left'} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2F6BD3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      {/* Revenue trend — closed_won totals across the last 6 calendar
          months. Derived from stats.deal.rawDeals (won-only) so no extra query.
          Hidden when every bucket is zero (a healthy "hide noise" check). */}
      {revenueTrend.some(m => m.revenue > 0) && (
        <Section title={isRTL ? 'الإيرادات (آخر 6 شهور)' : 'Revenue (Last 6 Months)'} icon={TrendingUp} compact>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} reversed={isRTL} />
                <YAxis tick={{ fontSize: 10 }} orientation={isRTL ? 'right' : 'left'} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#158A57" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}
      </div>

      <div className={tabVisible('team')}>
      {/* Recent activity feed — most recent 15 events. RLS already
          constrains visibility per role, so we just render whatever
          comes back. Hidden when there's nothing to show. */}
      {recentFeed.length > 0 && (
        <Section
          title={isRTL ? 'آخر النشاطات' : 'Recent Activity'}
          icon={Activity}
          action={newActivityCount > 0 && (
            <button
              type="button"
              onClick={() => { setRefreshKey(k => k + 1); }}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              title={isRTL ? 'تحديث لعرض الجديد' : 'Refresh to show new'}
            >
              {newActivityCount} {isRTL ? 'جديد' : 'new'}
            </button>
          )}
        >
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
                    {formatRelativeTime(a.created_at, isRTL, now)}
                  </span>
                </div>
              );
              return (
                <li key={a.id}>
                  {a.contact_id
                    ? <Link to={`/leads?highlight=${a.contact_id}`} className="no-underline block">{node}</Link>
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
                <tr className="text-[10px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark">
                  <th className="text-start py-2 px-3 w-8">#</th>
                  <th className="text-start py-2 px-3">{isRTL ? 'الموظف' : 'Member'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'عملاء جدد' : 'New Leads'}</th>
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
                        ? () => navigate('/leads', { state: { drillDown: { field: 'assigned_to_name', value: p.name } } })
                        : undefined}
                      title={canDrill ? (isRTL ? `عرض عملاء ${p.name}` : `View leads assigned to ${p.name}`) : undefined}
                    >
                      <td className="py-2 px-3 text-content-muted dark:text-content-muted-dark font-semibold tabular-nums">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-content dark:text-content-dark">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={p.name} size={24} />
                          {p.name}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-end text-content dark:text-content-dark tabular-nums">{p.leads}</td>
                      <td className="py-2 px-3 text-end font-semibold text-emerald-500 tabular-nums">{p.wins}</td>
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

      {/* Source breakdown — managers+ only */}
      {sourceBreakdown.length > 0 && (
        <Section title={isRTL ? 'أداء المصادر' : 'Source Performance'} icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark">
                  <th className="text-start py-2 px-3">{isRTL ? 'المصدر' : 'Source'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'عدد العملاء' : 'Leads'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'صفقات' : 'Deals'}</th>
                  <th className="text-end py-2 px-3">{isRTL ? 'تحويل' : 'Conv %'}</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.map(s => (
                  <tr
                    key={s.source}
                    className="border-b border-edge/30 dark:border-edge-dark/30 cursor-pointer hover:bg-surface-bg dark:hover:bg-surface-bg-dark"
                    onClick={() => navigate('/leads', { state: { drillDown: { field: 'source', value: s.source } } })}
                    title={isRTL ? `عرض عملاء من مصدر ${s.source}` : `View leads from ${s.source}`}
                  >
                    <td className="py-2 px-3 font-medium text-content dark:text-content-dark">{humanizeKey(s.source)}</td>
                    <td className="py-2 px-3 text-end text-content dark:text-content-dark tabular-nums">{s.leads}</td>
                    <td className="py-2 px-3 text-end text-content dark:text-content-dark tabular-nums">{s.opps}</td>
                    <td className="py-2 px-3 text-end font-semibold text-emerald-500 tabular-nums">{s.conversion.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      </div>

      {/* Mobile FAB action bar — fixed at the bottom on phones, hidden
          on sm+. Mirrors the desktop header's primary actions so the
          thumb-reach zone always has Add Lead / Add Task / Refresh.
          The pb-24 on the page wrapper above reserves space so the
          bar never overlaps the last section. */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur border-t border-edge dark:border-edge-dark px-3 py-2 flex items-center gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <Button variant="primary" size="sm" className="w-full justify-center flex-1" onClick={() => setShowAddLead(true)}>
          <Plus size={14} /> {isRTL ? 'عميل جديد' : 'Add Lead'}
        </Button>
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

      {/* Add Lead — same modal the Leads page uses; create straight from here. */}
      {showAddLead && (
        <AddContactModal
          profile={profile}
          campaigns={[]}
          onClose={() => setShowAddLead(false)}
          onSave={handleSaveLead}
          checkDup={checkDuplicate}
        />
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

// True when a supabase.rpc call failed only because the function isn't in the
// DB yet (migration not applied). PostgREST returns 404 / code PGRST202. Those
// are EXPECTED before the aggregate-RPC migration lands — the loaders fall back
// to the legacy query, so we swallow them silently instead of spamming the
// error reporter every refresh. Any other error is a real fault and gets logged.
function isMissingRpc(err) {
  if (!err) return false;
  const code = err.code || '';
  const msg = String(err.message || '');
  return code === 'PGRST202' || code === '404' || err.status === 404
    || /could not find the function|does not exist/i.test(msg);
}

// One-shot dashboard counts — a single RPC returning total/new/last-month/hot/
// aging/SLA counts, replacing 8 separate count queries. Slashing the request
// fan-out is what fixes the "network connection was lost" failures + the slow
// load + the scoped-Total-Leads-stuck-at-company-total symptom (loadAll now
// completes reliably instead of being dropped mid-flight). Scope mirrors the
// other loaders. Falls back to the legacy per-count loaders only if the RPC
// isn't deployed yet.
async function loadDashboardCounts(ctx, scopeAgentIds, { monthStart, lastMonthStart, d7, d30 }) {
  const agentIds = (scopeAgentIds && scopeAgentIds.length)
    ? scopeAgentIds
    : (ctx.role === 'sales_agent' && ctx.userId ? [ctx.userId] : null);
  const zero = { totalLeads: 0, newThisMonth: 0, lastMonth: 0, hotCount: 0, slaBreach: 0, aging: { fresh: 0, aging: 0, old: 0 } };
  try {
    const { data, error } = await supabase.rpc('get_crm_dashboard_counts', {
      p_month_start: monthStart, p_last_month_start: lastMonthStart, p_d7: d7, p_d30: d30, p_agent_ids: agentIds,
    });
    if (error) throw error;
    if (data) {
      return {
        totalLeads: Number(data.totalLeads) || 0,
        newThisMonth: Number(data.newThisMonth) || 0,
        lastMonth: Number(data.lastMonth) || 0,
        hotCount: Number(data.hotCount) || 0,
        slaBreach: Number(data.slaBreach) || 0,
        aging: { fresh: Number(data.agingFresh) || 0, aging: Number(data.agingAging) || 0, old: Number(data.agingOld) || 0 },
      };
    }
    return zero;
  } catch (rpcErr) {
    // Only fan back out to the legacy count queries if the RPC simply isn't
    // deployed yet — for a real (e.g. network) error, firing 5 more requests
    // would worsen the overload, so report + return zeros instead.
    if (!isMissingRpc(rpcErr)) {
      reportError('CrmDashboardPage', 'loadDashboardCounts', rpcErr);
      return zero;
    }
  }
  // ── pre-migration fallback (8 requests, but correct numbers) ──
  const [cs, hot, lastM, aging, sla] = await Promise.all([
    fetchContactStats(ctx, scopeAgentIds),
    loadHotLeadsCount(ctx, scopeAgentIds),
    loadLastMonthNewCount(ctx, scopeAgentIds),
    loadAgingBuckets(ctx, scopeAgentIds),
    loadSlaBreaches(ctx, scopeAgentIds),
  ]);
  return {
    totalLeads: cs?.totalLeads || 0,
    newThisMonth: cs?.newLeadsThisMonth || 0,
    lastMonth: lastM || 0,
    hotCount: hot || 0,
    slaBreach: sla || 0,
    aging: aging || { fresh: 0, aging: 0, old: 0 },
  };
}

// New leads created during the previous calendar month (e.g. if today is
// May 24, this counts everything created between Apr 1 00:00 and May 1 00:00).
// Drives the period-comparison delta on the "New This Month" KPI card.
async function loadLastMonthNewCount(ctx, scopeAgentIds) {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .gte('created_at', lastMonthStart)
    .lt('created_at', thisMonthStart);
  if (scopeAgentIds && scopeAgentIds.length) q = q.in('assigned_to', scopeAgentIds);
  else if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
  const { count, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadLastMonthNewCount', error); return 0; }
  return count || 0;
}

// Count of leads with NO activity ever logged (last_activity_at IS NULL),
// not deleted. Deliberately matches the Leads page `activity=never` filter
// the alert card links to, so the count equals what the list shows — no age
// threshold (an earlier SLA_HOURS constant was never actually applied and has
// been removed to avoid implying a filter that isn't there).
async function loadSlaBreaches(ctx, scopeAgentIds) {
  // Counts leads with NO activity at all — matched exactly to the Leads page
  // `activity=never` filter the card links to, so the number equals the list.
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .is('last_activity_at', null);
  if (scopeAgentIds && scopeAgentIds.length) q = q.in('assigned_to', scopeAgentIds);
  else if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
  const { count, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadSlaBreaches', error); return 0; }
  return count || 0;
}

// Three count-only queries bucketing non-disqualified leads by age:
// 0-7 days (fresh), 7-30 days (aging), 30+ days (old). Helps managers
// see how much of the pipeline is going stale.
async function loadAgingBuckets(ctx, scopeAgentIds) {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000).toISOString();
  const d30 = new Date(now - 30 * 86400000).toISOString();

  const base = () => {
    let q = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .neq('contact_status', 'disqualified');
    if (scopeAgentIds && scopeAgentIds.length) q = q.in('assigned_to', scopeAgentIds);
    else if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
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

async function loadHotLeadsCount(ctx, scopeAgentIds) {
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('temperature', 'hot')
    .eq('is_deleted', false);
  if (scopeAgentIds && scopeAgentIds.length) q = q.in('assigned_to', scopeAgentIds);
  else if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('assigned_to', ctx.userId);
  const { count, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadHotLeadsCount', error); return 0; }
  return count || 0;
}

async function loadStaleLeads(ctx, sevenDaysAgo, scopeAgentIds) {
  let query = supabase
    .from('contacts')
    .select('id, full_name, phone, contact_status, last_activity_at, assigned_to')
    .eq('is_deleted', false)
    .neq('contact_status', 'disqualified')
    .or(`last_activity_at.lt.${sevenDaysAgo},last_activity_at.is.null`)
    .order('last_activity_at', { ascending: true, nullsFirst: true })
    .limit(5);
  if (scopeAgentIds && scopeAgentIds.length) query = query.in('assigned_to', scopeAgentIds);
  else if (ctx.role === 'sales_agent' && ctx.userId) query = query.eq('assigned_to', ctx.userId);
  const { data, error } = await query;
  if (error) { reportError('CrmDashboardPage', 'loadStaleLeads', error); return []; }
  return data || [];
}

async function loadActivityByDay(ctx, sinceIso, scopeAgentIds) {
  const agentIds = (scopeAgentIds && scopeAgentIds.length)
    ? scopeAgentIds
    : (ctx.role === 'sales_agent' && ctx.userId ? [ctx.userId] : null);
  // Build the continuous 14-day x-axis from a {MM-DD: count} map (missing days
  // filled with 0 so the bar chart never gaps).
  const build = (byDay) => {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10);
      out.push({ day: key, count: byDay[key] || 0 });
    }
    return out;
  };
  // Preferred path: DB-side day buckets (no 1000-row cap). The raw fetch below
  // capped at 1000 activities — for a busy org that undercounted every bar.
  try {
    const { data, error } = await supabase.rpc('get_activity_by_day', { p_since: sinceIso, p_agent_ids: agentIds });
    if (error) throw error;
    return build(data || {});
  } catch (rpcErr) {
    if (!isMissingRpc(rpcErr)) reportError('CrmDashboardPage', 'loadActivityByDay:rpc', rpcErr);
  }
  // ── legacy fallback (capped at 1000 rows) ──
  let query = supabase.from('activities').select('created_at').gte('created_at', sinceIso);
  if (agentIds && agentIds.length) query = query.in('user_id', agentIds);
  const { data, error } = await query;
  if (error) { reportError('CrmDashboardPage', 'loadActivityByDay', error); return []; }
  const byDay = {};
  (data || []).forEach(a => {
    if (!a.created_at) return;
    byDay[a.created_at.slice(5, 10)] = (byDay[a.created_at.slice(5, 10)] || 0) + 1;
  });
  return build(byDay);
}

// Closed-lost opportunities in the current month, with the reason field
// so the dashboard can group them. Uses stage_changed_at when present,
// else falls back to created_at — matches the existing computeOppStats
// convention in dashboardService.
async function loadLostThisMonth(scopeAgentIds) {
  // "Lost this month" = leads disqualified this month, reason from
  // disqualify_reason; mapped to { lost_reason } for the breakdown memo.
  // NOTE: there is no dedicated disqualify-timestamp column in the schema, so
  // we approximate the loss date with updated_at (when the status+reason were
  // last written). This slightly over-counts if an old disqualified lead is
  // edited again this month — acceptable for a "why did we lose deals" pulse.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase
    .from('contacts')
    .select('id, disqualify_reason, updated_at')
    .eq('contact_status', 'disqualified')
    .gte('updated_at', monthStart);
  if (scopeAgentIds && scopeAgentIds.length) q = q.in('assigned_to', scopeAgentIds);
  const { data, error } = await q;
  if (error) { reportError('CrmDashboardPage', 'loadLostThisMonth', error); return []; }
  return (data || []).map(c => ({ id: c.id, lost_reason: c.disqualify_reason }));
}

// Group contacts created in the current calendar month by assigned_to.
// Uses the denormalized assigned_to_name to avoid a users join. RLS
// scopes which contacts come back (admin/ops see all; team-leaders +
// managers see their team), so the totals naturally reflect the
// viewer's permitted slice.
async function loadLeadsThisMonthByUser(scopeAgentIds) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const agentIds = (scopeAgentIds && scopeAgentIds.length) ? scopeAgentIds : null;
  // Preferred path: DB-side group-by-owner (no 1000-row cap). The raw fetch
  // below capped at 1000 new leads → Top Performers undercounted in a busy
  // month. Returns the same {userId: {id, name, leads}} map the caller expects.
  try {
    const { data, error } = await supabase.rpc('get_leads_by_user_this_month', { p_month_start: monthStart, p_agent_ids: agentIds });
    if (error) throw error;
    const byUser = {};
    (data || []).forEach(r => { byUser[r.id] = { id: r.id, name: r.name || '—', leads: Number(r.leads) || 0 }; });
    return byUser;
  } catch (rpcErr) {
    if (!isMissingRpc(rpcErr)) reportError('CrmDashboardPage', 'loadLeadsThisMonthByUser:rpc', rpcErr);
  }
  // ── legacy fallback (capped at 1000 rows) ──
  let q = supabase
    .from('contacts')
    .select('assigned_to, assigned_to_name')
    .eq('is_deleted', false)
    .gte('created_at', monthStart)
    .not('assigned_to', 'is', null);
  if (agentIds && agentIds.length) q = q.in('assigned_to', agentIds);
  const { data, error } = await q;
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
async function loadRecentActivityFeed(ctx, scopeAgentIds) {
  let q = supabase
    .from('activities')
    .select('id, type, notes, created_at, user_name_en, user_name_ar, contact_id')
    // Reassignments are bulk/system rows with a null user_id and an Arabic name
    // baked into user_name_en — noise in an outreach feed, so keep them out.
    .neq('type', 'reassignment')
    .order('created_at', { ascending: false })
    .limit(15);
  if (scopeAgentIds && scopeAgentIds.length) q = q.in('user_id', scopeAgentIds);
  else if (ctx.role === 'sales_agent' && ctx.userId) q = q.eq('user_id', ctx.userId);
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

async function loadSourceBreakdown(ctx, scopeAgentIds) {
  // Effective agent-id filter: an explicit scope wins; otherwise a sales_agent
  // is pinned to their own id (mirrors the old .eq('assigned_to', userId)).
  const agentIds = (scopeAgentIds && scopeAgentIds.length)
    ? scopeAgentIds
    : (ctx.role === 'sales_agent' && ctx.userId ? [ctx.userId] : null);
  // Preferred path: DB-side aggregate (no 1000-row cap). Falls back to the
  // legacy client-side aggregation if the RPC isn't deployed yet.
  try {
    const { data, error } = await supabase.rpc('get_source_breakdown', { p_agent_ids: agentIds });
    if (error) throw error;
    return (data || []).map(r => ({
      source: r.source,
      leads: Number(r.leads) || 0,
      opps: Number(r.deals) || 0,
      conversion: Number(r.conversion) || 0,
    }));
  } catch (rpcErr) {
    if (!isMissingRpc(rpcErr)) reportError('CrmDashboardPage', 'loadSourceBreakdown:rpc', rpcErr);
  }
  // ── legacy fallback (capped at 1000 rows) ──
  let contactQuery = supabase.from('contacts').select('id, source').eq('is_deleted', false);
  let oppQuery = supabase.from('deals').select('contact_id');
  if (agentIds && agentIds.length) {
    contactQuery = contactQuery.in('assigned_to', agentIds);
    oppQuery = oppQuery.in('assigned_to', agentIds);
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

// Render YYYY-MM-DD for the date N days ago (local time). ContactsPage's
// from/to URL params expect this format, so we shape it the same way.
function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return localDateStr(d);
}

function isoMonthStart() {
  const now = new Date();
  return localMonthStartStr(now);
}

function formatDate(iso, isRTL) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US');
}

function formatRelativeTime(iso, isRTL, nowMs = Date.now()) {
  if (!iso) return '';
  const diffMs = nowMs - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return isRTL ? 'الآن' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return isRTL ? `منذ ${min} د` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isRTL ? `منذ ${hr} س` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return isRTL ? `منذ ${day} يوم` : `${day}d ago`;
  return formatDate(iso, isRTL);
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

// My Targets — this month's target vs actual per metric, as progress bars.
// Per-user (profile.id), so everyone sees their own goals. Falls back to the
// role's default targets when none are explicitly set.
function MyTargetsWidget({ profile, isRTL, scopeUserId, scopeRole }) {
  const [rows, setRows] = useState(null);
  const empId = scopeUserId || profile?.id;
  const empRole = scopeRole || profile?.role;
  useEffect(() => {
    if (!empId) return;
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const month = now.getMonth() + 1, year = now.getFullYear();
        const [targetsArr, actuals] = await Promise.all([
          getEmployeeTargets(empId, month, year),
          computeActuals(empId, month, year),
        ]);
        if (cancelled) return;
        const defaults = getDefaultTargets(empRole) || {};
        const targetMap = {};
        (targetsArr || []).forEach(t => { targetMap[t.metric] = Number(t.target_value); });
        const metrics = ['closed_deals', 'revenue', 'new_opportunities', 'calls'];
        setRows(metrics.map(m => {
          const target = targetMap[m] ?? defaults[m] ?? 0;
          const actual = actuals[m] ?? 0;
          const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
          return { metric: m, target, actual, pct, label: isRTL ? METRIC_CONFIG[m]?.ar : METRIC_CONFIG[m]?.en, color: METRIC_CONFIG[m]?.color || '#2F6BD3' };
        }));
      } catch (e) { if (!isMissingRpc(e)) reportError('CrmDashboardPage', 'MyTargets', e); if (!cancelled) setRows([]); }
    })();
    return () => { cancelled = true; };
  }, [empId, empRole, isRTL]);
  if (rows === null) return <ListSkeleton rows={4} />;
  if (!rows.length) return null;
  const fmt = (m, v) => m === 'revenue' ? `${(v / 1000).toFixed(0)}K` : (v || 0).toLocaleString();
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.metric}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-content dark:text-content-dark font-medium">{r.label}</span>
            <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{fmt(r.metric, r.actual)} / {fmt(r.metric, r.target)} · {r.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-bg dark:bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Team Activity Today — calls / WhatsApp / meetings logged today per agent.
// Managers only. Moved from the main dashboard.
function TeamActivityList({ profile, isRTL, scopeUserNames, scopeKey }) {
  const [teamData, setTeamData] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const todayStr = localDateStr();
        // Real work on a lead: outreach (call/whatsapp/meeting) + status changes.
        // Deliberately EXCLUDES reassignment (bulk/system rows that had a null
        // user_id and an Arabic name baked into user_name_en) and notes — both
        // used to silently inflate the totals here.
        let query = supabase.from('activities').select('user_name_en, type')
          .in('type', ['call', 'whatsapp', 'meeting', 'status_change'])
          .gte('created_at', todayStr + 'T00:00:00');
        if (scopeUserNames && scopeUserNames.length) query = query.in('user_name_en', scopeUserNames);
        else if (profile?.role === 'sales_agent') query = query.eq('user_name_en', profile?.full_name_en);
        else if ((profile?.role === 'team_leader' || profile?.role === 'sales_manager') && profile?.team_id) {
          const teamIds = [profile.team_id];
          if (profile.role === 'sales_manager') {
            const { data: ch } = await supabase.from('departments').select('id').eq('parent_id', profile.team_id);
            if (ch) teamIds.push(...ch.map(c => c.id));
          }
          const { data: members } = await supabase.from('users').select('full_name_en').in('team_id', teamIds);
          if (members?.length) query = query.in('user_name_en', members.map(m => m.full_name_en).filter(Boolean));
        }
        const { data } = await query;
        if (cancelled || !data) return;
        const map = {};
        data.forEach(a => {
          const name = a.user_name_en || 'Unknown';
          if (!map[name]) map[name] = { name, calls: 0, whatsapp: 0, meetings: 0, status: 0, total: 0 };
          if (a.type === 'call') map[name].calls++;
          else if (a.type === 'whatsapp') map[name].whatsapp++;
          else if (a.type === 'meeting') map[name].meetings++;
          else if (a.type === 'status_change') map[name].status++;
          map[name].total++;
        });
        setTeamData(Object.values(map).sort((x, y) => y.total - x.total).slice(0, 8));
      } catch (e) { if (!isMissingRpc(e)) reportError('CrmDashboardPage', 'TeamActivity', e); }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, profile?.team_id, profile?.full_name_en, scopeKey]);
  if (!teamData.length) return <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-3">{isRTL ? 'لا نشاط اليوم بعد' : 'No activity yet today'}</p>;
  return (
    <div className="space-y-2">
      {teamData.map((t, i) => (
        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-bg dark:bg-white/[0.04] ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Avatar name={t.name} size={32} />
          <div className="flex-1 min-w-0">
            <p className="m-0 text-xs font-semibold text-content dark:text-content-dark truncate">{t.name}</p>
            <div className="flex gap-2 mt-0.5">
              {t.calls > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500" title={isRTL ? 'مكالمات' : 'Calls'}><Phone size={11} />{t.calls}</span>}
              {t.whatsapp > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-green-500" title="WhatsApp"><MessageCircle size={11} />{t.whatsapp}</span>}
              {t.meetings > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500" title={isRTL ? 'اجتماعات' : 'Meetings'}><Calendar size={11} />{t.meetings}</span>}
              {t.status > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500" title={isRTL ? 'تغيير حالة' : 'Status'}><RefreshCw size={11} />{t.status}</span>}
            </div>
          </div>
          <span className="text-sm font-bold text-brand-500">{t.total}</span>
        </div>
      ))}
    </div>
  );
}

// Work queue — the highest-priority leads to act on right now: hot leads first,
// then untouched fresh (new + never worked). One call-to-action list. Scope-aware.
// Readable labels for lost-deal reason keys that aren't in system config yet, so
// the "Lost Deal Reasons" breakdown never shows raw snake_case keys. Config
// labels still win; this is the fallback, and humanizeKey covers anything else.
const LOST_REASON_FALLBACK = {
  not_interested:     { ar: 'غير مهتم',              en: 'Not interested' },
  no_budget:          { ar: 'لا توجد ميزانية',        en: 'No budget' },
  no_answer:          { ar: 'لا يرد',                 en: 'No answer' },
  no_answer_all_time: { ar: 'لا يرد (كل المحاولات)',  en: 'No answer (all attempts)' },
  existing_client:    { ar: 'عميل حالي',             en: 'Existing client' },
  wrong_number:       { ar: 'رقم خاطئ',              en: 'Wrong number' },
  wrong_audience:     { ar: 'جمهور غير مستهدف',       en: 'Wrong audience' },
  resale:             { ar: 'إعادة بيع',             en: 'Resale' },
  duplicate:          { ar: 'مكرر',                  en: 'Duplicate' },
  legacy_no_reason:   { ar: 'بدون سبب (قديم)',       en: 'No reason (legacy)' },
  other:              { ar: 'أخرى',                  en: 'Other' },
};
const humanizeKey = (k) => (k || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Two-letter initials from a lead's name for the list avatars (first letter of
// the first two words). Works for Arabic and Latin names alike.
function leadInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '–';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function WorkQueueWidget({ profile, navigate, isRTL, scopeUserIds, scopeKey }) {
  const [leads, setLeads] = useState(null);
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // Two targeted, ORDERED queries instead of one unordered .limit(20):
        // the old query fetched an arbitrary 20 rows, so with many hot/fresh
        // leads the most-relevant ones could be missed entirely. Fetching hot
        // and untouched-fresh separately guarantees hot leads always surface,
        // each ordered by neglect (hot: longest since activity; fresh: oldest
        // still-new). Merged hot-first, deduped, top 10.
        const applyScope = (q) => {
          if (scopeUserIds && scopeUserIds.length) return q.in('assigned_to', scopeUserIds);
          if (profile?.role === 'sales_agent') return q.eq('assigned_to', profile.id);
          return q;
        };
        const cols = 'id, full_name, phone, temperature, lead_category, contact_status';
        const base = () => supabase.from('contacts').select(cols).eq('is_deleted', false);
        const [hotRes, freshRes] = await Promise.all([
          applyScope(base().eq('temperature', 'hot'))
            .order('last_activity_at', { ascending: true, nullsFirst: true }).limit(10),
          applyScope(base().eq('lead_category', 'fresh').eq('contact_status', 'new'))
            .order('created_at', { ascending: true }).limit(10),
        ]);
        if (cancelled) return;
        const seen = new Set();
        const merged = [];
        for (const c of (hotRes.data || [])) { if (!seen.has(c.id)) { seen.add(c.id); merged.push({ ...c, reason: 'hot' }); } }
        for (const c of (freshRes.data || [])) { if (!seen.has(c.id)) { seen.add(c.id); merged.push({ ...c, reason: 'fresh' }); } }
        setLeads(merged.slice(0, 10));
      } catch (e) { if (!isMissingRpc(e)) reportError('CrmDashboardPage', 'WorkQueue', e); if (!cancelled) setLeads([]); }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, scopeKey]);
  const cleanPhone = (p) => (p || '').replace(/[^0-9+]/g, '');
  if (leads === null) return <ListSkeleton rows={5} />;
  if (!leads.length) return (
    <div className="text-center py-4">
      <CheckSquare size={24} className="text-emerald-500 opacity-60 mb-2 mx-auto" />
      <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا يوجد أولويات الآن — شغل نظيف!' : 'No priorities right now — all caught up!'}</p>
    </div>
  );
  return (
    <div className="space-y-1">
      {leads.map((l, i) => {
        const tel = cleanPhone(l.phone);
        const hot = l.reason === 'hot';
        return (
          <div key={l.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-bg dark:hover:bg-white/[0.04] transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="w-4 text-center text-[11px] font-bold text-content-muted/70 dark:text-content-muted-dark/70 shrink-0 tabular-nums">{i + 1}</span>
            <span className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-300">{leadInitials(l.full_name)}</span>
            <button onClick={() => navigate(`/leads?highlight=${l.id}`)} className="flex-1 min-w-0 text-start bg-transparent border-none cursor-pointer p-0">
              <p className="m-0 text-[13px] font-semibold text-content dark:text-content-dark truncate">{l.full_name || (isRTL ? 'بدون اسم' : 'No name')}</p>
              <span className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: hot ? '#DD6327' : '#158A57', backgroundColor: hot ? 'rgba(221,99,39,.11)' : 'rgba(21,138,87,.10)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hot ? '#DD6327' : '#158A57' }} />
                {hot ? (isRTL ? 'ساخن' : 'Hot') : (isRTL ? 'فريش · جديد' : 'Fresh · new')}
              </span>
            </button>
            {l.phone && <span className="hidden md:inline text-[11px] text-content-muted dark:text-content-muted-dark tabular-nums shrink-0 opacity-80" dir="ltr">{l.phone}</span>}
            <span className="flex gap-1.5 shrink-0">
              <button onClick={() => navigate(`/leads?quicklog=${l.id}`)} title={isRTL ? 'سجّل نشاط' : 'Log activity'} className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-colors cursor-pointer"><Zap size={13} /></button>
              {tel && (<>
                <a href={`tel:${tel}`} title={isRTL ? 'اتصل' : 'Call'} className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors no-underline"><Phone size={13} /></a>
                <a href={`https://wa.me/${tel.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:bg-green-600 hover:text-white hover:border-green-600 transition-colors no-underline"><MessageCircle size={13} /></a>
              </>)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// "Need a call" — leads in 'following' with no activity for 3+ days, the ones
// most likely to slip. Moved here from the main dashboard so the CRM page is the
// single sales home. Role-scoped: a sales_agent sees only their own.
function NeedACallWidget({ profile, navigate, isRTL, scopeUserIds, scopeKey }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();
        let q = supabase
          .from('contacts')
          .select('id, full_name, phone, last_activity_at, contact_status')
          .eq('contact_status', 'following')
          .lt('last_activity_at', cutoff)
          .order('last_activity_at', { ascending: true })
          .limit(8);
        // Scope: explicit selection (one agent or a team's members) wins;
        // otherwise a sales_agent sees own.
        if (scopeUserIds && scopeUserIds.length) q = q.in('assigned_to', scopeUserIds);
        else if (profile?.role === 'sales_agent' && profile?.id) q = q.eq('assigned_to', profile.id);
        const { data, error } = await q;
        if (cancelled) return;
        setLeads(!error && Array.isArray(data) ? data : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, scopeKey]);
  const cleanPhone = (p) => (p || '').replace(/[^0-9+]/g, '');
  if (loading) return <ListSkeleton rows={4} />;
  if (!leads.length) return (
    <div className="text-center py-4">
      <CheckSquare size={24} className="text-emerald-500 opacity-60 mb-2 mx-auto" />
      <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا يوجد ليدز متأخرة — شغل نظيف!' : 'No stale follow-ups — clean slate!'}</p>
    </div>
  );
  return (
    <div className="space-y-1">
      {leads.map(l => {
        const days = l.last_activity_at ? Math.floor((Date.now() - new Date(l.last_activity_at).getTime()) / 86400000) : null;
        const tel = cleanPhone(l.phone);
        return (
          <div key={l.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-bg dark:hover:bg-white/[0.04] transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold bg-amber-500/12 text-amber-600 dark:text-amber-400">{leadInitials(l.full_name)}</span>
            <button onClick={() => navigate(`/leads?highlight=${l.id}`)} className="flex-1 min-w-0 text-start bg-transparent border-none cursor-pointer p-0">
              <p className="m-0 text-[13px] font-semibold text-content dark:text-content-dark truncate">{l.full_name || (isRTL ? 'بدون اسم' : 'No name')}</p>
              <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">{days == null ? (isRTL ? 'لا نشاط مسجّل' : 'No activity recorded') : (isRTL ? `آخر نشاط من ${days} يوم` : `${days}d since last activity`)}</p>
            </button>
            {l.phone && <span className="hidden md:inline text-[11px] text-content-muted dark:text-content-muted-dark tabular-nums shrink-0 opacity-80" dir="ltr">{l.phone}</span>}
            {tel && (
              <span className="flex gap-1.5 shrink-0">
                <a href={`tel:${tel}`} title={isRTL ? 'اتصل' : 'Call'} className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors no-underline"><Phone size={13} /></a>
                <a href={`https://wa.me/${tel.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:bg-green-600 hover:text-white hover:border-green-600 transition-colors no-underline"><MessageCircle size={13} /></a>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact stat row for the right-column lens summaries (colour dot + label +
// value). Clickable → deep-links into the filtered Leads list. Replaces the old
// full-width KpiCard grids so the summaries read as a scannable list, not a wall
// of cards.
function LensRow({ label, value, color, to, navigate, isRTL }) {
  return (
    <button
      onClick={() => navigate(to)}
      className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-surface-bg dark:hover:bg-white/[0.04] transition-colors bg-transparent border-none cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <span className={`flex items-center gap-2.5 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[13px] text-content dark:text-content-dark truncate">{label}</span>
      </span>
      <span className="text-[15px] font-bold tabular-nums text-content dark:text-content-dark shrink-0">{(value || 0).toLocaleString()}</span>
    </button>
  );
}

function KpiCard({ label, value, sublabel, icon: Icon, color = 'brand', to, delta, description, hero = false }) {
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
    <div title={description} className="h-full bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand-500/30 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-content-muted dark:text-content-muted-dark font-medium">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorMap[color] || colorMap.brand}`}>
          <Icon size={15} />
        </span>
      </div>
      <div className={`font-bold text-content dark:text-content-dark leading-none tracking-tight tabular-nums ${hero ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{value.toLocaleString()}</div>
      {sublabel && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-1.5">{sublabel}</div>}
      {delta && (
        <div className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 ${deltaToneClass}`}>
          <DeltaIcon size={12} /> {delta.label}
        </div>
      )}
    </div>
  );
  return to ? <Link to={to} className="block no-underline h-full">{content}</Link> : content;
}

function Section({ title, icon: Icon, compact = false, children, action }) {
  return (
    <section className={`bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-sm ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} mb-3`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-content-muted dark:text-content-muted-dark" />}
        <h2 className="text-sm font-bold text-content dark:text-content-dark m-0 flex-1">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Lightweight group heading — label + icon, NO card border. KPI/lens cards
// placed under it sit on the page background, so we avoid the heavy "bordered
// cards inside a bordered card" nesting. Use Section only for list/chart panels.
function FocusList({ title, items, renderItem, emptyMessage }) {
  return (
    <div className="rounded-xl bg-surface-bg/60 dark:bg-white/[0.03] border border-edge/60 dark:border-edge-dark/50 p-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark mb-2.5 mt-0">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-content-muted dark:text-content-muted-dark my-3 text-center">{emptyMessage}</p>
      ) : (
        <ul className="list-none p-0 m-0 space-y-0.5">
          {items.map((item, i) => {
            const r = renderItem(item);
            const node = (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-card dark:hover:bg-white/[0.05] transition-colors">
                {r.flag === 'red' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-content dark:text-content-dark truncate">{r.primary}</div>
                  {r.secondary && <div className="text-[10px] text-content-muted dark:text-content-muted-dark truncate mt-0.5">{r.secondary}</div>}
                </div>
                {r.meta && <span className="text-[10px] font-medium text-content-muted dark:text-content-muted-dark whitespace-nowrap shrink-0">{r.meta}</span>}
                {r.to && <ChevronRight size={13} className="text-content-muted/60 dark:text-content-muted-dark/60 shrink-0" />}
              </div>
            );
            return <li key={i}>{r.to ? <Link to={r.to} className="no-underline">{node}</Link> : node}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

// Deterministic per-name avatar — an initial on a color derived from the name,
// so each agent keeps a stable, distinct chip instead of everyone sharing the
// same brand-blue circle. Used in Team Activity + Top Performers.
const AVATAR_COLORS = ['#2F6BD3', '#158A57', '#C9860A', '#5A63C4', '#C14D7E', '#2088A0', '#D6403B', '#12897E'];
function Avatar({ name, size = 32 }) {
  const label = (name || '?').trim() || '?';
  const initial = label.charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <span
      className="rounded-lg inline-flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: `${color}1A`, color, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}

// Pulsing row skeleton for widget loading states — keeps the panel's shape
// while data arrives instead of a bare "Loading..." line.
function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface-bg dark:bg-white/[0.04]">
          <span className="w-7 h-7 rounded-md bg-edge/50 dark:bg-white/[0.06] animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-2.5 rounded bg-edge/50 dark:bg-white/[0.06] animate-pulse" style={{ width: `${60 + (i % 3) * 12}%` }} />
            <div className="h-2 rounded bg-edge/40 dark:bg-white/[0.05] animate-pulse" style={{ width: `${35 + (i % 2) * 15}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FunnelStep({ label, value, tone = 'brand', conversion, isRTL, to, title }) {
  const toneMap = {
    brand:   'bg-brand-500/10   border-brand-500/30   text-brand-500',
    amber:   'bg-amber-500/10   border-amber-500/30   text-amber-500',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  };
  const body = (
    <div title={title} className={`rounded-xl border p-3 sm:p-4 shadow-sm ${toneMap[tone] || toneMap.brand} ${to ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}`}>
      <div className="text-[11px] font-semibold mb-1">{label}</div>
      <div className="text-2xl font-bold text-content dark:text-content-dark leading-none tabular-nums tracking-tight">{value.toLocaleString()}</div>
      {conversion != null && (
        <div className="text-[10px] mt-2 text-content-muted dark:text-content-muted-dark">
          {conversion}% {isRTL ? 'تحويل' : 'conversion'}
        </div>
      )}
    </div>
  );
  return to ? <Link to={to} className="block no-underline">{body}</Link> : body;
}

function AgingBucket({ label, sub, count, tone = 'brand', to, title }) {
  const toneMap = {
    emerald: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
    amber:   'text-amber-500   border-amber-500/20   bg-amber-500/5',
    red:     'text-red-500     border-red-500/20     bg-red-500/5',
    brand:   'text-brand-500   border-brand-500/20   bg-brand-500/5',
  };
  const body = (
    <div title={title} className={`rounded-xl border p-3 shadow-sm ${toneMap[tone] || toneMap.brand} ${to ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}`}>
      <div className="text-[11px] font-semibold mb-0.5">{label}</div>
      <div className="text-xl font-bold text-content dark:text-content-dark leading-none tabular-nums tracking-tight">{count.toLocaleString()}</div>
      <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-1">{sub}</div>
    </div>
  );
  return to ? <Link to={to} className="block no-underline">{body}</Link> : body;
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-content-muted dark:text-content-muted-dark text-xs">
      <AlertCircle size={14} className="me-1.5" /> {message}
    </div>
  );
}
