// Master Leads service — wraps the master_leads_list / master_leads_count
// RPCs that group contacts by phone and return one row per "lead family"
// (the original + every clone that shares the phone).
//
// Used by /crm/master-leads — admin-only view that lets the sales admin
// see, for any phone, exactly which agents currently hold a copy of it.

import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

// Master Leads scoped to families where the agent currently holds at
// least one copy (original or clone). The built-in master_leads_list
// RPC's p_owner_id surfaces only one copy per family, so clones held
// by the agent — but where the original sits elsewhere — get silently
// dropped. This loader bypasses that by:
//   1. Pulling every phone the agent is currently assigned_to.
//   2. Fetching every contact sharing one of those phones (so the
//      family is complete — agent's copies + everyone else's).
//   3. Grouping into the same family shape the RPC returns.
// Status filter is strict: the agent's own copy must be in the chosen
// status, not just any copy in the family.
export async function fetchMasterLeadsByOwner({
  userId,
  search = null,
  minClones = 1,
  statusFilter = null,
} = {}) {
  if (!userId) return { rows: [], total: 0 };
  try {
    // Step 1 — phones the agent owns. If a status filter is active we
    // narrow the DB query to that status (typically a much smaller set:
    // ~470 contacted vs ~7400 total for a busy agent). When no status
    // is set we still need every phone, so page through 1000 at a time.
    const PAGE = 1000;
    const ownPhones = [];
    for (let offset = 0; ; offset += PAGE) {
      let q = supabase
        .from('contacts')
        .select('phone')
        .eq('assigned_to', userId)
        .eq('is_deleted', false)
        .not('phone', 'is', null);
      if (statusFilter) q = q.eq('contact_status', statusFilter);
      const { data, error } = await q.range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      ownPhones.push(...data.map(r => r.phone));
      if (data.length < PAGE) break;
    }
    const phones = [...new Set(ownPhones)];
    if (phones.length === 0) return { rows: [], total: 0 };

    // Step 2 — every contact sharing one of those phones. Chunk small
    // enough to stay well under the 1000-row default per request even
    // when phones have multiple copies each.
    const CHUNK = 100;
    const allContacts = [];
    for (let i = 0; i < phones.length; i += CHUNK) {
      const chunk = phones.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('contacts')
        .select('id, phone, full_name, assigned_to, assigned_to_name, contact_status, source, campaign_name, created_at, last_activity_at, created_by')
        .in('phone', chunk)
        .eq('is_deleted', false)
        .range(0, 9999);
      if (error) throw error;
      allContacts.push(...(data || []));
    }

    // Step 3 — group into families by phone.
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

    // Step 4 — apply optional filters in JS.
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
      // Strict: the agent's own copy must be in the chosen status.
      families = families.filter(f =>
        (f.copies || []).some(c => c.owner_id === userId && (c.status || 'new') === statusFilter)
      );
    }
    families.sort((a, b) =>
      (b.last_activity_at || b.first_created_at || '').localeCompare(a.last_activity_at || a.first_created_at || '')
    );
    return { rows: families, total: families.length };
  } catch (err) {
    reportError('masterLeadsService', 'fetchMasterLeadsByOwner', err);
    return { rows: [], total: 0, error: err };
  }
}

// Master Leads scoped to families that have at least one copy in the given
// campaign(s). The master_leads_list RPC doesn't know about campaigns (campaign
// is a per-copy contact field), so — like the by-owner loader — we resolve it
// in JS: find the phones whose contacts carry the campaign, then rebuild the
// full family for each so the admin sees the whole family, not just the matching
// copy. `campaignNames` is matched as-stored (ar + en variants of one campaign).
export async function fetchMasterLeadsByCampaign({
  campaignNames,
  ownerId = null,
  search = null,
  minClones = 1,
  statusFilter = null,
} = {}) {
  const names = (Array.isArray(campaignNames) ? campaignNames : [campaignNames]).filter(Boolean);
  if (names.length === 0) return { rows: [], total: 0 };
  try {
    // Step 1 — phones that have a contact in the selected campaign.
    const PAGE = 1000;
    const campPhones = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from('contacts')
        .select('phone')
        .in('campaign_name', names)
        .eq('is_deleted', false)
        .not('phone', 'is', null)
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      campPhones.push(...data.map(r => r.phone));
      if (data.length < PAGE) break;
    }
    const phones = [...new Set(campPhones)];
    if (phones.length === 0) return { rows: [], total: 0 };

    // Step 2 — every contact sharing one of those phones (the full family).
    const CHUNK = 100;
    const allContacts = [];
    for (let i = 0; i < phones.length; i += CHUNK) {
      const chunk = phones.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('contacts')
        .select('id, phone, full_name, assigned_to, assigned_to_name, contact_status, source, campaign_name, created_at, last_activity_at, created_by')
        .in('phone', chunk)
        .eq('is_deleted', false)
        .range(0, 9999);
      if (error) throw error;
      allContacts.push(...(data || []));
    }

    // Step 3 — group into families by phone (same shape as the by-owner loader).
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

    // Step 4 — optional filters in JS.
    if (minClones && minClones > 1) families = families.filter(f => f.family_count >= minClones);
    if (search) {
      const s = String(search).toLowerCase().trim();
      families = families.filter(f =>
        (f.phone || '').toLowerCase().includes(s) || (f.primary_name || '').toLowerCase().includes(s));
    }
    if (ownerId) families = families.filter(f => (f.copies || []).some(c => c.owner_id === ownerId));
    if (statusFilter) families = families.filter(f => (f.copies || []).some(c => (c.status || 'new') === statusFilter));
    families.sort((a, b) =>
      (b.last_activity_at || b.first_created_at || '').localeCompare(a.last_activity_at || a.first_created_at || ''));
    return { rows: families, total: families.length };
  } catch (err) {
    reportError('masterLeadsService', 'fetchMasterLeadsByCampaign', err);
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
