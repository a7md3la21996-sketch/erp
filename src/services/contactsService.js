import supabase from '../lib/supabase';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import { logCreate, logUpdate, logAudit } from './auditService';
import { requireAnyPerm, requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

import { reportError } from '../utils/errorReporter';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';
import { applyRoleFilter } from '../utils/roleFilter';
import { retryWithBackoff } from '../utils/retryWithBackoff';

// Retry helper: wraps a Supabase builder thunk in exponential-backoff retry
// (3 attempts). Use for idempotent ops only — UPDATE/DELETE/SELECT — never for
// INSERT because a successful insert with a dropped response would create
// duplicates on retry.
const rq = (fn, label) => retryWithBackoff(fn, { label });

// ── Assignment History ─────────────────────────────────────────────────────

/** @deprecated Assignment history now comes from activities (type='reassignment') via fetchContactActivities */
export function getAssignmentHistory() {
  return [];
}

/**
 * Get the per-agent status for a contact.
 * Falls back to contact_status if agent_statuses is empty.
 */
export function getAgentStatus(contact, agentName) {
  if (!agentName) return contact?.contact_status || null;
  const statuses = contact?.agent_statuses || {};
  return statuses[agentName] || contact?.contact_status || null;
}

/**
 * Get the per-agent temperature for a contact.
 * Falls back to contact.temperature if agent_temperatures is empty.
 */
export function getAgentTemperature(contact, agentName) {
  if (!agentName) return contact?.temperature || null;
  const temps = contact?.agent_temperatures || {};
  return temps[agentName] || contact?.temperature || null;
}

/**
 * Get the per-agent lead score for a contact.
 * Falls back to contact.lead_score if agent_scores is empty.
 */
export function getAgentScore(contact, agentName) {
  if (!agentName) return contact?.lead_score || 0;
  const scores = contact?.agent_scores || {};
  return scores[agentName] ?? contact?.lead_score ?? 0;
}

/**
 * Derive global contact_status from agent_statuses.
 * Priority: has_opportunity > active > inactive > new > disqualified
 */
export function deriveGlobalStatus(agentStatuses) {
  const vals = Object.values(agentStatuses || {});
  if (!vals.length) return 'new';
  const priority = ['has_opportunity', 'following', 'contacted', 'new', 'disqualified'];
  for (const s of priority) { if (vals.includes(s)) return s; }
  return vals[0] || 'new';
}

/**
 * Derive global temperature from agent_temperatures.
 * Priority: hot > warm > cool > cold
 */
export function deriveGlobalTemp(agentTemps) {
  const vals = Object.values(agentTemps || {});
  if (!vals.length) return null;
  const priority = ['hot', 'warm', 'cool', 'cold'];
  for (const t of priority) { if (vals.includes(t)) return t; }
  return vals[0] || null;
}

/**
 * Update per-agent status on a contact.
 * Also syncs global contact_status for filters/counts.
 */
export async function updateAgentStatus(contactId, agentName, newStatus) {
  try {
    const { data: current } = await rq(() => supabase.from('contacts').select('agent_statuses').eq('id', contactId).maybeSingle(), 'updateAgentStatus.read');
    const statuses = { ...(current?.agent_statuses || {}), [agentName]: newStatus };
    const globalStatus = deriveGlobalStatus(statuses);
    await rq(() => supabase.from('contacts').update({ agent_statuses: statuses, contact_status: globalStatus }).eq('id', contactId), 'updateAgentStatus.write');
    return statuses;
  } catch (err) {
    reportError('contactsService', 'updateAgentStatus', err);
    throw err;
  }
}

/**
 * Update per-agent temperature on a contact.
 * Also syncs global temperature for filters/counts.
 */
export async function updateAgentTemperature(contactId, agentName, newTemp) {
  try {
    const { data: current } = await rq(() => supabase.from('contacts').select('agent_temperatures').eq('id', contactId).maybeSingle(), 'updateAgentTemperature.read');
    const temps = { ...(current?.agent_temperatures || {}), [agentName]: newTemp };
    const globalTemp = deriveGlobalTemp(temps);
    await rq(() => supabase.from('contacts').update({ agent_temperatures: temps, temperature: globalTemp }).eq('id', contactId), 'updateAgentTemperature.write');
    return temps;
  } catch (err) {
    reportError('contactsService', 'updateAgentTemperature', err);
    throw err;
  }
}

/**
 * Increment per-agent lead score on a contact.
 */
export async function incrementAgentScore(contactId, agentName, increment) {
  try {
    const { data: current } = await rq(() => supabase.from('contacts').select('agent_scores, lead_score').eq('id', contactId).maybeSingle(), 'incrementAgentScore.read');
    const scores = { ...(current?.agent_scores || {}) };
    scores[agentName] = Math.min((scores[agentName] || 0) + increment, 100);
    // Also update global lead_score as max of all agent scores
    const globalScore = Math.max(...Object.values(scores), current?.lead_score || 0);
    await rq(() => supabase.from('contacts').update({ agent_scores: scores, lead_score: globalScore }).eq('id', contactId), 'incrementAgentScore.write');
    return scores;
  } catch (err) {
    reportError('contactsService', 'incrementAgentScore', err);
    throw err;
  }
}

export async function recordAssignment(contactId, { fromAgent, toAgent, assignedBy, notes = '' }) {
  const entry = {
    from: fromAgent || null,
    to: toAgent,
    by: assignedBy,
    notes,
    at: new Date().toISOString(),
  };
  // Persist to Supabase (fire-and-forget)
  supabase.from('activities').insert([{
    type: 'reassignment',
    entity_type: 'contact',
    contact_id: contactId,
    notes: `${fromAgent || '—'} → ${toAgent}${notes ? ': ' + notes : ''}`,
    user_id: null,
    user_name_en: assignedBy || null,
    status: 'completed',
    created_at: entry.at,
  }]).then(() => {}).catch((err) => { reportError('contactsService', 'recordAssignment', err); });
  // Update assigned_at timestamp. Best-effort, but at least surface failures
  // for monitoring instead of swallowing them silently.
  supabase.from('contacts').update({ assigned_at: entry.at }).eq('id', contactId)
    .then(({ error }) => { if (error) reportError('contactsService', 'recordAssignment.updateAssignedAt', error); })
    .catch(err => reportError('contactsService', 'recordAssignment.updateAssignedAt', err));
  return entry;
}

export async function fetchContacts({ role, userId, teamId, filters = {}, page, pageSize, sortBy }) {
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';
  try {
    // Map sortBy to Supabase column + direction
    const SORT_MAP = {
      created:       { column: 'created_at',       ascending: false },
      assigned:      { column: 'assigned_at',      ascending: false },
      last_activity: { column: 'last_activity_at', ascending: false },
      score:         { column: 'lead_score',        ascending: false },
      name:          { column: 'full_name',         ascending: true },
      stale:         { column: 'last_activity_at',  ascending: true },
    };
    const sort = SORT_MAP[sortBy] || SORT_MAP.created;
    let query = supabase
      .from('contacts')
      .select('*', isServerPaginated ? { count: 'exact' } : {})
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order(sort.column, { ascending: sort.ascending });

    // Role-based filtering
    if (role === 'sales_agent' && userId) {
      const { data: agentUser } = await supabase.from('users').select('full_name_en, full_name_ar').eq('id', userId).maybeSingle();
      if (agentUser) {
        const name = agentUser.full_name_en || agentUser.full_name_ar;
        if (name) query = query.filter('assigned_to_names', 'cs', JSON.stringify([name]));
      }
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const names = await getTeamMemberNames(role, teamId);
      if (names.length) {
        const orConditions = names.map(n => `assigned_to_names.cs.["${n}"]`).join(',');
        query = query.or(orConditions);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    if (filters.search) {
      const s = filters.search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, '');
      if (s.length > 0) {
        // For phone search: also search without leading 0 and with +20
        const isPhone = /^\d+$/.test(s) || s.startsWith('+');
        if (isPhone) {
          const digits = s.replace(/\D/g, '');
          const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
          query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${last9}%,phone2.ilike.%${last9}%,email.ilike.%${s}%`);
        } else {
          query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,campaign_name.ilike.%${s}%,notes.ilike.%${s}%,company.ilike.%${s}%`);
        }
      }
    }
    if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
    if (filters.source) {
      if (filters.source_not) query = query.neq('source', filters.source);
      else query = query.eq('source', filters.source);
    }
    if (filters.temperature) {
      if (filters.agentNameForTemp) {
        query = query.filter('agent_temperatures->>' + filters.agentNameForTemp, 'eq', filters.temperature);
      } else if (filters.teamMemberNames?.length) {
        const conds = filters.teamMemberNames.map(n => `agent_temperatures->>${n}.eq.${filters.temperature}`);
        conds.push(`temperature.eq.${filters.temperature}`);
        query = query.or(conds.join(','));
      } else {
        query = query.eq('temperature', filters.temperature);
      }
    }
    if (filters.showBlacklisted === false) query = query.eq('is_blacklisted', false);
    if (filters.showBlacklisted === true) query = query.eq('is_blacklisted', true);
    if (filters.department) query = query.eq('department', filters.department);
    if (filters.unassigned) query = query.or('assigned_to_name.is.null,assigned_to_name.eq.,assigned_to_names.eq.[]');
    if (filters.contactIds?.length) query = query.in('id', filters.contactIds.slice(0, 300));
    if (filters.excludeContactIds?.length && filters.excludeContactIds[0] !== 'none') {
      const excludeBatch = filters.excludeContactIds.slice(0, 500);
      query = query.not('id', 'in', `(${excludeBatch.join(',')})`);
    }
    if (filters.contact_status) {
      const statusOp = filters.contact_status_not ? 'neq' : 'eq';
      if (filters.agentNameForStatus) {
        query = query.filter('agent_statuses->>' + filters.agentNameForStatus, statusOp, filters.contact_status);
      } else if (filters.teamMemberNames?.length) {
        // Manager/Admin with team: any team member has this status
        const conds = filters.teamMemberNames.map(n => `agent_statuses->>${n}.eq.${filters.contact_status}`);
        conds.push(`contact_status.eq.${filters.contact_status}`);
        query = query.or(conds.join(','));
      } else {
        query = query.eq('contact_status', filters.contact_status);
      }
    }
    if (filters.assigned_to_name) {
      if (filters.assigned_to_name_not) {
        // is_not: exclude contacts assigned to this agent
        query = query.not('assigned_to_names', 'cs', JSON.stringify([filters.assigned_to_name]));
      } else {
        query = query.filter('assigned_to_names', 'cs', JSON.stringify([filters.assigned_to_name]));
      }
    }
    // Activity indicator filter (based on last_activity_at)
    if (filters.activityFilter) {
      const now = Date.now();
      const activeDays = (filters.activityActiveDays || 3) * 86400000;
      const moderateDays = (filters.activityModerateDays || 7) * 86400000;
      if (filters.activityFilter === 'active_3d') {
        query = query.gte('last_activity_at', new Date(now - activeDays).toISOString());
      } else if (filters.activityFilter === 'moderate_7d') {
        query = query.gte('last_activity_at', new Date(now - moderateDays).toISOString()).lt('last_activity_at', new Date(now - activeDays).toISOString());
      } else if (filters.activityFilter === 'stale') {
        query = query.lt('last_activity_at', new Date(now - moderateDays).toISOString());
      } else if (filters.activityFilter === 'never') {
        query = query.is('last_activity_at', null);
      }
    }
    // Date range filter (created_at)
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom + 'T00:00:00');
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');
    // Server-side smart filters
    if (filters.smartName) query = query.ilike('full_name', `%${filters.smartName}%`);
    if (filters.smartEmail) query = query.ilike('email', `%${filters.smartEmail}%`);
    if (filters.smartPhone) {
      const digits = filters.smartPhone.replace(/\D/g, '');
      const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
      query = query.ilike('phone', `%${last9}%`);
    }
    if (filters.smartCampaign) query = query.ilike('campaign_name', `%${filters.smartCampaign}%`);
    if (filters.smartCreatedAt) {
      const { operator, value } = filters.smartCreatedAt;
      const now = new Date();
      if (operator === 'is') query = query.gte('created_at', value + 'T00:00:00').lte('created_at', value + 'T23:59:59');
      else if (operator === 'before') query = query.lt('created_at', value + 'T00:00:00');
      else if (operator === 'after') query = query.gt('created_at', value + 'T23:59:59');
      else if (operator === 'last_7') query = query.gte('created_at', new Date(now - 7 * 86400000).toISOString());
      else if (operator === 'last_30') query = query.gte('created_at', new Date(now - 30 * 86400000).toISOString());
      else if (operator === 'this_month') query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    }

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      const { data, error, count } = await rq(() => query, 'fetchContacts.paginated');
      if (error) throw error;
      (data || []).forEach(c => {
        if (!Array.isArray(c.campaign_interactions)) c.campaign_interactions = [];
        if (!Array.isArray(c.extra_phones)) c.extra_phones = [];
      });
      return { data: data || [], count: count || 0 };
    }

    // Non-paginated: fetch first 1000 only (role filters applied on initial query)
    query = query.range(0, 999);
    const { data: allBatch, error: batchErr } = await rq(() => query, 'fetchContacts.full');
    if (batchErr) throw batchErr;
    const allData = allBatch || [];
    // Ensure array fields are never null (prevents .map() crashes)
    allData.forEach(c => {
      if (!Array.isArray(c.campaign_interactions)) c.campaign_interactions = [];
      if (!Array.isArray(c.extra_phones)) c.extra_phones = [];
    });
    return allData;
  } catch (err) {
    reportError('contactsService', 'fetchContacts', err);
    return isServerPaginated ? { data: [], count: 0 } : [];
  }
}

