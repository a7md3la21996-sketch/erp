/**
 * Notification Service — localStorage-first with optional Supabase sync
 * Key: platform_notifications
 * Max: 500 entries
 */

const STORAGE_KEY = 'platform_notifications';
const PREFS_KEY = 'platform_notification_preferences';
const MAX_NOTIFICATIONS = 500;

// ── Notification Types ──
export const NOTIFICATION_TYPES = {
  task_due:           { color: '#F59E0B', icon: 'Clock' },
  task_overdue:       { color: '#EF4444', icon: 'AlertTriangle' },
  opportunity_won:    { color: '#10B981', icon: 'Trophy' },
  opportunity_lost:   { color: '#EF4444', icon: 'XCircle' },
  stage_change:       { color: '#8B5CF6', icon: 'ArrowRightCircle' },
  new_comment:        { color: '#3B82F6', icon: 'MessageSquare' },
  mention:            { color: '#6366F1', icon: 'AtSign' },
  approval_needed:    { color: '#F97316', icon: 'ShieldAlert' },
  approval_approved:  { color: '#10B981', icon: 'CheckCircle2' },
  approval_rejected:  { color: '#EF4444', icon: 'XOctagon' },
  expense_submitted:  { color: '#14B8A6', icon: 'Receipt' },
  system_alert:       { color: '#6B7280', icon: 'AlertCircle' },
  reminder:           { color: '#A855F7', icon: 'Bell' },
  import_complete:    { color: '#22C55E', icon: 'Download' },
  export_complete:    { color: '#22C55E', icon: 'Upload' },
  // Legacy compat
  lead_assigned:      { color: '#4A7AAB', icon: 'UserPlus' },
  task_assigned:      { color: '#F59E0B', icon: 'CheckSquare' },
  deal_won:           { color: '#10B981', icon: 'Trophy' },
  opportunity_update: { color: '#4A7AAB', icon: 'TrendingUp' },
  system:             { color: '#6B7280', icon: 'Info' },
};

export const DEFAULT_PREFERENCES = Object.keys(NOTIFICATION_TYPES).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

// ── Internal helpers ──
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_NOTIFICATIONS) list = list.slice(0, MAX_NOTIFICATIONS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_NOTIFICATIONS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function dispatch() {
  window.dispatchEvent(new CustomEvent('platform_notification_changed'));
  // Also fire legacy event for Header compat
  window.dispatchEvent(new CustomEvent('platform_notification'));
}

// ── Public API ──

/**
 * Get notifications with filtering
 */
export function getNotifications({ limit = 50, offset = 0, unreadOnly = false, type = null, priority = null } = {}) {
  let list = load();
  if (unreadOnly) list = list.filter(n => !n.read);
  if (type) list = list.filter(n => n.type === type);
  if (priority) list = list.filter(n => n.priority === priority);
  const total = list.length;
  return { data: list.slice(offset, offset + limit), total };
}

/**
 * Add a new notification
 */
export function addNotification({ type, title, titleEn, message, messageEn, entity, entityId, priority = 'medium', actionUrl, icon }) {
  const notification = {
    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8),
    type: type || 'system_alert',
    title: title || '',
    titleEn: titleEn || '',
    // Map to legacy fields too for backward compat
    title_ar: title || '',
    title_en: titleEn || '',
    message: message || '',
    messageEn: messageEn || '',
    body_ar: message || '',
    body_en: messageEn || '',
    entity: entity || null,
    entityId: entityId || null,
    entity_type: entity || null,
    entity_id: entityId || null,
    priority: priority || 'medium',
    read: false,
    created_at: new Date().toISOString(),
    action_url: actionUrl || null,
    icon: icon || null,
    for_user_id: 'all',
  };

  const list = load();
  list.unshift(notification);
  save(list);
  dispatch();
  return notification;
}

/**
 * Mark a single notification as read
 */
export function markAsRead(id) {
  const list = load();
  const idx = list.findIndex(n => n.id === id);
  if (idx !== -1) { list[idx].read = true; save(list); dispatch(); }
}

/**
 * Mark all notifications as read
 */
export function markAllAsRead() {
  const list = load();
  list.forEach(n => { n.read = true; });
  save(list);
  dispatch();
}

/**
 * Delete a single notification
 */
export function deleteNotification(id) {
  const list = load().filter(n => n.id !== id);
  save(list);
  dispatch();
}

/**
 * Clear all notifications
 */
export function clearAll() {
  save([]);
  dispatch();
}

/**
 * Get unread count
 */
export function getUnreadCount() {
  return load().filter(n => !n.read).length;
}

/**
 * Get notification preferences
 */
export function getNotificationPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY));
    return { ...DEFAULT_PREFERENCES, ...stored };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}

/**
 * Set notification preferences
 */
export function setNotificationPreferences(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/**
 * Search notifications by text
 */
export function searchNotifications(query) {
  if (!query) return [];
  const q = query.toLowerCase();
  return load().filter(n => {
    return (n.title || '').toLowerCase().includes(q)
      || (n.titleEn || '').toLowerCase().includes(q)
      || (n.title_ar || '').toLowerCase().includes(q)
      || (n.title_en || '').toLowerCase().includes(q)
      || (n.message || '').toLowerCase().includes(q)
      || (n.messageEn || '').toLowerCase().includes(q)
      || (n.body_ar || '').toLowerCase().includes(q)
      || (n.body_en || '').toLowerCase().includes(q);
  });
}

// ── Legacy compat: re-export old function names ──
export function createNotification(opts) {
  return addNotification({
    type: opts.type,
    title: opts.title_ar || opts.title,
    titleEn: opts.title_en || opts.titleEn,
    message: opts.body_ar || opts.message,
    messageEn: opts.body_en || opts.messageEn,
    entity: opts.entity_type || opts.entity,
    entityId: opts.entity_id || opts.entityId,
    priority: opts.priority || 'medium',
    actionUrl: opts.action_url || opts.actionUrl,
  });
}

// ── Helper shortcuts (kept from old service) ──
export function notifyLeadAssigned({ contactName, agentId, agentName, assignedBy }) {
  return addNotification({
    type: 'lead_assigned',
    title: 'ليد جديد',
    titleEn: 'New Lead Assigned',
    message: `تم تعيين "${contactName}" لك بواسطة ${assignedBy}`,
    messageEn: `"${contactName}" has been assigned to you by ${assignedBy}`,
    entity: 'contact',
    priority: 'high',
  });
}

export function notifyTaskAssigned({ taskTitle, assigneeId, assignedBy }) {
  return addNotification({
    type: 'task_assigned',
    title: 'مهمة جديدة',
    titleEn: 'New Task Assigned',
    message: `تم تعيين مهمة "${taskTitle}" لك`,
    messageEn: `Task "${taskTitle}" has been assigned to you`,
    entity: 'task',
    priority: 'high',
  });
}

export function notifyDealWon({ dealNumber, clientName, value, agentId }) {
  return addNotification({
    type: 'deal_won',
    title: 'صفقة ناجحة!',
    titleEn: 'Deal Won!',
    message: `تم إغلاق الصفقة ${dealNumber} — ${clientName} بقيمة ${value}`,
    messageEn: `Deal ${dealNumber} closed — ${clientName} worth ${value}`,
    entity: 'deal',
    priority: 'high',
  });
}

export function notifyReminder({ title, userId, entityType, entityId }) {
  return addNotification({
    type: 'reminder',
    title: 'تذكير',
    titleEn: 'Reminder',
    message: title,
    messageEn: title,
    entity: entityType,
    entityId,
    priority: 'medium',
  });
}
