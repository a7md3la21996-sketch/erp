/**
 * Centralized error reporter for service layer.
 * Instead of silently swallowing errors, services should call reportError()
 * so the UI can show a stale-data indicator.
 */

const STORAGE_KEY = 'platform_last_errors';
const MAX_ERRORS = 20;

let _listeners = [];

export function reportError(service, operation, error) {
  const msg = error?.message || String(error);
  // Skip non-critical errors (missing tables, network hiccups)
  if (msg.includes('relation') && msg.includes('does not exist')) return;
  if (msg.includes('Failed to fetch') && !navigator.onLine) return;

  const entry = {
    service,
    operation,
    message: msg,
    at: new Date().toISOString(),
  };

  // Store last N errors for debugging
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    all.unshift(entry);
    if (all.length > MAX_ERRORS) all.length = MAX_ERRORS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}

  // Notify listeners (e.g. toast provider)
  _listeners.forEach(fn => {
    try { fn(entry); } catch {}
  });

  // Forward to Sentry (no-op when VITE_SENTRY_DSN isn't set).
  // Lazy import so we don't pay the bundle cost when Sentry isn't enabled
  // and so a Sentry init failure can't break the local-storage path above.
  try {
    // eslint-disable-next-line no-unused-expressions
    import('../lib/sentry').then(({ captureException, captureMessage }) => {
      if (error instanceof Error) captureException(error, { service, operation });
      else captureMessage(`${service}.${operation}: ${msg}`, 'error', { service, operation });
    }).catch(() => {});
  } catch {}

  // Console warning in development
  if (import.meta.env.DEV) {
    console.warn(`[${service}] ${operation} failed:`, error?.message || error);
  }
}

export function onError(callback) {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter(fn => fn !== callback);
  };
}

export function getRecentErrors() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Wrap a service function to report errors instead of silently catching.
 * Usage: const safeFetch = withErrorReport('dashboardService', 'fetchStats', fetchStats);
 */
export function withErrorReport(service, operation, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      reportError(service, operation, err);
      throw err;
    }
  };
}
