-- ============================================================
-- Platform Real Estate ERP — Supabase Schema
-- Tables: users, contacts, opportunities, activities, tasks,
--         projects, campaigns, resale_units, reminders,
--         view_logs, audit_logs, sessions,
--         departments, employees, attendance, leave_requests,
--         leave_balances, chart_of_accounts, journal_entries,
--         journal_entry_lines, invoices, expenses, deals,
--         installments, handovers, tickets
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- CRM / Sales Tables
-- ============================================================

-- ── Users (application-level profiles linked to auth.users) ───
create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name_ar    text,
  full_name_en    text,
  email           text unique,
  phone           text,
  role            text default 'sales_agent',
  team_id         uuid,
  avatar_url      text,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

drop index if exists idx_users_role; create index idx_users_role    on users(role);
drop index if exists idx_users_team; create index idx_users_team    on users(team_id);

-- ── Contacts ──────────────────────────────────────────────────
create table if not exists contacts (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text,
  phone                  text,
  phone2                 text,
  email                  text,
  contact_type           text default 'lead',
  source                 text,
  department             text default 'sales',
  platform               text,
  campaign_name          text,
  campaign_interactions  jsonb default '[]',
  lead_score             integer default 0,
  temperature            text default 'warm',
  budget_min             numeric,
  budget_max             numeric,
  preferred_location     text,
  interested_in_type     text,
  is_blacklisted         boolean default false,
  blacklist_reason       text,
  contact_status         text default 'new',
  assigned_to            uuid references users(id),
  assigned_to_name       text,
  assigned_by_name       text,
  created_by             uuid,
  created_by_name        text,
  notes                  text,
  company                text,
  job_title              text,
  gender                 text,
  nationality            text,
  birth_date             date,
  prefix                 text,
  extra_phones           jsonb,
  referred_by            uuid references contacts(id),
  first_response_at      timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  last_activity_at       timestamptz default now()
);

drop index if exists idx_contacts_phone; create index idx_contacts_phone       on contacts(phone);
drop index if exists idx_contacts_type; create index idx_contacts_type        on contacts(contact_type);
drop index if exists idx_contacts_assigned; create index idx_contacts_assigned    on contacts(assigned_to);
drop index if exists idx_contacts_department; create index idx_contacts_department  on contacts(department);
drop index if exists idx_contacts_temperature; create index idx_contacts_temperature on contacts(temperature);
drop index if exists idx_contacts_source; create index idx_contacts_source      on contacts(source);
drop index if exists idx_contacts_last_act; create index idx_contacts_last_act    on contacts(last_activity_at);

-- ── Projects ──────────────────────────────────────────────────
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  name_ar         text,
  name_en         text,
  developer_ar    text,
  developer_en    text,
  location        text,
  property_type   text,
  status          text default 'active',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

drop index if exists idx_projects_status; create index idx_projects_status on projects(status);

