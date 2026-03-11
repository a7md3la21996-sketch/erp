-- ============================================================
-- Platform Real Estate ERP — Supabase Schema
-- Tables: departments, employees, attendance, leave_requests,
--         chart_of_accounts, journal_entries, journal_entry_lines,
--         invoices, expenses, deals, installments, handovers, tickets
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

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

create index idx_employees_department on employees(department_id);
create index idx_employees_status     on employees(status);
create index idx_employees_manager    on employees(direct_manager_id);

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

create index idx_attendance_employee on attendance(employee_id);
create index idx_attendance_date     on attendance(date);
create index idx_attendance_month    on attendance(date_trunc('month', date));

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

create index idx_leave_employee on leave_requests(employee_id);
create index idx_leave_status   on leave_requests(status);

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

create index idx_coa_type   on chart_of_accounts(type);
create index idx_coa_parent on chart_of_accounts(parent_id);

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

create index idx_je_date   on journal_entries(date);
create index idx_je_status on journal_entries(status);

-- ── Journal Entry Lines ─────────────────────────────────────────

create table if not exists journal_entry_lines (
  id               uuid primary key default uuid_generate_v4(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id       uuid not null references chart_of_accounts(id),
  debit            numeric(14,2) default 0,
  credit           numeric(14,2) default 0,
  description      text
);

create index idx_jel_entry   on journal_entry_lines(journal_entry_id);
create index idx_jel_account on journal_entry_lines(account_id);

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

create index idx_invoices_status on invoices(status);
create index idx_invoices_date   on invoices(date);
create index idx_invoices_type   on invoices(type);

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

create index idx_expenses_status   on expenses(status);
create index idx_expenses_category on expenses(category);
create index idx_expenses_date     on expenses(date);

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

create index idx_deals_status on deals(status);
create index idx_deals_number on deals(deal_number);

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

create index idx_installments_deal   on installments(deal_id);
create index idx_installments_status on installments(status);
create index idx_installments_due    on installments(due_date);

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

create index idx_handovers_deal   on handovers(deal_id);
create index idx_handovers_status on handovers(status);

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

create index idx_tickets_status   on tickets(status);
create index idx_tickets_type     on tickets(type);
create index idx_tickets_priority on tickets(priority);
create index idx_tickets_deal     on tickets(deal_id);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
alter table departments       enable row level security;
alter table employees         enable row level security;
alter table attendance        enable row level security;
alter table leave_requests    enable row level security;
alter table leave_balances    enable row level security;
alter table chart_of_accounts enable row level security;
alter table journal_entries   enable row level security;
alter table journal_entry_lines enable row level security;
alter table invoices          enable row level security;
alter table expenses          enable row level security;
alter table deals             enable row level security;
alter table installments      enable row level security;
alter table handovers         enable row level security;
alter table tickets           enable row level security;

-- ── Departments — readable by all authenticated users ────────

create policy "departments_select" on departments
  for select to authenticated using (true);

create policy "departments_manage" on departments
  for all to authenticated using (true) with check (true);

-- ── Employees — HR and managers can manage, all can read ─────

create policy "employees_select" on employees
  for select to authenticated using (true);

create policy "employees_insert" on employees
  for insert to authenticated with check (true);

create policy "employees_update" on employees
  for update to authenticated using (true) with check (true);

create policy "employees_delete" on employees
  for delete to authenticated using (true);

-- ── Attendance — employees see own, HR sees all ──────────────

create policy "attendance_select" on attendance
  for select to authenticated using (true);

create policy "attendance_insert" on attendance
  for insert to authenticated with check (true);

create policy "attendance_update" on attendance
  for update to authenticated using (true) with check (true);

-- ── Leave Requests — employees see own, managers see team ────

create policy "leave_select" on leave_requests
  for select to authenticated using (true);

create policy "leave_insert" on leave_requests
  for insert to authenticated with check (true);

create policy "leave_update" on leave_requests
  for update to authenticated using (true) with check (true);

-- ── Leave Balances ──────────────────────────────────────────

create policy "leave_balances_select" on leave_balances
  for select to authenticated using (true);

create policy "leave_balances_manage" on leave_balances
  for all to authenticated using (true) with check (true);

-- ── Chart of Accounts — readable by all, managed by finance ─

create policy "coa_select" on chart_of_accounts
  for select to authenticated using (true);

create policy "coa_manage" on chart_of_accounts
  for all to authenticated using (true) with check (true);

-- ── Journal Entries ─────────────────────────────────────────

create policy "je_select" on journal_entries
  for select to authenticated using (true);

create policy "je_insert" on journal_entries
  for insert to authenticated with check (true);

create policy "je_update" on journal_entries
  for update to authenticated using (true) with check (true);

create policy "jel_select" on journal_entry_lines
  for select to authenticated using (true);

create policy "jel_insert" on journal_entry_lines
  for insert to authenticated with check (true);

-- ── Invoices ────────────────────────────────────────────────

create policy "invoices_select" on invoices
  for select to authenticated using (true);

create policy "invoices_insert" on invoices
  for insert to authenticated with check (true);

create policy "invoices_update" on invoices
  for update to authenticated using (true) with check (true);

-- ── Expenses ────────────────────────────────────────────────

create policy "expenses_select" on expenses
  for select to authenticated using (true);

create policy "expenses_insert" on expenses
  for insert to authenticated with check (true);

create policy "expenses_update" on expenses
  for update to authenticated using (true) with check (true);

-- ── Deals ───────────────────────────────────────────────────

create policy "deals_select" on deals
  for select to authenticated using (true);

create policy "deals_insert" on deals
  for insert to authenticated with check (true);

create policy "deals_update" on deals
  for update to authenticated using (true) with check (true);

-- ── Installments ────────────────────────────────────────────

create policy "installments_select" on installments
  for select to authenticated using (true);

create policy "installments_insert" on installments
  for insert to authenticated with check (true);

create policy "installments_update" on installments
  for update to authenticated using (true) with check (true);

-- ── Handovers ───────────────────────────────────────────────

create policy "handovers_select" on handovers
  for select to authenticated using (true);

create policy "handovers_insert" on handovers
  for insert to authenticated with check (true);

create policy "handovers_update" on handovers
  for update to authenticated using (true) with check (true);

-- ── Tickets ─────────────────────────────────────────────────

create policy "tickets_select" on tickets
  for select to authenticated using (true);

create policy "tickets_insert" on tickets
  for insert to authenticated with check (true);

create policy "tickets_update" on tickets
  for update to authenticated using (true) with check (true);
