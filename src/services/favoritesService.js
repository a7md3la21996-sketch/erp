import { syncToSupabase } from '../utils/supabaseSync';
import { reportError } from '../utils/errorReporter';
const STORAGE_KEY = 'platform_favorites';
const MAX_FAVORITES = 50;

function readFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) { reportError('favoritesService', 'query', err);
    return [];
  }
}

function writeFavorites(favorites) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new CustomEvent('platform_favorites_changed'));
  } catch (e) {
    // Quota exceeded — trim oldest and retry
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      const trimmed = favorites.slice(0, Math.floor(favorites.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent('platform_favorites_changed'));
    }
  }
}

/**
 * @param {{ type: string, id: string, name: string, nameAr?: string, path: string, icon?: string }} item
 */
export function addFavorite(item) {
  const favorites = readFavorites();
  // Don't add duplicates
  if (favorites.some(f => f.id === item.id)) return favorites;
  const newFav = {
    id: item.id,
    type: item.type || 'page',
    name: item.name,
    nameAr: item.nameAr || item.name,
    path: item.path,
    icon: item.icon || null,
    added_at: new Date().toISOString(),
  };
  const updated = [newFav, ...favorites].slice(0, MAX_FAVORITES);
  writeFavorites(updated);
  return updated;
}

export function removeFavorite(id) {
  const favorites = readFavorites();
  const updated = favorites.filter(f => f.id !== id);
  writeFavorites(updated);
  return updated;
}

export function getFavorites() {
  return readFavorites().sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
}

export function isFavorite(id) {
  return readFavorites().some(f => f.id === id);
}

export function toggleFavorite(item) {
  if (isFavorite(item.id)) {
    return { favorites: removeFavorite(item.id), added: false };
  } else {
    return { favorites: addFavorite(item), added: true };
  }
}
