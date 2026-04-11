import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Clock, X, User, Target, Award, Trash2, Inbox } from 'lucide-react';
import { getRecentItems, clearRecent, removeRecentItem } from '../../services/recentItemsService';

const TYPE_CONFIG = {
  contact:     { icon: User,   color: '#10B981', labelAr: 'جهة اتصال', labelEn: 'Contact' },
  opportunity: { icon: Target, color: '#8B5CF6', labelAr: 'فرصة',      labelEn: 'Opportunity' },
  deal:        { icon: Award,  color: '#F59E0B', labelAr: 'صفقة',      labelEn: 'Deal' },
  page:        { icon: Clock,  color: '#4A7AAB', labelAr: 'صفحة',      labelEn: 'Page' },
};

function relativeTime(dateStr, isRTL) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (isRTL) {
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  }
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function RecentItemsDropdown({ show, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const ref = useRef(null);
  const [items, setItems] = useState([]);

  const refresh = useCallback(() => {
    setItems(getRecentItems(20));
  }, []);

  useEffect(() => {
    if (show) refresh();
  }, [show, refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_recent_changed', handler);
    return () => window.removeEventListener('platform_recent_changed', handler);
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

  const handleClick = (item) => {
    navigate(item.path);
    onClose();
  };

  const handleRemove = (e, id) => {
    e.stopPropagation();
    removeRecentItem(id);
    refresh();
  };

  const handleClearAll = () => {
    clearRecent();
    refresh();
  };

  const getExtraText = (item) => {
    if (!item.extra) return null;
    const parts = [];
    if (item.type === 'contact') {
      if (item.extra.company) parts.push(item.extra.company);
      if (item.extra.type) parts.push(item.extra.type);
    } else if (item.type === 'deal') {
      if (item.extra.deal_value) parts.push(item.extra.deal_value);
      if (item.extra.status) parts.push(item.extra.status);
    } else if (item.type === 'opportunity') {
      if (item.extra.stage) parts.push(item.extra.stage);
      if (item.extra.budget) parts.push(item.extra.budget);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  return (
    <div
      ref={ref}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        top: 56,
        left: 8,
        right: 8,
        maxWidth: 360,
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
          <Clock size={16} style={{ color: '#4A7AAB' }} />
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: isDark ? '#e2e8f0' : '#1e293b',
          }}>
            {isRTL ? 'الأخيرة' : 'Recent'}
          </span>
          {items.length > 0 && (
            <span style={{
              fontSize: 11,
              background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
              color: '#4A7AAB',
              padding: '1px 7px',
              borderRadius: 10,
              fontWeight: 600,
            }}>
              {items.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: items.length === 0 ? '0' : '4px 0',
      }}>
        {items.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
          }}>
            <Inbox size={32} style={{ color: isDark ? '#475569' : '#94a3b8', marginBottom: 10 }} />
            <p style={{
              margin: 0,
              fontSize: 13,
              color: isDark ? '#64748b' : '#94a3b8',
              fontWeight: 500,
            }}>
              {isRTL ? 'لا توجد عناصر حديثة' : 'No recent items'}
            </p>
            <p style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: isDark ? '#475569' : '#b0b8c4',
            }}>
              {isRTL ? 'العناصر التي تفتحها ستظهر هنا' : 'Items you open will appear here'}
            </p>
          </div>
        ) : (
          items.map(item => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.page;
            const Icon = config.icon;
            const extraText = getExtraText(item);
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  padding: '9px 16px',
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
                {/* Type icon */}
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: config.color + '15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  <Icon size={14} style={{ color: config.color }} />
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  }}>
                    {isRTL ? (item.nameAr || item.name) : item.name}
                  </div>
                  {extraText && (
                    <div style={{
                      fontSize: 11,
                      color: isDark ? '#64748b' : '#94a3b8',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {extraText}
                    </div>
                  )}
                  <div style={{
                    fontSize: 10,
                    color: isDark ? '#475569' : '#b0b8c4',
                    marginTop: 2,
                  }}>
                    {relativeTime(item.accessed_at, isRTL)}
                  </div>
                </div>
                {/* Remove button */}
                <span
                  onClick={(e) => handleRemove(e, item.id)}
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 5,
                    color: isDark ? '#475569' : '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginTop: 4,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#475569' : '#cbd5e1'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <X size={12} />
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer — Clear All */}
      {items.length > 0 && (
        <div style={{
          padding: '10px 14px',
          borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <button
            onClick={handleClearAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'}`,
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 600,
              color: '#EF4444',
              background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)'; }}
          >
            <Trash2 size={13} />
            {isRTL ? 'مسح الكل' : 'Clear All'}
          </button>
        </div>
      )}
    </div>
  );
}
