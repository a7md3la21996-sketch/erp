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

const MOCK_TASKS = [
  { id: 't1', title: 'متابعة أحمد محمد بخصوص الوحدة', type: 'followup', priority: 'high', status: 'pending', contact_id: '1', contact_name: 'أحمد محمد السيد', assigned_to_name_ar: 'سارة علي', assigned_to_name_en: 'Sara Ali', due_date: new Date(Date.now() + 2*60*60*1000).toISOString(), notes: 'مهتم بوحدة في الشيخ زايد', dept: 'crm', created_at: new Date(Date.now() - 60*60*1000).toISOString() },
  { id: 't2', title: 'إرسال عرض سعر لمنى عبدالله', type: 'email', priority: 'high', status: 'pending', contact_id: '2', contact_name: 'منى عبدالله حسن', assigned_to_name_ar: 'محمد خالد', assigned_to_name_en: 'Mohamed Khaled', due_date: new Date(Date.now() + 4*60*60*1000).toISOString(), notes: '', dept: 'crm', created_at: new Date(Date.now() - 30*60*1000).toISOString() },
  { id: 't3', title: 'اجتماع مراجعة أداء الفريق', type: 'meeting', priority: 'medium', status: 'in_progress', contact_id: null, contact_name: null, assigned_to_name_ar: 'أحمد علاء', assigned_to_name_en: 'Ahmed Alaa', due_date: new Date(Date.now() + 24*60*60*1000).toISOString(), notes: 'مراجعة شهرية', dept: 'hr', created_at: new Date(Date.now() - 2*60*60*1000).toISOString() },
  { id: 't4', title: 'الاتصال بطارق جمال لتأكيد الموعد', type: 'call', priority: 'high', status: 'pending', contact_id: '7', contact_name: 'طارق جمال حلمي', assigned_to_name_ar: 'ريم أحمد', assigned_to_name_en: 'Reem Ahmed', due_date: new Date(Date.now() + 1*60*60*1000).toISOString(), notes: '', dept: 'crm', created_at: new Date(Date.now() - 45*60*1000).toISOString() },
  { id: 't5', title: 'مراجعة عقد إيمان حسين', type: 'general', priority: 'medium', status: 'done', contact_id: '8', contact_name: 'إيمان حسين فوزي', assigned_to_name_ar: 'علي حسن', assigned_to_name_en: 'Ali Hassan', due_date: new Date(Date.now() - 2*60*60*1000).toISOString(), notes: 'تم المراجعة', dept: 'crm', created_at: new Date(Date.now() - 5*60*60*1000).toISOString() },
  { id: 't6', title: 'واتساب رانيا وليد متابعة التعاقد', type: 'whatsapp', priority: 'low', status: 'pending', contact_id: '10', contact_name: 'رانيا وليد زكي', assigned_to_name_ar: 'محمد خالد', assigned_to_name_en: 'Mohamed Khaled', due_date: new Date(Date.now() + 48*60*60*1000).toISOString(), notes: '', dept: 'crm', created_at: new Date(Date.now() - 3*60*60*1000).toISOString() },
];

export async function fetchTasks({ contactId, dept, status } = {}) {
  try {
    let query = supabase.from('tasks').select('*').order('due_date', { ascending: true });
    if (contactId) query = query.eq('contact_id', contactId);
    if (dept)      query = query.eq('dept', dept);
    if (status)    query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    let r = [...MOCK_TASKS];
    if (contactId) r = r.filter(t => t.contact_id === contactId);
    if (dept)      r = r.filter(t => t.dept === dept);
    if (status)    r = r.filter(t => t.status === status);
    return r.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }
}

export async function createTask(data) {
  try {
    const { data: d, error } = await supabase.from('tasks').insert([{ ...data, created_at: new Date().toISOString() }]).select('*').single();
    if (error) throw error;
    logCreate('task', d.id, d);
    return d;
  } catch {
    if (!navigator.onLine) {
      const tempId = 'temp_' + Date.now();
      const tempTask = { ...data, id: tempId, created_at: new Date().toISOString(), _offline: true };
      enqueue('task', 'create', tempTask);
      return tempTask;
    }
    const mock = { ...data, id: Date.now().toString(), created_at: new Date().toISOString() };
    MOCK_TASKS.unshift(mock);
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
  } catch {
    if (!navigator.onLine) {
      enqueue('task', 'update', { _id: id, ...updates });
      return { id, ...updates, _offline: true };
    }
    const idx = MOCK_TASKS.findIndex(t => t.id === id);
    if (idx > -1) Object.assign(MOCK_TASKS[idx], updates);
    return MOCK_TASKS[idx];
  }
}

export async function deleteTask(id) {
  try {
    const { data: oldData } = await supabase.from('tasks').select('*').eq('id', id).single();
    await supabase.from('tasks').delete().eq('id', id);
    logDelete('task', id, oldData);
  } catch {
    if (!navigator.onLine) {
      enqueue('task', 'delete', { id });
      return;
    }
    const idx = MOCK_TASKS.findIndex(t => t.id === id); if (idx > -1) MOCK_TASKS.splice(idx, 1);
  }
}
