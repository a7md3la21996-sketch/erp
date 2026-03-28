import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to Supabase Realtime postgres_changes on a table.
 * Callback receives the payload with { eventType, new: record, old: record }.
 * Use payload.eventType ('INSERT'|'UPDATE'|'DELETE') to do smart upsert
 * instead of full re-fetch.
 */
export function useRealtimeSubscription(table, callback) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime_${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        // Pass the full payload so consumers can do granular updates
        callback(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback]);
}

/**
 * Helper: apply a realtime payload to an existing array state.
 * Returns a new array with the record inserted/updated/removed.
 *
 * Usage:
 *   useRealtimeSubscription('contacts', useCallback((payload) => {
 *     setContacts(prev => applyRealtimePayload(prev, payload));
 *   }, []));
 */
export function applyRealtimePayload(currentArray, payload, idField = 'id') {
  const { eventType } = payload;
  const newRecord = payload.new;
  const oldRecord = payload.old;

  switch (eventType) {
    case 'INSERT':
      // Add to beginning, avoid duplicates
      if (currentArray.some(r => String(r[idField]) === String(newRecord[idField]))) {
        return currentArray.map(r => String(r[idField]) === String(newRecord[idField]) ? { ...r, ...newRecord } : r);
      }
      return [newRecord, ...currentArray];

    case 'UPDATE':
      return currentArray.map(r =>
        String(r[idField]) === String(newRecord[idField]) ? { ...r, ...newRecord } : r
      );

    case 'DELETE':
      return currentArray.filter(r =>
        String(r[idField]) !== String(oldRecord?.[idField])
      );

    default:
      return currentArray;
  }
}
