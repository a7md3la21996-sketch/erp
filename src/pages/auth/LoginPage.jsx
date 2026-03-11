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

  const disabled = loading || !email || !password;

  return (
    <div className="min-h-screen flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left panel */}
      <div className="hidden md:flex flex-[0_0_50%] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 items-center justify-center relative overflow-hidden">
        <div className="absolute top-20 -left-20 w-[300px] h-[300px] bg-white/5 rounded-full blur-[60px]" />
        <div className="text-center z-[1]">
          <div className="w-20 h-20 rounded-[20px] bg-white/15 flex items-center justify-center mx-auto mb-6 text-4xl font-bold text-white">P</div>
          <h1 className="text-white text-[28px] font-bold m-0 mb-2">{t('app.fullName')}</h1>
          <p className="text-brand-300 text-base">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-surface-bg-dark relative">
        <div className="absolute top-6 right-6 flex gap-2">
          <button onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1 py-2 px-3 rounded-lg border-none cursor-pointer bg-gray-100 dark:bg-brand-900/30 text-gray-500 dark:text-content-muted-dark text-[13px]">
            <Globe size={16} /> {i18n.language === 'ar' ? 'EN' : 'عربي'}
          </button>
          <button onClick={toggleTheme}
            className="p-2 rounded-lg border-none cursor-pointer bg-gray-100 dark:bg-brand-900/30 text-gray-500 dark:text-content-muted-dark">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="w-full max-w-[400px]">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-content-dark m-0 mb-2">{t('auth.welcomeBack')}</h2>
          <p className="text-gray-500 dark:text-content-muted-dark m-0 mb-8">{t('auth.loginSubtitle')}</p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 text-sm mb-6">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-content-dark mb-1.5">{t('auth.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="admin@platform.com" dir="ltr"
              className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-edge-dark bg-white dark:bg-surface-input-dark text-gray-900 dark:text-content-dark text-sm outline-none box-border" />
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-content-dark">{t('auth.password')}</label>
            </div>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="••••••••" dir="ltr"
                className="w-full h-11 pr-11 pl-4 rounded-lg border border-gray-300 dark:border-edge-dark bg-white dark:bg-surface-input-dark text-gray-900 dark:text-content-dark text-sm outline-none box-border" />
              <button onClick={() => setShowPw(!showPw)}
                className={`absolute top-2.5 ${isRTL ? 'left-3' : 'right-3'} bg-transparent border-none cursor-pointer text-gray-400 dark:text-content-muted-dark`}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button onClick={handleLogin} disabled={disabled}
            className={`w-full h-11 rounded-lg border-none text-white text-sm font-semibold ${disabled ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-800 cursor-pointer hover:bg-brand-900'}`}>
            {loading ? '...' : t('auth.login')}
          </button>

          <p className="text-center text-xs text-gray-400 dark:text-content-muted-dark mt-8">&copy; 2026 Platform Real Estate</p>
        </div>
      </div>
    </div>
  );
}
