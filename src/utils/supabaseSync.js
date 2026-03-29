/**
 * Shared Supabase sync utility for localStorage-based services.
 * Non-blocking — saves to system_config table as JSON.
 */

let _supabase = null;

async function getClient() {
  if (!_supabase) {
    const mod = await import('../lib/supabase');
    _supabase = mod.default;
  }
  return _supabase;
}

/**
 * Sync a localStorage key to Supabase system_config table.
 * Non-blocking — fire and forget.
 */
export function syncToSupabase(key, value) {
  getClient().then(supabase => {
    supabase.from('system_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(() => {})
      .catch(() => {});
  }).catch(() => {});
}

/**
 * Load a key from Supabase system_config, fallback to localStorage.
 */
export async function loadFromSupabase(key, localStorageKey) {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (!error && data?.value) {
      // Sync to localStorage as cache
      try { localStorage.setItem(localStorageKey, JSON.stringify(data.value)); } catch {}
      return data.value;
    }
  } catch {}
  // Fallback to localStorage
  try { return JSON.parse(localStorage.getItem(localStorageKey) || '[]'); } catch { return []; }
}
