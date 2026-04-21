/**
 * Notification Service — Supabase-first with localStorage fallback
 * Key: platform_notifications
 * Max: 500 entries
 */

import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { showPushNotification } from './pushService';
import { stripInternalFields } from '../utils/sanitizeForSupabase';

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
export async function getNotifications({ limit = 50, offset = 0, unreadOnly = false, type = null, priority = null, userId = null, userName = null } = {}) {
  try {
    let query = supabase.from('notifications').select('*', { count: 'exact' });
    if (userId || userName) {
      const conditions = ['for_user_id.eq.all'];
      if (userId) conditions.push(`for_user_id.eq.${userId}`);
      if (userName) conditions.push(`for_user_name.eq.${userName}`);
      query = query.or(conditions.join(','));
    }
    if (unreadOnly) query = query.eq('read', false);
    if (type) query = query.eq('type', type);
    if (priority) query = query.eq('priority', priority);
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    if (data) return { data, total: count || data.length };
  } catch (err) {
    reportError('notificationService', 'getNotifications', err);
  }

  // Existing localStorage logic
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
export async function addNotification({ type, title, titleEn, message, messageEn, entity, entityId, priority = 'medium', actionUrl, icon, forUserId }) {
  // Build object matching Supabase columns exactly
  const dbRecord = {
    type: type || 'system_alert',
    title_ar: title || '',
    title_en: titleEn || title || '',
    body_ar: message || '',
    body_en: messageEn || message || '',
    entity_type: entity || null,
    priority: priority || 'normal',
    read: false,
    url: actionUrl || null,
    for_user_id: forUserId || null,
    for_user_name: forUserId || null,
    from_user: null,
  };

  // Local copy for UI (has extra fields)
  const localNotification = {
    ...dbRecord,
    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8),
    created_at: new Date().toISOString(),
  };

  const list = load();
  list.unshift(localNotification);
  save(list);
  dispatch();

  // Trigger browser push notification if permitted
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      showPushNotification(dbRecord.title_ar || dbRecord.title_en, {
        body: dbRecord.body_ar || dbRecord.body_en,
        tag: localNotification.id,
        data: { url: dbRecord.url || '/' },
      });
    }
  } catch { /* ignore */ }

  // Save to Supabase
  try {
    const { data, error } = await supabase.from('notifications').insert([dbRecord]).select('*').single();
    if (error) throw error;
    // Update local with real ID
    if (data?.id) {
      const updatedList = load();
      const idx = updatedList.findIndex(n => n.id === localNotification.id);
      if (idx !== -1) { updatedList[idx] = { ...updatedList[idx], ...data }; save(updatedList); }
      return data;
    }
  } catch (err) {
    reportError('notificationService', 'addNotification', err);
  }

  return localNotification;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(id) {
  const list = load();
  const idx = list.findIndex(n => n.id === id);
  if (idx !== -1) { list[idx].read = true; save(list); dispatch(); }

  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    reportError('notificationService', 'markAsRead', err);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead() {
  const list = load();
  list.forEach(n => { n.read = true; });
  save(list);
  dispatch();

  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
    if (error) throw error;
  } catch (err) {
    reportError('notificationService', 'markAllAsRead', err);
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotification(id) {
  const list = load().filter(n => n.id !== id);
  save(list);
  dispatch();

  try {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    reportError('notificationService', 'deleteNotification', err);
  }
}

/**
 * Clear all notifications
 */
export async function clearAll() {
  save([]);
  dispatch();

  try {
    const { error } = await supabase.from('notifications').delete().neq('id', '');
    if (error) throw error;
  } catch (err) {
    reportError('notificationService', 'clearAll', err);
  }
}

/**
 * Get unread count
 */
export async function getUnreadCount(userId) {
  try {
    let query = supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false);
    if (userId) query = query.or(`for_user_id.eq.${userId},for_user_id.eq.all`);
    const { count, error } = await query;
    if (error) throw error;
    if (count !== null) return count;
  } catch (err) {
    reportError('notificationService', 'getUnreadCount', err);
  }
  return 0;
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
export async function searchNotifications(query) {
  if (!query) return [];
  const q = query.toLowerCase();

  try {
    // Fetch all and filter client-side for text search flexibility
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    if (data && data.length > 0) {
      return data.filter(n => {
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
  } catch (err) {
    reportError('notificationService', 'searchNotifications', err);
  }

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
export function notifyLeadAssigned({ contactName, contactId, agentId, agentName, assignedBy }) {
  return addNotification({
    type: 'lead_assigned',
    title: 'ليد جديد',
    titleEn: 'New Lead Assigned',
    message: `تم تعيين "${contactName}" لك بواسطة ${assignedBy}`,
    messageEn: `"${contactName}" has been assigned to you by ${assignedBy}`,
    entity: 'contact',
    entityId: contactId,
    actionUrl: contactId ? `/contacts?highlight=${contactId}` : '/contacts',
    priority: 'high',
    forUserId: agentName || agentId || null,
  });
}

export function notifyTaskAssigned({ taskTitle, taskId, assigneeId, assignedBy }) {
  return addNotification({
    type: 'task_assigned',
    title: 'مهمة جديدة',
    titleEn: 'New Task Assigned',
    message: `تم تعيين مهمة "${taskTitle}" لك`,
    messageEn: `Task "${taskTitle}" has been assigned to you`,
    entity: 'task',
    entityId: taskId,
    actionUrl: '/tasks',
    priority: 'high',
  });
}

export function notifyDealWon({ dealNumber, dealId, clientName, value, agentId }) {
  return addNotification({
    type: 'deal_won',
    title: 'صفقة ناجحة!',
    titleEn: 'Deal Won!',
    message: `تم إغلاق الصفقة ${dealNumber} — ${clientName} بقيمة ${value}`,
    messageEn: `Deal ${dealNumber} closed — ${clientName} worth ${value}`,
    entity: 'deal',
    entityId: dealId,
    actionUrl: '/sales/deals',
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

// ── Overdue Tasks (daily reminder) ──
export function notifyOverdueTasks({ count, agentName }) {
  return addNotification({
    type: 'overdue_tasks',
    title: 'مهام متأخرة',
    titleEn: 'Overdue Tasks',
    message: `عندك ${count} مهمة متأخرة محتاجة متابعة`,
    messageEn: `You have ${count} overdue tasks that need attention`,
    actionUrl: '/tasks',
    priority: 'high',
    forUserId: agentName,
  });
}

// ── Stale Leads (no activity > 3 days) ──
export function notifyStaleLeads({ count, agentName }) {
  return addNotification({
    type: 'stale_leads',
    title: 'ليدز محتاجة متابعة',
    titleEn: 'Leads Need Follow-up',
    message: `عندك ${count} ليد بدون نشاط من أكتر من 3 أيام`,
    messageEn: `You have ${count} leads with no activity for 3+ days`,
    actionUrl: '/contacts',
    priority: 'medium',
    forUserId: agentName,
  });
}

// ── Hot Opportunity Needs Follow-up ──
export function notifyHotOpportunity({ oppTitle, contactName, agentName }) {
  return addNotification({
    type: 'hot_opportunity',
    title: 'فرصة ساخنة',
    titleEn: 'Hot Opportunity',
    message: `الفرصة "${contactName}" ساخنة ومحتاجة متابعة سريعة`,
    messageEn: `Opportunity "${contactName}" is hot and needs quick follow-up`,
    actionUrl: '/crm/opportunities',
    priority: 'high',
    forUserId: agentName,
  });
}

// ── Lead DQ'd (for manager review) ──
export function notifyLeadDQ({ contactName, contactId, agentName, reason, managerName }) {
  return addNotification({
    type: 'lead_dq',
    title: 'ليد تم استبعاده',
    titleEn: 'Lead Disqualified',
    message: `${agentName} استبعد "${contactName}" — السبب: ${reason}`,
    messageEn: `${agentName} disqualified "${contactName}" — Reason: ${reason}`,
    entity: 'contact',
    entityId: contactId,
    actionUrl: `/contacts?highlight=${contactId}`,
    priority: 'medium',
    forUserId: managerName,
  });
}

// ── Agent Inactive (for TL/Manager) ──
export function notifyAgentInactive({ agentName, days, managerName }) {
  return addNotification({
    type: 'agent_inactive',
    title: 'سيلز غير نشط',
    titleEn: 'Inactive Agent',
    message: `${agentName} مفيش أي نشاط من ${days} يوم`,
    messageEn: `${agentName} has no activity for ${days} days`,
    priority: 'high',
    forUserId: managerName,
  });
}

// ── Import Done ──
export function notifyImportDone({ count, importedBy }) {
  return addNotification({
    type: 'import_done',
    title: 'تم الاستيراد',
    titleEn: 'Import Complete',
    message: `تم استيراد ${count} ليد جديد بواسطة ${importedBy}`,
    messageEn: `${count} new leads imported by ${importedBy}`,
    actionUrl: '/contacts',
    priority: 'medium',
    forUserId: 'all',
  });
}

// ── Opportunity Stage Changed ──
export function notifyOppStageChange({ contactName, stage, agentName }) {
  const stageLabels = { qualification: 'تأهيل', proposal: 'عرض', negotiation: 'تفاوض', closing: 'إغلاق', reserved: 'حجز', contracted: 'تعاقد', closed_won: 'تم البيع', closed_lost: 'خسارة' };
  return addNotification({
    type: 'opp_stage',
    title: 'تحديث فرصة',
    titleEn: 'Opportunity Update',
    message: `فرصة "${contactName}" انتقلت لمرحلة: ${stageLabels[stage] || stage}`,
    messageEn: `Opportunity "${contactName}" moved to: ${stage}`,
    actionUrl: '/crm/opportunities',
    priority: stage === 'closed_won' ? 'high' : 'medium',
    forUserId: agentName,
  });
}

// ── Agent Added to Lead ──
export function notifyAgentAdded({ contactName, contactId, agentName, addedBy }) {
  return addNotification({
    type: 'agent_added',
    title: 'ليد جديد',
    titleEn: 'New Lead Added',
    message: `تم إضافتك على "${contactName}" بواسطة ${addedBy}`,
    messageEn: `You've been added to "${contactName}" by ${addedBy}`,
    entity: 'contact',
    entityId: contactId,
    actionUrl: contactId ? `/contacts?highlight=${contactId}` : '/contacts',
    priority: 'high',
    forUserId: agentName,
  });
}

// ── Lead Reassigned (notify new agent only) ──
export function notifyLeadReassigned({ contactName, contactId, newAgentName, assignedBy }) {
  return addNotification({
    type: 'lead_reassigned',
    title: 'ليد اتنقل ليك',
    titleEn: 'Lead Reassigned to You',
    message: `تم نقل "${contactName}" ليك بواسطة ${assignedBy}`,
    messageEn: `"${contactName}" has been reassigned to you by ${assignedBy}`,
    entity: 'contact',
    entityId: contactId,
    actionUrl: contactId ? `/contacts?highlight=${contactId}` : '/contacts',
    priority: 'high',
    forUserId: newAgentName,
  });
}

// ── Contact Birthday ──
export function notifyBirthday({ contactName, contactId, agentName }) {
  return addNotification({
    type: 'birthday',
    title: 'عيد ميلاد عميل',
    titleEn: 'Client Birthday',
    message: `النهارده عيد ميلاد "${contactName}" — ابعتله تهنئة!`,
    messageEn: `Today is "${contactName}"'s birthday — send a greeting!`,
    entity: 'contact',
    entityId: contactId,
    actionUrl: contactId ? `/contacts?highlight=${contactId}` : '/contacts',
    priority: 'medium',
    forUserId: agentName,
  });
}

// ── New Comment on Your Contact ──
export function notifyNewComment({ contactName, contactId, commentBy, agentName }) {
  return addNotification({
    type: 'new_comment',
    title: 'تعليق جديد',
    titleEn: 'New Comment',
    message: `${commentBy} علق على "${contactName}"`,
    messageEn: `${commentBy} commented on "${contactName}"`,
    entity: 'contact',
    entityId: contactId,
    actionUrl: contactId ? `/contacts?highlight=${contactId}` : '/contacts',
    priority: 'medium',
    forUserId: agentName,
  });
}

// ── Import Leads Per Agent ──
export function notifyImportLeadsForAgent({ count, agentName, importedBy }) {
  return addNotification({
    type: 'import_leads',
    title: 'ليدز جديدة من Import',
    titleEn: 'New Imported Leads',
    message: `تم توزيع ${count} ليد جديد عليك من Import بواسطة ${importedBy}`,
    messageEn: `${count} new leads assigned to you from import by ${importedBy}`,
    actionUrl: '/contacts',
    priority: 'high',
    forUserId: agentName,
  });
}
