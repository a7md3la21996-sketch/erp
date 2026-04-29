// Per-agent view helpers for contacts.
//
// The legacy global fields (contact_status, temperature, lead_score) are no
// longer used for display anywhere in the app. Every status/temperature/score
// the user sees comes from the per-agent JSON maps (agent_statuses,
// agent_temperatures, agent_scores) tied to assigned_to_names. Multi-agent
// contacts show one chip per agent so each one's reality is visible — no
// synthetic "peak" or aggregate.

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
 * Per-agent status for the given user. Returns null if the user isn't
 * assigned or doesn't have an entry — callers shouldn't substitute the
 * legacy global field on the user's behalf.
 */
export function getMyStatus(contact, userName) {
  if (!contact || !userName) return null;
  const v = contact.agent_statuses?.[userName];
  return v !== undefined && v !== null && v !== '' ? v : null;
}

/** Same pattern for temperature. */
export function getMyTemp(contact, userName) {
  if (!contact || !userName) return null;
  const v = contact.agent_temperatures?.[userName];
  return v !== undefined && v !== null && v !== '' ? v : null;
}

/** Same pattern for lead score. Returns 0 (not null) for arithmetic-friendliness. */
export function getMyScore(contact, userName) {
  if (!contact || !userName) return 0;
  const v = contact.agent_scores?.[userName];
  if (typeof v === 'number') return v;
  if (v != null && v !== '') return Number(v) || 0;
  return 0;
}

/**
 * Flat per-agent breakdown for tables/drawers/chips. Returns one row per
 * currently-assigned agent with their own status / temperature / score —
 * the source of truth for every per-agent display in the app. When
 * `viewerName` is given and they're one of the assignees, they're placed
 * first so the viewer's own state reads at a glance.
 *
 * Returns [] for contacts with no assignees.
 */
export function getAgentsView(contact, viewerName) {
  if (!contact) return [];
  const names = getValidAgentNames(contact);
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
 * Attach computed virtual fields so SmartFilter and sorts can address
 * per-agent state as ordinary field ids. `my_*` is the viewer's own entry
 * (or null if the viewer isn't assigned). Does not mutate inputs.
 */
export function withAgentView(contacts, profile) {
  const name = profileName(profile);
  return (contacts || []).map(c => ({
    ...c,
    my_status: getMyStatus(c, name),
    my_temperature: getMyTemp(c, name),
    my_score: getMyScore(c, name),
    _agent_count: getAgentCount(c),
    // _is_status_mixed / _is_temp_mixed removed in Phase 3 — always false now
    // that each contact has a single assignee. The isMixed helper was deleted.
  }));
}