export async function createContact(contactData) {
  // Reject before we touch the DB if the caller doesn't have any contact-edit
  // permission. Defense in depth — the UI gate plus this guard plus DB RLS.
  requireAnyPerm([P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN], 'Not allowed to create contacts');
  // Input validation
  if (!contactData.phone || String(contactData.phone).replace(/\D/g, '').length < 8) {
    throw new Error('Invalid phone number');
  }
  if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
    throw new Error('Invalid email format');
  }
  if (!contactData.department) {
    throw new Error('Department is required');
  }
  // Sanitize string fields to prevent XSS + remove internal fields + convert empty strings to null
  const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>|javascript\s*:|on\w+\s*=|data\s*:/gi, '').trim() : v;
  const INTERNAL_FIELDS = ['_customFieldValues', '_offline', '_campaign_count', '_country', '_opp_count', '_aging_level', 'countryCode', 'country'];
  const sanitized = {};
  for (const [k, v] of Object.entries(contactData)) {
    if (INTERNAL_FIELDS.includes(k)) continue;
    const val = sanitize(v);
    // Convert empty strings to null (Supabase rejects '' for date/number columns)
    sanitized[k] = val === '' ? null : val;
  }

  // Remove non-UUID id (local temp IDs)
  if (sanitized.id && !sanitized.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    delete sanitized.id;
  }

  // Stamp assigned_at on initial creation if the contact is already assigned to someone.
  // This keeps "Sort: Assignment Date" meaningful for brand-new contacts too.
  if (!sanitized.assigned_at) {
    const hasAssignee = sanitized.assigned_to_name || (Array.isArray(sanitized.assigned_to_names) && sanitized.assigned_to_names.length > 0);
    if (hasAssignee) sanitized.assigned_at = new Date().toISOString();
  }

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert([stripInternalFields({ ...sanitized })])
      .select('*')
      .single();
    if (error) {
      if (import.meta.env.DEV) console.error('[createContact] Supabase error:', error.message, error.details, error.hint);
      throw error;
    }
    // Auto-generate contact_number using timestamp to avoid race condition
    if (!data.contact_number) {
      const num = 'C-' + Date.now().toString(36).toUpperCase();
      await supabase.from('contacts').update({ contact_number: num }).eq('id', data.id);
      data.contact_number = num;
    }
    logCreate('contact', data.id, data);
    return data;
  } catch (err) {
    reportError('contactsService', 'createContact', err);
    throw err;
  }
}

