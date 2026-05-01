// Per-agent view helpers for contacts.
//
// After Phase 1 (single-assignment) every contact has at most one assignee.
// Phase 2 dropped the per-agent jsonb maps entirely — contact_status /
// temperature / lead_score are now the only source. These helpers stay so
// callers can keep asking "what's my status on this contact?" without each
// site having to repeat the assignee check.

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

/** The viewer's status on this contact — null when they're not the assignee. */
export function getMyStatus(contact, userName) {
  if (!contact || !userName) return null;
  if (contact.assigned_to_name === userName && contact.contact_status) return contact.contact_status;
  return null;
}

/** The viewer's temperature on this contact — null when they're not the assignee. */
export function getMyTemp(contact, userName) {
  if (!contact || !userName) return null;
  if (contact.assigned_to_name === userName && contact.temperature) return contact.temperature;
  return null;
}

/** The viewer's lead score on this contact — 0 when they're not the assignee. */
export function getMyScore(contact, userName) {
  if (!contact || !userName) return 0;
  if (contact.assigned_to_name === userName && typeof contact.lead_score === 'number') return contact.lead_score;
  return 0;
}

/**
 * Flat per-agent breakdown for tables/drawers/chips. Single-assignment now,
 * so this returns at most one row — the sole assignee's status / temperature
 * / score. Kept as an array shape so existing call sites that iterate keep
 * working without churn. Returns [] for contacts with no assignees.
 */
export function getAgentsView(contact, viewerName) {
  if (!contact) return [];
  const names = getValidAgentNames(contact);
  if (names.length === 0) return [];

  return names.map(name => {
    const isAssignee = contact.assigned_to_name === name;
    return {
      name,
      status: isAssignee ? (contact.contact_status ?? null) : null,
      temperature: isAssignee ? (contact.temperature ?? null) : null,
      score: isAssignee && typeof contact.lead_score === 'number' ? contact.lead_score : null,
      isViewer: !!viewerName && name === viewerName,
    };
  });
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
  }));
}
