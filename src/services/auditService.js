import supabase from '../lib/supabase';

const LOCAL_KEY = 'platform_audit_logs';

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
};

// ── localStorage helpers ────────────────────────────────────────────────
function getLocalLogs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function saveLocalLog(entry) {
  try {
    const logs = getLocalLogs();
    logs.unshift(entry);
    // Keep max 500 local logs
    if (logs.length > 500) logs.length = 500;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(logs));
  } catch { /* ignore */ }
}

export function getLocalAuditLogs({ limit = 50, offset = 0, action, entity, search } = {}) {
  let logs = getLocalLogs();
  if (action) logs = logs.filter(l => l.action === action);
  if (entity) logs = logs.filter(l => l.entity === entity);
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l => (l.description || '').toLowerCase().includes(q) || (l.entity_name || '').toLowerCase().includes(q) || (l.user_name || '').toLowerCase().includes(q));
  }
  return { data: logs.slice(offset, offset + limit), total: logs.length };
}

// ── Main audit function ─────────────────────────────────────────────────
export async function logAudit({ action, entity, entityId, entityName = '', oldData = null, newData = null, description = '', userName = '' }) {
  // Build changes diff
  let changes = null;
  if (oldData && newData) {
    changes = {};
    const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    keys.forEach(k => {
      if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
        changes[k] = { from: oldData[k], to: newData[k] };
      }
    });
    if (Object.keys(changes).length === 0) changes = null;
  }

  const localEntry = {
    id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    action,
    entity,
    entity_id: entityId,
    entity_name: entityName,
    old_data: oldData,
    new_data: newData,
    changes,
    description,
    user_name: userName || 'System',
    user_agent: navigator.userAgent,
    created_at: new Date().toISOString(),
  };

  // Always save locally
  saveLocalLog(localEntry);

  // Try Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action,
        entity,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        changes,
        description,
        user_agent: navigator.userAgent,
      });
    }
  } catch { /* ignore - already saved locally */ }
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
    oldData: oldValue != null ? { value: oldValue } : null,
    newData: newValue != null ? { value: newValue } : null,
    description,
    userName,
  });
