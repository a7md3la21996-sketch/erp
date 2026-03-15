const LOCAL_KEY = 'platform_export_import_history';
const MAX_ENTRIES = 200;

// ── localStorage helpers ────────────────────────────────────────────────
function getAll() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}

function saveAll(entries) {
  try {
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
    } catch (e) {
      // QuotaExceededError — trim to half and retry
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        entries.length = Math.min(entries.length, Math.floor(MAX_ENTRIES / 2));
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(entries)); } catch { /* give up */ }
      }
    }
  } catch { /* ignore */ }
}

// ── Public API ──────────────────────────────────────────────────────────

export function logExport({ entity, format, fileName, recordCount, userName }) {
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'export',
    entity,
    format,
    fileName,
    recordCount: recordCount || 0,
    status: 'success',
    errors: [],
    created_at: new Date().toISOString(),
    user_name: userName || 'Unknown',
  };
  const all = getAll();
  all.unshift(entry);
  saveAll(all);
  return entry;
}

export function logImport({ entity, format, fileName, recordCount, successCount, failedCount, errors, userName }) {
  const failed = failedCount || 0;
  const success = successCount || 0;
  let status = 'success';
  if (failed > 0 && success === 0) status = 'failed';
  else if (failed > 0 && success > 0) status = 'partial';

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'import',
    entity,
    format,
    fileName,
    recordCount: recordCount || (success + failed),
    successCount: success,
    failedCount: failed,
    status,
    errors: errors || [],
    created_at: new Date().toISOString(),
    user_name: userName || 'Unknown',
  };
  const all = getAll();
  all.unshift(entry);
  saveAll(all);
  return entry;
}

export function getHistory({ limit = 20, offset = 0, type, entity, search } = {}) {
  let entries = getAll();

  if (type && type !== 'all') {
    entries = entries.filter(e => e.type === type);
  }
  if (entity && entity !== 'all') {
    entries = entries.filter(e => e.entity === entity);
  }
  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter(e =>
      (e.fileName || '').toLowerCase().includes(q) ||
      (e.entity || '').toLowerCase().includes(q) ||
      (e.user_name || '').toLowerCase().includes(q)
    );
  }

  const total = entries.length;
  const data = entries.slice(offset, offset + limit);
  return { data, total };
}

export function clearHistory() {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
}

export function getStats() {
  const entries = getAll();
  const totalExports = entries.filter(e => e.type === 'export').length;
  const totalImports = entries.filter(e => e.type === 'import').length;
  const successCount = entries.filter(e => e.status === 'success').length;
  const successRate = entries.length > 0 ? Math.round((successCount / entries.length) * 100) : 0;

  // Most active entity
  const entityCounts = {};
  entries.forEach(e => {
    entityCounts[e.entity] = (entityCounts[e.entity] || 0) + 1;
  });
  let mostActiveEntity = null;
  let maxCount = 0;
  Object.entries(entityCounts).forEach(([ent, count]) => {
    if (count > maxCount) { mostActiveEntity = ent; maxCount = count; }
  });

  return {
    total: entries.length,
    totalExports,
    totalImports,
    successRate,
    mostActiveEntity,
    mostActiveEntityCount: maxCount,
  };
}
