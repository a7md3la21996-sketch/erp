import { createClient } from '@supabase/supabase-js';
import { processLock } from '@supabase/auth-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// Bound ONLY auth requests with a timeout. A token refresh that never resolves
// — which happens when a backgrounded/throttled tab wakes with an expired token
// — otherwise holds the auth lock forever, so every later call waits on it and
// the whole app goes dead (and a stale token in storage means even a reload
// can't recover). Aborting the stuck refresh lets the lock release and the app
// retry. Data/storage requests stay unbounded so slow reports/exports finish.
const AUTH_FETCH_TIMEOUT_MS = 20_000;

// App-wide diagnostic: EVERY Supabase request goes through this fetch, so a
// non-OK response is reported centrally here — even when the calling service
// ignores its `error` field (the reason a bad query used to vanish as a silent
// background 400). We only surface the actionable statuses — 400 (bad query /
// schema), 409 (conflict) and 5xx (server) — and skip the noisy/expected ones
// (401 auth churn, 403 RLS, 404 not-found, 406 single-row). Errors land in the
// reporter's localStorage ring (getRecentErrors) + Sentry; reportError makes no
// Supabase call, so this can't loop.
const reportHttpError = (url, res) => {
  const s = res.status;
  if (!(s === 400 || s === 409 || s >= 500)) return;
  res.clone().text().then(body => {
    let detail = body.slice(0, 300);
    try {
      const j = JSON.parse(body);
      detail = [j.code, j.message, j.details, j.hint].filter(Boolean).join(' — ') || detail;
    } catch { /* non-JSON body — keep the snippet */ }
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    // Raw ring (last 20) — captures EVERYTHING, bypassing reportError's business
    // filters (e.g. it drops "relation does not exist"), so a missing-table 400
    // is still debuggable. Read via localStorage 'platform_http_errors'.
    try {
      const KEY = 'platform_http_errors';
      const ring = JSON.parse(localStorage.getItem(KEY) || '[]');
      ring.unshift({ status: s, path, detail, at: new Date().toISOString() });
      if (ring.length > 20) ring.length = 20;
      localStorage.setItem(KEY, JSON.stringify(ring));
    } catch { /* localStorage unavailable */ }
    import('../utils/errorReporter.js')
      .then(m => m.reportError('supabase.http', `${s} ${path}`, new Error(detail || `HTTP ${s}`)))
      .catch(() => {});
  }).catch(() => {});
};

const boundedFetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '');
  let p;
  if (init.signal || !/\/auth\/v1\//.test(url)) {
    p = fetch(input, init);
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
    p = fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  }
  return p.then(res => {
    if (res && !res.ok) { try { reportHttpError(url, res); } catch { /* never break the request */ } }
    return res;
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'platform-erp-auth',
    // Per-tab in-memory lock instead of the default navigatorLock (Web Locks
    // API). navigatorLock is shared across ALL tabs of the origin, so one tab
    // stuck mid token-refresh deadlocks every other tab — the classic "leave it
    // idle, come back dead, hard refresh doesn't help" freeze. processLock is
    // scoped to this tab, so a stuck tab can never freeze the others and a
    // reload always starts clean.
    lock: processLock,
  },
  global: {
    headers: { 'x-client-info': 'platform-erp/2.0' },
    fetch: boundedFetch,
  },
  realtime: {
    params: { eventsPerSecond: 10 }, // rate limit realtime events
  },
});

/**
 * Helper for services: wraps a Supabase call and auto-reports errors.
 * Usage: const data = await safeQuery('contacts', 'fetch', () => supabase.from('contacts').select('*'));
 */
export async function safeQuery(table, operation, queryFn) {
  try {
    const result = await queryFn();
    if (result?.error) {
      import('../utils/errorReporter.js').then(m => m.reportError(`supabase.${table}`, operation, result.error)).catch(() => {});
    }
    return result;
  } catch (err) {
    import('../utils/errorReporter.js').then(m => m.reportError(`supabase.${table}`, operation, err)).catch(() => {});
    throw err;
  }
}

export default supabase;
