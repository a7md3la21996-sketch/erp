import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';

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

  const { data, error } = await supabase
    .from('announcements')
    .insert([stripInternalFields(announcement)])
    .select('*')
    .single();
  if (error) {
    reportError('announcementService', 'createAnnouncement', error);
    throw error;
  }

  const result = data || announcement;
  window.dispatchEvent(new CustomEvent('platform_announcement', { detail: result }));
  return result;
}

export async function getAnnouncements(filters = {}) {
  let query = supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.priority) query = query.eq('priority', filters.priority);

  const { data, error } = await query.range(0, 199);
  if (error) {
    reportError('announcementService', 'getAnnouncements', error);
    throw error;
  }

  let list = data || [];
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

export async function updateAnnouncement(id, updates) {
  const { data, error } = await supabase
    .from('announcements')
    .update({ ...stripInternalFields(updates), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    reportError('announcementService', 'updateAnnouncement', error);
    throw error;
  }
  return data;
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) {
    reportError('announcementService', 'deleteAnnouncement', error);
    throw error;
  }

  // Clean read tracking too
  try {
    const { data: readConfig } = await supabase.from('system_config').select('value').eq('key', 'announcements_read').maybeSingle();
    if (readConfig?.value) {
      const readData = readConfig.value;
      delete readData[id];
      await supabase.from('system_config').upsert({ key: 'announcements_read', value: readData, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
  } catch (err) {
    reportError('announcementService', 'deleteAnnouncement:readCleanup', err);
  }
}

export async function togglePin(id) {
  // Fetch current state
  const { data: current, error: fetchErr } = await supabase
    .from('announcements')
    .select('pinned')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) {
    reportError('announcementService', 'togglePin', fetchErr);
    throw fetchErr;
  }
  if (!current) return null;

  const { data, error } = await supabase
    .from('announcements')
    .update({ pinned: !current.pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    reportError('announcementService', 'togglePin', error);
    throw error;
  }
  return data;
}

// ── Read tracking (via system_config with in-memory cache) ───────────
// Cache keeps sync callers working; refreshReadCache() hydrates from Supabase.

let _readCache = {};
let _readCacheLoaded = false;

export async function refreshReadCache() {
  try {
    const { data } = await supabase.from('system_config').select('value').eq('key', 'announcements_read').maybeSingle();
    _readCache = data?.value || {};
    _readCacheLoaded = true;
  } catch (err) {
    reportError('announcementService', 'refreshReadCache', err);
  }
}

// Eagerly load cache on module init
refreshReadCache();

async function saveRead(readData) {
  _readCache = readData;
  try {
    await supabase.from('system_config').upsert({ key: 'announcements_read', value: readData, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (err) {
    reportError('announcementService', 'saveRead', err);
  }
}

export async function markAsRead(announcementId, userId) {
  if (!announcementId || !userId) return;
  if (!_readCacheLoaded) await refreshReadCache();
  if (!_readCache[announcementId]) _readCache[announcementId] = [];
  if (!_readCache[announcementId].includes(userId)) {
    _readCache[announcementId].push(userId);
    await saveRead({ ..._readCache });
  }
}

export async function getUnreadCount(userId) {
  if (!userId) return 0;
  if (!_readCacheLoaded) await refreshReadCache();
  const announcements = await getAnnouncements();
  return announcements.filter(a => !(_readCache[a.id] || []).includes(userId)).length;
}

export function getReadBy(announcementId) {
  return _readCache[announcementId] || [];
}

export function isRead(announcementId, userId) {
  if (!userId) return false;
  return (_readCache[announcementId] || []).includes(userId);
}
