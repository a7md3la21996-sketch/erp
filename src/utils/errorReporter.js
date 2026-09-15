/**
 * Centralized error reporter for service layer.
 * Instead of silently swallowing errors, services should call reportError()
 * so the UI can show a stale-data indicator.
 */

const STORAGE_KEY = 'platform_last_errors';
const MAX_ERRORS = 20;

let _listeners = [];

// A connectivity error only surfaces the scary "data may be stale" banner when
// it is SUSTAINED — a second connectivity failure within this window. A single
// transient blip (one dropped request, a momentary Wi-Fi stutter) is silent.
const SUSTAINED_WINDOW_MS = 15_000;
let _lastConnectivityAt = 0;

// Classify an error so the UI reacts to what actually happened instead of
// crying "server down" at every hiccup. Three buckets:
//   'ignore'       — aborted/cancelled requests. These fire constantly and
//                    harmlessly: navigation away from a page, and the Leads
//                    30s auto-refresh superseding its own in-flight fetch.
//                    Never stored, never shown.
//   'query'        — 4xx query / schema / logic errors (bad filter, missing
//                    column, conflict). A developer bug, NOT a connectivity
//                    problem — telling the user "the server failed" is a lie.
//                    Stored + sent to Sentry for debugging, but no user banner.
//   'connectivity' — genuine network / server failure (offline, DNS, 5xx). The
//                    ONLY class allowed to raise the "data may be stale" banner,
//                    and only when sustained.
function classifySeverity(service, operation, msg) {
  const m = (msg || '').toLowerCase();
  const op = String(operation || '');

  // Aborted / cancelled — the biggest source of false alarms.
  if (m.includes('abort') || m.includes('cancel') || m.includes('signal is aborted')) return 'ignore';

  // HTTP errors routed through boundedFetch carry the status as the first token
  // of `operation` (e.g. "400 /rest/v1/…", "500 /rest/v1/…").
  if (service === 'supabase.http') {
    const status = parseInt(op, 10);
    if (!Number.isNaN(status)) return status >= 500 ? 'connectivity' : 'query';
  }

  // Client-thrown network failures.
  if (m.includes('failed to fetch') || m.includes('networkerror') ||
      m.includes('network request failed') || m.includes('load failed')) {
    return 'connectivity';
  }

  // Missing table / relation — schema drift, not connectivity.
  if (m.includes('relation') && m.includes('does not exist')) return 'query';

  // Anything else surfaced by a service's result.error — treat as query-level.
  return 'query';
}

export function reportError(service, operation, error) {
  const msg = error?.message || String(error);
  const severity = classifySeverity(service, operation, msg);

  // Aborted/cancelled requests are pure noise — drop them entirely.
  if (severity === 'ignore') return;
  // An offline "Failed to fetch" is genuine but expected — no need to alarm.
  if (severity === 'connectivity' && !navigator.onLine) return;

  const entry = {
    service,
    operation,
    message: msg,
    severity,
    at: new Date().toISOString(),
  };

  // Store last N errors for debugging (every non-ignored severity).
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    all.unshift(entry);
    if (all.length > MAX_ERRORS) all.length = MAX_ERRORS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}

  // Only genuine, SUSTAINED connectivity failures reach the user banner. A query
  // bug or a lone transient blip stays in the debug ring + Sentry and never
  // interrupts the user with a false "connection failed" alarm.
  if (severity === 'connectivity') {
    const now = Date.now();
    const sustained = now - _lastConnectivityAt < SUSTAINED_WINDOW_MS;
    _lastConnectivityAt = now;
    if (sustained) {
      _listeners.forEach(fn => {
        try { fn(entry); } catch {}
      });
    }
  }

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
