// TODO: Migrate to Supabase — currently reads from localStorage, writes sync to system_config
// ── Custom Fields Service ────────────────────────────────────────────────
// localStorage with Supabase sync for custom field definitions and values

const FIELDS_KEY = 'platform_custom_fields';
const VALUES_KEY = 'platform_cf_values';

function syncToSupabase(key, value) {
  import('../lib/supabase').then(({ default: supabase }) => {
    supabase.from('system_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(() => {}).catch(() => {});
  }).catch(() => {});
}

// ── Helpers ──────────────────────────────────────────────────────────────
function getStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function setStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      if (key === VALUES_KEY && Array.isArray(data) && data.length > 100) {
        data = data.slice(0, Math.ceil(data.length / 2));
        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      }
    }
  }
  syncToSupabase(key, data);
}

function uid() {
  return 'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Field Definitions CRUD ───────────────────────────────────────────────

/** Get all field definitions */
export function getFields() {
  return getStore(FIELDS_KEY);
}

/** Get field definitions for a specific entity */
export function getFieldsByEntity(entity) {
  return getStore(FIELDS_KEY)
    .filter(f => f.entity === entity)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

/** Add a new field definition */
export function addField(fieldDef) {
  const fields = getStore(FIELDS_KEY);
  const newField = {
    id: uid(),
    entity: fieldDef.entity || 'contact',
    field_name: fieldDef.field_name || '',
    field_name_ar: fieldDef.field_name_ar || '',
    field_type: fieldDef.field_type || 'text',
    options: fieldDef.options || [],
    required: fieldDef.required || false,
    default_value: fieldDef.default_value ?? '',
    sort_order: fieldDef.sort_order ?? fields.filter(f => f.entity === fieldDef.entity).length,
    created_at: new Date().toISOString(),
  };
  fields.push(newField);
  setStore(FIELDS_KEY, fields);
  return newField;
}

/** Update an existing field definition */
export function updateField(id, updates) {
  const fields = getStore(FIELDS_KEY);
  const idx = fields.findIndex(f => f.id === id);
  if (idx === -1) return null;
  const updated = { ...fields[idx], ...updates, id }; // id cannot change
  fields[idx] = updated;
  setStore(FIELDS_KEY, fields);
  return updated;
}

/** Delete a field definition and its values */
export function deleteField(id) {
  let fields = getStore(FIELDS_KEY);
  fields = fields.filter(f => f.id !== id);
  setStore(FIELDS_KEY, fields);
  // Also remove all values for this field
  let values = getStore(VALUES_KEY);
  values = values.filter(v => v.field_id !== id);
  setStore(VALUES_KEY, values);
  return true;
}

// ── Field Values CRUD ────────────────────────────────────────────────────

/** Set a field value for an entity record */
export function setFieldValue(entity, entityId, fieldId, value) {
  const values = getStore(VALUES_KEY);
  const idx = values.findIndex(v => v.entity === entity && v.entity_id === entityId && v.field_id === fieldId);
  const entry = {
    entity,
    entity_id: entityId,
    field_id: fieldId,
    value,
    updated_at: new Date().toISOString(),
  };
  if (idx !== -1) {
    values[idx] = entry;
  } else {
    values.push(entry);
  }
  setStore(VALUES_KEY, values);
  return entry;
}

/** Set multiple field values at once */
export function setFieldValues(entity, entityId, fieldValues) {
  // fieldValues: { [fieldId]: value }
  Object.entries(fieldValues).forEach(([fieldId, value]) => {
    setFieldValue(entity, entityId, fieldId, value);
  });
}

/** Get all field values for a specific entity record */
export function getFieldValues(entity, entityId) {
  const values = getStore(VALUES_KEY);
  const result = {};
  values
    .filter(v => v.entity === entity && v.entity_id === entityId)
    .forEach(v => { result[v.field_id] = v.value; });
  return result;
}

/** Get all field values for an entity type (grouped by entity_id) */
export function getAllFieldValues(entity) {
  const values = getStore(VALUES_KEY);
  const result = {};
  values
    .filter(v => v.entity === entity)
    .forEach(v => {
      if (!result[v.entity_id]) result[v.entity_id] = {};
      result[v.entity_id][v.field_id] = v.value;
    });
  return result;
}
