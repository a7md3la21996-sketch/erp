import { useMemo, useState, useEffect } from 'react';
import { getLocalAuditLogs, ACTION_TYPES } from '../services/auditService';

/**
 * useAuditFilter – adds action history filters to any page's SmartFilter.
 */
export function useAuditFilter(entityType) {
  const [allLogs, setAllLogs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getLocalAuditLogs({ limit: 500 }).then(result => {
      if (!cancelled) setAllLogs(result?.data || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entityType]);

  // Build audit index: Map<entity_id, log_entry[]>
  const { index, actionOptions, userOptions } = useMemo(() => {
    const entityLogs = (allLogs || []).filter(l => l.entity === entityType);

    const idx = new Map();
    const actions = new Set();
    const users = new Map();

    entityLogs.forEach(l => {
      const id = String(l.entity_id || '');
      if (!idx.has(id)) idx.set(id, []);
      idx.get(id).push(l);
      if (l.action) actions.add(l.action);
      if (l.user_name && !users.has(l.user_name)) users.set(l.user_name, l.user_name);
    });

    const actionOpts = [...actions].map(a => ({
      value: a,
      label: ACTION_TYPES[a]?.ar || a,
      labelEn: ACTION_TYPES[a]?.en || a,
    }));

    const userOpts = [...users.values()].map(u => ({
      value: u, label: u, labelEn: u,
    }));

    return { index: idx, actionOptions: actionOpts, userOptions: userOpts };
  }, [entityType, allLogs]);

  // SmartFilter field definitions
  const auditFields = useMemo(() => [
    { id: '_audit_action', label: 'نوع الإجراء', labelEn: 'Action Type', type: 'select', options: actionOptions },
    { id: '_audit_user', label: 'نفذه', labelEn: 'Action By', type: 'select', options: userOptions },
    { id: '_audit_date', label: 'تاريخ الإجراء', labelEn: 'Action Date', type: 'date' },
  ], [actionOptions, userOptions]);

  // Apply audit filters on data
  const applyAuditFilters = (data, smartFilters) => {
    const auditFilters = smartFilters.filter(f => f.field?.startsWith('_audit_'));
    if (auditFilters.length === 0) return data;

    return data.filter(item => {
      const id = String(item.id || '');
      const logs = index.get(id);
      if (!logs || logs.length === 0) return false;

      // Item passes if at least one log entry matches ALL audit filters
      return logs.some(log => auditFilters.every(f => matchLog(log, f)));
    });
  };

  return { auditFields, applyAuditFilters };
}

// ── Match a single log entry against a single filter ────────────────────
function matchLog(log, filter) {
  const { field, operator, value } = filter;

  if (field === '_audit_action') {
    return matchSelect(log.action, operator, value);
  }

  if (field === '_audit_user') {
    return matchSelect(log.user_name, operator, value);
  }

  if (field === '_audit_date') {
    return matchDate(log.created_at, operator, value);
  }

  return true;
}

function matchSelect(actual, operator, value) {
  if (operator === 'is') return actual === value;
  if (operator === 'is_not') return actual !== value;
  if (operator === 'in') return Array.isArray(value) ? value.includes(actual) : actual === value;
  if (operator === 'not_in') return Array.isArray(value) ? !value.includes(actual) : actual !== value;
  return true;
}

function matchDate(dateStr, operator, value) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  switch (operator) {
    case 'is': return dateStr.slice(0, 10) === value;
    case 'before': return d < new Date(value);
    case 'after': return d > new Date(value);
    case 'last_7': return (now - d) / 86400000 <= 7;
    case 'last_30': return (now - d) / 86400000 <= 30;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      return d >= weekStart;
    }
    case 'this_month':
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    default: return true;
  }
}
