import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { enqueue } from '../lib/offlineQueue';

// ── Team cache ────────────────────────────────────────────────────────────
const _teamCache = { key: null, ids: null, ts: 0 };
async function getTeamMemberIds(role, teamId) {
  if (!teamId) return [];
  const ck = `${role}:${teamId}`;
  if (_teamCache.key === ck && _teamCache.ids && Date.now() - _teamCache.ts < 60000) return _teamCache.ids;
  const teamIds = [teamId];
  if (role === 'sales_manager') {
    const { data: ch } = await supabase.from('departments').select('id').eq('parent_id', teamId);
    if (ch) teamIds.push(...ch.map(c => c.id));
  }
  const { data: members } = await supabase.from('users').select('id').in('team_id', teamIds);
  const ids = (members || []).map(m => m.id).filter(Boolean);
  _teamCache.key = ck; _teamCache.ids = ids; _teamCache.ts = Date.now();
  return ids;
}

export const TASK_PRIORITIES = {
  high:   { ar: 'عالية',   en: 'High',   color: '#EF4444' },
  medium: { ar: 'متوسطة',  en: 'Medium', color: '#F97316' },
  low:    { ar: 'منخفضة',  en: 'Low',    color: '#6B8DB5' },
};

export const TASK_STATUSES = {
  pending:     { ar: 'معلقة',   en: 'Pending',     color: '#8BA8C8' },
  in_progress: { ar: 'جارية',   en: 'In Progress', color: '#4A7AAB' },
  done:        { ar: 'مكتملة',  en: 'Done',        color: '#2B4C6F' },
  cancelled:   { ar: 'ملغية',   en: 'Cancelled',   color: '#EF4444' },
};

export const TASK_TYPES = {
  followup:  { ar: 'متابعة عميل', en: 'Follow-up',  icon: 'Phone'        },
  call:      { ar: 'مكالمة',      en: 'Call',        icon: 'PhoneCall'    },
  meeting:   { ar: 'اجتماع',      en: 'Meeting',     icon: 'Users'        },
  email:     { ar: 'إيميل',       en: 'Email',       icon: 'Mail'         },
  whatsapp:  { ar: 'واتساب',      en: 'WhatsApp',    icon: 'MessageCircle'},
  general:   { ar: 'عامة',        en: 'General',     icon: 'CheckSquare'  },
};

export async function fetchTasks({ contactId, dept, status, page, pageSize, role, userId, teamId } = {}) {
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';
  try {
    let query = supabase.from('tasks').select('*', isServerPaginated ? { count: 'exact' } : {}).order('due_date', { ascending: true });
    if (contactId) query = query.eq('contact_id', contactId);
    if (dept)      query = query.eq('dept', dept);
    if (status)    query = query.eq('status', status);

    // Role-based filtering
    if (role === 'sales_agent' && userId) {
      query = query.eq('assigned_to', userId);
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const ids = await getTeamMemberIds(role, teamId);
      if (ids.length) query = query.in('assigned_to', ids);
    }

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
      const { data, error, count } = await query;
      if (error) return { data: [], count: 0 };
      return { data: data || [], count: count || 0 };
    }

    query = query.range(0, 999);
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch { return isServerPaginated ? { data: [], count: 0 } : []; }
}

export async function createTask(data) {
  // Try Supabase FIRST — this is the source of truth
  try {
    const { data: d, error } = await supabase.from('tasks').insert([{ ...stripInternalFields(data), created_at: new Date().toISOString() }]).select('*').single();
    if (error) throw error;
    logCreate('task', d.id, d);
    return d;
  } catch (err) {
    reportError('tasksService', 'createTask', err);
    const mock = { ...data, id: 'temp_' + Date.now(), created_at: new Date().toISOString(), _offline: true };
    enqueue('task', 'create', mock);
    return mock;
  }
}

export async function updateTask(id, updates) {
  try {
    const { data: oldData } = await supabase.from('tasks').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select('*').single();
    if (error) throw error;
    logUpdate('task', id, oldData, data);
    return data;
  } catch (err) {
    reportError('tasksService', 'updateTask', err);
    enqueue('task', 'update', { _id: id, ...updates });
    return { id, ...updates, _offline: true };
  }
}

export async function deleteTask(id) {
  try {
    const { data: oldData } = await supabase.from('tasks').select('*').eq('id', id).single();
    await supabase.from('tasks').delete().eq('id', id);
    logDelete('task', id, oldData);
  } catch (err) {
    reportError('tasksService', 'deleteTask', err);
    enqueue('task', 'delete', { id });
  }
}
