import supabase from '../lib/supabase';

// ─── Fetch all opportunities with related data ───
export async function fetchOpportunities({ role, userId, teamId } = {}) {
  try {
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        contacts!left (id, full_name, phone, email, company, contact_type),
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
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// ─── Create opportunity ───
export async function createOpportunity(oppData) {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ ...oppData, created_at: new Date().toISOString() }])
      .select('*, contacts!left (id, full_name, phone, email, company, contact_type), users!opportunities_assigned_to_fkey (id, full_name_ar, full_name_en), projects!left (id, name_ar, name_en)')
      .single();
    if (error) throw error;
    return data;
  } catch {
    // Return mock for fallback
    return { ...oppData, id: Date.now(), created_at: new Date().toISOString() };
  }
}

// ─── Update opportunity ───
export async function updateOpportunity(id, updates) {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, contacts!left (id, full_name, phone, email, company, contact_type), users!opportunities_assigned_to_fkey (id, full_name_ar, full_name_en), projects!left (id, name_ar, name_en)')
      .single();
    if (error) throw error;
    return data;
  } catch {
    return { id, ...updates };
  }
}

// ─── Delete opportunity ───
export async function deleteOpportunity(id) {
  try {
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) throw error;
  } catch { /* silent */ }
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
      .select('id, full_name, phone, email, company, contact_type')
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
