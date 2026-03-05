import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabase';
import { ROLE_PERMISSIONS } from '../config/roles';

const AuthContext = createContext(null);

// ── Mock users for development (no Supabase needed) ──────────────────────
const MOCK_USERS = {
  'admin@platform.com':    { password: 'admin123',   role: 'admin',          full_name_ar: 'مدير النظام',    full_name_en: 'Admin' },
  'director@platform.com': { password: 'pass123',    role: 'sales_director', full_name_ar: 'مدير المبيعات', full_name_en: 'Sales Director' },
  'manager@platform.com':  { password: 'pass123',    role: 'sales_manager',  full_name_ar: 'سيلز مانجر',    full_name_en: 'Sales Manager' },
  'leader@platform.com':   { password: 'pass123',    role: 'team_leader',    full_name_ar: 'تيم ليدر',      full_name_en: 'Team Leader' },
  'sales@platform.com':    { password: 'pass123',    role: 'sales_agent',    full_name_ar: 'سيلز',          full_name_en: 'Sales Agent' },
  'marketing@platform.com':{ password: 'pass123',    role: 'marketing',      full_name_ar: 'تسويق',         full_name_en: 'Marketing' },
};

const isSupabaseConnected = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url && !url.includes('placeholder');
};

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
      setPermissions(ROLE_PERMISSIONS[data.role] || []);
    } catch {
      setProfile({ role: 'admin', full_name_ar: 'مدير النظام', full_name_en: 'Admin' });
      setPermissions(ROLE_PERMISSIONS['admin'] || []);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // ── Mock mode (no Supabase) ──────────────────────────────────────
      if (!isSupabaseConnected()) {
        const saved = localStorage.getItem('platform_mock_user');
        if (saved) {
          const u = JSON.parse(saved);
          setUser({ id: u.email, email: u.email });
          setProfile(u);
          setPermissions(ROLE_PERMISSIONS[u.role] || []);
        }
        if (mounted) setLoading(false);
        return;
      }

      // ── Real Supabase mode ───────────────────────────────────────────
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    if (!isSupabaseConnected()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        if (mounted) setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setPermissions([]);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (email, password) => {
    // ── Mock login ───────────────────────────────────────────────────────
    if (!isSupabaseConnected()) {
      const mockUser = MOCK_USERS[email];
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
      return profileData;
    }

    // ── Real Supabase login ──────────────────────────────────────────────
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    localStorage.removeItem('platform_mock_user');
    if (isSupabaseConnected()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setPermissions([]);
  };

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
      user, profile, permissions, loading, login, logout,
      hasPermission, hasAnyPermission,
      isAuthenticated: !!user && !!profile,
      isAdmin: profile?.role === 'admin',
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
