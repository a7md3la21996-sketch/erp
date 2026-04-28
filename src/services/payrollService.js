import supabase from '../lib/supabase';
import { requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

// ── Payroll Runs ─────────────────────────────────────────────

export async function fetchPayrollRuns() {
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchPayrollRun(month, year) {
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .single();
  if (error) return null;
  return data;
}

export async function fetchPayrollItems(runId) {
  const { data, error } = await supabase
    .from('payroll_items')
    .select('*')
    .eq('run_id', runId)
    .order('employee_name');
  if (error) throw error;
  return data || [];
}

export async function savePayrollRun(runData, items) {
  // Payroll mutations are admin/HR only — financial data with direct
  // money impact. Service-layer guard catches devtools-only calls before
  // they reach RLS, with a clear error.
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to save payroll runs');
  // Upsert the run
  const { data: run, error: runErr } = await supabase
    .from('payroll_runs')
    .upsert({
      month: runData.month,
      year: runData.year,
      run_date: new Date().toISOString(),
      total_employees: runData.total_employees,
      total_gross: runData.total_gross,
      total_deductions: runData.total_deductions,
      total_net: runData.total_net,
      status: 'completed',
      notes: runData.notes || null,
      created_by: runData.created_by || null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'month,year' })
    .select('*')
    .single();
  if (runErr) throw runErr;

  // Delete old items for this run
  await supabase.from('payroll_items').delete().eq('run_id', run.id);

  // Insert new items
  const itemRows = items.map(item => ({
    run_id: run.id,
    employee_id: item.employee_id,
    employee_name: item.employee_name,
    department: item.department,
    base_salary: item.base_salary,
    allowances: item.allowances,
    overtime_bonus: item.overtime_bonus || 0,
    tax: item.tax || 0,
    social_insurance: item.social_insurance || 0,
    late_deduction: item.late_deduction || 0,
    absent_deduction: item.absent_deduction || 0,
    loan_deduction: item.loan_deduction || 0,
    other_deductions: item.other_deductions || 0,
    other_additions: item.other_additions || 0,
    total_deductions: item.total_deductions,
    net_salary: item.net_salary,
    present_days: item.present_days || 0,
    absent_days: item.absent_days || 0,
    late_minutes: item.late_minutes || 0,
    overtime_minutes: item.overtime_minutes || 0,
    absent_from_leave: item.absent_from_leave || 0,
    notes: item.notes || null,
    created_at: new Date().toISOString(),
  }));

  const { error: itemErr } = await supabase.from('payroll_items').insert(itemRows);
  if (itemErr) throw itemErr;

  return run;
}

// ── Loans ────────────────────────────────────────────────────

export async function fetchLoans(employeeId) {
  let query = supabase.from('employee_loans').select('*').order('created_at', { ascending: false });
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchActiveLoans() {
  const { data, error } = await supabase
    .from('employee_loans')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createLoan(data) {
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to create loans');
  const { data: loan, error } = await supabase
    .from('employee_loans')
    .insert({ ...data, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return loan;
}

export async function updateLoan(id, updates) {
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to update loans');
  const { data, error } = await supabase
    .from('employee_loans')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLoan(id) {
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to delete loans');
  const { error } = await supabase.from('employee_loans').delete().eq('id', id);
  if (error) throw error;
}

// ── Adjustments (bonus, penalty, etc) ────────────────────────

export async function fetchAdjustments(month, year, employeeId) {
  let query = supabase.from('payroll_adjustments').select('*');
  if (month && year) query = query.eq('month', month).eq('year', year);
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createAdjustment(data) {
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to create payroll adjustments');
  const { data: adj, error } = await supabase
    .from('payroll_adjustments')
    .insert({ ...data, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return adj;
}

export async function deleteAdjustment(id) {
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to delete payroll adjustments');
  const { error } = await supabase.from('payroll_adjustments').delete().eq('id', id);
  if (error) throw error;
}
