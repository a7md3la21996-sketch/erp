/**
 * notificationsService.js — UNIFIED notification service
 * Delegates to notificationService.js (Supabase-first) for all operations.
 * This file exists for backward compatibility with existing imports.
 */

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
} from './notificationService';

// ── Re-export helpers as-is ──
export { notifyLeadAssigned, notifyTaskAssigned, notifyDealWon, notifyReminder };

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
  _create(opts).catch(() => {});
  // Dispatch event for real-time UI
  window.dispatchEvent(new CustomEvent('platform_notification', { detail: placeholder }));
  return placeholder;
}

export function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  // Return cached sync result from localStorage for backward compat
  try {
    let list = JSON.parse(localStorage.getItem('platform_notifications') || '[]')
      .filter(n => n.for_user_id === userId || n.for_user_id === 'all' || n.user_id === userId);
    if (unreadOnly) list = list.filter(n => !n.read && !n.is_read);
    return list.slice(0, limit);
  } catch { return []; }
}

export function getUnreadCount(userId) {
  try {
    return JSON.parse(localStorage.getItem('platform_notifications') || '[]')
      .filter(n => (n.for_user_id === userId || n.for_user_id === 'all' || n.user_id === userId) && !n.read && !n.is_read)
      .length;
  } catch { return 0; }
}

export function markAsRead(notificationId) {
  _read(notificationId).catch(() => {});
  // Also update localStorage cache
  try {
    const list = JSON.parse(localStorage.getItem('platform_notifications') || '[]');
    const idx = list.findIndex(n => n.id === notificationId);
    if (idx !== -1) { list[idx].read = true; list[idx].is_read = true; localStorage.setItem('platform_notifications', JSON.stringify(list)); }
  } catch {}
}

export function markAllAsRead(userId) {
  _readAll().catch(() => {});
  try {
    const list = JSON.parse(localStorage.getItem('platform_notifications') || '[]');
    list.forEach(n => { if (n.for_user_id === userId || n.for_user_id === 'all' || n.user_id === userId) { n.read = true; n.is_read = true; } });
    localStorage.setItem('platform_notifications', JSON.stringify(list));
  } catch {}
}

export function deleteNotification(notificationId) {
  _del(notificationId).catch(() => {});
  try {
    const list = JSON.parse(localStorage.getItem('platform_notifications') || '[]').filter(n => n.id !== notificationId);
    localStorage.setItem('platform_notifications', JSON.stringify(list));
  } catch {}
}
