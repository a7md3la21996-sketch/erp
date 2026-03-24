// ── Custom Fields Service ────────────────────────────────────────────────
// localStorage-based custom field definitions and values, with Supabase sync

import supabase from '../lib/supabase';

const FIELDS_KEY = 'platform_custom_fields';
const VALUES_KEY = 'platform_cf_values';
const SUPABASE_FIELDS_TABLE = 'custom_fields';
const SUPABASE_VALUES_TABLE = 'custom_field_values';

// ── Helpers ──────────────────────────────────────────────────────────────
function getStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function setStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      // Trim oldest entries for values store
      if (key === VALUES_KEY && Array.isArray(data) && data.length > 100) {
        data = data.slice(0, Math.ceil(data.length / 2));
        try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* give up */ }
      }
    }
  }
}

function uid() {
  return 'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Field Definitions CRUD ───────────────────────────────────────────────

/** Get all field definitions */
export async function getFields() {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_FIELDS_TABLE)
      .select('*')
      .order('sort_order');
    if (!error && data) {
      setStore(FIELDS_KEY, data);
      return data;
    }
  } catch (err) {
    console.warn('Supabase getFields failed, falling back to localStorage:', err);
  }
  return getStore(FIELDS_KEY);
}

/** Get field definitions for a specific entity */
export async function getFieldsByEntity(entity) {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_FIELDS_TABLE)
      .select('*')
      .eq('entity', entity)
      .order('sort_order');
    if (!error && data) return data;
  } catch (err) {
    console.warn('Supabase getFieldsByEntity failed, falling back to localStorage:', err);
  }
  return getStore(FIELDS_KEY)
    .filter(f => f.entity === entity)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

/** Add a new field definition */
export async function addField(fieldDef) {
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
  try {
    const { error } = await supabase.from(SUPABASE_FIELDS_TABLE).insert(newField);
    if (error) console.warn('Supabase addField failed:', error);
  } catch (err) {
    console.warn('Supabase addField failed:', err);
  }
  return newField;
}

/** Update an existing field definition */
export async function updateField(id, updates) {
  const fields = getStore(FIELDS_KEY);
  const idx = fields.findIndex(f => f.id === id);
  if (idx === -1) return null;
  const updated = { ...fields[idx], ...updates, id }; // id cannot change
  fields[idx] = updated;
  setStore(FIELDS_KEY, fields);
  try {
    const { error } = await supabase.from(SUPABASE_FIELDS_TABLE).update(updates).eq('id', id);
    if (error) console.warn('Supabase updateField failed:', error);
  } catch (err) {
    console.warn('Supabase updateField failed:', err);
  }
  return updated;
}

/** Delete a field definition and its values */
export async function deleteField(id) {
  let fields = getStore(FIELDS_KEY);
  fields = fields.filter(f => f.id !== id);
  setStore(FIELDS_KEY, fields);
  // Also remove all values for this field
  let values = getStore(VALUES_KEY);
  values = values.filter(v => v.field_id !== id);
  setStore(VALUES_KEY, values);
  try {
    await supabase.from(SUPABASE_VALUES_TABLE).delete().eq('field_id', id);
    const { error } = await supabase.from(SUPABASE_FIELDS_TABLE).delete().eq('id', id);
    if (error) console.warn('Supabase deleteField failed:', error);
  } catch (err) {
    console.warn('Supabase deleteField failed:', err);
  }
  return true;
}

// ── Field Values CRUD ────────────────────────────────────────────────────

/** Set a field value for an entity record */
export async function setFieldValue(entity, entityId, fieldId, value) {
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
  try {
    const { error } = await supabase
      .from(SUPABASE_VALUES_TABLE)
      .upsert(entry, { onConflict: 'entity,entity_id,field_id' });
    if (error) console.warn('Supabase setFieldValue failed:', error);
  } catch (err) {
    console.warn('Supabase setFieldValue failed:', err);
  }
  return entry;
}

/** Set multiple field values at once */
export async function setFieldValues(entity, entityId, fieldValues) {
  // fieldValues: { [fieldId]: value }
  await Promise.all(
    Object.entries(fieldValues).map(([fieldId, value]) =>
      setFieldValue(entity, entityId, fieldId, value)
    )
  );
}

/** Get all field values for a specific entity record */
export async function getFieldValues(entity, entityId) {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_VALUES_TABLE)
      .select('field_id, value')
      .eq('entity', entity)
      .eq('entity_id', entityId);
    if (!error && data) {
      const result = {};
      data.forEach(v => { result[v.field_id] = v.value; });
      return result;
    }
  } catch (err) {
    console.warn('Supabase getFieldValues failed, falling back to localStorage:', err);
  }
  const values = getStore(VALUES_KEY);
  const result = {};
  values
    .filter(v => v.entity === entity && v.entity_id === entityId)
    .forEach(v => { result[v.field_id] = v.value; });
  return result;
}

/** Get all field values for an entity type (grouped by entity_id) */
export async function getAllFieldValues(entity) {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_VALUES_TABLE)
      .select('entity_id, field_id, value')
      .eq('entity', entity);
    if (!error && data) {
      const result = {};
      data.forEach(v => {
        if (!result[v.entity_id]) result[v.entity_id] = {};
        result[v.entity_id][v.field_id] = v.value;
      });
      return result;
    }
  } catch (err) {
    console.warn('Supabase getAllFieldValues failed, falling back to localStorage:', err);
  }
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
