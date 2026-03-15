import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAll,
  getNotificationPreferences, setNotificationPreferences,
  searchNotifications, NOTIFICATION_TYPES, DEFAULT_PREFERENCES,
} from '../services/notificationService';
import {
  Bell, Trash2, CheckCheck, Search, Filter, Settings, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, Trophy, XCircle, ArrowRightCircle, MessageSquare, AtSign,
  ShieldAlert, CheckCircle2, XOctagon, Receipt, AlertCircle, Download, Upload,
  UserPlus, CheckSquare, TrendingUp, Info, Check, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ICON_MAP = {
  Clock, AlertTriangle, Trophy, XCircle, ArrowRightCircle, MessageSquare,
  AtSign, ShieldAlert, CheckCircle2, XOctagon, Receipt, AlertCircle,
  Download, Upload, Bell, UserPlus, CheckSquare, TrendingUp, Info,
};

function getIcon(type) {
  const cfg = NOTIFICATION_TYPES[type];
  return ICON_MAP[cfg?.icon] || Info;
}
function getColor(type) {
  return NOTIFICATION_TYPES[type]?.color || '#6B7280';
}

const TYPE_LABELS = {
  task_due:           { ar: 'مهمة مستحقة', en: 'Task Due' },
  task_overdue:       { ar: 'مهمة متأخرة', en: 'Task Overdue' },
  opportunity_won:    { ar: 'فرصة ناجحة', en: 'Opportunity Won' },
  opportunity_lost:   { ar: 'فرصة خاسرة', en: 'Opportunity Lost' },
  stage_change:       { ar: 'تغيير مرحلة', en: 'Stage Change' },
  new_comment:        { ar: 'تعليق جديد', en: 'New Comment' },
  mention:            { ar: 'إشارة', en: 'Mention' },
  approval_needed:    { ar: 'موافقة مطلوبة', en: 'Approval Needed' },
  approval_approved:  { ar: 'تمت الموافقة', en: 'Approved' },
  approval_rejected:  { ar: 'تم الرفض', en: 'Rejected' },
  expense_submitted:  { ar: 'مصروف مقدم', en: 'Expense Submitted' },
  system_alert:       { ar: 'تنبيه نظام', en: 'System Alert' },
  reminder:           { ar: 'تذكير', en: 'Reminder' },
  import_complete:    { ar: 'استيراد مكتمل', en: 'Import Complete' },
  export_complete:    { ar: 'تصدير مكتمل', en: 'Export Complete' },
  lead_assigned:      { ar: 'ليد جديد', en: 'Lead Assigned' },
  task_assigned:      { ar: 'مهمة معينة', en: 'Task Assigned' },
  deal_won:           { ar: 'صفقة ناجحة', en: 'Deal Won' },
  opportunity_update: { ar: 'تحديث فرصة', en: 'Opportunity Update' },
  system:             { ar: 'نظام', en: 'System' },
};

const PRIORITY_LABELS = {
  low:    { ar: 'منخفض', en: 'Low' },
  medium: { ar: 'متوسط', en: 'Medium' },
  high:   { ar: 'مهم', en: 'High' },
  urgent: { ar: 'عاجل', en: 'Urgent' },
};

const PRIORITY_COLORS = {
  low: '#22c55e',
  medium: '#3b82f6',
  high: '#f97316',
  urgent: '#ef4444',
};

const PER_PAGE = 25;

function timeAgo(iso, isRTL) {
  if (!iso) return '';
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} دقيقة` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('notifications'); // 'notifications' | 'settings'
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterRead, setFilterRead] = useState('all'); // 'all' | 'unread' | 'read'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);

  const refresh = useCallback(() => {
    if (searchQuery.trim()) {
      const results = searchNotifications(searchQuery);
      let filtered = results;
      if (filterType) filtered = filtered.filter(n => n.type === filterType);
      if (filterPriority) filtered = filtered.filter(n => n.priority === filterPriority);
      if (filterRead === 'unread') filtered = filtered.filter(n => !n.read);
      if (filterRead === 'read') filtered = filtered.filter(n => n.read);
      setTotal(filtered.length);
      setNotifications(filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE));
    } else {
      // Build filter for getNotifications
      const opts = { limit: PER_PAGE, offset: page * PER_PAGE };
      if (filterRead === 'unread') opts.unreadOnly = true;
      if (filterType) opts.type = filterType;
      if (filterPriority) opts.priority = filterPriority;
      const { data, total: t } = getNotifications(opts);
      // If read filter, we need to additionally filter
      let finalData = data;
      if (filterRead === 'read') {
        const all = getNotifications({ ...opts, limit: 999 });
        const readOnly = all.data.filter(n => n.read);
        setTotal(readOnly.length);
        finalData = readOnly.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
      } else {
        setTotal(t);
        finalData = data;
      }
      setNotifications(finalData);
    }
    setSelectedIds(new Set());
  }, [searchQuery, filterType, filterPriority, filterRead, page]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_notification_changed', handler);
    window.addEventListener('platform_notification', handler);
    return () => {
      window.removeEventListener('platform_notification_changed', handler);
      window.removeEventListener('platform_notification', handler);
    };
  }, [refresh]);

  // Load prefs
  useEffect(() => {
    setPrefs(getNotificationPreferences());
  }, []);

  const totalPages = Math.ceil(total / PER_PAGE);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const handleBulkRead = () => {
    selectedIds.forEach(id => markAsRead(id));
    refresh();
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteNotification(id));
    refresh();
  };

  const handleClearAll = () => {
    clearAll();
    refresh();
  };

  const handlePrefToggle = (type) => {
    const updated = { ...prefs, [type]: !prefs[type] };
    setPrefs(updated);
    setNotificationPreferences(updated);
  };

  // Styles
  const cardBg = isDark ? '#1a1f2e' : '#fff';
  const cardBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? '#0f1219' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#475569' : '#cbd5e1';

  const selectStyle = {
    appearance: 'none',
    WebkitAppearance: 'none',
    background: inputBg,
    color: textPrimary,
    border: `1px solid ${inputBorder}`,
    borderRadius: 8,
    padding: '8px 28px 8px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
    minWidth: 130,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${isRTL ? '8px' : 'calc(100% - 10px)'} center`,
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 24px 40px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(99,102,241,0.1)',
          }}>
            <Bell size={20} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'مركز الإشعارات' : 'Notifications Center'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: textSecondary }}>
              {isRTL ? `${total} إشعار` : `${total} notification${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveView(activeView === 'settings' ? 'notifications' : 'settings')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              border: `1px solid ${activeView === 'settings' ? '#6366f1' : inputBorder}`,
              background: activeView === 'settings' ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: activeView === 'settings' ? '#6366f1' : textSecondary,
            }}
          >
            <Settings size={15} />
            {isRTL ? 'الإعدادات' : 'Settings'}
          </button>
          {activeView === 'notifications' && (
            <button
              onClick={handleClearAll}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'}`,
                background: 'transparent',
                color: '#ef4444',
              }}
            >
              <Trash2 size={15} />
              {isRTL ? 'مسح الكل' : 'Clear All'}
            </button>
          )}
        </div>
      </div>

      {activeView === 'settings' ? (
        /* ── Settings Tab ── */
        <div style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
          padding: 24,
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'تفضيلات الإشعارات' : 'Notification Preferences'}
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: textSecondary }}>
            {isRTL ? 'اختر أنواع الإشعارات التي تريد تلقيها' : 'Choose which notification types you want to receive'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {Object.keys(NOTIFICATION_TYPES).map(type => {
              const Icon = ICON_MAP[NOTIFICATION_TYPES[type].icon] || Info;
              const color = NOTIFICATION_TYPES[type].color;
              const label = TYPE_LABELS[type] || { ar: type, en: type };
              const enabled = prefs[type] !== false;
              return (
                <div key={type} onClick={() => handlePrefToggle(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: enabled
                      ? (isDark ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.03)')
                      : 'transparent',
                    border: `1px solid ${enabled ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)') : cardBorder}`,
                    transition: 'all 0.15s',
                    opacity: enabled ? 1 : 0.5,
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: color + '18',
                  }}>
                    <Icon size={15} color={color} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: textPrimary }}>
                    {isRTL ? label.ar : label.en}
                  </span>
                  {/* Toggle */}
                  <div style={{
                    width: 38, height: 22, borderRadius: 11, position: 'relative',
                    background: enabled ? '#6366f1' : (isDark ? '#334155' : '#cbd5e1'),
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      [isRTL ? 'right' : 'left']: enabled ? 19 : 3,
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Notifications List ── */
        <>
          {/* Filter Bar */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 200 }}>
              <Search size={15} style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                [isRTL ? 'right' : 'left']: 12, color: textMuted,
              }} />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder={isRTL ? 'بحث في الإشعارات...' : 'Search notifications...'}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `8px 12px 8px ${isRTL ? '12px' : '36px'}`,
                  [isRTL ? 'paddingRight' : 'paddingLeft']: 36,
                  background: inputBg, border: `1px solid ${inputBorder}`,
                  borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
                  color: textPrimary, outline: 'none',
                }}
              />
            </div>

            {/* Type filter */}
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0); }} style={selectStyle}>
              <option value="">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
              {Object.keys(TYPE_LABELS).map(t => (
                <option key={t} value={t}>{isRTL ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}</option>
              ))}
            </select>

            {/* Priority filter */}
            <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(0); }} style={selectStyle}>
              <option value="">{isRTL ? 'كل الأولويات' : 'All Priorities'}</option>
              {Object.keys(PRIORITY_LABELS).map(p => (
                <option key={p} value={p}>{isRTL ? PRIORITY_LABELS[p].ar : PRIORITY_LABELS[p].en}</option>
              ))}
            </select>

            {/* Read/Unread toggle */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${inputBorder}` }}>
              {[
                { key: 'all', ar: 'الكل', en: 'All' },
                { key: 'unread', ar: 'غير مقروء', en: 'Unread' },
                { key: 'read', ar: 'مقروء', en: 'Read' },
              ].map(opt => (
                <button key={opt.key} onClick={() => { setFilterRead(opt.key); setPage(0); }}
                  style={{
                    padding: '7px 14px', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: filterRead === opt.key ? 600 : 400,
                    fontFamily: 'inherit',
                    background: filterRead === opt.key ? '#6366f1' : inputBg,
                    color: filterRead === opt.key ? '#fff' : textSecondary,
                  }}>
                  {isRTL ? opt.ar : opt.en}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
              padding: '10px 16px', borderRadius: 10,
              background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
              border: `1px solid ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: textPrimary }}>
                {isRTL ? `${selectedIds.size} محدد` : `${selectedIds.size} selected`}
              </span>
              <button onClick={handleBulkRead}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary,
                }}>
                <CheckCheck size={14} />
                {isRTL ? 'تعيين كمقروء' : 'Mark Read'}
              </button>
              <button onClick={handleBulkDelete}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444',
                }}>
                <Trash2 size={14} />
                {isRTL ? 'حذف' : 'Delete'}
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                style={{
                  display: 'flex', alignItems: 'center', padding: 4,
                  borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: textSecondary,
                  marginInlineStart: 'auto',
                }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Select All + Mark All Read */}
          {notifications.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8, padding: '0 4px',
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontSize: 12, color: textSecondary,
              }}>
                <input type="checkbox"
                  checked={selectedIds.size === notifications.length && notifications.length > 0}
                  onChange={toggleSelectAll}
                  style={{ accentColor: '#6366f1', width: 15, height: 15, cursor: 'pointer' }}
                />
                {isRTL ? 'تحديد الكل' : 'Select All'}
              </label>
              <button onClick={() => { markAllAsRead(); refresh(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                  border: 'none', background: 'transparent', color: '#6366f1',
                }}>
                <CheckCheck size={13} />
                {isRTL ? 'قراءة الكل' : 'Mark All Read'}
              </button>
            </div>
          )}

          {/* Notification Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notifications.map(n => {
              const NIcon = getIcon(n.type);
              const nColor = getColor(n.type);
              const titleText = isRTL ? (n.title || n.title_ar) : (n.titleEn || n.title_en || n.title || n.title_ar);
              const bodyText = isRTL ? (n.message || n.body_ar) : (n.messageEn || n.body_en || n.message || n.body_ar);
              const typeLabel = TYPE_LABELS[n.type] || { ar: n.type, en: n.type };
              const priorityColor = PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.medium;
              const isSelected = selectedIds.has(n.id);

              return (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px', borderRadius: 12,
                  background: isSelected
                    ? (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)')
                    : n.read ? cardBg : (isDark ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.02)'),
                  border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : (n.read ? cardBorder : (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'))}`,
                  opacity: n.read ? 0.7 : 1,
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}>
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(n.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: '#6366f1', width: 15, height: 15, marginTop: 4, cursor: 'pointer', flexShrink: 0 }}
                  />

                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: nColor + '15',
                  }}>
                    <NIcon size={18} color={nColor} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}
                    onClick={() => {
                      if (!n.read) markAsRead(n.id);
                      if (n.action_url) navigate(n.action_url);
                      refresh();
                    }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
                        {titleText}
                      </span>
                      {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: nColor,
                        background: nColor + '15', padding: '2px 8px', borderRadius: 4,
                      }}>
                        {isRTL ? typeLabel.ar : typeLabel.en}
                      </span>
                      {n.priority && n.priority !== 'medium' && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#fff',
                          background: priorityColor, borderRadius: 4, padding: '2px 6px',
                          textTransform: 'uppercase',
                        }}>
                          {isRTL ? PRIORITY_LABELS[n.priority]?.ar : PRIORITY_LABELS[n.priority]?.en}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: '0 0 6px', fontSize: 13, color: textSecondary, lineHeight: 1.5,
                    }}>
                      {bodyText}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />
                        {timeAgo(n.created_at, isRTL)}
                      </span>
                      {n.entity && (
                        <span style={{
                          fontSize: 10, color: textMuted,
                          background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                          padding: '2px 8px', borderRadius: 4,
                        }}>
                          {n.entity}
                          {n.entityId || n.entity_id ? ` #${n.entityId || n.entity_id}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    {!n.read && (
                      <button onClick={(e) => { e.stopPropagation(); markAsRead(n.id); refresh(); }}
                        title={isRTL ? 'تعيين كمقروء' : 'Mark as read'}
                        style={{
                          width: 28, height: 28, borderRadius: 6, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                          border: `1px solid ${inputBorder}`, background: inputBg, color: '#6366f1',
                        }}>
                        <Check size={13} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); refresh(); }}
                      title={isRTL ? 'حذف' : 'Delete'}
                      style={{
                        width: 28, height: 28, borderRadius: 6, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                        border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
                        color: '#ef4444',
                      }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {notifications.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 0',
              color: textMuted,
            }}>
              <Bell size={48} style={{ opacity: 0.15, marginBottom: 12 }} />
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: textSecondary }}>
                {isRTL ? 'لا توجد إشعارات' : 'No notifications'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: textMuted }}>
                {searchQuery || filterType || filterPriority || filterRead !== 'all'
                  ? (isRTL ? 'حاول تعديل الفلاتر' : 'Try adjusting your filters')
                  : (isRTL ? 'ستظهر إشعاراتك هنا' : 'Your notifications will appear here')
                }
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              marginTop: 20, padding: '12px 0',
            }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '7px 14px', borderRadius: 8, cursor: page === 0 ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  border: `1px solid ${inputBorder}`, background: inputBg,
                  color: page === 0 ? textMuted : textPrimary,
                  opacity: page === 0 ? 0.5 : 1,
                }}>
                {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                {isRTL ? 'السابق' : 'Previous'}
              </button>
              <span style={{ fontSize: 13, color: textSecondary }}>
                {isRTL
                  ? `صفحة ${page + 1} من ${totalPages}`
                  : `Page ${page + 1} of ${totalPages}`
                }
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '7px 14px', borderRadius: 8, cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  border: `1px solid ${inputBorder}`, background: inputBg,
                  color: page >= totalPages - 1 ? textMuted : textPrimary,
                  opacity: page >= totalPages - 1 ? 0.5 : 1,
                }}>
                {isRTL ? 'التالي' : 'Next'}
                {isRTL ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
