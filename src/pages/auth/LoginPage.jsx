import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Sun, Moon, Globe } from 'lucide-react';
import { Button, Input } from '../../components/ui';

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
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
          <img src="/logo-white.webp" alt="Platform ERP" className="w-auto h-16 mx-auto mb-6 object-contain" />
          <h1 className="text-white text-[28px] font-bold m-0 mb-2">{t('app.fullName')}</h1>
          <p className="text-brand-300 text-base">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-surface-bg-dark relative">
        <div className="absolute top-6 end-6 flex gap-2">
          <button onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1 py-2 px-3 rounded-lg border-none cursor-pointer bg-gray-100 dark:bg-brand-900/30 text-gray-500 dark:text-content-muted-dark text-xs">
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

          <form onSubmit={(e) => { e.preventDefault(); if (!disabled) handleLogin(); }} autoComplete="on">
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-content-dark mb-1.5">{t('auth.email')}</label>
              <Input type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@platform.com" dir="ltr" className="!h-11" />
            </div>

            <div className="mb-2">
              <div className="flex justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-content-dark">{t('auth.password')}</label>
              </div>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" dir="ltr" className="!h-11 !pe-11" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute top-2.5 end-3 bg-transparent border-none cursor-pointer text-gray-400 dark:text-content-muted-dark">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer" />
                <span className="text-xs text-gray-500 dark:text-content-muted-dark">{isRTL ? 'تذكرني' : 'Remember me'}</span>
              </label>
              <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-brand-600 dark:text-brand-400 bg-transparent border-none cursor-pointer p-0 hover:underline">
                {t('auth.forgotPassword')}
              </button>
            </div>

            <Button type="submit" disabled={disabled} className="w-full !h-11">
              {loading ? '...' : t('auth.login')}
            </Button>
          </form>

          {/* Forgot Password Modal */}
          {forgotMode && (
            <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onClick={() => setForgotMode(false)}>
              <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[400px] p-6">
                {resetSent ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">📧</div>
                    <h3 className="m-0 text-lg font-bold text-content dark:text-content-dark mb-2">
                      {isRTL ? 'تم إرسال رابط التعيين!' : 'Reset link sent!'}
                    </h3>
                    <p className="m-0 text-sm text-gray-500 dark:text-content-muted-dark mb-4">
                      {isRTL ? 'تفقد بريدك الإلكتروني' : 'Check your email inbox'}
                    </p>
                    <Button onClick={() => { setForgotMode(false); setResetSent(false); }}>
                      {isRTL ? 'تم' : 'Done'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="m-0 text-lg font-bold text-content dark:text-content-dark mb-2">
                      {isRTL ? 'نسيت كلمة المرور' : 'Forgot Password'}
                    </h3>
                    <p className="m-0 text-sm text-gray-500 dark:text-content-muted-dark mb-4">
                      {isRTL ? 'أدخل بريدك الإلكتروني وهنبعتلك رابط لإعادة تعيين كلمة المرور' : 'Enter your email and we\'ll send you a reset link'}
                    </p>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" dir="ltr" className="mb-4" />
                    <div className="flex gap-2.5">
                      <Button variant="secondary" onClick={() => setForgotMode(false)} className="flex-1">
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button disabled={!email || loading} className="flex-1" onClick={async () => {
                        setLoading(true);
                        try {
                          const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: window.location.origin + '/login',
                          });
                          if (err) throw err;
                          setResetSent(true);
                        } catch (err) {
                          setError(err.message || (isRTL ? 'فشل الإرسال' : 'Failed to send'));
                        } finally { setLoading(false); }
                      }}>
                        {loading ? '...' : (isRTL ? 'إرسال الرابط' : 'Send Link')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 dark:text-content-muted-dark mt-8">&copy; 2026 Platform Real Estate</p>
        </div>
      </div>
    </div>
  );
}
