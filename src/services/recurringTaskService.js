import { syncToSupabase } from '../utils/supabaseSync';
import { createNotification } from './notificationsService';

const STORAGE_KEY = 'platform_recurring_tasks';
const INSTANCES_KEY = 'platform_task_instances';
const MAX_TASKS = 200;
const MAX_INSTANCES = 500;

// ── localStorage helpers ─────────────────────────────────────────────
function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function save(key, list, max) {
  if (list.length > max) list = list.slice(0, max);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(max / 2));
      try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function uid() {
  return 'rt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

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
export function createRecurringTask({
  title, titleAr, description, frequency, interval = 1,
  daysOfWeek = [], dayOfMonth = 1, time = '09:00',
  assigneeId, assigneeName, entity, entityId, entityName,
  priority = 'medium', reminderMinutes = 30,
}) {
  const task = {
    id: uid(),
    title: title || '',
    titleAr: titleAr || '',
    description: description || '',
    frequency: frequency || 'daily',
    interval: interval || 1,
    daysOfWeek: daysOfWeek || [],
    dayOfMonth: dayOfMonth || 1,
    time: time || '09:00',
    assigneeId: assigneeId || null,
    assigneeName: assigneeName || '',
    entity: entity || null,
    entityId: entityId || null,
    entityName: entityName || '',
    priority: priority || 'medium',
    reminderMinutes: reminderMinutes ?? 30,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const list = load(STORAGE_KEY);
  list.unshift(task);
  save(STORAGE_KEY, list, MAX_TASKS);
  return task;
}

export function getRecurringTasks() {
  const list = load(STORAGE_KEY);
  if (list.length === 0) {
    seedMockTasks();
    return load(STORAGE_KEY);
  }
  return list;
}

export function updateRecurringTask(id, updates) {
  const list = load(STORAGE_KEY);
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  save(STORAGE_KEY, list, MAX_TASKS);
  return list[idx];
}

export function deleteRecurringTask(id) {
  const list = load(STORAGE_KEY).filter(t => t.id !== id);
  save(STORAGE_KEY, list, MAX_TASKS);
}

export function toggleRecurringTask(id) {
  const list = load(STORAGE_KEY);
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return null;
  list[idx].enabled = !list[idx].enabled;
  list[idx].updatedAt = new Date().toISOString();
  save(STORAGE_KEY, list, MAX_TASKS);
  return list[idx];
}

// ── Instance generation ──────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isDueToday(task) {
  const now = new Date();
  const today = now.getDay(); // 0=Sun
  const dateOfMonth = now.getDate();
  const month = now.getMonth(); // 0-based

  switch (task.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return (task.daysOfWeek || []).includes(today);
    case 'monthly':
      return dateOfMonth === (task.dayOfMonth || 1);
    case 'quarterly':
      return dateOfMonth === (task.dayOfMonth || 1) && (month % 3 === 0);
    case 'yearly':
      return dateOfMonth === (task.dayOfMonth || 1) && month === 0;
    default:
      return false;
  }
}

export function generateDueInstances() {
  const tasks = load(STORAGE_KEY);
  const instances = load(INSTANCES_KEY);
  const today = todayStr();
  const newInstances = [];

  for (const task of tasks) {
    if (!task.enabled) continue;
    if (!isDueToday(task)) continue;

    // Check if already generated for today
    const alreadyExists = instances.some(
      inst => inst.recurringTaskId === task.id && inst.dueDate === today
    );
    if (alreadyExists) continue;

    const instance = {
      id: 'ti_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      recurringTaskId: task.id,
      title: task.title,
      titleAr: task.titleAr,
      description: task.description,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      dueDate: today,
      dueTime: task.time || '09:00',
      status: 'pending',
      completedAt: null,
      entity: task.entity,
      entityId: task.entityId,
      entityName: task.entityName,
      priority: task.priority,
      createdAt: new Date().toISOString(),
    };

    newInstances.push(instance);

    // Send notification
    try {
      createNotification({
        type: 'reminder',
        title_ar: 'مهمة متكررة مستحقة',
        title_en: 'Recurring Task Due',
        body_ar: task.titleAr || task.title,
        body_en: task.title || task.titleAr,
        for_user_id: task.assigneeId || 'all',
        entity_type: task.entity || 'task',
        entity_id: task.id,
      });
    } catch { /* ignore */ }
  }

  if (newInstances.length > 0) {
    const updated = [...newInstances, ...instances];
    save(INSTANCES_KEY, updated, MAX_INSTANCES);
  }

  return newInstances;
}

export function getTaskInstances(filters = {}) {
  let instances = load(INSTANCES_KEY);

  if (filters.status) {
    instances = instances.filter(i => i.status === filters.status);
  }
  if (filters.date) {
    instances = instances.filter(i => i.dueDate === filters.date);
  }
  if (filters.recurringTaskId) {
    instances = instances.filter(i => i.recurringTaskId === filters.recurringTaskId);
  }

  // Sort by dueDate desc, then dueTime
  instances.sort((a, b) => {
    const dateComp = (a.dueDate || '').localeCompare(b.dueDate || '');
    if (dateComp !== 0) return -dateComp; // newest first
    return (a.dueTime || '').localeCompare(b.dueTime || '');
  });

  return instances;
}

export function getTodayInstances() {
  return getTaskInstances({ date: todayStr() });
}

export function completeInstance(instanceId) {
  const instances = load(INSTANCES_KEY);
  const idx = instances.findIndex(i => i.id === instanceId);
  if (idx === -1) return null;
  instances[idx].status = 'completed';
  instances[idx].completedAt = new Date().toISOString();
  save(INSTANCES_KEY, instances, MAX_INSTANCES);
  return instances[idx];
}

export function skipInstance(instanceId) {
  const instances = load(INSTANCES_KEY);
  const idx = instances.findIndex(i => i.id === instanceId);
  if (idx === -1) return null;
  instances[idx].status = 'skipped';
  instances[idx].completedAt = new Date().toISOString();
  save(INSTANCES_KEY, instances, MAX_INSTANCES);
  return instances[idx];
}

// ── Next due date calculation ────────────────────────────────────────
export function getNextDueDate(task) {
  if (!task || !task.enabled) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (task.frequency) {
    case 'daily': {
      return new Date(today.getTime() + 86400000);
    }
    case 'weekly': {
      const days = (task.daysOfWeek || []).sort((a, b) => a - b);
      if (days.length === 0) return null;
      const currentDay = today.getDay();
      for (const d of days) {
        if (d > currentDay) {
          const diff = d - currentDay;
          return new Date(today.getTime() + diff * 86400000);
        }
      }
      // wrap to next week
      const diff = 7 - currentDay + days[0];
      return new Date(today.getTime() + diff * 86400000);
    }
    case 'monthly': {
      const dom = task.dayOfMonth || 1;
      let next = new Date(today.getFullYear(), today.getMonth(), dom);
      if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, dom);
      return next;
    }
    case 'quarterly': {
      const dom = task.dayOfMonth || 1;
      const currentQ = Math.floor(today.getMonth() / 3);
      let next = new Date(today.getFullYear(), currentQ * 3, dom);
      if (next <= today) next = new Date(today.getFullYear(), (currentQ + 1) * 3, dom);
      return next;
    }
    case 'yearly': {
      const dom = task.dayOfMonth || 1;
      let next = new Date(today.getFullYear(), 0, dom);
      if (next <= today) next = new Date(today.getFullYear() + 1, 0, dom);
      return next;
    }
    default:
      return null;
  }
}

