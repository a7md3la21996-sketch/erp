-- Restrict WRITES on developers to Operations + Admin only.
-- READ stays open to every authenticated user (the whole team sees the directory);
-- only ops/admin may add, edit, or delete. Mirrors the app-side guard in
-- developersService.js (canManageDevelopers / MANAGE_ROLES).

-- Helper: is the current user an ops/admin?
create or replace function public.is_developers_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'operations')
  );
$$;

alter table public.developers enable row level security;

-- Replace the old fully-open policy with read-open / write-restricted policies.
drop policy if exists developers_all    on public.developers;
drop policy if exists developers_read   on public.developers;
drop policy if exists developers_insert on public.developers;
drop policy if exists developers_update on public.developers;
drop policy if exists developers_delete on public.developers;

-- Everyone authenticated can read.
create policy developers_read on public.developers
  for select to authenticated
  using (true);

-- Only ops/admin can write.
create policy developers_insert on public.developers
  for insert to authenticated
  with check (public.is_developers_manager());

create policy developers_update on public.developers
  for update to authenticated
  using (public.is_developers_manager())
  with check (public.is_developers_manager());

create policy developers_delete on public.developers
  for delete to authenticated
  using (public.is_developers_manager());
