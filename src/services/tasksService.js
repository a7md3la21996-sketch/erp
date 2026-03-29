import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { enqueue } from '../lib/offlineQueue';

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

const SEED_TASKS = [
  { id: 't1', title: 'متابعة أحمد محمد بخصوص الوحدة', type: 'followup', priority: 'high', status: 'pending', contact_id: '1', contact_name: 'أحمد محمد السيد', assigned_to_name_ar: 'سارة علي', assigned_to_name_en: 'Sara Ali', due_date: new Date(Date.now() + 2*60*60*1000).toISOString(), notes: 'مهتم بوحدة في الشيخ زايد', dept: 'crm', created_at: new Date(Date.now() - 60*60*1000).toISOString() },
  { id: 't2', title: 'إرسال عرض سعر لمنى عبدالله', type: 'email', priority: 'high', status: 'pending', contact_id: '2', contact_name: 'منى عبدالله حسن', assigned_to_name_ar: 'محمد خالد', assigned_to_name_en: 'Mohamed Khaled', due_date: new Date(Date.now() + 4*60*60*1000).toISOString(), notes: '', dept: 'crm', created_at: new Date(Date.now() - 30*60*1000).toISOString() },
  { id: 't3', title: 'اجتماع مراجعة أداء الفريق', type: 'meeting', priority: 'medium', status: 'in_progress', contact_id: null, contact_name: null, assigned_to_name_ar: 'أحمد علاء', assigned_to_name_en: 'Ahmed Alaa', due_date: new Date(Date.now() + 24*60*60*1000).toISOString(), notes: 'مراجعة شهرية', dept: 'hr', created_at: new Date(Date.now() - 2*60*60*1000).toISOString() },
  { id: 't4', title: 'الاتصال بطارق جمال لتأكيد الموعد', type: 'call', priority: 'high', status: 'pending', contact_id: '7', contact_name: 'طارق جمال حلمي', assigned_to_name_ar: 'ريم أحمد', assigned_to_name_en: 'Reem Ahmed', due_date: new Date(Date.now() + 1*60*60*1000).toISOString(), notes: '', dept: 'crm', created_at: new Date(Date.now() - 45*60*1000).toISOString() },
  { id: 't5', title: 'مراجعة عقد إيمان حسين', type: 'general', priority: 'medium', status: 'done', contact_id: '8', contact_name: 'إيمان حسين فوزي', assigned_to_name_ar: 'علي حسن', assigned_to_name_en: 'Ali Hassan', due_date: new Date(Date.now() - 2*60*60*1000).toISOString(), notes: 'تم المراجعة', dept: 'crm', created_at: new Date(Date.now() - 5*60*60*1000).toISOString() },
  { id: 't6', title: 'واتساب رانيا وليد متابعة التعاقد', type: 'whatsapp', priority: 'low', status: 'pending', contact_id: '10', contact_name: 'رانيا وليد زكي', assigned_to_name_ar: 'محمد خالد', assigned_to_name_en: 'Mohamed Khaled', due_date: new Date(Date.now() + 48*60*60*1000).toISOString(), notes: '', dept: 'crm', created_at: new Date(Date.now() - 3*60*60*1000).toISOString() },
];

// ── localStorage helpers ──
function getLocalTasks() {
  try {
    const saved = localStorage.getItem('platform_tasks');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  localStorage.setItem('platform_tasks', JSON.stringify(SEED_TASKS));
  return [...SEED_TASKS];
}
function saveLocalTasks(tasks) {
  try { localStorage.setItem('platform_tasks', JSON.stringify(tasks)); } catch { /* ignore */ }
}

export async function fetchTasks({ contactId, dept, status } = {}) {
  let supaData = [];
  try {
    let query = supabase.from('tasks').select('*').order('due_date', { ascending: true }).range(0, 499);
    if (contactId) query = query.eq('contact_id', contactId);
    if (dept)      query = query.eq('dept', dept);
    if (status)    query = query.eq('status', status);
    const { data, error } = await query;
    if (!error && data?.length) supaData = data;
  } catch { /* ignore */ }

  // Always merge with localStorage
  let local = getLocalTasks();
  if (contactId) local = local.filter(t => String(t.contact_id) === String(contactId));
  if (dept)      local = local.filter(t => t.dept === dept);
  if (status)    local = local.filter(t => t.status === status);
  local = local.filter(t => !supaData.some(s => String(s.id) === String(t.id)));
  return [...supaData, ...local].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
}

export async function createTask(data) {
  const mock = { ...data, id: Date.now().toString(), created_at: new Date().toISOString() };

  // Always save to localStorage first
  const all = getLocalTasks();
  all.unshift(mock);
  saveLocalTasks(all);

  // Try Supabase in background
  try {
    const { data: d, error } = await supabase.from('tasks').insert([{ ...stripInternalFields(data), created_at: new Date().toISOString() }]).select('*').single();
    if (!error && d) {
      logCreate('task', d.id, d);
      return d;
    }
  } catch { /* ignore */ }

  return mock;
}

export async function updateTask(id, updates) {
  try {
    const { data: oldData } = await supabase.from('tasks').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select('*').single();
    if (error) throw error;
    logUpdate('task', id, oldData, data);
    return data;
  } catch (err) { reportError('tasksService', 'query', err);
    if (!navigator.onLine) {
      enqueue('task', 'update', { _id: id, ...updates });
      return { id, ...updates, _offline: true };
    }
    const all = getLocalTasks();
    const idx = all.findIndex(t => String(t.id) === String(id));
    if (idx > -1) Object.assign(all[idx], updates);
    saveLocalTasks(all);
    return idx > -1 ? all[idx] : { id, ...updates };
  }
}

export async function deleteTask(id) {
  try {
    const { data: oldData } = await supabase.from('tasks').select('*').eq('id', id).single();
    await supabase.from('tasks').delete().eq('id', id);
    logDelete('task', id, oldData);
  } catch (err) { reportError('tasksService', 'query', err);
    if (!navigator.onLine) {
      enqueue('task', 'delete', { id });
      return;
    }
    const all = getLocalTasks();
    const filtered = all.filter(t => String(t.id) !== String(id));
    saveLocalTasks(filtered);
  }
}
