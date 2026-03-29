import supabase from '../lib/supabase';
import { logCreate, logUpdate } from './auditService';
import { enqueue } from '../lib/offlineQueue';
import { reportError } from '../utils/errorReporter';
import { FEATURES } from '../config/features';

// ── Module-level localStorage cache (disabled when OFFLINE_MODE=false) ──────
let _contactsCache = null;
let _contactsCacheTs = 0;
function getCachedContacts() {
  if (!FEATURES.OFFLINE_MODE) return [];
  if (_contactsCache && Date.now() - _contactsCacheTs < 15000) return _contactsCache;
  try { _contactsCache = JSON.parse(localStorage.getItem('platform_contacts') || '[]'); _contactsCacheTs = Date.now(); } catch { _contactsCache = []; }
  return _contactsCache;
}
function invalidateContactsCache() { _contactsCache = null; _contactsCacheTs = 0; }

// ── Assignment History ─────────────────────────────────────────────────────
const ASSIGN_HISTORY_KEY = 'platform_assignment_history';

export function getAssignmentHistory(contactId) {
  try {
    const all = JSON.parse(localStorage.getItem(ASSIGN_HISTORY_KEY) || '{}');
    return all[contactId] || [];
  } catch { return []; }
}

export function recordAssignment(contactId, { fromAgent, toAgent, assignedBy, notes = '' }) {
  const entry = {
    from: fromAgent || null,
    to: toAgent,
    by: assignedBy,
    notes,
    at: new Date().toISOString(),
  };
  // Save to localStorage
  try {
    const all = JSON.parse(localStorage.getItem(ASSIGN_HISTORY_KEY) || '{}');
    if (!all[contactId]) all[contactId] = [];
    all[contactId].push(entry);
    localStorage.setItem(ASSIGN_HISTORY_KEY, JSON.stringify(all));
  } catch {}
  // Persist to Supabase (non-blocking)
  supabase.from('activities').insert([{
    type: 'reassignment',
    entity_type: 'contact',
    contact_id: contactId,
    notes: `${fromAgent || '—'} → ${toAgent}${notes ? ': ' + notes : ''}`,
    user_id: null,
    status: 'completed',
    created_at: entry.at,
  }]).then(() => {}).catch(() => {});
  return entry;
}

