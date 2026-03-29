import supabase from '../lib/supabase';
import { reportError } from './errorReporter';

/**
 * Batch insert records into a Supabase table.
 * Splits large arrays into chunks to avoid request size limits.
 *
 * @param {string} table - Supabase table name
 * @param {Array} records - Array of records to insert
 * @param {number} chunkSize - Max records per request (default 100)
 * @returns {Array} All inserted records
 */
export async function batchInsert(table, records, chunkSize = 100) {
  if (!records?.length) return [];
  const results = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabase
        .from(table)
        .insert(chunk)
        .select('*');
      if (error) throw error;
      if (data) results.push(...data);
    } catch (err) {
      reportError(`batchInsert.${table}`, `chunk ${Math.floor(i / chunkSize)}`, err);
    }
  }
  return results;
}

/**
 * Batch update records in a Supabase table.
 * Each item must have an `id` field.
 *
 * @param {string} table - Supabase table name
 * @param {Array} updates - Array of { id, ...fields }
 * @param {number} chunkSize - Max records per batch
 * @returns {number} Count of updated records
 */
export async function batchUpdate(table, updates, chunkSize = 50) {
  if (!updates?.length) return 0;
  let count = 0;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const promises = chunk.map(({ id, ...fields }) =>
      supabase.from(table).update(fields).eq('id', id)
    );
    try {
      const results = await Promise.allSettled(promises);
      count += results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
    } catch (err) {
      reportError(`batchUpdate.${table}`, `chunk ${Math.floor(i / chunkSize)}`, err);
    }
  }
  return count;
}

/**
 * Batch delete records by IDs.
 *
 * @param {string} table - Supabase table name
 * @param {Array} ids - Array of IDs to delete
 * @param {number} chunkSize - Max IDs per request
 * @returns {number} Count of deleted records
 */
export async function batchDelete(table, ids, chunkSize = 100) {
  if (!ids?.length) return { success: 0, failed: 0, failedIds: [] };
  let success = 0;
  const failedIds = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const { error } = await supabase.from(table).delete().in('id', chunk);
      if (error) throw error;
      success += chunk.length;
    } catch (err) {
      reportError(`batchDelete.${table}`, `chunk ${Math.floor(i / chunkSize)}`, err);
      failedIds.push(...chunk);
    }
  }
  return { success, failed: failedIds.length, failedIds };
}
