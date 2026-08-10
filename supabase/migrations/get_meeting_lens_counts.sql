-- Scoped counts for the CRM dashboard "Meetings" lens cards: how many DISTINCT
-- contacts have a meeting on them — any / an upcoming (future scheduled) one /
-- one that happened (completed). SECURITY INVOKER so RLS scopes each viewer
-- (agent→own, manager→team, admin→all); p_agent_ids narrows to the dashboard's
-- selected agent/team. Matches the Leads-page `?meeting=` filter (same predicate
-- on activities type='meeting'), so the card count == the filtered list.
create or replace function public.get_meeting_lens_counts(p_agent_ids uuid[] default null)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'any',      count(distinct c.id),
    'upcoming', count(distinct c.id) filter (where a.status = 'scheduled' and a.scheduled_date >= now()),
    'happened', count(distinct c.id) filter (where a.status = 'completed')
  )
  from public.contacts c
  join public.activities a on a.contact_id = c.id and a.type = 'meeting'
  where c.is_deleted is not true
    and (p_agent_ids is null or c.assigned_to = any(p_agent_ids));
$$;
grant execute on function public.get_meeting_lens_counts(uuid[]) to authenticated;
