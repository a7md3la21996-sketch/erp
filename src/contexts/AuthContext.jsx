import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ROLE_PERMISSIONS } from '../config/roles';

const AuthContext = createContext(null);

// ── Mock users ────────────────────────────────────────────────────────────
const MOCK_USERS = {
  'admin@platform.com':     { password: 'admin123', role: 'admin',          full_name_ar: 'مدير النظام',    full_name_en: 'Admin' },
  'director@platform.com':  { password: 'pass123',  role: 'sales_director', full_name_ar: 'مدير المبيعات', full_name_en: 'Sales Director' },
  'manager@platform.com':   { password: 'pass123',  role: 'sales_manager',  full_name_ar: 'سيلز مانجر',    full_name_en: 'Sales Manager' },
  'leader@platform.com':    { password: 'pass123',  role: 'team_leader',    full_name_ar: 'تيم ليدر',      full_name_en: 'Team Leader' },
  'sales@platform.com':     { password: 'pass123',  role: 'sales_agent',    full_name_ar: 'سيلز',          full_name_en: 'Sales Agent' },
  'marketing@platform.com': { password: 'pass123',  role: 'marketing',      full_name_ar: 'تسويق',         full_name_en: 'Marketing' },
};

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('platform_mock_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser({ id: u.email, email: u.email });
        setProfile(u);
        setPermissions(ROLE_PERMISSIONS[u.role] || []);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
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
    return profileData;
  };

  const logout = () => {
    localStorage.removeItem('platform_mock_user');
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
      user, profile, permissions, loading,
      login, logout,
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
