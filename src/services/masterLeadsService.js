// Master Leads service — wraps the master_leads_list / master_leads_count
// RPCs that group contacts by phone and return one row per "lead family"
// (the original + every clone that shares the phone).
//
// Used by /crm/master-leads — admin-only view that lets the sales admin
// see, for any phone, exactly which agents currently hold a copy of it.

import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

// Phones any agent has "touched" — currently assigned, created by them,
// or has an activity (call/note/whatsapp/...) authored by them. Lets the
// admin search Master Leads by involvement, not just current ownership.
async function fetchUserInvolvedPhones(userId) {
  if (!userId) return [];
  try {
    const [byOwner, byCreator, byActivity] = await Promise.all([
      // Currently assigned
      supabase
        .from('contacts')
        .select('phone')
        .eq('assigned_to', userId)
        .eq('is_deleted', false)
        .not('phone', 'is', null),
      // Created by user
      supabase
        .from('contacts')
        .select('phone')
        .eq('created_by', userId)
        .eq('is_deleted', false)
        .not('phone', 'is', null),
      // Has any activity authored by user
      supabase
        .from('activities')
        .select('contact_id, contacts!inner(phone)')
        .eq('user_id', userId)
        .not('contact_id', 'is', null),
    ]);
    const phones = new Set();
    (byOwner.data || []).forEach(r => r.phone && phones.add(r.phone));
    (byCreator.data || []).forEach(r => r.phone && phones.add(r.phone));
    (byActivity.data || []).forEach(r => r.contacts?.phone && phones.add(r.contacts.phone));
    return [...phones];
  } catch (err) {
    reportError('masterLeadsService', 'fetchUserInvolvedPhones', err);
    return [];
  }
}

// Master Leads by agent involvement — fetches every family that touches
// the agent (any way) regardless of who currently owns each copy. Use
// this when the user wants "every phone Yassin has worked on" rather
// than the narrower "phones currently assigned to Yassin".
export async function fetchMasterLeadsByInvolvement({
  userId,
  search = null,
  minClones = 1,
  statusFilter = null,
} = {}) {
  try {
    const phones = await fetchUserInvolvedPhones(userId);
    if (phones.length === 0) return { rows: [], total: 0 };
    // Pull every contact sharing one of those phones — both the user's
    // own copies AND any copies held by other agents in the same family.
    // Chunked to avoid PostgREST URL length limits on huge sets.
    const CHUNK = 200;
    const allContacts = [];
    for (let i = 0; i < phones.length; i += CHUNK) {
      const chunk = phones.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('contacts')
        .select('id, phone, full_name, assigned_to, assigned_to_name, contact_status, source, campaign_name, created_at, last_activity_at, created_by')
        .in('phone', chunk)
        .eq('is_deleted', false);
      if (error) throw error;
      allContacts.push(...(data || []));
    }
    // Group into families by phone, matching the RPC's row shape so
    // the page renders without branching.
    const byPhone = new Map();
    allContacts.forEach(c => {
      if (!byPhone.has(c.phone)) byPhone.set(c.phone, []);
      byPhone.get(c.phone).push(c);
    });
    let families = [...byPhone.entries()].map(([phone, contacts]) => {
      const sorted = [...contacts].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      const first = sorted[0];
      const lastAct = contacts.reduce((max, c) =>
        (c.last_activity_at && (!max || c.last_activity_at > max)) ? c.last_activity_at : max, null);
      return {
        phone,
        primary_name: first?.full_name || null,
        family_count: contacts.length,
        first_created_at: first?.created_at || null,
        last_activity_at: lastAct,
        copies: sorted.map(c => ({
          contact_id: c.id,
          owner_id: c.assigned_to,
          owner_name: c.assigned_to_name,
          status: c.contact_status,
          created_at: c.created_at,
          last_activity_at: c.last_activity_at,
          source: c.source,
          campaign_name: c.campaign_name,
          created_by: c.created_by,
        })),
      };
    });
    // Apply optional filters that the page would otherwise apply via RPC
    if (minClones && minClones > 1) {
      families = families.filter(f => f.family_count >= minClones);
    }
    if (search) {
      const s = String(search).toLowerCase().trim();
      families = families.filter(f =>
        (f.phone || '').toLowerCase().includes(s)
        || (f.primary_name || '').toLowerCase().includes(s)
      );
    }
    if (statusFilter) {
      families = families.filter(f => (f.copies || []).some(c => (c.status || 'new') === statusFilter));
    }
    families.sort((a, b) => (b.last_activity_at || b.first_created_at || '').localeCompare(a.last_activity_at || a.first_created_at || ''));
    return { rows: families, total: families.length };
  } catch (err) {
    reportError('masterLeadsService', 'fetchMasterLeadsByInvolvement', err);
    return { rows: [], total: 0, error: err };
  }
}

export async function fetchMasterLeads({
  search = null,
  minClones = 1,
  ownerId = null,
  page = 1,
  pageSize = 50,
} = {}) {
  try {
    const offset = (page - 1) * pageSize;
    const [listRes, countRes] = await Promise.all([
      supabase.rpc('master_leads_list', {
        p_search: search || null,
        p_min_clones: minClones,
        p_owner_id: ownerId || null,
        p_limit: pageSize,
        p_offset: offset,
      }),
      supabase.rpc('master_leads_count', {
        p_search: search || null,
        p_min_clones: minClones,
        p_owner_id: ownerId || null,
      }),
    ]);
    if (listRes.error) throw listRes.error;
    if (countRes.error) throw countRes.error;
    return {
      rows: Array.isArray(listRes.data) ? listRes.data : [],
      total: typeof countRes.data === 'number' ? countRes.data : 0,
    };
  } catch (err) {
    reportError('masterLeadsService', 'fetchMasterLeads', err);
    return { rows: [], total: 0, error: err };
  }
}
