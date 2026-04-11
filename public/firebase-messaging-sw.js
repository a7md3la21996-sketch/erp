// Firebase Messaging Service Worker — handles background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCFHeg4uQmPhE9xqg4WuNasZywYaLKVytA",
  authDomain: "platform-erp-7866d.firebaseapp.com",
  projectId: "platform-erp-7866d",
  storageBucket: "platform-erp-7866d.firebasestorage.app",
  messagingSenderId: "415901006793",
  appId: "1:415901006793:web:6751347e374d382fee4618"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Platform ERP';
  const body = payload.notification?.body || payload.data?.body || '';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    dir: 'rtl',
    vibrate: [200, 100, 200],
    data: { url },
  });
});

// Handle notification click
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
