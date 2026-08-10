-- Per-agent MEETINGS breakdown for a date range (managers). One row per agent:
-- how many meetings they BOOKED (status=scheduled) vs HAPPENED (status=completed)
-- in the window, split by type (site visit / office / online), plus how many
-- future meetings are still on their calendar (upcoming). Server-aggregated;
-- SECURITY INVOKER so RLS scopes it (agent→self, manager→team, admin→all) — an
-- agent can never see a peer's numbers through it.
create or replace function public.get_meetings_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  agent_id    uuid,
  agent_name  text,
  booked      bigint,
  happened    bigint,
  total       bigint,
  site_visit  bigint,
  office      bigint,
  online      bigint,
  upcoming    bigint
)
language sql stable security invoker
as $$
  with m as (
    select user_id,
      count(*) filter (where status = 'scheduled')            as booked,
      count(*) filter (where status = 'completed')            as happened,
      count(*)                                                as total,
      count(*) filter (where meeting_subtype = 'site_visit')  as site_visit,
      count(*) filter (where meeting_subtype = 'office')       as office,
      count(*) filter (where meeting_subtype = 'online')       as online
    from public.activities
    where type = 'meeting'
      and created_at >= p_from and created_at < p_to
      and user_id is not null
    group by user_id
  ),
  up as (
    select user_id, count(*) as upcoming
    from public.activities
    where type = 'meeting' and status = 'scheduled'
      and scheduled_date >= now() and user_id is not null
    group by user_id
  )
  select
    m.user_id,
    coalesce(u.full_name_en, u.full_name_ar) as agent_name,
    m.booked, m.happened, m.total, m.site_visit, m.office, m.online,
    coalesce(up.upcoming, 0) as upcoming
  from m
  join public.users u on u.id = m.user_id
  left join up on up.user_id = m.user_id
  order by m.total desc;
$$;
grant execute on function public.get_meetings_breakdown(timestamptz, timestamptz) to authenticated;
