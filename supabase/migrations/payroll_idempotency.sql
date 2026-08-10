-- Payroll Run Idempotency + Lock Migration
-- Date: 2026-05-05
-- Adds lock + audit columns to payroll_runs so a finalized month cannot be
-- silently re-run and overwritten. Re-runs of unlocked months still work
-- (used for in-progress corrections), but each save increments `version`
-- and stamps `last_modified_by` so the audit trail is preserved.
--
-- Run in Supabase SQL Editor. Idempotent.

-- ── 1. Add lock + audit columns ───────────────────────────────────────────
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── 2. Trigger: enforce immutability of locked runs ───────────────────────
-- Once locked_at is set, the run's totals/items must not change. Application
-- layer also enforces this, but a DB trigger is the last line of defense.
CREATE OR REPLACE FUNCTION prevent_locked_payroll_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL AND NEW.locked_at IS NOT NULL THEN
    -- Allow updating locked_by/notes only; block totals/items
    IF NEW.total_gross != OLD.total_gross
       OR NEW.total_deductions != OLD.total_deductions
       OR NEW.total_net != OLD.total_net
       OR NEW.total_employees != OLD.total_employees THEN
      RAISE EXCEPTION 'Payroll run for %-% is locked and cannot be modified. Unlock first if a correction is needed.', OLD.year, OLD.month;
    END IF;
  END IF;
  -- Auto-bump version + stamp last_modified on any change to totals
  IF NEW.total_gross != OLD.total_gross
     OR NEW.total_deductions != OLD.total_deductions
     OR NEW.total_net != OLD.total_net THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.last_modified_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_lock_guard ON payroll_runs;
CREATE TRIGGER payroll_runs_lock_guard
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_payroll_update();

-- ── 3. Block deletion of locked runs ──────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_locked_payroll_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Payroll run for %-% is locked and cannot be deleted.', OLD.year, OLD.month;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_lock_delete_guard ON payroll_runs;
CREATE TRIGGER payroll_runs_lock_delete_guard
  BEFORE DELETE ON payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_payroll_delete();

-- ── 4. Block payroll_items changes if parent run is locked ────────────────
CREATE OR REPLACE FUNCTION prevent_locked_payroll_items_change()
RETURNS TRIGGER AS $$
DECLARE
  parent_locked TIMESTAMPTZ;
BEGIN
  SELECT locked_at INTO parent_locked
  FROM payroll_runs
  WHERE id = COALESCE(NEW.run_id, OLD.run_id);

  IF parent_locked IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify payroll items: parent run is locked.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_items_lock_guard ON payroll_items;
CREATE TRIGGER payroll_items_lock_guard
  BEFORE INSERT OR UPDATE OR DELETE ON payroll_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_payroll_items_change();

-- ── 5. Verification queries (read-only — run to sanity-check) ─────────────
-- SELECT id, month, year, version, locked_at, locked_by, last_modified_at
-- FROM payroll_runs
-- ORDER BY year DESC, month DESC LIMIT 12;
