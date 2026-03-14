import { createNotification } from './notificationsService';
import { logAction } from './auditService';

const STORAGE_KEY = 'platform_approvals';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, 100);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

/** Approval types */
export const APPROVAL_TYPES = ['leave', 'expense', 'purchase', 'overtime'];

/** Approval statuses */
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * Create an approval request
 * @param {object} opts
 * @param {'leave'|'expense'|'purchase'|'overtime'} opts.type
 * @param {string} opts.requesterId
 * @param {string} opts.requesterName
 * @param {object} opts.data - arbitrary payload (leave details, expense amount, etc.)
 * @param {string} opts.approverId
 * @param {string} [opts.approverName]
 * @returns {object} the created approval record
 */
export function createApproval({ type, requesterId, requesterName, data, approverId, approverName }) {
  const approval = {
    id: 'apr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    type,
    requester_id: requesterId,
    requester_name: requesterName || '',
    approver_id: approverId,
    approver_name: approverName || '',
    status: 'pending',
    data: data || {},
    comments: '',
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  const list = load();
  list.unshift(approval);
  save(list);

  // Notify the approver
  const typeLabels = {
    leave:    { ar: 'إجازة',    en: 'Leave' },
    expense:  { ar: 'مصروف',    en: 'Expense' },
    purchase: { ar: 'شراء',     en: 'Purchase' },
    overtime: { ar: 'عمل إضافي', en: 'Overtime' },
  };
  const tl = typeLabels[type] || { ar: type, en: type };

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

  logAction({
    action: 'create',
    entity: 'approval',
    entityId: approval.id,
    entityName: `${tl.en} request`,
    description: `${requesterName} created ${tl.en.toLowerCase()} approval request`,
    newValue: approval,
    userName: requesterName,
  });

  // Dispatch event for real-time UI
  window.dispatchEvent(new CustomEvent('platform_approval_change', { detail: approval }));

  return approval;
}

/**
 * Get approvals with optional filters
 * @param {object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.type]
 * @param {string} [filters.approverId]
 * @param {string} [filters.requesterId]
 * @returns {object[]}
 */
export function getApprovals(filters = {}) {
  let list = load();
  if (filters.status)      list = list.filter(a => a.status === filters.status);
  if (filters.type)        list = list.filter(a => a.type === filters.type);
  if (filters.approverId)  list = list.filter(a => a.approver_id === filters.approverId);
  if (filters.requesterId) list = list.filter(a => a.requester_id === filters.requesterId);
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Find the approval linked to a specific entity
 * @param {string} type - approval type
 * @param {string} entityId - the linked entity id (e.g. leave request id)
 * @returns {object|undefined}
 */
export function getApprovalByEntity(type, entityId) {
  const list = load();
  return list.find(a => a.type === type && a.data?.entity_id === entityId);
}

/**
 * Approve a request
 * @param {string} id - approval id
 * @param {string} approverName
 * @param {string} [comments]
 * @returns {object|null}
 */
export function approveRequest(id, approverName, comments) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;

  const old = { ...list[idx] };
  list[idx].status = 'approved';
  list[idx].approver_name = approverName || list[idx].approver_name;
  list[idx].comments = comments || '';
  list[idx].resolved_at = new Date().toISOString();
  save(list);

  const approval = list[idx];

  // Notify the requester
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
 * @param {string} id - approval id
 * @param {string} approverName
 * @param {string} [comments]
 * @returns {object|null}
 */
export function rejectRequest(id, approverName, comments) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;

  const old = { ...list[idx] };
  list[idx].status = 'rejected';
  list[idx].approver_name = approverName || list[idx].approver_name;
  list[idx].comments = comments || '';
  list[idx].resolved_at = new Date().toISOString();
  save(list);

  const approval = list[idx];

  // Notify the requester
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
 * Get count of pending approvals for a specific approver
 * @param {string} approverId
 * @returns {number}
 */
export function getPendingCount(approverId) {
  const list = load();
  return list.filter(a => a.status === 'pending' && a.approver_id === approverId).length;
}
