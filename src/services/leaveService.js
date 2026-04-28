import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate } from './auditService';
import { requirePerm, currentProfile } from '../utils/permissionGuard';
import { P } from '../config/roles';

// ── Mock Data ─────────────────────────────────────────────────

const MOCK_LEAVE_REQUESTS = [
  { id: 'lr-001', employee_id: 'e2', type: 'annual',    start_date: '2026-03-15', end_date: '2026-03-18', days: 3, status: 'approved', reason: 'إجازة شخصية',     approved_by: 'e1', created_at: '2026-03-01T10:00:00' },
  { id: 'lr-002', employee_id: 'e4', type: 'sick',      start_date: '2026-03-10', end_date: '2026-03-11', days: 2, status: 'approved', reason: 'إجازة مرضية',     approved_by: 'e1', created_at: '2026-03-09T08:30:00' },
  { id: 'lr-003', employee_id: 'e6', type: 'annual',    start_date: '2026-03-20', end_date: '2026-03-22', days: 3, status: 'pending',  reason: 'سفر عائلي',       approved_by: null,  created_at: '2026-03-08T14:00:00' },
  { id: 'lr-004', employee_id: 'e3', type: 'emergency', start_date: '2026-03-05', end_date: '2026-03-05', days: 1, status: 'approved', reason: 'ظرف طارئ',        approved_by: 'e1', created_at: '2026-03-05T07:00:00' },
  { id: 'lr-005', employee_id: 'e7', type: 'unpaid',    start_date: '2026-03-25', end_date: '2026-03-27', days: 3, status: 'pending',  reason: 'سفر خارج البلاد', approved_by: null,  created_at: '2026-03-10T09:00:00' },
  { id: 'lr-006', employee_id: 'e5', type: 'annual',    start_date: '2026-02-20', end_date: '2026-02-22', days: 3, status: 'rejected', reason: 'ضغط عمل',         approved_by: 'e1', created_at: '2026-02-15T11:00:00' },
];

const MOCK_LEAVE_BALANCES = {
  'e1': { annual: 21, sick: 7, emergency: 3, used_annual: 5,  used_sick: 0, used_emergency: 0 },
  'e2': { annual: 21, sick: 7, emergency: 3, used_annual: 3,  used_sick: 0, used_emergency: 0 },
  'e3': { annual: 21, sick: 7, emergency: 3, used_annual: 2,  used_sick: 1, used_emergency: 1 },
  'e4': { annual: 15, sick: 7, emergency: 3, used_annual: 0,  used_sick: 2, used_emergency: 0 },
  'e5': { annual: 15, sick: 7, emergency: 3, used_annual: 0,  used_sick: 0, used_emergency: 0 },
  'e6': { annual: 15, sick: 7, emergency: 3, used_annual: 0,  used_sick: 0, used_emergency: 0 },
  'e7': { annual: 15, sick: 7, emergency: 3, used_annual: 0,  used_sick: 0, used_emergency: 0 },
  'e8': { annual: 0,  sick: 0, emergency: 0, used_annual: 0,  used_sick: 0, used_emergency: 0 },
};

// ── Service Functions ─────────────────────────────────────────

