import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { Sun, Moon, Globe, Bell, Search, LogOut, User, Command, Menu, WifiOff, RefreshCw, CheckCircle2, CloudOff, Keyboard, Monitor, Clock, ChevronDown, Check, Lightbulb, Star } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import GlobalSearch from './GlobalSearch';
import NotificationsDropdown from './NotificationsDropdown';
import FavoritesDropdown from '../ui/FavoritesDropdown';
import RecentItemsDropdown from '../ui/RecentItemsDropdown';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { getUnreadCount } from '../../services/notificationsService';
import { getSuggestionsCount } from '../../services/suggestionsService';
import { useShortcutsHelp } from './KeyboardShortcutsProvider';
import { useNavigate } from 'react-router-dom';

export default function Header({ onMenuClick }) {
  const { t, i18n } = useTranslation();
  const { profile, logout } = useAuth();
  const { theme, toggleTheme, themeMode, setThemeMode, scheduleStart, setScheduleStart, scheduleEnd, setScheduleEnd } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const favRef = useRef(null);
  const recentRef = useRef(null);
  const ref = useRef(null);
  const isRTL = i18n.language === 'ar';
  const { isOnline, pendingCount, isSyncing, syncResult } = useOfflineSync();
  const [unreadCount, setUnreadCount] = useState(0);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const { setShowHelp } = useShortcutsHelp();
  const navigate = useNavigate();

  // Keep unread count in sync
  useEffect(() => {
    const userId = profile?.id || profile?.email;
    const refresh = () => setUnreadCount(getUnreadCount(userId));
    refresh();
    window.addEventListener('platform_notification', refresh);
    return () => window.removeEventListener('platform_notification', refresh);
  }, [profile?.id, profile?.email]);

  // Also refresh when dropdown closes
  useEffect(() => {
    if (!showNotifications) {
      setUnreadCount(getUnreadCount(profile?.id || profile?.email));
    }
  }, [showNotifications, profile?.id, profile?.email]);

  // Suggestions count — refresh every 5 minutes
  useEffect(() => {
    setSuggestionsCount(getSuggestionsCount());
    const interval = setInterval(() => setSuggestionsCount(getSuggestionsCount()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowProfile(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) setShowThemeMenu(false); };
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
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark relative flex items-center"
          title={isRTL ? 'اقتراحات ذكية' : 'Smart Suggestions'}
        >
          <Lightbulb size={18} />
          {suggestionsCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] bg-amber-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {suggestionsCount > 99 ? '99+' : suggestionsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark hidden sm:flex items-center"
          title={isRTL ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
        >
          <Keyboard size={18} />
        </button>
        <button onClick={handleLangToggle} className="p-2 px-3 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark flex items-center gap-1 text-[13px] font-semibold">
          <Globe size={18} /><span className="hidden sm:inline">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
        <div ref={themeMenuRef} className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark flex items-center gap-0.5"
            title={isRTL ? 'وضع المظهر' : 'Theme Mode'}
          >
            {themeMode === 'auto' ? <Monitor size={18} /> : themeMode === 'schedule' ? <Clock size={18} /> : theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <ChevronDown size={12} />
          </button>
          {showThemeMenu && (() => {
            const isDark = theme === 'dark';
            const modes = [
              { id: 'manual', icon: theme === 'dark' ? Sun : Moon, label: isRTL ? 'يدوي' : 'Manual' },
              { id: 'auto', icon: Monitor, label: isRTL ? 'تلقائي (النظام)' : 'Auto (System)' },
              { id: 'schedule', icon: Clock, label: isRTL ? 'جدول زمني' : 'Schedule' },
            ];
            const hours = Array.from({ length: 24 }, (_, i) => i);
            const formatHour = (h) => {
              if (h === 0) return '12 AM';
              if (h < 12) return `${h} AM`;
              if (h === 12) return '12 PM';
              return `${h - 12} PM`;
            };
            const selectStyle = {
              appearance: 'none',
              WebkitAppearance: 'none',
              background: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#e2e8f0' : '#334155',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.25)'}`,
              borderRadius: 6,
              padding: '4px 22px 4px 8px',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: `${isRTL ? '8px' : 'calc(100% - 6px)'} center`,
            };
            return (
              <div
                dir={isRTL ? 'rtl' : 'ltr'}
                className={`absolute top-full mt-2 end-0 rounded-xl shadow-lg dark:shadow-2xl z-[100]`}
                style={{
                  width: 220,
                  background: isDark ? '#1a1f2e' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                  padding: '6px 0',
                }}
              >
                {modes.map((m) => {
                  const Icon = m.icon;
                  const active = themeMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setThemeMode(m.id);
                        if (m.id === 'manual') {
                          // keep current theme, allow toggling
                        }
                        if (m.id !== 'schedule') setShowThemeMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '9px 14px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        color: active
                          ? (isDark ? '#818cf8' : '#6366f1')
                          : (isDark ? '#cbd5e1' : '#475569'),
                        background: active
                          ? (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)')
                          : 'transparent',
                        fontWeight: active ? 600 : 400,
                        textAlign: 'start',
                      }}
                    >
                      <Icon size={16} />
                      <span style={{ flex: 1 }}>{m.label}</span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
                {themeMode === 'manual' && (
                  <div style={{ padding: '6px 14px 8px', borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)'}`, marginTop: 4 }}>
                    <button
                      onClick={() => { toggleTheme(); setShowThemeMenu(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '7px 10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        borderRadius: 8,
                        color: isDark ? '#94a3b8' : '#64748b',
                        background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      {isDark ? <Sun size={14} /> : <Moon size={14} />}
                      {isDark ? (isRTL ? 'تبديل للفاتح' : 'Switch to Light') : (isRTL ? 'تبديل للداكن' : 'Switch to Dark')}
                    </button>
                  </div>
                )}
                {themeMode === 'schedule' && (
                  <div style={{ padding: '8px 14px 10px', borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)'}`, marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 8, fontWeight: 500 }}>
                      {isRTL ? 'الوضع الداكن من:' : 'Dark mode from:'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        value={scheduleStart}
                        onChange={(e) => setScheduleStart(Number(e.target.value))}
                        style={selectStyle}
                      >
                        {hours.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                      </select>
                      <span style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>→</span>
                      <select
                        value={scheduleEnd}
                        onChange={(e) => setScheduleEnd(Number(e.target.value))}
                        style={selectStyle}
                      >
                        {hours.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginTop: 6 }}>
                      {isDark
                        ? (isRTL ? '🌙 الوضع الداكن مفعّل الآن' : '🌙 Dark mode is active now')
                        : (isRTL ? '☀️ الوضع الفاتح مفعّل الآن' : '☀️ Light mode is active now')
                      }
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <div ref={favRef} className="relative">
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark relative"
            title={isRTL ? 'المفضلة' : 'Favorites'}
          >
            <Star size={18} />
          </button>
          <FavoritesDropdown show={showFavorites} onClose={() => setShowFavorites(false)} />
        </div>
        <div ref={recentRef} className="relative">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark relative"
            title={isRTL ? 'الأخيرة' : 'Recent'}
          >
            <Clock size={18} />
          </button>
          <RecentItemsDropdown show={showRecent} onClose={() => setShowRecent(false)} />
        </div>
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} aria-label={isRTL ? 'الإشعارات' : 'Notifications'} className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
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
