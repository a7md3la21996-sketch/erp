import supabase from '../lib/supabase';

/**
 * Fetch contacts based on user role (RBAC)
 * - sales_agent → own assigned contacts only
 * - team_leader → team contacts
 * - sales_manager → their teams' contacts
 * - sales_director / admin → all contacts
 * - marketing → all (read only)
 * - finance → contacts linked to deals
 */
export async function fetchContacts({ role, userId, teamId, filters = {} }) {
  let query = supabase
    .from('contacts')
    .select(`
      *,
      opportunities!left (
        id, stage, assigned_to, priority,
        users!opportunities_assigned_to_fkey (full_name_ar, full_name_en)
      )
    `)
    .order('last_activity_at', { ascending: false });

  // Role-based data scoping
  if (role === 'sales_agent') {
    // Only contacts with an opportunity assigned to this user
    query = query.eq('opportunities.assigned_to', userId);
  } else if (role === 'team_leader' && teamId) {
    // Contacts assigned to anyone in the same team
    const { data: teamMembers } = await supabase
      .from('users')
      .select('id')
      .eq('team_id', teamId);
    const ids = teamMembers?.map(m => m.id) || [];
    query = query.in('opportunities.assigned_to', ids);
  }
  // sales_manager, sales_director, admin, marketing → all contacts (no extra filter)

  // Apply search & filters
  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%,campaign_name.ilike.%${filters.search}%`);
  }
  if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.temperature) query = query.eq('temperature', filters.temperature);
  if (filters.showBlacklisted === false) query = query.eq('is_blacklisted', false);
  if (filters.showBlacklisted === true) query = query.eq('is_blacklisted', true);

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data || [];
}

export async function createContact(contactData) {
  const { data, error } = await supabase
    .from('contacts')
    .insert([{ ...contactData, last_activity_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContact(id, updates) {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function blacklistContact(id, reason) {
  return updateContact(id, { is_blacklisted: true, blacklist_reason: reason });
}

export async function checkDuplicate(phone) {
  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, phone, contact_type')
    .eq('phone', phone)
    .maybeSingle();
  return data;
}

export async function fetchContactActivities(contactId) {
  const { data, error } = await supabase
    .from('activities')
    .select(`*, users!activities_user_id_fkey (full_name_ar, full_name_en)`)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function createActivity(activityData) {
  const { data, error } = await supabase
    .from('activities')
    .insert([activityData])
    .select()
    .single();
  if (error) throw error;

  // Update last_activity_at on contact
  await supabase
    .from('contacts')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', activityData.contact_id);

  return data;
}

export async function fetchContactOpportunities(contactId) {
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
}
