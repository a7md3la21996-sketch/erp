import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';

// ── localStorage helpers ──
function getLocalOpps() {
  try { return JSON.parse(localStorage.getItem('platform_opportunities') || '[]'); } catch { return []; }
}
function saveLocalOpps(opps) {
  try { localStorage.setItem('platform_opportunities', JSON.stringify(opps)); } catch { /* ignore */ }
}

// ─── Fetch all opportunities with related data ───
export async function fetchOpportunities({ role, userId, teamId } = {}) {
  try {
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        contacts!left (id, full_name, phone, email, company, contact_type, department),
        users!opportunities_assigned_to_fkey (id, full_name_ar, full_name_en),
        projects!left (id, name_ar, name_en)
      `)
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
      // Update localStorage with fresh joined data so cards always show names
      saveLocalOpps(data);
      // Merge any truly local-only opps (not yet synced)
      const local = getLocalOpps().filter(o => !data.some(s => String(s.id) === String(o.id)));
      return [...data, ...local].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
    }
    if (error) throw error;
    // Supabase returned empty — use localStorage
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

  // Try Supabase in background
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ ...oppData, created_at: now }])
      .select('*, contacts!left (id, full_name, phone, email, company, contact_type, department), users!opportunities_assigned_to_fkey (id, full_name_ar, full_name_en), projects!left (id, name_ar, name_en)')
      .single();
    if (!error && data) {
      // Update localStorage with joined data so it has names
      const allOpps = getLocalOpps();
      const idx = allOpps.findIndex(o => String(o.id) === String(localOpp.id));
      if (idx > -1) allOpps[idx] = data; else allOpps.unshift(data);
      saveLocalOpps(allOpps);
      logCreate('opportunity', data.id, data);
      return data;
    }
  } catch { /* ignore */ }

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
      .select('*, contacts!left (id, full_name, phone, email, company, contact_type, department), users!opportunities_assigned_to_fkey (id, full_name_ar, full_name_en), projects!left (id, name_ar, name_en)')
      .single();
    if (error) throw error;
    logUpdate('opportunity', id, oldData, data);
    return data;
  } catch {
    const all = getLocalOpps();
    const idx = all.findIndex(o => String(o.id) === String(id));
    if (idx > -1) {
      Object.assign(all[idx], updates, { updated_at: new Date().toISOString() });
      saveLocalOpps(all);
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
