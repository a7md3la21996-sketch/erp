-- Loan Balance Tracking Migration
-- Date: 2026-05-05
-- Adds two columns to employee_loans so the running balance is authoritative
-- in the database instead of being recomputed in the frontend (which assumed
-- linear monthly deduction and could drift on missed/extra payments).
--
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).

-- ── 1. Add columns ────────────────────────────────────────────────────────
ALTER TABLE employee_loans
  ADD COLUMN IF NOT EXISTS balance_paid NUMERIC(12,2) DEFAULT 0;

ALTER TABLE employee_loans
  ADD COLUMN IF NOT EXISTS last_deducted_at TIMESTAMPTZ;

-- ── 2. Backfill balance_paid from existing payroll history ────────────────
-- For each loan, sum the loan_deduction across all payroll_items for the
-- same employee that landed on a payroll_run dated on/after the loan's start.
-- This is an approximation — it can over-credit if a row's loan_deduction
-- covered a *different* loan, but in practice each employee usually has only
-- one active loan at a time.
WITH paid_per_loan AS (
  SELECT
    l.id AS loan_id,
    LEAST(
      l.amount,
      COALESCE(SUM(pi.loan_deduction), 0)
    ) AS paid
  FROM employee_loans l
  LEFT JOIN payroll_items pi ON pi.employee_id = l.employee_id
  LEFT JOIN payroll_runs pr ON pr.id = pi.run_id
  WHERE pr.run_date IS NULL OR pr.run_date >= COALESCE(l.start_date, l.created_at)
  GROUP BY l.id, l.amount
)
UPDATE employee_loans l
SET balance_paid = COALESCE(p.paid, 0)
FROM paid_per_loan p
WHERE l.id = p.loan_id
  AND (l.balance_paid IS NULL OR l.balance_paid = 0);  -- Only backfill, don't overwrite manual values

-- ── 3. Auto-close loans where balance_paid >= amount ──────────────────────
UPDATE employee_loans
SET status = 'closed'
WHERE balance_paid >= amount
  AND status = 'active';

-- ── 4. Index for fast lookups during payroll runs ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_employee_loans_active
  ON employee_loans(employee_id, status)
  WHERE status = 'active';

-- ── 5. Verification queries (read-only — run these to sanity-check) ───────
-- SELECT id, employee_id, amount, balance_paid, monthly_deduction, status
-- FROM employee_loans
-- ORDER BY created_at DESC LIMIT 20;
--
-- SELECT
--   COUNT(*) FILTER (WHERE status = 'active')          AS active_loans,
--   COUNT(*) FILTER (WHERE status = 'closed')          AS closed_loans,
--   SUM(amount - balance_paid) FILTER (WHERE status = 'active') AS total_outstanding
-- FROM employee_loans;
