import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ROLE_PERMISSIONS, mergePermissions } from '../config/roles';
import { logSession, endSession, updateSessionActivity } from '../services/sessionService';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// ── Flag: use Supabase Auth when env var is set ─────────────────────────────
const USE_SUPABASE_AUTH = !!import.meta.env.VITE_SUPABASE_URL;

// ── Mock users (DEV ONLY — disabled in production builds) ───────────────────
const MOCK_USERS = import.meta.env.DEV ? {
  'admin@platform.com':     { password: 'admin123', role: 'admin',          full_name_ar: 'مدير النظام',    full_name_en: 'Admin' },
  'director@platform.com':  { password: 'pass123',  role: 'sales_director', full_name_ar: 'مدير المبيعات', full_name_en: 'Sales Director' },
  'manager@platform.com':   { password: 'pass123',  role: 'sales_manager',  full_name_ar: 'سيلز مانجر',    full_name_en: 'Sales Manager' },
  'leader@platform.com':    { password: 'pass123',  role: 'team_leader',    full_name_ar: 'تيم ليدر',      full_name_en: 'Team Leader' },
  'sales@platform.com':     { password: 'pass123',  role: 'sales_agent',    full_name_ar: 'سيلز',          full_name_en: 'Sales Agent' },
  'marketing@platform.com': { password: 'pass123',  role: 'marketing',      full_name_ar: 'تسويق',         full_name_en: 'Marketing' },
} : {}; // Empty in production — mock auth completely disabled

// ── Helper: fetch profile from Supabase users table ─────────────────────────
async function fetchSupabaseProfile(userId, authUser = null) {
  // Try DB query first (with timeout to avoid RLS deadlock)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .abortSignal(controller.signal);
    clearTimeout(timeout);
    if (!error && data) {
      return {
        id: data.id,
        email: data.email,
        role: data.role,
        department: data.department,
        team_id: data.team_id,
        full_name_ar: data.full_name_ar,
        full_name_en: data.full_name_en,
        status: data.status,
        is_active: data.is_active,
      };
    }
  } catch { /* DB query failed or timed out — fall through */ }

  // Fallback: use auth user_metadata (always available, no RLS issues)
  if (authUser?.user_metadata) {
    const meta = authUser.user_metadata;
    return {
      id: userId,
      email: authUser.email,
      role: meta.role || 'sales_agent',
      department: meta.department || 'sales',
      full_name_ar: meta.full_name || authUser.email,
      full_name_en: meta.full_name || authUser.email,
    };
  }

  // Last resort: get from auth API
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser) {
    const meta = currentUser.user_metadata || {};
    return {
      id: userId,
      email: currentUser.email,
      role: meta.role || 'sales_agent',
      department: meta.department || 'sales',
      full_name_ar: meta.full_name || currentUser.email,
      full_name_en: meta.full_name || currentUser.email,
    };
  }

  throw new Error('Profile not found');
}

// Cache for permission overrides (loaded once per session)
let _permissionOverrides = null;
async function loadPermissionOverrides() {
  if (_permissionOverrides !== null) return _permissionOverrides;
  try {
    const { data } = await supabase.from('system_config').select('value').eq('key', 'role_permissions_overrides').maybeSingle();
    _permissionOverrides = data?.value || {};
  } catch { _permissionOverrides = {}; }
  return _permissionOverrides;
}
// Force reload (called when admin saves new permissions)
export async function reloadPermissionOverrides() { _permissionOverrides = null; return loadPermissionOverrides(); }

