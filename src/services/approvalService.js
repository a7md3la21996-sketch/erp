import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { createNotification } from './notificationsService';
import { logAction } from './auditService';

const STORAGE_KEY = 'platform_approvals';
const CONFIG_KEY = 'platform_approval_config';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, 200);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  } catch { return {}; }
}

/** Default auto-approve threshold (amount below this is auto-approved) */
export function getAutoApproveThreshold() {
  const cfg = loadConfig();
  return cfg.autoApproveThreshold ?? 50000;
}

export function setAutoApproveThreshold(val) {
  const cfg = loadConfig();
  cfg.autoApproveThreshold = val;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

/** Escalation hours (pending longer than this gets escalated) */
export function getEscalationHours() {
  const cfg = loadConfig();
  return cfg.escalationHours ?? 48;
}

/** Approval types */
export const APPROVAL_TYPES = ['deal', 'quote', 'discount', 'refund', 'leave', 'expense', 'purchase', 'overtime'];

/** Approval statuses */
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'escalated'];

/** Type labels */
export const TYPE_LABELS = {
  deal:     { ar: 'صفقة',       en: 'Deal' },
  quote:    { ar: 'عرض سعر',    en: 'Quote' },
  discount: { ar: 'خصم',        en: 'Discount' },
  refund:   { ar: 'استرداد',     en: 'Refund' },
  leave:    { ar: 'إجازة',      en: 'Leave' },
  expense:  { ar: 'مصروف',      en: 'Expense' },
  purchase: { ar: 'شراء',       en: 'Purchase' },
  overtime: { ar: 'عمل إضافي',  en: 'Overtime' },
};

/**
 * Create an approval request
 */
export async function createApproval({ type, requesterId, requesterName, data, approverId, approverName, entity_id, entity_name, amount, priority, notes, chain }) {
  const threshold = getAutoApproveThreshold();
  const numAmount = Number(amount) || 0;
  const shouldAutoApprove = numAmount > 0 && numAmount < threshold && ['deal', 'quote', 'discount'].includes(type);

  const approval = {
    id: 'apr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    type,
    entity_id: entity_id || data?.entity_id || '',
    entity_name: entity_name || data?.entity_name || '',
    requester_id: requesterId,
    requester_name: requesterName || '',
    approver_id: approverId,
    approver_name: approverName || '',
    amount: numAmount,
    status: shouldAutoApprove ? 'approved' : 'pending',
    priority: priority || 'normal',
    notes: notes || '',
    data: data || {},
    comments: shouldAutoApprove ? 'Auto-approved (below threshold)' : '',
    chain: chain || [{ level: 1, approver: approverName || approverId || '', status: shouldAutoApprove ? 'approved' : 'pending', date: new Date().toISOString() }],
    created_at: new Date().toISOString(),
    resolved_at: shouldAutoApprove ? new Date().toISOString() : null,
  };

  // Optimistic localStorage save
  const list = load();
  list.unshift(approval);
  save(list);

  // Try Supabase
  try {
    const { error } = await supabase
      .from('approvals')
      .insert([approval]);
    if (error) throw error;
  } catch (err) { reportError('approvalService', 'query', err);
    // localStorage already saved
  }

  const tl = TYPE_LABELS[type] || { ar: type, en: type };

  if (!shouldAutoApprove) {
    createNotification({
      type: 'system',
      title_ar: `طلب موافقة جديد - ${tl.ar}`,
      title_en: `New Approval Request - ${tl.en}`,
      body_ar: `${requesterName} قدّم طلب ${tl.ar} بانتظار موافقتك`,
      body_en: `${requesterName} submitted a ${tl.en.toLowerCase()} request awaiting your approval`,
      for_user_id: approverId,
      entity_type: 'approval',
      entity_id: approval.id,
      from_user: requesterId,
    });
  }

  logAction({
    action: 'create',
    entity: 'approval',
    entityId: approval.id,
    entityName: `${tl.en} request - ${entity_name || ''}`,
    description: shouldAutoApprove
      ? `Auto-approved ${tl.en.toLowerCase()} (${numAmount.toLocaleString()} below threshold ${threshold.toLocaleString()})`
      : `${requesterName} created ${tl.en.toLowerCase()} approval request`,
    newValue: approval,
    userName: requesterName,
  });

  window.dispatchEvent(new CustomEvent('platform_approval_change', { detail: approval }));

  return approval;
}

/**
 * Update an approval record with arbitrary fields
 */
