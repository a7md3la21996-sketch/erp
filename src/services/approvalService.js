import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import supabase from '../lib/supabase';
import { createNotification } from './notificationsService';
import { logAction } from './auditService';
import { requirePerm, currentProfile } from '../utils/permissionGuard';
import { P } from '../config/roles';

/** Default auto-approve threshold (amount below this is auto-approved) */
export async function getAutoApproveThreshold() {
  try {
    const { data } = await supabase.from('system_config').select('value').eq('key', 'approval_config').maybeSingle();
    if (data?.value?.autoApproveThreshold != null) return data.value.autoApproveThreshold;
  } catch (err) {
    reportError('approvalService', 'getAutoApproveThreshold', err);
  }
  return 50000;
}

export async function setAutoApproveThreshold(val) {
  // Auto-approve threshold is a system-wide config: who can approve below
  // it without a real approval flow. Admin-only — allowing any user to
  // raise the threshold would let them auto-approve their own requests.
  requirePerm(P.SETTINGS_MANAGE, 'Not allowed to change approval threshold');
  try {
    const { data: existing } = await supabase.from('system_config').select('value').eq('key', 'approval_config').maybeSingle();
    const cfg = existing?.value || {};
    cfg.autoApproveThreshold = val;
    await supabase.from('system_config').upsert({ key: 'approval_config', value: cfg, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (err) {
    reportError('approvalService', 'setAutoApproveThreshold', err);
  }
}

/** Escalation hours (pending longer than this gets escalated) */
export async function getEscalationHours() {
  try {
    const { data } = await supabase.from('system_config').select('value').eq('key', 'approval_config').maybeSingle();
    if (data?.value?.escalationHours != null) return data.value.escalationHours;
  } catch (err) {
    reportError('approvalService', 'getEscalationHours', err);
  }
  return 48;
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
  // Override requesterId/requesterName from the session — any user can
  // submit a request, but they can only do so as themselves. Without this,
  // a sales agent could create a "leave request" attributed to a colleague.
  const profile = currentProfile();
  if (profile) {
    if (profile.id) requesterId = profile.id;
    requesterName = profile.full_name_ar || profile.full_name_en || requesterName || '';
  }

  const threshold = await getAutoApproveThreshold();
  const numAmount = Number(amount) || 0;
  const shouldAutoApprove = numAmount > 0 && numAmount < threshold && ['deal', 'quote', 'discount'].includes(type);

  // Map local field names to Supabase column names
  const sbApproval = {
    type,
    entity_type: type,
    entity_id: entity_id || data?.entity_id || '',
    entity_name: entity_name || data?.entity_name || '',
    requested_by: requesterId,
    requested_by_name: requesterName || '',
    amount: numAmount,
    status: shouldAutoApprove ? 'approved' : 'pending',
    priority: priority || 'normal',
    comment: notes || (shouldAutoApprove ? 'Auto-approved (below threshold)' : ''),
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase.from('approvals').insert([stripInternalFields(sbApproval)]).select('*').single();
  if (error) {
    reportError('approvalService', 'createApproval', error);
    throw error;
  }

  const approval = inserted || sbApproval;
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
  // Generic updateApproval is an admin-only escape hatch. Normal flow
  // goes through approveRequest / rejectRequest which have their own
  // session-based identity overrides. Letting any user POST arbitrary
  // updates would let them flip status without an audit trail.
  requirePerm(P.SETTINGS_MANAGE, 'Not allowed to update approvals directly');
  // Map code field names to Supabase column names
  const sbUpdates = {};
  if (updates.status) sbUpdates.status = updates.status;
  if (updates.comments || updates.notes) sbUpdates.comment = updates.comments || updates.notes;
  if (updates.resolved_at) sbUpdates.approved_at = updates.resolved_at;
  if (updates.status === 'rejected' && updates.resolved_at) sbUpdates.rejected_at = updates.resolved_at;

  const { data, error } = await supabase
    .from('approvals')
    .update(sbUpdates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    reportError('approvalService', 'updateApproval', error);
    throw error;
  }

  window.dispatchEvent(new CustomEvent('platform_approval_change', { detail: data }));
  return data;
}

/**
 * Get approvals with optional filters
 */
export async function getApprovals(filters = {}) {
  let query = supabase
    .from('approvals')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status)      query = query.eq('status', filters.status);
  if (filters.type)        query = query.eq('type', filters.type);
  if (filters.priority)    query = query.eq('priority', filters.priority);
  if (filters.approverId)  query = query.eq('approved_by', filters.approverId);
  if (filters.requesterId) query = query.eq('requested_by', filters.requesterId);

  const { data, error } = await query.range(0, 199);
  if (error) {
    reportError('approvalService', 'getApprovals', error);
    throw error;
  }
  return data || [];
}

/**
 * Find the approval linked to a specific entity
 */
export async function getApprovalByEntity(type, entityId) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('type', type)
    .eq('entity_id', entityId)
    .limit(1)
    .maybeSingle();
  if (error) {
    reportError('approvalService', 'getApprovalByEntity', error);
    throw error;
  }
  return data || null;
}

/**
 * Get all approvals for a specific entity (there may be multiple)
 */
export async function getApprovalsByEntity(entityId) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    reportError('approvalService', 'getApprovalsByEntity', error);
    throw error;
  }
  return data || [];
}

