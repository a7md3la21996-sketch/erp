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
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  last_activity_at       timestamptz default now()
);


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


-- ── Journal Entry Lines ─────────────────────────────────────────
create table if not exists journal_entry_lines (
  id               uuid primary key default uuid_generate_v4(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id       uuid not null references chart_of_accounts(id),
  debit            numeric(14,2) default 0,
  credit           numeric(14,2) default 0,
  description      text
);


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
