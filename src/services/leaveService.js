import supabase from '../lib/supabase';
import { logCreate, logUpdate } from './auditService';

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
      .select(`
        *,
        employees!leave_requests_employee_id_fkey ( id, full_name_ar, full_name_en, department_id ),
        approver:employees!leave_requests_approved_by_fkey ( id, full_name_ar, full_name_en )
      `)
      .order('created_at', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.status)     query = query.eq('status', filters.status);
    if (filters.type)       query = query.eq('type', filters.type);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    let result = [...MOCK_LEAVE_REQUESTS];
    if (filters.employeeId) result = result.filter(r => r.employee_id === filters.employeeId);
    if (filters.status)     result = result.filter(r => r.status === filters.status);
    if (filters.type)       result = result.filter(r => r.type === filters.type);
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export async function createLeaveRequest(data) {
  try {
    const { data: d, error } = await supabase
      .from('leave_requests')
      .insert([{ ...data, status: 'pending', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('leave_request', d.id, d);
    return d;
  } catch {
    const mock = { ...data, id: 'lr-' + Date.now(), status: 'pending', created_at: new Date().toISOString() };
    MOCK_LEAVE_REQUESTS.unshift(mock);
    return mock;
  }
}

export async function approveLeaveRequest(id) {
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
    return data;
  } catch {
    const idx = MOCK_LEAVE_REQUESTS.findIndex(r => r.id === id);
    if (idx > -1) {
      MOCK_LEAVE_REQUESTS[idx].status = 'approved';
      MOCK_LEAVE_REQUESTS[idx].approved_by = 'e1';
    }
    return MOCK_LEAVE_REQUESTS[idx];
  }
}

export async function rejectLeaveRequest(id, reason) {
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
  } catch {
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
  } catch {
    return MOCK_LEAVE_BALANCES[employeeId] || { annual: 0, sick: 0, emergency: 0, used_annual: 0, used_sick: 0, used_emergency: 0 };
  }
}
