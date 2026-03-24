/**
 * Custom Service Worker additions for Push Notifications
 * This file is imported by the PWA service worker.
 */

// Handle notification click — navigate to the relevant page
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If there's already a window open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => {
            if ('navigate' in c) return c.navigate(url);
          });
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});
