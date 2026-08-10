-- ============================================================================
-- Marketing accuracy fix (Track A): DB-side aggregate RPCs for campaign stats.
--
-- WHY: MarketingPage previously fetched ALL contacts/opportunities/deals into
-- the browser (capped at 1000 rows) and computed campaign leads/CPL/funnel/ROI
-- in JavaScript. At ~28k live contacts that meant every number was computed on
-- a 1000-row sample → wrong. These functions compute the same metrics across
-- the FULL dataset in Postgres.
--
-- SECURITY: campaign performance is a company-wide metric (campaigns are
-- company assets, not per-agent), but the contacts RLS policy only grants
-- `is_admin()` / own / team — there is NO 'marketing' clause, so SECURITY
-- INVOKER would return near-empty data for marketing staff. Hence DEFINER with
-- an explicit role guard. Both functions return aggregate counts only (no
-- contact PII).
--
-- MATCHING: a contact is attributed to a campaign by, in order of reliability:
--   1) contacts.campaign_id = campaigns.id            (only ~2k contacts have it)
--   2) lower(contacts.campaign_name) = name_en/name_ar (the bulk: ~30k)
--   3) campaign_interactions[].campaign_id / .campaign name match
-- A contact may attribute to more than one campaign (multi-touch), matching the
-- old JS behaviour. Per-campaign rows therefore double-count slightly; the
-- funnel function returns UNIQUE contacts for company/channel totals.
-- ============================================================================

-- Per-campaign stats: one row per campaign.
drop function if exists get_campaign_stats();
create or replace function get_campaign_stats()
returns table (
  campaign_id   uuid,
  leads         bigint,
  engaged       bigint,
  disqualified  bigint,
  interactions  bigint,
  opps          bigint,
  won_deals     bigint,
  revenue       numeric
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
    -- OR-join split into two equality UNIONs so Postgres uses fast Hash Joins
    -- instead of a 13M-row nested loop (37s → ~0.2s).
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
  lead_agg as (
    select vl.cid,
           count(distinct vl.contact_id) as leads,
           count(distinct vl.contact_id) filter (
             where c.contact_status in ('following','has_opportunity')) as engaged,
           count(distinct vl.contact_id) filter (
             where c.contact_status = 'disqualified') as disqualified
    from valid_links vl
    join contacts c on c.id = vl.contact_id
    group by vl.cid
  ),
  inter_agg as (
    select coalesce(nullif(e.elem->>'campaign_id','')::uuid, cp.id) as cid, count(*)::bigint as interactions
    from live c
    cross join lateral jsonb_array_elements(c.campaign_interactions) as e(elem)
    left join camp cp
      on lower(trim(e.elem->>'campaign')) = cp.nlo_en
      or lower(trim(e.elem->>'campaign')) = cp.nlo_ar
    where jsonb_typeof(c.campaign_interactions) = 'array'
      and (nullif(e.elem->>'campaign_id','') is not null or cp.id is not null)
    group by 1
  ),
  opp_agg as (
    select vl.cid, count(distinct o.id)::bigint as opps
    from opportunities o
    join valid_links vl on vl.contact_id = o.contact_id
    group by vl.cid
  ),
  deal_links as (
    select vl.cid, d.id as deal_id, d.deal_value
    from deals d
    join valid_links vl on vl.contact_id = d.contact_id
    union
    select vl.cid, d.id, d.deal_value
    from deals d
    join opportunities o on o.id = d.opportunity_id
    join valid_links vl on vl.contact_id = o.contact_id
  ),
  deal_agg as (
    select cid, count(*)::bigint as won_deals, coalesce(sum(deal_value),0)::numeric as revenue
    from deal_links
    group by cid
  )
  select
    cc.id as campaign_id,
    coalesce(la.leads,0)::bigint,
    coalesce(la.engaged,0)::bigint,
    coalesce(la.disqualified,0)::bigint,
    coalesce(ia.interactions,0)::bigint,
    coalesce(oa.opps,0)::bigint,
    coalesce(da.won_deals,0)::bigint,
    coalesce(da.revenue,0)::numeric
  from campaigns cc
  left join lead_agg  la on la.cid = cc.id
  left join inter_agg ia on ia.cid = cc.id
  left join opp_agg   oa on oa.cid = cc.id
  left join deal_agg  da on da.cid = cc.id;
end;
$$;

grant execute on function get_campaign_stats() to authenticated;


-- Company-wide + per-channel funnel using UNIQUE contacts (no double counting).
-- platform = '__all__' is the company-wide row; the rest are per-platform.
create or replace function get_campaign_funnel()
returns table (
  platform   text,
  leads      bigint,
  contacted  bigint,
  opps       bigint,
  deals      bigint
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
    raise exception 'not authorized to view campaign funnel';
  end if;

  return query
  with camp as (
    select id, platform, lower(trim(name_en)) as nlo_en, lower(trim(name_ar)) as nlo_ar
    from campaigns
  ),
  live as (
    select id, campaign_id, campaign_name, contact_status, campaign_interactions
    from contacts
    where is_deleted is null or is_deleted = false
  ),
  links as (
    select c.campaign_id as cid, c.id as contact_id
    from live c where c.campaign_id is not null
    union
    -- OR-join split into two equality UNIONs (Hash Join, not nested loop).
    select cp.id, c.id
    from live c join camp cp
      on c.campaign_name is not null and c.campaign_name <> ''
     and lower(trim(c.campaign_name)) = cp.nlo_en
    union
    select cp.id, c.id
    from live c join camp cp
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
  vl  as (select distinct l.cid, l.contact_id from links l join campaigns cc on cc.id = l.cid),
  vlp as (select distinct cc.platform as platform, vl.contact_id from vl join campaigns cc on cc.id = vl.cid)
  -- company-wide
  select '__all__'::text,
         count(distinct vl.contact_id),
         count(distinct vl.contact_id) filter (where c.contact_status in ('following','has_opportunity')),
         (select count(distinct o.id) from opportunities o where o.contact_id in (select contact_id from vl)),
         (select count(distinct d.id) from deals d where d.contact_id in (select contact_id from vl))
  from vl join contacts c on c.id = vl.contact_id
  union all
  -- per platform
  select vlp.platform,
         count(distinct vlp.contact_id),
         count(distinct vlp.contact_id) filter (where c.contact_status in ('following','has_opportunity')),
         (select count(distinct o.id) from opportunities o where o.contact_id in (select contact_id from vlp v2 where v2.platform = vlp.platform)),
         (select count(distinct d.id) from deals d  where d.contact_id in (select contact_id from vlp v2 where v2.platform = vlp.platform))
  from vlp join contacts c on c.id = vlp.contact_id
  group by vlp.platform;
end;
$$;

grant execute on function get_campaign_funnel() to authenticated;
