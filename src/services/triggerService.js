// TODO: Migrate to Supabase — currently entirely localStorage-based
import { syncToSupabase } from '../utils/supabaseSync';
import { createNotification } from './notificationsService';
import { requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

const STORAGE_KEY = 'platform_triggers';
const MAX_TRIGGERS = 100;

// ── localStorage helpers ────────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_TRIGGERS) list = list.slice(0, MAX_TRIGGERS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // QuotaExceededError — trim to half and retry
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_TRIGGERS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

// ── Entity → Event mapping ──────────────────────────────────────────────
export const ENTITY_TYPES = {
  contact:     { ar: 'جهة اتصال',    en: 'Contact' },
  deal:        { ar: 'صفقة',          en: 'Deal' },
  opportunity: { ar: 'فرصة بيعية',    en: 'Opportunity' },
  leave:       { ar: 'إجازة',         en: 'Leave' },
  task:        { ar: 'مهمة',          en: 'Task' },
};

export const EVENT_TYPES = {
  created:        { ar: 'تم الإنشاء',        en: 'Created' },
  updated:        { ar: 'تم التعديل',         en: 'Updated' },
  status_changed: { ar: 'تغيير الحالة',       en: 'Status Changed' },
  stage_changed:  { ar: 'تغيير المرحلة',      en: 'Stage Changed' },
  assigned:       { ar: 'تم التعيين',         en: 'Assigned' },
  overdue:        { ar: 'متأخر',              en: 'Overdue' },
};

export const ENTITY_EVENTS = {
  contact:     ['created', 'updated', 'status_changed', 'assigned'],
  deal:        ['created', 'updated', 'status_changed', 'stage_changed'],
  opportunity: ['created', 'updated', 'stage_changed', 'assigned'],
  leave:       ['created', 'updated', 'status_changed'],
  task:        ['created', 'updated', 'assigned', 'overdue', 'status_changed'],
};

export const ACTION_TYPES = {
  notification:  { ar: 'إشعار',          en: 'Notification' },
  assign:        { ar: 'اقتراح تعيين',    en: 'Assign Suggestion' },
  status_change: { ar: 'تغيير حالة',      en: 'Status Change' },
  tag:           { ar: 'وسم',             en: 'Tag' },
};

export const CONDITION_OPERATORS = {
  equals:       { ar: 'يساوي',        en: 'equals' },
  not_equals:   { ar: 'لا يساوي',     en: 'not equals' },
  contains:     { ar: 'يحتوي',        en: 'contains' },
  not_contains: { ar: 'لا يحتوي',     en: 'does not contain' },
  gt:           { ar: 'أكبر من',       en: 'greater than' },
  lt:           { ar: 'أصغر من',       en: 'less than' },
  is_empty:     { ar: 'فارغ',          en: 'is empty' },
  is_not_empty: { ar: 'غير فارغ',      en: 'is not empty' },
};

// ── CRUD ────────────────────────────────────────────────────────────────
export function createTrigger(trigger) {
  // Triggers fire automated actions on entity events. A malicious trigger
  // could mass-delete records or auto-assign leads. Admin-only.
  requirePerm(P.SETTINGS_MANAGE, 'Not allowed to create triggers');
  const list = load();
  const newTrigger = {
    id: 'trig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: trigger.name || '',
    entity: trigger.entity || 'contact',
    event: trigger.event || 'created',
    conditions: trigger.conditions || [],
    actions: trigger.actions || [],
    enabled: trigger.enabled !== false,
    created_at: new Date().toISOString(),
    created_by: trigger.created_by || 'System',
    updated_at: new Date().toISOString(),
  };
  list.unshift(newTrigger);
  save(list);
  return newTrigger;
}

export function getTriggers() {
  return load();
}

export function updateTrigger(id, updates) {
  requirePerm(P.SETTINGS_MANAGE, 'Not allowed to update triggers');
  const list = load();
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
  save(list);
  return list[idx];
}

export function deleteTrigger(id) {
  requirePerm(P.SETTINGS_MANAGE, 'Not allowed to delete triggers');
  const list = load().filter(t => t.id !== id);
  save(list);
}

export function toggleTrigger(id) {
  const list = load();
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return null;
  list[idx].enabled = !list[idx].enabled;
  list[idx].updated_at = new Date().toISOString();
  save(list);
  return list[idx];
}

// ── Condition evaluation ────────────────────────────────────────────────
function evaluateCondition(condition, data) {
  const { field, operator, value } = condition;
  const actual = data?.[field];

  switch (operator) {
    case 'equals':       return String(actual) === String(value);
    case 'not_equals':   return String(actual) !== String(value);
    case 'contains':     return String(actual || '').toLowerCase().includes(String(value).toLowerCase());
    case 'not_contains': return !String(actual || '').toLowerCase().includes(String(value).toLowerCase());
    case 'gt':           return Number(actual) > Number(value);
    case 'lt':           return Number(actual) < Number(value);
    case 'is_empty':     return !actual || actual === '' || actual === null || actual === undefined;
    case 'is_not_empty': return actual !== '' && actual !== null && actual !== undefined;
    default:             return true;
  }
}

function evaluateAllConditions(conditions, data) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, data));
}

