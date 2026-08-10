-- Per-agent ACTIVITY/work breakdown for a date range (managers). One row per
-- agent: how many calls / whatsapp / meetings / emails / notes / status-changes
-- they logged, plus deals closed, between p_from and p_to. Server-aggregated;
-- SECURITY INVOKER so RLS scopes it (agent→self, manager→team, admin→all).
--
-- 2026-07-25: added a RESPONSE-RATE pair — leads_reached / leads_responded —
-- counted over DISTINCT contacts (not activities), so "response rate" reads as
-- "of the customers this agent reached, how many actually responded":
--   reached   = distinct contacts with a call/whatsapp/meeting in the window
--   responded = distinct contacts who engaged back: an ANSWERED call, a REPLIED
--               whatsapp, or a COMPLETED meeting. (seen/delivered = not a reply;
--               legacy activities with a null result count as no-response.)
-- The frontend derives "no response" (reached − responded) and the % from these.

-- Return-type changes, so drop before recreate (create-or-replace can't alter it).
drop function if exists public.get_agent_activity_breakdown(timestamptz, timestamptz);

create function public.get_agent_activity_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  agent_id         uuid,
  agent_name       text,
  calls            bigint,
  whatsapp         bigint,
  meetings         bigint,
  emails           bigint,
  notes            bigint,
  status_changes   bigint,
  total_activities bigint,
  leads_reached    bigint,
  leads_responded  bigint,
  deals            bigint
)
language sql stable security invoker
as $$
  with act as (
    select user_id,
      count(*) filter (where type = 'call')          as calls,
      count(*) filter (where type = 'whatsapp')      as whatsapp,
      count(*) filter (where type = 'meeting')       as meetings,
      count(*) filter (where type = 'email')         as emails,
      count(*) filter (where type = 'note')          as notes,
      count(*) filter (where type = 'status_change') as status_changes,
      count(*)                                       as total_activities,
      count(distinct contact_id) filter (
        where contact_id is not null and type in ('call', 'whatsapp', 'meeting')
      )                                              as leads_reached,
      count(distinct contact_id) filter (
        where contact_id is not null and (
             (type = 'call'     and result = 'answered')
          or (type = 'whatsapp' and result = 'replied')
          or (type = 'meeting'  and status = 'completed')
        )
      )                                              as leads_responded
    from public.activities
    where created_at >= p_from and created_at < p_to and user_id is not null
    group by user_id
  )
  select
    a.user_id,
    coalesce(u.full_name_en, u.full_name_ar) as agent_name,
    a.calls, a.whatsapp, a.meetings, a.emails, a.notes, a.status_changes, a.total_activities,
    a.leads_reached, a.leads_responded,
    (select count(*) from public.deals d
       where d.created_at >= p_from and d.created_at < p_to and d.contact_id is not null
         and (d.agent_en = u.full_name_en or d.agent_ar = u.full_name_ar
              or d.agent_en = u.full_name_ar or d.agent_ar = u.full_name_en)) as deals
  from act a
  join public.users u on u.id = a.user_id
  order by a.total_activities desc;
$$;
