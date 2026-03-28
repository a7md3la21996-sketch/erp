/**
 * Centralized error reporter for service layer.
 * Instead of silently swallowing errors, services should call reportError()
 * so the UI can show a stale-data indicator.
 */

const STORAGE_KEY = 'platform_last_errors';
const MAX_ERRORS = 20;

let _listeners = [];

export function reportError(service, operation, error) {
  const entry = {
    service,
    operation,
    message: error?.message || String(error),
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