// ── Action executors ────────────────────────────────────────────────────
function executeAction(action, entity, event, data) {
  const results = [];

  switch (action.type) {
    case 'notification': {
      const config = action.config || {};
      const notification = createNotification({
        type: config.notification_type || 'system',
        title_ar: config.title_ar || `تنبيه تلقائي: ${ENTITY_TYPES[entity]?.ar || entity}`,
        title_en: config.title_en || `Auto trigger: ${ENTITY_TYPES[entity]?.en || entity}`,
        body_ar: config.body_ar || `${EVENT_TYPES[event]?.ar || event} — ${data?.full_name || data?.name || data?.id || ''}`,
        body_en: config.body_en || `${EVENT_TYPES[event]?.en || event} — ${data?.full_name || data?.name || data?.id || ''}`,
        for_user_id: config.for_user_id || 'all',
        entity_type: entity,
        entity_id: data?.id || null,
        from_user: 'trigger_system',
      });
      results.push({ type: 'notification', success: true, data: notification });
      break;
    }

    case 'assign': {
      const config = action.config || {};
      results.push({
        type: 'assign',
        success: true,
        suggestion: {
          entity_id: data?.id,
          assign_to: config.assign_to || null,
          assign_to_name: config.assign_to_name || '',
          message: `Suggest assigning ${data?.full_name || data?.name || ''} to ${config.assign_to_name || 'specified user'}`,
        },
      });
      break;
    }

    case 'status_change': {
      const config = action.config || {};
      results.push({
        type: 'status_change',
        success: true,
        suggestion: {
          entity_id: data?.id,
          new_status: config.new_status || '',
          message: `Suggest changing status to ${config.new_status || ''}`,
        },
      });
      break;
    }

    case 'tag': {
      const config = action.config || {};
      results.push({
        type: 'tag',
        success: true,
        suggestion: {
          entity_id: data?.id,
          tag: config.tag || '',
          message: `Suggest adding tag: ${config.tag || ''}`,
        },
      });
      break;
    }

    default:
      break;
  }

  return results;
}

// ── Main evaluator ──────────────────────────────────────────────────────
/**
 * Evaluate all enabled triggers matching entity+event, check conditions, execute actions.
 * @param {string} entity - 'contact' | 'deal' | 'opportunity' | 'leave' | 'task'
 * @param {string} event - 'created' | 'updated' | 'status_changed' | 'stage_changed' | 'assigned' | 'overdue'
 * @param {object} data - the entity data object
 * @returns {Array} results from all executed actions
 */
export function evaluateTriggers(entity, event, data) {
  const triggers = load().filter(t => t.enabled && t.entity === entity && t.event === event);
  const allResults = [];

  for (const trigger of triggers) {
    if (evaluateAllConditions(trigger.conditions, data)) {
      for (const action of (trigger.actions || [])) {
        const results = executeAction(action, entity, event, data);
        allResults.push(...results.map(r => ({ ...r, trigger_id: trigger.id, trigger_name: trigger.name })));
      }
    }
  }

  return allResults;
}