export async function updateContact(id, updates, lastKnownUpdatedAt) {
  // Block direct service calls without an edit permission. RLS is the
  // ultimate authority, but rejecting here gives a clean error message
  // instead of an opaque PostgREST one and avoids the round-trip.
  requireAnyPerm([P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN], 'Not allowed to update contacts');
  // Remove computed/internal fields that don't exist in Supabase
  const { _campaign_count, _country, _opp_count, _aging_level, _offline, _lastNote, _feedback, _triggerEdit, opportunities, ...cleanUpdates } = updates;
  if (import.meta.env.DEV) {
    const stripped = stripInternalFields({ ...cleanUpdates });
    console.log('[updateContact] id:', id, 'fields:', Object.keys(stripped));
  }
  try {
    // Check for conflicts before saving (optimistic locking)
    if (lastKnownUpdatedAt) {
      const { checkConflict } = await import('../utils/optimisticLock');
      const conflict = await checkConflict('contacts', id, lastKnownUpdatedAt);
      if (conflict) {
        const err = new Error(conflict.message_en);
        err.conflict = conflict;
        throw err;
      }
    }
    const { data: oldData } = await rq(() => supabase.from('contacts').select('*').eq('id', id).single(), 'updateContact.read');
    // Convert empty strings to null (Supabase rejects '' for date/number columns)
    const sanitized = {};
    for (const [k, v] of Object.entries(cleanUpdates)) {
      sanitized[k] = v === '' ? null : v;
    }
    // Auto-sync assigned_to_name ↔ assigned_to_names
    if (sanitized.assigned_to_name && !sanitized.assigned_to_names) {
      const existing = oldData?.assigned_to_names || [];
      if (!existing.includes(sanitized.assigned_to_name)) {
        sanitized.assigned_to_names = [sanitized.assigned_to_name];
      }
    }
    if (sanitized.assigned_to_names && !sanitized.assigned_to_name) {
      const names = Array.isArray(sanitized.assigned_to_names) ? sanitized.assigned_to_names.filter(Boolean) : [];
      if (names.length > 0) sanitized.assigned_to_name = names[0];
    }

    // Refresh assigned_at whenever the assignment actually changes (add/remove/reassign).
    // Skip if the caller already set it (e.g. recordAssignment) and skip if the value
    // is semantically unchanged to avoid noisy timestamp churn.
    const assignmentTouched = 'assigned_to_name' in sanitized || 'assigned_to_names' in sanitized;
    if (assignmentTouched && !('assigned_at' in sanitized)) {
      const oldName = oldData?.assigned_to_name || null;
      const newName = sanitized.assigned_to_name ?? oldName;
      const oldNames = JSON.stringify((oldData?.assigned_to_names || []).slice().sort());
      const newNames = JSON.stringify(((sanitized.assigned_to_names ?? oldData?.assigned_to_names) || []).slice().sort());
      if (oldName !== newName || oldNames !== newNames) {
        sanitized.assigned_at = new Date().toISOString();
      }
    }
    const { data, error } = await rq(() => supabase
      .from('contacts')
      .update(stripInternalFields({ ...sanitized, updated_at: new Date().toISOString() }))
      .eq('id', id)
      .select('*')
      .single(), 'updateContact.write');
    if (error) throw error;
    logUpdate('contact', id, oldData, data);
    return data;
  } catch (err) {
    throw err;
  }
}

