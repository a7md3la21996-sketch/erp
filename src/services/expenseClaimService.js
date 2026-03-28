import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { createApproval, getApprovalByEntity } from './approvalService';
import { logAction } from './auditService';

const STORAGE_KEY = 'platform_expense_claims';
const MAX_CLAIMS = 300;

// ── Category definitions ────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = {
  transportation:  { ar: 'مواصلات',       en: 'Transportation',   color: '#4A7AAB' },
  meals:           { ar: 'وجبات',         en: 'Meals',            color: '#F59E0B' },
  accommodation:   { ar: 'إقامة',         en: 'Accommodation',    color: '#6B8DB5' },
  office_supplies: { ar: 'مستلزمات مكتبية', en: 'Office Supplies', color: '#8B5CF6' },
  communication:   { ar: 'اتصالات',       en: 'Communication',    color: '#06B6D4' },
  training:        { ar: 'تدريب',         en: 'Training',         color: '#10B981' },
  travel:          { ar: 'سفر',           en: 'Travel',           color: '#2B4C6F' },
  medical:         { ar: 'طبي',           en: 'Medical',          color: '#EF4444' },
  other:           { ar: 'أخرى',          en: 'Other',            color: '#6B7280' },
};

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

// ── localStorage helpers ────────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_CLAIMS) list = list.slice(0, MAX_CLAIMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_CLAIMS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

