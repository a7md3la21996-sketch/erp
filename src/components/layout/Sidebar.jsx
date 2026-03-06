import { useState } from 'react';
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
      background: '#fff', borderRight: isRTL ? 'none' : '1px solid #e5e7eb',
      borderLeft: isRTL ? '1px solid #e5e7eb' : 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb' }}>
        {collapsed ? (
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#2B4C6F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18 }}>P</div>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 'bold', color: '#2B4C6F' }}>Platform ERP</span>
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
                  background: active ? '#EDF2F7' : 'transparent', color: active ? '#2B4C6F' : '#6b7280',
                }}>
                  <Icon size={20} />
                  {!collapsed && <span>{item.label[lang]}</span>}
                </Link>
              ) : (
                <button onClick={() => toggleMenu(item.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                  background: active ? '#EDF2F7' : 'transparent', color: active ? '#2B4C6F' : '#6b7280',
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
                <div style={{ paddingRight: isRTL ? 12 : 0, paddingLeft: isRTL ? 0 : 12, marginTop: 4, borderRight: isRTL ? '2px solid #E2E8F0' : 'none', borderLeft: isRTL ? 'none' : '2px solid #E2E8F0', marginRight: isRTL ? 20 : 0, marginLeft: isRTL ? 0 : 20 }}>
                  {visibleChildren.map(child => (
                    <Link key={child.id} to={child.path} style={{
                      display: 'block', padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
                      fontSize: 13, color: isActive(child.path) ? '#2B4C6F' : '#9ca3af',
                      fontWeight: isActive(child.path) ? 600 : 400,
                      background: isActive(child.path) ? '#EDF2F740' : 'transparent',
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

      <div style={{ padding: 12, borderTop: '1px solid #e5e7eb' }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', justifyContent: 'center', padding: '8px',
          borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#9ca3af',
        }}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
    </aside>
  );
}