export async function deleteContact(id) {
  // Sales agents have no DELETE permission — even though they have
  // CONTACTS_EDIT_OWN, deletion is reserved for managers/admins/ops.
  requirePerm(P.CONTACTS_DELETE, 'Not allowed to delete contacts');
  try {
    // Soft delete: mark as deleted instead of removing from DB
    // This preserves all data and related records (opportunities, activities, etc.)
    const { data: oldData } = await rq(() => supabase.from('contacts').select('*').eq('id', id).single(), 'deleteContact.read');
    const { error } = await rq(() => supabase.from('contacts').update({
      deleted_at: new Date().toISOString(),
      is_deleted: true,
    }).eq('id', id), 'deleteContact.write');
    if (error) throw error;
    // Log with full data for recovery
    logAudit({ action: 'delete', entity: 'contact', entityId: id, entityName: oldData?.full_name || '', oldData, description: `Soft deleted contact: ${oldData?.full_name || id}` });
  } catch (err) {
    throw err;
  }
}

export async function restoreContact(id) {
  requirePerm(P.CONTACTS_DELETE, 'Not allowed to restore contacts');
  try {
    const { error } = await rq(() => supabase.from('contacts').update({
      deleted_at: null,
      is_deleted: false,
    }).eq('id', id), 'restoreContact');
    if (error) throw error;
  } catch (err) {
    throw err;
  }
}

