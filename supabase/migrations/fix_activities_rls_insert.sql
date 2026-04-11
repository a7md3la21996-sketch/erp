-- Fix: Allow all authenticated users to insert activities
-- Sales agents were blocked from creating activities because the INSERT policy
-- was checking user_id which may not match for imported/system activities.

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "activities_insert" ON activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON activities;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON activities;

-- Allow any authenticated user to insert activities
CREATE POLICY "activities_insert_all_authenticated"
  ON activities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure SELECT policy exists for role-based reading
-- (Activities are filtered client-side by role, but RLS should allow reading)
DROP POLICY IF EXISTS "activities_select" ON activities;
DROP POLICY IF EXISTS "activities_select_policy" ON activities;
DROP POLICY IF EXISTS "Enable read access for all users" ON activities;

CREATE POLICY "activities_select_all_authenticated"
  ON activities
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure UPDATE policy exists (for completing scheduled activities)
DROP POLICY IF EXISTS "activities_update" ON activities;
DROP POLICY IF EXISTS "activities_update_policy" ON activities;

CREATE POLICY "activities_update_all_authenticated"
  ON activities
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
