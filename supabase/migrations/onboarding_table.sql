-- Onboarding State Migration
-- Date: 2026-05-05
-- Moves onboarding records out of browser localStorage (per-device, no
-- security) into a proper Supabase table with RLS so HR sees a consistent
-- view across devices and employees can see their own onboarding plan.
-- Idempotent.

-- ── 1. Table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  target_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'overdue')),
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Each employee gets at most one active onboarding record at a time
  UNIQUE(employee_id)
);

-- Index for the most common query (list by status / start_date)
CREATE INDEX IF NOT EXISTS idx_employee_onboarding_status
  ON employee_onboarding(status, start_date DESC);

-- ── 2. updated_at trigger ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employee_onboarding_set_updated_at ON employee_onboarding;
CREATE TRIGGER employee_onboarding_set_updated_at
  BEFORE UPDATE ON employee_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── 3. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE employee_onboarding ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS onboarding_admin_hr_all ON employee_onboarding;
DROP POLICY IF EXISTS onboarding_self_read ON employee_onboarding;
DROP POLICY IF EXISTS onboarding_mentor_read ON employee_onboarding;

-- Admin / HR can do everything
CREATE POLICY onboarding_admin_hr_all ON employee_onboarding
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'hr')
    )
  );

-- The employee can read their own onboarding plan
CREATE POLICY onboarding_self_read ON employee_onboarding
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Mentors can read the records they're assigned to
CREATE POLICY onboarding_mentor_read ON employee_onboarding
  FOR SELECT
  TO authenticated
  USING (mentor_id = auth.uid());

-- ── 4. Verification (read-only) ───────────────────────────────────────────
-- SELECT count(*) FROM employee_onboarding;
-- SELECT id, employee_id, status, start_date, jsonb_object_keys(checklist) FROM employee_onboarding LIMIT 5;