export async function fetchContacts({ role, userId, teamId, filters = {}, page, pageSize }) {
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';
  try {
    let query = supabase
      .from('contacts')
      .select(`
        id, full_name, phone, email, contact_type, source, department, temperature,
        assigned_to_name, assigned_by_name, campaign_name, budget_min, budget_max,
        preferred_location, interested_in_type, notes, lead_score, is_blacklisted,
        gender, company, job_title, extra_phones, first_response_at,
        last_activity_at, created_at, updated_at,
        opportunities!left (
          id, stage, assigned_to, priority,
          users!opportunities_assigned_to_fkey (full_name_ar, full_name_en)
        )
      `, isServerPaginated ? { count: 'exact' } : {})
      .order('last_activity_at', { ascending: false });

    if (role === 'sales_agent') {
      query = query.eq('opportunities.assigned_to', userId);
    } else if (role === 'team_leader' && teamId) {
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', teamId);
      const ids = teamMembers?.map(m => m.id) || [];
      query = query.in('opportunities.assigned_to', ids);
    }

    if (filters.search) {
      const s = filters.search.replace(/[%_]/g, '');
      query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,campaign_name.ilike.%${s}%,notes.ilike.%${s}%,company.ilike.%${s}%`);
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
      return { data: data || [], count: count || 0 };
    }

    const { data, error } = await query.range(0, 499); // max 500 per fetch
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('contactsService', 'query', err);
    // Fallback to localStorage when Supabase is unreachable
    try {
      const cached = getCachedContacts();
      // Enrich with opportunities from localStorage
      const allOpps = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
      if (allOpps.length) {
        const oppsByContact = {};
        allOpps.forEach(o => {
          if (!o.contact_id) return;
          if (!oppsByContact[o.contact_id]) oppsByContact[o.contact_id] = [];
          oppsByContact[o.contact_id].push({ id: o.id, stage: o.stage, assigned_to: o.assigned_to, assigned_to_name: o.assigned_to_name, priority: o.priority, users: o.users || null });
        });
        cached.forEach(c => { c.opportunities = oppsByContact[c.id] || []; });
      }
      return isServerPaginated ? { data: cached.slice(0, 1000), count: cached.length } : cached.slice(0, 1000);
    } catch { return isServerPaginated ? { data: [], count: 0 } : []; }
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
  const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim() : v;
  const INTERNAL_FIELDS = ['_customFieldValues', '_offline', '_campaign_count', '_country', '_opp_count', '_aging_level', 'countryCode', 'country'];
  const sanitized = {};
  for (const [k, v] of Object.entries(contactData)) {
    if (INTERNAL_FIELDS.includes(k)) continue; // skip internal fields
    sanitized[k] = sanitize(v);
  }

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert([{ ...sanitized, last_activity_at: new Date().toISOString() }])
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
    // Save to localStorage and enqueue for retry
    const tempId = 'temp_' + Date.now();
    const offlineContact = { ...sanitized, id: tempId, last_activity_at: new Date().toISOString(), _offline: true };
    try {
      const all = getCachedContacts();
      all.unshift(offlineContact);
      invalidateContactsCache(); localStorage.setItem('platform_contacts', JSON.stringify(all));
    } catch { /* ignore quota */ }
    enqueue('contact', 'create', offlineContact);
    return offlineContact;
  }
}

export async function updateContact(id, updates) {
  // Remove computed/internal fields that don't exist in Supabase
  const { _campaign_count, _country, _opp_count, _aging_level, _offline, opportunities, ...cleanUpdates } = updates;
  try {
    const { data: oldData } = await supabase.from('contacts').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('contacts')
      .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    logUpdate('contact', id, oldData, data);
    return data;
  } catch (err) { reportError('contactsService', 'query', err);
    // Fallback: update in localStorage and enqueue for retry
    const all = getCachedContacts();
    const idx = all.findIndex(c => String(c.id) === String(id));
    if (idx > -1) {
      Object.assign(all[idx], updates, { updated_at: new Date().toISOString() });
      invalidateContactsCache(); localStorage.setItem('platform_contacts', JSON.stringify(all));
    }
    enqueue('contact', 'update', { id, ...cleanUpdates });
    return { id, ...updates };
  }
}

export async function deleteContact(id) {
  try {
    // Clean up related opportunities first (prevent orphans)
    try {
      await supabase.from('opportunities').delete().eq('contact_id', id);
    } catch { /* best-effort cleanup */ }
    // Clean up related activities
    try {
      await supabase.from('activities').delete().eq('contact_id', id);
    } catch { /* best-effort cleanup */ }
    // Clean up related reminders
    try {
      await supabase.from('reminders').delete().eq('entity_id', id);
    } catch { /* best-effort cleanup */ }

    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('contactsService', 'query', err);
    // Fallback: remove from localStorage and enqueue for retry
    const all = getCachedContacts();
    const filtered = all.filter(c => String(c.id) !== String(id));
    invalidateContactsCache(); localStorage.setItem('platform_contacts', JSON.stringify(filtered));
    // Also clean local opportunities
    try {
      const opps = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
      localStorage.setItem('platform_opportunities', JSON.stringify(opps.filter(o => String(o.contact_id) !== String(id))));
    } catch { /* ignore */ }
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

  // Try Supabase first
  try {
    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, phone, phone2, extra_phones, contact_type')
      .or(`phone.eq.${normalized},phone.ilike.%${last9},phone2.eq.${normalized},phone2.ilike.%${last9},extra_phones.ilike.%${last9}`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch { /* fall through to localStorage */ }

  // Fallback: check localStorage (mock mode)
  try {
    const cached = localStorage.getItem('platform_contacts');
    if (cached) {
      const contacts = JSON.parse(cached);
      const found = contacts.find(c => {
        if (fuzzyPhoneMatch(c.phone, normalized)) return true;
        if (fuzzyPhoneMatch(c.phone2, normalized)) return true;
        // extra_phones can be a comma-separated string or an array
        if (c.extra_phones) {
          const extras = Array.isArray(c.extra_phones)
            ? c.extra_phones
            : String(c.extra_phones).split(',').map(s => s.trim());
          if (extras.some(ep => fuzzyPhoneMatch(ep, normalized))) return true;
        }
        return false;
      });
      return found || null;
    }
  } catch { /* ignore */ }

  return null;
}

export async function fetchContactActivities(contactId) {
  let supaData = [];
  try {
    const { data, error } = await supabase
      .from('activities')
      .select(`*, users!activities_user_id_fkey (full_name_ar, full_name_en)`)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data?.length) supaData = data;
  } catch { /* ignore */ }

  // Always merge with localStorage
  try {
    const local = JSON.parse(localStorage.getItem('platform_activities') || '[]')
      .filter(a => String(a.contact_id) === String(contactId))
      .filter(a => !supaData.some(s => String(s.id) === String(a.id)));
    return [...supaData, ...local]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);
  } catch { return supaData; }
}

export async function createActivity(activityData) {
  const mock = {
    ...activityData,
    id: Date.now().toString(),
    created_at: activityData.created_at || new Date().toISOString(),
    users: { full_name_ar: 'أنت', full_name_en: 'You' },
  };

  // Always save to localStorage first
  try {
    const all = JSON.parse(localStorage.getItem('platform_activities') || '[]');
    all.unshift(mock);
    // Keep max 500 activities locally
    if (all.length > 500) all.length = 500;
    try {
      localStorage.setItem('platform_activities', JSON.stringify(all));
    } catch (e) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        all.length = Math.min(all.length, 250);
        try { localStorage.setItem('platform_activities', JSON.stringify(all)); } catch { /* give up */ }
      }
    }
    if (activityData.contact_id) {
      const contacts = getCachedContacts();
      const idx = contacts.findIndex(c => String(c.id) === String(activityData.contact_id));
      if (idx > -1) {
        contacts[idx].last_activity_at = new Date().toISOString();
        try { invalidateContactsCache(); localStorage.setItem('platform_contacts', JSON.stringify(contacts)); } catch { /* ignore quota */ }
      }
    }
  } catch { /* ignore */ }

  // Try Supabase in background
  try {
    const { user_id, ...cleanData } = activityData;
    const { data, error } = await supabase
      .from('activities')
      .insert([cleanData])
      .select('*')
      .single();
    if (!error && data) {
      await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', activityData.contact_id);
      return data;
    }
  } catch { /* ignore */ }

  return mock;
}

export async function updateActivity(id, updates) {
  // Update in localStorage
  try {
    const all = JSON.parse(localStorage.getItem('platform_activities') || '[]');
    const idx = all.findIndex(a => String(a.id) === String(id));
    if (idx > -1) {
      Object.assign(all[idx], updates);
      localStorage.setItem('platform_activities', JSON.stringify(all));
    }
  } catch { /* ignore */ }

  // Try Supabase in background
  try {
    const { data, error } = await supabase
      .from('activities')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (!error && data) return data;
  } catch { /* ignore */ }

  return { id, ...updates };
}

export async function fetchContactOpportunities(contactId) {
  let supaData = [];
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
    if (!error && data?.length) supaData = data;
  } catch { /* ignore */ }

  // Always merge with localStorage
  try {
    const local = JSON.parse(localStorage.getItem('platform_opportunities') || '[]')
      .filter(o => String(o.contact_id) === String(contactId))
      .filter(o => !supaData.some(s => String(s.id) === String(o.id)));
    return [...supaData, ...local]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch { return supaData; }
}
