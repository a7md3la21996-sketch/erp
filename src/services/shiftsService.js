import supabase from '../lib/supabase';

// ── Shifts ───────────────────────────────────────────────────

export async function fetchShifts() {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createShift(data) {
  const now = new Date().toISOString();
  const { data: d, error } = await supabase
    .from('shifts')
    .insert([{ ...data, created_at: now, updated_at: now }])
    .select('*')
    .single();
  if (error) throw error;
  return d;
}

export async function updateShift(id, updates) {
  const { data, error } = await supabase
    .from('shifts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id) {
  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function setDefaultShift(id) {
  // Clear all defaults first
  const { error: clearErr } = await supabase
    .from('shifts')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .neq('id', id);
  if (clearErr) throw clearErr;

  // Set the chosen shift as default
  const { data, error } = await supabase
    .from('shifts')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
