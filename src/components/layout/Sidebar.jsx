import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { NAV_ITEMS, ROLE_NAV_GROUPS } from '../../config/navigation';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X, Star } from 'lucide-react';
import { getFavorites, toggleFavorite, isFavorite as checkFavorite } from '../../services/favoritesService';
import { getUnreadCount as getAnnouncementUnread } from '../../services/announcementService';
import { getEmailStats } from '../../services/emailService';
import { getPendingCount as getApprovalPendingCount } from '../../services/approvalService';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { i18n } = useTranslation();
  const { hasPermission, profile } = useAuth();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({});
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const [favPages, setFavPages] = useState([]);

  const refreshFavs = useCallback(() => {
    const all = getFavorites().filter(f => f.type === 'page');
    setFavPages(all);
  }, []);

  useEffect(() => {
    refreshFavs();
    const handler = () => refreshFavs();
    window.addEventListener('platform_favorites_changed', handler);
    return () => window.removeEventListener('platform_favorites_changed', handler);
  }, [refreshFavs]);

  const handleStarClick = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({
      id: `page_${item.id}`,
      type: 'page',
      name: item.label.en,
      nameAr: item.label.ar,
      path: item.path,
    });
    refreshFavs();
  };

  // Announcement unread count
  const [annUnread, setAnnUnread] = useState(0);
  useEffect(() => {
    const userId = profile?.id || profile?.email || '';
    if (userId) setAnnUnread(getAnnouncementUnread(userId));
    const handler = () => { if (userId) setAnnUnread(getAnnouncementUnread(userId)); };
    window.addEventListener('platform_announcement', handler);
    return () => window.removeEventListener('platform_announcement', handler);
  }, [profile]);
  // Refresh unread on location change (user may have read announcements)
  useEffect(() => {
    const userId = profile?.id || profile?.email || '';
    if (userId) setAnnUnread(getAnnouncementUnread(userId));
  }, [location.pathname, profile]);

  // Approval pending count
  const [approvalPending, setApprovalPending] = useState(0);
  useEffect(() => {
    setApprovalPending(getApprovalPendingCount());
    const handler = () => setApprovalPending(getApprovalPendingCount());
    window.addEventListener('platform_approval_change', handler);
    return () => window.removeEventListener('platform_approval_change', handler);
  }, []);
  useEffect(() => { setApprovalPending(getApprovalPendingCount()); }, [location.pathname]);

  // Email unread count
  const [emailUnread, setEmailUnread] = useState(0);
  useEffect(() => {
    setEmailUnread(getEmailStats().unread);
    const handler = () => setEmailUnread(getEmailStats().unread);
    window.addEventListener('platform_emails_changed', handler);
    return () => window.removeEventListener('platform_emails_changed', handler);
  }, []);
  useEffect(() => { setEmailUnread(getEmailStats().unread); }, [location.pathname]);

  // Flyout menu for collapsed sidebar
  const [flyoutMenu, setFlyoutMenu] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const flyoutRef = useRef(null);

  // Close flyout on click outside
  useEffect(() => {
    if (!flyoutMenu) return;
    const handleClickOutside = (e) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target)) {
        setFlyoutMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [flyoutMenu]);

  // Close flyout on route change
  useEffect(() => {
    setFlyoutMenu(null);
  }, [location.pathname]);

  const handleParentClick = (e, item) => {
    if (collapsed && !mobileOpen) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (isRTL) {
        // Sidebar on right, flyout opens to the left
        setFlyoutPos({ top: rect.top, right: window.innerWidth - rect.left + 4 });
      } else {
        // Sidebar on left, flyout opens to the right
        setFlyoutPos({ top: rect.top, left: rect.right + 4 });
      }
      setFlyoutMenu(flyoutMenu === item.id ? null : item.id);
    } else {
      toggleMenu(item.id);
    }
  };

  const toggleMenu = (id) => setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => item.children?.some(c => location.pathname.startsWith(c.path));
  const role = profile?.role || 'admin';
  const roleGroups = ROLE_NAV_GROUPS[role];
  const visibleItems = NAV_ITEMS.filter(item => {
    if (!hasPermission(item.permission)) return false;
    if (roleGroups && !roleGroups.includes(item.id)) return false;
    return true;
  });
  const hasChild = (item, childId) => item.children?.some(c => c.id === childId);
  const getBadgeCount = (item) => {
    let count = 0;
    if (item.id === 'announcements' || hasChild(item, 'announcements')) count += annUnread;
    if (item.id === 'approvals' || hasChild(item, 'approvals')) count += approvalPending;
    if (item.id === 'email' || hasChild(item, 'email')) count += emailUnread;
    return count;
  };

  const ToggleIcon = collapsed
    ? (isRTL ? PanelLeftClose : PanelLeftOpen)
    : (isRTL ? PanelLeftOpen : PanelLeftClose);

  const handleNavClick = () => {
    // Auto-close sidebar on mobile when a nav item is clicked
    if (onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        data-tour="sidebar"
        className={`
          fixed top-0 start-0 h-screen z-50 bg-surface-card dark:bg-surface-card-dark border-e border-edge dark:border-edge-dark flex flex-col
          transition-all duration-300
          ${/* Mobile: slide in/out drawer, always full width (260px) */''}
          ${mobileOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
          w-[260px]
          ${/* Desktop: always visible, respect collapsed state */''}
          md:translate-x-0
          ${collapsed ? 'md:w-[72px]' : 'md:w-[260px]'}
          md:transition-[width] md:duration-300
        `}
      >
        {/* Header with logo + toggle */}
        <div className={`h-[72px] flex items-center ${collapsed ? 'md:justify-center' : 'justify-between'} border-b border-edge dark:border-edge-dark ${collapsed ? 'md:p-2 p-2' : 'py-2 px-4'} overflow-hidden gap-2`}>
          {/* Mobile: always show full header with close button */}
          <div className="flex items-center justify-between w-full md:hidden">
            <div className="flex-1 flex items-center justify-center px-1 min-w-0">
              <img src={isDark ? "/logo-white.png" : "/logo.png"} alt={isRTL ? 'بلاتفورم للعقارات' : 'Platform Real Estate'} className="w-full h-auto max-h-14 object-contain" />
            </div>
            <button onClick={onMobileClose} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer bg-brand-500/[0.06] dark:bg-brand-500/10 text-content-muted dark:text-brand-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Desktop: original toggle behavior */}
          <div className="hidden md:flex items-center w-full">
            {collapsed ? (
              <div className="w-full flex justify-center">
                <button onClick={onToggle} className="w-10 h-10 rounded-[10px] flex items-center justify-center border-none cursor-pointer bg-brand-500/10 dark:bg-brand-500/10 text-content-muted dark:text-brand-400 transition-colors shrink-0">
                  <ToggleIcon size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 flex items-center justify-center px-1 min-w-0">
                  <img src={isDark ? "/logo-white.png" : "/logo.png"} alt={isRTL ? 'بلاتفورم للعقارات' : 'Platform Real Estate'} className="w-full h-auto max-h-14 object-contain" />
                </div>
                <button onClick={onToggle} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer bg-brand-500/[0.06] dark:bg-brand-500/10 text-content-muted dark:text-brand-400 transition-colors">
                  <ToggleIcon size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 px-3">
          {/* Favorites section */}
          {!collapsed && favPages.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px 6px',
              }}>
                <Star size={11} style={{ color: '#F59E0B' }} fill="#F59E0B" />
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: isDark ? '#64748b' : '#94a3b8',
                }}>
                  {isRTL ? 'المفضلة' : 'Favorites'}
                </span>
              </div>
              {favPages.slice(0, 5).map(fav => (
                <Link
                  key={fav.id}
                  to={fav.path}
                  onClick={handleNavClick}
                  className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-3 py-2 px-3 rounded-lg no-underline text-[12px] font-medium transition-colors ${isActive(fav.path) ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-800 dark:text-brand-400' : 'bg-transparent text-gray-500 dark:text-gray-400'}`}
                >
                  <Star size={14} className="shrink-0" style={{ color: '#F59E0B' }} fill="#F59E0B" />
                  <span className="flex-1 text-start truncate">{isRTL ? (fav.nameAr || fav.name) : fav.name}</span>
                </Link>
              ))}
              <div style={{
                height: 1,
                background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
                margin: '8px 12px',
              }} />
            </div>
          )}
          {visibleItems.map(item => {
            const Icon = item.icon;
            const hasChildren = item.children?.length > 0;
            const isOpen = openMenus[item.id] || isParentActive(item);
            const active = item.path ? isActive(item.path) : isParentActive(item);
            const visibleChildren = hasChildren ? item.children.filter(c => hasPermission(c.permission)) : [];
            // On mobile, sidebar is always expanded (not collapsed)
            const showLabels = !collapsed || mobileOpen;
            return (
              <div key={item.id} className="mb-0.5">
                {item.path && !hasChildren ? (
                  <div style={{ position: 'relative' }} className="group">
                  <Link to={item.path} onClick={handleNavClick} className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-3 py-2.5 px-3 rounded-lg no-underline text-sm font-medium transition-colors ${active ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-800 dark:text-brand-400' : 'bg-transparent text-gray-500 dark:text-gray-400'}`}>
                    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <Icon size={20} />
                      {(() => { const bc = getBadgeCount(item); return !showLabels && bc > 0 ? (
                        <span style={{ position: 'absolute', top: -4, [isRTL ? 'left' : 'right']: -6, minWidth: 16, height: 16, borderRadius: 8, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>{bc > 9 ? '9+' : bc}</span>
                      ) : null; })()}
                    </span>
                    {showLabels && <span className={`flex-1 text-start`}>{item.label[lang]}</span>}
                    {(() => { const bc = getBadgeCount(item); return showLabels && bc > 0 ? (
                      <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: 1, flexShrink: 0 }}>{bc > 99 ? '99+' : bc}</span>
                    ) : null; })()}
                    {showLabels && (
                      <span
                        onClick={(e) => handleStarClick(e, item)}
                        className="opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 2, borderRadius: 4 }}
                        title={checkFavorite(`page_${item.id}`) ? (isRTL ? 'إزالة من المفضلة' : 'Unfavorite') : (isRTL ? 'إضافة للمفضلة' : 'Favorite')}
                      >
                        <Star size={13} style={{ color: checkFavorite(`page_${item.id}`) ? '#F59E0B' : (isDark ? '#475569' : '#94a3b8') }} fill={checkFavorite(`page_${item.id}`) ? '#F59E0B' : 'none'} />
                      </span>
                    )}
                  </Link>
                  </div>
                ) : (
                  <button onClick={(e) => handleParentClick(e, item)} className={`w-full flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-3 py-2.5 px-3 rounded-lg border-none cursor-pointer text-sm font-medium ${active ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-800 dark:text-brand-400' : 'bg-transparent text-gray-500 dark:text-gray-400'} text-start`}>
                    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <Icon size={20} />
                      {(() => { const bc = getBadgeCount(item); return !showLabels && bc > 0 ? (
                        <span style={{ position: 'absolute', top: -4, [isRTL ? 'left' : 'right']: -6, minWidth: 16, height: 16, borderRadius: 8, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>{bc > 9 ? '9+' : bc}</span>
                      ) : null; })()}
                    </span>
                    {showLabels && <span className="flex-1">{item.label[lang]}</span>}
                    {(() => { const bc = getBadgeCount(item); return showLabels && bc > 0 ? (
                      <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', lineHeight: 1, flexShrink: 0 }}>{bc > 99 ? '99+' : bc}</span>
                    ) : null; })()}
                    {showLabels && <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
                  </button>
                )}
                {showLabels && hasChildren && isOpen && visibleChildren.length > 0 && (
                  <div className={`px-2 mt-1 border-s-2 ms-8 me-1 border-edge dark:border-edge-dark ${visibleChildren.length > 8 ? 'max-h-[320px] overflow-y-auto' : ''}`}>
                    {visibleChildren.map(child => (
                      <Link key={child.id} to={child.path} onClick={handleNavClick} className={`block py-2 px-3 rounded-lg no-underline text-[13px] text-start transition-colors ${isActive(child.path) ? 'font-semibold text-brand-800 dark:text-brand-400 bg-brand-50/25 dark:bg-brand-500/15' : 'font-normal text-gray-400 dark:text-gray-500 bg-transparent'}`}>
                        {child.label[lang]}
                      </Link>
                    ))}
                  </div>
                )}
                {/* Flyout menu for collapsed sidebar */}
                {collapsed && !mobileOpen && hasChildren && flyoutMenu === item.id && visibleChildren.length > 0 && (
                  <div
                    ref={flyoutRef}
                    style={{
                      position: 'fixed',
                      top: flyoutPos.top,
                      ...(flyoutPos.left != null ? { left: flyoutPos.left } : {}),
                      ...(flyoutPos.right != null ? { right: flyoutPos.right } : {}),
                      zIndex: 9999,
                      minWidth: 200,
                      maxHeight: 400,
                      overflowY: 'auto',
                    }}
                    className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg"
                  >
                    <div className="px-3 py-2 border-b border-edge dark:border-edge-dark">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {item.label[lang]}
                      </span>
                    </div>
                    <div className="p-1.5">
                      {visibleChildren.map(child => (
                        <Link
                          key={child.id}
                          to={child.path}
                          onClick={() => { setFlyoutMenu(null); handleNavClick(); }}
                          className={`block py-2 px-3 rounded-lg no-underline text-[13px] text-start transition-colors ${isActive(child.path) ? 'font-semibold text-brand-800 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/15' : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 bg-transparent'}`}
                        >
                          {child.label[lang]}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {/* Profile link at bottom */}
        <div style={{
          padding: collapsed ? '12px 8px' : '12px 16px',
          borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`,
          flexShrink: 0,
        }}>
          <Link
            to="/profile"
            onClick={handleNavClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '8px 0' : '8px 10px',
              borderRadius: 10,
              textDecoration: 'none',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: location.pathname === '/profile'
                ? (isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)')
                : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {(profile?.full_name_en || profile?.full_name_ar || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {isRTL ? (profile?.full_name_ar || profile?.full_name_en) : (profile?.full_name_en || profile?.full_name_ar)}
                </div>
                <div style={{
                  fontSize: 11,
                  color: isDark ? '#64748b' : '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {isRTL ? 'الملف الشخصي' : 'View Profile'}
                </div>
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
