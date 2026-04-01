import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import supabase from '../lib/supabase';
import { logCreate, logDelete } from './auditService';
import { enqueue } from '../lib/offlineQueue';

// ── Activity Types ─────────────────────────────────────────────────────────
export const ACTIVITY_TYPES = {
  call:          { ar: 'مكالمة',        en: 'Call',          icon: 'Phone',        color: '#4A7AAB', dept: ['crm','sales','finance'] },
  whatsapp:      { ar: 'واتساب',        en: 'WhatsApp',      icon: 'MessageCircle',color: '#2B4C6F', dept: ['crm','sales'] },
  email:         { ar: 'إيميل',         en: 'Email',         icon: 'Mail',         color: '#6B8DB5', dept: ['crm','sales','hr','finance'] },
  meeting:       { ar: 'مقابلة',        en: 'Meeting',       icon: 'Users',        color: '#2B4C6F', dept: ['crm','sales','hr','finance'] },
  note:          { ar: 'ملاحظة',        en: 'Note',          icon: 'FileText',     color: '#8BA8C8', dept: ['crm','sales','hr','finance'] },
  interview:     { ar: 'مقابلة',        en: 'Interview',     icon: 'UserCheck',    color: '#4A7AAB', dept: ['hr'] },
  warning:       { ar: 'إنذار',         en: 'Warning',       icon: 'AlertTriangle',color: '#EF4444', dept: ['hr'] },
  evaluation:    { ar: 'تقييم',         en: 'Evaluation',    icon: 'Star',         color: '#6B8DB5', dept: ['hr'] },
  invoice:       { ar: 'فاتورة',        en: 'Invoice',       icon: 'Receipt',      color: '#4A7AAB', dept: ['finance'] },
  payment:       { ar: 'دفعة',          en: 'Payment',       icon: 'Banknote',     color: '#2B4C6F', dept: ['finance'] },
  status_change: { ar: 'تغيير حالة',    en: 'Status Change', icon: 'RefreshCw',   color: '#8BA8C8', dept: ['crm','sales','hr','finance'] },
  task:          { ar: 'مهمة',          en: 'Task',          icon: 'CheckSquare',  color: '#6B8DB5', dept: ['crm','sales','hr','finance'] },
};

// ── Meeting Subtypes ──────────────────────────────────────────────────────
export const MEETING_SUBTYPES = {
  online:    { ar: 'أونلاين',         en: 'Online Meeting' },
  site:      { ar: 'زيارة موقع',      en: 'Site Visit' },
  developer: { ar: 'مقابلة مطور',     en: 'Developer Meeting' },
  office:    { ar: 'في الشركة',       en: 'Office Meeting' },
};

// ── Service Functions ───────────────────────────────────────────────────────
export async function fetchActivities({ entityType, entityId, dept, limit = 50, page, pageSize, role, userId, teamId } = {}) {
  let supaData = [];
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';

  try {
    let query = supabase
      .from('activities')
      .select(`*, users!activities_user_id_fkey (full_name_ar, full_name_en), contacts!fk_act_contact (full_name, phone)`, isServerPaginated ? { count: 'exact' } : {})
      .order('created_at', { ascending: false });

    if (entityId)   query = query.eq(`${entityType}_id`, entityId);
    if (entityType && !entityId) query = query.eq('entity_type', entityType);
    if (dept)       query = query.eq('dept', dept);

    // Role-based filtering
    if (role === 'sales_agent' && userId) {
      query = query.eq('user_id', userId);
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const teamIds = [teamId];
      if (role === 'sales_manager') {
        const { data: children } = await supabase.from('departments').select('id').eq('parent_id', teamId);
        if (children) teamIds.push(...children.map(c => c.id));
      }
      const { data: members } = await supabase.from('users').select('id').in('team_id', teamIds);
      const ids = (members || []).map(m => m.id).filter(Boolean);
      if (ids.length) query = query.in('user_id', ids);
    }

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    } else {
      query = query.limit(limit);
    }

    const { data, error, count } = await query;
    if (error) { /* silent */ }
    if (!error && data?.length) supaData = data.map(a => ({
      ...a,
      user_name_ar: a.users?.full_name_ar || a.user_name_ar,
      user_name_en: a.users?.full_name_en || a.user_name_en,
      entity_name: a.contacts?.full_name || a.entity_name || '',
    }));

    if (isServerPaginated) return { data: supaData, count: count || 0 };
  } catch (err) {
    if (isServerPaginated) return { data: [], count: 0 };
    return [];
  }

  return supaData;
}

