const STORAGE_KEY = 'platform_notifications';
const MAX_NOTIFICATIONS = 200;

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_NOTIFICATIONS) list = list.slice(0, MAX_NOTIFICATIONS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // QuotaExceededError — trim to half and retry
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_NOTIFICATIONS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

/**
 * Create a notification
 * @param {object} opts
 * @param {string} opts.type - 'lead_assigned' | 'task_assigned' | 'reminder' | 'deal_won' | 'opportunity_update' | 'system'
 * @param {string} opts.title_ar
 * @param {string} opts.title_en
 * @param {string} opts.body_ar
 * @param {string} opts.body_en
 * @param {string} opts.for_user_id - who should see this
 * @param {string} opts.entity_type - 'contact' | 'task' | 'opportunity' | 'deal'
 * @param {string} opts.entity_id
 * @param {string} opts.from_user - who triggered it
 */
export function createNotification(opts) {
  const notification = {
    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 6),
    type: opts.type || 'system',
    title_ar: opts.title_ar || '',
    title_en: opts.title_en || '',
    body_ar: opts.body_ar || '',
    body_en: opts.body_en || '',
    for_user_id: opts.for_user_id || 'all',
    entity_type: opts.entity_type || null,
    entity_id: opts.entity_id || null,
    from_user: opts.from_user || null,
    read: false,
    created_at: new Date().toISOString(),
  };

  const list = load();
  list.unshift(notification);
  save(list);

  // Dispatch custom event for real-time UI update
  window.dispatchEvent(new CustomEvent('platform_notification', { detail: notification }));

  return notification;
}

/**
 * Get notifications for a user
 */
export function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  let list = load().filter(n => n.for_user_id === userId || n.for_user_id === 'all');
  if (unreadOnly) list = list.filter(n => !n.read);
  return list.slice(0, limit);
}

/**
 * Get unread count
 */
export function getUnreadCount(userId) {
  return load().filter(n => (n.for_user_id === userId || n.for_user_id === 'all') && !n.read).length;
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId) {
  const list = load();
  const idx = list.findIndex(n => n.id === notificationId);
  if (idx !== -1) { list[idx].read = true; save(list); }
}

/**
 * Mark all as read for a user
 */
export function markAllAsRead(userId) {
  const list = load();
  list.forEach(n => { if (n.for_user_id === userId || n.for_user_id === 'all') n.read = true; });
  save(list);
}

/**
 * Delete a notification
 */
export function deleteNotification(notificationId) {
  const list = load().filter(n => n.id !== notificationId);
  save(list);
}

// ── Notification Types Config ──
export const NOTIFICATION_TYPES = {
  lead_assigned: { color: '#4A7AAB', icon: 'UserPlus' },
  task_assigned: { color: '#F59E0B', icon: 'CheckSquare' },
  reminder: { color: '#6B21A8', icon: 'Bell' },
  deal_won: { color: '#10B981', icon: 'Trophy' },
  opportunity_update: { color: '#4A7AAB', icon: 'TrendingUp' },
  system: { color: '#6B7280', icon: 'Info' },
};

// ── Helper: Notify on lead assignment ──
export function notifyLeadAssigned({ contactName, agentId, agentName, assignedBy }) {
  return createNotification({
    type: 'lead_assigned',
    title_ar: 'ليد جديد',
    title_en: 'New Lead Assigned',
    body_ar: `تم تعيين "${contactName}" لك بواسطة ${assignedBy}`,
    body_en: `"${contactName}" has been assigned to you by ${assignedBy}`,
    for_user_id: agentId,
    entity_type: 'contact',
    from_user: assignedBy,
  });
}

// ── Helper: Notify on task assignment ──
export function notifyTaskAssigned({ taskTitle, assigneeId, assignedBy }) {
  return createNotification({
    type: 'task_assigned',
    title_ar: 'مهمة جديدة',
    title_en: 'New Task Assigned',
    body_ar: `تم تعيين مهمة "${taskTitle}" لك`,
    body_en: `Task "${taskTitle}" has been assigned to you`,
    for_user_id: assigneeId,
    entity_type: 'task',
    from_user: assignedBy,
  });
}

// ── Helper: Notify on deal won ──
export function notifyDealWon({ dealNumber, clientName, value, agentId }) {
  return createNotification({
    type: 'deal_won',
    title_ar: 'صفقة ناجحة!',
    title_en: 'Deal Won!',
    body_ar: `تم إغلاق الصفقة ${dealNumber} — ${clientName} بقيمة ${value}`,
    body_en: `Deal ${dealNumber} closed — ${clientName} worth ${value}`,
    for_user_id: agentId,
    entity_type: 'deal',
  });
}

// ── Helper: Notify reminder ──
export function notifyReminder({ title, userId, entityType, entityId }) {
  return createNotification({
    type: 'reminder',
    title_ar: 'تذكير',
    title_en: 'Reminder',
    body_ar: title,
    body_en: title,
    for_user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
  });
}
