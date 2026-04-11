import supabase from '../lib/supabase';
import { parseDevice } from './sessionService';
import { stripInternalFields } from '../utils/sanitizeForSupabase';

const STORAGE_KEY = 'platform_view_logs';
const MAX_LOGS = 2000; // reduced from 5000 to prevent localStorage bloat

let _logsCache = null;
function loadLogs() {
  if (_logsCache) return _logsCache;
  try { _logsCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return _logsCache; } catch { return []; }
}

function saveLogs(logs) {
  if (logs.length > MAX_LOGS) logs = logs.slice(0, MAX_LOGS);
  _logsCache = logs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    // QuotaExceededError — trim to 1000 and retry
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      logs = logs.slice(0, 1000);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); } catch { /* give up */ }
    }
  }
}

/**
 * Log a view event — called when user opens a drawer/detail page
 * @param {string} entityType - 'contact' | 'opportunity' | 'campaign' | 'deal'
 * @param {string} entityId
 * @param {string} entityName - display name for quick reference
 * @param {object} viewer - { id, email, full_name_ar, full_name_en, role }
 */
export async function logView({ entityType, entityId, entityName, viewer }) {
  if (!viewer?.id || !entityType || !entityId) return;

  const device = parseDevice(navigator.userAgent);
  const entry = {
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName || '',
    user_id: viewer.id,
    user_name: viewer.full_name_ar || viewer.full_name_en || viewer.email,
    user_role: viewer.role,
    viewed_at: new Date().toISOString(),
    device_type: device.type,
    browser: device.browser,
    os: device.os,
  };

  // Save to localStorage
  const logs = loadLogs();
  logs.unshift(entry);
  saveLogs(logs);

  // Try Supabase
  try {
    await supabase.from('view_logs').insert([stripInternalFields(entry)]);
  } catch {}

  return entry;
}

/**
 * Get view logs with optional filters
 */
export function getViewLogs({ entityType, entityId, userId, limit = 100 } = {}) {
  let logs = loadLogs();
  if (entityType) logs = logs.filter(l => l.entity_type === entityType);
  if (entityId) logs = logs.filter(l => l.entity_id === entityId);
  if (userId) logs = logs.filter(l => l.user_id === userId);
  return logs.slice(0, limit);
}

/**
 * Get who viewed a specific entity
 */
export function getEntityViewers(entityType, entityId) {
  const logs = getViewLogs({ entityType, entityId });
  const viewerMap = {};
  logs.forEach(l => {
    if (!viewerMap[l.user_id]) {
      viewerMap[l.user_id] = { user_id: l.user_id, user_name: l.user_name, user_role: l.user_role, views: 0, first_view: l.viewed_at, last_view: l.viewed_at };
    }
    viewerMap[l.user_id].views++;
    if (l.viewed_at < viewerMap[l.user_id].first_view) viewerMap[l.user_id].first_view = l.viewed_at;
    if (l.viewed_at > viewerMap[l.user_id].last_view) viewerMap[l.user_id].last_view = l.viewed_at;
  });
  return Object.values(viewerMap).sort((a, b) => new Date(b.last_view) - new Date(a.last_view));
}

/**
 * Get what a user has viewed recently
 */
export function getUserViews(userId, limit = 50) {
  return getViewLogs({ userId, limit });
}

/**
 * Get view stats summary
 */
export function getViewStats() {
  const logs = loadLogs();
  const today = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.viewed_at).toDateString() === today);
  const uniqueUsers = new Set(logs.map(l => l.user_id));
  const uniqueUsersToday = new Set(todayLogs.map(l => l.user_id));
  const byEntity = {};
  logs.forEach(l => {
    byEntity[l.entity_type] = (byEntity[l.entity_type] || 0) + 1;
  });
  return {
    total: logs.length,
    today: todayLogs.length,
    uniqueUsers: uniqueUsers.size,
    uniqueUsersToday: uniqueUsersToday.size,
    byEntity,
  };
}
