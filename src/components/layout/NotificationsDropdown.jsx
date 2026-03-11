import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchTodayReminders, markReminderDone } from '../../services/remindersService';
import { Bell, Phone, MessageCircle, MapPin, Users, Mail, Check, Clock, Loader2 } from 'lucide-react';

const ICONS = { call: Phone, whatsapp: MessageCircle, visit: MapPin, meeting: Users, email: Mail };
const COLORS = { call: '#10B981', whatsapp: '#25D366', visit: '#4A7AAB', meeting: '#8B5CF6', email: '#F59E0B' };
const LABELS = {
  call: { ar: 'مكالمة', en: 'Call' },
  whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  visit: { ar: 'زيارة', en: 'Visit' },
  meeting: { ar: 'اجتماع', en: 'Meeting' },
  email: { ar: 'بريد', en: 'Email' },
};

export default function NotificationsDropdown({ show, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const ref = useRef(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    fetchTodayReminders(profile?.id).then(data => {
      setReminders(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [show, profile?.id]);

  useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show, onClose]);

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
      className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-[340px] max-h-[420px] rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-xl dark:shadow-2xl z-[100] overflow-hidden ${isRTL ? 'direction-rtl' : 'direction-ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-[18px] py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-brand-500" />
          <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الإشعارات' : 'Notifications'}</span>
        </div>
        {reminders.length > 0 && (
          <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-2 py-px">{reminders.length}</span>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[340px] overflow-y-auto p-1.5">
        {loading ? (
          <div className="text-center py-8 text-content-muted dark:text-content-muted-dark">
            <Loader2 size={22} className="animate-spin mb-2 mx-auto" />
            <p className="m-0 text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-8 text-content-muted dark:text-content-muted-dark">
            <Check size={28} className="opacity-30 mb-2 mx-auto" />
            <p className="m-0 text-[13px]">{isRTL ? 'لا توجد متابعات اليوم' : 'No follow-ups today'}</p>
          </div>
        ) : (
          reminders.map(r => {
            const Icon = ICONS[r.type] || Phone;
            const color = COLORS[r.type] || '#4A7AAB';
            const label = LABELS[r.type] || LABELS.call;
            return (
              <div key={r.id} className="flex items-center gap-2.5 py-2.5 px-3 rounded-[10px] mb-0.5 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-brand-500/[0.08]">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: color + '18' }}
                >
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
                  <button
                    onClick={() => handleDone(r.id)}
                    title={isRTL ? 'تم' : 'Done'}
                    className="w-6 h-6 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 cursor-pointer flex items-center justify-center p-0"
                  >
                    <Check size={12} color="#10B981" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
