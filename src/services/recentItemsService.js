const STORAGE_KEY = 'platform_recent_items';
const MAX_ITEMS = 20;

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // Quota exceeded — remove oldest half and retry
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try {
        const trimmed = items.slice(0, Math.floor(items.length / 2));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // give up silently
      }
    }
  }
  window.dispatchEvent(new CustomEvent('platform_recent_changed'));
}

export function addRecentItem({ type, id, name, nameAr, path, extra }) {
  const items = getAll();
  // Remove existing entry for same id
  const filtered = items.filter(item => item.id !== id);
  // Add to front
  filtered.unshift({
    type,
    id,
    name,
    nameAr,
    path,
    extra: extra || {},
    accessed_at: new Date().toISOString(),
  });
  // Trim to max
  const trimmed = filtered.slice(0, MAX_ITEMS);
  saveAll(trimmed);
}

export function getRecentItems(limit = 10) {
  const items = getAll();
  // Already sorted by accessed_at (newest first from addRecentItem)
  return items.slice(0, limit);
}

export function clearRecent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('platform_recent_changed'));
}

export function removeRecentItem(id) {
  const items = getAll();
  const filtered = items.filter(item => item.id !== id);
  saveAll(filtered);
}