/**
 * Get pending approvals for a given approver
 */
export async function getPendingByApprover(approverId) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('status', 'pending')
    .eq('approved_by', approverId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    reportError('approvalService', 'getPendingByApprover', error);
    throw error;
  }
  return data || [];
}

/**
 * Approve a request
 */
export async function approveRequest(id, approverName, comments) {
  // Override approverName from session profile so the audit trail
  // reflects who actually clicked Approve (not whatever the client sent).
  // Per-row authority — "is this user the assigned approver?" — is
  // enforced by RLS on the approvals table.
  const profile = currentProfile();
  if (profile) approverName = profile.full_name_ar || profile.full_name_en || approverName;
  const resolvedAt = new Date().toISOString();
  const { data: approval, error } = await supabase
    .from('approvals')
    .update({
      status: 'approved',
      approver_name: approverName,
      comments: comments || '',
      resolved_at: resolvedAt,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    reportError('approvalService', 'approveRequest', error);
    throw error;
  }

  if (!approval) return null;

  createNotification({
    type: 'system',
    title_ar: 'تمت الموافقة على طلبك',
    title_en: 'Your Request Was Approved',
    body_ar: `${approverName} وافق على طلبك`,
    body_en: `${approverName} approved your request`,
    for_user_id: approval.requester_id || approval.requested_by,
    entity_type: 'approval',
    entity_id: approval.id,
    from_user: approverName,
  });

  logAction({
    action: 'update',
    entity: 'approval',
    entityId: id,
    entityName: `${approval.type} approval`,
    description: `${approverName} approved ${approval.type} request`,
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
  // Override approverName from session — same reasoning as approveRequest.
  const profile = currentProfile();
  if (profile) approverName = profile.full_name_ar || profile.full_name_en || approverName;
  const resolvedAt = new Date().toISOString();
  const { data: approval, error } = await supabase
    .from('approvals')
    .update({
      status: 'rejected',
      approver_name: approverName,
      comments: comments || '',
      resolved_at: resolvedAt,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    reportError('approvalService', 'rejectRequest', error);
    throw error;
  }

  if (!approval) return null;

  createNotification({
    type: 'system',
    title_ar: 'تم رفض طلبك',
    title_en: 'Your Request Was Rejected',
    body_ar: `${approverName} رفض طلبك${comments ? ': ' + comments : ''}`,
    body_en: `${approverName} rejected your request${comments ? ': ' + comments : ''}`,
    for_user_id: approval.requester_id || approval.requested_by,
    entity_type: 'approval',
    entity_id: approval.id,
    from_user: approverName,
  });

  logAction({
    action: 'update',
    entity: 'approval',
    entityId: id,
    entityName: `${approval.type} approval`,
    description: `${approverName} rejected ${approval.type} request`,
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
  const hours = await getEscalationHours();
  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

  // Fetch stale pending approvals
  const { data: stale, error: fetchErr } = await supabase
    .from('approvals')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', cutoff);
  if (fetchErr) {
    reportError('approvalService', 'escalateStaleApprovals', fetchErr);
    return;
  }

  if (!stale || stale.length === 0) return;

  for (const item of stale) {
    const { error } = await supabase
      .from('approvals')
      .update({ status: 'escalated' })
      .eq('id', item.id);
    if (error) {
      reportError('approvalService', 'escalateStaleApprovals', error);
    }
  }

  window.dispatchEvent(new CustomEvent('platform_approval_change'));
}

/**
 * Get count of pending approvals (optionally for a specific approver)
 */
export async function getPendingCount(approverId) {
  let query = supabase
    .from('approvals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (approverId) query = query.eq('approved_by', approverId);
  const { count, error } = await query;
  if (error) {
    reportError('approvalService', 'getPendingCount', error);
    throw error;
  }
  return count || 0;
}

/**
 * Get approval statistics
 */
export async function getApprovalStats() {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .range(0, 499);
  if (error) {
    reportError('approvalService', 'getApprovalStats', error);
    throw error;
  }
  return computeStats(data || []);
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
