import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import { useTheme } from './ThemeContext';

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
  success: { bg: 'rgba(74,122,171,0.12)', border: 'rgba(74,122,171,0.4)', icon: '#4A7AAB' },
  error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  icon: '#EF4444' },
  warning: { bg: 'rgba(107,141,181,0.12)',border: 'rgba(107,141,181,0.4)',icon: '#6B8DB5' },
  info:    { bg: 'rgba(74,122,171,0.10)', border: 'rgba(74,122,171,0.35)',icon: '#8BA8C8' },
  loading: { bg: 'rgba(74,122,171,0.10)', border: 'rgba(74,122,171,0.35)',icon: '#4A7AAB' },
};

function ToastItem({ toast, onRemove, isDark }) {
  const Icon = ICONS[toast.type] || Info;
  const colors = COLORS[toast.type] || COLORS.info;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px',
      background: isDark ? '#1a2234' : '#ffffff',
      border: `1px solid ${colors.border}`,
      borderLeft: `3px solid ${colors.icon}`,
      borderRadius: 10,
      boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.10)',
      minWidth: 280, maxWidth: 380,
      direction: 'rtl',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: colors.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={colors.icon}
          style={toast.type === 'loading' ? { animation: 'toastSpin 0.8s linear infinite' } : {}} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: isDark ? '#E2EAF4' : '#111827' }}>{toast.title}</p>
        )}
        <p style={{ margin: 0, fontSize: 13, color: isDark ? '#8BA8C8' : '#6b7280', lineHeight: 1.4 }}>{toast.message}</p>
      </div>
      {toast.type !== 'loading' && (
        <button onClick={() => onRemove(toast.id)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          borderRadius: 4, color: isDark ? '#6b7280' : '#9ca3af', flexShrink: 0, display: 'flex',
        }}>
          <X size={14} />
        </button>
      )}
      <style>{`@keyframes toastSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ToastProvider({ children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
      <div style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column-reverse', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onRemove={remove} isDark={isDark} />
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
