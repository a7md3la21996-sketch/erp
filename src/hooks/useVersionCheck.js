import { useEffect, useState } from 'react';

// Extract the build hash from the currently-loaded Vite bundle. Vite emits
// index.html with <script src="/assets/index-<hash>.js"> — we read that hash
// as the "version" the user is currently running.
function readCurrentHash() {
  try {
    const scripts = document.querySelectorAll('script[src*="/assets/"]');
    for (const s of scripts) {
      const m = s.src.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/);
      if (m) return m[1];
    }
  } catch { /* noop */ }
  return null;
}

// Fetch the live index.html from the server and extract its build hash.
// Returns null on error (e.g. offline) so the caller can skip that tick.
async function fetchLatestHash() {
  try {
    const res = await fetch(window.location.origin + '/?_v=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'text/html' },
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/);
    return m ? m[1] : null;
  } catch { return null; }
}

/**
 * Detects when a newer build has been deployed while the user's tab stayed open.
 * Polls every `intervalMs` and also on tab focus. When the live bundle hash on
 * the server differs from the one the tab is running, returns true so the UI
 * can show an update banner.
 *
 * No behavior in dev (Vite doesn't emit hashed bundles in dev mode).
 */
export function useVersionCheck({ intervalMs = 60_000 } = {}) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const current = readCurrentHash();
    if (!current) return; // dev mode / script tag missing — skip

    let stopped = false;

    const check = async () => {
      if (stopped || updateAvailable) return;
      const latest = await fetchLatestHash();
      if (!stopped && latest && latest !== current) {
        setUpdateAvailable(true);
      }
    };

    // Initial check shortly after mount
    const initTimer = setTimeout(check, 5_000);
    // Periodic poll
    const poll = setInterval(check, intervalMs);
    // Check when user focuses the tab (most likely moment for a stale tab)
    const onFocus = () => check();
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      clearTimeout(initTimer);
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, updateAvailable]);

  return updateAvailable;
}

/** Reload the current URL, bypassing cache. */
export function reloadForUpdate() {
  try {
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
    }
  } catch { /* noop */ }
  window.location.reload();
}
