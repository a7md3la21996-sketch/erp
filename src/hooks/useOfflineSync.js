import { useState, useEffect, useCallback, useRef } from 'react';
import {
  enqueue as queueEnqueue,
  processQueue,
  getPendingCount,
  subscribe,
  isOnline as checkOnline,
} from '../lib/offlineQueue';

/**
 * React hook for offline sync status and queue management.
 *
 * Returns:
 *   isOnline      - current network status
 *   pendingCount  - number of queued operations
 *   isSyncing     - true while processing queue
 *   syncResult    - { success, failed } from last sync, or null
 *   enqueue       - function to add item to queue
 *   syncNow       - manually trigger sync
 */
export function useOfflineSync() {
  const [online, setOnline] = useState(checkOnline());
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const syncResultTimer = useRef(null);

  // Listen for online/offline events
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    const unsub = subscribe((count) => setPendingCount(count));
    return unsub;
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pendingCount > 0 && !isSyncing) {
      doSync();
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await processQueue((progress) => {
        setPendingCount(progress.remaining);
      });

      setPendingCount(getPendingCount());

      if (result.success > 0) {
        setSyncResult(result);
        // Clear the "synced" message after 4 seconds
        if (syncResultTimer.current) clearTimeout(syncResultTimer.current);
        syncResultTimer.current = setTimeout(() => setSyncResult(null), 4000);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const enqueue = useCallback((entity, action, data) => {
    queueEnqueue(entity, action, data);
    setPendingCount(getPendingCount());
  }, []);

  return {
    isOnline: online,
    pendingCount,
    isSyncing,
    syncResult,
    enqueue,
    syncNow: doSync,
  };
}
