export function useOfflineSync() {
  return { isOnline: true, pendingCount: 0, isSyncing: false, syncResult: null, enqueue: () => {}, syncNow: () => {} };
}
