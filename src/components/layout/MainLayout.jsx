import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import GlobalFilterBar from './GlobalFilterBar';
import ProductTour from '../ui/ProductTour';
import BottomNav from './BottomNav';
import { onError } from '../../utils/errorReporter';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function MainLayout() {
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isMobile = useIsMobile();

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Firebase push notifications + Supabase realtime fallback
  useEffect(() => {
    let channel;
    // 1. Setup Firebase FCM
    const userId = profile?.id;
    import('../../lib/firebase').then(({ getFCMToken, onForegroundMessage }) => {
      getFCMToken().then(token => {
        if (token && userId) {
          // Save token to Supabase — support multiple devices (fcm_tokens array)
          import('../../lib/supabase').then(({ default: supabase }) => {
            supabase.from('users').select('fcm_tokens').eq('id', userId).maybeSingle().then(({ data }) => {
              const existing = Array.isArray(data?.fcm_tokens) ? data.fcm_tokens : [];
              if (!existing.includes(token)) {
                const updated = [...existing, token].slice(-5); // keep last 5 devices
                supabase.from('users').update({ fcm_token: token, fcm_tokens: updated }).eq('id', userId).then(() => {
                  console.log('[FCM] Token saved for user', userId, '(' + updated.length + ' devices)');
                }).catch(() => {});
              } else {
                console.log('[FCM] Token already registered');
              }
            }).catch(() => {
              // fcm_tokens column might not exist yet, fallback to single token
              supabase.from('users').update({ fcm_token: token }).eq('id', userId).then(() => {
                console.log('[FCM] Token saved (single) for user', userId);
              }).catch(() => {});
            });
          }).catch(() => {});
        }
      }).catch(() => {});
      // Handle foreground messages from FCM
      onForegroundMessage((payload) => {
        const title = payload.notification?.title || payload.data?.title || 'Platform ERP';
        const body = payload.notification?.body || payload.data?.body || '';
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, { body, icon: '/pwa-192.png', badge: '/pwa-192.png', dir: 'rtl', vibrate: [200, 100, 200], data: { url: payload.data?.url || '/' } });
          });
        }
      });
    }).catch(() => {});

    // 2. Supabase Realtime for push notifications
    import('../../lib/supabase').then(({ default: supabase }) => {
      channel = supabase
        .channel('push-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
          const n = payload.new;
          if (!n) return;
          // Check if this notification is for the current user
          const myId = profile?.id;
          const forUser = n.for_user_id;
          const forName = n.for_user_name;
          const myNameEn = profile?.full_name_en;
          const myNameAr = profile?.full_name_ar;
          const isForMe = !forUser || forUser === 'all' || forUser === myId
            || forUser === myNameEn || forUser === myNameAr
            || forName === myNameEn || forName === myNameAr;
          if (!isForMe) return;
          // Update bell icon immediately
          window.dispatchEvent(new CustomEvent('platform_notification_changed'));
          window.dispatchEvent(new CustomEvent('platform_notification', { detail: n }));
          // Show push notification
          if ('Notification' in window && Notification.permission === 'granted') {
            const title = n.title_ar || n.title_en || 'Platform ERP';
            const body = n.body_ar || n.body_en || '';
            console.log('[Push] Showing notification:', title);
            try {
              new Notification(title, { body, icon: '/pwa-192.png', dir: 'rtl', tag: n.id || String(Date.now()) });
            } catch (e) { console.error('[Push] Notification error:', e); }
          }
        })
        .subscribe((status) => {
          console.log('[Push] Realtime subscription status:', status);
        });
    }).catch((err) => console.error('[Push] Realtime setup failed:', err));
    return () => { if (channel) import('../../lib/supabase').then(({ default: supabase }) => supabase.removeChannel(channel)).catch(() => {}); };
  }, [profile?.id]);

  // Global error banner for service failures
  const [serviceError, setServiceError] = useState(null);
  useEffect(() => {
    return onError((entry) => {
      setServiceError(entry);
      setTimeout(() => setServiceError(null), 6000);
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-surface-bg-dark overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div
        className="transition-[margin] duration-300 overflow-x-hidden"
        style={{ marginInlineStart: isMobile ? 0 : (collapsed ? 72 : 260) }}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <GlobalFilterBar />
        <main className="pb-[64px] md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
      {/* <ProductTour /> — disabled until launch */}
      {serviceError && (
        <div className="fixed bottom-4 start-4 z-[400] bg-amber-500/95 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium max-w-[360px] animate-[slideUp_0.3s_ease-out]">
          ⚠️ {isRTL ? 'تعذر الاتصال بالسيرفر — البيانات المعروضة قد تكون قديمة' : 'Server connection failed — displayed data may be stale'}
          <span className="block mt-1 opacity-70">{serviceError.service}: {serviceError.operation}</span>
        </div>
      )}
    </div>
  );
}
