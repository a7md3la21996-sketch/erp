import { syncToSupabase } from '../utils/supabaseSync';
import { getStorageUsage, getBackupInfo } from './backupService';

const ERROR_LOG_KEY = 'platform_error_log';
const MAX_ERRORS = 100;
const pageLoadTimestamp = Date.now();

// ── Error logging ──────────────────────────────────────────────────────

function getErrorLog() {
  try { return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]'); } catch { return []; }
}

function logError(error, context = '') {
  try {
    const logs = getErrorLog();
    logs.unshift({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack || '',
      context,
    });
    if (logs.length > MAX_ERRORS) logs.length = MAX_ERRORS;
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
  } catch { /* ignore */ }
}

function clearErrorLog() {
  localStorage.removeItem(ERROR_LOG_KEY);
}

// ── Uptime ─────────────────────────────────────────────────────────────

function getUptimeStr() {
  const diff = Date.now() - pageLoadTimestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ── Data stats ─────────────────────────────────────────────────────────

function getDataStats() {
  const keys = [
    { key: 'platform_contacts', label: { en: 'Contacts', ar: 'جهات الاتصال' } },
    { key: 'platform_opportunities', label: { en: 'Opportunities', ar: 'الفرص' } },
    { key: 'platform_deals', label: { en: 'Deals', ar: 'الصفقات' } },
    { key: 'platform_tasks', label: { en: 'Tasks', ar: 'المهام' } },
    { key: 'platform_activities', label: { en: 'Activities', ar: 'الأنشطة' } },
    { key: 'platform_comments', label: { en: 'Comments', ar: 'التعليقات' } },
    { key: 'platform_documents', label: { en: 'Documents', ar: 'المستندات' } },
    { key: 'platform_notifications', label: { en: 'Notifications', ar: 'الإشعارات' } },
    { key: 'platform_audit_logs', label: { en: 'Audit Logs', ar: 'سجل التدقيق' } },
    { key: 'platform_announcements', label: { en: 'Announcements', ar: 'الإعلانات' } },
    { key: 'platform_triggers', label: { en: 'Triggers', ar: 'المشغلات' } },
    { key: 'platform_recurring_tasks', label: { en: 'Recurring Tasks', ar: 'المهام المتكررة' } },
  ];

  return keys.map(({ key, label }) => {
    const raw = localStorage.getItem(key);
    let count = 0;
    let sizeKB = 0;
    if (raw) {
      sizeKB = Math.round(((key.length + raw.length) * 2 / 1024) * 100) / 100;
      try {
        const parsed = JSON.parse(raw);
        count = Array.isArray(parsed) ? parsed.length : (typeof parsed === 'object' ? Object.keys(parsed).length : 1);
      } catch { count = 1; }
    }
    return { key, label, count, sizeKB };
  });
}

// ── Error stats ────────────────────────────────────────────────────────

function getErrorStats() {
  const logs = getErrorLog();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  let today = 0;
  let thisWeek = 0;
  logs.forEach(l => {
    const t = new Date(l.timestamp).getTime();
    if (t >= todayStart) today++;
    if (t >= weekStart) thisWeek++;
  });

  return { today, thisWeek, total: logs.length };
}

// ── System info ────────────────────────────────────────────────────────

function getSystemInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  let platform = navigator.platform || 'Unknown';
  const screenRes = `${window.screen.width}x${window.screen.height}`;

  return { browser, platform, screenRes, userAgent: ua };
}

// ── PWA / Service Worker ───────────────────────────────────────────────

async function getPWAStatus() {
  const result = { serviceWorkerStatus: 'unsupported', cacheEntries: 0 };

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      if (reg.active) result.serviceWorkerStatus = 'active';
      else if (reg.installing) result.serviceWorkerStatus = 'installing';
      else if (reg.waiting) result.serviceWorkerStatus = 'waiting';
      else result.serviceWorkerStatus = 'registered';
    } else {
      result.serviceWorkerStatus = 'not_registered';
    }
  }

  if ('caches' in window) {
    try {
      const names = await caches.keys();
      let total = 0;
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        total += keys.length;
      }
      result.cacheEntries = total;
    } catch { /* ignore */ }
  }

  return result;
}

// ── Main health check ──────────────────────────────────────────────────

async function getSystemHealth() {
  const storageUsage = getStorageUsage();
  const backupInfo = getBackupInfo();
  const totalEstimate = 5 * 1024; // 5MB in KB
  const usedKB = backupInfo.totalSizeKB;
  const percentage = Math.min(100, Math.round((usedKB / totalEstimate) * 100));

  const perfTiming = performance.timing || {};
  const pageLoadTime = perfTiming.loadEventEnd && perfTiming.navigationStart
    ? perfTiming.loadEventEnd - perfTiming.navigationStart
    : null;
  const domReady = perfTiming.domContentLoadedEventEnd && perfTiming.navigationStart
    ? perfTiming.domContentLoadedEventEnd - perfTiming.navigationStart
    : null;

  const pwa = await getPWAStatus();
  const errors = getErrorStats();
  const dataStats = getDataStats();
  const systemInfo = getSystemInfo();
  const totalRecords = dataStats.reduce((sum, d) => sum + d.count, 0);

  // Warnings
  const warnings = [];
  if (percentage > 80) warnings.push({ type: 'error', msg: { en: 'localStorage usage > 80%', ar: 'استخدام التخزين المحلي > 80%' } });
  else if (percentage > 60) warnings.push({ type: 'warning', msg: { en: 'localStorage usage > 60%', ar: 'استخدام التخزين المحلي > 60%' } });

  if (backupInfo.lastBackup) {
    const daysSince = (Date.now() - new Date(backupInfo.lastBackup).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) warnings.push({ type: 'warning', msg: { en: `No backup in ${Math.floor(daysSince)} days`, ar: `لم يتم النسخ الاحتياطي منذ ${Math.floor(daysSince)} يوم` } });
  } else {
    warnings.push({ type: 'warning', msg: { en: 'No backup has been created yet', ar: 'لم يتم إنشاء نسخة احتياطية بعد' } });
  }

  const auditLogs = dataStats.find(d => d.key === 'platform_audit_logs');
  if (auditLogs && auditLogs.count > 100) warnings.push({ type: 'info', msg: { en: `${auditLogs.count} audit log entries`, ar: `${auditLogs.count} سجل تدقيق` } });

  if (errors.today > 10) warnings.push({ type: 'error', msg: { en: `${errors.today} errors today`, ar: `${errors.today} خطأ اليوم` } });

  // Overall status
  let status = 'healthy';
  if (warnings.some(w => w.type === 'error') || percentage > 80 || errors.today > 10) status = 'critical';
  else if (warnings.some(w => w.type === 'warning') || percentage > 60) status = 'warning';

  return {
    status,
    storage: { used: usedKB, total: totalEstimate, percentage, breakdown: storageUsage },
    performance: { pageLoadTime, domReady },
    errors,
    pwa,
    session: { uptime: getUptimeStr(), ...systemInfo },
    lastBackup: backupInfo.lastBackup,
    dataStats,
    totalRecords,
    warnings,
  };
}

export { getSystemHealth, logError, getErrorLog, clearErrorLog, getUptimeStr, getDataStats };
