import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';
import { createNotification } from './notificationsService';
import { createTask } from './tasksService';

// ── Frequency types ──────────────────────────────────────────────────
export const FREQUENCIES = {
  daily:     { ar: 'يومي',     en: 'Daily' },
  weekly:    { ar: 'أسبوعي',   en: 'Weekly' },
  monthly:   { ar: 'شهري',     en: 'Monthly' },
  quarterly: { ar: 'ربع سنوي', en: 'Quarterly' },
  yearly:    { ar: 'سنوي',     en: 'Yearly' },
};

export const PRIORITY_OPTIONS = {
  high:   { ar: 'عالية',   en: 'High',   color: '#EF4444' },
  medium: { ar: 'متوسطة',  en: 'Medium', color: '#F97316' },
  low:    { ar: 'منخفضة',  en: 'Low',    color: '#6B8DB5' },
};

export const DAY_NAMES = {
  0: { ar: 'الأحد',     en: 'Sun' },
  1: { ar: 'الإثنين',   en: 'Mon' },
  2: { ar: 'الثلاثاء',  en: 'Tue' },
  3: { ar: 'الأربعاء',  en: 'Wed' },
  4: { ar: 'الخميس',    en: 'Thu' },
  5: { ar: 'الجمعة',    en: 'Fri' },
  6: { ar: 'السبت',     en: 'Sat' },
};

// ── CRUD ─────────────────────────────────────────────────────────────
export async function createRecurringTask(formData) {
  try {
    const { data, error } = await supabase.from('recurring_tasks').insert([{
      title: formData.title || '',
      title_ar: formData.titleAr || '',
      description: formData.description || '',
      frequency: formData.frequency || 'daily',
      interval: formData.interval || 1,
      days_of_week: formData.daysOfWeek || [],
      day_of_month: formData.dayOfMonth || 1,
      time: formData.time || '09:00',
      assignee_name: formData.assigneeName || null,
      priority: formData.priority || 'medium',
      reminder_minutes: formData.reminderMinutes ?? 30,
      entity_type: formData.entity || null,
      entity_name: formData.entityName || '',
      dept: 'sales',
      active: true,
    }]).select('*').single();
    if (error) throw error;
    return data;
  } catch (err) {
    reportError('recurringTaskService', 'createRecurringTask', err);
    throw err;
  }
}