async function getEffectivePermissions(role) {
  const overrides = await loadPermissionOverrides();
  return mergePermissions(role, overrides);
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalProfile, setOriginalProfile] = useState(null);

  // ── Initialise session on mount ───────────────────────────────────────────
  useEffect(() => {
    // Always check localStorage first for immediate session restore
    const restoreMockSession = () => {
      const saved = localStorage.getItem('platform_mock_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          setUser({ id: u.id || u.email, email: u.email });
          setProfile(u);
          getEffectivePermissions(u.role).then(p => setPermissions(p));
          return true;
        } catch {}
      }
      return false;
    };

    if (USE_SUPABASE_AUTH) {
      // Production: ONLY use Supabase auth — never restore mock sessions
      let isMounted = true;

      const initSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            try {
              const profileData = await fetchSupabaseProfile(session.user.id, session.user);
              setUser({ id: session.user.id, email: session.user.email });
              setProfile(profileData);
              getEffectivePermissions(profileData.role).then(p => setPermissions(p));
            } catch (profileErr) {
              console.error('[Auth] Profile fetch failed:', profileErr.message);
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
              setPermissions([]);
            }
          }
        } catch (err) {
          console.error('[Auth] Session check failed:', err.message);
        }
        if (isMounted) setLoading(false);
      };

      initSession();

      // Safety timeout: if auth takes more than 8 seconds, stop loading
      // This prevents infinite loading when token refresh fails silently
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          setLoading(false);
          console.warn('[Auth] Safety timeout — forcing loading to false');
        }
      }, 8000);

      // Listen for auth state changes (sign-out and token refresh only)
      // SIGNED_IN is handled by the login() function directly to avoid race conditions
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMounted) return;

          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
            setProfile(null);
            setPermissions([]);
            setIsImpersonating(false);
            setOriginalProfile(null);
            localStorage.removeItem('platform_mock_user');
            setLoading(false);
            return;
          }

          // TOKEN_REFRESHED: update session silently
          if (event === 'TOKEN_REFRESHED' && session?.user) {
            // Session refreshed — profile is already loaded, no need to re-fetch
            return;
          }

          // INITIAL_SESSION: handled by initSession() above
          if (event === 'INITIAL_SESSION') return;
        }
      );

      return () => {
        isMounted = false;
        clearTimeout(safetyTimeout);
        subscription.unsubscribe();
      };
    } else {
      // Mock mode: restore from localStorage
      restoreMockSession();
      setLoading(false);
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const loginWithMock = (email, password) => {
    const mockUser = MOCK_USERS[email.toLowerCase().trim()];
    if (!mockUser || mockUser.password !== password) {
      const lang = localStorage.getItem('i18nextLng') || 'ar';
      throw new Error(lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid email or password');
    }
    const profileData = {
      id: email,
      email,
      role: mockUser.role,
      full_name_ar: mockUser.full_name_ar,
      full_name_en: mockUser.full_name_en,
    };
    setUser({ id: email, email });
    setProfile(profileData);
    getEffectivePermissions(mockUser.role).then(p => setPermissions(p));
    localStorage.setItem('platform_mock_user', JSON.stringify(profileData));
    logSession(profileData);
    return profileData;
  };

  const login = async (email, password) => {
    // Try Supabase Auth first, fallback to mock
    if (USE_SUPABASE_AUTH) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });
        if (error) throw error;
        const profileData = await fetchSupabaseProfile(data.user.id, data.user);

        // Check if user is deactivated
        if (profileData.status === 'inactive' || profileData.is_active === false) {
          await supabase.auth.signOut();
          throw new Error('تم تعطيل حسابك. تواصل مع المدير.');
        }

        setUser({ id: data.user.id, email: data.user.email });
        setProfile(profileData);
        getEffectivePermissions(profileData.role).then(p => setPermissions(p));
        logSession(profileData);
        return profileData;
      } catch (err) {
        // In production with Supabase configured, never fall back to mock auth
        throw err;
      }
    }
    return loginWithMock(email, password);
  };

  // ── Register (admin creates new users) ────────────────────────────────────
  const register = async (email, password, profileData) => {
    if (!USE_SUPABASE_AUTH) {
      throw new Error('Registration is only available with Supabase Auth');
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // Insert profile into users table
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      email,
      ...profileData,
    });
    if (insertError) throw insertError;
  };

  // ── Update session activity every 2 minutes ──────────────────────────────
  const activityInterval = useRef(null);
  useEffect(() => {
    if (user) {
      activityInterval.current = setInterval(updateSessionActivity, 120000);
      return () => clearInterval(activityInterval.current);
    }
  }, [user]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    endSession();
    clearInterval(activityInterval.current);

    if (USE_SUPABASE_AUTH) {
      await supabase.auth.signOut();
      // State is cleared by onAuthStateChange listener
    }

    // Always clear local state & storage (covers both modes)
    localStorage.removeItem('platform_mock_user');
    localStorage.removeItem('platform_original_user');
    setUser(null);
    setProfile(null);
    setPermissions([]);
    setIsImpersonating(false);
    setOriginalProfile(null);
  };

  // ── Impersonate (mock mode only) ──────────────────────────────────────────
  const impersonate = (role) => {
    if (!profile) return;
    // Save original admin profile if not already impersonating
    if (!isImpersonating) {
      localStorage.setItem('platform_original_user', JSON.stringify(profile));
      setOriginalProfile(profile);
    }
    // Find mock user with this role
    const entry = Object.entries(MOCK_USERS).find(([, u]) => u.role === role);
    if (!entry) return;
    const [email, mockUser] = entry;
    const impProfile = {
      id: email,
      email,
      role: mockUser.role,
      full_name_ar: mockUser.full_name_ar,
      full_name_en: mockUser.full_name_en,
    };
    setUser({ id: email, email });
    setProfile(impProfile);
    getEffectivePermissions(mockUser.role).then(p => setPermissions(p));
    setIsImpersonating(true);
    localStorage.setItem('platform_mock_user', JSON.stringify(impProfile));
  };

  const stopImpersonating = () => {
    const orig = originalProfile || JSON.parse(localStorage.getItem('platform_original_user') || 'null');
    if (!orig) return;
    setUser({ id: orig.email, email: orig.email });
    setProfile(orig);
    getEffectivePermissions(orig.role).then(p => setPermissions(p));
    setIsImpersonating(false);
    setOriginalProfile(null);
    localStorage.setItem('platform_mock_user', JSON.stringify(orig));
    localStorage.removeItem('platform_original_user');
  };

  // ── Permission helpers ────────────────────────────────────────────────────
  const hasPermission = useCallback((p) => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return permissions.includes(p);
  }, [profile, permissions]);

  const hasAnyPermission = useCallback((ps) => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return ps.some(p => permissions.includes(p));
  }, [profile, permissions]);

  return (
    <AuthContext.Provider value={{
      user, profile, permissions, loading,
      login, logout, register,
      hasPermission, hasAnyPermission,
      isAuthenticated: !!user && !!profile,
      isAdmin: profile?.role === 'admin',
      impersonate, stopImpersonating, isImpersonating, originalProfile,
      isRealAdmin: isImpersonating ? originalProfile?.role === 'admin' : profile?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
