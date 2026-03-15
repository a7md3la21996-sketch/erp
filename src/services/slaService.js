const POLICIES_KEY = 'platform_sla_policies';
const TICKETS_KEY = 'platform_sla_tickets';
const MAX_TICKETS = 500;
const EVENT_NAME = 'platform_sla_changed';

function dispatch() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

// ── localStorage helpers ──────────────────────────────────────────────
function readJSON(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function writeJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      if (Array.isArray(data) && data.length > 250) {
        data.length = 250;
        try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* give up */ }
      }
    }
  }
}

function genId() {
  return 'sla_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Default policies ──────────────────────────────────────────────────
const DEFAULT_POLICIES = [
  {
    id: 'default_urgent',
    name: 'سياسة عاجلة',
    nameEn: 'Urgent Policy',
    description: 'استجابة فورية وحل سريع للمسائل العاجلة',
    entity: 'ticket',
    priority: 'urgent',
    firstResponseTime: 30,
    resolutionTime: 240,
    escalationLevels: [
      { level: 1, afterMinutes: 15, notifyRole: 'manager' },
      { level: 2, afterMinutes: 30, notifyRole: 'director' },
    ],
    active: true,
    builtIn: true,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'default_high',
    name: 'سياسة عالية',
    nameEn: 'High Priority Policy',
    description: 'استجابة سريعة للمسائل ذات الأولوية العالية',
    entity: 'ticket',
    priority: 'high',
    firstResponseTime: 60,
    resolutionTime: 480,
    escalationLevels: [
      { level: 1, afterMinutes: 30, notifyRole: 'manager' },
      { level: 2, afterMinutes: 60, notifyRole: 'director' },
    ],
    active: true,
    builtIn: true,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'default_medium',
    name: 'سياسة متوسطة',
    nameEn: 'Medium Priority Policy',
    description: 'وقت استجابة معتدل للمسائل المتوسطة',
    entity: 'ticket',
    priority: 'medium',
    firstResponseTime: 240,
    resolutionTime: 1440,
    escalationLevels: [
      { level: 1, afterMinutes: 120, notifyRole: 'manager' },
    ],
    active: true,
    builtIn: true,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'default_low',
    name: 'سياسة منخفضة',
    nameEn: 'Low Priority Policy',
    description: 'وقت استجابة مرن للمسائل المنخفضة الأولوية',
    entity: 'ticket',
    priority: 'low',
    firstResponseTime: 480,
    resolutionTime: 2880,
    escalationLevels: [],
    active: true,
    builtIn: true,
    created_at: '2024-01-01T00:00:00.000Z',
  },
];

function ensureDefaults() {
  const policies = readJSON(POLICIES_KEY, []);
  if (policies.length === 0) {
    writeJSON(POLICIES_KEY, DEFAULT_POLICIES);
    return DEFAULT_POLICIES;
  }
  // Ensure built-in policies exist
  const ids = new Set(policies.map(p => p.id));
  let added = false;
  for (const dp of DEFAULT_POLICIES) {
    if (!ids.has(dp.id)) {
      policies.push(dp);
      added = true;
    }
  }
  if (added) writeJSON(POLICIES_KEY, policies);
  return policies;
}

// ── Policies CRUD ─────────────────────────────────────────────────────
export function getPolicies() {
  return ensureDefaults();
}

export function getPolicy(id) {
  return ensureDefaults().find(p => p.id === id) || null;
}

export function createPolicy(data) {
  const policies = ensureDefaults();
  const policy = {
    ...data,
    id: genId(),
    builtIn: false,
    created_at: new Date().toISOString(),
  };
  policies.push(policy);
  writeJSON(POLICIES_KEY, policies);
  dispatch();
  return policy;
}

export function updatePolicy(id, data) {
  const policies = ensureDefaults();
  const idx = policies.findIndex(p => p.id === id);
  if (idx === -1) return null;
  policies[idx] = { ...policies[idx], ...data, id, builtIn: policies[idx].builtIn };
  writeJSON(POLICIES_KEY, policies);
  dispatch();
  return policies[idx];
}

export function deletePolicy(id) {
  const policies = ensureDefaults();
  const policy = policies.find(p => p.id === id);
  if (!policy || policy.builtIn) return false;
  writeJSON(POLICIES_KEY, policies.filter(p => p.id !== id));
  dispatch();
  return true;
}

// ── Tickets CRUD ──────────────────────────────────────────────────────
function getAllTickets() {
  return readJSON(TICKETS_KEY, []);
}

function saveTickets(tickets) {
  if (tickets.length > MAX_TICKETS) tickets.length = MAX_TICKETS;
  writeJSON(TICKETS_KEY, tickets);
}

export function getTickets({ limit = 15, offset = 0, status, priority, entity, breached, search } = {}) {
  let tickets = getAllTickets();

  if (status) tickets = tickets.filter(t => t.status === status);
  if (priority) tickets = tickets.filter(t => t.priority === priority);
  if (entity) tickets = tickets.filter(t => t.entityType === entity);
  if (breached === true || breached === 'true') tickets = tickets.filter(t => t.breached);
  if (search) {
    const q = search.toLowerCase();
    tickets = tickets.filter(t =>
      (t.entityName || '').toLowerCase().includes(q) ||
      (t.assignedTo || '').toLowerCase().includes(q)
    );
  }

  // Sort newest first
  tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { data: tickets.slice(offset, offset + limit), total: tickets.length };
}

export function createTicket({ policyId, entityType, entityId, entityName, assignedTo, priority }) {
  const policy = getPolicy(policyId);
  if (!policy) return null;

  const now = new Date();
  const ticket = {
    id: genId(),
    policyId,
    entityType,
    entityId,
    entityName,
    assignedTo,
    priority: priority || policy.priority,
    status: 'open',
    firstResponseAt: null,
    resolvedAt: null,
    firstResponseDeadline: new Date(now.getTime() + policy.firstResponseTime * 60000).toISOString(),
    resolutionDeadline: new Date(now.getTime() + policy.resolutionTime * 60000).toISOString(),
    breached: false,
    escalationLevel: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const tickets = getAllTickets();
  tickets.unshift(ticket);
  saveTickets(tickets);
  dispatch();
  return ticket;
}

export function respondToTicket(id) {
  const tickets = getAllTickets();
  const ticket = tickets.find(t => t.id === id);
  if (!ticket || ticket.firstResponseAt) return null;

  ticket.firstResponseAt = new Date().toISOString();
  ticket.status = ticket.status === 'open' ? 'in_progress' : ticket.status;
  ticket.updated_at = new Date().toISOString();
  saveTickets(tickets);
  dispatch();
  return ticket;
}

export function resolveTicket(id) {
  const tickets = getAllTickets();
  const ticket = tickets.find(t => t.id === id);
  if (!ticket || ticket.status === 'resolved') return null;

  ticket.resolvedAt = new Date().toISOString();
  ticket.status = 'resolved';
  ticket.updated_at = new Date().toISOString();
  saveTickets(tickets);
  dispatch();
  return ticket;
}

export function checkBreaches() {
  const tickets = getAllTickets();
  const now = new Date();
  const newlyBreached = [];

  for (const ticket of tickets) {
    if (ticket.status === 'resolved') continue;

    // Check first response breach
    if (!ticket.firstResponseAt && new Date(ticket.firstResponseDeadline) < now) {
      if (!ticket.breached) {
        ticket.breached = true;
        ticket.status = 'breached';
        ticket.updated_at = now.toISOString();
        newlyBreached.push(ticket);
      }
    }

    // Check resolution breach
    if (ticket.status !== 'resolved' && new Date(ticket.resolutionDeadline) < now) {
      if (!ticket.breached) {
        ticket.breached = true;
        ticket.status = 'breached';
        ticket.updated_at = now.toISOString();
        newlyBreached.push(ticket);
      }
    }

    // Check escalation
    const policy = getPolicy(ticket.policyId);
    if (policy && policy.escalationLevels) {
      const elapsedMinutes = (now - new Date(ticket.created_at)) / 60000;
      for (const esc of policy.escalationLevels) {
        if (esc.level > ticket.escalationLevel && elapsedMinutes >= esc.afterMinutes && ticket.status !== 'resolved') {
          ticket.escalationLevel = esc.level;
          if (ticket.status !== 'breached') ticket.status = 'escalated';
          ticket.updated_at = now.toISOString();
        }
      }
    }
  }

  saveTickets(tickets);
  if (newlyBreached.length > 0) dispatch();
  return newlyBreached;
}

export function getStats() {
  const tickets = getAllTickets();
  const total = tickets.length;
  if (total === 0) return { complianceRate: 100, avgResponseTime: 0, avgResolutionTime: 0, totalBreached: 0, activeTickets: 0 };

  const breachedCount = tickets.filter(t => t.breached).length;
  const active = tickets.filter(t => !['resolved'].includes(t.status)).length;

  // Average response time (minutes) for tickets with first response
  const responded = tickets.filter(t => t.firstResponseAt);
  const avgResponse = responded.length > 0
    ? responded.reduce((sum, t) => sum + (new Date(t.firstResponseAt) - new Date(t.created_at)) / 60000, 0) / responded.length
    : 0;

  // Average resolution time (minutes) for resolved tickets
  const resolved = tickets.filter(t => t.resolvedAt);
  const avgResolution = resolved.length > 0
    ? resolved.reduce((sum, t) => sum + (new Date(t.resolvedAt) - new Date(t.created_at)) / 60000, 0) / resolved.length
    : 0;

  const complianceRate = total > 0 ? Math.round(((total - breachedCount) / total) * 100) : 100;

  return {
    complianceRate,
    avgResponseTime: Math.round(avgResponse),
    avgResolutionTime: Math.round(avgResolution),
    totalBreached: breachedCount,
    activeTickets: active,
  };
}

export function getSLAPerformance(days = 30) {
  const tickets = getAllTickets();
  const now = new Date();
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayTickets = tickets.filter(t => t.created_at.startsWith(dateStr));
    const total = dayTickets.length;
    const breached = dayTickets.filter(t => t.breached).length;
    const compliance = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

    result.push({
      date: dateStr,
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      total,
      breached,
      compliance,
    });
  }

  return result;
}

export function getTicketById(id) {
  return getAllTickets().find(t => t.id === id) || null;
}
