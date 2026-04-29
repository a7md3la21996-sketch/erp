import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { addToSyncQueue } from './syncService';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';
import { applyRoleFilter } from '../utils/roleFilter';
import { notifyOppStageChange, notifyDealWon } from './notificationService';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import { requireAnyPerm, requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

// Retry wrapper for idempotent Supabase calls (UPDATE/DELETE/SELECT). Never
// for INSERT — dropped response after successful write would duplicate.
const rq = (fn, label) => retryWithBackoff(fn, { label });

// ── Unit blocking helpers ──
export async function checkUnitAvailability(unitId) {
  if (!unitId) return { available: true };
  try {
    const { data: unit } = await supabase.from('resale_units').select('id, status').eq('id', unitId).maybeSingle();
    if (!unit) return { available: true };
    if (unit.status === 'sold') return { available: false, reason: 'sold', unit };
    if (unit.status === 'reserved') return { available: false, reason: 'reserved', unit };
    return { available: true, unit };
  } catch (err) { reportError('opportunitiesService', 'checkUnitAvailability', err); return { available: true }; }
}

async function updateUnitStatus(unitId, newStatus) {
  if (!unitId) return;
  try {
    await supabase.from('resale_units').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', unitId);
  } catch (err) { reportError('opportunitiesService', 'updateUnitStatus', err); }
}

// ── Helper: enrich opps with contacts/users/projects data ──
async function enrichOpps(opps) {
  if (!opps.length) return opps;

  // Collect unique IDs
  const contactIds = [...new Set(opps.map(o => o.contact_id).filter(Boolean))];
  const userIds = [...new Set(opps.map(o => o.assigned_to).filter(Boolean))];
  const projectIds = [...new Set(opps.map(o => o.project_id).filter(Boolean))];

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
    if (contactsRes.error) reportError('opportunitiesService', 'enrichOpps.contacts', contactsRes.error);
    if (usersRes.error) reportError('opportunitiesService', 'enrichOpps.users', usersRes.error);
    if (projectsRes.error) reportError('opportunitiesService', 'enrichOpps.projects', projectsRes.error);
    contacts = contactsRes.data || [];
    users = usersRes.data || [];
    projects = projectsRes.data || [];
  } catch (err) { reportError('opportunitiesService', 'enrichOpps', err); }

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
    contacts: contactMap[o.contact_id] || o.contacts || { full_name: o.contact_name || '—' },
    users: userMap[o.assigned_to] || o.users || { full_name_ar: o.assigned_to_name || '—', full_name_en: o.assigned_to_name || '—' },
    projects: projectMap[o.project_id] || o.projects || { name_ar: o.project_name || '', name_en: o.project_name || '' },
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
      const { data: agentUser } = await supabase.from('users').select('full_name_en').eq('id', userId).maybeSingle();
      if (agentUser?.full_name_en) {
        query = query.eq('assigned_to_name', agentUser.full_name_en);
      } else {
        query = query.eq('assigned_to', userId);
      }
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const names = await getTeamMemberNames(role, teamId);
      if (names.length) {
        query = query.in('assigned_to_name', names);
      }
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    const rangedQuery = query.range(from, to);
    const { data, error } = await rq(() => rangedQuery, 'fetchOpportunities');
    if (error) throw error;
    if (data?.length) {
      const enriched = await enrichOpps(data);
      return enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return [];
  } catch (err) {
    reportError('opportunitiesService', 'query', err);
    return [];
  }
}

// ─── Create opportunity ───
export async function createOpportunity(oppData) {
  requireAnyPerm([P.OPPS_EDIT, P.OPPS_EDIT_OWN], 'Not allowed to create opportunities');
  // Input validation
  if (!oppData.contact_id && !oppData.contact_name) {
    throw new Error('Contact is required for opportunity');
  }
  if (oppData.budget && (isNaN(Number(oppData.budget)) || Number(oppData.budget) < 0)) {
    throw new Error('Invalid budget value');
  }
  // Sanitize string fields + convert empty strings to null
  const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim() : v;
  const sanitized = {};
  for (const [k, v] of Object.entries(oppData)) {
    if (v === undefined || v === null) continue;
    const val = sanitize(v);
    sanitized[k] = val === '' ? null : val;
  }

  // Block if unit is already reserved or sold
  if (sanitized.unit_id) {
    const availability = await checkUnitAvailability(sanitized.unit_id);
    if (!availability.available) {
      throw new Error(`Unit is already ${availability.reason}. Cannot create opportunity for this unit.`);
    }
  }

  const now = new Date().toISOString();

  // If opportunity starts at reserved/contracted stage, block the unit immediately
  if (sanitized.unit_id && (sanitized.stage === 'reserved' || sanitized.stage === 'contracted')) {
    await updateUnitStatus(sanitized.unit_id, 'reserved');
  }
  if (sanitized.unit_id && sanitized.stage === 'closed_won') {
    await updateUnitStatus(sanitized.unit_id, 'sold');
  }

  // Try Supabase FIRST — source of truth
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ ...stripInternalFields(sanitized), created_at: now }])
      .select('*')
      .single();
    if (error) throw error;
    // Enrich with related data
    const [enriched] = await enrichOpps([data]);
    logCreate('opportunity', enriched.id, enriched);
    return enriched;
  } catch (err) {
    reportError('opportunitiesService', 'createOpportunity', err);
    throw err;
  }
}

