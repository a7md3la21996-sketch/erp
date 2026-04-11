-- ═══════════════════════════════════════════════════════════════════════
-- COMPLETE RLS SYSTEM — Platform ERP
-- Execute this ENTIRE file in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper function: get current user's role ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper function: get current user's team_id ──────────────────────
CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS uuid AS $$
  SELECT team_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper function: get all team member IDs (for manager/TL) ────────
CREATE OR REPLACE FUNCTION public.get_team_member_ids()
RETURNS uuid[] AS $$
DECLARE
  _role text;
  _team_id uuid;
  _team_ids uuid[];
BEGIN
  SELECT role, team_id INTO _role, _team_id FROM public.users WHERE id = auth.uid();
  IF _role = 'admin' OR _role = 'operations' THEN
    RETURN NULL; -- NULL means no filter (see all)
  END IF;
  IF _team_id IS NULL THEN
    RETURN ARRAY[auth.uid()];
  END IF;
  _team_ids := ARRAY[_team_id];
  IF _role = 'sales_manager' THEN
    SELECT array_agg(id) INTO _team_ids FROM departments WHERE parent_id = _team_id OR id = _team_id;
  END IF;
  RETURN (SELECT array_agg(id) FROM public.users WHERE team_id = ANY(_team_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Helper function: get team member names ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_team_member_names()
RETURNS text[] AS $$
DECLARE
  _role text;
  _team_id uuid;
  _team_ids uuid[];
BEGIN
  SELECT role, team_id INTO _role, _team_id FROM public.users WHERE id = auth.uid();
  IF _role = 'admin' OR _role = 'operations' THEN
    RETURN NULL;
  END IF;
  IF _team_id IS NULL THEN
    RETURN (SELECT ARRAY[full_name_en] FROM public.users WHERE id = auth.uid());
  END IF;
  _team_ids := ARRAY[_team_id];
  IF _role = 'sales_manager' THEN
    SELECT array_agg(id) INTO _team_ids FROM departments WHERE parent_id = _team_id OR id = _team_id;
  END IF;
  RETURN (SELECT array_agg(full_name_en) FROM public.users WHERE team_id = ANY(_team_ids) AND full_name_en IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Helper: check if user is admin/operations ────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT role IN ('admin', 'operations') FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════════════
-- 1. USERS TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- Everyone can read users (needed for agent lists, assignments)
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (true);
-- Only admin can update/insert/delete users
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated WITH CHECK (is_admin() OR id = auth.uid());
CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated USING (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 2. CONTACTS TABLE (leads)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;

-- SELECT: admin sees all, others see contacts assigned to their team
CREATE POLICY "contacts_select" ON contacts FOR SELECT TO authenticated USING (
  is_admin()
  OR assigned_to_names @> to_jsonb(ARRAY[(SELECT full_name_en FROM users WHERE id = auth.uid())])
  OR (get_team_member_names() IS NOT NULL AND assigned_to_names ?| get_team_member_names())
);

-- INSERT: any authenticated user can create contacts
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: admin can update any, others can update their assigned contacts
CREATE POLICY "contacts_update" ON contacts FOR UPDATE TO authenticated USING (
  is_admin()
  OR assigned_to_names @> to_jsonb(ARRAY[(SELECT full_name_en FROM users WHERE id = auth.uid())])
  OR (get_team_member_names() IS NOT NULL AND assigned_to_names ?| get_team_member_names())
) WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY "contacts_delete" ON contacts FOR DELETE TO authenticated USING (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 3. OPPORTUNITIES TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "opps_select" ON opportunities;
DROP POLICY IF EXISTS "opps_insert" ON opportunities;
DROP POLICY IF EXISTS "opps_update" ON opportunities;
DROP POLICY IF EXISTS "opps_delete" ON opportunities;

CREATE POLICY "opps_select" ON opportunities FOR SELECT TO authenticated USING (
  is_admin()
  OR assigned_to = auth.uid()
  OR assigned_to_name = (SELECT full_name_en FROM users WHERE id = auth.uid())
  OR assigned_to = ANY(get_team_member_ids())
);
CREATE POLICY "opps_insert" ON opportunities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "opps_update" ON opportunities FOR UPDATE TO authenticated USING (
  is_admin()
  OR assigned_to = auth.uid()
  OR assigned_to_name = (SELECT full_name_en FROM users WHERE id = auth.uid())
  OR assigned_to = ANY(get_team_member_ids())
) WITH CHECK (true);
CREATE POLICY "opps_delete" ON opportunities FOR DELETE TO authenticated USING (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 4. ACTIVITIES TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_select_all_authenticated" ON activities;
DROP POLICY IF EXISTS "activities_insert_all_authenticated" ON activities;
DROP POLICY IF EXISTS "activities_update_all_authenticated" ON activities;
DROP POLICY IF EXISTS "activities_select" ON activities;
DROP POLICY IF EXISTS "activities_insert" ON activities;
DROP POLICY IF EXISTS "activities_update" ON activities;
DROP POLICY IF EXISTS "activities_delete" ON activities;

CREATE POLICY "activities_select" ON activities FOR SELECT TO authenticated USING (
  is_admin()
  OR user_id = auth.uid()
  OR user_name_en = (SELECT full_name_en FROM users WHERE id = auth.uid())
  OR user_id = ANY(get_team_member_ids())
);
CREATE POLICY "activities_insert" ON activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "activities_update" ON activities FOR UPDATE TO authenticated USING (
  is_admin() OR user_id = auth.uid()
) WITH CHECK (true);
CREATE POLICY "activities_delete" ON activities FOR DELETE TO authenticated USING (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 5. TASKS TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (
  is_admin()
  OR assigned_to = auth.uid()
  OR assigned_to_name_en = (SELECT full_name_en FROM users WHERE id = auth.uid())
  OR assigned_to = ANY(get_team_member_ids())
);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated USING (
  is_admin() OR assigned_to = auth.uid() OR assigned_to = ANY(get_team_member_ids())
) WITH CHECK (true);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 6. DEALS TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deals_select" ON deals;
DROP POLICY IF EXISTS "deals_insert" ON deals;
DROP POLICY IF EXISTS "deals_update" ON deals;
DROP POLICY IF EXISTS "deals_delete" ON deals;

CREATE POLICY "deals_select" ON deals FOR SELECT TO authenticated USING (
  is_admin()
  OR agent_id = auth.uid()
  OR agent_id = ANY(get_team_member_ids())
);
CREATE POLICY "deals_insert" ON deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deals_update" ON deals FOR UPDATE TO authenticated USING (
  is_admin() OR agent_id = auth.uid()
) WITH CHECK (true);
CREATE POLICY "deals_delete" ON deals FOR DELETE TO authenticated USING (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 7. NOTIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;

CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (
  for_user_id = auth.uid()::text OR for_user_id = 'all' OR is_admin()
);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (
  for_user_id = auth.uid()::text OR for_user_id = 'all' OR is_admin()
) WITH CHECK (true);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (
  for_user_id = auth.uid()::text OR is_admin()
);


-- ═══════════════════════════════════════════════════════════════════════
-- 8. DEPARTMENTS TABLE (read-only for non-admin)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_select" ON departments;
DROP POLICY IF EXISTS "departments_all" ON departments;

CREATE POLICY "departments_select" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_admin" ON departments FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 9. PROJECTS TABLE (read all, write admin)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_admin" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_admin" ON projects FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 10. SYSTEM_CONFIG TABLE (read all, write admin)
-- ═══════════════════════════════════════════════════════════════════════
-- Already has policies from earlier, just ensure they're correct
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_config_all" ON system_config;
DROP POLICY IF EXISTS "system_config_anon_read" ON system_config;

CREATE POLICY "system_config_select" ON system_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_config_admin" ON system_config FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "system_config_update" ON system_config FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "system_config_anon" ON system_config FOR SELECT TO anon USING (true);


-- ═══════════════════════════════════════════════════════════════════════
-- 11. RECURRING_TASKS TABLE
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_tasks_all" ON recurring_tasks;

CREATE POLICY "recurring_tasks_select" ON recurring_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "recurring_tasks_insert" ON recurring_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "recurring_tasks_update" ON recurring_tasks FOR UPDATE TO authenticated USING (is_admin() OR created_by = auth.uid()) WITH CHECK (true);
CREATE POLICY "recurring_tasks_delete" ON recurring_tasks FOR DELETE TO authenticated USING (is_admin() OR created_by = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════
-- 12. OTHER TABLES — open read, admin write
-- ═══════════════════════════════════════════════════════════════════════

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "documents_update" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "documents_delete" ON documents FOR DELETE TO authenticated USING (is_admin());

-- Reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_all" ON reminders;
CREATE POLICY "reminders_select" ON reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "reminders_insert" ON reminders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reminders_update" ON reminders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reminders_delete" ON reminders FOR DELETE TO authenticated USING (is_admin() OR user_id = auth.uid()::text);

-- Campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Audit Logs (read-only for non-admin, insert for all)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Resale Units
ALTER TABLE resale_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resale_select" ON resale_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "resale_insert" ON resale_units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "resale_update" ON resale_units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Chat Messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_select" ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_insert" ON chat_messages FOR INSERT TO authenticated WITH CHECK (true);

-- View Logs
ALTER TABLE view_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewlogs_select" ON view_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "viewlogs_insert" ON view_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select" ON announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announcements_insert" ON announcements FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "announcements_update" ON announcements FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_own" ON sessions FOR ALL TO authenticated USING (user_id = auth.uid()::text OR is_admin()) WITH CHECK (true);

-- Approvals
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_select" ON approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "approvals_insert" ON approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "approvals_update" ON approvals FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- ═══════════════════════════════════════════════════════════════════════
-- 13. ANON ACCESS — block everything except system_config read
-- ═══════════════════════════════════════════════════════════════════════
-- Anon should NOT be able to read contacts, opportunities, etc.
-- The anon key is used only for authentication (login)
-- After login, the authenticated role is used with proper RLS


-- ═══════════════════════════════════════════════════════════════════════
-- DONE! Test by logging in as different roles and checking data access.
-- ═══════════════════════════════════════════════════════════════════════
