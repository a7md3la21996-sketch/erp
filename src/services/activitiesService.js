import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import supabase from '../lib/supabase';
import { logCreate, logDelete } from './auditService';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';
import { applyRoleFilter } from '../utils/roleFilter';
import { incrementAgentScore } from './contactsService';
import { retryWithBackoff } from '../utils/retryWithBackoff';

// Retry wrapper for idempotent Supabase calls (UPDATE/DELETE/SELECT). Do not
// use for INSERT — retrying a request whose response was dropped after a
// successful write would create duplicates.
const rq = (fn, label) => retryWithBackoff(fn, { label });

// ── Score map for lead scoring ──
const SCORE_MAP = { call: 10, whatsapp: 5, email: 3, site_visit: 20, meeting: 15, note: 2 };

// ── Activity Types ─────────────────────────────────────────────────────────
export const ACTIVITY_TYPES = {
  call:          { ar: 'مكالمة',        en: 'Call',          icon: 'Phone',        color: '#4A7AAB', dept: ['sales','finance'] },
  whatsapp:      { ar: 'واتساب',        en: 'WhatsApp',      icon: 'MessageCircle',color: '#2B4C6F', dept: ['sales'] },
  email:         { ar: 'إيميل',         en: 'Email',         icon: 'Mail',         color: '#6B8DB5', dept: ['sales','hr','finance'] },
  meeting:       { ar: 'مقابلة',        en: 'Meeting',       icon: 'Users',        color: '#2B4C6F', dept: ['sales','hr','finance'] },
  note:          { ar: 'ملاحظة',        en: 'Note',          icon: 'FileText',     color: '#8BA8C8', dept: ['sales','hr','finance'] },
  interview:     { ar: 'مقابلة',        en: 'Interview',     icon: 'UserCheck',    color: '#4A7AAB', dept: ['hr'] },
  warning:       { ar: 'إنذار',         en: 'Warning',       icon: 'AlertTriangle',color: '#EF4444', dept: ['hr'] },
  evaluation:    { ar: 'تقييم',         en: 'Evaluation',    icon: 'Star',         color: '#6B8DB5', dept: ['hr'] },
  invoice:       { ar: 'فاتورة',        en: 'Invoice',       icon: 'Receipt',      color: '#4A7AAB', dept: ['finance'] },
  payment:       { ar: 'دفعة',          en: 'Payment',       icon: 'Banknote',     color: '#2B4C6F', dept: ['finance'] },
};

// ── Meeting Subtypes ──────────────────────────────────────────────────────
export const MEETING_SUBTYPES = {
  online:    { ar: 'أونلاين',         en: 'Online Meeting' },
  site:      { ar: 'زيارة موقع',      en: 'Site Visit' },
  developer: { ar: 'مقابلة مطور',     en: 'Developer Meeting' },
  office:    { ar: 'في الشركة',       en: 'Office Meeting' },
};

