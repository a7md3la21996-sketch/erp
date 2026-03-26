// Offline Queue Manager
// Stores pending operations in localStorage and syncs when online
// Supports: tasks, activities, opportunities, contacts, deals

import supabase from './supabase';
import { logCreate, logUpdate, logDelete } from '../services/auditService';

const STORAGE_KEY = 'platform_sync_queue';
const OLD_STORAGE_KEY = 'platform_offline_queue';
const MAX_RETRIES = 2;

// Migrate from old key if needed
if (typeof window !== 'undefined') {
  try {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing || existing === '[]') {
        localStorage.setItem(STORAGE_KEY, old);
      }
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

// ── Entity → Supabase table mapping ─────────────────────────────────────

function resolveTable(entity) {
  const map = {
    task: 'tasks',
    activity: 'activities',
    opportunity: 'opportunities',
    opportunities: 'opportunities',
    contact: 'contacts',
    contacts: 'contacts',
    deal: 'deals',
    deals: 'deals',
  };
  return map[entity] || entity;
}

// Normalize entity name to singular for audit logs
function singularEntity(entity) {
  const map = {
    tasks: 'task',
    activities: 'activity',
    opportunities: 'opportunity',
    contacts: 'contact',
    deals: 'deal',
  };
  return map[entity] || entity;
}

// ── Queue Storage ─────────────────────────────────────────────────────────

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch { /* ignore quota errors */ }
}

// ── Public API ────────────────────────────────────────────────────────────

/** Add an operation to the offline queue */
export function enqueue(entity, action, data) {
  const queue = getQueue();
  queue.push({
    id: 'oq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    timestamp: Date.now(),
    entity,       // 'task' | 'activity' | 'opportunities' | 'contacts' | 'deals'
    action,       // 'create' | 'update' | 'delete'
    data,
    created_at: new Date().toISOString(),
    retries: 0,
  });
  saveQueue(queue);
  notifyListeners();
}

/** Get count of pending operations */
export function getPendingCount() {
  return getQueue().length;
}

/** Clear all pending operations */
export function clearQueue() {
  saveQueue([]);
  notifyListeners();
}

/** Check if browser is online */
export function isOnline() {
  return navigator.onLine;
}

// ── Queue Processor ───────────────────────────────────────────────────────

let _processing = false;

/** Process all pending operations in FIFO order */
export async function processQueue(onProgress) {
  if (_processing) return { success: 0, failed: 0 };
  if (!navigator.onLine) return { success: 0, failed: 0 };

  const queue = getQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  _processing = true;
  let success = 0;
  let skipped = 0;

  try {
    const currentQueue = getQueue();
    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i];

      // Skip items that exceeded max retries
      if ((item.retries || 0) > MAX_RETRIES) {
        skipped++;
        continue;
      }

      const ok = await processItem(item);

      if (ok) {
        // Remove processed item
        const updated = getQueue().filter(q => q.id !== item.id);
        saveQueue(updated);
        success++;
        notifyListeners();
        if (onProgress) onProgress({ processed: success, remaining: updated.length });
      } else {
        // Increment retry count
        const latestQueue = getQueue();
        const idx = latestQueue.findIndex(q => q.id === item.id);
        if (idx > -1) {
          latestQueue[idx].retries = (latestQueue[idx].retries || 0) + 1;
          saveQueue(latestQueue);
        }
        // Continue to next item instead of stopping entirely
      }
    }
  } finally {
    _processing = false;
  }

  return { success, failed: getQueue().length - skipped };
}

async function processItem(item) {
  const { entity, action, data } = item;
  const table = resolveTable(entity);
  const logEntity = singularEntity(entity);

  try {
    if (action === 'create') {
      // Strip offline markers, computed fields, and temp ID
      const { _offline, _campaign_count, _country, _opp_count, _aging_level, users, contacts, projects, opportunities, ...payload } = data;
      const tempId = payload.id;
      delete payload.id; // Let Supabase generate real ID

      const { data: created, error } = await supabase
        .from(table)
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;
      logCreate(logEntity, created.id, created);

      // If activity for a contact, update last_activity_at
      if ((entity === 'activity' || entity === 'activities') && payload.entity_type === 'contact' && payload.contact_id) {
        await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', payload.contact_id);
      }

      // Update localStorage with real ID
      updateLocalStorageId(entity, tempId, created);

      // Store temp->real ID mapping for reference
      storeTempIdMapping(tempId, created.id);
      return true;
    }

    if (action === 'update') {
      const { _id, _offline, _campaign_count, _country, _opp_count, _aging_level, users, contacts, projects, opportunities, ...updates } = data;
      const targetId = _id || data.id;
      const realId = resolveId(targetId);
      delete updates.id;

      const { data: oldData } = await supabase.from(table).select('*').eq('id', realId).single();
      const { error } = await supabase.from(table).update(updates).eq('id', realId);
      if (error) throw error;

      const { data: newData } = await supabase.from(table).select('*').eq('id', realId).single();
      logUpdate(logEntity, realId, oldData, newData);
      return true;
    }

    if (action === 'delete') {
      const realId = resolveId(data.id);
      // If it's still a temp ID, it was never synced - just remove from queue
      if (realId.startsWith('temp_') || realId.startsWith('oq_')) return true;

      const { data: oldData } = await supabase.from(table).select('*').eq('id', realId).single();
      const { error } = await supabase.from(table).delete().eq('id', realId);
      if (error) throw error;
      logDelete(logEntity, realId, oldData);
      return true;
    }

    return true; // Unknown action, skip
  } catch (err) {
    console.warn('[OfflineQueue] Failed to process item:', item.id, entity, action, err?.message || err);
    return false;
  }
}

// ── Update localStorage after successful sync ────────────────────────────

function updateLocalStorageId(entity, tempId, created) {
  if (!tempId) return;

  const storageKeyMap = {
    task: 'platform_tasks',
    tasks: 'platform_tasks',
    activity: 'platform_activities',
    activities: 'platform_activities',
    opportunity: 'platform_opportunities',
    opportunities: 'platform_opportunities',
    contact: 'platform_contacts',
    contacts: 'platform_contacts',
    deal: 'platform_won_deals',
    deals: 'platform_won_deals',
  };

  const key = storageKeyMap[entity];
  if (!key) return;

  try {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = items.findIndex(i => String(i.id) === String(tempId));
    if (idx > -1) {
      items[idx] = { ...items[idx], ...created };
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch { /* ignore */ }
}

// ── Temp ID Mapping ───────────────────────────────────────────────────────

const MAPPING_KEY = 'platform_offline_id_map';

function storeTempIdMapping(tempId, realId) {
  if (!tempId) return;
  // Only map IDs that look like temp/offline IDs
  const isTemp = String(tempId).startsWith('temp_') || String(tempId).startsWith('oq_') || /^\d{13,}$/.test(String(tempId));
  if (!isTemp) return;

  try {
    const map = JSON.parse(localStorage.getItem(MAPPING_KEY) || '{}');
    map[tempId] = realId;
    localStorage.setItem(MAPPING_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function resolveId(id) {
  if (!id) return id;
  try {
    const map = JSON.parse(localStorage.getItem(MAPPING_KEY) || '{}');
    return map[id] || id;
  } catch { return id; }
}

// ── Listener System ───────────────────────────────────────────────────────

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  const count = getPendingCount();
  listeners.forEach(fn => fn(count));
}

// ── Auto-sync on online event ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Small delay to let connection stabilize
    setTimeout(() => processQueue(), 1500);
  });
}
