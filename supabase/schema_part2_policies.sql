-- Row Level Security (RLS) Policies
-- ============================================================

-- ── Enable RLS on ALL tables ─────────────────────────────────

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE resale_units       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets            ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- CRM Policies (role-based)
-- ============================================================

-- ── Users ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_admin_all" ON users;
CREATE POLICY "users_admin_all" ON users FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "users_read_all" ON users;
CREATE POLICY "users_read_all" ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (id = auth.uid());

-- ── Contacts ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "contacts_admin_all" ON contacts;
CREATE POLICY "contacts_admin_all" ON contacts FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "contacts_read" ON contacts;
CREATE POLICY "contacts_read" ON contacts FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'team_leader')
  );

DROP POLICY IF EXISTS "contacts_insert" ON contacts;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "contacts_update" ON contacts;
CREATE POLICY "contacts_update" ON contacts FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "contacts_delete" ON contacts;
CREATE POLICY "contacts_delete" ON contacts FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

-- ── Projects ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "projects_read" ON projects;
CREATE POLICY "projects_read" ON projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "projects_admin_all" ON projects;
CREATE POLICY "projects_admin_all" ON projects FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "projects_manage" ON projects;
CREATE POLICY "projects_manage" ON projects FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director'));

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director'));

-- ── Opportunities ─────────────────────────────────────────────

DROP POLICY IF EXISTS "opp_admin_all" ON opportunities;
CREATE POLICY "opp_admin_all" ON opportunities FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "opp_read" ON opportunities;
CREATE POLICY "opp_read" ON opportunities FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'team_leader')
  );

DROP POLICY IF EXISTS "opp_insert" ON opportunities;
CREATE POLICY "opp_insert" ON opportunities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "opp_update" ON opportunities;
CREATE POLICY "opp_update" ON opportunities FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "opp_delete" ON opportunities;
CREATE POLICY "opp_delete" ON opportunities FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

-- ── Activities ────────────────────────────────────────────────

DROP POLICY IF EXISTS "activities_admin_all" ON activities;
CREATE POLICY "activities_admin_all" ON activities FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "activities_read" ON activities;
CREATE POLICY "activities_read" ON activities FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'team_leader')
  );

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update" ON activities FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "activities_delete" ON activities;
CREATE POLICY "activities_delete" ON activities FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager')
  );

-- ── Tasks ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_admin_all" ON tasks;
CREATE POLICY "tasks_admin_all" ON tasks FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "tasks_read" ON tasks;
CREATE POLICY "tasks_read" ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'team_leader')
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager')
  );

-- ── Resale Units ──────────────────────────────────────────────

DROP POLICY IF EXISTS "resale_admin_all" ON resale_units;
CREATE POLICY "resale_admin_all" ON resale_units FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "resale_read" ON resale_units;
CREATE POLICY "resale_read" ON resale_units FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "resale_insert" ON resale_units;
CREATE POLICY "resale_insert" ON resale_units FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "resale_update" ON resale_units;
CREATE POLICY "resale_update" ON resale_units FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director'));

DROP POLICY IF EXISTS "resale_delete" ON resale_units;
CREATE POLICY "resale_delete" ON resale_units FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

-- ── Campaigns ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "campaigns_admin_all" ON campaigns;
CREATE POLICY "campaigns_admin_all" ON campaigns FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "campaigns_read" ON campaigns;
CREATE POLICY "campaigns_read" ON campaigns FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'marketing'));

DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'marketing'));

DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager'));

-- ── Reminders ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "reminders_admin_all" ON reminders;
CREATE POLICY "reminders_admin_all" ON reminders FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "reminders_read" ON reminders;
CREATE POLICY "reminders_read" ON reminders FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "reminders_insert" ON reminders;
CREATE POLICY "reminders_insert" ON reminders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "reminders_update" ON reminders;
CREATE POLICY "reminders_update" ON reminders FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager')
  );

DROP POLICY IF EXISTS "reminders_delete" ON reminders;
CREATE POLICY "reminders_delete" ON reminders FOR DELETE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager')
  );

-- ── View Logs ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "viewlogs_admin_all" ON view_logs;
CREATE POLICY "viewlogs_admin_all" ON view_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "viewlogs_read" ON view_logs;
CREATE POLICY "viewlogs_read" ON view_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "viewlogs_insert" ON view_logs;
CREATE POLICY "viewlogs_insert" ON view_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── Audit Logs ────────────────────────────────────────────────

DROP POLICY IF EXISTS "auditlogs_admin_all" ON audit_logs;
CREATE POLICY "auditlogs_admin_all" ON audit_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "auditlogs_read" ON audit_logs;
CREATE POLICY "auditlogs_read" ON audit_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "auditlogs_insert" ON audit_logs;
CREATE POLICY "auditlogs_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── Sessions ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "sessions_admin_all" ON sessions;
CREATE POLICY "sessions_admin_all" ON sessions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "sessions_read_own" ON sessions;
CREATE POLICY "sessions_read_own" ON sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director')
  );

DROP POLICY IF EXISTS "sessions_insert" ON sessions;
CREATE POLICY "sessions_insert" ON sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sessions_update_own" ON sessions;
CREATE POLICY "sessions_update_own" ON sessions FOR UPDATE
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');


-- ============================================================
-- HR / Finance / Operations Policies (role-based)
-- ============================================================

-- ── Departments — readable by all, managed by admin/HR ────────

DROP POLICY IF EXISTS "departments_select" ON departments;
CREATE POLICY "departments_select" ON departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "departments_manage" ON departments;
CREATE POLICY "departments_manage" ON departments FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

