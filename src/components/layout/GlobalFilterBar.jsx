import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import { useGlobalFilter } from '../../contexts/GlobalFilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSalesAgents } from '../../services/opportunitiesService';
import supabase from '../../lib/supabase';

const DEPARTMENTS = [
  { value: 'all', ar: 'كل الأقسام', en: 'All Departments' },
  { value: 'sales', ar: 'المبيعات', en: 'Sales' },
  { value: 'marketing', ar: 'التسويق', en: 'Marketing' },
  { value: 'hr', ar: 'HR', en: 'HR' },
  { value: 'finance', ar: 'المالية', en: 'Finance' },
  { value: 'operations', ar: 'العمليات', en: 'Operations' },
];

export default function GlobalFilterBar() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const { profile } = useAuth();
  const { department, setDepartment, managerId, setManagerId, teamId, setTeamId, agentName, setAgentName, period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, isFiltered, clearFilters } = useGlobalFilter();

  const [expanded, setExpanded] = useState(false);
  const [agents, setAgents] = useState([]);

  const [teamsMap, setTeamsMap] = useState({});
  const [allTeams, setAllTeams] = useState([]);

  // Only fetch agents/teams when the filter bar is expanded
  const [dataLoaded, setDataLoaded] = useState(false);
  useEffect(() => {
    if (!expanded && !dataLoaded) return; // defer until opened
    if (dataLoaded) return; // already loaded
    setDataLoaded(true);
    (async () => {
      const data = await fetchSalesAgents();
      let filtered = data || [];
      if (profile?.role === 'sales_manager' && profile?.team_id) {
        const { data: children } = await supabase.from('departments').select('id').eq('parent_id', profile.team_id);
        const allowedTeams = new Set([profile.team_id, ...((children || []).map(c => c.id))]);
        setAgents(filtered.filter(a => allowedTeams.has(a.team_id)));
      } else if (profile?.role === 'team_leader' && profile?.team_id) {
        setAgents(filtered.filter(a => a.team_id === profile.team_id));
      } else if (profile?.role === 'sales_agent') {
        setAgents(filtered.filter(a => a.id === profile.id));
      } else {
        setAgents(filtered);
      }
    })();
    supabase.from('departments').select('id, name_ar, name_en, parent_id').then(({ data }) => {
      const m = {};
      (data || []).forEach(t => { m[t.id] = t; });
      setTeamsMap(m);
      setAllTeams(data || []);
    });
  }, [expanded, dataLoaded, profile?.role, profile?.team_id, profile?.id]);

  // Managers = sales_manager role users (only visible to admin/operations)
  const managers = useMemo(() => {
    if (profile?.role === 'admin' || profile?.role === 'operations') {
      return (agents || []).filter(a => a.role === 'sales_manager');
    }
    return [];
  }, [agents, profile?.role]);

  // Teams filtered by selected manager
  const visibleTeams = useMemo(() => {
    if (managerId === 'all') {
      // Show all teams that have agents
      const teamIds = new Set();
      (agents || []).forEach(a => { if (a.team_id) teamIds.add(a.team_id); });
      return [...teamIds].sort((a, b) => (teamsMap[a]?.name_en || '').localeCompare(teamsMap[b]?.name_en || ''));
    }
    // Find manager's team
    const manager = (agents || []).find(a => a.id === managerId);
    if (!manager?.team_id) return [];
    const managerTeamId = manager.team_id;
    // Get manager's own team + child teams (where parent_id = manager's team)
    const childTeams = (allTeams || []).filter(t => t.parent_id === managerTeamId).map(t => t.id);
    return [managerTeamId, ...childTeams];
  }, [managerId, agents, allTeams, teamsMap]);

  const filteredAgents = useMemo(() => {
    let list = agents || [];
    if (managerId !== 'all') {
      const teamIds = new Set(visibleTeams);
      list = list.filter(a => teamIds.has(a.team_id));
    }
    if (teamId !== 'all') {
      list = list.filter(a => a.team_id === teamId);
    }
    return list;
  }, [agents, managerId, teamId, visibleTeams]);

  const selectClass = `
    h-[28px] md:h-[30px] px-1.5 md:px-2 text-[11px] md:text-xs rounded-lg border border-edge dark:border-edge-dark
    bg-surface-card dark:bg-surface-card-dark
    text-content dark:text-content-dark
    focus:outline-none focus:ring-1 focus:ring-brand-500/40
    appearance-none cursor-pointer max-w-[110px] md:max-w-none
  `.trim();

  // If not expanded and not filtered, show just the toggle button
  if (!expanded && !isFiltered) {
    return (
      <div
        className={`flex items-center px-4 md:px-7 py-1.5 bg-surface-bg dark:bg-surface-bg-dark border-b border-edge/50 dark:border-edge-dark/50 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <button
          onClick={() => setExpanded(true)}
          className={`flex items-center gap-1.5 text-xs text-content-muted dark:text-content-muted-dark hover:text-brand-500 dark:hover:text-brand-400 transition-colors bg-transparent border-none cursor-pointer p-0 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <Filter size={13} />
          <span>{isRTL ? 'فلتر عام' : 'Global Filter'}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 md:gap-3 px-4 md:px-7 py-2 bg-surface-card/60 dark:bg-surface-card-dark/60 border-b border-edge/50 dark:border-edge-dark/50 backdrop-blur-sm ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Filter icon */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Filter size={13} className={isFiltered ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'} />
        <span className={`text-xs font-medium hidden sm:inline ${isFiltered ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
          {isRTL ? 'فلتر عام' : 'Global Filter'}
        </span>
      </div>

      {/* Department */}
      <select
        value={department}
        onChange={e => { setDepartment(e.target.value); setAgentName('all'); }}
        className={selectClass}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {DEPARTMENTS.map(d => (
          <option key={d.value} value={d.value}>{isRTL ? d.ar : d.en}</option>
        ))}
      </select>

      {/* Manager */}
      {managers.length > 0 && (
        <select
          value={managerId}
          onChange={e => { setManagerId(e.target.value); setTeamId('all'); setAgentName('all'); }}
          className={selectClass}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <option value="all">{isRTL ? 'كل المديرين' : 'All Managers'}</option>
          {managers.map(m => (
            <option key={m.id} value={m.id}>{isRTL ? (m.full_name_ar || m.full_name_en) : (m.full_name_en || m.full_name_ar)}</option>
          ))}
        </select>
      )}

      {/* Team */}
      <select
        value={teamId}
        onChange={e => { setTeamId(e.target.value); setAgentName('all'); }}
        className={selectClass}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <option value="all">{isRTL ? 'كل الفرق' : 'All Teams'}</option>
        {visibleTeams.map(t => (
          <option key={t} value={t}>{isRTL ? (teamsMap[t]?.name_ar || t) : (teamsMap[t]?.name_en || t)}</option>
        ))}
      </select>

      {/* Agent */}
      <select
        value={agentName}
        onChange={e => setAgentName(e.target.value)}
        className={selectClass}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <option value="all">{isRTL ? 'كل الموظفين' : 'All Agents'}</option>
        {filteredAgents.map(a => (
          <option key={a.id} value={isRTL ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}>
            {isRTL ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}
          </option>
        ))}
      </select>

      {/* Period */}
      <select value={period} onChange={e => setPeriod(e.target.value)} className={selectClass} dir={isRTL ? 'rtl' : 'ltr'}>
        {[
          { value: 'all', ar: 'كل الأوقات', en: 'All Time' },
          { value: 'today', ar: 'اليوم', en: 'Today' },
          { value: 'yesterday', ar: 'أمس', en: 'Yesterday' },
          { value: 'this_week', ar: 'هذا الأسبوع', en: 'This Week' },
          { value: 'this_month', ar: 'هذا الشهر', en: 'This Month' },
          { value: 'last_7', ar: 'آخر 7 أيام', en: 'Last 7 Days' },
          { value: 'last_30', ar: 'آخر 30 يوم', en: 'Last 30 Days' },
          { value: 'custom', ar: 'فترة مخصصة', en: 'Custom Range' },
        ].map(p => <option key={p.value} value={p.value}>{isRTL ? p.ar : p.en}</option>)}
      </select>

      {/* Custom date range */}
      {period === 'custom' && (
        <>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className={`${selectClass} w-[120px]`} />
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className={`${selectClass} w-[120px]`} />
        </>
      )}

      {/* Clear / Collapse */}
      {isFiltered && (
        <button
          onClick={clearFilters}
          className={`flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/15 border-none rounded-md px-2 py-1 cursor-pointer transition-colors ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <X size={11} />
          {isRTL ? 'مسح' : 'Clear'}
        </button>
      )}

      {!isFiltered && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center text-[11px] text-content-muted dark:text-content-muted-dark hover:text-content dark:hover:text-content-dark bg-transparent border-none cursor-pointer p-0 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
