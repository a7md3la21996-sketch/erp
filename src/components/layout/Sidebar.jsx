import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { NAV_ITEMS } from '../../config/navigation';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function Sidebar({ collapsed, onToggle }) {
  const { i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({});
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const toggleMenu = (id) => setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => item.children?.some(c => location.pathname.startsWith(c.path));
  const visibleItems = NAV_ITEMS.filter(item => hasPermission(item.permission));

  const ToggleIcon = collapsed
    ? (isRTL ? PanelLeftClose : PanelLeftOpen)
    : (isRTL ? PanelLeftOpen : PanelLeftClose);

  return (
    <aside
      className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} z-20 h-screen ${collapsed ? 'w-[72px]' : 'w-[260px]'} transition-[width] duration-300 bg-surface-card dark:bg-surface-card-dark ${isRTL ? 'border-l border-r-0' : 'border-r border-l-0'} border-edge dark:border-edge-dark flex flex-col`}
    >
      {/* Header with logo + toggle */}
      <div className={`h-[72px] flex items-center ${collapsed ? 'justify-center' : 'justify-between'} border-b border-edge dark:border-edge-dark ${collapsed ? 'p-2' : 'py-2 px-4'} overflow-hidden gap-2`}>
        {collapsed ? (
          <button onClick={onToggle} className="w-10 h-10 rounded-[10px] flex items-center justify-center border-none cursor-pointer bg-brand-500/10 dark:bg-brand-500/10 text-content-muted dark:text-brand-400 transition-colors shrink-0">
            <ToggleIcon size={20} />
          </button>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center px-1 min-w-0">
              <img src={isDark ? "/logo-white.png" : "/logo.png"} alt={isRTL ? 'بلاتفورم للعقارات' : 'Platform Real Estate'} className="w-full h-auto max-h-14 object-contain" />
            </div>
            <button onClick={onToggle} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer bg-brand-500/[0.06] dark:bg-brand-500/10 text-content-muted dark:text-brand-400 transition-colors">
              <ToggleIcon size={16} />
            </button>
          </>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-4 px-3">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const hasChildren = item.children?.length > 0;
          const isOpen = openMenus[item.id] || isParentActive(item);
          const active = item.path ? isActive(item.path) : isParentActive(item);
          const visibleChildren = hasChildren ? item.children.filter(c => hasPermission(c.permission)) : [];
          return (
            <div key={item.id} className="mb-0.5">
              {item.path && !hasChildren ? (
                <Link to={item.path} className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-3 py-2.5 px-3 rounded-lg no-underline text-sm font-medium transition-colors ${active ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-800 dark:text-brand-400' : 'bg-transparent text-gray-500 dark:text-gray-400'}`}>
                  <Icon size={20} className="shrink-0" />
                  {!collapsed && <span className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>{item.label[lang]}</span>}
                </Link>
              ) : (
                <button onClick={() => toggleMenu(item.id)} className={`w-full flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-3 py-2.5 px-3 rounded-lg border-none cursor-pointer text-sm font-medium ${active ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-800 dark:text-brand-400' : 'bg-transparent text-gray-500 dark:text-gray-400'} ${isRTL ? 'text-right' : 'text-left'}`}>
                  <Icon size={20} className="shrink-0" />
                  {!collapsed && <span className="flex-1">{item.label[lang]}</span>}
                  {!collapsed && <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
                </button>
              )}
              {!collapsed && hasChildren && isOpen && visibleChildren.length > 0 && (
                <div className={`px-2 mt-1 ${isRTL ? 'border-r-2 border-l-0 mr-8 ml-1' : 'border-l-2 border-r-0 ml-8 mr-1'} border-edge dark:border-edge-dark`}>
                  {visibleChildren.map(child => (
                    <Link key={child.id} to={child.path} className={`block py-2 px-3 rounded-lg no-underline text-[13px] ${isRTL ? 'text-right' : 'text-left'} transition-colors ${isActive(child.path) ? 'font-semibold text-brand-800 dark:text-brand-400 bg-brand-50/25 dark:bg-brand-500/15' : 'font-normal text-gray-400 dark:text-gray-500 bg-transparent'}`}>
                      {child.label[lang]}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
