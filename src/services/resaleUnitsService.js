import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_resale_units';

function getLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveLocal(units) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(units)); } catch { /* quota */ }
}

export async function fetchUnitsByContact(contactId) {
  try {
    const { data, error } = await supabase
      .from('resale_units')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('resaleUnitsService', 'query', err);
    return getLocal().filter(u => u.contact_id === contactId);
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
  } catch (err) { reportError('resaleUnitsService', 'query', err);
    return getLocal();
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
    return data;
  } catch (err) { reportError('resaleUnitsService', 'query', err);
    const all = getLocal();
    all.unshift(unit);
    saveLocal(all);
    return unit;
  }
}

export async function updateUnit(id, updates) {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from('resale_units')
      .update({ ...stripInternalFields(updates), updated_at: now })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (err) { reportError('resaleUnitsService', 'query', err);
    const all = getLocal();
    const idx = all.findIndex(u => u.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates, updated_at: now };
      saveLocal(all);
      return all[idx];
    }
    return null;
  }
}

export async function deleteUnit(id) {
  try {
    const { error } = await supabase
      .from('resale_units')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('resaleUnitsService', 'query', err);
    const all = getLocal().filter(u => u.id !== id);
    saveLocal(all);
  }
}
