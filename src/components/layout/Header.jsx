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
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowProfile(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role]?.[i18n.language] || profile.role) : '';
  const handleLangToggle = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang).then(() => { window.location.reload(); });
  };
  const iconBtn = { padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: isDark ? '#8BA8C8' : '#6b7280' };

  return (
    <header style={{ height: 64, background: isDark ? '#1a2234' : '#ffffff', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 400 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input type="text" placeholder={t('common.search')} style={{ width: '100%', height: 40, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, padding: isRTL ? '0 40px 0 16px' : '0 16px 0 40px', fontSize: 14, outline: 'none', background: isDark ? '#0F1E2D' : '#F8FAFC', color: isDark ? '#E2EAF4' : '#1f2937' }} />
          <Search size={18} style={{ position: 'absolute', top: 11, [isRTL ? 'right' : 'left']: 12, color: isDark ? '#8BA8C8' : '#9ca3af', pointerEvents: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={handleLangToggle} style={{ ...iconBtn, display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
          <Globe size={18} />{i18n.language === 'ar' ? 'EN' : 'عربي'}
        </button>
        <button onClick={toggleTheme} style={iconBtn}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button style={{ ...iconBtn, position: 'relative' }}>
          <Bell size={18} />
          <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, background: '#EF4444', borderRadius: '50%' }} />
        </button>
        <div style={{ width: 1, height: 24, margin: '0 4px', background: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb' }} />
        <div ref={ref} style={{ position: 'relative' }}>
          <button onClick={() => setShowProfile(!showProfile)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#1B3347,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={16} color="#fff" />
            </div>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#E2EAF4' : '#1f2937' }}>{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
              <div style={{ fontSize: 11, color: isDark ? '#8BA8C8' : '#9ca3af' }}>{roleLabel}</div>
            </div>
          </button>
          {showProfile && (
            <div style={{ position: 'absolute', top: '100%', marginTop: 8, [isRTL ? 'left' : 'right']: 0, width: 220, borderRadius: 12, background: isDark ? '#1a2234' : '#ffffff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.1)', padding: '8px 0', zIndex: 100 }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f3f4f6'}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#E2EAF4' : '#1f2937' }}>{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
                <div style={{ fontSize: 12, color: isDark ? '#8BA8C8' : '#9ca3af', marginTop: 2 }}>{profile?.email}</div>
              </div>
              <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 14 }}>
                <LogOut size={16} />{t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
