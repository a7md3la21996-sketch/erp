-- ============================================================================
-- Status-transition report: which leads moved from status X to status Y.
-- Source: audit_logs (entity='contact') where old.contact_status != new.contact_status.
-- DEFINER + manager guard (reads across all users). Aggregate/audit data only.
-- ============================================================================

-- Detail: one row per transition event.
create or replace function get_status_transitions(
  p_from      text        default null,
  p_to        text        default null,
  p_from_date timestamptz default null,
  p_to_date   timestamptz default null,
  p_agent     text        default null,
  p_limit     int         default 2000
)
returns table (
  contact_id  text,
  lead_name   text,
  from_status text,
  to_status   text,
  changed_by  text,
  changed_at  timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not exists (
    select 1 from users where id = auth.uid()
      and role = any (array['admin','operations','sales_director','sales_manager','team_leader'])
  ) then
    raise exception 'not authorized to view status transitions';
  end if;

  return query
  select a.entity_id,
         a.entity_name,
         a.old_data->>'contact_status',
         a.new_data->>'contact_status',
         a.user_name,
         a.created_at
  from audit_logs a
  where a.entity = 'contact'
    and a.new_data ? 'contact_status'
    and (a.old_data->>'contact_status') is distinct from (a.new_data->>'contact_status')
    and (p_from is null or a.old_data->>'contact_status' = p_from)
    and (p_to   is null or a.new_data->>'contact_status' = p_to)
    and (p_from_date is null or a.created_at >= p_from_date)
    and (p_to_date   is null or a.created_at <  p_to_date)
    and (p_agent is null or a.user_name = p_agent)
  order by a.created_at desc
  limit greatest(1, least(p_limit, 5000));
end;
$$;
grant execute on function get_status_transitions(text,text,timestamptz,timestamptz,text,int) to authenticated;

-- Summary matrix: counts per (from → to) pair.
create or replace function get_status_transition_matrix(
  p_from_date timestamptz default null,
  p_to_date   timestamptz default null,
  p_agent     text        default null
)
returns table (from_status text, to_status text, cnt bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not exists (
    select 1 from users where id = auth.uid()
      and role = any (array['admin','operations','sales_director','sales_manager','team_leader'])
  ) then
    raise exception 'not authorized to view status transitions';
  end if;

  return query
  select a.old_data->>'contact_status',
         a.new_data->>'contact_status',
         count(*)::bigint
  from audit_logs a
  where a.entity = 'contact'
    and a.new_data ? 'contact_status'
    and (a.old_data->>'contact_status') is distinct from (a.new_data->>'contact_status')
    and (a.old_data->>'contact_status') is not null
    and (p_from_date is null or a.created_at >= p_from_date)
    and (p_to_date   is null or a.created_at <  p_to_date)
    and (p_agent is null or a.user_name = p_agent)
  group by 1, 2;
end;
$$;
grant execute on function get_status_transition_matrix(timestamptz,timestamptz,text) to authenticated;
