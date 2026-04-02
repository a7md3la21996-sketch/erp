// Sync Service — gutted (offline queue removed)

export function getSyncStatus() {
  return { pending: 0, lastSyncAt: null, isOnline: navigator.onLine, failedItems: 0 };
}

export function addToSyncQueue() {}

export async function syncNow() {
  return { success: 0, failed: 0 };
}

export function subscribe() {
  return () => {};
}

export function getPendingCount() {
  return 0;
}

export function isOnline() {
  return navigator.onLine;
}

export function initSyncListeners() {}
export function cleanupSyncListeners() {}
