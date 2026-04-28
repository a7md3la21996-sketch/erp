-- Tighten audit_logs INSERT policy.
--
-- Before: WITH CHECK (true) — any authenticated user could insert any row,
-- including rows with a forged user_id. That made audit_logs useless as a
-- source of truth for "who did what" since anyone with DevTools could write
-- a row pretending to be someone else.
--
-- After: a BEFORE INSERT trigger forces user_id = auth.uid() (so the client
-- can't lie), and the policy enforces user_id = auth.uid() OR service_role.
-- Server-side jobs (cron, RPCs running with service_role) bypass via the
-- service_role check.

-- 1) Trigger: stamp user_id from auth.uid() on every insert. Overrides any
-- value the client sent — defense in depth even if the policy is changed
-- later.
CREATE OR REPLACE FUNCTION enforce_audit_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- service_role / cron / SQL editor: allow whatever the caller passed.
  -- This keeps backfill scripts and cron jobs working.
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Authenticated client: always overwrite with the true session uid.
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_enforce_user_id ON audit_logs;
CREATE TRIGGER audit_logs_enforce_user_id
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_user_id();

-- 2) Replace the permissive INSERT policy with one that requires the row
-- to belong to the caller. The trigger above guarantees this is always
-- true for authenticated callers; the OR auth.role() = 'service_role'
-- branch keeps cron / admin SQL working.
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

-- Note: SELECT policy stays admin-only (audit_select). UPDATE/DELETE are
-- intentionally not granted — audit logs are append-only.
