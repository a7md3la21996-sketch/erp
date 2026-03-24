import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ROLE_PERMISSIONS } from '../config/roles';
import { logSession, endSession, updateSessionActivity } from '../services/sessionService';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// ── Flag: use Supabase Auth when env var is set ─────────────────────────────
const USE_SUPABASE_AUTH = !!import.meta.env.VITE_SUPABASE_URL;

// ── Mock users (fallback for development) ───────────────────────────────────
const MOCK_USERS = {
  'admin@platform.com':     { password: 'admin123', role: 'admin',          full_name_ar: 'مدير النظام',    full_name_en: 'Admin' },
  'director@platform.com':  { password: 'pass123',  role: 'sales_director', full_name_ar: 'مدير المبيعات', full_name_en: 'Sales Director' },
  'manager@platform.com':   { password: 'pass123',  role: 'sales_manager',  full_name_ar: 'سيلز مانجر',    full_name_en: 'Sales Manager' },
  'leader@platform.com':    { password: 'pass123',  role: 'team_leader',    full_name_ar: 'تيم ليدر',      full_name_en: 'Team Leader' },
  'sales@platform.com':     { password: 'pass123',  role: 'sales_agent',    full_name_ar: 'سيلز',          full_name_en: 'Sales Agent' },
  'marketing@platform.com': { password: 'pass123',  role: 'marketing',      full_name_ar: 'تسويق',         full_name_en: 'Marketing' },
};

// ── Helper: fetch profile from Supabase users table ─────────────────────────
async function fetchSupabaseProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    full_name_ar: data.full_name_ar,
    full_name_en: data.full_name_en,
  };
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
    if (USE_SUPABASE_AUTH) {
      // Supabase mode: check existing session then listen for changes
      let isMounted = true;

      const initSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            const profileData = await fetchSupabaseProfile(session.user.id);
            setUser({ id: session.user.id, email: session.user.email });
            setProfile(profileData);
            setPermissions(ROLE_PERMISSIONS[profileData.role] || []);
          }
        } catch (err) {
          console.error('Failed to restore Supabase session:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      initSession();

      // Listen for auth state changes (sign-in, sign-out, token refresh)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMounted) return;

          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
            setProfile(null);
            setPermissions([]);
            setIsImpersonating(false);
            setOriginalProfile(null);
            return;
          }

          if (session?.user) {
            try {
              const profileData = await fetchSupabaseProfile(session.user.id);
              setUser({ id: session.user.id, email: session.user.email });
              setProfile(profileData);
              setPermissions(ROLE_PERMISSIONS[profileData.role] || []);
            } catch (err) {
              console.error('Failed to fetch profile on auth change:', err);
            }
          }
        }
      );

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Mock mode: restore from localStorage
      const saved = localStorage.getItem('platform_mock_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          setUser({ id: u.email, email: u.email });
          setProfile(u);
          setPermissions(ROLE_PERMISSIONS[u.role] || []);
          // Restore impersonation state
          const orig = localStorage.getItem('platform_original_user');
          if (orig) {
            setOriginalProfile(JSON.parse(orig));
            setIsImpersonating(true);
          }
        } catch {}
      }
      setLoading(false);
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const loginWithMock = (email, password) => {
    const mockUser = MOCK_USERS[email.toLowerCase().trim()];
    if (!mockUser || mockUser.password !== password) {
      throw new Error('بيانات الدخول غير صحيحة');
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
    setPermissions(ROLE_PERMISSIONS[mockUser.role] || []);
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
        const profileData = await fetchSupabaseProfile(data.user.id);
        setUser({ id: data.user.id, email: data.user.email });
        setProfile(profileData);
        setPermissions(ROLE_PERMISSIONS[profileData.role] || []);
        logSession(profileData);
        return profileData;
      } catch {
        // Supabase failed - fallback to mock users
        return loginWithMock(email, password);
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
    setPermissions(ROLE_PERMISSIONS[mockUser.role] || []);
    setIsImpersonating(true);
    localStorage.setItem('platform_mock_user', JSON.stringify(impProfile));
  };

  const stopImpersonating = () => {
    const orig = originalProfile || JSON.parse(localStorage.getItem('platform_original_user') || 'null');
    if (!orig) return;
    setUser({ id: orig.email, email: orig.email });
    setProfile(orig);
    setPermissions(ROLE_PERMISSIONS[orig.role] || []);
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