export async function permanentDeleteContact(id) {
  requirePerm(P.CONTACTS_DELETE, 'Not allowed to permanently delete contacts');
  // Atomic delete via RPC — all related rows + contact succeed or rollback together.
  // See supabase/migrations/permanent_delete_contact_rpc.sql
  const { error } = await rq(() => supabase.rpc('permanent_delete_contact', { p_contact_id: id }), 'permanentDeleteContact');
  if (error) throw error;
}

export async function blacklistContact(id, reason) {
  return updateContact(id, { is_blacklisted: true, blacklist_reason: reason });
}

/**
 * Strip all non-digit characters and compare last 9 digits.
 * 9 digits covers the local number without country code for most regions.
 */
function fuzzyPhoneMatch(stored, input) {
  if (!stored || !input) return false;
  const a = stored.replace(/\D/g, '');
  const b = input.replace(/\D/g, '');
  if (a.length < 9 || b.length < 9) return a === b;
  return a.slice(-9) === b.slice(-9);
}

/** Normalize phone: convert leading 00 to +, and Egyptian 01x to +201x */
function normalizePhoneLocal(p) {
  if (!p) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0') && p.length === 11 && p.startsWith('01')) return '+20' + p.slice(1);
  return p;
}

export async function checkDuplicate(phone) {
  const normalized = normalizePhoneLocal(phone);
  const digits = normalized ? normalized.replace(/\D/g, '') : '';
  const last9 = digits.length >= 9 ? digits.slice(-9) : digits;

  try {
    const { data } = await rq(() => supabase
      .from('contacts')
      .select('id, full_name, phone, phone2, extra_phones, contact_type')
      .or(`phone.eq.${normalized.replace(/[^+\d]/g, '')},phone.ilike.%${last9.replace(/\D/g, '')},phone2.eq.${normalized.replace(/[^+\d]/g, '')},phone2.ilike.%${last9.replace(/\D/g, '')},extra_phones.ilike.%${last9.replace(/\D/g, '')}`)
      .limit(1)
      .maybeSingle(), 'checkDuplicate');
    if (data) return data;
  } catch (err) {
    reportError('contactsService', 'checkDuplicate', err);
  }

  return null;
}

