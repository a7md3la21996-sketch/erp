import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'platform-erp-auth',
  },
  global: {
    headers: { 'x-client-info': 'platform-erp/2.0' },
  },
  realtime: {
    params: { eventsPerSecond: 10 }, // rate limit realtime events
  },
});

/**
 * Helper for services: wraps a Supabase call and auto-reports errors.
 * Usage: const data = await safeQuery('contacts', 'fetch', () => supabase.from('contacts').select('*'));
 */
export async function safeQuery(table, operation, queryFn) {
  try {
    const result = await queryFn();
    if (result?.error) {
      import('../utils/errorReporter.js').then(m => m.reportError(`supabase.${table}`, operation, result.error)).catch(() => {});
    }
    return result;
  } catch (err) {
    import('../utils/errorReporter.js').then(m => m.reportError(`supabase.${table}`, operation, err)).catch(() => {});
    throw err;
  }
}

export default supabase;
