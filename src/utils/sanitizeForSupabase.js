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
  'activities', 'tasks', 'deals', 'shifts',
]);

// Map frontend field names to database column names
// NOTE: 'department' is NOT mapped — contacts table uses 'department', employees uses 'department_id'
const FIELD_MAP = {
  employment_type: 'contract_type',
  join_date: 'hire_date',
};

export function stripInternalFields(data) {
  if (!data || typeof data !== 'object') return data;
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (INTERNAL_FIELDS.has(k)) continue;
    if (k.startsWith('_')) continue;
    // Map field name if needed
    const mappedKey = FIELD_MAP[k] || k;
    clean[mappedKey] = v;
  }
  return clean;
}
