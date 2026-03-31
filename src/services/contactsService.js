import supabase from '../lib/supabase';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import { logCreate, logUpdate } from './auditService';
import { enqueue } from '../lib/offlineQueue';
import { reportError } from '../utils/errorReporter';

// ── Assignment History ─────────────────────────────────────────────────────

/** @deprecated Assignment history now comes from activities (type='reassignment') via fetchContactActivities */
export function getAssignmentHistory() {
  return [];
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
      // Get agent's name to filter by assigned_to_name
      const { data: agentUser } = await supabase.from('users').select('full_name_en, full_name_ar').eq('id', userId).maybeSingle();
      if (agentUser) {
        const name = agentUser.full_name_en || agentUser.full_name_ar;
        if (name) query = query.eq('assigned_to_name', name);
      }
    } else if (role === 'team_leader' && teamId) {
      const { data: teamMembers } = await supabase.from('users').select('full_name_en').eq('team_id', teamId);
      const names = (teamMembers || []).map(m => m.full_name_en).filter(Boolean);
      if (names.length) query = query.in('assigned_to_name', names);
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
    if (filters.assigned_to_name) query = query.eq('assigned_to_name', filters.assigned_to_name);

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
      query = supabase.from('contacts').select('*').order('last_activity_at', { ascending: false });
      if (filters.search) { const s = filters.search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, ''); if (s.length > 0) query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,campaign_name.ilike.%${s}%,notes.ilike.%${s}%,company.ilike.%${s}%`); }
      if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
      if (filters.source) query = query.eq('source', filters.source);
      if (filters.temperature) query = query.eq('temperature', filters.temperature);
      if (filters.showBlacklisted === false) query = query.eq('is_blacklisted', false);
      if (filters.showBlacklisted === true) query = query.eq('is_blacklisted', true);
      if (filters.department) query = query.eq('department', filters.department);
      if (filters.assigned_to_name) query = query.eq('assigned_to_name', filters.assigned_to_name);
    }
    // Ensure array fields are never null (prevents .map() crashes)
    allData.forEach(c => {
      if (!Array.isArray(c.campaign_interactions)) c.campaign_interactions = [];
      if (!Array.isArray(c.extra_phones)) c.extra_phones = [];
    });
    return allData;
  } catch (err) {
    reportError('contactsService', 'query', err);
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
  // Sanitize string fields to prevent XSS + remove internal fields
  const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>|javascript\s*:|on\w+\s*=|data\s*:/gi, '').trim() : v;
  const INTERNAL_FIELDS = ['_customFieldValues', '_offline', '_campaign_count', '_country', '_opp_count', '_aging_level', 'countryCode', 'country'];
  const sanitized = {};
  for (const [k, v] of Object.entries(contactData)) {
    if (INTERNAL_FIELDS.includes(k)) continue; // skip internal fields
    sanitized[k] = sanitize(v);
  }

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert([stripInternalFields({ ...sanitized, last_activity_at: new Date().toISOString() })])
      .select('*')
      .single();
    if (error) {
      console.error('[createContact] Supabase error:', error.message, error.details, error.hint);
      throw error;
    }
    logCreate('contact', data.id, data);
    return data;
  } catch (err) {
    console.error('[createContact] Failed:', err.message || err);
    reportError('contactsService', 'createContact', err);
    const tempId = 'temp_' + Date.now();
    const offlineContact = { ...sanitized, id: tempId, last_activity_at: new Date().toISOString(), _offline: true };
    enqueue('contact', 'create', offlineContact);
    return offlineContact;
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
    reportError('contactsService', 'query', err);
    enqueue('contact', 'update', { id, ...cleanUpdates });
    return { id, ...updates, _offline: true };
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
    reportError('contactsService', 'query', err);
    enqueue('contact', 'delete', { id });
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

export async function fetchContactActivities(contactId) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select(`*, users!activities_user_id_fkey (full_name_ar, full_name_en)`)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function createActivity(activityData) {
  // Try Supabase FIRST — source of truth
  try {
    const { user_id, ...cleanData } = activityData;
    const { data, error } = await supabase
      .from('activities')
      .insert([stripInternalFields(cleanData)])
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
    const mock = {
      ...activityData,
      id: Date.now().toString(),
      created_at: activityData.created_at || new Date().toISOString(),
      users: { full_name_ar: 'أنت', full_name_en: 'You' },
      _offline: true,
    };
    enqueue('activity', 'create', mock);
    return mock;
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
    return { id, ...updates, _offline: true };
  }
}

export async function fetchContactOpportunities(contactId) {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        users!opportunities_assigned_to_fkey (full_name_ar, full_name_en),
        projects (name_ar, name_en)
      `)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    return [];
  }
}