// ── Sync claim statuses with approval service ───────────────────────────
function syncWithApprovals(claims) {
  let changed = false;
  claims.forEach(claim => {
    if (claim.status !== 'pending') return;
    const approval = getApprovalByEntity('expense', claim.id);
    if (!approval) return;
    if (approval.status === 'approved' && claim.status !== 'approved') {
      claim.status = 'approved';
      claim.approver_name = approval.approver_name;
      claim.approved_at = approval.resolved_at;
      changed = true;
    } else if (approval.status === 'rejected' && claim.status !== 'rejected') {
      claim.status = 'rejected';
      claim.approver_name = approval.approver_name;
      claim.rejected_reason = approval.comments || '';
      changed = true;
    }
  });
  if (changed) save(claims);
  return claims;
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createClaim({ title, category, amount, currency, date, description, receipt_ref, items, employee_id, employee_name }) {
  const claim = {
    id: 'exp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    title: title || '',
    category: category || 'other',
    amount: Number(amount) || 0,
    currency: currency || 'EGP',
    date: date || new Date().toISOString().slice(0, 10),
    description: description || '',
    receipt_ref: receipt_ref || '',
    items: items || [],
    employee_id: employee_id || '',
    employee_name: employee_name || '',
    status: 'pending',
    approver_name: '',
    approved_at: null,
    rejected_reason: '',
    created_at: new Date().toISOString(),
  };

  // Save to localStorage first (optimistic)
  try { const list = load(); list.unshift(claim); save(list); } catch {}

  let result = claim;
  // Try Supabase
  try {
    const { data: sbData, error } = await supabase.from('expense_claims').insert([claim]).select('*').single();
    if (error) throw error;
    result = sbData;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // localStorage already has it
  }

  // Create approval request
  createApproval({
    type: 'expense',
    requesterId: employee_id,
    requesterName: employee_name,
    data: { entity_id: result.id, title, category, amount: result.amount, currency: result.currency },
    approverId: 'manager_1',
    approverName: 'Manager',
  });

  logAction({
    action: 'create',
    entity: 'expense',
    entityId: result.id,
    entityName: title,
    description: `${employee_name} submitted expense claim: ${title} (${result.amount} ${result.currency})`,
    newValue: result,
    userName: employee_name,
  });

  return result;
}

export async function getClaims(filters = {}) {
  try {
    let query = supabase.from('expense_claims').select('*').order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.employee) query = query.or(`employee_id.eq.${filters.employee},employee_name.eq.${filters.employee}`);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date', filters.dateTo);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // Fallback to localStorage
    let list = syncWithApprovals(load());
    if (filters.status)    list = list.filter(c => c.status === filters.status);
    if (filters.employee)  list = list.filter(c => c.employee_id === filters.employee || c.employee_name === filters.employee);
    if (filters.category)  list = list.filter(c => c.category === filters.category);
    if (filters.dateFrom)  list = list.filter(c => c.date >= filters.dateFrom);
    if (filters.dateTo)    list = list.filter(c => c.date <= filters.dateTo);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export async function getClaimById(id) {
  try {
    const { data, error } = await supabase.from('expense_claims').select('*').eq('id', id).single();
    if (error) throw error;
    return data || null;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    const list = syncWithApprovals(load());
    return list.find(c => c.id === id) || null;
  }
}

export async function updateClaim(id, updates) {
  // Update localStorage (optimistic)
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;
  if (list[idx].status !== 'pending') return null;

  const old = { ...list[idx] };
  Object.assign(list[idx], updates, { id: old.id, created_at: old.created_at, status: old.status });
  save(list);

  let result = list[idx];
  // Try Supabase
  try {
    const safeUpdates = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.created_at;
    delete safeUpdates.status;
    const { data, error } = await supabase.from('expense_claims').update(safeUpdates).eq('id', id).select('*').single();
    if (error) throw error;
    result = data;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // localStorage already updated
  }

  logAction({
    action: 'update',
    entity: 'expense',
    entityId: id,
    entityName: result.title,
    description: `Updated expense claim: ${result.title}`,
    oldValue: old,
    newValue: result,
    userName: result.employee_name,
  });

  return result;
}

export async function deleteClaim(id) {
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return false;
  if (list[idx].status !== 'pending') return false;

  const removed = list[idx];
  list.splice(idx, 1);
  save(list);

  // Try Supabase
  try {
    const { error } = await supabase.from('expense_claims').delete().eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // localStorage already updated
  }

  logAction({
    action: 'delete',
    entity: 'expense',
    entityId: id,
    entityName: removed.title,
    description: `Deleted expense claim: ${removed.title}`,
    oldValue: removed,
    userName: removed.employee_name,
  });

  return true;
}

export async function approveClaim(id, approverName) {
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const old = { ...list[idx] };
  list[idx].status = 'approved';
  list[idx].approver_name = approverName;
  list[idx].approved_at = new Date().toISOString();
  save(list);

  let result = list[idx];
  // Try Supabase
  try {
    const { data, error } = await supabase.from('expense_claims').update({ status: 'approved', approver_name: approverName, approved_at: list[idx].approved_at }).eq('id', id).select('*').single();
    if (error) throw error;
    result = data;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // localStorage already updated
  }

  logAction({
    action: 'update',
    entity: 'expense',
    entityId: id,
    entityName: result.title,
    description: `${approverName} approved expense claim: ${result.title} (${result.amount} ${result.currency})`,
    oldValue: old,
    newValue: result,
    userName: approverName,
  });

  return result;
}

export async function rejectClaim(id, approverName, reason) {
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const old = { ...list[idx] };
  list[idx].status = 'rejected';
  list[idx].approver_name = approverName;
  list[idx].rejected_reason = reason || '';
  save(list);

  let result = list[idx];
  // Try Supabase
  try {
    const { data, error } = await supabase.from('expense_claims').update({ status: 'rejected', approver_name: approverName, rejected_reason: reason || '' }).eq('id', id).select('*').single();
    if (error) throw error;
    result = data;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // localStorage already updated
  }

  logAction({
    action: 'update',
    entity: 'expense',
    entityId: id,
    entityName: result.title,
    description: `${approverName} rejected expense claim: ${result.title}${reason ? ' — ' + reason : ''}`,
    oldValue: old,
    newValue: result,
    userName: approverName,
  });

  return result;
}

export async function markClaimPaid(id, userName) {
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1 || list[idx].status !== 'approved') return null;

  const old = { ...list[idx] };
  list[idx].status = 'paid';
  save(list);

  let result = list[idx];
  // Try Supabase
  try {
    const { data, error } = await supabase.from('expense_claims').update({ status: 'paid' }).eq('id', id).select('*').single();
    if (error) throw error;
    result = data;
  } catch (err) { reportError('expenseClaimService', 'query', err);
    // localStorage already updated
  }

  logAction({
    action: 'update',
    entity: 'expense',
    entityId: id,
    entityName: result.title,
    description: `Marked expense claim as paid: ${result.title} (${result.amount} ${result.currency})`,
    oldValue: old,
    newValue: result,
    userName: userName,
  });

  return result;
}

export async function getClaimStats() {
  let list;
  try {
    const { data, error } = await supabase.from('expense_claims').select('*');
    if (error) throw error;
    list = data || [];
  } catch (err) { reportError('expenseClaimService', 'query', err);
    list = syncWithApprovals(load());
  }
  const now = new Date();
  const thisMonth = list.filter(c => {
    const d = new Date(c.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const pending = list.filter(c => c.status === 'pending');
  const approved = list.filter(c => c.status === 'approved' || c.status === 'paid');
  const rejected = list.filter(c => c.status === 'rejected');

  return {
    totalCount: list.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, c) => s + c.amount, 0),
    approvedCount: approved.length,
    approvedAmount: approved.reduce((s, c) => s + c.amount, 0),
    rejectedCount: rejected.length,
    thisMonthCount: thisMonth.length,
    thisMonthAmount: thisMonth.reduce((s, c) => s + c.amount, 0),
  };
}

export async function getEmployeeClaims(employeeId) {
  return getClaims({ employee: employeeId });
}

// ── Mock data seeding ───────────────────────────────────────────────────
export function seedExpenseClaims() {
  const existing = load();
  if (existing.length > 0) return;

  const mockClaims = [
    { id: 'exp-mock-001', title: 'Airport taxi', category: 'transportation', amount: 350, currency: 'EGP', date: '2026-03-12', description: 'Taxi to Cairo airport for client meeting', receipt_ref: 'REC-001', items: [{ description: 'Taxi fare', amount: 300 }, { description: 'Toll', amount: 50 }], employee_id: 'e1', employee_name: 'Ahmed Mohamed', status: 'pending', approver_name: '', approved_at: null, rejected_reason: '', created_at: '2026-03-12T09:00:00Z' },
    { id: 'exp-mock-002', title: 'Client lunch meeting', category: 'meals', amount: 780, currency: 'EGP', date: '2026-03-10', description: 'Lunch with Al-Futtaim team', receipt_ref: 'REC-002', items: [{ description: 'Restaurant bill', amount: 680 }, { description: 'Beverages', amount: 100 }], employee_id: 'e2', employee_name: 'Sara Hassan', status: 'approved', approver_name: 'Manager', approved_at: '2026-03-11T14:00:00Z', rejected_reason: '', created_at: '2026-03-10T12:00:00Z' },
    { id: 'exp-mock-003', title: 'Office supplies restock', category: 'office_supplies', amount: 450, currency: 'EGP', date: '2026-03-08', description: 'Paper, pens, toner cartridge', receipt_ref: 'REC-003', items: [{ description: 'A4 Paper (5 reams)', amount: 200 }, { description: 'Pens box', amount: 50 }, { description: 'Toner cartridge', amount: 200 }], employee_id: 'e3', employee_name: 'Omar Ali', status: 'approved', approver_name: 'Manager', approved_at: '2026-03-09T10:00:00Z', rejected_reason: '', created_at: '2026-03-08T08:00:00Z' },
    { id: 'exp-mock-004', title: 'Team training workshop', category: 'training', amount: 2500, currency: 'EGP', date: '2026-03-05', description: 'Sales techniques workshop registration', receipt_ref: 'REC-004', items: [{ description: 'Workshop fee', amount: 2000 }, { description: 'Materials', amount: 500 }], employee_id: 'e1', employee_name: 'Ahmed Mohamed', status: 'rejected', approver_name: 'Manager', approved_at: null, rejected_reason: 'Budget exceeded for Q1 training', created_at: '2026-03-05T11:00:00Z' },
    { id: 'exp-mock-005', title: 'Alex business trip', category: 'travel', amount: 3200, currency: 'EGP', date: '2026-03-01', description: 'Alexandria round trip for project inspection', receipt_ref: 'REC-005', items: [{ description: 'Train tickets', amount: 400 }, { description: 'Hotel (2 nights)', amount: 2000 }, { description: 'Meals', amount: 800 }], employee_id: 'e4', employee_name: 'Fatma Khalil', status: 'paid', approver_name: 'Manager', approved_at: '2026-03-02T09:00:00Z', rejected_reason: '', created_at: '2026-03-01T07:00:00Z' },
    { id: 'exp-mock-006', title: 'Mobile phone bill', category: 'communication', amount: 250, currency: 'EGP', date: '2026-02-28', description: 'February business calls', receipt_ref: 'REC-006', items: [{ description: 'Phone plan', amount: 200 }, { description: 'Data package', amount: 50 }], employee_id: 'e2', employee_name: 'Sara Hassan', status: 'paid', approver_name: 'Manager', approved_at: '2026-03-01T08:00:00Z', rejected_reason: '', created_at: '2026-02-28T16:00:00Z' },
    { id: 'exp-mock-007', title: 'Hotel for conference', category: 'accommodation', amount: 4500, currency: 'EGP', date: '2026-02-25', description: 'RE Tech Conference accommodation', receipt_ref: 'REC-007', items: [{ description: 'Hotel (3 nights)', amount: 4500 }], employee_id: 'e1', employee_name: 'Ahmed Mohamed', status: 'approved', approver_name: 'Manager', approved_at: '2026-02-26T10:00:00Z', rejected_reason: '', created_at: '2026-02-25T09:00:00Z' },
    { id: 'exp-mock-008', title: 'Medical checkup', category: 'medical', amount: 600, currency: 'EGP', date: '2026-02-20', description: 'Annual health screening', receipt_ref: 'REC-008', items: [{ description: 'Lab tests', amount: 400 }, { description: 'Doctor consultation', amount: 200 }], employee_id: 'e3', employee_name: 'Omar Ali', status: 'pending', approver_name: '', approved_at: null, rejected_reason: '', created_at: '2026-02-20T14:00:00Z' },
    { id: 'exp-mock-009', title: 'Uber rides - week 8', category: 'transportation', amount: 520, currency: 'EGP', date: '2026-02-18', description: 'Client site visits transportation', receipt_ref: 'REC-009', items: [{ description: 'Mon ride', amount: 120 }, { description: 'Tue ride', amount: 130 }, { description: 'Wed ride', amount: 140 }, { description: 'Thu ride', amount: 130 }], employee_id: 'e4', employee_name: 'Fatma Khalil', status: 'approved', approver_name: 'Manager', approved_at: '2026-02-19T11:00:00Z', rejected_reason: '', created_at: '2026-02-18T17:00:00Z' },
    { id: 'exp-mock-010', title: 'Printer repair', category: 'other', amount: 180, currency: 'EGP', date: '2026-02-15', description: 'Office printer maintenance', receipt_ref: 'REC-010', items: [{ description: 'Repair service', amount: 180 }], employee_id: 'e2', employee_name: 'Sara Hassan', status: 'pending', approver_name: '', approved_at: null, rejected_reason: '', created_at: '2026-02-15T10:00:00Z' },
  ];

  save(mockClaims);
}

// Auto-seed on import
seedExpenseClaims();
