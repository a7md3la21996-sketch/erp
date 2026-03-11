import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

const ToastContext = createContext(null);

let _toastId = 0;

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
  loading: Loader2,
};

const COLORS = {
  success: { border: 'rgba(74,122,171,0.4)', icon: '#4A7AAB' },
  error:   { border: 'rgba(239,68,68,0.4)',  icon: '#EF4444' },
  warning: { border: 'rgba(107,141,181,0.4)',icon: '#6B8DB5' },
  info:    { border: 'rgba(74,122,171,0.35)',icon: '#8BA8C8' },
  loading: { border: 'rgba(74,122,171,0.35)',icon: '#4A7AAB' },
};

function ToastItem({ toast, onRemove }) {
  const Icon = ICONS[toast.type] || Info;
  const colors = COLORS[toast.type] || COLORS.info;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 bg-surface-card dark:bg-surface-card-dark rounded-[10px] min-w-[280px] max-w-[380px] shadow-lg dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
      style={{ border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.icon}`, direction: 'rtl' }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${colors.icon}18` }}
      >
        <Icon size={16} color={colors.icon}
          className={toast.type === 'loading' ? 'animate-spin' : ''} />
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="m-0 mb-0.5 text-[13px] font-semibold text-content dark:text-content-dark">{toast.title}</p>
        )}
        <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark leading-snug">{toast.message}</p>
      </div>
      {toast.type !== 'loading' && (
        <button onClick={() => onRemove(toast.id)}
          className="bg-transparent border-none cursor-pointer p-1 rounded text-gray-400 dark:text-gray-500 shrink-0 flex">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback(({ type = 'info', message, title, duration }) => {
    const id = ++_toastId;
    const autoDismiss = type !== 'loading' ? (duration ?? 3500) : 0;
    setToasts(prev => [...prev.slice(-4), { id, type, message, title }]);
    if (autoDismiss > 0) setTimeout(() => remove(id), autoDismiss);
    return id;
  }, [remove]);

  const dismiss  = useCallback((id) => remove(id), [remove]);
  const success  = useCallback((message, title) => show({ type: 'success', message, title }), [show]);
  const error    = useCallback((message, title) => show({ type: 'error',   message, title }), [show]);
  const warning  = useCallback((message, title) => show({ type: 'warning', message, title }), [show]);
  const info     = useCallback((message, title) => show({ type: 'info',    message, title }), [show]);
  const loading  = useCallback((message, title) => show({ type: 'loading', message, title }), [show]);

  return (
    <ToastContext.Provider value={{ show, dismiss, success, error, warning, info, loading }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
