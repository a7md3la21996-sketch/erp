import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import { logAudit } from './auditService';
import supabase from '../lib/supabase';


export async function fetchUnitsByContact(contactId) {
  try {
    const { data, error } = await supabase
      .from('resale_units')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('resaleUnitsService', 'query', err);
    return [];
  }
}

export async function fetchAllUnits() {
  try {
    const { data, error } = await supabase
      .from('resale_units')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('resaleUnitsService', 'query', err);
    return [];
  }
}

export async function createUnit(unitData) {
  const now = new Date().toISOString();
  const unit = {
    ...unitData,
    id: unitData.id || crypto.randomUUID?.() || 'unit_' + Date.now(),
    created_at: now,
    updated_at: now,
  };
  try {
    const { data, error } = await supabase
      .from('resale_units')
      .insert([unit])
      .select('*')
      .single();
    if (error) throw error;
    // Audit — resale unit listings carry price, so capture the row
    // for the trail. logAudit's SENSITIVE_FIELDS strip handles any
    // accidentally-passed credentials in unitData.
    logAudit({
      action: 'create',
      entity: 'resale_unit',
      entityId: data.id,
      entityName: data.unit_number || data.title || data.id,
      newData: data,
      description: `Created resale unit listing`,
    });
    return data;
  } catch (err) {
    reportError('resaleUnitsService', 'createUnit', err);
    throw err;
  }
}

export async function updateUnit(id, updates) {
  const now = new Date().toISOString();
  try {
    // Snapshot the old row first so the audit can show old→new for
    // price changes and other field edits — without this, the diff
    // column on the audit row would only carry the new payload.
    const { data: oldRow } = await supabase
      .from('resale_units')
      .select('*')
      .eq('id', id)
      .single();
    const { data, error } = await supabase
      .from('resale_units')
      .update({ ...stripInternalFields(updates), updated_at: now })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    logAudit({
      action: 'update',
      entity: 'resale_unit',
      entityId: id,
      entityName: data.unit_number || data.title || id,
      oldData: oldRow,
      newData: data,
      description: `Updated resale unit listing`,
    });
    return data;
  } catch (err) {
    reportError('resaleUnitsService', 'query', err);
    return null;
  }
}

export async function deleteUnit(id) {
  try {
    // Snapshot before delete so the audit captures what was removed.
    const { data: oldRow } = await supabase
      .from('resale_units')
      .select('*')
      .eq('id', id)
      .single();
    const { error } = await supabase
      .from('resale_units')
      .delete()
      .eq('id', id);
    if (error) throw error;
    logAudit({
      action: 'delete',
      entity: 'resale_unit',
      entityId: id,
      entityName: oldRow?.unit_number || oldRow?.title || id,
      oldData: oldRow,
      description: `Deleted resale unit listing`,
    });
  } catch (err) {
    reportError('resaleUnitsService', 'query', err);
  }
}