export async function getRecurringTasks() {
  try {
    const { data, error } = await supabase.from('recurring_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Map DB fields to UI fields for backward compat
    return (data || []).map(t => ({
      ...t,
      titleAr: t.title_ar,
      daysOfWeek: t.days_of_week || [],
      dayOfMonth: t.day_of_month,
      assigneeName: t.assignee_name,
      reminderMinutes: t.reminder_minutes,
      entityName: t.entity_name,
      entity: t.entity_type,
      enabled: t.active,
    }));
  } catch (err) {
    reportError('recurringTaskService', 'getRecurringTasks', err);
    return [];
  }
}

export async function updateRecurringTask(id, updates) {
  try {
    const dbUpdates = {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.titleAr !== undefined ? { title_ar: updates.titleAr } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.frequency !== undefined ? { frequency: updates.frequency } : {}),
      ...(updates.interval !== undefined ? { interval: updates.interval } : {}),
      ...(updates.daysOfWeek !== undefined ? { days_of_week: updates.daysOfWeek } : {}),
      ...(updates.dayOfMonth !== undefined ? { day_of_month: updates.dayOfMonth } : {}),
      ...(updates.time !== undefined ? { time: updates.time } : {}),
      ...(updates.assigneeName !== undefined ? { assignee_name: updates.assigneeName } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.reminderMinutes !== undefined ? { reminder_minutes: updates.reminderMinutes } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('recurring_tasks').update(dbUpdates).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  } catch (err) {
    reportError('recurringTaskService', 'updateRecurringTask', err);
    throw err;
  }
}

export async function deleteRecurringTask(id) {
  try {
    const { error } = await supabase.from('recurring_tasks').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    reportError('recurringTaskService', 'deleteRecurringTask', err);
    throw err;
  }
}

export async function toggleRecurringTask(id) {
  try {
    const { data: current } = await supabase.from('recurring_tasks').select('active').eq('id', id).single();
    const { data, error } = await supabase.from('recurring_tasks').update({ active: !current.active, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  } catch (err) {
    reportError('recurringTaskService', 'toggleRecurringTask', err);
    throw err;
  }
}

// ── Instance generation ──────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isDueToday(task) {
  const now = new Date();
  const today = now.getDay();
  const dateOfMonth = now.getDate();
  const month = now.getMonth();

  switch (task.frequency) {
    case 'daily': return true;
    case 'weekly': return (task.days_of_week || task.daysOfWeek || []).includes(today);
    case 'monthly': return dateOfMonth === (task.day_of_month || task.dayOfMonth || 1);
    case 'quarterly': return dateOfMonth === (task.day_of_month || task.dayOfMonth || 1) && (month % 3 === 0);
    case 'yearly': return dateOfMonth === (task.day_of_month || task.dayOfMonth || 1) && month === 0;
    default: return false;
  }
}

export async function generateDueInstances() {
  try {
    const tasks = await getRecurringTasks();
    const today = todayStr();
    let generated = 0;

    for (const task of tasks) {
      if (!task.active && !task.enabled) continue;
      if (!isDueToday(task)) continue;

      // Check if already generated today
      if (task.last_generated_at?.slice(0, 10) === today) continue;

      // Create a real task in the tasks table
      try {
        await createTask({
          title: task.title || task.titleAr || 'Recurring task',
          notes: task.description || '',
          priority: task.priority || 'medium',
          status: 'pending',
          dept: task.dept || 'sales',
          due_date: today + 'T' + (task.time || '09:00') + ':00',
          assigned_to_name: task.assignee_name || task.assigneeName || '',
        });

        // Mark as generated today
        await supabase.from('recurring_tasks').update({ last_generated_at: new Date().toISOString() }).eq('id', task.id);
        generated++;

        // Send notification
        createNotification({
          type: 'reminder',
          title_ar: 'مهمة متكررة مستحقة',
          title_en: 'Recurring Task Due',
          body_ar: task.title_ar || task.title,
          body_en: task.title || task.title_ar,
          for_user_id: task.assignee_id || 'all',
        }).catch(() => {});
      } catch { /* skip this task */ }
    }
    return generated;
  } catch (err) {
    reportError('recurringTaskService', 'generateDueInstances', err);
    return 0;
  }
}

// Legacy compat — these now work via the tasks table
export function getTodayInstances() { return []; }
export function completeInstance() { return null; }
export function skipInstance() { return null; }
export function getTaskInstances() { return []; }

// ── Next due date calculation ────────────────────────────────────────
export function getNextDueDate(task) {
  if (!task || (!task.active && !task.enabled)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (task.frequency) {
    case 'daily': return new Date(today.getTime() + 86400000);
    case 'weekly': {
      const days = (task.days_of_week || task.daysOfWeek || []).sort((a, b) => a - b);
      if (days.length === 0) return null;
      const currentDay = today.getDay();
      for (const d of days) {
        if (d > currentDay) return new Date(today.getTime() + (d - currentDay) * 86400000);
      }
      return new Date(today.getTime() + (7 - currentDay + days[0]) * 86400000);
    }
    case 'monthly': {
      const dom = task.day_of_month || task.dayOfMonth || 1;
      let next = new Date(today.getFullYear(), today.getMonth(), dom);
      if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, dom);
      return next;
    }
    case 'quarterly': {
      const dom = task.day_of_month || task.dayOfMonth || 1;
      const currentQ = Math.floor(today.getMonth() / 3);
      let next = new Date(today.getFullYear(), currentQ * 3, dom);
      if (next <= today) next = new Date(today.getFullYear(), (currentQ + 1) * 3, dom);
      return next;
    }
    case 'yearly': {
      const dom = task.day_of_month || task.dayOfMonth || 1;
      let next = new Date(today.getFullYear(), 0, dom);
      if (next <= today) next = new Date(today.getFullYear() + 1, 0, dom);
      return next;
    }
    default: return null;
  }
}
