import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { Sun, Moon, Globe, Bell, Search, LogOut, User, Command, Menu, WifiOff, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import GlobalSearch from './GlobalSearch';
import NotificationsDropdown from './NotificationsDropdown';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export default function Header({ onMenuClick }) {
  const { t, i18n } = useTranslation();
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const ref = useRef(null);
  const isRTL = i18n.language === 'ar';
  const { isOnline, pendingCount, isSyncing, syncResult } = useOfflineSync();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowProfile(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role]?.[i18n.language] || profile.role) : '';
  const handleLangToggle = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang).then(() => { window.location.reload(); });
  };

  return (
    <>
    <header className="h-16 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 md:gap-3 flex-1 md:max-w-[420px]">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark md:hidden"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* Search button - full on desktop, icon-only on mobile */}
        <button onClick={() => setShowSearch(true)} className={`hidden md:flex w-full h-10 rounded-[10px] items-center gap-2.5 border border-edge dark:border-edge-dark bg-surface-bg dark:bg-surface-input-dark cursor-pointer text-content-muted dark:text-brand-400 text-sm font-[inherit] ps-3.5 pe-2.5`}>
          <Search size={16} className="shrink-0" />
          <span className={`flex-1 text-start`}>{isRTL ? 'بحث...' : 'Search...'}</span>
          <kbd className="px-1.5 py-0.5 rounded-[5px] text-[11px] font-mono bg-brand-50 dark:bg-brand-500/10 border border-edge dark:border-brand-500/15 text-content-muted dark:text-brand-400 flex items-center gap-0.5">
            <Command size={10} />K
          </kbd>
        </button>
        {/* Mobile search icon */}
        <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark md:hidden">
          <Search size={20} />
        </button>
      </div>
      <div className="flex items-center gap-1">
        {/* Offline / Syncing / Synced indicator */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-semibold me-1">
            <WifiOff size={13} />
            <span className="hidden sm:inline">{isRTL ? 'غير متصل' : 'Offline'}</span>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0 min-w-[18px] text-center leading-[18px]">
                {pendingCount}
              </span>
            )}
          </div>
        )}
        {isOnline && isSyncing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-500 text-[11px] font-semibold me-1">
            <RefreshCw size={13} className="animate-spin" />
            <span className="hidden sm:inline">
              {isRTL ? `مزامنة ${pendingCount}...` : `Syncing ${pendingCount}...`}
            </span>
          </div>
        )}
        {isOnline && !isSyncing && syncResult && syncResult.success > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold me-1">
            <CheckCircle2 size={13} />
            <span className="hidden sm:inline">{isRTL ? 'تمت المزامنة' : 'Synced'}</span>
          </div>
        )}
        <button onClick={handleLangToggle} className="p-2 px-3 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark flex items-center gap-1 text-[13px] font-semibold">
          <Globe size={18} /><span className="hidden sm:inline">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
        <button onClick={toggleTheme} className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} aria-label={isRTL ? 'الإشعارات' : 'Notifications'} className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark relative">
            <Bell size={18} />
            <span className={`absolute top-1.5 end-1.5 w-[7px] h-[7px] bg-red-500 rounded-full`} />
          </button>
          <NotificationsDropdown show={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>
        <div className="w-px h-6 mx-1 bg-edge dark:bg-edge-dark hidden sm:block" />
        <div ref={ref} className="relative">
          <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg border-none cursor-pointer bg-transparent">
            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0">
              <User size={16} color="#fff" />
            </div>
            {/* Full name/role - hidden on small screens */}
            <div className="text-start hidden sm:block">
              <div className="text-[13px] font-semibold text-content dark:text-content-dark">{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{roleLabel}</div>
            </div>
          </button>
          {showProfile && (
            <div className={`absolute top-full mt-2 end-0 w-[220px] rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-lg dark:shadow-2xl py-2 z-[100]`}>
              <div className="px-4 py-2.5 border-b border-edge dark:border-edge-dark/75">
                <div className="text-sm font-semibold text-content dark:text-content-dark">{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
                <div className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">{profile?.email}</div>
              </div>
              <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 border-none cursor-pointer bg-transparent text-red-500 text-sm">
                <LogOut size={16} />{t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </>
  );
}
