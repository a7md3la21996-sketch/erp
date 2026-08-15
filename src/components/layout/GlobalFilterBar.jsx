import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import { useGlobalFilter } from '../../contexts/GlobalFilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSalesAgents } from '../../services/opportunitiesService';
import { getTeamMemberIds } from '../../utils/teamHelper';
import supabase from '../../lib/supabase';

// Module-scope so its identity is STABLE across renders. Defining it inside the
// component made it a new component type every render, so React unmounted and
// remounted the <select> elements on every state change — which destroyed the
// selection mid-interaction (picking an agent/team appeared to do nothing).
const LABEL_CLS = 'text-[10px] font-semibold uppercase tracking-wide text-content-muted dark:text-content-muted-dark mb-1 block';
function Field({ label, children }) {
  return <div><span className={LABEL_CLS}>{label}</span>{children}</div>;
}

// Global "view as / filter by" control — lives in the top Header as a funnel
// icon that opens a dropdown. Filters by department / manager / team / agent /
// period and drives GlobalFilterContext, which data pages (Leads, Activities,
// Tasks, Opportunities) read. Available on every page so you can always narrow
// the whole app to a person/team/manager.
export default function GlobalFilterBar() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile } = useAuth();
  const { managerId, setManagerId, teamId, setTeamId, agentName, setAgentName, period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, isFiltered, clearFilters } = useGlobalFilter();

  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [teamsMap, setTeamsMap] = useState({});
  const [allTeams, setAllTeams] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const ref = useRef(null);

  // Close on click-outside. Use `click` (not `mousedown`): a native <select>
  // option click fires a document mousedown whose target is outside the panel,
  // which closed the panel BEFORE the select's change committed — so picking an
  // agent/team looked like it did nothing. Also ignore SELECT/OPTION targets.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'OPTION' || tag === 'SELECT') return;
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  // Load agents/teams the first time the menu opens.
  useEffect(() => {
    if (!open || dataLoaded) return;
    setDataLoaded(true);
    (async () => {
      const data = await fetchSalesAgents();
      let filtered = data || [];
      if ((profile?.role === 'sales_manager' || profile?.role === 'team_leader') && profile?.team_id) {
        // Same hierarchy expansion the rest of the app uses (manager = 2 levels)
        // so agents in deeper teams aren't missing from the filter.
        const memberIds = new Set(await getTeamMemberIds(profile.role, profile.team_id));
        setAgents(filtered.filter(a => memberIds.has(a.id)));
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
  }, [open, dataLoaded, profile?.role, profile?.team_id, profile?.id]);

  const managers = useMemo(() => {
    if (profile?.role === 'admin' || profile?.role === 'operations') {
      return (agents || []).filter(a => a.role === 'sales_manager');
    }
    return [];
  }, [agents, profile?.role]);

  const visibleTeams = useMemo(() => {
    if (managerId === 'all') {
      const teamIds = new Set();
      (agents || []).forEach(a => { if (a.team_id) teamIds.add(a.team_id); });
      return [...teamIds].sort((a, b) => (teamsMap[a]?.name_en || '').localeCompare(teamsMap[b]?.name_en || ''));
    }
    const manager = (agents || []).find(a => a.id === managerId);
    if (!manager?.team_id) return [];
    const managerTeamId = manager.team_id;
    const childTeams = (allTeams || []).filter(t => t.parent_id === managerTeamId).map(t => t.id);
    return [managerTeamId, ...childTeams];
  }, [managerId, agents, allTeams, teamsMap]);

  const filteredAgents = useMemo(() => {
    let list = agents || [];
    if (managerId !== 'all') {
      const teamIds = new Set(visibleTeams);
      list = list.filter(a => teamIds.has(a.team_id));
    }
    if (teamId !== 'all') list = list.filter(a => a.team_id === teamId);
    return list;
  }, [agents, managerId, teamId, visibleTeams]);

  const selectClass = 'w-full h-9 px-2.5 text-xs rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark focus:outline-none focus:ring-1 focus:ring-brand-500/40 cursor-pointer';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title={isRTL ? 'فلتر عام (شخص/تيم/مانجر)' : 'Global filter (person/team/manager)'}
        aria-label={isRTL ? 'فلتر عام' : 'Global filter'}
        aria-expanded={open}
        className={`relative p-2 rounded-lg border-none cursor-pointer bg-transparent ${isFiltered ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'}`}
      >
        <Filter size={18} />
        {isFiltered && <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-brand-500" />}
      </button>

      {open && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed top-[calc(4rem+var(--safe-top))] inset-x-2 w-auto sm:absolute sm:top-full sm:mt-1 sm:end-0 sm:inset-x-auto sm:w-[260px] max-h-[80vh] overflow-y-auto z-[100] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg dark:shadow-2xl p-3 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${isFiltered ? 'text-brand-500' : 'text-content dark:text-content-dark'}`}>
              <Filter size={13} /> {isRTL ? 'فلتر عام' : 'Global filter'}
            </span>
            {isFiltered && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/15 border-none rounded-md px-2 py-1 cursor-pointer transition-colors">
                <X size={11} /> {isRTL ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>

          {/* Department selector removed — the system is a single-department
              (Sales) CRM, so filtering by department is no longer meaningful.
              `department` stays 'all' in the context. */}

          {managers.length > 0 && (
            <Field label={isRTL ? 'المدير' : 'Manager'}>
              <select value={managerId} onChange={e => { setManagerId(e.target.value); setTeamId('all'); setAgentName('all'); }} className={selectClass} dir={isRTL ? 'rtl' : 'ltr'}>
                <option value="all">{isRTL ? 'كل المديرين' : 'All Managers'}</option>
                {managers.map(m => <option key={m.id} value={m.id}>{isRTL ? (m.full_name_ar || m.full_name_en) : (m.full_name_en || m.full_name_ar)}</option>)}
              </select>
            </Field>
          )}

          <Field label={isRTL ? 'الفريق' : 'Team'}>
            <select value={teamId} onChange={e => { setTeamId(e.target.value); setAgentName('all'); }} className={selectClass} dir={isRTL ? 'rtl' : 'ltr'}>
              <option value="all">{isRTL ? 'كل الفرق' : 'All Teams'}</option>
              {visibleTeams.map(t => <option key={t} value={t}>{isRTL ? (teamsMap[t]?.name_ar || t) : (teamsMap[t]?.name_en || t)}</option>)}
            </select>
          </Field>

          <Field label={isRTL ? 'الموظف' : 'Agent'}>
            <select value={agentName} onChange={e => setAgentName(e.target.value)} className={selectClass} dir={isRTL ? 'rtl' : 'ltr'}>
              <option value="all">{isRTL ? 'كل الموظفين' : 'All Agents'}</option>
              {filteredAgents.map(a => {
                const n = isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar);
                return <option key={a.id} value={n}>{n}</option>;
              })}
            </select>
          </Field>

          <Field label={isRTL ? 'الفترة' : 'Period'}>
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
          </Field>

          {period === 'custom' && (
            <div className="flex gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={selectClass} />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={selectClass} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
