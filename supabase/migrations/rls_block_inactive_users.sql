-- =============================================================================
-- DRAFT — REVIEW + TEST ON STAGING BEFORE APPLYING TO PRODUCTION. DO NOT run
-- this blindly. A wrong RLS change can lock out EVERY user, including admins.
-- =============================================================================
--
-- Goal: enforce, at the database level (the real authority), that a deactivated
-- account (users.status = 'inactive' OR users.is_active = false) cannot read or
-- write ANY data — even with a still-valid token or by calling the API directly,
-- bypassing the app UI. This complements the client-side checks in AuthContext.
--
-- Approach: ONE reusable check function + a RESTRICTIVE policy per table.
-- RESTRICTIVE policies are AND-ed with your existing (permissive) policies, so
-- they ADD the "must be active" gate WITHOUT rewriting what you already have:
--   final access = (your existing policies decide WHICH rows) AND (is active).
--
-- =============================================================================
-- 1) The check: is the caller's account active?
-- =============================================================================
-- SECURITY DEFINER so it can read `users` regardless of the caller's own RLS
-- (an active user must be confirmed active even if row-level reads are tight).
-- search_path is pinned for safety (SECURITY DEFINER best practice).
-- Defaults: a NULL status / NULL is_active counts as ACTIVE (legacy rows). A
-- caller with NO matching users row → NOT active (deny unknown). Verify that
-- assumption fits your data before applying (see the verification block).

create or replace function public.auth_user_is_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (u.status is distinct from 'inactive') and coalesce(u.is_active, true)
       from public.users u
      where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.auth_user_is_active() from public;
grant execute on function public.auth_user_is_active() to authenticated;

-- =============================================================================
-- 2) VERIFY before you gate anything. Run these first.
-- =============================================================================
-- (a) As an ACTIVE user's session this must return true:
--        select public.auth_user_is_active();
-- (b) Confirm every real user has a users row keyed by their auth id, else they
--     would be denied. This should return 0:
--        select count(*) from auth.users a
--        left join public.users u on u.id = a.id
--        where u.id is null;
--     If it returns > 0, fix those rows (or relax the function's default) BEFORE
--     applying the policies below.

-- =============================================================================
-- 3) Add the RESTRICTIVE gate to ONE table first (contacts) and TEST.
-- =============================================================================
-- Test plan after this:
--   - active user: can still see their contacts (unchanged).
--   - deactivate a test user, then with THAT user's token: contacts return 0.
--   - re-activate: access returns.
alter table public.contacts enable row level security;  -- no-op if already on
create policy require_active_account on public.contacts
  as restrictive
  for all
  to authenticated
  using (public.auth_user_is_active());

-- =============================================================================
-- 4) Once contacts is verified, generate the SAME policy for the other tables.
-- =============================================================================
-- Run this SELECT, REVIEW the generated statements, then run the ones you want.
-- `users` is intentionally EXCLUDED — gating the users table can break login's
-- own profile read (chicken-and-egg). The function above already reads it via
-- SECURITY DEFINER. Add other tables you DON'T want gated to the NOT IN list.
--
--   select format(
--     'create policy require_active_account on %I.%I as restrictive for all to authenticated using (public.auth_user_is_active());',
--     schemaname, tablename)
--   from pg_tables
--   where schemaname = 'public'
--     and tablename not in ('users')
--     and tablename not in (
--       select tablename from pg_policies
--       where schemaname = 'public' and policyname = 'require_active_account'
--     );

-- =============================================================================
-- 5) ROLLBACK — remove the gate from every table it was added to.
-- =============================================================================
--   select format('drop policy if exists require_active_account on %I.%I;', schemaname, tablename)
--   from pg_policies
--   where schemaname = 'public' and policyname = 'require_active_account';
--   -- then run the generated DROP statements, and optionally:
--   -- drop function if exists public.auth_user_is_active();
