-- Auto-Onboarding Trigger
-- Date: 2026-05-05
-- When a new employee is inserted, automatically create their onboarding
-- record so HR doesn't have to remember to start it manually. Idempotent.

CREATE OR REPLACE FUNCTION auto_create_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if onboarding already exists for this employee (e.g. manual reinstate)
  IF EXISTS (SELECT 1 FROM employee_onboarding WHERE employee_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO employee_onboarding (
    employee_id,
    start_date,
    status,
    checklist
  ) VALUES (
    NEW.id,
    COALESCE(NEW.hire_date, CURRENT_DATE),
    'not_started',
    '{
      "documents": false,
      "it_setup": false,
      "workspace": false,
      "orientation": false,
      "team_intro": false,
      "policy_ack": false,
      "training": false,
      "first_review": false
    }'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block employee creation just because onboarding insert failed
  RAISE WARNING 'Auto-onboarding insert failed for employee %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS employees_auto_onboarding ON employees;
CREATE TRIGGER employees_auto_onboarding
  AFTER INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_onboarding();
