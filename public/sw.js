// Self-destructing service worker.
//
// The app used vite-plugin-pwa (Workbox) which registered a caching SW at
// `/sw.js` (scope `/`). That plugin was removed in d4528a33 because it served
// stale bundles — BUT removing it from the build does NOT unregister the SW
// already installed in users' browsers. Those orphaned SWs keep serving a
// FROZEN old app: deploys never reach them, the in-app "update available"
// banner never fires (the SW hands back the old index.html, so the version
// check sees no change), and even a hard refresh is intercepted.
//
// A browser re-fetches the SW SCRIPT itself on navigation (independent of the
// page the SW serves), so shipping this file at the same `/sw.js` path lets the
// browser pick it up, install it, wipe every cache, unregister the SW, and
// reload open windows onto the live build. Fresh visitors never registered
// `/sw.js`, so they never fetch this — it only frees the stuck ones.
//
// Keep this file here permanently; deleting it would 404 the update check and
// strand anyone who still hasn't been freed.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* best effort */ }
    try {
      await self.registration.unregister();
    } catch (e) { /* best effort */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch (e) { /* best effort */ }
  })());
});
