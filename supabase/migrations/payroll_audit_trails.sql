-- Payroll Audit Trails Migration
-- Date: 2026-05-05
-- Three additions to make payroll history defensible:
--   1. salary_history captures who changed what and the previous value
--   2. employee_loans soft-delete (don't lose loan history)
--   3. payroll_items records which adjustments contributed (so disputes
--      can be traced even after the adjustment is deleted)
-- Idempotent.

-- ── 1. Salary History audit columns ───────────────────────────────────────
ALTER TABLE salary_history
  ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_salary_history_emp_date
  ON salary_history(employee_id, effective_date DESC);

-- ── 2. employee_loans soft-delete ────────────────────────────────────────
ALTER TABLE employee_loans
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Refresh the active-loans index to exclude soft-deleted rows
DROP INDEX IF EXISTS idx_employee_loans_active;
CREATE INDEX IF NOT EXISTS idx_employee_loans_active
  ON employee_loans(employee_id, status)
  WHERE status = 'active' AND deleted_at IS NULL;

-- ── 3. payroll_items references the adjustments that contributed ──────────
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS adjustment_ids UUID[] DEFAULT '{}'::UUID[];

-- ── 4. Verification (read-only) ───────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name IN ('salary_history', 'employee_loans', 'payroll_items')
--   AND column_name IN ('changed_by', 'previous_salary', 'change_reason',
--                       'deleted_at', 'deleted_by', 'deletion_reason',
--                       'adjustment_ids')
-- ORDER BY table_name, column_name;
