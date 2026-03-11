// Offline Queue Manager for Tasks & Activities
// Stores pending operations in localStorage and syncs when online

import supabase from './supabase';
import { logCreate, logUpdate, logDelete } from '../services/auditService';

const STORAGE_KEY = 'platform_offline_queue';

// ── Queue Storage ─────────────────────────────────────────────────────────

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

// ── Public API ────────────────────────────────────────────────────────────

/** Add an operation to the offline queue */
export function enqueue(entity, action, data) {
  const queue = getQueue();
  queue.push({
    id: 'oq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    timestamp: Date.now(),
    entity,   // 'task' | 'activity'
    action,   // 'create' | 'update' | 'delete'
    data,
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

  try {
    while (true) {
      const currentQueue = getQueue();
      if (currentQueue.length === 0) break;

      const item = currentQueue[0];
      const ok = await processItem(item);

      if (ok) {
        // Remove processed item
        const updated = getQueue().filter(q => q.id !== item.id);
        saveQueue(updated);
        success++;
        notifyListeners();
        if (onProgress) onProgress({ processed: success, remaining: updated.length });
      } else {
        // Stop on failure - will retry later
        break;
      }
    }
  } finally {
    _processing = false;
  }

  return { success, failed: getQueue().length };
}

async function processItem(item) {
  const { entity, action, data } = item;
  const table = entity === 'task' ? 'tasks' : 'activities';

  try {
    if (action === 'create') {
      // Strip offline markers and temp ID
      const { _offline, ...payload } = data;
      const tempId = payload.id;
      delete payload.id; // Let Supabase generate real ID

      const { data: created, error } = await supabase
        .from(table)
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;
      logCreate(entity, created.id, created);

      // If activity for a contact, update last_activity_at
      if (entity === 'activity' && payload.entity_type === 'contact' && payload.contact_id) {
        await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', payload.contact_id);
      }

      // Store temp->real ID mapping for reference
      storeTempIdMapping(tempId, created.id);
      return true;
    }

    if (action === 'update') {
      const { _id, ...updates } = data;
      const realId = resolveId(_id || data.id);

      const { data: oldData } = await supabase.from(table).select('*').eq('id', realId).single();
      const { error } = await supabase.from(table).update(updates).eq('id', realId);
      if (error) throw error;

      const { data: newData } = await supabase.from(table).select('*').eq('id', realId).single();
      logUpdate(entity, realId, oldData, newData);
      return true;
    }

    if (action === 'delete') {
      const realId = resolveId(data.id);
      // If it's still a temp ID, it was never synced - just remove from queue
      if (realId.startsWith('temp_')) return true;

      const { data: oldData } = await supabase.from(table).select('*').eq('id', realId).single();
      const { error } = await supabase.from(table).delete().eq('id', realId);
      if (error) throw error;
      logDelete(entity, realId, oldData);
      return true;
    }

    return true; // Unknown action, skip
  } catch (err) {
    console.warn('[OfflineQueue] Failed to process item:', item, err);
    return false;
  }
}

// ── Temp ID Mapping ───────────────────────────────────────────────────────

const MAPPING_KEY = 'platform_offline_id_map';

function storeTempIdMapping(tempId, realId) {
  if (!tempId || !tempId.startsWith('temp_')) return;
  try {
    const map = JSON.parse(localStorage.getItem(MAPPING_KEY) || '{}');
    map[tempId] = realId;
    localStorage.setItem(MAPPING_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function resolveId(id) {
  if (!id || !id.startsWith('temp_')) return id;
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
