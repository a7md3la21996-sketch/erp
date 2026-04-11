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
let messaging = null;

try {
  messaging = getMessaging(app);
} catch {
  // Firebase messaging not supported (e.g. Safari private mode)
}

/**
 * Request permission and get FCM token
 * Returns the token string or null
 */
export async function getFCMToken() {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token;
  } catch {
    return null;
  }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}

export { messaging };
