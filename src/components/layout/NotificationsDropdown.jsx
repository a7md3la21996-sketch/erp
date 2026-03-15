import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchTodayReminders, markReminderDone } from '../../services/remindersService';
import {
  getNotifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount,
  NOTIFICATION_TYPES,
} from '../../services/notificationService';
import {
  Bell, Phone, MessageCircle, MapPin, Users, Mail, Check, Clock, Loader2,
  UserPlus, CheckSquare, Trophy, TrendingUp, Info, CheckCheck, Trash2,
  AlertTriangle, XCircle, ArrowRightCircle, MessageSquare, AtSign, ShieldAlert,
  CheckCircle2, XOctagon, Receipt, AlertCircle, Download, Upload,
} from 'lucide-react';

const REMINDER_ICONS = { call: Phone, whatsapp: MessageCircle, visit: MapPin, meeting: Users, email: Mail };
const REMINDER_COLORS = { call: '#10B981', whatsapp: '#25D366', visit: '#4A7AAB', meeting: '#8B5CF6', email: '#F59E0B' };
const REMINDER_LABELS = {
  call: { ar: 'مكالمة', en: 'Call' },
  whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  visit: { ar: 'زيارة', en: 'Visit' },
  meeting: { ar: 'اجتماع', en: 'Meeting' },
  email: { ar: 'بريد', en: 'Email' },
};

const ICON_MAP = {
  Clock, AlertTriangle, Trophy, XCircle, ArrowRightCircle, MessageSquare,
  AtSign, ShieldAlert, CheckCircle2, XOctagon, Receipt, AlertCircle,
  Download, Upload, Bell, UserPlus, CheckSquare, TrendingUp, Info,
};

function getNotifIcon(type) {
  const cfg = NOTIFICATION_TYPES[type];
  if (!cfg) return Info;
  return ICON_MAP[cfg.icon] || Info;
}

function getNotifColor(type) {
  return NOTIFICATION_TYPES[type]?.color || '#6B7280';
}

