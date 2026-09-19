// ── Permanent guard against stale bundles served by a stuck service worker ──
//
// The app deliberately keeps only ONE service worker: the Firebase messaging SW
// (push notifications). Any OTHER service worker — a leftover Workbox/PWA
// caching SW, or the old self-destruct `/sw.js` — can freeze a browser on an
// old build: deploys never reach it, the in-app update banner never fires (the
// SW hands back the cached index.html so the version check sees no change), and
// even a hard refresh is intercepted.
//
// On every boot we unregister anything that ISN'T the messaging SW, wipe the
// Cache Storage it populated, and reload ONCE onto the live build. Healthy users
// (only the messaging SW, or no SW at all) hit the no-op path — nothing removed,
// no reload. A session flag prevents any reload loop.

const RELOAD_FLAG = '__sw_cleaned_v1';
const isMessagingSW = (url) => !!url && url.includes('firebase-messaging-sw');

export function cleanupStaleServiceWorkers() {
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistrations) return;
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      let removed = false;
      for (const reg of regs) {
        const url = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
        if (!isMessagingSW(url)) {
          try { await reg.unregister(); removed = true; } catch { /* best effort */ }
        }
      }
      if (!removed) return; // healthy — nothing stale
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* best effort */ }
      // Reload once onto the fresh build; the flag stops a loop if unregister
      // somehow doesn't stick.
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch { window.location.reload(); }
    }).catch(() => { /* best effort */ });
  } catch { /* best effort */ }
}
