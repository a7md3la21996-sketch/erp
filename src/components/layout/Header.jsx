import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../config/roles';
import { Sun, Moon, Globe, Bell, Search, LogOut, User, Command, Menu, WifiOff, RefreshCw, CheckCircle2, CloudOff, Keyboard, Monitor, Clock, ChevronDown, Check, Lightbulb, Star, Gift, Shield, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import GlobalSearch from './GlobalSearch';
import NotificationsDropdown from './NotificationsDropdown';
import FavoritesDropdown from '../ui/FavoritesDropdown';
import RecentItemsDropdown from '../ui/RecentItemsDropdown';
import SyncIndicator from '../ui/SyncIndicator';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { getUnreadCount } from '../../services/notificationService';
import { isPushSupported, getPushPermission, requestPushPermission } from '../../services/pushService';
import { getSuggestionsCount } from '../../services/suggestionsService';
import { getUnseenCount } from '../../pages/ChangelogPage';
import { useShortcutsHelp } from './KeyboardShortcutsProvider';
import { useNavigate } from 'react-router-dom';

export default function Header({ onMenuClick }) {
  const { t, i18n } = useTranslation();
  const { profile, logout, isRealAdmin, isImpersonating, impersonate, stopImpersonating, originalProfile } = useAuth();
  const { theme, toggleTheme, themeMode, setThemeMode, scheduleStart, setScheduleStart, scheduleEnd, setScheduleEnd } = useTheme();
  // Single dropdown state: only one dropdown open at a time
  const [openDropdown, setOpenDropdown] = useState(null); // 'theme' | 'profile' | 'roleSwitcher' | 'notifications' | 'favorites' | 'recent' | null
  const showThemeMenu = openDropdown === 'theme';
  const showProfile = openDropdown === 'profile';
  const showRoleSwitcher = openDropdown === 'roleSwitcher';
  const showNotifications = openDropdown === 'notifications';
  const showFavorites = openDropdown === 'favorites';
  const showRecent = openDropdown === 'recent';
  const setShowThemeMenu = (v) => setOpenDropdown(v ? 'theme' : null);
  const setShowProfile = (v) => setOpenDropdown(v ? 'profile' : null);
  const setShowRoleSwitcher = (v) => setOpenDropdown(v ? 'roleSwitcher' : null);
  const setShowNotifications = (v) => setOpenDropdown(v ? 'notifications' : null);
  const setShowFavorites = (v) => setOpenDropdown(v ? 'favorites' : null);
  const setShowRecent = (v) => setOpenDropdown(v ? 'recent' : null);
  const themeMenuRef = useRef(null);
  const roleSwitcherRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const favRef = useRef(null);
  const recentRef = useRef(null);
  const ref = useRef(null);
  const isRTL = i18n.language === 'ar';
  const { isOnline, pendingCount, isSyncing, syncResult } = useOfflineSync();
  const [unreadCount, setUnreadCount] = useState(0);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [changelogUnseen, setChangelogUnseen] = useState(0);
  const { setShowHelp } = useShortcutsHelp();
  const navigate = useNavigate();
  const [pushPermission, setPushPermission] = useState(() => isPushSupported() ? getPushPermission() : 'denied');
  const [pushDismissed, setPushDismissed] = useState(() => {
    try { return localStorage.getItem('platform_push_dismissed') === 'true'; } catch { return false; }
  });

  // Keep unread count in sync
  useEffect(() => {
    const refresh = () => { getUnreadCount().then(c => setUnreadCount(c)).catch(() => {}); };
    refresh();
    window.addEventListener('platform_notification', refresh);
    window.addEventListener('platform_notification_changed', refresh);
    return () => {
      window.removeEventListener('platform_notification', refresh);
      window.removeEventListener('platform_notification_changed', refresh);
    };
  }, []);

  // Also refresh when dropdown closes
  useEffect(() => {
    if (!showNotifications) {
      getUnreadCount().then(c => setUnreadCount(c)).catch(() => {});
    }
  }, [showNotifications]);

  // Suggestions count — refresh every 5 minutes
  useEffect(() => {
    setSuggestionsCount(getSuggestionsCount());
    const interval = setInterval(() => setSuggestionsCount(getSuggestionsCount()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Changelog unseen count
  useEffect(() => {
    setChangelogUnseen(getUnseenCount());
    const handler = () => setChangelogUnseen(getUnseenCount());
    window.addEventListener('changelog_seen', handler);
    return () => window.removeEventListener('changelog_seen', handler);
  }, []);

  // Single click-outside handler for all dropdowns
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e) => {
      const inside = [ref, themeMenuRef, roleSwitcherRef].some(r => r.current?.contains(e.target));
      if (!inside) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

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
    i18n.changeLanguage(newLang).then(() => {
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;
    });
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

        {/* Connection dot indicator */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isOnline ? '#22c55e' : '#ef4444',
            display: 'inline-block',
            flexShrink: 0,
            boxShadow: isOnline ? '0 0 4px rgba(34,197,94,0.4)' : '0 0 4px rgba(239,68,68,0.4)',
            transition: 'background 0.3s, box-shadow 0.3s',
          }}
          title={isOnline
            ? (isRTL ? 'متصل' : 'Online')
            : (isRTL ? 'غير متصل' : 'Offline')
          }
        />

        {/* Search button - full on desktop, icon-only on mobile */}
        <button data-tour="search" onClick={() => setShowSearch(true)} className={`hidden md:flex w-full h-10 rounded-[10px] items-center gap-2.5 border border-edge dark:border-edge-dark bg-surface-bg dark:bg-surface-input-dark cursor-pointer text-content-muted dark:text-brand-400 text-sm font-[inherit] ps-3.5 pe-2.5`}>
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
        {isOnline && pendingCount > 0 && !isSyncing && (
          <button onClick={() => { import('../../lib/offlineQueue').then(m => { m.clearQueue(); window.location.reload(); }); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[11px] font-semibold me-1 cursor-pointer"
            title={isRTL ? 'مسح العمليات المعلقة' : 'Clear pending operations'}>
            <AlertTriangle size={13} />
            <span className="hidden sm:inline">{pendingCount} {isRTL ? 'معلق' : 'pending'}</span>
            <X size={11} />
          </button>
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
        <div ref={favRef} className="relative">
          <button
            data-tour="favorites"
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
        <SyncIndicator />
        <div className="relative">
          <button data-tour="notifications" onClick={() => setShowNotifications(!showNotifications)} aria-label={isRTL ? 'الإشعارات' : 'Notifications'} className="p-2 rounded-lg border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationsDropdown show={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>
        {/* Push Notification Enable Button — only show if not yet asked and not dismissed */}
        {isPushSupported() && pushPermission === 'default' && !pushDismissed && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-500/10 border border-brand-500/20 text-[11px] font-semibold me-1">
            <Bell size={13} className="text-brand-500 shrink-0" />
            <span className="hidden sm:inline text-brand-600 dark:text-brand-400">
              {isRTL ? 'تفعيل الإشعارات' : 'Enable Notifications'}
            </span>
            <button
              onClick={async () => {
                const granted = await requestPushPermission();
                setPushPermission(granted ? 'granted' : 'denied');
              }}
              className="px-2 py-0.5 rounded-md border-none cursor-pointer bg-brand-500 text-white text-[10px] font-semibold hover:bg-brand-600 transition-colors"
            >
              {isRTL ? 'تفعيل' : 'Enable'}
            </button>
            <button
              onClick={() => {
                setPushDismissed(true);
                try { localStorage.setItem('platform_push_dismissed', 'true'); } catch {}
              }}
              className="px-1 py-0.5 rounded-md border-none cursor-pointer bg-transparent text-content-muted dark:text-content-muted-dark text-[10px] hover:text-content dark:hover:text-content-dark transition-colors"
              title={isRTL ? 'إغلاق' : 'Dismiss'}
            >
              &times;
            </button>
          </div>
        )}
        {/* Role Switcher - visible only to admin */}
        {isRealAdmin && (
          <div ref={roleSwitcherRef} className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className={`p-2 rounded-lg border-none cursor-pointer flex items-center gap-1 text-[12px] font-semibold ${
                isImpersonating
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-transparent text-content-muted dark:text-content-muted-dark'
              }`}
              title={isRTL ? 'تبديل الصلاحيات' : 'Role Switcher'}
            >
              <Shield size={16} />
              <ChevronDown size={12} />
            </button>
            {showRoleSwitcher && (
              <div
                dir={isRTL ? 'rtl' : 'ltr'}
                className="absolute top-full mt-2 end-0 w-[220px] rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-lg dark:shadow-2xl py-1.5 z-[100]"
              >
                <div className="px-3 py-2 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark/75 mb-1">
                  {isRTL ? 'عرض كـ...' : 'View as...'}
                </div>
                {Object.entries(ROLE_LABELS).map(([role, labels]) => {
                  const isActive = profile?.role === role && !isImpersonating && role === 'admin';
                  const isViewing = profile?.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => {
                        if (role === 'admin' || (role === originalProfile?.role && !isImpersonating)) {
                          stopImpersonating();
                        } else {
                          impersonate(role);
                        }
                        setShowRoleSwitcher(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 border-none cursor-pointer text-[13px] font-[inherit] text-start ${
                        isViewing
                          ? 'bg-brand-500/8 text-brand-600 dark:text-brand-400 font-semibold'
                          : 'bg-transparent text-content dark:text-content-dark hover:bg-surface-bg dark:hover:bg-surface-bg-dark'
                      }`}
                    >
                      <span className="flex-1">{isRTL ? labels.ar : labels.en}</span>
                      {isViewing && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="w-px h-6 mx-1 bg-edge dark:bg-edge-dark hidden sm:block" />
        <div ref={ref} className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === 'profile' ? null : 'profile')} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg border-none cursor-pointer bg-transparent">
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
            <div dir={isRTL ? 'rtl' : 'ltr'} className={`absolute top-full mt-2 end-0 w-[240px] rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-lg dark:shadow-2xl py-2 z-[100]`}>
              <div className="px-4 py-2.5 border-b border-edge dark:border-edge-dark/75">
                <div className="text-sm font-semibold text-content dark:text-content-dark">{isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar)}</div>
                <div className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">{profile?.email}</div>
              </div>
              <button onClick={() => { setShowProfile(false); navigate('/profile'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 border-none cursor-pointer bg-transparent text-content dark:text-content-dark text-[13px] hover:bg-surface-bg dark:hover:bg-surface-bg-dark text-start">
                <User size={16} className="text-content-muted dark:text-content-muted-dark shrink-0" />{isRTL ? 'الملف الشخصي' : 'My Profile'}
              </button>
              <div className="border-t border-edge dark:border-edge-dark/50 my-1" />
              <button onClick={() => { toggleTheme(); setShowProfile(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 border-none cursor-pointer bg-transparent text-content dark:text-content-dark text-[13px] hover:bg-surface-bg dark:hover:bg-surface-bg-dark text-start">
                {theme === 'dark' ? <Sun size={16} className="text-content-muted dark:text-content-muted-dark shrink-0" /> : <Moon size={16} className="text-content-muted dark:text-content-muted-dark shrink-0" />}
                {theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light Mode') : (isRTL ? 'الوضع الداكن' : 'Dark Mode')}
              </button>
              <button onClick={() => { handleLangToggle(); setShowProfile(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 border-none cursor-pointer bg-transparent text-content dark:text-content-dark text-[13px] hover:bg-surface-bg dark:hover:bg-surface-bg-dark text-start">
                <Globe size={16} className="text-content-muted dark:text-content-muted-dark shrink-0" />
                {i18n.language === 'ar' ? 'English' : 'العربية'}
              </button>
              <button onClick={() => { setShowHelp(true); setShowProfile(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 border-none cursor-pointer bg-transparent text-content dark:text-content-dark text-[13px] hover:bg-surface-bg dark:hover:bg-surface-bg-dark text-start">
                <Keyboard size={16} className="text-content-muted dark:text-content-muted-dark shrink-0" />
                {isRTL ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
              </button>
              <div className="border-t border-edge dark:border-edge-dark/50 my-1" />
              <button onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2.5 border-none cursor-pointer bg-transparent text-red-500 text-[13px] text-start">
                <LogOut size={16} className="shrink-0" />{t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    {isImpersonating && (
      <div className="h-9 bg-amber-500/15 border-b border-amber-500/25 flex items-center justify-center gap-3 px-4 sticky top-16 z-30">
        <Shield size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
          {isRTL
            ? `بتشوف كـ ${ROLE_LABELS[profile?.role]?.ar || profile?.role}`
            : `Viewing as ${ROLE_LABELS[profile?.role]?.en || profile?.role}`
          }
        </span>
        <button
          onClick={stopImpersonating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border-none cursor-pointer bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold transition-colors"
        >
          <ArrowLeft size={12} />
          {isRTL ? 'رجوع للأدمن' : 'Back to Admin'}
        </button>
      </div>
    )}
    {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </>
  );
}
