-- Developers Hub — a lightweight team directory of the real-estate developers we
-- work with. Intentionally minimal: only `name` + `groups` are required; every
-- other field is optional and the UI shows it only when present. Collaborative —
-- any authenticated team member can add a developer / paste a group link, so the
-- directory fills itself over time without a dedicated data-entry owner.
create extension if not exists pgcrypto;

create table if not exists public.developers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  logo_color      text,                              -- optional brand tint for the avatar
  groups          jsonb not null default '[]'::jsonb, -- [{type:'whatsapp'|'telegram', url, label}]
  contact_name    text,                              -- the sales/broker rep we deal with there
  contact_phone   text,
  projects        text[] default '{}',               -- optional project names
  commission      text,                              -- e.g. '5%'
  notes           text,
  status          text default 'active',             -- active | new | inactive
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_developers_name on public.developers (lower(name));

alter table public.developers enable row level security;
drop policy if exists developers_all on public.developers;
create policy developers_all on public.developers
  for all to authenticated
  using (true) with check (true);
