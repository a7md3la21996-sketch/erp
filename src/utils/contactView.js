// Per-agent view helpers for contacts.
//
// After Phase 1 (single-assignment migration), every contact has at most one
// assignee. The per-agent JSON maps (agent_statuses, agent_temperatures,
// agent_scores) carry the same value as the global contact_status/
// temperature/lead_score for that single assignee. These helpers prefer
// the jsonb (for backward compat) but fall back to the global field —
// once Phase 2 drops the jsonb columns, the fallback becomes the source.

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
 * Per-agent status for the given user. Prefers jsonb agent_statuses for
 * backward compat; falls back to global contact_status when userName is the
 * current sole assignee (forward-compat for when jsonb writes stop).
 */
export function getMyStatus(contact, userName) {
  if (!contact || !userName) return null;
  const v = contact.agent_statuses?.[userName];
  if (v !== undefined && v !== null && v !== '') return v;
  // Fallback: if userName is the current assignee, the global field is theirs
  if (contact.assigned_to_name === userName && contact.contact_status) return contact.contact_status;
  return null;
}

/** Same pattern for temperature. */
export function getMyTemp(contact, userName) {
  if (!contact || !userName) return null;
  const v = contact.agent_temperatures?.[userName];
  if (v !== undefined && v !== null && v !== '') return v;
  if (contact.assigned_to_name === userName && contact.temperature) return contact.temperature;
  return null;
}

/** Same pattern for lead score. Returns 0 (not null) for arithmetic-friendliness. */
export function getMyScore(contact, userName) {
  if (!contact || !userName) return 0;
  const v = contact.agent_scores?.[userName];
  if (typeof v === 'number') return v;
  if (v != null && v !== '') return Number(v) || 0;
  if (contact.assigned_to_name === userName && typeof contact.lead_score === 'number') return contact.lead_score;
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
  // Forward-compat: when name === current assignee, fall back to global fields
  const isAssignee = (name) => contact.assigned_to_name === name;
  const pickStatus = (name) => statuses[name] ?? (isAssignee(name) ? (contact.contact_status ?? null) : null);
  const pickTemp = (name) => temps[name] ?? (isAssignee(name) ? (contact.temperature ?? null) : null);
  const pickScore = (name) => {
    const s = scores[name];
    if (typeof s === 'number') return s;
    if (s != null) return Number(s) || 0;
    if (isAssignee(name) && typeof contact.lead_score === 'number') return contact.lead_score;
    return null;
  };

  const rows = names.map(name => ({
    name,
    status: pickStatus(name),
    temperature: pickTemp(name),
    score: pickScore(name),
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
