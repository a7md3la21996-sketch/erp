import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { FEATURES } from '../config/features';
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { addToSyncQueue } from './syncService';

// ── localStorage helpers (disabled when OFFLINE_MODE=false) ──
function getLocalOpps() {
  if (!FEATURES.OFFLINE_MODE) return [];
  try { return JSON.parse(localStorage.getItem('platform_opportunities') || '[]'); } catch { return []; }
}
function saveLocalOpps(opps) {
  if (!FEATURES.OFFLINE_MODE) return;
  const capped = Array.isArray(opps) && opps.length > 200 ? opps.slice(0, 200) : opps;
  try { localStorage.setItem('platform_opportunities', JSON.stringify(capped)); } catch {}
}

// ── Unit blocking helpers ──
export function checkUnitAvailability(unitId) {
  if (!unitId) return { available: true };
  const units = JSON.parse(localStorage.getItem('platform_re_units') || '[]');
  const unit = units.find(u => u.id === unitId);
  if (!unit) return { available: true };
  if (unit.status === 'sold') return { available: false, reason: 'sold', unit };
  if (unit.status === 'reserved') return { available: false, reason: 'reserved', unit };
  return { available: true, unit };
}

function updateUnitStatus(unitId, newStatus) {
  if (!unitId) return;
  try {
    const units = JSON.parse(localStorage.getItem('platform_re_units') || '[]');
    const idx = units.findIndex(u => u.id === unitId);
    if (idx > -1) {
      units[idx].status = newStatus;
      localStorage.setItem('platform_re_units', JSON.stringify(units));
    }
  } catch { /* ignore */ }
}

// ── Helper: enrich opps with contacts/users/projects data ──
async function enrichOpps(opps) {
  if (!opps.length) return opps;

  // Collect unique IDs
  const contactIds = [...new Set(opps.map(o => o.contact_id).filter(Boolean))];
  const userIds = [...new Set(opps.map(o => o.assigned_to).filter(Boolean))];
  const projectIds = [...new Set(opps.map(o => o.project_id).filter(Boolean))];

  // Try Supabase first, fallback to localStorage
  let contacts = [], users = [], projects = [];
  try {
    const [contactsRes, usersRes, projectsRes] = await Promise.all([
      contactIds.length
        ? supabase.from('contacts').select('id, prefix, full_name, phone, phone2, email, company, job_title, contact_type, department, source, gender, nationality, birth_date, budget_min, budget_max, preferred_location, interested_in_type, last_activity_at').in('id', contactIds)
        : { data: [] },
      userIds.length
        ? supabase.from('users').select('id, full_name_ar, full_name_en').in('id', userIds)
        : { data: [] },
      projectIds.length
        ? supabase.from('projects').select('id, name_ar, name_en').in('id', projectIds)
        : { data: [] },
    ]);
    contacts = contactsRes.data || [];
    users = usersRes.data || [];
    projects = projectsRes.data || [];
  } catch { /* ignore */ }

  // Fallback: if Supabase returned nothing, try localStorage
  if (!contacts.length && contactIds.length) {
    try {
      const allContacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      contacts = allContacts.filter(c => contactIds.includes(c.id));
    } catch { /* ignore */ }
  }

  // Build lookup maps
  const contactMap = {};
  contacts.forEach(c => { contactMap[c.id] = c; });
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });
  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  // Attach to each opp
  return opps.map(o => ({
    ...o,
    contacts: contactMap[o.contact_id] || o.contacts || null,
    users: userMap[o.assigned_to] || o.users || null,
    projects: projectMap[o.project_id] || o.projects || null,
  }));
}

// ─── Fetch all opportunities with related data ───
export async function fetchOpportunities({ role, userId, teamId, page = 0, pageSize = 200 } = {}) {
  try {
    let query = supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'sales_agent') {
      query = query.eq('assigned_to', userId);
    } else if (role === 'team_leader' && teamId) {
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', teamId);
      const ids = teamMembers?.map(m => m.id) || [];
      if (ids.length) query = query.in('assigned_to', ids);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await query.range(from, to);
    if (!error && data?.length) {
      // Enrich only the 200 fetched records (not 2000)
      const enriched = await enrichOpps(data);
      saveLocalOpps(enriched);
      // Merge any truly local-only opps
      const local = getLocalOpps().filter(o => !enriched.some(s => String(s.id) === String(o.id)));
      return [...enriched, ...local].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (error) throw error;
    return getLocalOpps().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (err) { reportError('opportunitiesService', 'query', err);
    return getLocalOpps().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

// ─── Create opportunity ───
export async function createOpportunity(oppData) {
  // Input validation
  if (!oppData.contact_id && !oppData.contact_name) {
    throw new Error('Contact is required for opportunity');
  }
  if (oppData.budget && (isNaN(Number(oppData.budget)) || Number(oppData.budget) < 0)) {
    throw new Error('Invalid budget value');
  }
  // Sanitize string fields
  const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim() : v;
  const sanitized = {};
  for (const [k, v] of Object.entries(oppData)) {
    sanitized[k] = sanitize(v);
  }

  // Block if unit is already reserved or sold
  if (sanitized.unit_id) {
    const availability = checkUnitAvailability(sanitized.unit_id);
    if (!availability.available) {
      throw new Error(`Unit is already ${availability.reason}. Cannot create opportunity for this unit.`);
    }
  }

  const now = new Date().toISOString();
  // Strip internal fields before Supabase
  const localOpp = { ...sanitized, id: Date.now().toString(), created_at: now };

  // If opportunity starts at reserved/contracted stage, block the unit immediately
  if (sanitized.unit_id && (sanitized.stage === 'reserved' || sanitized.stage === 'contracted')) {
    updateUnitStatus(sanitized.unit_id, 'reserved');
  }
  if (sanitized.unit_id && sanitized.stage === 'closed_won') {
    updateUnitStatus(sanitized.unit_id, 'sold');
  }

  // Always save to localStorage first
  const all = getLocalOpps();
  all.unshift(localOpp);
  saveLocalOpps(all);

  // Try Supabase
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ ...stripInternalFields(sanitized), created_at: now }])
      .select('*')
      .single();
    if (!error && data) {
      // Enrich with related data
      const [enriched] = await enrichOpps([data]);
      // Update localStorage
      const allOpps = getLocalOpps();
      const idx = allOpps.findIndex(o => String(o.id) === String(localOpp.id));
      if (idx > -1) allOpps[idx] = enriched; else allOpps.unshift(enriched);
      saveLocalOpps(allOpps);
      logCreate('opportunity', enriched.id, enriched);
      return enriched;
    }
  } catch (err) { reportError('opportunitiesService', 'query', err);
    // Queue for later sync
    addToSyncQueue('opportunities', 'create', localOpp);
  }

  return localOpp;
}

