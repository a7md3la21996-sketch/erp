// Offline Queue Manager — gutted (no-op stubs)

export function enqueue() {}

export function getQueue() {
  return [];
}

export function getPendingCount() {
  return 0;
}

export function clearQueue() {}

export function isOnline() {
  return navigator.onLine;
}

export async function processQueue() {
  return { success: 0, failed: 0 };
}

export function subscribe() {
  return () => {};
}
