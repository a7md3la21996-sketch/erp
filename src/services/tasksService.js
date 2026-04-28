import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { applyRoleFilter } from '../utils/roleFilter';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import { requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

// Retry wrapper for idempotent Supabase calls (UPDATE/DELETE/SELECT). Never
// for INSERT — dropped response after successful write would duplicate.
const rq = (fn, label) => retryWithBackoff(fn, { label });


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

export async function fetchTasks({ contactId, dept, status, priority, page, pageSize, role, userId, teamId, search, sortBy, agentName, dueDateFrom, dueDateTo, overdueOnly } = {}) {
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';
  try {
    // Map sortBy to Supabase column + direction
    const SORT_MAP = {
      due_date_asc:    { column: 'due_date',   ascending: true },
      due_date_desc:   { column: 'due_date',   ascending: false },
      created_at_desc: { column: 'created_at', ascending: false },
      created_at_asc:  { column: 'created_at', ascending: true },
      priority_desc:   { column: 'priority',   ascending: true }, // high=0, low=2
    };
    const sort = SORT_MAP[sortBy] || SORT_MAP.due_date_asc;
    let query = supabase.from('tasks').select('*', isServerPaginated ? { count: 'exact' } : {}).order(sort.column, { ascending: sort.ascending });
    if (contactId) query = query.eq('contact_id', contactId);
    if (dept)      query = query.eq('dept', dept);
    if (status)    query = query.eq('status', status);
    if (priority)  query = query.eq('priority', priority);
    if (search) {
      const s = search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, '');
      if (s.length > 0) query = query.or(`title.ilike.%${s}%,contact_name.ilike.%${s}%,notes.ilike.%${s}%`);
    }
    if (agentName) query = query.or(`assigned_to_name_en.eq.${agentName},assigned_to_name_ar.eq.${agentName}`);
    if (dueDateFrom) query = query.gte('due_date', dueDateFrom);
    if (dueDateTo) query = query.lte('due_date', dueDateTo);
    if (overdueOnly) query = query.lt('due_date', new Date().toISOString()).eq('status', 'pending');

    // Role-based filtering (skip if fetching by contactId)
    if (!contactId) {
      if (role === 'sales_agent' && userId) {
        const { data: agentUser } = await supabase.from('users').select('full_name_en').eq('id', userId).maybeSingle();
        if (agentUser?.full_name_en) {
          query = query.or(`assigned_to.eq.${userId},assigned_to_name_en.eq.${agentUser.full_name_en}`);
        } else {
          query = query.eq('assigned_to', userId);
        }
      } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
        const ids = await getTeamMemberIds(role, teamId);
        if (ids.length) query = query.in('assigned_to', ids);
      }
    }

    const enrich = async (tasks) => {
      if (!tasks?.length) return tasks || [];
      // Fetch contact names + phones for tasks that have contact_id
      const withContactId = tasks.filter(t => t.contact_id);
      if (withContactId.length) {
        const ids = [...new Set(withContactId.map(t => t.contact_id))];
        try {
          const { data: contacts } = await supabase.from('contacts').select('id, full_name, phone').in('id', ids);
          if (contacts) {
            const map = {};
            contacts.forEach(c => { map[c.id] = c; });
            return tasks.map(t => ({
              ...t,
              contact_name: t.contact_name || map[t.contact_id]?.full_name || null,
              contact_phone: map[t.contact_id]?.phone || null,
            }));
          }
        } catch { /* ignore */ }
      }
      return tasks;
    };

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
      const { data, error, count } = await rq(() => query, 'fetchTasks.paginated');
      if (error) { reportError('tasksService', 'fetchTasks', error); return { data: [], count: 0 }; }
      return { data: await enrich(data), count: count || 0 };
    }

    query = query.range(0, 999);
    const { data, error } = await rq(() => query, 'fetchTasks.full');
    if (error) { reportError('tasksService', 'fetchTasks', error); return []; }
    return await enrich(data);
  } catch (err) { reportError('tasksService', 'fetchTasks', err); return isServerPaginated ? { data: [], count: 0 } : []; }
}

export async function createTask(data) {
  // TASKS_VIEW_OWN is granted to every working role today, so the guard
  // mainly catches a future custom role that forgot the permission. The
  // bigger value is below: we drop client-supplied actor/identity fields
  // so a tampered call can't forge created_by.
  requirePerm(P.TASKS_VIEW_OWN, 'Not allowed to create tasks');
  // Drop fields the client should never set directly. created_by is
  // stamped by the DB (or by the auditService) — clients passing it
  // would let one user create tasks "as" another.
  const safeData = { ...data };
  delete safeData.created_by;
  delete safeData.created_by_name;
  try {
    const { data: d, error } = await supabase.from('tasks').insert([{ ...stripInternalFields(safeData), created_at: new Date().toISOString() }]).select('*').single();
    if (error) throw error;
    logCreate('task', d.id, d);
    return d;
  } catch (err) {
    reportError('tasksService', 'createTask', err);
    throw err;
  }
}

export async function updateTask(id, updates) {
  requirePerm(P.TASKS_VIEW_OWN, 'Not allowed to edit tasks');
  // Don't let updates change the original creator. assigned_to changes are
  // legitimate (reassign), but created_by is the historical owner record.
  const safeUpdates = { ...updates };
  delete safeUpdates.created_by;
  delete safeUpdates.created_by_name;
  try {
    const { data: oldData } = await rq(() => supabase.from('tasks').select('*').eq('id', id).single(), 'updateTask.read');
    const { data, error } = await rq(() => supabase.from('tasks').update(safeUpdates).eq('id', id).select('*').single(), 'updateTask.write');
    if (error) throw error;
    logUpdate('task', id, oldData, data);
    return data;
  } catch (err) {
    reportError('tasksService', 'updateTask', err);
    throw err;
  }
}

export async function deleteTask(id) {
  requirePerm(P.TASKS_VIEW_OWN, 'Not allowed to delete tasks');
  try {
    const { data: oldData } = await rq(() => supabase.from('tasks').select('*').eq('id', id).single(), 'deleteTask.read');
    await rq(() => supabase.from('tasks').delete().eq('id', id), 'deleteTask.write');
    logDelete('task', id, oldData);
  } catch (err) {
    reportError('tasksService', 'deleteTask', err);
    throw err;
  }
}
