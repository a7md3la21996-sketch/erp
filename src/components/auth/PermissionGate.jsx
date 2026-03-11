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
      <div className="flex items-center justify-center h-screen flex-col gap-4 bg-surface-bg-dark">
        <div className="w-10 h-10 border-[3px] border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-content-muted-dark text-sm m-0">جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
