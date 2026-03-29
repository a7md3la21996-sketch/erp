import supabase from '../lib/supabase';

/**
 * Optimistic locking: check if a record was modified by someone else
 * before saving. Prevents silent overwrites.
 *
 * Usage:
 *   const conflict = await checkConflict('contacts', contactId, myLastKnownUpdatedAt);
 *   if (conflict) {
 *     toast.error('This record was modified by someone else. Please refresh.');
 *     return;
 *   }
 *   // safe to save
 *
 * @param {string} table - Supabase table name
 * @param {string} id - Record ID
 * @param {string} lastKnownUpdatedAt - ISO timestamp of when we last loaded the record
 * @returns {object|null} - null if safe, { updatedAt, updatedBy } if conflict
 */
export async function checkConflict(table, id, lastKnownUpdatedAt) {
  if (!lastKnownUpdatedAt) return null; // no baseline = skip check

  try {
    const { data, error } = await supabase
      .from(table)
      .select('updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null; // can't check = allow save

    const serverTime = new Date(data.updated_at).getTime();
    const clientTime = new Date(lastKnownUpdatedAt).getTime();

    // If server version is newer than our baseline → conflict
    if (serverTime > clientTime + 1000) { // 1s tolerance for clock skew
      return {
        updatedAt: data.updated_at,
        message_ar: 'تم تعديل هذا السجل بواسطة شخص آخر. يرجى تحديث الصفحة.',
        message_en: 'This record was modified by someone else. Please refresh.',
      };
    }
  } catch {
    // If check fails, allow save (don't block on network error)
  }

  return null;
}

/**
 * Safe update: check for conflicts before saving.
 * Returns the updated record or throws on conflict.
 */
export async function safeUpdate(table, id, updates, lastKnownUpdatedAt) {
  const conflict = await checkConflict(table, id, lastKnownUpdatedAt);
  if (conflict) {
    throw new Error(conflict.message_en);
  }

  const { data, error } = await supabase
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
