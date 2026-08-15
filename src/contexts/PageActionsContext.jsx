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
  // Register / refresh this page's actions when the caller's deps change.
  useEffect(() => {
    setActions((actions || []).filter(a => a && !a.hidden));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  // Clear ONLY on unmount. Previously the cleanup lived in the effect above and
  // ran setActions([]) on every deps change — so a caller with an unstable dep
  // ping-ponged actions → [] → actions each render (header flicker, wasted
  // renders). Keeping the clear mount-scoped means a bad dep just re-registers
  // the same actions cheaply instead of thrashing the whole header.
  useEffect(() => () => setActions([]), []); // eslint-disable-line react-hooks/exhaustive-deps
}
