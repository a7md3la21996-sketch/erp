/**
 * RBAC Service — Role-Based Access Control
 * localStorage-first with Supabase sync
 */

import supabase from '../lib/supabase';

const ROLES_KEY = 'platform_rbac_roles';
const USER_ROLES_KEY = 'platform_rbac_user_roles';
const SUPABASE_ROLES_TABLE = 'rbac_roles';
const SUPABASE_USER_ROLES_TABLE = 'rbac_user_roles';

/* ─── Modules ─── */
const MODULES = [
  { id: 'contacts', name: 'جهات الاتصال', nameEn: 'Contacts' },
  { id: 'opportunities', name: 'الفرص البيعية', nameEn: 'Opportunities' },
  { id: 'invoices', name: 'الفواتير', nameEn: 'Invoices' },
  { id: 'hr', name: 'الموارد البشرية', nameEn: 'HR' },
  { id: 'finance', name: 'المالية', nameEn: 'Finance' },
  { id: 'operations', name: 'العمليات', nameEn: 'Operations' },
  { id: 'settings', name: 'الإعدادات', nameEn: 'Settings' },
  { id: 'reports', name: 'التقارير', nameEn: 'Reports' },
  { id: 'analytics', name: 'التحليلات', nameEn: 'Analytics' },
];

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import', 'bulk_actions'];

const ACTION_LABELS = {
  view: { ar: 'عرض', en: 'View' },
  create: { ar: 'إنشاء', en: 'Create' },
  edit: { ar: 'تعديل', en: 'Edit' },
  delete: { ar: 'حذف', en: 'Delete' },
  export: { ar: 'تصدير', en: 'Export' },
  import: { ar: 'استيراد', en: 'Import' },
  bulk_actions: { ar: 'إجراءات جماعية', en: 'Bulk Actions' },
};

/* ─── Build full permissions object (all true or all false) ─── */
function buildPermissions(value) {
  const perms = {};
  MODULES.forEach(m => {
    perms[m.id] = {};
    ACTIONS.forEach(a => { perms[m.id][a] = value; });
  });
  return perms;
}

/* ─── Build permissions for specific modules only ─── */
function buildModulePermissions(moduleIds, extras = {}) {
  const perms = buildPermissions(false);
  moduleIds.forEach(id => {
    if (perms[id]) {
      ACTIONS.forEach(a => { perms[id][a] = true; });
    }
  });
  // Apply extras (partial overrides)
  Object.entries(extras).forEach(([mod, acts]) => {
    if (perms[mod]) {
      Object.entries(acts).forEach(([act, val]) => {
        perms[mod][act] = val;
      });
    }
  });
  return perms;
}

/* ─── Default Built-in Roles ─── */
const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'مدير النظام',
    nameEn: 'Admin',
    description: 'صلاحيات كاملة على جميع الأقسام',
    descriptionEn: 'Full access to all modules',
    builtIn: true,
    permissions: buildPermissions(true),
  },
  {
    id: 'manager',
    name: 'مدير',
    nameEn: 'Manager',
    description: 'قراءة وكتابة في معظم الأقسام',
    descriptionEn: 'Read/write access to most modules',
    builtIn: true,
    permissions: buildModulePermissions(
      ['contacts', 'opportunities', 'invoices', 'hr', 'finance', 'operations', 'reports', 'analytics'],
      { settings: { view: true, create: false, edit: false, delete: false, export: false, import: false, bulk_actions: false } }
    ),
  },
  {
    id: 'sales',
    name: 'مبيعات',
    nameEn: 'Sales',
    description: 'صلاحيات إدارة العملاء والمبيعات فقط',
    descriptionEn: 'CRM modules only',
    builtIn: true,
    permissions: buildModulePermissions(
      ['contacts', 'opportunities', 'invoices'],
      { reports: { view: true, create: false, edit: false, delete: false, export: true, import: false, bulk_actions: false } }
    ),
  },
  {
    id: 'hr',
    name: 'موارد بشرية',
    nameEn: 'HR',
    description: 'صلاحيات الموارد البشرية فقط',
    descriptionEn: 'HR module only',
    builtIn: true,
    permissions: buildModulePermissions(
      ['hr'],
      { reports: { view: true, create: false, edit: false, delete: false, export: true, import: false, bulk_actions: false } }
    ),
  },
  {
    id: 'finance',
    name: 'مالية',
    nameEn: 'Finance',
    description: 'صلاحيات المالية فقط',
    descriptionEn: 'Finance module only',
    builtIn: true,
    permissions: buildModulePermissions(
      ['finance', 'invoices'],
      { reports: { view: true, create: false, edit: false, delete: false, export: true, import: false, bulk_actions: false } }
    ),
  },
  {
    id: 'viewer',
    name: 'مشاهد فقط',
    nameEn: 'Viewer',
    description: 'عرض فقط بدون تعديل',
    descriptionEn: 'Read-only access',
    builtIn: true,
    permissions: (() => {
      const perms = buildPermissions(false);
      MODULES.forEach(m => { perms[m.id].view = true; });
      return perms;
    })(),
  },
];

/* ─── Storage Helpers ─── */
function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      // Trim oldest custom roles if quota exceeded
      if (key === ROLES_KEY && Array.isArray(value)) {
        const builtIn = value.filter(r => r.builtIn);
        const custom = value.filter(r => !r.builtIn);
        const trimmed = [...builtIn, ...custom.slice(-20)];
        localStorage.setItem(key, JSON.stringify(trimmed));
      }
    }
  }
}

