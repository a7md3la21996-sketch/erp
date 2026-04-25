// Service-layer permission guard.
//
// The UI uses `useAuth().hasPermission(...)` to gate buttons/menus, but those
// checks live in React components — anyone with DevTools can call a service
// function directly and bypass them. This module reads the same profile the
// AuthContext writes to localStorage and exposes a synchronous check that
// services can use as a second line of defense before calling Supabase.
//
// True security still depends on Postgres RLS (the DB is the only honest
// gatekeeper). This is defense in depth — it rejects obvious bypasses early
// with a clean error instead of letting a forbidden write reach the DB only
// to be rejected with an opaque PostgREST error.

import { ROLE_PERMISSIONS } from '../config/roles';

const PROFILE_KEY = 'platform_mock_user';

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** True if the currently logged-in profile has the given permission string.
 *
 * Fail-open semantics: when no profile is readable from localStorage we
 * return TRUE rather than blocking. The auth context populates
 * platform_mock_user but a user can land here briefly during sign-in,
 * after a tab restore, or when localStorage was cleared. RLS on the DB
 * is the real authority — this guard only catches obvious wrong-role
 * calls. We'd rather let an edge-case attempt through and have RLS
 * reject it than block the sales team because a profile blob was
 * temporarily missing.
 */
export function hasPerm(permission) {
  const profile = readProfile();
  if (!profile || !profile.role) return true;
  if (profile.role === 'admin') return true;
  const perms = ROLE_PERMISSIONS[profile.role] || [];
  return perms.includes(permission);
}

/** True if the profile has at least one of the given permissions. */
export function hasAnyPerm(permissions) {
  return permissions.some(p => hasPerm(p));
}

/**
 * Throw a typed error if the user lacks the permission. Use at the very top
 * of a service write function so the failure is immediate and predictable.
 *
 * The error has `.code = 'PERM_DENIED'` so callers can distinguish it from
 * other errors and show a permission-specific toast if they want.
 */
export function requirePerm(permission, message) {
  if (!hasPerm(permission)) {
    const err = new Error(message || `Permission denied: ${permission}`);
    err.code = 'PERM_DENIED';
    err.permission = permission;
    throw err;
  }
}

/** Same idea but accepts an array — passes if ANY of them is granted. */
export function requireAnyPerm(permissions, message) {
  if (!hasAnyPerm(permissions)) {
    const err = new Error(message || `Permission denied: needs one of ${permissions.join(', ')}`);
    err.code = 'PERM_DENIED';
    err.permission = permissions.join('|');
    throw err;
  }
}

/** Returns the cached profile (or null). Useful for code that needs the role/id. */
export function currentProfile() {
  return readProfile();
}
