import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

// ── Action types for detailed tracking ──────────────────────────────────
export const ACTION_TYPES = {
  create:           { ar: 'إنشاء',           en: 'Create' },
  update:           { ar: 'تعديل',           en: 'Update' },
  delete:           { ar: 'حذف',             en: 'Delete' },
  status_change:    { ar: 'تغيير حالة',      en: 'Status Change' },
  type_change:      { ar: 'تغيير نوع',       en: 'Type Change' },
  blacklist:        { ar: 'بلاك ليست',       en: 'Blacklisted' },
  unblacklist:      { ar: 'إلغاء بلاك ليست', en: 'Unblacklisted' },
  reassign:         { ar: 'إعادة تعيين',     en: 'Reassigned' },
  bulk_reassign:    { ar: 'إعادة تعيين جماعي', en: 'Bulk Reassign' },
  bulk_delete:      { ar: 'حذف جماعي',       en: 'Bulk Delete' },
  merge:            { ar: 'دمج',             en: 'Merge' },
  import:           { ar: 'استيراد',          en: 'Import' },
  stage_change:     { ar: 'تغيير مرحلة',     en: 'Stage Change' },
  temperature_change: { ar: 'تغيير حرارة',   en: 'Temperature Change' },
  score_change:     { ar: 'تغيير تقييم',     en: 'Score Change' },
  assign:           { ar: 'تعيين',           en: 'Assigned' },
  batch_call:       { ar: 'اتصال جماعي',     en: 'Batch Call' },
  note:             { ar: 'ملاحظة',          en: 'Note' },
  export:           { ar: 'تصدير',           en: 'Export' },
};

export async function getAuditLogs({ limit = 50, offset = 0, action, entity, search } = {}) {
  try {
    let query = supabase.from('audit_logs').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (action) query = query.eq('action', action);
    if (entity) query = query.eq('entity', entity);
    if (search) query = query.or(`description.ilike.%${search}%,entity_name.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) { reportError('auditService', 'getAuditLogs', error); return { data: [], total: 0 }; }
    return { data: data || [], total: count || 0 };
  } catch (err) { reportError('auditService', 'getAuditLogs', err); return { data: [], total: 0 }; }
}

// Backward-compatible alias
export const getLocalAuditLogs = getAuditLogs;

// ── Main audit function ─────────────────────────────────────────────────
export async function logAudit({ action, entity, entityId, entityName = '', oldData = null, newData = null, description = '', userName = '' }) {
  // Build changes diff
  const SKIP_FIELDS = ['id','created_at','updated_at','opportunities','activities','campaign_interactions','extra_phones','_country','users','lead_score_history'];
  let changes = null;
  if (oldData && newData) {
    changes = {};
    const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    keys.forEach(k => {
      if (SKIP_FIELDS.includes(k)) return;
      const oldVal = oldData[k];
      const newVal = newData[k];
      if (typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null) return;
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[k] = { from: oldVal, to: newVal };
      }
    });
    if (Object.keys(changes).length === 0) changes = null;
  }

  // Strip sensitive fields before storing
  const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'access_token', 'refresh_token', 'api_key', 'apikey', 'credit_card', 'ssn', 'national_id'];
  function stripSensitive(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some(f => k.toLowerCase().includes(f))) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  // Save to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action,
        entity,
        entity_id: entityId,
        entity_name: entityName,
        old_data: stripSensitive(oldData),
        new_data: stripSensitive(newData),
        changes,
        description,
        user_agent: navigator.userAgent,
      });
    } else {
      reportError('auditService', 'logAudit', new Error('No authenticated user'));
    }
  } catch (err) { reportError('auditService', 'logAudit', err); }
}

// ── Convenience helpers ─────────────────────────────────────────────────
export const logCreate = (entity, id, data, desc, userName) =>
  logAudit({ action: 'create', entity, entityId: id, entityName: data?.full_name || data?.name || '', newData: data, description: desc || 'Created ' + entity, userName });

export const logUpdate = (entity, id, old, now, desc, userName) =>
  logAudit({ action: 'update', entity, entityId: id, entityName: now?.full_name || now?.name || '', oldData: old, newData: now, description: desc || 'Updated ' + entity, userName });

export const logDelete = (entity, id, old, desc, userName) =>
  logAudit({ action: 'delete', entity, entityId: id, entityName: old?.full_name || old?.name || '', oldData: old, description: desc || 'Deleted ' + entity, userName });

// ── Specific action loggers ─────────────────────────────────────────────
export const logAction = ({ action, entity, entityId, entityName, description, oldValue, newValue, userName }) =>
  logAudit({
    action,
    entity,
    entityId,
    entityName,
    oldData: oldValue != null ? (typeof oldValue === 'object' && !Array.isArray(oldValue) ? oldValue : { value: oldValue }) : null,
    newData: newValue != null ? (typeof newValue === 'object' && !Array.isArray(newValue) ? newValue : { value: newValue }) : null,
    description,
    userName,
  });
