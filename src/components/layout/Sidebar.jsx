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

  return (
    <aside style={{
      position: 'fixed', top: 0, [isRTL ? 'right' : 'left']: 0, zIndex: 40,
      height: '100vh', width: collapsed ? 72 : 260, transition: 'width 0.3s',
      background: isDark ? '#1a2234' : '#fff', borderRight: isRTL ? 'none' : ('1px solid ' + (isDark ? '#2d3748' : '#e5e7eb')),
      borderLeft: isRTL ? ('1px solid ' + (isDark ? '#2d3748' : '#e5e7eb')) : 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid ' + (isDark ? '#2d3748' : '#e5e7eb'), padding: '8px 16px' }}>
        {collapsed ? (
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', background: 'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src="/logo.png" alt="Platform" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <img src="/logo.png" alt="Platform Real Estate" style={{ width: '100%', height: 'auto', maxHeight: 70, objectFit: 'contain', padding: '0 8px' }} />
        )}
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {visibleItems.map(item => {
          const Icon = item.icon;
          const hasChildren = item.children?.length > 0;
          const isOpen = openMenus[item.id] || isParentActive(item);
          const active = item.path ? isActive(item.path) : isParentActive(item);
          const visibleChildren = hasChildren ? item.children.filter(c => hasPermission(c.permission)) : [];

          return (
            <div key={item.id} style={{ marginBottom: 2 }}>
              {item.path && !hasChildren ? (
                <Link to={item.path} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
                  textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'background 0.15s',
                  background: active ? (isDark ? 'rgba(74,122,171,0.2)' : '#EDF2F7') : 'transparent', color: active ? (isDark ? '#6B8DB5' : '#2B4C6F') : (isDark ? '#9ca3af' : '#6b7280'),
                }}>
                  <Icon size={20} />
                  {!collapsed && <span>{item.label[lang]}</span>}
                </Link>
              ) : (
                <button onClick={() => toggleMenu(item.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                  background: active ? (isDark ? 'rgba(74,122,171,0.2)' : '#EDF2F7') : 'transparent', color: active ? (isDark ? '#6B8DB5' : '#2B4C6F') : (isDark ? '#9ca3af' : '#6b7280'),
                  textAlign: isRTL ? 'right' : 'left',
                }}>
                  <Icon size={20} />
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1 }}>{item.label[lang]}</span>
                      <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </>
                  )}
                </button>
              )}

              {!collapsed && hasChildren && isOpen && visibleChildren.length > 0 && (
                <div style={{ paddingRight: 8, paddingLeft: 8, marginTop: 4, marginRight: isRTL ? 32 : 8, marginLeft: isRTL ? 8 : 32, borderRight: isRTL ? ('2px solid ' + (isDark ? '#2d3748' : '#E2E8F0')) : 'none', borderLeft: isRTL ? 'none' : ('2px solid ' + (isDark ? '#2d3748' : '#E2E8F0')) }}>
                  {visibleChildren.map(child => (
                    <Link key={child.id} to={child.path} style={{
                      display: 'block', padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
                      fontSize: 13, color: isActive(child.path) ? (isDark ? '#6B8DB5' : '#2B4C6F') : (isDark ? '#6b7280' : '#9ca3af'),
                      fontWeight: isActive(child.path) ? 600 : 400,
                      background: isActive(child.path) ? (isDark ? 'rgba(74,122,171,0.15)' : '#EDF2F740') : 'transparent',
                    }}>
                      {child.label[lang]}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid ' + (isDark ? '#2d3748' : '#e5e7eb') }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', justifyContent: 'center', padding: '8px',
          borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: isDark ? '#6b7280' : '#9ca3af',
        }}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
    </aside>
  );
}
