import supabase from '../lib/supabase';
import { logCreate, logUpdate } from './auditService';

export async function fetchContacts({ role, userId, teamId, filters = {} }) {
  try {
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
  } catch {
    // Fallback to localStorage when Supabase is unreachable
    try {
      const cached = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
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
      return cached.slice(0, 200);
    } catch { return []; }
  }
}

export async function createContact(contactData) {
  const { data, error } = await supabase
    .from('contacts')
    .insert([{ ...contactData, last_activity_at: new Date().toISOString() }])
    .select('*')
    .single();
  if (error) throw error;
  logCreate('contact', data.id, data);
  return data;
}

export async function updateContact(id, updates) {
  const { data: oldData } = await supabase.from('contacts').select('*').eq('id', id).single();
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  logUpdate('contact', id, oldData, data);
  return data;
}

export async function blacklistContact(id, reason) {
  return updateContact(id, { is_blacklisted: true, blacklist_reason: reason });
}

export async function checkDuplicate(phone) {
  // Try Supabase first
  try {
    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, phone, contact_type')
      .eq('phone', phone)
      .maybeSingle();
    if (data) return data;
  } catch { /* fall through to localStorage */ }

  // Fallback: check localStorage (mock mode)
  try {
    const cached = localStorage.getItem('platform_contacts');
    if (cached) {
      const contacts = JSON.parse(cached);
      const found = contacts.find(c => c.phone === phone || c.phone2 === phone);
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
      const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      const idx = contacts.findIndex(c => String(c.id) === String(activityData.contact_id));
      if (idx > -1) {
        contacts[idx].last_activity_at = new Date().toISOString();
        try { localStorage.setItem('platform_contacts', JSON.stringify(contacts)); } catch { /* ignore quota */ }
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
