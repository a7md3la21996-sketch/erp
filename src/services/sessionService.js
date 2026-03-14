import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_sessions';
const ACTIVE_SESSION_KEY = 'platform_active_session';

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveSessions(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // QuotaExceededError — trim to 250 and retry
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      if (list.length > 250) list.length = 250;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

/**
 * Parse user agent to extract device info
 */
export function parseDevice(ua) {
  if (!ua) return { type: 'unknown', browser: 'Unknown', os: 'Unknown', raw: '' };

  // Device type
  let type = 'desktop';
  if (/iPad|tablet/i.test(ua)) type = 'tablet';
  else if (/Mobile|iPhone|Android.*Mobile|iPod/i.test(ua)) type = 'mobile';

  // Browser
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  // OS
  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|macOS/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { type, browser, os, raw: ua };
}

/**
 * Get IP address from free API
 */
async function getIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data.ip || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Log a new session on login
 */
export async function logSession(user) {
  if (!user?.id) return;

  const device = parseDevice(navigator.userAgent);
  const ip = await getIP();

  const session = {
    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 6),
    user_id: user.id,
    user_name: user.full_name_ar || user.full_name_en || user.email,
    user_role: user.role,
    ip_address: ip,
    device_type: device.type,
    browser: device.browser,
    os: device.os,
    user_agent: device.raw,
    login_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    is_active: true,
  };

  // Save active session ref
  localStorage.setItem(ACTIVE_SESSION_KEY, session.id);

  // Save to sessions list
  const sessions = loadSessions();
  sessions.unshift(session);
  // Keep max 500 sessions
  if (sessions.length > 500) sessions.length = 500;
  saveSessions(sessions);

  // Try Supabase
  try {
    await supabase.from('sessions').insert(session);
  } catch {}

  return session;
}

/**
 * Update last_active_at for current session (call periodically)
 */
export function updateSessionActivity() {
  const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!activeId) return;
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === activeId);
  if (idx !== -1) {
    sessions[idx].last_active_at = new Date().toISOString();
    saveSessions(sessions);
  }
}

/**
 * End current session on logout
 */
export function endSession() {
  const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!activeId) return;
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === activeId);
  if (idx !== -1) {
    sessions[idx].is_active = false;
    sessions[idx].logout_at = new Date().toISOString();
    saveSessions(sessions);
  }
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

/**
 * Get all sessions for a user
 */
export function getUserSessions(userId) {
  return loadSessions().filter(s => s.user_id === userId);
}

/**
 * Get all sessions
 */
export function getAllSessions() {
  return loadSessions();
}

/**
 * Get session stats
 */
export function getSessionStats() {
  const sessions = loadSessions();
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.login_at).toDateString() === today);
  const activeSessions = sessions.filter(s => s.is_active);

  // Unique users
  const uniqueUsers = new Set(sessions.map(s => s.user_id));
  const uniqueUsersToday = new Set(todaySessions.map(s => s.user_id));

  // Device breakdown
  const devices = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  sessions.forEach(s => { devices[s.device_type] = (devices[s.device_type] || 0) + 1; });

  // Browser breakdown
  const browsers = {};
  sessions.forEach(s => { browsers[s.browser] = (browsers[s.browser] || 0) + 1; });

  // OS breakdown
  const oses = {};
  sessions.forEach(s => { oses[s.os] = (oses[s.os] || 0) + 1; });

  // Per-user device count
  const userDevices = {};
  sessions.forEach(s => {
    if (!userDevices[s.user_id]) userDevices[s.user_id] = { name: s.user_name, role: s.user_role, devices: new Set(), ips: new Set(), sessions: 0 };
    userDevices[s.user_id].devices.add(`${s.device_type}_${s.browser}_${s.os}`);
    userDevices[s.user_id].ips.add(s.ip_address);
    userDevices[s.user_id].sessions++;
  });
  const userDeviceList = Object.entries(userDevices).map(([id, d]) => ({
    user_id: id, user_name: d.name, user_role: d.role,
    device_count: d.devices.size, ip_count: d.ips.size, session_count: d.sessions,
  }));

  return {
    total: sessions.length,
    today: todaySessions.length,
    active: activeSessions.length,
    uniqueUsers: uniqueUsers.size,
    uniqueUsersToday: uniqueUsersToday.size,
    devices, browsers, oses, userDeviceList,
  };
}
