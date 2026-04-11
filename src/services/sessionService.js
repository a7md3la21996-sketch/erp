import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';

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
  } catch (err) { reportError('sessionService', 'query', err);
    return 'Unknown';
  }
}

// Track active session id in memory
let _activeSessionId = null;

/**
 * Log a new session on login
 */
export async function logSession(user) {
  if (!user?.id) return;

  const device = parseDevice(navigator.userAgent);
  const ip = await getIP();

  const session = {
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

  _activeSessionId = session.id;

  try {
    await supabase.from('sessions').insert(session);
  } catch (err) {
    reportError('sessionService', 'startSession', err);
  }

  return session;
}

/**
 * Update last_active_at for current session (call periodically)
 */
export async function updateSessionActivity() {
  if (!_activeSessionId) return;
  try {
    await supabase.from('sessions').update({ last_active_at: new Date().toISOString() }).eq('id', _activeSessionId);
  } catch (err) { reportError('sessionService', 'updateSessionActivity', err); }
}

/**
 * End current session on logout
 */
export async function endSession() {
  if (!_activeSessionId) return;
  try {
    await supabase.from('sessions').update({ is_active: false, logout_at: new Date().toISOString() }).eq('id', _activeSessionId);
  } catch (err) { reportError('sessionService', 'endSession', err); }
  _activeSessionId = null;
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId) {
  try {
    const { data, error } = await supabase.from('sessions').select('*').eq('user_id', userId).order('login_at', { ascending: false });
    if (error) { reportError('sessionService', 'getUserSessions', error); return []; }
    return data || [];
  } catch (err) { reportError('sessionService', 'getUserSessions', err); return []; }
}

/**
 * Get all sessions
 */
export async function getAllSessions() {
  try {
    const { data, error } = await supabase.from('sessions').select('*').order('login_at', { ascending: false }).range(0, 499);
    if (error) { reportError('sessionService', 'getAllSessions', error); return []; }
    return data || [];
  } catch (err) { reportError('sessionService', 'getAllSessions', err); return []; }
}

/**
 * Get session stats
 */
export async function getSessionStats() {
  const sessions = await getAllSessions();
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
