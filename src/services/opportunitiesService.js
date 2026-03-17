import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { addToSyncQueue } from './syncService';

// ── localStorage helpers ──
function getLocalOpps() {
  try { return JSON.parse(localStorage.getItem('platform_opportunities') || '[]'); } catch { return []; }
}
function saveLocalOpps(opps) {
  try { localStorage.setItem('platform_opportunities', JSON.stringify(opps)); } catch { /* ignore */ }
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
export async function fetchOpportunities({ role, userId, teamId } = {}) {
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

    const { data, error } = await query.limit(200);
    if (!error && data?.length) {
      // Enrich with contacts/users/projects
      const enriched = await enrichOpps(data);
      saveLocalOpps(enriched);
      // Merge any truly local-only opps
      const local = getLocalOpps().filter(o => !enriched.some(s => String(s.id) === String(o.id)));
      return [...enriched, ...local].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
    }
    if (error) throw error;
    return getLocalOpps().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
  } catch {
    return getLocalOpps().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
  }
}

// ─── Create opportunity ───
export async function createOpportunity(oppData) {
  const now = new Date().toISOString();
  const localOpp = { ...oppData, id: Date.now().toString(), created_at: now };

  // Always save to localStorage first
  const all = getLocalOpps();
  all.unshift(localOpp);
  saveLocalOpps(all);

  // Try Supabase
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ ...oppData, created_at: now }])
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
  } catch {
    // Queue for later sync
    addToSyncQueue('opportunities', 'create', localOpp);
  }

  return localOpp;
}

// ─── Update opportunity ───
export async function updateOpportunity(id, updates) {
  try {
    const { data: oldData } = await supabase.from('opportunities').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const [enriched] = await enrichOpps([data]);
    logUpdate('opportunity', id, oldData, enriched);
    return enriched;
  } catch {
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
  } catch {
    const filtered = getLocalOpps().filter(o => String(o.id) !== String(id));
    saveLocalOpps(filtered);
    // Queue for later sync
    addToSyncQueue('opportunities', 'delete', { id });
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
  } catch {
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
  } catch {
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
  } catch {
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
