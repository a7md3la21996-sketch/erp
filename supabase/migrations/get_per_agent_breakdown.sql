-- Per-sales-agent breakdown for the Reports page (managers).
-- One row per assigned agent with all their lead/follow-up/status counts,
-- aggregated server-side (GROUP BY) so we never hit the 1000-row client cap.
-- SECURITY INVOKER → respects contacts/tasks RLS: a sales_agent sees only their
-- own row, a manager/leader sees their team's agents, admin sees everyone.
-- Follow-up buckets use the contact's EARLIEST pending task vs the local-day
-- bounds passed in (same logic as get_followup_counts; avoids UTC drift).
create or replace function public.get_per_agent_breakdown(
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz
)
returns table (
  agent_id          uuid,
  agent_name        text,
  total_leads       bigint,
  fresh             bigint,
  untouched_fresh   bigint,
  rotation          bigint,
  distributed       bigint,
  cold_calls        bigint,
  s_new             bigint,
  s_contacted       bigint,
  s_following       bigint,
  s_has_opportunity bigint,
  s_disqualified    bigint,
  overdue           bigint,
  today             bigint,
  upcoming          bigint
)
language sql stable security invoker
as $$
  with next_task as (
    select contact_id, min(due_date) as next_due
    from tasks
    where status = 'pending' and contact_id is not null
    group by contact_id
  )
  select
    c.assigned_to                                                                 as agent_id,
    max(c.assigned_to_name)                                                        as agent_name,
    count(*)                                                                       as total_leads,
    count(*) filter (where c.lead_category = 'fresh')                              as fresh,
    count(*) filter (where c.lead_category = 'fresh' and c.contact_status = 'new') as untouched_fresh,
    count(*) filter (where c.lead_category = 'rotation')                           as rotation,
    count(*) filter (where c.lead_category = 'distributed')                        as distributed,
    count(*) filter (where c.lead_category = 'cold_calls')                         as cold_calls,
    count(*) filter (where c.contact_status = 'new')                              as s_new,
    count(*) filter (where c.contact_status = 'contacted')                        as s_contacted,
    count(*) filter (where c.contact_status = 'following')                        as s_following,
    count(*) filter (where c.contact_status = 'has_opportunity')                  as s_has_opportunity,
    count(*) filter (where c.contact_status = 'disqualified')                     as s_disqualified,
    count(*) filter (where nt.next_due <  p_today_start)                          as overdue,
    count(*) filter (where nt.next_due >= p_today_start and nt.next_due < p_tomorrow_start) as today,
    count(*) filter (where nt.next_due >= p_tomorrow_start)                       as upcoming
  from contacts c
  left join next_task nt on nt.contact_id = c.id
  where c.assigned_to is not null
    and coalesce(c.is_deleted, false) = false
  group by c.assigned_to
  order by count(*) desc;
$$;
