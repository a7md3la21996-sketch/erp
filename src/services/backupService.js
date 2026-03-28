import { reportError } from '../utils/errorReporter';
import { logAction } from './auditService';

const LAST_BACKUP_KEY = 'platform_last_backup';

/**
 * Collect all localStorage keys starting with "platform_" into a backup object.
 */
export function createBackup() {
  const keys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('platform_')) {
      keys[key] = localStorage.getItem(key);
    }
  }
  return {
    version: '1.0',
    created_at: new Date().toISOString(),
    app: 'Platform ERP',
    keys,
  };
}

/**
 * Create a backup and trigger browser download as JSON file.
 */
export function downloadBackup() {
  const backup = createBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `platform-erp-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Record last backup date
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());

  // Audit
  logAction({
    action: 'create',
    entity: 'backup',
    entityId: date,
    entityName: `Backup ${date}`,
    description: `Downloaded backup (${Object.keys(backup.keys).length} keys)`,
    userName: 'System',
  });

  return backup;
}

/**
 * Read a JSON file and restore its keys to localStorage.
 * @param {File} file
 * @returns {Promise<{restored: number, errors: string[]}>}
 */
export function restoreBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Validate structure
        if (!data || !data.version || !data.keys || typeof data.keys !== 'object') {
          reject(new Error('Invalid backup file: missing version or keys'));
          return;
        }

        const errors = [];
        let restored = 0;

        Object.entries(data.keys).forEach(([key, value]) => {
          try {
            localStorage.setItem(key, value);
            restored++;
          } catch (err) {
            errors.push(`Failed to restore "${key}": ${err.message}`);
          }
        });

        // Audit
        logAction({
          action: 'import',
          entity: 'backup',
          entityId: 'restore',
          entityName: `Restore from ${data.created_at || 'unknown'}`,
          description: `Restored ${restored} keys from backup`,
          userName: 'System',
        });

        resolve({ restored, errors });
      } catch (err) {
        reject(new Error('Failed to parse backup file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Get backup stats: total keys, total size, last backup date.
 */
export function getBackupInfo() {
  let totalKeys = 0;
  let totalSize = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('platform_')) {
      totalKeys++;
      totalSize += (key.length + (localStorage.getItem(key) || '').length) * 2; // UTF-16
    }
  }

  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY) || null;

  return {
    totalKeys,
    totalSizeKB: Math.round((totalSize / 1024) * 100) / 100,
    lastBackup,
  };
}

/**
 * Calculate localStorage usage per platform_ key.
 * Returns sorted array (largest first).
 */
export function getStorageUsage() {
  const usage = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('platform_')) {
      const value = localStorage.getItem(key) || '';
      const sizeBytes = (key.length + value.length) * 2; // UTF-16
      let entries = 0;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) entries = parsed.length;
        else if (typeof parsed === 'object' && parsed !== null) entries = Object.keys(parsed).length;
        else entries = 1;
      } catch (err) { reportError('backupService', 'query', err);
        entries = 1;
      }
      usage.push({
        key,
        sizeKB: Math.round((sizeBytes / 1024) * 100) / 100,
        entries,
      });
    }
  }

  usage.sort((a, b) => b.sizeKB - a.sizeKB);
  return usage;
}

/**
 * Clear all platform_ keys from localStorage.
 */
export function clearAllData() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('platform_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  logAction({
    action: 'delete',
    entity: 'backup',
    entityId: 'clear_all',
    entityName: 'Clear All Data',
    description: `Cleared ${keysToRemove.length} keys from localStorage`,
    userName: 'System',
  });

  return keysToRemove.length;
}
