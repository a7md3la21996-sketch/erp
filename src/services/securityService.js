const STORAGE_KEY = 'platform_security_config';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveConfig(config) {
  // Save to localStorage immediately
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.warn('Storage quota exceeded for security config');
    }
  }
  // Persist to Supabase (non-blocking)
  import('../lib/supabase').then(({ default: supabase }) => {
    supabase.from('security_config')
      .upsert({ key: 'security', value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(() => {}).catch(() => {});
  }).catch(() => {});
}

/**
 * Load security config from Supabase first, fallback to localStorage
 */
export async function loadSecurityConfigFromServer() {
  try {
    const { default: supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.from('security_config').select('value').eq('key', 'security').maybeSingle();
    if (!error && data?.value) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value)); } catch {}
      return data.value;
    }
  } catch {}
  return getConfig();
}

// ── IP Whitelist ──────────────────────────────────────────────────────────

export function getIPWhitelist() {
  const config = getConfig();
  return config.ipWhitelist || [];
}

export function addIP(ip, label) {
  const config = getConfig();
  if (!config.ipWhitelist) config.ipWhitelist = [];
  const entry = {
    id: 'ip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ip,
    label,
    added_at: new Date().toISOString(),
    added_by: 'current_user',
  };
  config.ipWhitelist.push(entry);
  saveConfig(config);
  return entry;
}

export function removeIP(id) {
  const config = getConfig();
  config.ipWhitelist = (config.ipWhitelist || []).filter(e => e.id !== id);
  saveConfig(config);
}

export function isIPWhitelistEnabled() {
  const config = getConfig();
  return config.ipWhitelistEnabled === true;
}

export function toggleIPWhitelist() {
  const config = getConfig();
  config.ipWhitelistEnabled = !config.ipWhitelistEnabled;
  saveConfig(config);
  return config.ipWhitelistEnabled;
}

export function checkIP(ip) {
  // Simulated — always returns true with a log
  console.log(`[Security] IP check for ${ip}: allowed (simulated)`);
  return true;
}

// ── Password Policy ───────────────────────────────────────────────────────

const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: false,
  expiryDays: 0,
  preventReuse: 0,
  maxAttempts: 0,
};

export function getPasswordPolicy() {
  const config = getConfig();
  return { ...DEFAULT_PASSWORD_POLICY, ...(config.passwordPolicy || {}) };
}

export function savePasswordPolicy(policy) {
  const config = getConfig();
  config.passwordPolicy = { ...DEFAULT_PASSWORD_POLICY, ...policy };
  saveConfig(config);
  return config.passwordPolicy;
}

export function validatePassword(password) {
  const policy = getPasswordPolicy();
  const errors = [];

  if (password.length < policy.minLength) {
    errors.push({ en: `Must be at least ${policy.minLength} characters`, ar: `يجب أن يكون ${policy.minLength} حروف على الأقل` });
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push({ en: 'Must contain uppercase letter', ar: 'يجب أن يحتوي على حرف كبير' });
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push({ en: 'Must contain lowercase letter', ar: 'يجب أن يحتوي على حرف صغير' });
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push({ en: 'Must contain a number', ar: 'يجب أن يحتوي على رقم' });
  }
  if (policy.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push({ en: 'Must contain special character', ar: 'يجب أن يحتوي على رمز خاص' });
  }

  return { valid: errors.length === 0, errors };
}

// ── Export Restrictions ───────────────────────────────────────────────────

const DEFAULT_EXPORT_RESTRICTIONS = {
  restrictedRoles: [],
  allowedFormats: ['csv', 'excel', 'pdf'],
  requireApproval: false,
  maxRowsPerExport: 0,
  logExports: true,
};

export function getExportRestrictions() {
  const config = getConfig();
  return { ...DEFAULT_EXPORT_RESTRICTIONS, ...(config.exportRestrictions || {}) };
}

export function saveExportRestrictions(restrictionsConfig) {
  const config = getConfig();
  config.exportRestrictions = { ...DEFAULT_EXPORT_RESTRICTIONS, ...restrictionsConfig };
  saveConfig(config);
  return config.exportRestrictions;
}

export function canExport(role, format) {
  const restrictions = getExportRestrictions();
  if (restrictions.restrictedRoles.includes(role)) return false;
  if (!restrictions.allowedFormats.includes(format)) return false;
  return true;
}

export function logExport(user, entity, format, rowCount) {
  const EXPORT_LOG_KEY = 'platform_export_logs';
  try {
    const logs = JSON.parse(localStorage.getItem(EXPORT_LOG_KEY) || '[]');
    logs.unshift({
      id: 'exp_' + Date.now(),
      user,
      entity,
      format,
      rowCount,
      timestamp: new Date().toISOString(),
    });
    if (logs.length > 200) logs.length = 200;
    localStorage.setItem(EXPORT_LOG_KEY, JSON.stringify(logs));
  } catch { /* ignore */ }
}