function timeAgo(iso, isRTL) {
  if (!iso) return '';
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'now';
  if (mins < 60) return isRTL ? `${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `${hrs} س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isRTL ? `${days} ي` : `${days}d`;
  return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsDropdown({ show, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const ref = useRef(null);
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  const refresh = () => {
    const filter = activeTab === 'unread' ? { unreadOnly: true, limit: 30 }
      : activeTab === 'urgent' ? { priority: 'urgent', limit: 30 }
      : { limit: 30 };
    const { data } = getNotifications(filter);
    setNotifications(data);
  };

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    Promise.all([
      fetchTodayReminders(profile?.id).catch(() => []),
    ]).then(([rem]) => {
      setReminders(rem || []);
      refresh();
      setLoading(false);
    });
  }, [show, profile?.id, profile?.email]);

  // Refresh on tab change
  useEffect(() => { if (show) refresh(); }, [activeTab]);

  // Listen for notification changes
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_notification_changed', handler);
    window.addEventListener('platform_notification', handler);
    return () => {
      window.removeEventListener('platform_notification_changed', handler);
      window.removeEventListener('platform_notification', handler);
    };
  }, [activeTab]);

  // Click outside
  useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show, onClose]);

  const handleMarkAllRead = () => {
    markAllAsRead();
    refresh();
  };

  const handleClickNotif = (n) => {
    if (!n.read) markAsRead(n.id);
    if (n.action_url) {
      navigate(n.action_url);
      onClose();
    }
    refresh();
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteNotification(id);
    refresh();
  };

  const handleDone = async (id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    await markReminderDone(id).catch(() => {});
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!show) return null;

  const tabs = [
    { key: 'all', ar: 'الكل', en: 'All' },
    { key: 'unread', ar: 'غير مقروء', en: 'Unread' },
    { key: 'urgent', ar: 'عاجل', en: 'Urgent' },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div
      ref={ref}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'absolute',
        top: '100%',
        marginTop: 8,
        [isRTL ? 'left' : 'right']: 0,
        width: 380,
        maxHeight: 500,
        borderRadius: 14,
        background: isDark ? '#1a1f2e' : '#fff',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
        boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
        zIndex: 300,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.07)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} color="#6366f1" />
          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'الإشعارات' : 'Notifications'}
          </span>
          {unreadCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#fff',
              background: '#ef4444', borderRadius: 99, padding: '1px 7px',
              minWidth: 18, textAlign: 'center',
            }}>{unreadCount}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} title={isRTL ? 'قراءة الكل' : 'Mark all read'}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#6366f1', padding: 4, display: 'flex', alignItems: 'center',
              }}>
              <CheckCheck size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px 4px',
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              fontSize: 11, fontWeight: activeTab === t.key ? 600 : 400,
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
              background: activeTab === t.key ? '#6366f1' : 'transparent',
              color: activeTab === t.key ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
              transition: 'all 0.15s',
            }}>
            {isRTL ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: isDark ? '#64748b' : '#94a3b8' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : (
          <>
            {/* Reminders */}
            {activeTab === 'all' && reminders.map(r => {
              const Icon = REMINDER_ICONS[r.type] || Phone;
              const color = REMINDER_COLORS[r.type] || '#4A7AAB';
              const label = REMINDER_LABELS[r.type] || REMINDER_LABELS.call;
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  border: `1px solid ${isDark ? 'rgba(99,102,241,0.08)' : '#f1f5f9'}`,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: color + '18',
                  }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.entity_name || (isRTL ? 'جهة اتصال' : 'Contact')}
                    </div>
                    <div style={{
                      fontSize: 11, color: isDark ? '#64748b' : '#94a3b8',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {lang === 'ar' ? label.ar : label.en}{r.notes ? ' · ' + r.notes : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} />{formatTime(r.due_at)}
                    </span>
                    <button onClick={() => handleDone(r.id)} title={isRTL ? 'تم' : 'Done'}
                      style={{
                        width: 26, height: 26, borderRadius: 6, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                        border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#d1fae5'}`,
                        background: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
                      }}>
                      <Check size={12} color="#10B981" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Notifications */}
            {notifications.map(n => {
              const NIcon = getNotifIcon(n.type);
              const nColor = getNotifColor(n.type);
              const isHovered = hoveredId === n.id;
              const titleText = isRTL ? (n.title || n.title_ar) : (n.titleEn || n.title_en || n.title || n.title_ar);
              const bodyText = isRTL ? (n.message || n.body_ar) : (n.messageEn || n.body_en || n.message || n.body_ar);
              const isPriority = n.priority === 'urgent' || n.priority === 'high';

              return (
                <div
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, marginBottom: 2, cursor: 'pointer',
                    background: n.read
                      ? 'transparent'
                      : (isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)'),
                    border: `1px solid ${n.read ? 'transparent' : (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)')}`,
                    opacity: n.read ? 0.6 : 1,
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: nColor + '18',
                  }}>
                    <NIcon size={15} color={nColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {titleText}
                      {isPriority && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#fff',
                          background: n.priority === 'urgent' ? '#ef4444' : '#f97316',
                          borderRadius: 4, padding: '1px 5px',
                          textTransform: 'uppercase',
                        }}>
                          {n.priority === 'urgent' ? (isRTL ? 'عاجل' : 'URGENT') : (isRTL ? 'مهم' : 'HIGH')}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 11, color: isDark ? '#64748b' : '#94a3b8',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {bodyText}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, color: isDark ? '#475569' : '#cbd5e1' }}>
                      {timeAgo(n.created_at, isRTL)}
                    </span>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />}
                    {isHovered && (
                      <button onClick={(e) => handleDelete(e, n.id)} title={isRTL ? 'حذف' : 'Delete'}
                        style={{
                          width: 22, height: 22, borderRadius: 5, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                          border: 'none', background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                          color: '#ef4444',
                        }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {reminders.length === 0 && notifications.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '40px 0',
                color: isDark ? '#475569' : '#94a3b8',
              }}>
                <Bell size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد إشعارات' : 'No notifications'}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer - View All */}
      <div style={{
        borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`,
        padding: '10px 0',
        textAlign: 'center',
      }}>
        <button
          onClick={() => { navigate('/notifications'); onClose(); }}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#6366f1', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            padding: '4px 12px',
          }}>
          {isRTL ? 'عرض الكل' : 'View All'}
        </button>
      </div>
    </div>
  );
}