// ─── Update opportunity ───
export async function updateOpportunity(id, updates) {
  requireAnyPerm([P.OPPS_EDIT, P.OPPS_EDIT_OWN], 'Not allowed to update opportunities');
  // If stage is changing, handle unit blocking
  if (updates.stage) {
    const unitId = updates.unit_id;

    if (unitId) {
      // When moving TO reserved/contracted, check availability first then block
      if (updates.stage === 'reserved' || updates.stage === 'contracted') {
        const availability = await checkUnitAvailability(unitId);
        if (!availability.available) {
          throw new Error(`Unit is already ${availability.reason}. Cannot reserve this unit.`);
        }
        await updateUnitStatus(unitId, 'reserved');
      }
      // When closed_won, mark unit as sold
      else if (updates.stage === 'closed_won') {
        await updateUnitStatus(unitId, 'sold');
      }
      // When closed_lost, release the unit back to available
      else if (updates.stage === 'closed_lost') {
        await updateUnitStatus(unitId, 'available');
      }
    }
  }

  try {
    const { data: oldData } = await rq(() => supabase.from('opportunities').select('*').eq('id', id).single(), 'updateOpportunity.read');
    const { data, error } = await rq(() => supabase
      .from('opportunities')
      .update({ ...stripInternalFields(updates), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single(), 'updateOpportunity.write');
    if (error) throw error;
    const [enriched] = await enrichOpps([data]);
    logUpdate('opportunity', id, oldData, enriched);
    if (updates.stage && updates.stage !== oldData?.stage) {
      notifyOppStageChange({ contactName: enriched.contacts?.full_name || enriched.contact_name, stage: updates.stage, agentName: enriched.assigned_to_name });
    }
    if (updates.stage === 'closed_won') {
      notifyDealWon({ dealNumber: '', dealId: id, clientName: enriched.contacts?.full_name || '', value: enriched.budget || 0, agentId: enriched.assigned_to_name });
    }
    return enriched;
  } catch (err) {
    reportError('opportunitiesService', 'updateOpportunity', err);
    throw err;
  }
}

// ─── Delete opportunity ───
export async function deleteOpportunity(id) {
  requirePerm(P.OPPS_DELETE, 'Not allowed to delete opportunities');
  try {
    const { data: oldData } = await rq(() => supabase.from('opportunities').select('*').eq('id', id).single(), 'deleteOpportunity.read');
    const { error } = await rq(() => supabase.from('opportunities').delete().eq('id', id), 'deleteOpportunity.write');
    if (error) throw error;
    logDelete('opportunity', id, oldData);
  } catch (err) {
    reportError('opportunitiesService', 'deleteOpportunity', err);
    throw err;
  }
}

// ─── Fetch sales agents ───
export async function fetchSalesAgents() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name_ar, full_name_en, role, team_id')
      .in('role', ['sales_agent', 'team_leader', 'sales_manager', 'sales_director', 'operations', 'admin'])
      .order('full_name_ar');
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('opportunitiesService', 'query', err);
    return [];
  }
}

// ─── Fetch agents filtered by role (TL sees only their team, Manager sees their teams) ───
export async function fetchTeamAgents({ role, userId, teamId } = {}) {
  try {
    const all = await fetchSalesAgents();
    if (role === 'admin' || role === 'operations') return all;
    if (role === 'sales_agent') return all.filter(a => a.id === userId);
    if (role === 'team_leader' && teamId) {
      const { data: children } = await supabase.from('departments').select('id').eq('parent_id', teamId);
      const managedTeams = new Set([teamId, ...((children || []).map(c => c.id))]);
      return all.filter(a => managedTeams.has(a.team_id));
    }
    if (role === 'sales_manager' && teamId) {
      const { data: children } = await supabase.from('departments').select('id').eq('parent_id', teamId);
      const allowedTeams = new Set([teamId, ...((children || []).map(c => c.id))]);
      return all.filter(a => allowedTeams.has(a.team_id));
    }
    return all;
  } catch (err) { reportError('opportunitiesService', 'fetchTeamAgents', err);
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
export async function searchContacts(query, { role, userId } = {}) {
  if (!query || query.length < 2) return [];
  try {
    let q = supabase
      .from('contacts')
      .select('id, full_name, phone, email, company, contact_type, department, assigned_to_names')
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
    // Sales agent: only see their assigned contacts.
    // After Phase 1: filter by UUID — faster and avoids jsonb @> overhead.
    if (role === 'sales_agent' && userId) {
      q = q.eq('assigned_to', userId);
    }
    const { data, error } = await q.limit(10);
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('opportunitiesService', 'query', err);
    return [];
  }
}
