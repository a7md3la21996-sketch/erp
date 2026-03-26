import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import { useGlobalFilter } from '../../contexts/GlobalFilterContext';
import { fetchSalesAgents } from '../../services/opportunitiesService';

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
  const { department, setDepartment, teamId, setTeamId, agentName, setAgentName, isFiltered, clearFilters } = useGlobalFilter();

  const [expanded, setExpanded] = useState(false);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    fetchSalesAgents().then(data => setAgents(data || []));
  }, []);

  const uniqueTeams = useMemo(() => {
    const teams = new Set();
    agents.forEach(a => { if (a.team_id) teams.add(a.team_id); });
    return [...teams].sort();
  }, [agents]);

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (department !== 'all') {
      // Filter agents by role heuristic based on department
      // Since the users table has role field, we keep all for now as agents are sales-focused
    }
    if (teamId !== 'all') {
      list = list.filter(a => a.team_id === teamId);
    }
    return list;
  }, [agents, department, teamId]);

  const selectClass = `
    h-[30px] px-2 text-xs rounded-lg border border-edge dark:border-edge-dark
    bg-surface-card dark:bg-surface-card-dark
    text-content dark:text-content-dark
    focus:outline-none focus:ring-1 focus:ring-brand-500/40
    appearance-none cursor-pointer
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
      className={`flex items-center gap-3 px-4 md:px-7 py-2 bg-surface-card/60 dark:bg-surface-card-dark/60 border-b border-edge/50 dark:border-edge-dark/50 backdrop-blur-sm ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Filter icon */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Filter size={13} className={isFiltered ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'} />
        <span className={`text-xs font-medium ${isFiltered ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
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

      {/* Team */}
      <select
        value={teamId}
        onChange={e => { setTeamId(e.target.value); setAgentName('all'); }}
        className={selectClass}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <option value="all">{isRTL ? 'كل الفرق' : 'All Teams'}</option>
        {uniqueTeams.map(t => (
          <option key={t} value={t}>{t}</option>
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
