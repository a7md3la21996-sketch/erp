/**
 * notificationsService.js — UNIFIED notification service
 * Delegates to notificationService.js (Supabase-first) for all operations.
 * This file exists for backward compatibility with existing imports.
 */

import { playNotificationSound } from '../utils/notificationSound';

import {
  createNotification as _create,
  getNotifications as _getAll,
  getUnreadCount as _unread,
  markAsRead as _read,
  markAllAsRead as _readAll,
  deleteNotification as _del,
  notifyLeadAssigned,
  notifyTaskAssigned,
  notifyDealWon,
  notifyReminder,
  notifyImportDone,
  notifyLeadReassigned,
  notifyImportLeadsForAgent,
} from './notificationService';

// Re-export everything callers ever need from the singular file. Two
// files with almost-identical names ('notificationService' vs
// 'notificationsService') was a typo trap — a missing 's' would
// silently import undefined and crash at runtime only when the code
// path actually fired. Consolidating all imports here means callers
// only ever pick this file.
export {
  notifyLeadAssigned, notifyTaskAssigned, notifyDealWon, notifyReminder,
  notifyImportDone, notifyLeadReassigned, notifyImportLeadsForAgent,
};

// ── Notification Types Config ──
export const NOTIFICATION_TYPES = {
  lead_assigned: { color: '#4A7AAB', icon: 'UserPlus' },
  task_assigned: { color: '#F59E0B', icon: 'CheckSquare' },
  reminder: { color: '#6B21A8', icon: 'Bell' },
  deal_won: { color: '#10B981', icon: 'Trophy' },
  opportunity_update: { color: '#4A7AAB', icon: 'TrendingUp' },
  system: { color: '#6B7280', icon: 'Info' },
};

// ── Backward-compatible wrappers ──
// Old API: sync functions with userId param
// New API: async functions without userId (uses auth context internally)

export function createNotification(opts) {
  // Fire-and-forget async call, return a placeholder for sync callers
  const placeholder = {
    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 6),
    ...opts,
    read: false,
    created_at: new Date().toISOString(),
  };
  _create(opts).catch((err) => {
    import('../utils/errorReporter').then(m => m.reportError('notificationsService', 'createNotification', err)).catch(() => {});
  });
  // Dispatch event for real-time UI
  window.dispatchEvent(new CustomEvent('platform_notification', { detail: placeholder }));
  // Play notification sound
  try { playNotificationSound(); } catch {}
  return placeholder;
}

export function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  return _getAll({ unreadOnly, limit });
}

export function getUnreadCount(userId) {
  return _unread();
}

export function markAsRead(notificationId) {
  _read(notificationId).catch(() => {});
}

export function markAllAsRead(userId) {
  _readAll().catch(() => {});
}

export function deleteNotification(notificationId) {
  _del(notificationId).catch(() => {});
}