export async function fetchContactActivities(contactId, { role, userId, teamId } = {}) {
  try {
    // When viewing a specific contact's activities, show ALL activities on that contact
    // The contact itself is already role-filtered (agent can only open contacts assigned to them)
    // So if they can see the contact, they should see all its history (including from previous agents)
    const { data, error } = await rq(() => supabase
      .from('activities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50), 'fetchContactActivities');
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchContactActivities', err);
    return [];
  }
}

export async function createActivity(activityData) {
  // Clean: convert empty strings to null (Supabase rejects '' for date/number columns)
  const cleaned = {};
  for (const [k, v] of Object.entries(activityData)) {
    cleaned[k] = v === '' ? null : v;
  }
  // Try Supabase FIRST — source of truth
  try {
    const { data, error } = await supabase
      .from('activities')
      .insert([stripInternalFields(cleaned)])
      .select('*')
      .single();
    if (error) throw error;
    // Update contact last_activity_at
    if (activityData.contact_id) {
      await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', activityData.contact_id);
      // Auto-complete matching pending tasks for this contact + agent + type
      const actType = activityData.type;
      const agentId = activityData.user_id;
      if (actType && agentId) {
        const matchTypes = actType === 'call' ? ['call', 'followup'] : [actType];
        try {
          await supabase.from('tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('contact_id', activityData.contact_id)
            .eq('assigned_to', agentId)
            .eq('status', 'pending')
            .in('type', matchTypes)
            .lte('due_date', new Date().toISOString());
        } catch {}
      }
    }
    return data;
  } catch (err) {
    reportError('contactsService', 'createActivity', err);
    throw err;
  }
}

export async function updateActivity(id, updates) {
  try {
    const { data, error } = await rq(() => supabase
      .from('activities')
      .update(stripInternalFields(updates))
      .eq('id', id)
      .select('*')
      .single(), 'updateActivity');
    if (error) throw error;
    return data;
  } catch (err) {
    reportError('contactsService', 'updateActivity', err);
    throw err;
  }
}

export async function fetchContactOpportunities(contactId, { role, userId, teamId } = {}) {
  try {
    let query = supabase
      .from('opportunities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    // Role-based filtering — filter by name (not UUID) since imported opps may lack assigned_to UUID
    if (role === 'sales_agent' && userId) {
      const { data: agentUser } = await supabase.from('users').select('full_name_en').eq('id', userId).maybeSingle();
      if (agentUser?.full_name_en) {
        query = query.eq('assigned_to_name', agentUser.full_name_en);
      } else {
        query = query.eq('assigned_to', userId);
      }
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const names = await getTeamMemberNames(role, teamId);
      if (names.length) query = query.in('assigned_to_name', names);
    }
    const { data, error } = await rq(() => query, 'fetchContactOpportunities');
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchContactOpportunities', err);
    return [];
  }
}
