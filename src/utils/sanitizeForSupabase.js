/**
 * Strip internal/frontend-only fields before sending to Supabase.
 * Use before every .insert() and .update() call.
 *
 * Critical: virtual fields like my_status / my_temperature / my_score are
 * computed by withAgentView for SmartFilter and chips. They DON'T exist as
 * DB columns — sending them causes PostgREST to reject the whole UPDATE
 * with "column not found", which is what silently dropped 200+ writes
 * during the unhealthy DB period. Strip them aggressively.
 */
const INTERNAL_FIELDS = new Set([
  '_customFieldValues', '_offline', '_campaign_count', '_country',
  '_opp_count', '_aging_level', '_interactionLogged', '_skipConfirmed',
  '_skipGate', '_touchStart',
  // Computed per-agent virtual fields (no underscore prefix → escaped startsWith filter)
  'my_status', 'my_temperature', 'my_score',
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
