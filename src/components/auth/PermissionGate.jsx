import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export function PermissionGate({ permission, fallback = null, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return fallback;
  return children;
}

export function ProtectedRoute({ permission, children }) {
  const { isAuthenticated, hasPermission, hasAnyPermission, loading, permissions } = useAuth();
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

  // If permissions haven't loaded yet, show loading instead of Access Denied
  if (permission && (!permissions || permissions.length === 0)) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4 bg-surface-bg dark:bg-surface-bg-dark">
        <div className="w-10 h-10 border-[3px] border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4 bg-surface-bg dark:bg-surface-bg-dark">
        <div className="text-4xl">🔒</div>
        <p className="text-content dark:text-content-dark text-lg font-bold m-0">Access Denied</p>
        <p className="text-content-muted dark:text-content-muted-dark text-sm m-0">You don't have permission to access this page.</p>
      </div>
    );
  }

  return children;
}
