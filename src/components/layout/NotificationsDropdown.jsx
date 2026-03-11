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

  const border = isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb';
  const textPrimary = isDark ? '#E2EAF4' : '#1f2937';
  const textMuted = isDark ? '#8BA8C8' : '#6b7280';

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', marginTop: 8,
      [isRTL ? 'left' : 'right']: 0, width: 340, maxHeight: 420,
      borderRadius: 14, background: isDark ? '#1a2234' : '#ffffff',
      border: `1px solid ${border}`,
      boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
      zIndex: 100, overflow: 'hidden', direction: isRTL ? 'rtl' : 'ltr',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} color="#4A7AAB" />
          <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{isRTL ? 'الإشعارات' : 'Notifications'}</span>
        </div>
        {reminders.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#EF4444', borderRadius: 20, padding: '1px 8px' }}>{reminders.length}</span>
        )}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 340, overflowY: 'auto', padding: '6px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: textMuted }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: textMuted }}>
            <Check size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد متابعات اليوم' : 'No follow-ups today'}</p>
          </div>
        ) : (
          reminders.map(r => {
            const Icon = ICONS[r.type] || Phone;
            const color = COLORS[r.type] || '#4A7AAB';
            const label = LABELS[r.type] || LABELS.call;
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, marginBottom: 2,
                background: isDark ? 'rgba(255,255,255,0.03)' : '#fafbfc',
                border: `1px solid ${isDark ? 'rgba(74,122,171,0.08)' : '#f3f4f6'}`,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.entity_name || (isRTL ? 'جهة اتصال' : 'Contact')}
                  </div>
                  <div style={{ fontSize: 11, color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lang === 'ar' ? label.ar : label.en}{r.notes ? ' · ' + r.notes : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} />{formatTime(r.due_at)}
                  </span>
                  <button onClick={() => handleDone(r.id)} title={isRTL ? 'تم' : 'Done'} style={{
                    width: 24, height: 24, borderRadius: 6, border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#d1fae5'}`,
                    background: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}>
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