// ── Service Functions ───────────────────────────────────────────────────────
export async function fetchActivities({ entityType, entityId, dept, limit = 50, page, pageSize, role, userId, teamId, search, type, agentName, dateFrom } = {}) {
  let supaData = [];
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';

  try {
    let query = supabase
      .from('activities')
      .select('*', isServerPaginated ? { count: 'exact' } : {})
      .order('created_at', { ascending: false });

    // Exclude internal types from activities list (status_change, task, reassignment)
    query = query.not('type', 'in', '("status_change","task","reassignment")');
    if (entityId)   query = query.eq(`${entityType}_id`, entityId);
    if (entityType && !entityId) query = query.eq('entity_type', entityType);
    if (dept)       query = query.eq('dept', dept);
    if (type)       query = query.eq('type', type);
    if (dateFrom)   query = query.gte('created_at', dateFrom);
    if (search) {
      const s = search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, '');
      if (s.length > 0) query = query.or(`notes.ilike.%${s}%,description.ilike.%${s}%,user_name_en.ilike.%${s}%,user_name_ar.ilike.%${s}%,entity_name.ilike.%${s}%`);
    }
    if (agentName && role !== 'sales_agent')  query = query.or(`user_name_en.eq.${agentName},user_name_ar.eq.${agentName}`);

    // Role-based filtering (skip if no role - don't show all data)
    if (!role || !userId) return isServerPaginated ? { data: [], count: 0 } : [];
    if (!agentName || role === 'sales_agent') {
      if (role === 'sales_agent' && userId) {
        const { data: agentUser } = await supabase.from('users').select('full_name_en').eq('id', userId).maybeSingle();
        if (agentUser?.full_name_en) {
          query = query.or(`user_name_en.eq.${agentUser.full_name_en},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_id', userId);
        }
      } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
        const ids = await getTeamMemberIds(role, teamId);
        const names = await getTeamMemberNames(role, teamId);
        if (names.length) {
          const nameConds = names.map(n => `user_name_en.eq.${n}`).join(',');
          const idConds = ids.map(id => `user_id.eq.${id}`).join(',');
          query = query.or(`${nameConds},${idConds}`);
        }
      }
    }

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    } else {
      query = query.limit(limit);
    }

    const { data, error, count } = await rq(() => query, 'fetchActivities');
    if (error) { reportError('activitiesService', 'fetchActivities', error); }
    if (!error && data?.length) {
      // Fetch contact names for activities that have contact_id
      const contactIds = [...new Set(data.filter(a => a.contact_id).map(a => a.contact_id))];
      let contactMap = {};
      if (contactIds.length) {
        try {
          const { data: contacts } = await supabase.from('contacts').select('id, full_name').in('id', contactIds);
          if (contacts) contacts.forEach(c => { contactMap[c.id] = c.full_name; });
        } catch { /* ignore */ }
      }
      supaData = data.map(a => ({
        ...a,
        user_name_ar: a.users?.full_name_ar || a.user_name_ar,
        user_name_en: a.users?.full_name_en || a.user_name_en,
        entity_name: contactMap[a.contact_id] || a.entity_name || '',
      }));
    }

    if (isServerPaginated) return { data: supaData, count: count || 0 };
  } catch (err) {
    reportError('activitiesService', 'fetchActivities', err);
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
    } catch (err) { reportError('activitiesService', 'createActivity.findScheduled', err); }
  }

  if (scheduledActivityId) {
    // Update existing scheduled activity → completed (no duplicate)
    try {
      const { data, error } = await rq(() => supabase
        .from('activities')
        .update({ status: 'completed', notes, completed_at: new Date().toISOString() })
        .eq('id', scheduledActivityId)
        .select('*')
        .single(), 'createActivity.completeScheduled');
      if (!error && data) {
        if (entityType === 'contact' && entityId) {
          const scoreIncrement = SCORE_MAP[type] || 2;
          const agentName = userName_en || userName_ar || null;
          try {
            const { data: contact } = await supabase.from('contacts').select('first_response_at').eq('id', entityId).maybeSingle();
            const updates = { last_activity_at: new Date().toISOString() };
            if (!contact?.first_response_at && ['call', 'whatsapp', 'email', 'meeting'].includes(type)) {
              updates.first_response_at = new Date().toISOString();
            }
            await supabase.from('contacts').update(updates).eq('id', entityId);
            if (agentName) await incrementAgentScore(entityId, agentName, scoreIncrement);
          } catch (err) {
            reportError('activitiesService', 'createActivity.updateScore', err);
            await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', entityId);
          }
        }
        return data;
      }
    } catch (err) { reportError('activitiesService', 'createActivity.completeScheduled', err); }
  }

  // Auto-fetch user name from users table if not provided
  let finalNameAr = userName_ar;
  let finalNameEn = userName_en;
  if (!finalNameAr && !finalNameEn && userId) {
    try {
      const { data: userRow } = await supabase.from('users').select('full_name_ar, full_name_en').eq('id', userId).maybeSingle();
      if (userRow) { finalNameAr = userRow.full_name_ar; finalNameEn = userRow.full_name_en; }
    } catch (err) { reportError('activitiesService', 'createActivity.fetchUserName', err); }
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
      const SCORE_MAP = { call: 10, whatsapp: 5, email: 3, site_visit: 20, meeting: 15, note: 2 };
      const scoreIncrement = SCORE_MAP[type] || 2;
      const agentName = finalNameEn || finalNameAr || null;
      try {
        const { data: contact } = await supabase.from('contacts').select('first_response_at').eq('id', entityId).maybeSingle();
        const updates = { last_activity_at: new Date().toISOString() };
        if (!contact?.first_response_at && ['call', 'whatsapp', 'email', 'meeting'].includes(type)) {
          updates.first_response_at = new Date().toISOString();
        }
        await supabase.from('contacts').update(updates).eq('id', entityId);
        if (agentName) await incrementAgentScore(entityId, agentName, scoreIncrement);
        // Auto-complete matching pending tasks. Fire-and-forget but
        // failures should be visible in monitoring, not silently dropped.
        if (userId && type) {
          const matchTypes = type === 'call' ? ['call', 'followup'] : [type];
          supabase.from('tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('contact_id', entityId)
            .eq('assigned_to', userId)
            .eq('status', 'pending')
            .in('type', matchTypes)
            .lte('due_date', new Date().toISOString())
            .then(({ error }) => { if (error) reportError('activitiesService', 'autoCompleteTasks', error); })
            .catch(err => reportError('activitiesService', 'autoCompleteTasks', err));
        }
      } catch (err) { reportError('activitiesService', 'query', err);
        await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', entityId);
      }
    }
    return data;
  } catch (err) { reportError('activitiesService', 'query', err);
    throw err;
  }
}

export async function updateActivity(id, updates) {
  try {
    const { data, error } = await rq(() => supabase
      .from('activities')
      .update(stripInternalFields(updates))
      .eq('id', id)
      .select('*')
      .single(), 'updateActivity');
    if (error) throw error;
    return data;
  } catch (err) { reportError('activitiesService', 'query', err);
    throw err;
  }
}

export async function deleteActivity(id) {
  try {
    const { data: oldData } = await rq(() => supabase.from('activities').select('*').eq('id', id).single(), 'deleteActivity.read');
    const { error } = await rq(() => supabase.from('activities').delete().eq('id', id), 'deleteActivity.write');
    if (error) throw error;
    logDelete('activity', id, oldData);
  } catch (err) { reportError('activitiesService', 'query', err);
    throw err;
  }
}
