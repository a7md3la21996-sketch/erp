import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Eye, EyeOff, Sun, Moon, Globe } from 'lucide-react';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && email && password) handleLogin();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left panel */}
      <div style={{
        flex: '0 0 50%',
        background: 'linear-gradient(135deg, #1B3347, #2B4C6F, #345A80)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }} className="hidden-mobile">
        <div style={{ position: 'absolute', top: 80, left: -80, width: 300, height: 300, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(60px)' }} />
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 36, fontWeight: 'bold', color: '#fff' }}>P</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>{t('app.fullName')}</h1>
          <p style={{ color: '#8BA8C8', fontSize: 16 }}>{t('app.tagline')}</p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#fff', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 8 }}>
          <button onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#6b7280', fontSize: 13 }}>
            <Globe size={16} /> {i18n.language === 'ar' ? 'EN' : 'عربي'}
          </button>
          <button onClick={toggleTheme}
            style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#6b7280' }}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{t('auth.welcomeBack')}</h2>
          <p style={{ color: '#6b7280', margin: '0 0 32px' }}>{t('auth.loginSubtitle')}</p>

          {error && (
            <div style={{ padding: 12, borderRadius: 8, background: theme === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: `1px solid ${theme === 'dark' ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, color: '#dc2626', fontSize: 14, marginBottom: 24 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{t('auth.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="admin@platform.com" dir="ltr"
              style={{ width: '100%', height: 44, padding: '0 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{t('auth.password')}</label>
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="••••••••" dir="ltr"
                style={{ width: '100%', height: 44, padding: '0 44px 0 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', top: 10, [isRTL ? 'left' : 'right']: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button onClick={handleLogin} disabled={loading || !email || !password} style={{
            width: '100%', height: 44, borderRadius: 8, border: 'none',
            cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            background: loading || !email || !password ? '#93B8D4' : '#2B4C6F',
            color: '#fff', fontSize: 14, fontWeight: 600,
          }}>
            {loading ? '...' : t('auth.login')}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 32 }}>© 2026 Platform Real Estate</p>
        </div>
      </div>

      <style>{`.hidden-mobile { display: flex; } @media (max-width: 768px) { .hidden-mobile { display: none !important; } }`}</style>
    </div>
  );
}
