import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_security_config';
const SUPABASE_TABLE = 'security_settings';

async function getConfigFromSupabase() {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('key, value')
      .order('key');
    if (!error && data && data.length > 0) {
      const config = {};
      data.forEach(row => { config[row.key] = row.value; });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
      return config;
    }
  } catch (err) {
    console.warn('Supabase getConfig failed, falling back to localStorage:', err);
  }
  return null;
}

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

async function getConfigAsync() {
  const remote = await getConfigFromSupabase();
  if (remote) return remote;
  return getConfig();
}

function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.warn('Storage quota exceeded for security config');
    }
  }
}

async function saveConfigToSupabase(config) {
  try {
    const rows = Object.entries(config).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert(rows, { onConflict: 'key' });
    if (error) console.warn('Supabase saveConfig failed:', error);
  } catch (err) {
    console.warn('Supabase saveConfig failed:', err);
  }
}

// ── IP Whitelist ──────────────────────────────────────────────────────────

export async function getIPWhitelist() {
  const config = await getConfigAsync();
  return config.ipWhitelist || [];
}

export async function addIP(ip, label) {
  const config = await getConfigAsync();
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
  await saveConfigToSupabase(config);
  return entry;
}

export async function removeIP(id) {
  const config = await getConfigAsync();
  config.ipWhitelist = (config.ipWhitelist || []).filter(e => e.id !== id);
  saveConfig(config);
  await saveConfigToSupabase(config);
}

export async function isIPWhitelistEnabled() {
  const config = await getConfigAsync();
  return config.ipWhitelistEnabled === true;
}

export async function toggleIPWhitelist() {
  const config = await getConfigAsync();
  config.ipWhitelistEnabled = !config.ipWhitelistEnabled;
  saveConfig(config);
  await saveConfigToSupabase(config);
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

export async function getPasswordPolicy() {
  const config = await getConfigAsync();
  return { ...DEFAULT_PASSWORD_POLICY, ...(config.passwordPolicy || {}) };
}

export async function savePasswordPolicy(policy) {
  const config = await getConfigAsync();
  config.passwordPolicy = { ...DEFAULT_PASSWORD_POLICY, ...policy };
  saveConfig(config);
  await saveConfigToSupabase(config);
  return config.passwordPolicy;
}

export function validatePassword(password) {
  // Uses sync localStorage for immediate validation (no await needed)
  const config = getConfig();
  const policy = { ...DEFAULT_PASSWORD_POLICY, ...(config.passwordPolicy || {}) };
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

export async function getExportRestrictions() {
  const config = await getConfigAsync();
  return { ...DEFAULT_EXPORT_RESTRICTIONS, ...(config.exportRestrictions || {}) };
}

export async function saveExportRestrictions(restrictionsConfig) {
  const config = await getConfigAsync();
  config.exportRestrictions = { ...DEFAULT_EXPORT_RESTRICTIONS, ...restrictionsConfig };
  saveConfig(config);
  await saveConfigToSupabase(config);
  return config.exportRestrictions;
}

export async function canExport(role, format) {
  const restrictions = await getExportRestrictions();
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
