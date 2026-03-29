import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_announcements';
const READ_KEY = 'platform_announcements_read';
const MAX_ANNOUNCEMENTS = 200;

// ── Categories ─────────────────────────────────────────────────────────
export const CATEGORIES = {
  general:     { ar: 'عام',        en: 'General',     color: '#4A7AAB' },
  policy:      { ar: 'سياسات',     en: 'Policy',      color: '#8B5CF6' },
  event:       { ar: 'فعالية',     en: 'Event',       color: '#10B981' },
  maintenance: { ar: 'صيانة',      en: 'Maintenance', color: '#F59E0B' },
  urgent:      { ar: 'عاجل',       en: 'Urgent',      color: '#EF4444' },
};

export const PRIORITIES = {
  low:    { ar: 'منخفض',  en: 'Low',    color: '#94a3b8' },
  normal: { ar: 'عادي',   en: 'Normal', color: '#4A7AAB' },
  high:   { ar: 'مرتفع',  en: 'High',   color: '#F59E0B' },
  urgent: { ar: 'عاجل',   en: 'Urgent', color: '#EF4444' },
};

// ── localStorage helpers ───────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_ANNOUNCEMENTS) list = list.slice(0, MAX_ANNOUNCEMENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_ANNOUNCEMENTS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function loadRead() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; }
}

function saveRead(data) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      // Trim oldest entries
      const keys = Object.keys(data);
      if (keys.length > 100) {
        const trimmed = {};
        keys.slice(-100).forEach(k => { trimmed[k] = data[k]; });
        try { localStorage.setItem(READ_KEY, JSON.stringify(trimmed)); } catch { /* give up */ }
      }
    }
  }
}

// ── Seed mock data ─────────────────────────────────────────────────────
function seedIfEmpty() {
  const list = load();
  if (list.length > 0) return list;

  const now = Date.now();
  const samples = [
    {
      id: 'ann_1',
      title: 'Welcome to Platform ERP v2',
      titleAr: 'مرحباً بكم في بلاتفورم ERP v2',
      body: 'We are excited to announce the launch of our new ERP system. Explore the new features and improved workflows.',
      bodyAr: 'يسعدنا الإعلان عن إطلاق نظام ERP الجديد. اكتشفوا الميزات الجديدة وسير العمل المحسّن.',
      category: 'general',
      priority: 'normal',
      pinned: true,
      expiresAt: null,
      author_id: 'admin@demo.com',
      author_name: 'System Admin',
      created_at: new Date(now - 86400000 * 3).toISOString(),
      updated_at: new Date(now - 86400000 * 3).toISOString(),
    },
    {
      id: 'ann_2',
      title: 'New Leave Policy Update',
      titleAr: 'تحديث سياسة الإجازات',
      body: 'Starting next month, all employees will have 25 annual leave days instead of 21. Please review the updated policy in HR.',
      bodyAr: 'بداية من الشهر القادم، سيحصل جميع الموظفين على 25 يوم إجازة سنوية بدلاً من 21. يرجى مراجعة السياسة المحدثة في الموارد البشرية.',
      category: 'policy',
      priority: 'high',
      pinned: false,
      expiresAt: null,
      author_id: 'hr@demo.com',
      author_name: 'HR Manager',
      created_at: new Date(now - 86400000 * 2).toISOString(),
      updated_at: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: 'ann_3',
      title: 'System Maintenance - March 20',
      titleAr: 'صيانة النظام - 20 مارس',
      body: 'The system will undergo scheduled maintenance on March 20 from 10 PM to 2 AM. Please save your work before this time.',
      bodyAr: 'سيخضع النظام لصيانة مجدولة يوم 20 مارس من الساعة 10 مساءً حتى 2 صباحاً. يرجى حفظ عملكم قبل هذا الوقت.',
      category: 'maintenance',
      priority: 'urgent',
      pinned: true,
      expiresAt: new Date(now + 86400000 * 5).toISOString(),
      author_id: 'admin@demo.com',
      author_name: 'System Admin',
      created_at: new Date(now - 86400000).toISOString(),
      updated_at: new Date(now - 86400000).toISOString(),
    },
    {
      id: 'ann_4',
      title: 'Team Building Event',
      titleAr: 'فعالية بناء الفريق',
      body: 'Join us for a team building event on March 25 at the office rooftop. Food and drinks will be provided. RSVP to HR by March 22.',
      bodyAr: 'انضموا إلينا في فعالية بناء الفريق يوم 25 مارس على سطح المكتب. سيتم توفير الطعام والمشروبات. يرجى التأكيد للموارد البشرية قبل 22 مارس.',
      category: 'event',
      priority: 'normal',
      pinned: false,
      expiresAt: new Date(now + 86400000 * 10).toISOString(),
      author_id: 'hr@demo.com',
      author_name: 'HR Manager',
      created_at: new Date(now - 3600000 * 5).toISOString(),
      updated_at: new Date(now - 3600000 * 5).toISOString(),
    },
  ];

  save(samples);
  return samples;
}

