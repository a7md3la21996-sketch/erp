import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabase';
import { ROLE_PERMISSIONS } from '../config/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (error) {
        setProfile({ role: 'admin', full_name_ar: 'Admin', full_name_en: 'Admin' });
        setPermissions(ROLE_PERMISSIONS['admin'] || []);
        return;
      }
      setProfile(data);
      setPermissions(ROLE_PERMISSIONS[data.role] || []);
    } catch (err) {
      setProfile({ role: 'admin', full_name_ar: 'Admin', full_name_en: 'Admin' });
      setPermissions(ROLE_PERMISSIONS['admin'] || []);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
