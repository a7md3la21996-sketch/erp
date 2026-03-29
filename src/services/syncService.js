import { syncToSupabase } from '../utils/supabaseSync';
import { reportError } from '../utils/errorReporter';
// ── Sync Service ─────────────────────────────────────────────────────────
// Centralized sync management between localStorage and Supabase.
// localStorage is always the source of truth for reads.
// Supabase is the backup/sync target.

import {
  enqueue,
  processQueue,
  getPendingCount,
  subscribe,
  isOnline,
  getQueue,
} from '../lib/offlineQueue';

const SYNC_META_KEY = 'platform_sync_meta';

// ── Sync Metadata ────────────────────────────────────────────────────────

function getMeta() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
  } catch (err) { reportError('syncService', 'query', err);
    return {};
  }
}

function saveMeta(meta) {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

function updateLastSync() {
  const meta = getMeta();
  meta.lastSyncAt = new Date().toISOString();
  saveMeta(meta);
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Get current sync status
 * @returns {{ pending: number, lastSyncAt: string|null, isOnline: boolean, failedItems: number }}
 */
export function getSyncStatus() {
  const meta = getMeta();
  const queue = getQueue();
  const failedItems = queue.filter(q => (q.retries || 0) > 5).length;

  return {
    pending: queue.length,
    lastSyncAt: meta.lastSyncAt || null,
    isOnline: isOnline(),
    failedItems,
  };
}

/**
 * Add a failed operation to the sync queue.
 * Called by service modules when Supabase write fails.
 *
 * @param {'opportunities'|'contacts'|'activities'|'deals'} entity
 * @param {'create'|'update'|'delete'} action
 * @param {object} data - The payload (for create/update) or { id } (for delete)
 */
export function addToSyncQueue(entity, action, data) {
  enqueue(entity, action, data);
}

/**
 * Manually trigger queue processing.
 * Returns { success, failed }.
 */
export async function syncNow() {
  const result = await processQueue();
  if (result.success > 0) {
    updateLastSync();
  }
  return result;
}

/**
 * Subscribe to queue count changes.
 * @param {(count: number) => void} fn
 * @returns {() => void} unsubscribe
 */
export { subscribe, getPendingCount, isOnline };

// ── Background Sync (periodic) ──────────────────────────────────────────

let _intervalId = null;
const SYNC_INTERVAL = 60_000; // 60 seconds

function startBackgroundSync() {
  if (_intervalId) return;
  _intervalId = setInterval(async () => {
    if (!navigator.onLine) return;
    if (getPendingCount() === 0) return;
    const result = await processQueue();
    if (result.success > 0) {
      updateLastSync();
    }
  }, SYNC_INTERVAL);
}

function stopBackgroundSync() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

// ── Auto-start on module load ────────────────────────────────────────────

// Named handlers for proper cleanup
function _handleOnline() {
  setTimeout(async () => {
    if (getPendingCount() > 0) {
      const result = await processQueue();
      if (result.success > 0) updateLastSync();
    }
  }, 2000);
}

export function initSyncListeners() {
  startBackgroundSync();

  // Sync when page loads (with small delay)
  setTimeout(async () => {
    if (navigator.onLine && getPendingCount() > 0) {
      const result = await processQueue();
      if (result.success > 0) updateLastSync();
    }
  }, 3000);

  window.addEventListener('online', _handleOnline);
  window.addEventListener('beforeunload', stopBackgroundSync);
}

export function cleanupSyncListeners() {
  stopBackgroundSync();
  window.removeEventListener('online', _handleOnline);
  window.removeEventListener('beforeunload', stopBackgroundSync);
}

// Auto-start on module load
if (typeof window !== 'undefined') {
  initSyncListeners();
}
