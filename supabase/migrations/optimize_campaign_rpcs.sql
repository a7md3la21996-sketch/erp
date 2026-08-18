-- ============================================================================
-- OPTIMIZE the campaign RPCs (get_campaign_stats / funnel / breakdown).
-- EXPLAIN ANALYZE showed 87% of the time in the campaign_interactions branch:
-- a Nested Loop that compared ~2.3k interaction rows x 507 campaigns with an
-- OR join filter, re-evaluating lower(trim(elem->>'campaign')) ~1.17M times
-- (1801ms of a 2079ms run).
-- Fix: expand the jsonb ONCE into `ix` with a precomputed `iname`, and split
-- the OR into separate equality joins. links UNION -> UNION ALL (valid_links
-- already de-dups). Semantics unchanged (valid_links = select distinct).
-- Apply each function SEPARATELY in the SQL editor (multi-function paste breaks).
-- ============================================================================

-- ── 1) get_campaign_stats ────────────────────────────────────────────────
create or replace function get_campaign_stats()
returns table (campaign_id uuid, leads bigint, engaged bigint, disqualified bigint, interactions bigint, opps bigint, won_deals bigint, revenue numeric)
language plpgsql security definer set search_path = public set statement_timeout = '30s' stable
as $stats$
#variable_conflict use_column
begin
  if not exists (select 1 from users where id = auth.uid() and role = any (array['admin','operations','marketing','sales_director','sales_manager'])) then
    raise exception 'not authorized to view campaign stats';
  end if;
  return query
  with camp as (select id, lower(trim(name_en)) as nlo_en, lower(trim(name_ar)) as nlo_ar from campaigns),
  live as (select id, campaign_id, campaign_name from contacts where is_deleted is null or is_deleted = false),
  ix as (
    select c.id as contact_id, nullif(e.elem->>'campaign_id','') as icid_txt, lower(trim(e.elem->>'campaign')) as iname
    from contacts c cross join lateral jsonb_array_elements(c.campaign_interactions) as e(elem)
    where (c.is_deleted is null or c.is_deleted = false) and jsonb_typeof(c.campaign_interactions) = 'array'
  ),
  links as (
    select c.campaign_id as cid, c.id as contact_id from live c where c.campaign_id is not null
    union all select cp.id, c.id from live c join camp cp on c.campaign_name is not null and c.campaign_name <> '' and lower(trim(c.campaign_name)) = cp.nlo_en
    union all select cp.id, c.id from live c join camp cp on c.campaign_name is not null and c.campaign_name <> '' and lower(trim(c.campaign_name)) = cp.nlo_ar
    union all select icid_txt::uuid, contact_id from ix where icid_txt is not null
    union all select cp.id, ix.contact_id from ix join camp cp on ix.iname = cp.nlo_en where ix.icid_txt is null
    union all select cp.id, ix.contact_id from ix join camp cp on ix.iname = cp.nlo_ar where ix.icid_txt is null
  ),
  valid_links as (select distinct l.cid, l.contact_id from links l join campaigns cc on cc.id = l.cid),
  lead_agg as (
    select vl.cid, count(*) as leads,
      count(*) filter (where c.contact_status in ('following','has_opportunity')) as engaged,
      count(*) filter (where c.contact_status = 'disqualified') as disqualified
    from valid_links vl join contacts c on c.id = vl.contact_id group by vl.cid
  ),
  inter_agg as (
    select coalesce(icid_txt::uuid, cp.id) as cid, count(*)::bigint as interactions
    from ix left join camp cp on ix.iname = cp.nlo_en or ix.iname = cp.nlo_ar
    where icid_txt is not null or cp.id is not null group by 1
  ),
  opp_agg as (select vl.cid, count(distinct d.id)::bigint as opps from deals d join valid_links vl on vl.contact_id = d.contact_id where d.status in ('new_deal','reserved','contracted') group by vl.cid),
  deal_links as (select vl.cid, d.id as deal_id, d.deal_value from deals d join valid_links vl on vl.contact_id = d.contact_id where d.status = 'won'),
  deal_agg as (select cid, count(*)::bigint as won_deals, coalesce(sum(deal_value),0)::numeric as revenue from deal_links group by cid)
  select cc.id as campaign_id, coalesce(la.leads,0)::bigint, coalesce(la.engaged,0)::bigint, coalesce(la.disqualified,0)::bigint,
    coalesce(ia.interactions,0)::bigint, coalesce(oa.opps,0)::bigint, coalesce(da.won_deals,0)::bigint, coalesce(da.revenue,0)::numeric
  from campaigns cc
  left join lead_agg la on la.cid = cc.id left join inter_agg ia on ia.cid = cc.id
  left join opp_agg oa on oa.cid = cc.id left join deal_agg da on da.cid = cc.id;
end;
$stats$;