export async function updateApproval(id, updates) {
  // Optimistic localStorage update
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  Object.assign(list[idx], updates);
  save(list);

  try {
    const { error } = await supabase
      .from('approvals')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('approvalService', 'query', err);
    // localStorage already saved
  }

  window.dispatchEvent(new CustomEvent('platform_approval_change', { detail: list[idx] }));
  return list[idx];
}

/**
 * Get approvals with optional filters
 */
export async function getApprovals(filters = {}) {
  try {
    let query = supabase
      .from('approvals')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status)      query = query.eq('status', filters.status);
    if (filters.type)        query = query.eq('type', filters.type);
    if (filters.priority)    query = query.eq('priority', filters.priority);
    if (filters.approverId)  query = query.eq('approver_id', filters.approverId);
    if (filters.requesterId) query = query.eq('requester_id', filters.requesterId);

    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      save(data); // sync to localStorage
      return data;
    }
  } catch (err) { reportError('approvalService', 'query', err);
    // fallback to localStorage
  }

  let list = load();
  if (filters.status)      list = list.filter(a => a.status === filters.status);
  if (filters.type)        list = list.filter(a => a.type === filters.type);
  if (filters.priority)    list = list.filter(a => a.priority === filters.priority);
  if (filters.approverId)  list = list.filter(a => a.approver_id === filters.approverId);
  if (filters.requesterId) list = list.filter(a => a.requester_id === filters.requesterId);
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Find the approval linked to a specific entity
 */
export async function getApprovalByEntity(type, entityId) {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('type', type)
      .eq('entity_id', entityId)
      .limit(1)
      .single();
    if (error) throw error;
    return data || null;
  } catch (err) { reportError('approvalService', 'query', err);
    // fallback to localStorage
  }
  const list = load();
  return list.find(a => a.type === type && (a.entity_id === entityId || a.data?.entity_id === entityId));
}

/**
 * Get all approvals for a specific entity (there may be multiple)
 */
export async function getApprovalsByEntity(entityId) {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('approvalService', 'query', err);
    // fallback to localStorage
  }
  const list = load();
  return list.filter(a => a.entity_id === entityId || a.data?.entity_id === entityId);
}

/**
 * Get pending approvals for a given approver
 */
export async function getPendingByApprover(approverId) {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('status', 'pending')
      .eq('approver_id', approverId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('approvalService', 'query', err);
    // fallback to localStorage
  }
  const list = load();
  return list.filter(a => a.status === 'pending' && a.approver_id === approverId);
}

/**
 * Approve a request
 */
export async function approveRequest(id, approverName, comments) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;

  const old = { ...list[idx] };
  list[idx].status = 'approved';
  list[idx].approver_name = approverName || list[idx].approver_name;
  list[idx].comments = comments || '';
  list[idx].resolved_at = new Date().toISOString();
  // Update chain
  if (list[idx].chain?.length) {
    const pendingStep = list[idx].chain.find(s => s.status === 'pending');
    if (pendingStep) { pendingStep.status = 'approved'; pendingStep.date = new Date().toISOString(); pendingStep.approver = approverName; }
  }
  save(list);

  const approval = list[idx];

  // Try Supabase
  try {
    const { error } = await supabase
      .from('approvals')
      .update({
        status: 'approved',
        approver_name: approval.approver_name,
        comments: approval.comments,
        resolved_at: approval.resolved_at,
        chain: approval.chain,
      })
      .eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('approvalService', 'query', err);
    // localStorage already saved
  }

  createNotification({
    type: 'system',
    title_ar: 'تمت الموافقة على طلبك',
    title_en: 'Your Request Was Approved',
    body_ar: `${approverName} وافق على طلبك`,
    body_en: `${approverName} approved your request`,
    for_user_id: approval.requester_id,
    entity_type: 'approval',
    entity_id: approval.id,
    from_user: approverName,
  });

  logAction({
    action: 'update',
    entity: 'approval',
    entityId: id,
    entityName: `${approval.type} approval`,
    description: `${approverName} approved ${approval.type} request from ${approval.requester_name}`,
    oldValue: old,
    newValue: approval,
    userName: approverName,
  });

  window.dispatchEvent(new CustomEvent('platform_approval_change', { detail: approval }));
  return approval;
}

/**
 * Reject a request
 */
