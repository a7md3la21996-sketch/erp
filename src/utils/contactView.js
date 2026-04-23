// Per-agent view helpers for contacts.
//
// Contacts have two overlapping data models:
//   - Global fields (contact_status, temperature, lead_score) — represent a
//     single "aggregate" view.
//   - Per-agent JSON fields (agent_statuses, agent_temperatures, agent_scores)
//     — represent each assigned agent's independent state on the same contact.
//
// The UI used to read global fields directly, which produced confusing behavior
// when the same contact was assigned to multiple agents (one agent's change
// appeared to everyone). These helpers centralize how we read "my view" so
// filters, chips, and column displays are always consistent for the current
// user, and fall back to the global fields for legacy data.

/** The user's full name as stored on contacts (full_name_en preferred). */
export function profileName(profile) {
  if (!profile) return '';
  return profile.full_name_en || profile.full_name_ar || '';
}

/** Whether the current user is one of the assignees on this contact. */
export function isAssignedToMe(contact, userName) {
  if (!userName) return false;
  const names = contact?.assigned_to_names;
  if (Array.isArray(names)) return names.includes(userName);
  return contact?.assigned_to_name === userName;
}

/**
 * Per-agent status for the given user on the given contact.
 * - Returns the user's own entry in agent_statuses if set.
 * - Falls back to the legacy global contact_status for backward compat
 *   (legacy data that predates per-agent tracking).
 * - Returns null when nothing is set.
 */
export function getMyStatus(contact, userName) {
  if (!contact) return null;
  const perAgent = userName ? contact.agent_statuses?.[userName] : undefined;
  if (perAgent !== undefined && perAgent !== null && perAgent !== '') return perAgent;
  return contact.contact_status || null;
}

/** Same pattern for temperature. */
export function getMyTemp(contact, userName) {
  if (!contact) return null;
  const perAgent = userName ? contact.agent_temperatures?.[userName] : undefined;
  if (perAgent !== undefined && perAgent !== null && perAgent !== '') return perAgent;
  return contact.temperature || null;
}

/** Same pattern for lead score. */
export function getMyScore(contact, userName) {
  if (!contact) return 0;
  const perAgent = userName ? contact.agent_scores?.[userName] : undefined;
  if (typeof perAgent === 'number') return perAgent;
  return Number(contact.lead_score || 0);
}

/** How many agents are assigned to this contact. */
export function getAgentCount(contact) {
  if (!contact) return 0;
  if (Array.isArray(contact.assigned_to_names)) return contact.assigned_to_names.length;
  return contact.assigned_to_name ? 1 : 0;
}

/**
 * Whether the per-agent entries disagree with each other. Useful for showing a
 * "mixed" badge in admin/team-leader views when a multi-agent contact has
 * different readings from different agents.
 *
 * field is one of 'agent_statuses' | 'agent_temperatures' | 'agent_scores'.
 */
export function isMixed(contact, field) {
  const map = contact?.[field];
  if (!map || typeof map !== 'object') return false;
  const values = Object.values(map).filter(v => v !== undefined && v !== null && v !== '');
  if (values.length <= 1) return false;
  return new Set(values.map(String)).size > 1;
}

/**
 * Highest "heat" across all agents — used for Admin/TL summary. Ordered
 * hottest-first. Returns the first agent's value if no temperature known.
 */
const TEMP_ORDER = ['hot', 'warm', 'cool', 'cold'];
export function getPeakTemp(contact) {
  if (!contact) return null;
  const map = contact.agent_temperatures;
  if (!map || typeof map !== 'object') return contact.temperature || null;
  const values = Object.values(map).filter(Boolean);
  if (values.length === 0) return contact.temperature || null;
  for (const t of TEMP_ORDER) if (values.includes(t)) return t;
  return values[0];
}

/**
 * Attach computed virtual fields (my_status, my_temperature, my_score,
 * _agent_count, _is_status_mixed, etc.) to each contact so SmartFilter and
 * sorts can address them as ordinary field ids. Does not mutate inputs.
 */
export function withAgentView(contacts, profile) {
  const name = profileName(profile);
  return (contacts || []).map(c => ({
    ...c,
    my_status: getMyStatus(c, name),
    my_temperature: getMyTemp(c, name),
    my_score: getMyScore(c, name),
    _agent_count: getAgentCount(c),
    _is_status_mixed: isMixed(c, 'agent_statuses'),
    _is_temp_mixed: isMixed(c, 'agent_temperatures'),
  }));
}
