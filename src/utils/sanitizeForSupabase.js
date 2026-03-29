/**
 * Strip internal/frontend-only fields before sending to Supabase.
 * Use before every .insert() and .update() call.
 */
const INTERNAL_FIELDS = new Set([
  '_customFieldValues', '_offline', '_campaign_count', '_country',
  '_opp_count', '_aging_level', '_interactionLogged', '_skipConfirmed',
  '_skipGate', '_touchStart',
  'countryCode', 'country',
  'contacts', 'users', 'projects', 'opportunities', 'departments',
  'activities', 'tasks', 'deals',
]);

export function stripInternalFields(data) {
  if (!data || typeof data !== 'object') return data;
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (INTERNAL_FIELDS.has(k)) continue;
    if (k.startsWith('_')) continue; // skip all underscore-prefixed internal fields
    clean[k] = v;
  }
  return clean;
}