export async function createActivity({ type, notes, entityType, entityId, dept, userId, userName_ar, userName_en, status = 'completed', scheduled_date, scheduledActivityId }) {
  // Activity Cycle: if completing a scheduled activity, update it instead of creating duplicate
  if (status === 'completed' && !scheduledActivityId && entityId) {
    try {
      const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('type', type)
        .eq(`${entityType}_id`, entityId)
        .eq('status', 'scheduled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) scheduledActivityId = existing.id;
    } catch {}
  }

  if (scheduledActivityId) {
    // Update existing scheduled activity → completed (no duplicate)
    try {
      const { data, error } = await supabase
        .from('activities')
        .update({ status: 'completed', notes, completed_at: new Date().toISOString() })
        .eq('id', scheduledActivityId)
        .select('*')
        .single();
      if (!error && data) {
        if (entityType === 'contact' && entityId) {
          const SCORE_MAP = { call: 10, whatsapp: 5, email: 3, site_visit: 20, meeting: 15, note: 2 };
          const scoreIncrement = SCORE_MAP[type] || 2;
          try {
            const { data: contact } = await supabase.from('contacts').select('lead_score, first_response_at').eq('id', entityId).maybeSingle();
            const newScore = Math.min((contact?.lead_score || 0) + scoreIncrement, 100);
            const updates = { last_activity_at: new Date().toISOString(), lead_score: newScore };
            if (!contact?.first_response_at && ['call', 'whatsapp', 'email', 'meeting'].includes(type)) {
              updates.first_response_at = new Date().toISOString();
            }
            await supabase.from('contacts').update(updates).eq('id', entityId);
          } catch {
            await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', entityId);
          }
        }
        return data;
      }
    } catch {}
  }

  // Auto-fetch user name from users table if not provided
  let finalNameAr = userName_ar;
  let finalNameEn = userName_en;
  if (!finalNameAr && !finalNameEn && userId) {
    try {
      const { data: userRow } = await supabase.from('users').select('full_name_ar, full_name_en').eq('id', userId).maybeSingle();
      if (userRow) { finalNameAr = userRow.full_name_ar; finalNameEn = userRow.full_name_en; }
    } catch { /* best effort */ }
  }

  const payload = {
    type, notes, dept,
    entity_type: entityType,
    ...(entityId ? { [`${entityType}_id`]: entityId } : {}),
    user_id: userId,
    ...(finalNameAr ? { user_name_ar: finalNameAr } : {}),
    ...(finalNameEn ? { user_name_en: finalNameEn } : {}),
    status,
    ...(scheduled_date ? { scheduled_date } : {}),
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('activities')
      .insert([stripInternalFields(payload)])
      .select('*')
      .single();
    if (error) throw error;

    logCreate('activity', data.id, data);
    if (entityType === 'contact' && entityId) {
      // Update last_activity and recalculate lead_score
      const SCORE_MAP = { call: 10, whatsapp: 5, email: 3, site_visit: 20, meeting: 15, note: 2 };
      const scoreIncrement = SCORE_MAP[type] || 2;
      try {
        const { data: contact } = await supabase.from('contacts').select('lead_score, first_response_at').eq('id', entityId).maybeSingle();
        const newScore = Math.min((contact?.lead_score || 0) + scoreIncrement, 100);
        const updates = { last_activity_at: new Date().toISOString(), lead_score: newScore };
        // Track first response time (time to first activity after lead creation)
        if (!contact?.first_response_at && ['call', 'whatsapp', 'email', 'meeting'].includes(type)) {
          updates.first_response_at = new Date().toISOString();
        }
        await supabase.from('contacts').update(updates).eq('id', entityId);
      } catch (err) { reportError('activitiesService', 'query', err);
        await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', entityId);
      }
    }
    return data;
  } catch (err) { reportError('activitiesService', 'query', err);
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempActivity = { ...payload, id: tempId, user_name_ar: 'أنت', user_name_en: 'You', _offline: true };
    enqueue('activity', 'create', tempActivity);
    return tempActivity;
  }
}

export async function updateActivity(id, updates) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .update(stripInternalFields(updates))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (err) { reportError('activitiesService', 'query', err);
    return { id, ...updates, _offline: true };
  }
}

export async function deleteActivity(id) {
  try {
    const { data: oldData } = await supabase.from('activities').select('*').eq('id', id).single();
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw error;
    logDelete('activity', id, oldData);
  } catch (err) { reportError('activitiesService', 'query', err);
    enqueue('activity', 'delete', { id });
  }
}
