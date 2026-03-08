import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader } from 'lucide-react';

const ToastContext = createContext(null);
let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const showToast = useCallback(({ type = 'info', message, duration = 3500 }) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (type !== 'loading') setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);
  const updateToast = useCallback((id, updates) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (updates.type && updates.type !== 'loading') setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), updates.duration || 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ showToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const CFG = {
  success: { icon: CheckCircle2, color: '#4A7AAB',  bg: 'rgba(74,122,171,0.12)',  border: 'rgba(74,122,171,0.3)'  },
  error:   { icon: XCircle,      color: '#EF4444',  bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)'   },
  warning: { icon: AlertTriangle,color: '#6B8DB5',  bg: 'rgba(107,141,181,0.12)', border: 'rgba(107,141,181,0.3)' },
  info:    { icon: Info,         color: '#8BA8C8',  bg: 'rgba(139,168,200,0.1)',  border: 'rgba(139,168,200,0.3)' },
  loading: { icon: Loader,       color: '#4A7AAB',  bg: 'rgba(74,122,171,0.08)',  border: 'rgba(74,122,171,0.2)'  },
};

function Toast({ toast, onRemove }) {
  const c = CFG[toast.type] || CFG.info;
  const Icon = c.icon;
  const loading = toast.type === 'loading';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, background:'#1a2234', border:`1px solid ${c.border}`, borderRadius:10, padding:'12px 14px', minWidth:260, maxWidth:360, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', animation:'toastIn 0.25s ease', position:'relative', overflow:'hidden' }}>
      {!loading && <div style={{ position:'absolute', bottom:0, left:0, height:2, background:c.color, opacity:0.5, animation:`toastProg ${toast.duration}ms linear forwards`, width:'100%' }} />}
      <div style={{ width:32, height:32, borderRadius:8, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={16} color={c.color} style={loading ? { animation:'spin 1s linear infinite' } : {}} />
      </div>
      <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#E2EAF4', lineHeight:1.4 }}>{toast.message}</span>
      {!loading && <button onClick={() => onRemove(toast.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#8BA8C8', padding:2, flexShrink:0, display:'flex', alignItems:'center' }}><X size={14} /></button>}
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes toastProg{from{width:100%}to{width:0%}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ position:'fixed', bottom:24, left:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
        {toasts.map(t => <div key={t.id} style={{ pointerEvents:'all' }}><Toast toast={t} onRemove={onRemove} /></div>)}
      </div>
    </>
  );
}
