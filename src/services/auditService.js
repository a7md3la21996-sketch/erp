import supabase from '../lib/supabase';

export async function logAudit({ action, entity, entityId, oldData = null, newData = null, description = '' }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let changes = null;
    if (oldData && newData) {
      changes = {};
      const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
      keys.forEach(k => {
        if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
          changes[k] = { from: oldData[k], to: newData[k] };
        }
      });
      if (Object.keys(changes).length === 0) return;
    }
    await supabase.from('audit_logs').insert({ user_id: user.id, action, entity, entity_id: entityId, old_data: oldData, new_data: newData, changes, description, user_agent: navigator.userAgent });
  } catch (err) { console.error('Audit error:', err); }
}

export const logCreate = (entity, id, data, desc) => logAudit({ action: 'create', entity, entityId: id, newData: data, description: desc || 'Created ' + entity });
export const logUpdate = (entity, id, old, now, desc) => logAudit({ action: 'update', entity, entityId: id, oldData: old, newData: now, description: desc || 'Updated ' + entity });
export const logDelete = (entity, id, old, desc) => logAudit({ action: 'delete', entity, entityId: id, oldData: old, description: desc || 'Deleted ' + entity });