-- ── Employees — HR and managers can manage, all can read ──────

DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete" ON employees FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- ── Attendance — employees see own, HR sees all ───────────────

DROP POLICY IF EXISTS "attendance_select" ON attendance;
CREATE POLICY "attendance_select" ON attendance FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id FROM employees e WHERE e.email = auth.jwt() ->> 'email'
    )
    OR auth.jwt() ->> 'role' IN ('admin', 'hr_manager')
  );

DROP POLICY IF EXISTS "attendance_insert" ON attendance;
CREATE POLICY "attendance_insert" ON attendance FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

DROP POLICY IF EXISTS "attendance_update" ON attendance;
CREATE POLICY "attendance_update" ON attendance FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

-- ── Leave Requests — employees see own, managers see team ─────

DROP POLICY IF EXISTS "leave_select" ON leave_requests;
CREATE POLICY "leave_select" ON leave_requests FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id FROM employees e WHERE e.email = auth.jwt() ->> 'email'
    )
    OR auth.jwt() ->> 'role' IN ('admin', 'hr_manager')
  );

DROP POLICY IF EXISTS "leave_insert" ON leave_requests;
CREATE POLICY "leave_insert" ON leave_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_update" ON leave_requests;
CREATE POLICY "leave_update" ON leave_requests FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

-- ── Leave Balances ────────────────────────────────────────────

DROP POLICY IF EXISTS "leave_balances_select" ON leave_balances;
CREATE POLICY "leave_balances_select" ON leave_balances FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id FROM employees e WHERE e.email = auth.jwt() ->> 'email'
    )
    OR auth.jwt() ->> 'role' IN ('admin', 'hr_manager')
  );

DROP POLICY IF EXISTS "leave_balances_manage" ON leave_balances;
CREATE POLICY "leave_balances_manage" ON leave_balances FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'hr_manager'));

-- ── Chart of Accounts — readable by all, managed by finance ──

DROP POLICY IF EXISTS "coa_select" ON chart_of_accounts;
CREATE POLICY "coa_select" ON chart_of_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coa_manage" ON chart_of_accounts;
CREATE POLICY "coa_manage" ON chart_of_accounts FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'finance_manager'));

-- ── Journal Entries — finance team can manage ─────────────────

DROP POLICY IF EXISTS "je_select" ON journal_entries;
CREATE POLICY "je_select" ON journal_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "je_insert" ON journal_entries;
CREATE POLICY "je_insert" ON journal_entries FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'finance_manager', 'accountant'));

DROP POLICY IF EXISTS "je_update" ON journal_entries;
CREATE POLICY "je_update" ON journal_entries FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'finance_manager'));

DROP POLICY IF EXISTS "jel_select" ON journal_entry_lines;
CREATE POLICY "jel_select" ON journal_entry_lines FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "jel_insert" ON journal_entry_lines;
CREATE POLICY "jel_insert" ON journal_entry_lines FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'finance_manager', 'accountant'));

-- ── Invoices — finance team ───────────────────────────────────

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'finance_manager', 'accountant'));

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'finance_manager'));

-- ── Expenses — finance team ──────────────────────────────────

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'finance_manager'));

-- ── Deals — operations team ──────────────────────────────────

DROP POLICY IF EXISTS "deals_admin_all" ON deals;
CREATE POLICY "deals_admin_all" ON deals FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert" ON deals FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'sales_director', 'operations'));

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update" ON deals FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'operations'));

-- ── Installments ──────────────────────────────────────────────

DROP POLICY IF EXISTS "installments_select" ON installments;
CREATE POLICY "installments_select" ON installments FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "installments_insert" ON installments;
CREATE POLICY "installments_insert" ON installments FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'finance_manager', 'operations'));

DROP POLICY IF EXISTS "installments_update" ON installments;
CREATE POLICY "installments_update" ON installments FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'finance_manager', 'operations'));

-- ── Handovers ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "handovers_select" ON handovers;
CREATE POLICY "handovers_select" ON handovers FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "handovers_insert" ON handovers;
CREATE POLICY "handovers_insert" ON handovers FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'operations'));

DROP POLICY IF EXISTS "handovers_update" ON handovers;
CREATE POLICY "handovers_update" ON handovers FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'operations'));

-- ── Tickets ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "tickets_admin_all" ON tickets;
CREATE POLICY "tickets_admin_all" ON tickets FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "tickets_select" ON tickets;
CREATE POLICY "tickets_select" ON tickets FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'sales_manager', 'operations')
  );

DROP POLICY IF EXISTS "tickets_insert" ON tickets;
CREATE POLICY "tickets_insert" ON tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tickets_update" ON tickets;
CREATE POLICY "tickets_update" ON tickets FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'operations')
  );


-- ============================================================
-- Updated-at trigger (auto-update updated_at on row change)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated      BEFORE UPDATE ON contacts      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_opportunities_updated  BEFORE UPDATE ON opportunities  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tasks_updated          BEFORE UPDATE ON tasks          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_resale_units_updated   BEFORE UPDATE ON resale_units   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_campaigns_updated      BEFORE UPDATE ON campaigns      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_users_updated          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_employees_updated      BEFORE UPDATE ON employees      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_deals_updated          BEFORE UPDATE ON deals          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_installments_updated   BEFORE UPDATE ON installments   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_invoices_updated       BEFORE UPDATE ON invoices       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tickets_updated        BEFORE UPDATE ON tickets        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
