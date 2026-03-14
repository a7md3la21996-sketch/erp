import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '../../utils/hooks';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchTodayReminders, markReminderDone } from '../../services/remindersService';
import { getNotifications, markAsRead, markAllAsRead } from '../../services/notificationsService';
import { Bell, Phone, MessageCircle, MapPin, Users, Mail, Check, Clock, Loader2, UserPlus, CheckSquare, Trophy, TrendingUp, Info, CheckCheck } from 'lucide-react';

const ICONS = { call: Phone, whatsapp: MessageCircle, visit: MapPin, meeting: Users, email: Mail };
const COLORS = { call: '#10B981', whatsapp: '#25D366', visit: '#4A7AAB', meeting: '#8B5CF6', email: '#F59E0B' };
const LABELS = {
  call: { ar: 'مكالمة', en: 'Call' },
  whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  visit: { ar: 'زيارة', en: 'Visit' },
  meeting: { ar: 'اجتماع', en: 'Meeting' },
  email: { ar: 'بريد', en: 'Email' },
};
const NOTIF_ICONS = { lead_assigned: UserPlus, task_assigned: CheckSquare, reminder: Bell, deal_won: Trophy, opportunity_update: TrendingUp, system: Info };
const NOTIF_COLORS = { lead_assigned: '#4A7AAB', task_assigned: '#F59E0B', reminder: '#6B21A8', deal_won: '#10B981', opportunity_update: '#4A7AAB', system: '#6B7280' };

export default function NotificationsDropdown({ show, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const ref = useRef(null);
  const [reminders, setReminders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeSection, setActiveSection] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    Promise.all([
      fetchTodayReminders(profile?.id).catch(() => []),
    ]).then(([rem]) => {
      setReminders(rem || []);
      setNotifications(getNotifications(profile?.id || profile?.email, { limit: 30 }));
      setLoading(false);
    });
  }, [show, profile?.id, profile?.email]);

  // Listen for new notifications
  useEffect(() => {
    const handler = () => {
      setNotifications(getNotifications(profile?.id || profile?.email, { limit: 30 }));
    };
    window.addEventListener('platform_notification', handler);
    return () => window.removeEventListener('platform_notification', handler);
  }, [profile?.id, profile?.email]);

  const handleMarkAllRead = () => {
    markAllAsRead(profile?.id || profile?.email);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkRead = (id) => {
    markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  useClickOutside(ref, onClose, show);

  const handleDone = async (id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    await markReminderDone(id).catch(() => {});
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!show) return null;

  return (
    <div
      ref={ref}
      className={`absolute top-full mt-2 end-0 w-[340px] max-h-[420px] rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-xl dark:shadow-2xl z-[100] overflow-hidden ${isRTL ? 'direction-rtl' : 'direction-ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-[18px] py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-brand-500" />
          <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الإشعارات' : 'Notifications'}</span>
        </div>
        <div className="flex items-center gap-2">
          {(reminders.length + notifications.filter(n => !n.read).length) > 0 && (
            <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-2 py-px">{reminders.length + notifications.filter(n => !n.read).length}</span>
          )}
          {notifications.some(n => !n.read) && (
            <button onClick={handleMarkAllRead} title={isRTL ? 'قراءة الكل' : 'Mark all read'} className="bg-transparent border-none cursor-pointer text-brand-500 p-0">
              <CheckCheck size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Section Toggle */}
      <div className="flex gap-1 px-2 pt-2">
        {[
          { key: 'all', ar: 'الكل', en: 'All' },
          { key: 'reminders', ar: 'المتابعات', en: 'Follow-ups' },
          { key: 'notifications', ar: 'الإشعارات', en: 'Alerts' },
        ].map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`text-[10px] px-2.5 py-1 rounded-md border-none cursor-pointer font-medium ${activeSection === s.key ? 'bg-brand-500 text-white' : 'bg-transparent text-content-muted dark:text-content-muted-dark'}`}
          >{isRTL ? s.ar : s.en}</button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-[340px] overflow-y-auto p-1.5">
        {loading ? (
          <div className="text-center py-8 text-content-muted dark:text-content-muted-dark">
            <Loader2 size={22} className="animate-spin mb-2 mx-auto" />
            <p className="m-0 text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : (
          <>
            {/* Reminders */}
            {(activeSection === 'all' || activeSection === 'reminders') && reminders.map(r => {
              const Icon = ICONS[r.type] || Phone;
              const color = COLORS[r.type] || '#4A7AAB';
              const label = LABELS[r.type] || LABELS.call;
              return (
                <div key={r.id} className="flex items-center gap-2.5 py-2.5 px-3 rounded-[10px] mb-0.5 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-brand-500/[0.08]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '18' }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-content dark:text-content-dark whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.entity_name || (isRTL ? 'جهة اتصال' : 'Contact')}
                    </div>
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark whitespace-nowrap overflow-hidden text-ellipsis">
                      {lang === 'ar' ? label.ar : label.en}{r.notes ? ' · ' + r.notes : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark flex items-center gap-[3px]">
                      <Clock size={10} />{formatTime(r.due_at)}
                    </span>
                    <button onClick={() => handleDone(r.id)} title={isRTL ? 'تم' : 'Done'} className="w-6 h-6 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 cursor-pointer flex items-center justify-center p-0">
                      <Check size={12} color="#10B981" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Notifications */}
            {(activeSection === 'all' || activeSection === 'notifications') && notifications.map(n => {
              const NIcon = NOTIF_ICONS[n.type] || Info;
              const nColor = NOTIF_COLORS[n.type] || '#6B7280';
              return (
                <div key={n.id} onClick={() => handleMarkRead(n.id)} className={`flex items-center gap-2.5 py-2.5 px-3 rounded-[10px] mb-0.5 cursor-pointer border ${n.read ? 'bg-transparent border-transparent opacity-60' : 'bg-brand-500/[0.04] border-brand-500/10'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: nColor + '18' }}>
                    <NIcon size={15} color={nColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-content dark:text-content-dark whitespace-nowrap overflow-hidden text-ellipsis">
                      {isRTL ? n.title_ar : n.title_en}
                    </div>
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark whitespace-nowrap overflow-hidden text-ellipsis">
                      {isRTL ? n.body_ar : n.body_en}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-content-muted dark:text-content-muted-dark">
                      {new Date(n.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {reminders.length === 0 && notifications.length === 0 && (
              <div className="text-center py-8 text-content-muted dark:text-content-muted-dark">
                <Check size={28} className="opacity-30 mb-2 mx-auto" />
                <p className="m-0 text-[13px]">{isRTL ? 'لا توجد إشعارات' : 'No notifications'}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
