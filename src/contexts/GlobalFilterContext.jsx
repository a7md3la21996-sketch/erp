import { createContext, useContext, useState, useMemo } from 'react';

const GlobalFilterContext = createContext(null);

function getDateRange(period) {
  const now = new Date();
  const start = new Date();
  switch (period) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case 'yesterday': start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); break;
    case 'this_week': start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0); break;
    case 'this_month': start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case 'last_7': start.setDate(start.getDate() - 7); break;
    case 'last_30': start.setDate(start.getDate() - 30); break;
    case 'all': return null;
    default: return null;
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

export function GlobalFilterProvider({ children }) {
  const [department, setDepartment] = useState('all');
  const [teamId, setTeamId] = useState('all');
  const [agentName, setAgentName] = useState('all');
  const [period, setPeriod] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    if (period === 'custom' && customFrom) {
      return { start: new Date(customFrom).toISOString(), end: customTo ? new Date(customTo + 'T23:59:59').toISOString() : new Date().toISOString() };
    }
    return getDateRange(period);
  }, [period, customFrom, customTo]);

  return (
    <GlobalFilterContext.Provider value={{
      department, setDepartment,
      teamId, setTeamId,
      agentName, setAgentName,
      period, setPeriod,
      customFrom, setCustomFrom,
      customTo, setCustomTo,
      dateRange,
      isFiltered: department !== 'all' || teamId !== 'all' || agentName !== 'all' || period !== 'all',
      clearFilters: () => { setDepartment('all'); setTeamId('all'); setAgentName('all'); setPeriod('all'); setCustomFrom(''); setCustomTo(''); },
    }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  return useContext(GlobalFilterContext);
}
