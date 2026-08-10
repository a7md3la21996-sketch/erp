import { createContext, useContext, useState, useEffect } from 'react';

// Lets each page declare the action buttons that should appear in the top
// Header (replacing the old global filter bar). A page calls usePageActions([...])
// and the Header renders them; they clear automatically when the page unmounts.
//
// Action shape: { id, icon (lucide component), labelAr, labelEn, onClick, primary?, hidden? }
const PageActionsContext = createContext({ actions: [], setActions: () => {} });

export function PageActionsProvider({ children }) {
  const [actions, setActions] = useState([]);
  return (
    <PageActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </PageActionsContext.Provider>
  );
}

export function useHeaderActions() {
  return useContext(PageActionsContext).actions;
}

// Register this page's header actions. Pass a deps array so the actions refresh
// when the handlers/labels they close over change. Cleared on unmount.
export function usePageActions(actions, deps = []) {
  const { setActions } = useContext(PageActionsContext);
  useEffect(() => {
    setActions((actions || []).filter(a => a && !a.hidden));
    return () => setActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
