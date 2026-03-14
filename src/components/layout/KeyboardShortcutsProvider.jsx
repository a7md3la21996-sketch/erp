import { useMemo, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import ShortcutsHelpModal from '../ui/ShortcutsHelpModal';

const KeyboardShortcutsContext = createContext({ showHelp: false, setShowHelp: () => {} });

export function useShortcutsHelp() {
  return useContext(KeyboardShortcutsContext);
}

export default function KeyboardShortcutsProvider({ children }) {
  const navigate = useNavigate();

  const shortcuts = useMemo(() => [
    // Navigation — leader key "g" then second key
    { leader: 'g', key: 'h', action: () => navigate('/dashboard'), desc: 'Go to Dashboard', scope: 'navigation' },
    { leader: 'g', key: 'c', action: () => navigate('/contacts'), desc: 'Go to Contacts', scope: 'navigation' },
    { leader: 'g', key: 'o', action: () => navigate('/crm/opportunities'), desc: 'Go to Opportunities', scope: 'navigation' },
    { leader: 'g', key: 'd', action: () => navigate('/sales/deals'), desc: 'Go to Deals', scope: 'navigation' },
    { leader: 'g', key: 't', action: () => navigate('/tasks'), desc: 'Go to Tasks', scope: 'navigation' },
    { leader: 'g', key: 'r', action: () => navigate('/reports'), desc: 'Go to Reports', scope: 'navigation' },
    { leader: 'g', key: 's', action: () => navigate('/settings/general'), desc: 'Go to Settings', scope: 'navigation' },
    { leader: 'g', key: 'm', action: () => navigate('/chat'), desc: 'Go to Chat', scope: 'navigation' },
  ], [navigate]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts);

  return (
    <KeyboardShortcutsContext.Provider value={{ showHelp, setShowHelp }}>
      {children}
      {showHelp && <ShortcutsHelpModal onClose={() => setShowHelp(false)} />}
    </KeyboardShortcutsContext.Provider>
  );
}
