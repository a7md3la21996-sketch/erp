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

  // Sync loan balances for every employee with a deduction this run.
  // Runs idempotently: re-running payroll for the same month replaces items,
  // so the sum-from-history below stays correct.
  // Wrapped in try/catch so a missing balance_paid column (pre-migration)
  // never blocks the payroll save itself.
  const empIdsWithLoans = [...new Set(items.filter(i => (i.loan_deduction || 0) > 0).map(i => i.employee_id))];
  if (empIdsWithLoans.length > 0) {
    try {
      await syncLoanBalances(empIdsWithLoans);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[payroll] loan balance sync skipped:', err.message);
    }
  }

  return run;
}

// ── Loan balance sync ────────────────────────────────────────
// Recomputes balance_paid for each loan by summing loan_deduction across
// every payroll_item for that employee since the loan started. Idempotent.
// NOTE: when an employee has multiple active loans simultaneously, the
// total loan_deduction is split equally based on each loan's monthly_deduction
// share. Most employees only have one active loan at a time.
export async function syncLoanBalances(employeeIds) {
  const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds];
  if (ids.length === 0) return;

  // Pull every active loan for the affected employees + their full payroll history
  const { data: loans } = await supabase
    .from('employee_loans')
    .select('id, employee_id, amount, monthly_deduction, start_date, created_at, status')
    .in('employee_id', ids);

  if (!loans?.length) return;

  // Group payroll history by employee
  const { data: items } = await supabase
    .from('payroll_items')
    .select('employee_id, loan_deduction, payroll_runs!inner(run_date, year, month)')
    .in('employee_id', ids);

  const itemsByEmp = {};
  for (const it of items || []) {
    if (!itemsByEmp[it.employee_id]) itemsByEmp[it.employee_id] = [];
    itemsByEmp[it.employee_id].push(it);
  }

  // For each employee, distribute loan_deduction across their active loans by share
  const updates = [];
  for (const empId of ids) {
    const empLoans = loans.filter(l => l.employee_id === empId);
    const empItems = itemsByEmp[empId] || [];
    if (empLoans.length === 0) continue;

    // Each loan's share of monthly deduction
    const totalMonthlyShare = empLoans.reduce((s, l) => s + (Number(l.monthly_deduction) || 0), 0);
    if (totalMonthlyShare === 0) continue;

    for (const loan of empLoans) {
      const cutoff = loan.start_date || loan.created_at;
      const share = (Number(loan.monthly_deduction) || 0) / totalMonthlyShare;
      const totalPaidAcrossEmp = empItems
        .filter(i => !cutoff || i.payroll_runs?.run_date >= cutoff)
        .reduce((s, i) => s + (Number(i.loan_deduction) || 0), 0);
      const paidForThisLoan = Math.min(Number(loan.amount) || 0, totalPaidAcrossEmp * share);
      const newStatus = paidForThisLoan >= (Number(loan.amount) || 0) && loan.status === 'active' ? 'closed' : loan.status;
      updates.push({
        id: loan.id,
        balance_paid: Math.round(paidForThisLoan * 100) / 100,
        last_deducted_at: new Date().toISOString(),
        status: newStatus,
      });
    }
  }

  // Apply updates one-by-one (small N — no batch RPC available without DB function)
  for (const u of updates) {
    await supabase
      .from('employee_loans')
      .update({ balance_paid: u.balance_paid, last_deducted_at: u.last_deducted_at, status: u.status })
      .eq('id', u.id);
  }
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