// ── CRUD ───────────────────────────────────────────────────────────────

export async function createAnnouncement({ title, titleAr, body, bodyAr, category, priority, pinned, expiresAt, author }) {
  const announcement = {
    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: title || '',
    titleAr: titleAr || '',
    body: body || '',
    bodyAr: bodyAr || '',
    category: category || 'general',
    priority: priority || 'normal',
    pinned: !!pinned,
    expiresAt: expiresAt || null,
    author_id: author?.id || '',
    author_name: author?.name || 'Unknown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Optimistic localStorage save
  const list = load();
  list.unshift(announcement);
  save(list);

  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert([announcement])
      .select('*')
      .single();
    if (error) throw error;
    if (data) {
      window.dispatchEvent(new CustomEvent('platform_announcement', { detail: data }));
      return data;
    }
  } catch (err) { reportError('announcementService', 'query', err);
    // localStorage already saved
  }

  window.dispatchEvent(new CustomEvent('platform_announcement', { detail: announcement }));
  return announcement;
}

export async function getAnnouncements(filters = {}) {
  try {
    let query = supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.priority) query = query.eq('priority', filters.priority);

    const { data, error } = await query.range(0, 199);
    if (error) throw error;
    if (data) {
      save(data); // sync to localStorage
      let list = data;
      // Filter out expired
      const now = new Date();
      list = list.filter(a => !a.expiresAt || new Date(a.expiresAt) > now);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(a =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.titleAr || '').toLowerCase().includes(q) ||
          (a.body || '').toLowerCase().includes(q) ||
          (a.bodyAr || '').toLowerCase().includes(q)
        );
      }
      return list;
    }
  } catch (err) { reportError('announcementService', 'query', err);
    // fallback to localStorage
  }

  let list = seedIfEmpty();

  // Filter out expired
  const now = new Date();
  list = list.filter(a => !a.expiresAt || new Date(a.expiresAt) > now);

  // Apply filters
  if (filters.category) list = list.filter(a => a.category === filters.category);
  if (filters.priority) list = list.filter(a => a.priority === filters.priority);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.titleAr || '').toLowerCase().includes(q) ||
      (a.body || '').toLowerCase().includes(q) ||
      (a.bodyAr || '').toLowerCase().includes(q)
    );
  }

  // Sort: pinned first, then by created_at desc
  list.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return list;
}

export async function updateAnnouncement(id, updates) {
  // Optimistic localStorage update
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
  save(list);

  try {
    const { data, error } = await supabase
      .from('announcements')
      .update({ ...stripInternalFields(updates), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('announcementService', 'query', err);
    // localStorage already saved
  }
  return list[idx];
}

export async function deleteAnnouncement(id) {
  // Optimistic localStorage delete
  const list = load().filter(a => a.id !== id);
  save(list);
  // Clean read tracking too
  const readData = loadRead();
  delete readData[id];
  saveRead(readData);

  try {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('announcementService', 'query', err);
    // localStorage already saved
  }
}

export async function togglePin(id) {
  // Optimistic localStorage update
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx].pinned = !list[idx].pinned;
  list[idx].updated_at = new Date().toISOString();
  save(list);

  try {
    const { data, error } = await supabase
      .from('announcements')
      .update({ pinned: list[idx].pinned, updated_at: list[idx].updated_at })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('announcementService', 'query', err);
    // localStorage already saved
  }
  return list[idx];
}

// ── Read tracking ──────────────────────────────────────────────────────

export function markAsRead(announcementId, userId) {
  if (!announcementId || !userId) return;
  const data = loadRead();
  if (!data[announcementId]) data[announcementId] = [];
  if (!data[announcementId].includes(userId)) {
    data[announcementId].push(userId);
    saveRead(data);
  }
}

export async function getUnreadCount(userId) {
  if (!userId) return 0;
  const announcements = await getAnnouncements();
  const data = loadRead();
  return announcements.filter(a => !(data[a.id] || []).includes(userId)).length;
}

export function getReadBy(announcementId) {
  const data = loadRead();
  return data[announcementId] || [];
}

export function isRead(announcementId, userId) {
  if (!userId) return false;
  const data = loadRead();
  return (data[announcementId] || []).includes(userId);
}
