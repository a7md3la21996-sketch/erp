-- ============================================================================
-- get_campaign_breakdown() — per-campaign count of leads in each STATUS and of
-- deals in each pipeline STAGE. Long format: one row per (campaign, dimension,
-- bucket) so the client can pivot into a matrix.
--   • dim = 'status' → count(distinct contact) per contacts.contact_status
--                      (new / contacted / following / has_opportunity / disqualified)
--   • dim = 'stage'  → count(deal) per deals.status
--                      (new_deal / reserved / contracted / won / lost)
-- Attribution CTEs (camp/live/links/valid_links) are copied verbatim from
-- get_campaign_stats_deals.sql so the numbers reconcile exactly with the
-- campaign stats table. Multi-touch attribution means a contact/deal can count
-- under more than one campaign — same behaviour as get_campaign_stats().
-- Apply in the Supabase SQL editor.
-- ============================================================================

drop function if exists get_campaign_breakdown();
create or replace function get_campaign_breakdown()
returns table (
  campaign_id uuid,
  dim         text,   -- 'status' | 'stage'
  bucket      text,   -- the contact_status / deal status value
  cnt         bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from users
    where id = auth.uid()
      and role = any (array['admin','operations','marketing','sales_director','sales_manager'])
  ) then
    raise exception 'not authorized to view campaign stats';
  end if;

  return query
  with camp as (
    select id, lower(trim(name_en)) as nlo_en, lower(trim(name_ar)) as nlo_ar
    from campaigns
  ),
  live as (
    select id, campaign_id, campaign_name, contact_status, campaign_interactions
    from contacts
    where is_deleted is null or is_deleted = false
  ),
  links as (
    select c.campaign_id as cid, c.id as contact_id
    from live c
    where c.campaign_id is not null
    union
    select cp.id, c.id
    from live c
    join camp cp
      on c.campaign_name is not null and c.campaign_name <> ''
     and lower(trim(c.campaign_name)) = cp.nlo_en
    union
    select cp.id, c.id
    from live c
    join camp cp
      on c.campaign_name is not null and c.campaign_name <> ''
     and lower(trim(c.campaign_name)) = cp.nlo_ar
    union
    select coalesce(nullif(e.elem->>'campaign_id','')::uuid, cp.id) as cid, c.id
    from live c
    cross join lateral jsonb_array_elements(c.campaign_interactions) as e(elem)
    left join camp cp
      on lower(trim(e.elem->>'campaign')) = cp.nlo_en
      or lower(trim(e.elem->>'campaign')) = cp.nlo_ar
    where jsonb_typeof(c.campaign_interactions) = 'array'
      and (nullif(e.elem->>'campaign_id','') is not null or cp.id is not null)
  ),
  valid_links as (
    select distinct l.cid, l.contact_id
    from links l
    join campaigns cc on cc.id = l.cid
  ),
  -- STATUS: distinct contacts per campaign, bucketed by contact_status.
  status_rows as (
    select vl.cid as campaign_id,
           'status'::text as dim,
           coalesce(nullif(c.contact_status,''),'new') as bucket,
           count(distinct vl.contact_id)::bigint as cnt
    from valid_links vl
    join contacts c on c.id = vl.contact_id
    group by vl.cid, coalesce(nullif(c.contact_status,''),'new')
  ),
  -- STAGE: deals per campaign, bucketed by deal status (the live pipeline).
  stage_rows as (
    select vl.cid as campaign_id,
           'stage'::text as dim,
           coalesce(nullif(d.status,''),'new_deal') as bucket,
           count(distinct d.id)::bigint as cnt
    from deals d
    join valid_links vl on vl.contact_id = d.contact_id
    group by vl.cid, coalesce(nullif(d.status,''),'new_deal')
  )
  select * from status_rows
  union all
  select * from stage_rows;
end;
$$;
