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

/** Names of agents currently assigned to this contact (filtered/cleaned). */
function getValidAgentNames(contact) {
  if (!contact) return [];
  if (Array.isArray(contact.assigned_to_names)) return contact.assigned_to_names.filter(Boolean);
  return contact.assigned_to_name ? [contact.assigned_to_name] : [];
}

/** How many agents are assigned to this contact. */
export function getAgentCount(contact) {
  return getValidAgentNames(contact).length;
}

/**
 * Read only the per-agent entries for agents who are still in
 * assigned_to_names. The JSON maps in the DB sometimes carry "ghost" entries
 * for agents who were unassigned without their slot being cleaned up — those
 * shouldn't influence display, peak, or mixed indicators.
 */
function validValuesFromMap(contact, field) {
  const map = contact?.[field];
  if (!map || typeof map !== 'object') return [];
  const valid = getValidAgentNames(contact);
  if (valid.length === 0) return [];
  return valid
    .map(n => map[n])
    .filter(v => v !== undefined && v !== null && v !== '');
}

/**
 * Whether the per-agent entries (for currently-assigned agents) disagree.
 * Used for the ⚠ Mixed badge in admin/TL views.
 *
 * field is one of 'agent_statuses' | 'agent_temperatures' | 'agent_scores'.
 */
export function isMixed(contact, field) {
  const values = validValuesFromMap(contact, field);
  if (values.length <= 1) return false;
  return new Set(values.map(String)).size > 1;
}

/**
 * Highest "heat" across currently-assigned agents — Admin/TL summary.
 * Ordered hottest-first. Falls back to contact.temperature if no assignees
 * have a temperature recorded.
 */
const TEMP_ORDER = ['hot', 'warm', 'cool', 'cold'];
export function getPeakTemp(contact) {
  if (!contact) return null;
  const values = validValuesFromMap(contact, 'agent_temperatures');
  if (values.length === 0) return contact.temperature || null;
  for (const t of TEMP_ORDER) if (values.includes(t)) return t;
  return values[0];
}

// Mirrors deriveGlobalStatus in contactsService.js — the most "advanced" state
// wins. Kept in sync by convention: if you change one, change both.
const STATUS_ORDER = ['has_opportunity', 'following', 'contacted', 'new', 'disqualified'];

/**
 * Peak status across all assigned agents. Used for admin/TL display when the
 * viewer isn't one of the assignees — the stale global contact_status would
 * otherwise lie (e.g. show "new" when an agent has already moved it to
 * "has_opportunity"). Falls back to the global only if there are no per-agent
 * entries at all.
 */
export function getPeakStatus(contact) {
  if (!contact) return null;
  const values = validValuesFromMap(contact, 'agent_statuses');
  if (values.length === 0) return contact.contact_status || null;
  for (const s of STATUS_ORDER) if (values.includes(s)) return s;
  return values[0];
}

/**
 * Status to display for a given viewer on a given contact:
 *   - If the viewer is one of the assignees, show THEIR own entry
 *     (so a sales agent always sees their own state).
 *   - Otherwise (admin / team leader / operations viewing someone else's
 *     lead), show the peak status across all agents — never the stale
 *     global contact_status unless there's no per-agent data at all.
 *
 * This is the right call for the Leads table Status column: the number
 * the viewer sees should reflect what's actually happening on the lead.
 */
export function getDisplayStatus(contact, userName) {
  if (!contact) return null;
  if (userName && isAssignedToMe(contact, userName)) {
    const mine = contact.agent_statuses?.[userName];
    if (mine !== undefined && mine !== null && mine !== '') return mine;
  }
  return getPeakStatus(contact);
}

/**
 * Flat per-agent breakdown for display in tables/drawers when a contact has
 * multiple assignees. Returns one row per assigned agent with their own
 * status / temperature / score from the JSON maps. When `viewerName` is given
 * and the viewer is one of the assignees, they're placed first so their own
 * state reads at a glance.
 *
 * Returns [] for contacts with no real assignees (handles empty array, null).
 */
export function getAgentsView(contact, viewerName) {
  if (!contact) return [];
  let names = [];
  if (Array.isArray(contact.assigned_to_names) && contact.assigned_to_names.length > 0) {
    names = contact.assigned_to_names.filter(Boolean);
  } else if (contact.assigned_to_name) {
    names = [contact.assigned_to_name];
  }
  if (names.length === 0) return [];

  const statuses = contact.agent_statuses || {};
  const temps = contact.agent_temperatures || {};
  const scores = contact.agent_scores || {};

  const rows = names.map(name => ({
    name,
    status: statuses[name] ?? null,
    temperature: temps[name] ?? null,
    score: typeof scores[name] === 'number' ? scores[name] : (scores[name] != null ? Number(scores[name]) : null),
    isViewer: !!viewerName && name === viewerName,
  }));

  if (viewerName) {
    const i = rows.findIndex(r => r.name === viewerName);
    if (i > 0) {
      const [viewer] = rows.splice(i, 1);
      rows.unshift(viewer);
    }
  }
  return rows;
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
