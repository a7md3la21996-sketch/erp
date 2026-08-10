import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCFHeg4uQmPhE9xqg4WuNasZywYaLKVytA",
  authDomain: "platform-erp-7866d.firebaseapp.com",
  projectId: "platform-erp-7866d",
  storageBucket: "platform-erp-7866d.firebasestorage.app",
  messagingSenderId: "415901006793",
  appId: "1:415901006793:web:6751347e374d382fee4618"
};

const VAPID_KEY = 'BLj4aC9mvOnIJ15R-vN8CsWzwBcOmXUg202U6EuP8l9jlf7d5XmPAkcWQi0JluG5UDKhZJGeRMsCQmFDOOyLFbw';

const app = initializeApp(firebaseConfig);

// Lazily initialize messaging ONLY when a user actually engages notifications.
// getMessaging(app) triggers a Firebase Installations request; running it at
// module import (as before) fired that call on EVERY app load — the stray
// bootstrap 400 — even for users who never enable push. Now it inits on first
// real use behind the permission gate, so non-opted-in users make no Firebase
// messaging calls at all.
let messaging = null;
let _messagingTried = false;
function getMessagingInstance() {
  if (messaging || _messagingTried) return messaging;
  _messagingTried = true;
  try {
    messaging = getMessaging(app);
  } catch {
    // Firebase messaging not supported (e.g. Safari private mode)
  }
  return messaging;
}

/**
 * Get FCM token if notification permission is already granted.
 * Does NOT prompt — Chrome/Safari block requestPermission() outside
 * a user gesture, so the explicit "Enable notifications" button in
 * the Header is the only place that can legally ask. This function
 * is safe to call from useEffect on app load: it no-ops (and inits
 * nothing) until permission is granted.
 */
export async function getFCMToken() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  const m = getMessagingInstance();
  if (!m) return null;
  try {
    const token = await getToken(m, { vapidKey: VAPID_KEY });
    return token;
  } catch {
    return null;
  }
}

/**
 * Listen for foreground messages. Only wires up (and thus initializes
 * messaging) for users who have already opted into notifications.
 */
export function onForegroundMessage(callback) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return () => {};
  const m = getMessagingInstance();
  if (!m) return () => {};
  return onMessage(m, (payload) => {
    callback(payload);
  });
}

export { messaging };
