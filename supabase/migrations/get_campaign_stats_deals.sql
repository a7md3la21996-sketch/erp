-- ============================================================================
-- get_campaign_stats() — repointed from the retired `opportunities` table to
-- `deals` (deal-events model, 2026-07-19). Changes vs the previous version:
--   • opp_agg     → counts ACTIVE-pipeline deals (new_deal/reserved/contracted)
--                   per campaign instead of opportunities.
--   • deal_links  → WON deals only (status='won'), linked by contact_id.
--                   Dropped the old `deals join opportunities on opportunity_id`
--                   path — new deals carry contact_id, not opportunity_id.
--   • deal_agg    → unchanged (now naturally counts won deals only).
-- Everything else (campaign attribution CTEs) is identical to the original.
-- Apply in the Supabase SQL editor.
-- ============================================================================

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
    -- Active-pipeline deals per campaign (opportunities retired).
    select vl.cid, count(distinct d.id)::bigint as opps
    from deals d
    join valid_links vl on vl.contact_id = d.contact_id
    where d.status in ('new_deal','reserved','contracted')
    group by vl.cid
  ),
  deal_links as (
    -- Won deals only, linked to the campaign by contact.
    select vl.cid, d.id as deal_id, d.deal_value
    from deals d
    join valid_links vl on vl.contact_id = d.contact_id
    where d.status = 'won'
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
