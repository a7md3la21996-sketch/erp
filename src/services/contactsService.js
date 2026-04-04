import supabase from '../lib/supabase';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import { logCreate, logUpdate } from './auditService';

import { reportError } from '../utils/errorReporter';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';

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
 * Update per-agent status on a contact.
 * Sets both agent_statuses[agentName] and contact_status (for backward compat).
 */
export async function updateAgentStatus(contactId, agentName, newStatus) {
  try {
    // Fetch current agent_statuses
    const { data: current } = await supabase.from('contacts').select('agent_statuses').eq('id', contactId).maybeSingle();
    const statuses = { ...(current?.agent_statuses || {}), [agentName]: newStatus };
    await supabase.from('contacts').update({ agent_statuses: statuses, contact_status: newStatus }).eq('id', contactId);
    return statuses;
  } catch (err) {
    reportError('contactsService', 'updateAgentStatus', err);
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
  return entry;
}

export async function fetchContacts({ role, userId, teamId, filters = {}, page, pageSize }) {
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';
  try {
    let query = supabase
      .from('contacts')
      .select('*', isServerPaginated ? { count: 'exact' } : {})
      .order('last_activity_at', { ascending: false });

    if (role === 'sales_agent' && userId) {
      // Agent sees contacts where their name is in assigned_to_names
      const names = await getTeamMemberNames('sales_agent', null);
      // For agent, we need their own name — get from cache or fetch once
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
      }
    }

    if (filters.search) {
      const s = filters.search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, '');
      if (s.length > 0) {
        query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,campaign_name.ilike.%${s}%,notes.ilike.%${s}%,company.ilike.%${s}%`);
      }
    }
    if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.temperature) query = query.eq('temperature', filters.temperature);
    if (filters.showBlacklisted === false) query = query.eq('is_blacklisted', false);
    if (filters.showBlacklisted === true) query = query.eq('is_blacklisted', true);
    if (filters.department) query = query.eq('department', filters.department);
    if (filters.contact_status) {
      if (filters.agentNameForStatus) {
        query = query.filter('agent_statuses->>' + filters.agentNameForStatus, 'eq', filters.contact_status);
      } else {
        query = query.eq('contact_status', filters.contact_status);
      }
    }
    if (filters.assigned_to_name) query = query.filter('assigned_to_names', 'cs', JSON.stringify([filters.assigned_to_name]));

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      (data || []).forEach(c => {
        if (!Array.isArray(c.campaign_interactions)) c.campaign_interactions = [];
        if (!Array.isArray(c.extra_phones)) c.extra_phones = [];
      });
      return { data: data || [], count: count || 0 };
    }

    // Fetch all matching contacts in pages of 1000
    let allData = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: batch, error: batchErr } = await query.range(offset, offset + PAGE - 1);
      if (batchErr) throw batchErr;
      if (!batch || batch.length === 0) break;
      allData = allData.concat(batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
      // Rebuild query for next page (Supabase mutates query object)
      // NOTE: Role filters (sales_agent assigned_to_names, TL/manager or conditions) are applied only on the initial query above.
      // This non-paginated path is deprecated — ContactsPage always uses server pagination.
      query = supabase.from('contacts').select('*').order('last_activity_at', { ascending: false });
      if (filters.search) { const s = filters.search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, ''); if (s.length > 0) query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,campaign_name.ilike.%${s}%,notes.ilike.%${s}%,company.ilike.%${s}%`); }
      if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
      if (filters.source) query = query.eq('source', filters.source);
      if (filters.temperature) query = query.eq('temperature', filters.temperature);
      if (filters.showBlacklisted === false) query = query.eq('is_blacklisted', false);
      if (filters.showBlacklisted === true) query = query.eq('is_blacklisted', true);
      if (filters.department) query = query.eq('department', filters.department);
      if (filters.contact_status) query = query.eq('contact_status', filters.contact_status);
      if (filters.assigned_to_name) query = query.filter('assigned_to_names', 'cs', JSON.stringify([filters.assigned_to_name]));
    }
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

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert([stripInternalFields({ ...sanitized, last_activity_at: new Date().toISOString() })])
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
  // Remove computed/internal fields that don't exist in Supabase
  const { _campaign_count, _country, _opp_count, _aging_level, _offline, opportunities, ...cleanUpdates } = updates;
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
    const { data: oldData } = await supabase.from('contacts').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('contacts')
      .update(stripInternalFields({ ...cleanUpdates, updated_at: new Date().toISOString() }))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    logUpdate('contact', id, oldData, data);
    return data;
  } catch (err) {
    throw err;
  }
}

export async function deleteContact(id) {
  try {
    // Clean up related opportunities first (prevent orphans)
    try {
      await supabase.from('opportunities').delete().eq('contact_id', id);
    } catch (err) { reportError('contactsService', 'deleteContact.cleanupOpps', err); }
    // Clean up related activities
    try {
      await supabase.from('activities').delete().eq('contact_id', id);
    } catch (err) { reportError('contactsService', 'deleteContact.cleanupActivities', err); }
    // Clean up related reminders
    try {
      await supabase.from('reminders').delete().eq('entity_id', id);
    } catch (err) { reportError('contactsService', 'deleteContact.cleanupReminders', err); }

    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    throw err;
  }
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
    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, phone, phone2, extra_phones, contact_type')
      .or(`phone.eq.${normalized.replace(/[^+\d]/g, '')},phone.ilike.%${last9.replace(/\D/g, '')},phone2.eq.${normalized.replace(/[^+\d]/g, '')},phone2.ilike.%${last9.replace(/\D/g, '')},extra_phones.ilike.%${last9.replace(/\D/g, '')}`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch (err) {
    reportError('contactsService', 'checkDuplicate', err);
  }

  return null;
}

export async function fetchContactActivities(contactId, { role, userId, teamId } = {}) {
  try {
    let query = supabase
      .from('activities')
      .select(`*, users!activities_user_id_fkey (full_name_ar, full_name_en)`)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);
    // Role-based filtering
    if (role === 'sales_agent' && userId) {
      query = query.eq('user_id', userId);
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const ids = await getTeamMemberIds(role, teamId);
      if (ids.length) query = query.in('user_id', ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchContactActivities', err);
    return [];
  }
}

export async function createActivity(activityData) {
  // Try Supabase FIRST — source of truth
  try {
    const { data, error } = await supabase
      .from('activities')
      .insert([stripInternalFields(activityData)])
      .select('*')
      .single();
    if (error) throw error;
    // Update contact last_activity_at
    if (activityData.contact_id) {
      await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', activityData.contact_id);
    }
    return data;
  } catch (err) {
    reportError('contactsService', 'createActivity', err);
    throw err;
  }
}

export async function updateActivity(id, updates) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .update(stripInternalFields(updates))
      .eq('id', id)
      .select('*')
      .single();
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
      .select(`
        *,
        users!opportunities_assigned_to_fkey (full_name_ar, full_name_en),
        projects (name_ar, name_en)
      `)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    // Role-based filtering
    if (role === 'sales_agent' && userId) {
      query = query.eq('assigned_to', userId);
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const ids = await getTeamMemberIds(role, teamId);
      if (ids.length) query = query.in('assigned_to', ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchContactOpportunities', err);
    return [];
  }
}
