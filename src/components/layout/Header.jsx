import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { Sun, Moon, Globe, Bell, Search, LogOut, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Header() {
  const { t, i18n } = useTranslation();
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const ref = useRef(null);
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowProfile(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role]?.[i18n.language] || profile.role) : '';

  return (
    <header style={{
      height: 64, background: '#fff', borderBottom: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 400 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input type="text" placeholder={t('common.search')} style={{
            width: '100%', height: 40, borderRadius: 8, border: '1px solid #e5e7eb',
            padding: isRTL ? '0 40px 0 16px' : '0 16px 0 40px', fontSize: 14, outline: 'none',
          }} />
          <Search size={18} style={{ position: 'absolute', top: 11, [isRTL ? 'right' : 'left']: 12, color: '#9ca3af' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#6b7280', fontSize: 13 }}>
          <Globe size={18} /> {i18n.language === 'ar' ? 'EN' : 'عربي'}
        </button>
        <button onClick={toggleTheme} style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#6b7280' }}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button style={{ position: 'relative', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#6b7280' }}>
          <Bell size={18} />
          <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />
        </button>

        <div ref={ref} style={{ position: 'relative' }}>
          <button onClick={() => setShowProfile(!showProfile)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} style={{ color: '#2B4C6F' }} />
            </div>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{roleLabel}</div>
            </div>
          </button>

          {showProfile && (
            <div style={{
              position: 'absolute', top: '100%', marginTop: 8, [isRTL ? 'left' : 'right']: 0,
              width: 220, borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '8px 0', zIndex: 50,
            }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{profile?.email}</div>
              </div>
              <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: 14 }}>
                <LogOut size={16} /> {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
