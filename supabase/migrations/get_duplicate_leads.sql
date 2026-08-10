-- ============================================================================
-- Duplicate-leads report: live leads that share a phone number.
-- DEFINER + manager guard (reads across all owners). Aggregate data only.
-- Excludes the placeholder junk number +201000000000.
-- ============================================================================

create or replace function get_duplicate_summary()
returns table (total_numbers bigint, total_leads bigint, all_dq bigint, one_active bigint, multi_active bigint, with_opp bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not exists (select 1 from users where id = auth.uid()
      and role = any (array['admin','operations','sales_director','sales_manager','team_leader'])) then
    raise exception 'not authorized to view duplicates';
  end if;
  return query
  with dups as (
    select phone from contacts
    where is_deleted is not true and phone is not null and phone <> '' and phone <> '+201000000000'
    group by phone having count(*) > 1
  ),
  g as (
    select c.phone, count(*) n,
      count(*) filter (where c.contact_status <> 'disqualified') active,
      count(*) filter (where c.contact_status = 'has_opportunity') opp
    from contacts c join dups d on d.phone = c.phone
    where c.is_deleted is not true
    group by c.phone
  )
  select count(*)::bigint, coalesce(sum(n),0)::bigint,
    count(*) filter (where active = 0)::bigint,
    count(*) filter (where active = 1)::bigint,
    count(*) filter (where active >= 2)::bigint,
    count(*) filter (where opp > 0)::bigint
  from g;
end;
$$;
grant execute on function get_duplicate_summary() to authenticated;

-- One row per duplicated phone; `detail` is a jsonb array of the copies
-- ({owner, status, category}), highest-stage first.
create or replace function get_duplicate_groups(p_filter text default 'all', p_limit int default 800)
returns table (phone text, lead_name text, copies int, has_active boolean, has_opp boolean, detail jsonb)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not exists (select 1 from users where id = auth.uid()
      and role = any (array['admin','operations','sales_director','sales_manager','team_leader'])) then
    raise exception 'not authorized to view duplicates';
  end if;
  return query
  with dups as (
    select cc.phone as ph from contacts cc
    where cc.is_deleted is not true and cc.phone is not null and cc.phone <> '' and cc.phone <> '+201000000000'
    group by cc.phone having count(*) > 1
  ),
  g as (
    select c.phone as gphone,
      max(c.full_name) lead_name,
      count(*)::int n,
      bool_or(c.contact_status <> 'disqualified') has_active,
      bool_or(c.contact_status = 'has_opportunity') has_opp,
      jsonb_agg(
        jsonb_build_object('owner', coalesce(c.assigned_to_name,'—'), 'status', c.contact_status, 'category', c.lead_category)
        order by case c.contact_status
          when 'has_opportunity' then 0 when 'following' then 1 when 'contacted' then 2 when 'new' then 3 else 4 end
      ) detail
    from contacts c join dups d on d.ph = c.phone
    where c.is_deleted is not true
    group by c.phone
  )
  select g.gphone, g.lead_name, g.n, g.has_active, g.has_opp, g.detail
  from g
  where case p_filter
    when 'active' then g.has_active
    when 'opp'    then g.has_opp
    when 'all_dq' then not g.has_active
    else true
  end
  order by g.has_active desc, g.n desc
  limit greatest(1, least(p_limit, 3000));
end;
$$;
grant execute on function get_duplicate_groups(text,int) to authenticated;