export async function rejectRequest(id, approverName, comments) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;

  const old = { ...list[idx] };
  list[idx].status = 'rejected';
  list[idx].approver_name = approverName || list[idx].approver_name;
  list[idx].comments = comments || '';
  list[idx].resolved_at = new Date().toISOString();
  if (list[idx].chain?.length) {
    const pendingStep = list[idx].chain.find(s => s.status === 'pending');
    if (pendingStep) { pendingStep.status = 'rejected'; pendingStep.date = new Date().toISOString(); pendingStep.approver = approverName; }
  }
  save(list);

  const approval = list[idx];

  // Try Supabase
  try {
    const { error } = await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        approver_name: approval.approver_name,
        comments: approval.comments,
        resolved_at: approval.resolved_at,
        chain: approval.chain,
      })
      .eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('approvalService', 'query', err);
    // localStorage already saved
  }

  createNotification({
    type: 'system',
    title_ar: 'تم رفض طلبك',
    title_en: 'Your Request Was Rejected',
    body_ar: `${approverName} رفض طلبك${comments ? ': ' + comments : ''}`,
    body_en: `${approverName} rejected your request${comments ? ': ' + comments : ''}`,
    for_user_id: approval.requester_id,
    entity_type: 'approval',
    entity_id: approval.id,
    from_user: approverName,
  });

  logAction({
    action: 'update',
    entity: 'approval',
    entityId: id,
    entityName: `${approval.type} approval`,
    description: `${approverName} rejected ${approval.type} request from ${approval.requester_name}`,
    oldValue: old,
    newValue: approval,
    userName: approverName,
  });

  window.dispatchEvent(new CustomEvent('platform_approval_change', { detail: approval }));
  return approval;
}

/**
 * Escalate stale pending approvals (pending > escalation hours)
 */
export async function escalateStaleApprovals() {
  const list = load();
  const hours = getEscalationHours();
  const cutoff = Date.now() - hours * 3600000;
  let changed = false;
  const escalatedIds = [];
  list.forEach(a => {
    if (a.status === 'pending' && new Date(a.created_at).getTime() < cutoff) {
      a.status = 'escalated';
      if (a.chain?.length) {
        const pendingStep = a.chain.find(s => s.status === 'pending');
        if (pendingStep) { pendingStep.status = 'escalated'; pendingStep.date = new Date().toISOString(); }
      }
      escalatedIds.push(a.id);
      changed = true;
    }
  });
  if (changed) {
    save(list);

    // Try Supabase for each escalated approval
    for (const id of escalatedIds) {
      const item = list.find(a => a.id === id);
      try {
        await supabase
          .from('approvals')
          .update({ status: 'escalated', chain: item?.chain })
          .eq('id', id);
      } catch (err) { reportError('approvalService', 'query', err);
        // localStorage already saved
      }
    }

    window.dispatchEvent(new CustomEvent('platform_approval_change'));
  }
}

/**
 * Get count of pending approvals (optionally for a specific approver)
 */
export async function getPendingCount(approverId) {
  try {
    let query = supabase
      .from('approvals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (approverId) query = query.eq('approver_id', approverId);
    const { count, error } = await query;
    if (error) throw error;
    if (count !== null) return count;
  } catch (err) { reportError('approvalService', 'query', err);
    // fallback to localStorage
  }
  const list = load();
  if (approverId) return list.filter(a => a.status === 'pending' && a.approver_id === approverId).length;
  return list.filter(a => a.status === 'pending').length;
}

/**
 * Get approval statistics
 */
export async function getApprovalStats() {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*');
    if (error) throw error;
    if (data) {
      save(data); // sync to localStorage
      return computeStats(data);
    }
  } catch (err) { reportError('approvalService', 'query', err);
    // fallback to localStorage
  }
  return computeStats(load());
}

function computeStats(list) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const pending = list.filter(a => a.status === 'pending').length;
  const escalated = list.filter(a => a.status === 'escalated').length;
  const approvedToday = list.filter(a => a.status === 'approved' && a.resolved_at && a.resolved_at >= todayStart).length;
  const rejectedToday = list.filter(a => a.status === 'rejected' && a.resolved_at && a.resolved_at >= todayStart).length;

  // Avg response time (hours) for resolved approvals
  const resolved = list.filter(a => a.resolved_at && a.created_at);
  let avgResponseHours = 0;
  if (resolved.length) {
    const total = resolved.reduce((s, a) => s + (new Date(a.resolved_at) - new Date(a.created_at)), 0);
    avgResponseHours = Math.round(total / resolved.length / 3600000 * 10) / 10;
  }

  return { pending, escalated, approvedToday, rejectedToday, avgResponseHours, total: list.length };
}
