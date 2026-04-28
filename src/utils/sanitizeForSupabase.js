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

// Known columns on the `contacts` table. Used by KNOWN_COLUMNS['contacts'] to
// flag fields the sanitizer doesn't recognize as either internal-strippable
// or a real column. Update this when a contacts column is added in a
// migration. The list is intentionally permissive — when in doubt, include
// the column. Missing a column here only triggers a dev-mode warning, never
// a silent strip.
const KNOWN_COLUMNS = {
  contacts: new Set([
    // identity
    'id', 'contact_number', 'created_at', 'updated_at',
    // basic info
    'prefix', 'full_name', 'phone', 'phone2', 'extra_phones', 'email',
    'company', 'job_title', 'department', 'gender', 'nationality',
    'birth_date',
    // categorization
    'source', 'contact_type', 'contact_status', 'platform',
    'campaign_name', 'campaign_id', 'campaign_interactions',
    // sales
    'temperature', 'lead_score', 'budget_min', 'budget_max',
    'preferred_location', 'interested_in_type',
    // assignment (per-agent)
    'assigned_to_name', 'assigned_to_names', 'assigned_by_name',
    'assigned_at', 'agent_statuses', 'agent_temperatures', 'agent_scores',
    'created_by', 'created_by_name',
    // lifecycle
    'is_blacklisted', 'is_deleted', 'deleted_at', 'last_activity_at',
    'first_response_at', 'notes',
    // disqualification
    'disqualified_reason', 'disqualified_note', 'disqualified_at',
    // misc
    'fingerprint_id', 'metadata',
    // legacy stub columns kept to absorb writes from old bundles —
    // we accept them so writes don't fail, but they're not used.
    'my_status', 'my_temperature', 'my_score', 'assigned_to',
  ]),
};

export function stripInternalFields(data, opts = {}) {
  if (!data || typeof data !== 'object') return data;
  const clean = {};
  const unknown = [];
  const known = opts.table ? KNOWN_COLUMNS[opts.table] : null;
  for (const [k, v] of Object.entries(data)) {
    if (INTERNAL_FIELDS.has(k)) continue;
    if (k.startsWith('_')) continue;
    const mappedKey = FIELD_MAP[k] || k;
    if (known && !known.has(mappedKey)) {
      unknown.push(mappedKey);
      // Don't include in payload — better to drop a typo than to send it
      // and have PostgREST reject the whole write with "column not found".
      // This was the silent-failure mode that lost ~200 status writes.
      continue;
    }
    clean[mappedKey] = v;
  }
  if (unknown.length && typeof console !== 'undefined' && console.warn) {
    // Visible in dev so a missing column is noticed early. In prod the
    // warning still fires but is silent unless devtools are open.
    console.warn(
      `[sanitizeForSupabase] dropped ${unknown.length} unknown field(s) for ${opts.table}:`,
      unknown.join(', '),
      '— add them to KNOWN_COLUMNS in src/utils/sanitizeForSupabase.js if they are real columns.'
    );
  }
  return clean;
}
