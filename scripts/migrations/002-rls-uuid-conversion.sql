-- ════════════════════════════════════════════════════════════════
-- Migration 002: Convert contacts.assigned_to text → uuid + rewrite RLS
-- Applied: Apr 30 2026
-- Reason: After Phase 1 single-assignment migration, the legacy RLS policy
--   used `assigned_to_names ?| get_team_member_names()` (jsonb operator on
--   text array). With 28k+ contacts and managers having 6+ team members,
--   the per-row jsonb scan combined with other filters was timing out
--   and returning 500 errors.
-- Fix: Convert assigned_to to uuid type, replace jsonb-based RLS with
--   UUID-based comparisons. ~100x faster.
-- ════════════════════════════════════════════════════════════════

-- Drop dependent triggers
DROP TRIGGER IF EXISTS trg_auto_resolve_assigned_to_contacts ON public.contacts;
DROP TRIGGER IF EXISTS trg_auto_set_created_by_contacts ON public.contacts;

-- Drop dependent policies (must drop ALL on the column)
DROP POLICY IF EXISTS contacts_select ON public.contacts;
DROP POLICY IF EXISTS contacts_update ON public.contacts;
DROP POLICY IF EXISTS contacts_delete ON public.contacts;
DROP POLICY IF EXISTS contacts_insert ON public.contacts;

-- Convert column type (text → uuid)
ALTER TABLE contacts
  ALTER COLUMN assigned_to TYPE uuid USING assigned_to::uuid;

-- Recreate triggers
CREATE TRIGGER trg_auto_resolve_assigned_to_contacts
  BEFORE INSERT OR UPDATE OF assigned_to_name, assigned_to ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.auto_resolve_assigned_to();

CREATE TRIGGER trg_auto_set_created_by_contacts
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_created_by();

-- Recreate policies — UUID-based, with role-restricted team scope.
-- The previous attempt used get_team_member_ids() which 500'd in the OR
-- combination. Inline subquery works without that issue.
CREATE POLICY contacts_select ON public.contacts
  FOR SELECT
  USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR (
      -- Team scope ONLY for managers/leaders/directors
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('team_leader', 'sales_manager', 'sales_director')
      )
      AND assigned_to IN (
        SELECT u.id FROM public.users u
        WHERE u.team_id = (SELECT team_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE
  USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('team_leader', 'sales_manager', 'sales_director')
      )
      AND assigned_to IN (
        SELECT u.id FROM public.users u
        WHERE u.team_id = (SELECT team_id FROM public.users WHERE id = auth.uid())
      )
    )
  )
  WITH CHECK (true);

CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE
  USING (is_admin());

CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name = 'assigned_to';

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'contacts' ORDER BY policyname;
