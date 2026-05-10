// Sentry initialization. Only enabled when VITE_SENTRY_DSN is set in env;
// dev builds default to disabled so local errors don't pollute the project.
//
// To enable in production:
//   1. Create a Sentry project at sentry.io (React platform)
//   2. Copy the DSN
//   3. Set VITE_SENTRY_DSN in Vercel project env (Production scope)
//   4. Re-deploy
//
// Errors flow through reportError() (src/utils/errorReporter.js). When
// Sentry is enabled, that file forwards each entry here.

import * as Sentry from '@sentry/react';

let _enabled = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // disabled — silent no-op
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'local',
      // Lower than default to avoid noise from realtime / token-refresh churn.
      // Tracing disabled to keep bundle small; flip on if you need it.
      tracesSampleRate: 0,
      // Don't auto-capture every console.log — we'll forward intentionally
      // via reportError(). Auto breadcrumbs from clicks/navigation are kept.
      integrations: [],
      // Filter noise: known transient errors that don't need a Sentry alert.
      beforeSend(event, hint) {
        const msg = hint?.originalException?.message || event?.message || '';
        if (/Failed to fetch/.test(msg) && !navigator.onLine) return null;
        if (/relation.*does not exist/.test(msg)) return null;
        if (/Importing a module script failed/.test(msg)) return null; // chunk-stale, auto-reloads
        if (/Loading chunk \d+ failed/.test(msg)) return null;
        return event;
      },
    });
    _enabled = true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[sentry] init failed', e);
  }
}

export function setSentryUser(user) {
  if (!_enabled) return;
  try {
    if (user) Sentry.setUser({ id: user.id, email: user.email, username: user.full_name_en || user.full_name_ar });
    else Sentry.setUser(null);
  } catch {}
}

export function captureException(err, context = {}) {
  if (!_enabled) return;
  try { Sentry.captureException(err, { extra: context }); } catch {}
}

export function captureMessage(msg, level = 'info', context = {}) {
  if (!_enabled) return;
  try { Sentry.captureMessage(msg, { level, extra: context }); } catch {}
}

export function isSentryEnabled() { return _enabled; }
