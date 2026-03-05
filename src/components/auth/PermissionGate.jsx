import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export function PermissionGate({ permission, fallback = null, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return fallback;
  return children;
}

export function ProtectedRoute({ permission, children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16,
        background: '#0F1E2D',
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid rgba(74,122,171,0.3)',
          borderTop: '3px solid #4A7AAB', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#8BA8C8', fontSize: 14, margin: 0 }}>جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