-- ── Opportunities ─────────────────────────────────────────────
create table if not exists opportunities (
  id                   uuid primary key default gen_random_uuid(),
  contact_id           uuid references contacts(id) on delete set null,
  contact_name         text,
  project_id           uuid references projects(id) on delete set null,
  project_name         text,
  assigned_to          uuid references users(id) on delete set null,
  assigned_to_name     text,
  agent_name           text,
  stage                text default 'new',
  priority             text default 'medium',
  temperature          text default 'warm',
  budget               numeric default 0,
  source               text,
  dept                 text default 'sales',
  property_type        text,
  expected_close_date  date,
  lost_reason          text,
  won_date             timestamptz,
  notes                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

drop index if exists idx_opp_contact; create index idx_opp_contact    on opportunities(contact_id);
drop index if exists idx_opp_assigned; create index idx_opp_assigned   on opportunities(assigned_to);
drop index if exists idx_opp_stage; create index idx_opp_stage      on opportunities(stage);
drop index if exists idx_opp_project; create index idx_opp_project    on opportunities(project_id);

-- ── Activities ────────────────────────────────────────────────
create table if not exists activities (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,
  notes           text,
  entity_type     text,
  contact_id      uuid references contacts(id) on delete set null,
  opportunity_id  uuid references opportunities(id) on delete set null,
  user_id         uuid references users(id) on delete set null,
  user_name_ar    text,
  user_name_en    text,
  dept            text,
  status          text default 'completed',
  scheduled_date  timestamptz,
  created_at      timestamptz default now()
);

drop index if exists idx_activities_contact; create index idx_activities_contact  on activities(contact_id);
drop index if exists idx_activities_user; create index idx_activities_user     on activities(user_id);
drop index if exists idx_activities_type; create index idx_activities_type     on activities(type);
drop index if exists idx_activities_dept; create index idx_activities_dept     on activities(dept);

-- ── Tasks ─────────────────────────────────────────────────────
create table if not exists tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  type                  text default 'general',
  priority              text default 'medium',
  status                text default 'pending',
  contact_id            uuid references contacts(id) on delete set null,
  contact_name          text,
  assigned_to           uuid references users(id) on delete set null,
  assigned_to_name_ar   text,
  assigned_to_name_en   text,
  due_date              timestamptz,
  notes                 text,
  dept                  text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

drop index if exists idx_tasks_contact; create index idx_tasks_contact   on tasks(contact_id);
drop index if exists idx_tasks_assigned; create index idx_tasks_assigned  on tasks(assigned_to);
drop index if exists idx_tasks_status; create index idx_tasks_status    on tasks(status);
drop index if exists idx_tasks_due; create index idx_tasks_due       on tasks(due_date);
drop index if exists idx_tasks_dept; create index idx_tasks_dept      on tasks(dept);

-- ── Resale Units ──────────────────────────────────────────────
create table if not exists resale_units (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references contacts(id) on delete set null,
  project_name    text,
  developer_name  text,
  unit_code       text,
  unit_type       text,
  area            numeric,
  floor           text,
  price           numeric,
  status          text default 'available',
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

drop index if exists idx_resale_contact; create index idx_resale_contact on resale_units(contact_id);
drop index if exists idx_resale_status; create index idx_resale_status  on resale_units(status);

-- ── Campaigns ─────────────────────────────────────────────────
create table if not exists campaigns (
  id                    uuid primary key default gen_random_uuid(),
  name_en               text,
  name_ar               text,
  platform              text,
  status                text default 'active',
  budget                numeric default 0,
  spent                 numeric default 0,
  start_date            date,
  end_date              date,
  type                  text,
  target_audience       text,
  target_location       text,
  target_property_type  text,
  notes                 text,
  created_by            uuid references users(id) on delete set null,
  created_by_name       text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

drop index if exists idx_campaigns_status; create index idx_campaigns_status   on campaigns(status);
drop index if exists idx_campaigns_platform; create index idx_campaigns_platform on campaigns(platform);

-- ── Reminders ─────────────────────────────────────────────────
create table if not exists reminders (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text,
  entity_id       uuid,
  entity_name     text,
  due_at          timestamptz not null,
  type            text default 'call',
  notes           text,
  assigned_to     uuid references users(id) on delete set null,
  is_done         boolean default false,
  done_at         timestamptz,
  created_at      timestamptz default now()
);

drop index if exists idx_reminders_assigned; create index idx_reminders_assigned on reminders(assigned_to);
drop index if exists idx_reminders_due; create index idx_reminders_due      on reminders(due_at);
drop index if exists idx_reminders_done; create index idx_reminders_done     on reminders(is_done);

-- ── View Logs ─────────────────────────────────────────────────
create table if not exists view_logs (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text,
  entity_id       text,
  entity_name     text,
  user_id         uuid references users(id) on delete set null,
  user_name       text,
  user_role       text,
  viewed_at       timestamptz default now(),
  device_type     text,
  browser         text,
  os              text
);

drop index if exists idx_viewlogs_entity; create index idx_viewlogs_entity on view_logs(entity_type, entity_id);
drop index if exists idx_viewlogs_user; create index idx_viewlogs_user   on view_logs(user_id);
drop index if exists idx_viewlogs_date; create index idx_viewlogs_date   on view_logs(viewed_at);

-- ── Audit Logs ────────────────────────────────────────────────
create table if not exists audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  action          text not null,
  entity          text,
  entity_id       text,
  old_data        jsonb,
  new_data        jsonb,
  changes         jsonb,
  description     text,
  user_agent      text,
  created_at      timestamptz default now()
);

drop index if exists idx_audit_user; create index idx_audit_user   on audit_logs(user_id);
drop index if exists idx_audit_entity; create index idx_audit_entity on audit_logs(entity);
drop index if exists idx_audit_action; create index idx_audit_action on audit_logs(action);
drop index if exists idx_audit_date; create index idx_audit_date   on audit_logs(created_at);

-- ── Sessions ──────────────────────────────────────────────────
create table if not exists sessions (
  id              text primary key,
  user_id         uuid references users(id) on delete set null,
  user_name       text,
  user_role       text,
  ip_address      text,
  device_type     text,
  browser         text,
  os              text,
  user_agent      text,
  login_at        timestamptz default now(),
  last_active_at  timestamptz default now(),
  logout_at       timestamptz,
  is_active       boolean default true
);

drop index if exists idx_sessions_user; create index idx_sessions_user   on sessions(user_id);
drop index if exists idx_sessions_active; create index idx_sessions_active on sessions(is_active);

-- ============================================================
-- HR / Operations / Finance Tables
-- ============================================================

-- ── Departments ─────────────────────────────────────────────────
create table if not exists departments (
  id        uuid primary key default uuid_generate_v4(),
  name_ar   text not null,
  name_en   text not null,
  created_at timestamptz default now()
);

-- ── Employees ───────────────────────────────────────────────────
create table if not exists employees (
  id              uuid primary key default uuid_generate_v4(),
  employee_number text unique,
  full_name_ar    text not null,
  full_name_en    text not null,
  email           text unique,
  phone           text,
  national_id     text,
  department_id   uuid references departments(id),
  position        text,
  job_title_ar    text,
  job_title_en    text,
  role            text,
  work_type       text check (work_type in ('office','remote','field','hybrid')),
  contract_type   text check (contract_type in ('full_time','part_time','freelance','probation')),
  hire_date       date,
  contract_end_date date,
  salary          numeric(12,2) default 0,
  base_salary     numeric(12,2) default 0,
  ot_multiplier   text default '1x',
  tolerance_hours numeric(4,1) default 4,
  direct_manager_id uuid references employees(id),
  status          text not null default 'active'
                  check (status in ('active','inactive','terminated')),
  avatar_color    text,
  address         text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

drop index if exists idx_employees_department; create index idx_employees_department on employees(department_id);
drop index if exists idx_employees_status; create index idx_employees_status     on employees(status);
drop index if exists idx_employees_manager; create index idx_employees_manager    on employees(direct_manager_id);

-- ── Attendance ──────────────────────────────────────────────────
create table if not exists attendance (
  id          uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  date        date not null,
  check_in    time,
  check_out   time,
  status      text not null default 'present'
              check (status in ('present','absent','late','leave')),
  work_mode   text check (work_mode in ('normal','remote','field')),
  absent_with_notice boolean default false,
  ot_hours    numeric(4,1) default 0,
  source      text check (source in ('manual','fingerprint','system')),
  notes       text,
  created_at  timestamptz default now(),

  unique(employee_id, date)
);

drop index if exists idx_attendance_employee; create index idx_attendance_employee on attendance(employee_id);
drop index if exists idx_attendance_date; create index idx_attendance_date     on attendance(date);
drop index if exists idx_attendance_month; create index idx_attendance_month    on attendance(date_trunc('month', date));

-- ── Leave Requests ──────────────────────────────────────────────
create table if not exists leave_requests (
  id               uuid primary key default uuid_generate_v4(),
  employee_id      uuid not null references employees(id) on delete cascade,
  type             text not null
                   check (type in ('annual','sick','emergency','unpaid')),
  start_date       date not null,
  end_date         date not null,
  days             integer not null,
  status           text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  reason           text,
  rejection_reason text,
  approved_by      uuid references employees(id),
  created_at       timestamptz default now()
);

drop index if exists idx_leave_employee; create index idx_leave_employee on leave_requests(employee_id);
drop index if exists idx_leave_status; create index idx_leave_status   on leave_requests(status);

-- ── Leave Balances (materialized / cached) ──────────────────────
create table if not exists leave_balances (
  id              uuid primary key default uuid_generate_v4(),
  employee_id     uuid not null unique references employees(id) on delete cascade,
  annual          integer default 0,
  sick            integer default 0,
  emergency       integer default 0,
  used_annual     integer default 0,
  used_sick       integer default 0,
  used_emergency  integer default 0,
  year            integer default extract(year from now()),
  updated_at      timestamptz default now()
);

-- ── Chart of Accounts ───────────────────────────────────────────
create table if not exists chart_of_accounts (
  id        uuid primary key default uuid_generate_v4(),
  code      text unique not null,
  name_ar   text not null,
  name_en   text not null,
  type      text not null
            check (type in ('asset','liability','equity','revenue','expense')),
  parent_id uuid references chart_of_accounts(id),
  is_group  boolean default false,
  created_at timestamptz default now()
);

drop index if exists idx_coa_type; create index idx_coa_type   on chart_of_accounts(type);
drop index if exists idx_coa_parent; create index idx_coa_parent on chart_of_accounts(parent_id);

-- ── Journal Entries ─────────────────────────────────────────────
create table if not exists journal_entries (
  id             uuid primary key default uuid_generate_v4(),
  entry_number   text unique not null,
  date           date not null,
  status         text not null default 'draft'
                 check (status in ('draft','posted','voided')),
  description_ar text,
  description_en text,
  reference      text,
  total          numeric(14,2) default 0,
  created_by     uuid references auth.users(id),
  created_by_ar  text,
  created_by_en  text,
  created_at     timestamptz default now()
);

drop index if exists idx_je_date; create index idx_je_date   on journal_entries(date);
drop index if exists idx_je_status; create index idx_je_status on journal_entries(status);

-- ── Journal Entry Lines ─────────────────────────────────────────
create table if not exists journal_entry_lines (
  id               uuid primary key default uuid_generate_v4(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id       uuid not null references chart_of_accounts(id),
  debit            numeric(14,2) default 0,
  credit           numeric(14,2) default 0,
  description      text
);

drop index if exists idx_jel_entry; create index idx_jel_entry   on journal_entry_lines(journal_entry_id);
drop index if exists idx_jel_account; create index idx_jel_account on journal_entry_lines(account_id);

-- ── Invoices ────────────────────────────────────────────────────
create table if not exists invoices (
  id              uuid primary key default uuid_generate_v4(),
  number          text unique not null,
  type            text not null check (type in ('sales','purchase')),
  date            date not null,
  due_date        date,
  counterparty_ar text,
  counterparty_en text,
  deal_ref        text,
  items           jsonb default '[]'::jsonb,
  subtotal        numeric(14,2) default 0,
  tax             numeric(14,2) default 0,
  total           numeric(14,2) default 0,
  paid            numeric(14,2) default 0,
  status          text not null default 'draft'
                  check (status in ('draft','sent','partially_paid','paid','overdue','cancelled')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

drop index if exists idx_invoices_status; create index idx_invoices_status on invoices(status);
drop index if exists idx_invoices_date; create index idx_invoices_date   on invoices(date);
drop index if exists idx_invoices_type; create index idx_invoices_type   on invoices(type);

-- ── Expenses ────────────────────────────────────────────────────
create table if not exists expenses (
  id              uuid primary key default uuid_generate_v4(),
  number          text unique,
  category        text not null,
  account_id      uuid references chart_of_accounts(id),
  amount          numeric(14,2) not null,
  date            date not null,
  vendor_ar       text,
  vendor_en       text,
  desc_ar         text,
  desc_en         text,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','paid')),
  method          text check (method in ('cash','bank_transfer','check','card')),
  approved_by_ar  text,
  approved_by_en  text,
  approved_by     uuid references auth.users(id),
  created_at      timestamptz default now()
);

drop index if exists idx_expenses_status; create index idx_expenses_status   on expenses(status);
drop index if exists idx_expenses_category; create index idx_expenses_category on expenses(category);
drop index if exists idx_expenses_date; create index idx_expenses_date     on expenses(date);

-- ── Deals (Operations) ─────────────────────────────────────────
create table if not exists deals (
  id                uuid primary key default uuid_generate_v4(),
  deal_number       text unique not null,
  opportunity_id    uuid,
  client_ar         text,
  client_en         text,
  phone             text,
  agent_ar          text,
  agent_en          text,
  project_ar        text,
  project_en        text,
  developer_ar      text,
  developer_en      text,
  unit_code         text,
  unit_type_ar      text,
  unit_type_en      text,
  deal_value        numeric(14,2) default 0,
  down_payment      numeric(14,2) default 0,
  installments_count integer default 0,
  status            text not null default 'new_deal'
                    check (status in ('new_deal','under_review','docs_collection','contract_prep','contract_signed','completed','cancelled')),
  documents         jsonb default '{}'::jsonb,
  contact_id        uuid,
  project_id        uuid,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

drop index if exists idx_deals_status; create index idx_deals_status on deals(status);
drop index if exists idx_deals_number; create index idx_deals_number on deals(deal_number);

-- ── Installments ────────────────────────────────────────────────
create table if not exists installments (
  id           uuid primary key default uuid_generate_v4(),
  deal_id      uuid not null references deals(id) on delete cascade,
  deal_number  text,
  client_ar    text,
  client_en    text,
  project_ar   text,
  project_en   text,
  num          integer not null,
  total        integer not null,
  amount       numeric(14,2) not null,
  due_date     date not null,
  paid_date    date,
  status       text not null default 'upcoming'
               check (status in ('upcoming','due','overdue','paid','partial')),
  method       text check (method in ('cash','bank_transfer','check','card')),
  receipt      text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

drop index if exists idx_installments_deal; create index idx_installments_deal   on installments(deal_id);
drop index if exists idx_installments_status; create index idx_installments_status on installments(status);
drop index if exists idx_installments_due; create index idx_installments_due    on installments(due_date);

-- ── Handovers ───────────────────────────────────────────────────
create table if not exists handovers (
  id                  uuid primary key default uuid_generate_v4(),
  deal_id             uuid references deals(id),
  deal_number         text,
  client_ar           text,
  client_en           text,
  project_ar          text,
  project_en          text,
  developer_ar        text,
  developer_en        text,
  unit_code           text,
  reserved_date       date,
  expected_handover   date,
  actual_handover     date,
  status              text not null default 'reserved'
                      check (status in ('reserved','developer_confirmed','under_construction','finishing','ready','handed_over')),
  dev_contact         text,
  dev_phone           text,
  notes_ar            text,
  created_at          timestamptz default now()
);

drop index if exists idx_handovers_deal; create index idx_handovers_deal   on handovers(deal_id);
drop index if exists idx_handovers_status; create index idx_handovers_status on handovers(status);

-- ── Tickets ─────────────────────────────────────────────────────
create table if not exists tickets (
  id             uuid primary key default uuid_generate_v4(),
  ticket_number  text unique not null,
  deal_id        uuid references deals(id),
  client_ar      text,
  client_en      text,
  type           text not null
                 check (type in ('complaint','maintenance','inquiry','modification')),
  priority       text not null default 'medium'
                 check (priority in ('urgent','high','medium','low')),
  subject_ar     text,
  subject_en     text,
  assigned_ar    text,
  assigned_en    text,
  assigned_to    uuid references auth.users(id),
  status         text not null default 'open'
                 check (status in ('open','in_progress','waiting','resolved','closed')),
  rating         integer check (rating between 1 and 5),
  created_at     timestamptz default now(),
  resolved_at    timestamptz,
  updated_at     timestamptz default now()
);

drop index if exists idx_tickets_status; create index idx_tickets_status   on tickets(status);
drop index if exists idx_tickets_type; create index idx_tickets_type     on tickets(type);
drop index if exists idx_tickets_priority; create index idx_tickets_priority on tickets(priority);
drop index if exists idx_tickets_deal; create index idx_tickets_deal     on tickets(deal_id);


-- ============================================================
-- Add missing columns to existing tables (safe - skip if exists)
-- ============================================================

DO $$ BEGIN ALTER TABLE contacts ADD COLUMN assigned_to uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN assigned_to_name text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN assigned_by_name text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN created_by uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN created_by_name text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN campaign_interactions jsonb default '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN extra_phones jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contacts ADD COLUMN contact_status text default 'new'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN assigned_to uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN assigned_to_name text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN contact_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN project_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN stage_changed_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN deal_value numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN lost_reason text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE opportunities ADD COLUMN expected_close_date date; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE activities ADD COLUMN contact_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE activities ADD COLUMN opportunity_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE activities ADD COLUMN user_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE activities ADD COLUMN meeting_subtype text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE deals ADD COLUMN contact_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN opportunity_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN project_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN assigned_to uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN deal_value numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN client_budget numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE tasks ADD COLUMN assigned_to uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN contact_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE employees ADD COLUMN is_active boolean default true; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE employees ADD COLUMN deleted_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE reminders ADD COLUMN assigned_to uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE tickets ADD COLUMN assigned_to uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE leave_requests ADD COLUMN employee_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE attendance ADD COLUMN employee_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE leave_balances ADD COLUMN employee_id uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE invoices ADD COLUMN created_by uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN created_by uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE journal_entries ADD COLUMN created_by uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Foreign Key Constraints (safe - skip if already exists)
-- ============================================================

DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT fk_opp_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT fk_opp_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT fk_opp_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT fk_act_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT fk_act_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT fk_deal_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT fk_deal_opp FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT fk_deal_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reminders ADD CONSTRAINT fk_reminder_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;


-- ============================================================
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
-- Missing tables (referenced by services)
-- ============================================================

-- ── Announcements ─────────────────────────────────────────────
create table if not exists announcements (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  title_ar      text,
  body          text,
  body_ar       text,
  category      text default 'general',
  priority      text default 'normal',
  pinned        boolean default false,
  created_by    uuid references users(id),
  created_at    timestamptz default now()
);

-- ── Approvals ─────────────────────────────────────────────────
create table if not exists approvals (
  id              uuid primary key default uuid_generate_v4(),
  entity_type     text not null,
  entity_id       text not null,
  entity_name     text,
  requester_id    text,
  requester_name  text,
  approver_id     text,
  approver_name   text,
  status          text default 'pending',
  amount          numeric default 0,
  priority        text default 'normal',
  notes           text,
  decided_at      timestamptz,
  created_at      timestamptz default now()
);

-- ── Chat Messages ─────────────────────────────────────────────
create table if not exists chat_messages (
  id            uuid primary key default uuid_generate_v4(),
  channel_id    text,
  sender_id     uuid references users(id),
  sender_name   text,
  content       text,
  type          text default 'text',
  read_by       jsonb default '[]',
  created_at    timestamptz default now()
);

-- ── Commission Installments ───────────────────────────────────
create table if not exists commission_installments (
  id            uuid primary key default uuid_generate_v4(),
  deal_id       uuid references deals(id),
  agent_id      uuid references users(id),
  amount        numeric default 0,
  status        text default 'pending',
  due_date      date,
  paid_date     date,
  created_at    timestamptz default now()
);

-- ── Documents ─────────────────────────────────────────────────
create table if not exists documents (
  id            uuid primary key default uuid_generate_v4(),
  entity_type   text not null,
  entity_id     text not null,
  name          text,
  file_url      text,
  file_type     text,
  file_size     integer,
  uploaded_by   uuid references users(id),
  created_at    timestamptz default now()
);

-- ── Emails & Templates ────────────────────────────────────────
create table if not exists email_templates (
  id            uuid primary key default uuid_generate_v4(),
  name          text,
  subject       text,
  body          text,
  category      text,
  created_at    timestamptz default now()
);

create table if not exists emails (
  id            uuid primary key default uuid_generate_v4(),
  from_address  text,
  to_address    text,
  subject       text,
  body          text,
  status        text default 'draft',
  folder        text default 'inbox',
  is_read       boolean default false,
  contact_id    uuid references contacts(id),
  created_at    timestamptz default now()
);

-- ── Expense Claims ────────────────────────────────────────────
create table if not exists expense_claims (
  id            uuid primary key default uuid_generate_v4(),
  employee_id   uuid references employees(id),
  amount        numeric default 0,
  category      text,
  description   text,
  receipt_url   text,
  status        text default 'pending',
  approved_by   uuid references users(id),
  created_at    timestamptz default now()
);

-- ── Knowledge Base ────────────────────────────────────────────
create table if not exists knowledge_articles (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  title_ar      text,
  body          text,
  body_ar       text,
  category      text,
  tags          jsonb default '[]',
  author_id     uuid references users(id),
  published     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── KPI Targets ───────────────────────────────────────────────
create table if not exists kpi_targets (
  id            uuid primary key default uuid_generate_v4(),
  employee_id   uuid references users(id),
  month         integer not null,
  year          integer not null,
  calls         integer default 0,
  meetings      integer default 0,
  site_visits   integer default 0,
  deals_closed  integer default 0,
  revenue       numeric default 0,
  created_at    timestamptz default now()
);

-- ── Notifications ─────────────────────────────────────────────
create table if not exists notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references users(id),
  type          text default 'info',
  title         text,
  message       text,
  entity_type   text,
  entity_id     text,
  priority      text default 'normal',
  is_read       boolean default false,
  created_at    timestamptz default now()
);

-- ── OKRs ──────────────────────────────────────────────────────
create table if not exists okrs (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  title_ar      text,
  type          text default 'objective',
  parent_id     uuid references okrs(id),
  owner_id      uuid references users(id),
  quarter       text,
  year          integer,
  progress      integer default 0,
  status        text default 'on_track',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Scheduled Reports ─────────────────────────────────────────
create table if not exists scheduled_reports (
  id            uuid primary key default uuid_generate_v4(),
  name          text,
  report_type   text,
  frequency     text default 'weekly',
  recipients    jsonb default '[]',
  filters       jsonb default '{}',
  is_active     boolean default true,
  last_sent_at  timestamptz,
  created_by    uuid references users(id),
  created_at    timestamptz default now()
);

-- ── SMS Log & Templates ───────────────────────────────────────
create table if not exists sms_templates (
  id            uuid primary key default uuid_generate_v4(),
  name          text,
  name_ar       text,
  body          text,
  body_ar       text,
  category      text,
  created_at    timestamptz default now()
);

create table if not exists sms_log (
  id            uuid primary key default uuid_generate_v4(),
  contact_id    uuid references contacts(id),
  phone         text,
  template_id   uuid references sms_templates(id),
  message       text,
  status        text default 'sent',
  sent_by       uuid references users(id),
  created_at    timestamptz default now()
);

-- ── System Config ─────────────────────────────────────────────
create table if not exists system_config (
  id            uuid primary key default uuid_generate_v4(),
  key           text unique not null,
  value         jsonb,
  updated_by    uuid references users(id),
  updated_at    timestamptz default now()
);

-- ── WhatsApp ──────────────────────────────────────────────────
create table if not exists whatsapp_messages (
  id            uuid primary key default uuid_generate_v4(),
  contact_id    uuid references contacts(id),
  contact_name  text,
  contact_phone text,
  direction     text default 'outgoing',
  message       text,
  type          text default 'text',
  status        text default 'sent',
  sent_by       uuid references users(id),
  created_at    timestamptz default now()
);

create table if not exists whatsapp_templates (
  id            uuid primary key default uuid_generate_v4(),
  name          text,
  name_ar       text,
  body          text,
  body_ar       text,
  category      text,
  created_at    timestamptz default now()
);

-- ── Stage History ─────────────────────────────────────────────
create table if not exists stage_history (
  id              uuid primary key default uuid_generate_v4(),
  opportunity_id  uuid references opportunities(id) on delete cascade,
  from_stage      text,
  to_stage        text,
  changed_at      timestamptz default now()
);

-- ── Security Config (IP whitelist etc) ────────────────────────
create table if not exists security_config (
  id            uuid primary key default uuid_generate_v4(),
  key           text unique not null,
  value         jsonb,
  updated_by    uuid references users(id),
  updated_at    timestamptz default now()
);

-- ============================================================
-- Performance Indexes (for 5000+ contacts scale)
-- ============================================================

-- Contacts: frequent query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_department       ON contacts (department);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned         ON contacts (assigned_to_name);
CREATE INDEX IF NOT EXISTS idx_contacts_source           ON contacts (source);
CREATE INDEX IF NOT EXISTS idx_contacts_type             ON contacts (contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_last_activity    ON contacts (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_created          ON contacts (created_at DESC);

-- Opportunities: pipeline queries
CREATE INDEX IF NOT EXISTS idx_opps_stage                ON opportunities (stage);
CREATE INDEX IF NOT EXISTS idx_opps_assigned             ON opportunities (assigned_to);
CREATE INDEX IF NOT EXISTS idx_opps_contact              ON opportunities (contact_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage_changed        ON opportunities (stage_changed_at DESC);

-- Activities: entity lookups
CREATE INDEX IF NOT EXISTS idx_activities_contact         ON activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_user            ON activities (user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created         ON activities (created_at DESC);

-- Deals
CREATE INDEX IF NOT EXISTS idx_deals_opp                 ON deals (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_deals_status               ON deals (status);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user         ON notifications (user_id, is_read);

-- Archive table for old audit logs
CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING ALL);

-- Function: archive audit logs older than 6 months
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs_archive
    SELECT * FROM audit_logs
    WHERE created_at < now() - interval '6 months';
  DELETE FROM audit_logs
    WHERE created_at < now() - interval '6 months';
END;
$$ LANGUAGE plpgsql;

-- Archive table for old view logs
CREATE TABLE IF NOT EXISTS view_logs_archive (LIKE view_logs INCLUDING ALL);

CREATE OR REPLACE FUNCTION archive_old_view_logs()
RETURNS void AS $$
BEGIN
  INSERT INTO view_logs_archive
    SELECT * FROM view_logs
    WHERE created_at < now() - interval '3 months';
  DELETE FROM view_logs
    WHERE created_at < now() - interval '3 months';
END;
$$ LANGUAGE plpgsql;

-- ── Deal Number Sequence (prevents race conditions) ─────────
CREATE SEQUENCE IF NOT EXISTS deal_number_seq START WITH 100 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_deal_number()
RETURNS text AS $$
DECLARE
  yr text := extract(year FROM now())::text;
  seq int := nextval('deal_number_seq');
BEGIN
  RETURN 'D-' || yr || '-' || lpad(seq::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Fuzzy text search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm        ON contacts USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm       ON contacts USING gin (phone gin_trgm_ops);

-- ============================================================
-- Row Level Security (RLS) — Data Protection
-- ============================================================

-- Helper: get current user's role from users table
CREATE OR REPLACE FUNCTION auth_role()
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid()),
    'sales_agent'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get current user's team_id
CREATE OR REPLACE FUNCTION auth_team()
RETURNS uuid AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if current user is admin/manager
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS boolean AS $$
  SELECT auth_role() IN ('admin', 'sales_director', 'sales_manager');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Enable RLS on all critical tables ─────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════
-- USERS table policies
-- ══════════════════════════════════════════════
-- Everyone can read user profiles (needed for dropdowns, assignments)
CREATE POLICY users_select ON users FOR SELECT USING (true);
-- Only admin can insert/update/delete users
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY users_update ON users FOR UPDATE USING (
  auth.uid() = id OR auth_role() = 'admin'
);
CREATE POLICY users_delete ON users FOR DELETE USING (auth_role() = 'admin');

-- ══════════════════════════════════════════════
-- CONTACTS table policies
-- ══════════════════════════════════════════════
-- Admin/Director/Manager: see all contacts
-- Team Leader: see team contacts
-- Sales Agent: see only own contacts
CREATE POLICY contacts_select ON contacts FOR SELECT USING (
  is_manager_or_above()
  OR assigned_to_name = (SELECT full_name_ar FROM users WHERE id = auth.uid())
  OR assigned_to_name = (SELECT full_name_en FROM users WHERE id = auth.uid())
  OR auth_role() = 'team_leader'  -- team leaders see all for assignment purposes
);
-- Insert: any authenticated user
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Update: own contacts + managers
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (
  is_manager_or_above()
  OR assigned_to_name = (SELECT full_name_ar FROM users WHERE id = auth.uid())
  OR assigned_to_name = (SELECT full_name_en FROM users WHERE id = auth.uid())
);
-- Delete: managers only
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (is_manager_or_above());

-- ══════════════════════════════════════════════
-- OPPORTUNITIES table policies
-- ══════════════════════════════════════════════
CREATE POLICY opps_select ON opportunities FOR SELECT USING (
  is_manager_or_above()
  OR assigned_to = auth.uid()
  OR auth_role() = 'team_leader'
);
CREATE POLICY opps_insert ON opportunities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY opps_update ON opportunities FOR UPDATE USING (
  is_manager_or_above()
  OR assigned_to = auth.uid()
);
CREATE POLICY opps_delete ON opportunities FOR DELETE USING (is_manager_or_above());

-- ══════════════════════════════════════════════
-- ACTIVITIES table policies
-- ══════════════════════════════════════════════
-- Activities readable by anyone involved
CREATE POLICY activities_select ON activities FOR SELECT USING (
  is_manager_or_above()
  OR user_id = auth.uid()
  OR auth_role() = 'team_leader'
);
CREATE POLICY activities_insert ON activities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY activities_update ON activities FOR UPDATE USING (
  user_id = auth.uid() OR is_manager_or_above()
);
CREATE POLICY activities_delete ON activities FOR DELETE USING (is_manager_or_above());

-- ══════════════════════════════════════════════
-- DEALS table policies
-- ══════════════════════════════════════════════
CREATE POLICY deals_select ON deals FOR SELECT USING (
  is_manager_or_above()
  OR auth_role() IN ('operations', 'finance')
  OR agent_ar = (SELECT full_name_ar FROM users WHERE id = auth.uid())
  OR agent_en = (SELECT full_name_en FROM users WHERE id = auth.uid())
);
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY deals_update ON deals FOR UPDATE USING (
  is_manager_or_above() OR auth_role() IN ('operations', 'finance')
);
CREATE POLICY deals_delete ON deals FOR DELETE USING (auth_role() = 'admin');

-- ══════════════════════════════════════════════
-- TASKS table policies
-- ══════════════════════════════════════════════
CREATE POLICY tasks_select ON tasks FOR SELECT USING (
  is_manager_or_above()
  OR assigned_to = auth.uid()
  OR user_id = auth.uid()
);
CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY tasks_update ON tasks FOR UPDATE USING (
  assigned_to = auth.uid() OR user_id = auth.uid() OR is_manager_or_above()
);
CREATE POLICY tasks_delete ON tasks FOR DELETE USING (is_manager_or_above());

-- ══════════════════════════════════════════════
-- NOTIFICATIONS table policies
-- ══════════════════════════════════════════════
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = auth.uid() OR auth_role() = 'admin'
);
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY notifications_delete ON notifications FOR DELETE USING (
  user_id = auth.uid() OR auth_role() = 'admin'
);

-- ══════════════════════════════════════════════
-- REMINDERS table policies
-- ══════════════════════════════════════════════
CREATE POLICY reminders_select ON reminders FOR SELECT USING (
  user_id = auth.uid() OR is_manager_or_above()
);
CREATE POLICY reminders_insert ON reminders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY reminders_update ON reminders FOR UPDATE USING (
  user_id = auth.uid() OR is_manager_or_above()
);
CREATE POLICY reminders_delete ON reminders FOR DELETE USING (
  user_id = auth.uid() OR is_manager_or_above()
);

-- ══════════════════════════════════════════════
-- EMPLOYEES table policies
-- ══════════════════════════════════════════════
CREATE POLICY employees_select ON employees FOR SELECT USING (
  auth_role() IN ('admin', 'hr') OR id = auth.uid()
);
CREATE POLICY employees_insert ON employees FOR INSERT WITH CHECK (auth_role() IN ('admin', 'hr'));
CREATE POLICY employees_update ON employees FOR UPDATE USING (auth_role() IN ('admin', 'hr'));
CREATE POLICY employees_delete ON employees FOR DELETE USING (auth_role() = 'admin');

-- ══════════════════════════════════════════════
-- LEAVE REQUESTS policies
-- ══════════════════════════════════════════════
CREATE POLICY leave_select ON leave_requests FOR SELECT USING (
  auth_role() IN ('admin', 'hr') OR employee_id = auth.uid()
);
CREATE POLICY leave_insert ON leave_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY leave_update ON leave_requests FOR UPDATE USING (auth_role() IN ('admin', 'hr'));

-- ══════════════════════════════════════════════
-- AUDIT LOGS — admin only
-- ══════════════════════════════════════════════
CREATE POLICY audit_select ON audit_logs FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════
-- Rate Limiting function (optional — call from Edge Functions)
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION check_rate_limit(user_uuid uuid, action_type text, max_per_minute int DEFAULT 60)
RETURNS boolean AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM audit_logs
  WHERE user_id = user_uuid::text
    AND action = action_type
    AND created_at > now() - interval '1 minute';
  RETURN recent_count < max_per_minute;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

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
