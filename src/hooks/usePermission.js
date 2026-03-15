import { useMemo } from 'react';
import { getUserRole, getRole, hasPermission as checkPermission } from '../services/rbacService';

/**
 * usePermission hook — provides RBAC helpers for the current user
 * Gets current user from localStorage or defaults to admin
 */
export function usePermission() {
  const currentUserId = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('platform_current_user') || '{}');
      return user.id || 'default_admin';
    } catch {
      return 'default_admin';
    }
  }, []);

  const roleId = getUserRole(currentUserId);
  const userRole = getRole(roleId);
  const isAdmin = roleId === 'admin';

  const hasPermissionFn = (module, action) => {
    if (isAdmin) return true;
    return checkPermission(currentUserId, module, action);
  };

  const canView = (module) => hasPermissionFn(module, 'view');
  const canEdit = (module) => hasPermissionFn(module, 'edit');
  const canDelete = (module) => hasPermissionFn(module, 'delete');
  const canExport = (module) => hasPermissionFn(module, 'export');
  const canCreate = (module) => hasPermissionFn(module, 'create');

  return {
    hasPermission: hasPermissionFn,
    userRole,
    isAdmin,
    canView,
    canEdit,
    canDelete,
    canExport,
    canCreate,
    currentUserId,
  };
}

export default usePermission;