/* ─── Initialize roles if not present ─── */
function initRoles() {
  const existing = safeGet(ROLES_KEY, null);
  if (!existing) {
    safeSet(ROLES_KEY, DEFAULT_ROLES);
    return DEFAULT_ROLES;
  }
  // Ensure built-in roles exist (merge)
  const ids = existing.map(r => r.id);
  const merged = [...existing];
  DEFAULT_ROLES.forEach(def => {
    if (!ids.includes(def.id)) merged.push(def);
  });
  if (merged.length !== existing.length) safeSet(ROLES_KEY, merged);
  return merged;
}

/* ─── Public API ─── */
export async function getRoles() {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_ROLES_TABLE)
      .select('*')
      .order('id');
    if (!error && data && data.length > 0) {
      // Ensure built-in roles exist
      const ids = data.map(r => r.id);
      const merged = [...data];
      DEFAULT_ROLES.forEach(def => {
        if (!ids.includes(def.id)) merged.push(def);
      });
      safeSet(ROLES_KEY, merged);
      return merged;
    }
  } catch (err) {
    console.warn('Supabase getRoles failed, falling back to localStorage:', err);
  }
  return initRoles();
}

export async function getRole(id) {
  const roles = await getRoles();
  return roles.find(r => r.id === id) || null;
}

export async function createRole({ name, nameEn, permissions, description, descriptionEn }) {
  const roles = await getRoles();
  const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const newRole = {
    id,
    name: name || nameEn,
    nameEn: nameEn || name,
    description: description || '',
    descriptionEn: descriptionEn || '',
    builtIn: false,
    permissions: permissions || buildPermissions(false),
    createdAt: new Date().toISOString(),
  };
  roles.push(newRole);
  safeSet(ROLES_KEY, roles);
  try {
    const { error } = await supabase.from(SUPABASE_ROLES_TABLE).insert(newRole);
    if (error) console.warn('Supabase createRole failed:', error);
  } catch (err) {
    console.warn('Supabase createRole failed:', err);
  }
  return newRole;
}

export async function updateRole(id, updates) {
  const roles = await getRoles();
  const idx = roles.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const role = roles[idx];
  // For built-in roles, only allow updating description, not core permissions
  if (role.builtIn) {
    if (updates.description !== undefined) role.description = updates.description;
    if (updates.descriptionEn !== undefined) role.descriptionEn = updates.descriptionEn;
  } else {
    Object.assign(role, updates, { id: role.id, builtIn: false });
  }
  roles[idx] = role;
  safeSet(ROLES_KEY, roles);
  try {
    const { error } = await supabase.from(SUPABASE_ROLES_TABLE).update(role).eq('id', id);
    if (error) console.warn('Supabase updateRole failed:', error);
  } catch (err) {
    console.warn('Supabase updateRole failed:', err);
  }
  return role;
}

export async function deleteRole(id) {
  const roles = await getRoles();
  const role = roles.find(r => r.id === id);
  if (!role || role.builtIn) return false;
  const filtered = roles.filter(r => r.id !== id);
  safeSet(ROLES_KEY, filtered);
  // Also remove any user assignments for this role
  const userRoles = safeGet(USER_ROLES_KEY, {});
  Object.keys(userRoles).forEach(uid => {
    if (userRoles[uid] === id) userRoles[uid] = 'viewer';
  });
  safeSet(USER_ROLES_KEY, userRoles);
  try {
    await supabase.from(SUPABASE_USER_ROLES_TABLE).update({ role_id: 'viewer' }).eq('role_id', id);
    const { error } = await supabase.from(SUPABASE_ROLES_TABLE).delete().eq('id', id);
    if (error) console.warn('Supabase deleteRole failed:', error);
  } catch (err) {
    console.warn('Supabase deleteRole failed:', err);
  }
  return true;
}

export async function getUserRole(userId) {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_USER_ROLES_TABLE)
      .select('role_id')
      .eq('user_id', userId)
      .single();
    if (!error && data) return data.role_id;
  } catch (err) {
    console.warn('Supabase getUserRole failed, falling back to localStorage:', err);
  }
  const userRoles = safeGet(USER_ROLES_KEY, {});
  return userRoles[userId] || 'admin'; // default to admin for current user
}

export async function setUserRole(userId, roleId) {
  const userRoles = safeGet(USER_ROLES_KEY, {});
  userRoles[userId] = roleId;
  safeSet(USER_ROLES_KEY, userRoles);
  try {
    const { error } = await supabase
      .from(SUPABASE_USER_ROLES_TABLE)
      .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id' });
    if (error) console.warn('Supabase setUserRole failed:', error);
  } catch (err) {
    console.warn('Supabase setUserRole failed:', err);
  }
  return true;
}

export async function hasPermission(userId, module, action) {
  const roleId = await getUserRole(userId);
  const role = await getRole(roleId);
  if (!role) return false;
  if (role.id === 'admin') return true;
  return role.permissions?.[module]?.[action] === true;
}

export function getModules() {
  return MODULES;
}

export function getActions() {
  return ACTIONS;
}

export function getActionLabels() {
  return ACTION_LABELS;
}

export { MODULES, ACTIONS, ACTION_LABELS, DEFAULT_ROLES };
