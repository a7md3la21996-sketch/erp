import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to Supabase Realtime postgres_changes on a table.
 * When any INSERT/UPDATE/DELETE happens, the callback fires.
 *
 * IMPORTANT: For realtime to work, you must enable replication on the tables.
 * Run in Supabase SQL Editor:
 * ALTER PUBLICATION supabase_realtime ADD TABLE contacts, opportunities, activities, tasks, deals, system_config, users;
 *
 * @param {string} table - The Supabase table name to subscribe to
 * @param {Function} callback - Called with the realtime payload on any change
 */
export function useRealtimeSubscription(table, callback) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime_${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback]);
}
