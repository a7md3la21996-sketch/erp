import { createContext, useContext, useState } from 'react';

const GlobalFilterContext = createContext(null);

export function GlobalFilterProvider({ children }) {
  const [department, setDepartment] = useState('all');
  const [teamId, setTeamId] = useState('all');
  const [agentName, setAgentName] = useState('all');

  return (
    <GlobalFilterContext.Provider value={{
      department, setDepartment,
      teamId, setTeamId,
      agentName, setAgentName,
      isFiltered: department !== 'all' || teamId !== 'all' || agentName !== 'all',
      clearFilters: () => { setDepartment('all'); setTeamId('all'); setAgentName('all'); },
    }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  return useContext(GlobalFilterContext);
}