export async function fetchLeaveRequests(filters = {}) {
  try {
    let query = supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.status)     query = query.eq('status', filters.status);
    if (filters.type)       query = query.eq('type', filters.type);

    const { data, error } = await query.range(0, 199);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('leaveService', 'query', err);
    let result = [...MOCK_LEAVE_REQUESTS];
    if (filters.employeeId) result = result.filter(r => r.employee_id === filters.employeeId);
    if (filters.status)     result = result.filter(r => r.status === filters.status);
    if (filters.type)       result = result.filter(r => r.type === filters.type);
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export async function createLeaveRequest(data) {
  // Anyone with LEAVE_REQUEST can submit, but they must submit *for
  // themselves*. Override employee_id from the session profile so a
  // sales agent can't file leave for a colleague.
  requirePerm(P.LEAVE_REQUEST, 'Not allowed to submit leave requests');
  const profile = currentProfile();
  const safe = { ...data };
  // Admin/HR keep the override path open — they may legitimately file
  // on behalf of others.
  if (profile && profile.role !== 'admin' && profile.role !== 'hr') {
    if (profile.id) safe.employee_id = profile.id;
  }
  // status is set by the server flow; don't trust a client-passed value
  // (would let users self-approve).
  delete safe.status;
  delete safe.approved_by;
  delete safe.rejection_reason;
  try {
    const { data: d, error } = await supabase
      .from('leave_requests')
      .insert([{ ...stripInternalFields(safe), status: 'pending', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('leave_request', d.id, d);
    return d;
  } catch (err) { reportError('leaveService', 'query', err);
    const mock = { ...safe, id: 'lr-' + Date.now(), status: 'pending', created_at: new Date().toISOString() };
    MOCK_LEAVE_REQUESTS.unshift(mock);
    return mock;
  }
}

export async function approveLeaveRequest(id) {
  // Approving leave deducts paid balance. Restrict to HR/admin —
  // otherwise an employee with devtools could approve their own request.
  requirePerm(P.HR_EMPLOYEES_MANAGE, 'Not allowed to approve leave requests');
  try {
    const { data: old } = await supabase.from('leave_requests').select('*').eq('id', id).single();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: user?.id || null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await logUpdate('leave_request', id, old, data, 'Approved leave request');

    // Deduct leave balance
    if (data) {
      await deductLeaveBalance(data.employee_id, data.type, data.days || calculateDays(data.start_date, data.end_date));
    }

    return data;
  } catch (err) { reportError('leaveService', 'query', err);
    const idx = MOCK_LEAVE_REQUESTS.findIndex(r => r.id === id);
    if (idx > -1) {
      MOCK_LEAVE_REQUESTS[idx].status = 'approved';
      MOCK_LEAVE_REQUESTS[idx].approved_by = 'e1';

      // Deduct from mock leave balance
      const req = MOCK_LEAVE_REQUESTS[idx];
      const days = req.days || calculateDays(req.start_date, req.end_date);
      const balance = MOCK_LEAVE_BALANCES[req.employee_id];
      if (balance && req.type !== 'unpaid') {
        const usedKey = `used_${req.type}`;
        if (usedKey in balance) {
          balance[usedKey] += days;
        }
      }
    }
    return MOCK_LEAVE_REQUESTS[idx];
  }
}

/**
 * Calculate the number of working days between two dates (inclusive).
 */
export function calculateDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both days are inclusive
}

/**
 * Deduct days from an employee's leave balance after approval.
 */
async function deductLeaveBalance(employeeId, leaveType, days) {
  if (!employeeId || !days || leaveType === 'unpaid') return;

  const usedKey = `used_${leaveType}`;

  try {
    // Get current balance
    const { data: balance, error: fetchError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (fetchError) throw fetchError;

    // Update the used count
    const update = { [usedKey]: (balance[usedKey] || 0) + days };
    const { error: updateError } = await supabase
      .from('leave_balances')
      .update(update)
      .eq('employee_id', employeeId);

    if (updateError) throw updateError;
  } catch (err) { reportError('leaveService', 'query', err);
    // Fallback: update mock balance
    const balance = MOCK_LEAVE_BALANCES[employeeId];
    if (balance && usedKey in balance) {
      balance[usedKey] += days;
    }

    // Also persist to localStorage so balance survives page refreshes
    try {
      const stored = JSON.parse(localStorage.getItem('leave_balances') || '{}');
      if (!stored[employeeId]) {
        stored[employeeId] = { ...(MOCK_LEAVE_BALANCES[employeeId] || {}) };
      }
      stored[employeeId][usedKey] = (stored[employeeId][usedKey] || 0) + days;
      localStorage.setItem('leave_balances', JSON.stringify(stored));
    } catch { /* localStorage unavailable */ }
  }
}

export async function rejectLeaveRequest(id, reason) {
  requirePerm(P.HR_EMPLOYEES_MANAGE, 'Not allowed to reject leave requests');
  try {
    const { data: old } = await supabase.from('leave_requests').select('*').eq('id', id).single();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected', approved_by: user?.id || null, rejection_reason: reason })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await logUpdate('leave_request', id, old, data, 'Rejected leave request');
    return data;
  } catch (err) { reportError('leaveService', 'query', err);
    const idx = MOCK_LEAVE_REQUESTS.findIndex(r => r.id === id);
    if (idx > -1) {
      MOCK_LEAVE_REQUESTS[idx].status = 'rejected';
      MOCK_LEAVE_REQUESTS[idx].approved_by = 'e1';
    }
    return MOCK_LEAVE_REQUESTS[idx];
  }
}

export async function getLeaveBalance(employeeId) {
  try {
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .single();
    if (error) throw error;
    return data;
  } catch (err) { reportError('leaveService', 'query', err);
    // Check localStorage for persisted balance updates (mock mode)
    try {
      const stored = JSON.parse(localStorage.getItem('leave_balances') || '{}');
      if (stored[employeeId]) {
        return stored[employeeId];
      }
    } catch { /* localStorage unavailable */ }
    return MOCK_LEAVE_BALANCES[employeeId] || { annual: 0, sick: 0, emergency: 0, used_annual: 0, used_sick: 0, used_emergency: 0 };
  }
}

/**
 * Get the remaining balance for a specific leave type.
 */
export function getRemainingBalance(balance, leaveType) {
  if (!balance || leaveType === 'unpaid') return null;
  const total = balance[leaveType] || 0;
  const used = balance[`used_${leaveType}`] || 0;
  return total - used;
}
