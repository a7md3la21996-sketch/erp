import { syncToSupabase } from '../utils/supabaseSync';
import { reportError } from '../utils/errorReporter';
/**
 * Push Notification Service — Browser Notification API + Service Worker
 * No external push service needed. Uses the native browser APIs.
 */

const PUSH_PREF_KEY = 'platform_push_enabled';

// Check if push is supported
export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// Get current permission state: 'granted' | 'denied' | 'default'
export function getPushPermission() {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

// Check if user has enabled push (permission granted + user preference)
export function isPushEnabled() {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    return localStorage.getItem(PUSH_PREF_KEY) !== 'false';
  } catch (err) { reportError('pushService', 'query', err);
    return true;
  }
}

// Save user preference
export function setPushPreference(enabled) {
  try {
    localStorage.setItem(PUSH_PREF_KEY, String(enabled));
  } catch { /* ignore */ }
}

// Request permission
export async function requestPushPermission() {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setPushPreference(true);
  }
  return permission === 'granted';
}

// Show a push notification
export function showPushNotification(title, options = {}) {
  if (Notification.permission !== 'granted') return;
  if (!isPushEnabled()) return;

  // Use service worker for background notifications
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
        dir: 'rtl',
        lang: 'ar',
        vibrate: [200, 100, 200],
        ...options,
      });
    });
  } else {
    // Fallback to regular notification
    new Notification(title, {
      icon: '/pwa-192.png',
      dir: 'rtl',
      lang: 'ar',
      ...options,
    });
  }
}