// ── Seed mock data ───────────────────────────────────────────────────
function seedMockTasks() {
  const now = new Date();
  const seeds = [
    {
      id: 'rt_seed_1',
      title: 'Daily client follow-up calls',
      titleAr: 'متابعة العملاء يوميًا',
      description: 'Call all pending leads from yesterday',
      frequency: 'daily',
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: 1,
      time: '10:00',
      assigneeId: null,
      assigneeName: 'Sara Ali',
      entity: null, entityId: null, entityName: '',
      priority: 'high',
      reminderMinutes: 15,
      enabled: true,
      createdAt: new Date(now - 7 * 86400000).toISOString(),
      updatedAt: new Date(now - 7 * 86400000).toISOString(),
    },
    {
      id: 'rt_seed_2',
      title: 'Weekly sales report',
      titleAr: 'تقرير المبيعات الأسبوعي',
      description: 'Compile and send weekly sales summary',
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [0], // Sunday
      dayOfMonth: 1,
      time: '09:00',
      assigneeId: null,
      assigneeName: 'Ahmed Alaa',
      entity: null, entityId: null, entityName: '',
      priority: 'medium',
      reminderMinutes: 30,
      enabled: true,
      createdAt: new Date(now - 14 * 86400000).toISOString(),
      updatedAt: new Date(now - 14 * 86400000).toISOString(),
    },
    {
      id: 'rt_seed_3',
      title: 'Monthly performance review',
      titleAr: 'مراجعة الأداء الشهرية',
      description: 'Review team KPIs and targets',
      frequency: 'monthly',
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: 1,
      time: '11:00',
      assigneeId: null,
      assigneeName: 'Mohamed Khaled',
      entity: null, entityId: null, entityName: '',
      priority: 'high',
      reminderMinutes: 60,
      enabled: true,
      createdAt: new Date(now - 30 * 86400000).toISOString(),
      updatedAt: new Date(now - 30 * 86400000).toISOString(),
    },
    {
      id: 'rt_seed_4',
      title: 'Quarterly budget review',
      titleAr: 'مراجعة الميزانية ربع السنوية',
      description: 'Analyze spending vs budget allocation',
      frequency: 'quarterly',
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: 15,
      time: '14:00',
      assigneeId: null,
      assigneeName: 'Nora Hassan',
      entity: null, entityId: null, entityName: '',
      priority: 'medium',
      reminderMinutes: 120,
      enabled: true,
      createdAt: new Date(now - 60 * 86400000).toISOString(),
      updatedAt: new Date(now - 60 * 86400000).toISOString(),
    },
    {
      id: 'rt_seed_5',
      title: 'CRM data cleanup',
      titleAr: 'تنظيف بيانات CRM',
      description: 'Remove duplicates and update stale contacts',
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [4], // Thursday
      dayOfMonth: 1,
      time: '16:00',
      assigneeId: null,
      assigneeName: 'Sara Ali',
      entity: null, entityId: null, entityName: '',
      priority: 'low',
      reminderMinutes: 30,
      enabled: true,
      createdAt: new Date(now - 21 * 86400000).toISOString(),
      updatedAt: new Date(now - 21 * 86400000).toISOString(),
    },
  ];

  save(STORAGE_KEY, seeds, MAX_TASKS);
}
