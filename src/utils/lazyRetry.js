// Lazy-load wrapper that recovers from "MIME type" / "Failed to fetch"
// chunk errors after a new deploy.
//
// When a user has the app open and we ship a new build, their HTML
// still references chunk filenames with the OLD hash. Navigating to a
// route whose chunk file no longer exists makes the server return the
// SPA fallback (index.html, Content-Type: text/html) — and the browser
// rejects loading HTML as a JavaScript module. The error surfaces as
// "'text/html' is not a valid JavaScript MIME type." in Safari or
// "MIME type of \"text/html\"" in Chrome.
//
// This wrapper detects that specific failure and forces a one-time
// reload (with sessionStorage throttle so we don't loop) to pick up
// the fresh HTML pointing at the new chunk filenames.

import { lazy } from 'react';

export default function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch((err) => {
      const msg = err?.message || '';
      const isChunkError =
        msg.includes('Failed to fetch')
        || msg.includes('Loading chunk')
        || msg.includes('MIME type')
        || msg.includes('Importing a module')
        || msg.includes('dynamically imported')
        || err?.name === 'ChunkLoadError';
      if (isChunkError) {
        const lastReload = Number(sessionStorage.getItem('chunk_reload') || '0');
        if (Date.now() - lastReload > 10000) {
          sessionStorage.setItem('chunk_reload', String(Date.now()));
          if ('caches' in window) {
            caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
          }
          window.location.reload(true);
          return new Promise(() => {});
        }
      }
      throw err;
    })
  );
}