// ─── Update opportunity ───
export async function updateOpportunity(id, updates) {
  // If stage is changing, handle unit blocking
  if (updates.stage) {
    // Find the opportunity to get its unit_id
    const allOpps = getLocalOpps();
    const opp = allOpps.find(o => String(o.id) === String(id));
    const unitId = updates.unit_id || opp?.unit_id;

    if (unitId) {
      // When moving TO reserved/contracted, check availability first then block
      if (updates.stage === 'reserved' || updates.stage === 'contracted') {
        const availability = checkUnitAvailability(unitId);
        // Allow if unit is already held by this same opportunity (re-saving same stage)
        if (!availability.available) {
          // Check if this opp already owns the reservation
          const currentOpp = opp || {};
          const alreadyOwns = (currentOpp.unit_id === unitId) &&
            (currentOpp.stage === 'reserved' || currentOpp.stage === 'contracted' || currentOpp.stage === 'closed_won');
          if (!alreadyOwns) {
            throw new Error(`Unit is already ${availability.reason}. Cannot reserve this unit.`);
          }
        }
        updateUnitStatus(unitId, 'reserved');
      }
      // When closed_won, mark unit as sold
      else if (updates.stage === 'closed_won') {
        updateUnitStatus(unitId, 'sold');
      }
      // When closed_lost, release the unit back to available
      else if (updates.stage === 'closed_lost') {
        updateUnitStatus(unitId, 'available');
      }
    }
  }

  try {
    const { data: oldData } = await supabase.from('opportunities').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...stripInternalFields(updates), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const [enriched] = await enrichOpps([data]);
    logUpdate('opportunity', id, oldData, enriched);
    return enriched;
  } catch (err) { reportError('opportunitiesService', 'query', err);
    const all = getLocalOpps();
    const idx = all.findIndex(o => String(o.id) === String(id));
    if (idx > -1) {
      Object.assign(all[idx], updates, { updated_at: new Date().toISOString() });
      saveLocalOpps(all);
      // Queue for later sync
      addToSyncQueue('opportunities', 'update', { _id: id, ...updates, updated_at: new Date().toISOString() });
      return all[idx];
    }
    return { id, ...updates };
  }
}

// ─── Delete opportunity ───
export async function deleteOpportunity(id) {
  try {
    const { data: oldData } = await supabase.from('opportunities').select('*').eq('id', id).single();
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) throw error;
    logDelete('opportunity', id, oldData);
    // Also remove from localStorage on success
    const filtered = getLocalOpps().filter(o => String(o.id) !== String(id));
    saveLocalOpps(filtered);
  } catch (err) { reportError('opportunitiesService', 'query', err);
    // Queue for later sync but don't delete from localStorage yet
    addToSyncQueue('opportunities', 'delete', { id });
    throw new Error('Delete failed - queued for retry');
  }
}

// ─── Fetch sales agents ───
export async function fetchSalesAgents() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name_ar, full_name_en, role, team_id')
      .in('role', ['sales_agent', 'team_leader', 'sales_manager', 'sales_director'])
      .order('full_name_ar');
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('opportunitiesService', 'query', err);
    return [];
  }
}

// ─── Fetch projects for dropdown ───
export async function fetchProjects() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name_ar, name_en')
      .order('name_ar');
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('opportunitiesService', 'query', err);
    return [];
  }
}

// ─── Search contacts for linking ───
export async function searchContacts(query) {
  if (!query || query.length < 2) return [];
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, phone, email, company, contact_type, department')
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('opportunitiesService', 'query', err);
    // Fallback: search localStorage contacts
    try {
      const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      const q = query.toLowerCase();
      return contacts.filter(c =>
        (c.full_name?.toLowerCase().includes(q)) ||
        (c.phone?.includes(q)) ||
        (c.email?.toLowerCase().includes(q))
      ).slice(0, 10);
    } catch { return []; }
  }
}