-- ── 2) get_campaign_funnel ───────────────────────────────────────────────
create or replace function get_campaign_funnel()
returns table (platform text, leads bigint, contacted bigint, opps bigint, deals bigint)
language plpgsql security definer set search_path = public set statement_timeout = '30s' stable
as $funnel$
#variable_conflict use_column
begin
  if not exists (select 1 from users where id = auth.uid() and role = any (array['admin','operations','marketing','sales_director','sales_manager'])) then
    raise exception 'not authorized to view campaign funnel';
  end if;
  return query
  with camp as (select id, platform, lower(trim(name_en)) as nlo_en, lower(trim(name_ar)) as nlo_ar from campaigns),
  live as (select id, campaign_id, campaign_name from contacts where is_deleted is null or is_deleted = false),
  ix as (
    select c.id as contact_id, nullif(e.elem->>'campaign_id','') as icid_txt, lower(trim(e.elem->>'campaign')) as iname
    from contacts c cross join lateral jsonb_array_elements(c.campaign_interactions) as e(elem)
    where (c.is_deleted is null or c.is_deleted = false) and jsonb_typeof(c.campaign_interactions) = 'array'
  ),
  links as (
    select c.campaign_id as cid, c.id as contact_id from live c where c.campaign_id is not null
    union all select cp.id, c.id from live c join camp cp on c.campaign_name is not null and c.campaign_name <> '' and lower(trim(c.campaign_name)) = cp.nlo_en
    union all select cp.id, c.id from live c join camp cp on c.campaign_name is not null and c.campaign_name <> '' and lower(trim(c.campaign_name)) = cp.nlo_ar
    union all select icid_txt::uuid, contact_id from ix where icid_txt is not null
    union all select cp.id, ix.contact_id from ix join camp cp on ix.iname = cp.nlo_en where ix.icid_txt is null
    union all select cp.id, ix.contact_id from ix join camp cp on ix.iname = cp.nlo_ar where ix.icid_txt is null
  ),
  vl  as (select distinct l.cid, l.contact_id from links l join campaigns cc on cc.id = l.cid),
  vlp as (select distinct cc.platform as platform, vl.contact_id from vl join campaigns cc on cc.id = vl.cid)
  select '__all__'::text, count(distinct vl.contact_id),
    count(distinct vl.contact_id) filter (where c.contact_status in ('following','has_opportunity')),
    (select count(distinct o.id) from opportunities o where o.contact_id in (select contact_id from vl)),
    (select count(distinct d.id) from deals d where d.contact_id in (select contact_id from vl))
  from vl join contacts c on c.id = vl.contact_id
  union all
  select vlp.platform, count(distinct vlp.contact_id),
    count(distinct vlp.contact_id) filter (where c.contact_status in ('following','has_opportunity')),
    (select count(distinct o.id) from opportunities o where o.contact_id in (select contact_id from vlp v2 where v2.platform = vlp.platform)),
    (select count(distinct d.id) from deals d where d.contact_id in (select contact_id from vlp v2 where v2.platform = vlp.platform))
  from vlp join contacts c on c.id = vlp.contact_id group by vlp.platform;
end;
$funnel$;

-- ── 3) get_campaign_breakdown ────────────────────────────────────────────
create or replace function get_campaign_breakdown()
returns table (campaign_id uuid, dim text, bucket text, cnt bigint)
language plpgsql security definer set search_path = public set statement_timeout = '30s' stable
as $breakdown$
#variable_conflict use_column
begin
  if not exists (select 1 from users where id = auth.uid() and role = any (array['admin','operations','marketing','sales_director','sales_manager'])) then
    raise exception 'not authorized to view campaign stats';
  end if;
  return query
  with camp as (select id, lower(trim(name_en)) as nlo_en, lower(trim(name_ar)) as nlo_ar from campaigns),
  live as (select id, campaign_id, campaign_name from contacts where is_deleted is null or is_deleted = false),
  ix as (
    select c.id as contact_id, nullif(e.elem->>'campaign_id','') as icid_txt, lower(trim(e.elem->>'campaign')) as iname
    from contacts c cross join lateral jsonb_array_elements(c.campaign_interactions) as e(elem)
    where (c.is_deleted is null or c.is_deleted = false) and jsonb_typeof(c.campaign_interactions) = 'array'
  ),
  links as (
    select c.campaign_id as cid, c.id as contact_id from live c where c.campaign_id is not null
    union all select cp.id, c.id from live c join camp cp on c.campaign_name is not null and c.campaign_name <> '' and lower(trim(c.campaign_name)) = cp.nlo_en
    union all select cp.id, c.id from live c join camp cp on c.campaign_name is not null and c.campaign_name <> '' and lower(trim(c.campaign_name)) = cp.nlo_ar
    union all select icid_txt::uuid, contact_id from ix where icid_txt is not null
    union all select cp.id, ix.contact_id from ix join camp cp on ix.iname = cp.nlo_en where ix.icid_txt is null
    union all select cp.id, ix.contact_id from ix join camp cp on ix.iname = cp.nlo_ar where ix.icid_txt is null
  ),
  valid_links as (select distinct l.cid, l.contact_id from links l join campaigns cc on cc.id = l.cid),
  status_rows as (
    select vl.cid as campaign_id, 'status'::text as dim, coalesce(nullif(c.contact_status,''),'new') as bucket, count(distinct vl.contact_id)::bigint as cnt
    from valid_links vl join contacts c on c.id = vl.contact_id group by vl.cid, coalesce(nullif(c.contact_status,''),'new')
  ),
  stage_rows as (
    select vl.cid as campaign_id, 'stage'::text as dim, coalesce(nullif(d.status,''),'new_deal') as bucket, count(distinct d.id)::bigint as cnt
    from deals d join valid_links vl on vl.contact_id = d.contact_id group by vl.cid, coalesce(nullif(d.status,''),'new_deal')
  )
  select * from status_rows union all select * from stage_rows;
end;
$breakdown$;
