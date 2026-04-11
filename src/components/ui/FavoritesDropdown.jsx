import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, X, Users, Target, Briefcase, FileText, Plus, BookOpen } from 'lucide-react';
import { getFavorites, removeFavorite, addFavorite } from '../../services/favoritesService';
import { NAV_ITEMS } from '../../config/navigation';

const TYPE_CONFIG = {
  page:        { labelAr: 'صفحات',   labelEn: 'Pages',         icon: FileText,  color: '#4A7AAB' },
  contact:     { labelAr: 'جهات اتصال', labelEn: 'Contacts',   icon: Users,     color: '#10B981' },
  deal:        { labelAr: 'صفقات',   labelEn: 'Deals',         icon: Briefcase, color: '#F59E0B' },
  opportunity: { labelAr: 'فرص',     labelEn: 'Opportunities',  icon: Target,    color: '#8B5CF6' },
};

export default function FavoritesDropdown({ show, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(null);
  const [favorites, setFavorites] = useState([]);

  const refresh = useCallback(() => {
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    if (show) refresh();
  }, [show, refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_favorites_changed', handler);
    return () => window.removeEventListener('platform_favorites_changed', handler);
  }, [refresh]);

  // Click outside
  useEffect(() => {
    if (!show) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show, onClose]);

  if (!show) return null;

  // Group by type
  const grouped = {};
  favorites.forEach(f => {
    if (!grouped[f.type]) grouped[f.type] = [];
    grouped[f.type].push(f);
  });

  const handleRemove = (e, id) => {
    e.stopPropagation();
    removeFavorite(id);
    refresh();
  };

  const handleClick = (fav) => {
    navigate(fav.path);
    onClose();
  };

  // Find current page info from NAV_ITEMS
  const findCurrentPage = () => {
    const path = location.pathname;
    for (const item of NAV_ITEMS) {
      if (item.path === path) {
        return { id: `page_${item.id}`, type: 'page', name: item.label.en, nameAr: item.label.ar, path: item.path };
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.path === path) {
            return { id: `page_${child.id}`, type: 'page', name: child.label.en, nameAr: child.label.ar, path: child.path };
          }
        }
      }
    }
    // Generic fallback
    return { id: `page_${path}`, type: 'page', name: path.split('/').pop() || 'Page', nameAr: path.split('/').pop() || 'صفحة', path };
  };

  const handleAddCurrentPage = () => {
    const page = findCurrentPage();
    addFavorite(page);
    refresh();
  };

  const currentPageAlreadyFav = favorites.some(f => f.path === location.pathname && f.type === 'page');
  const typeOrder = ['page', 'contact', 'opportunity', 'deal'];

  return (
    <div
      ref={ref}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        top: 56,
        left: 8,
        right: 8,
        maxWidth: 340,
        marginLeft: 'auto',
        maxHeight: 'calc(100vh - 80px)',
        background: isDark ? '#1a2332' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 14,
        boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={16} style={{ color: '#F59E0B' }} />
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: isDark ? '#e2e8f0' : '#1e293b',
          }}>
            {isRTL ? 'المفضلة' : 'Favorites'}
          </span>
          {favorites.length > 0 && (
            <span style={{
              fontSize: 11,
              background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
              color: '#4A7AAB',
              padding: '1px 7px',
              borderRadius: 10,
              fontWeight: 600,
            }}>
              {favorites.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: favorites.length === 0 ? '0' : '6px 0',
      }}>
        {favorites.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
          }}>
            <BookOpen size={32} style={{ color: isDark ? '#475569' : '#94a3b8', marginBottom: 10 }} />
            <p style={{
              margin: 0,
              fontSize: 13,
              color: isDark ? '#64748b' : '#94a3b8',
              fontWeight: 500,
            }}>
              {isRTL ? 'لا توجد مفضلات بعد' : 'No favorites yet'}
            </p>
            <p style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: isDark ? '#475569' : '#b0b8c4',
            }}>
              {isRTL ? 'أضف صفحات أو جهات اتصال أو فرص للوصول السريع' : 'Add pages, contacts, or opportunities for quick access'}
            </p>
          </div>
        ) : (
          typeOrder.map(type => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;
            const config = TYPE_CONFIG[type] || TYPE_CONFIG.page;
            const GroupIcon = config.icon;
            return (
              <div key={type} style={{ marginBottom: 2 }}>
                {/* Group header */}
                <div style={{
                  padding: '8px 16px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <GroupIcon size={12} style={{ color: config.color }} />
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: config.color,
                  }}>
                    {isRTL ? config.labelAr : config.labelEn}
                  </span>
                </div>
                {items.map(fav => (
                  <button
                    key={fav.id}
                    onClick={() => handleClick(fav)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      color: isDark ? '#e2e8f0' : '#1e293b',
                      background: 'transparent',
                      textAlign: isRTL ? 'right' : 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Star size={13} style={{ color: '#F59E0B', flexShrink: 0 }} fill="#F59E0B" />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {isRTL ? (fav.nameAr || fav.name) : fav.name}
                    </span>
                    <span
                      onClick={(e) => handleRemove(e, fav.id)}
                      style={{
                        flexShrink: 0,
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 5,
                        color: isDark ? '#64748b' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#64748b' : '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <X size={12} />
                    </span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Footer — Add current page */}
      {!currentPageAlreadyFav && (
        <div style={{
          padding: '10px 14px',
          borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <button
            onClick={handleAddCurrentPage}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: '100%',
              padding: '8px 12px',
              border: `1px dashed ${isDark ? 'rgba(74,122,171,0.3)' : 'rgba(74,122,171,0.25)'}`,
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 600,
              color: '#4A7AAB',
              background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)'; }}
          >
            <Plus size={14} />
            {isRTL ? 'إضافة الصفحة الحالية' : 'Add Current Page'}
          </button>
        </div>
      )}
    </div>
  );
}
