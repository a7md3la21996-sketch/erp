// Push notification service worker — handles FCM + Web Push
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Handle incoming push (works on both Android Chrome + iPhone PWA)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { notification: { title: 'Platform ERP', body: event.data?.text() || '' } }; }
  const notif = data.notification || {};
  const title = notif.title || data.data?.title || 'Platform ERP';
  const options = {
    body: notif.body || data.data?.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: data.data?.url || data.fcmOptions?.link || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
