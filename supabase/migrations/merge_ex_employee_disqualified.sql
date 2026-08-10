-- One-time cleanup: consolidate all DISQUALIFIED leads owned by DEPARTED (inactive)
-- agents under a single owner (Esraa Bakr, operations), merging duplicate phones
-- into one record with the combined timeline. Nothing is hard-deleted — extra
-- copies are soft-deleted (is_deleted) and their activities/tasks are re-pointed
-- onto the surviving record, so the full history is preserved on one contact.
--
-- The dq_requires_reason CHECK is NOT VALID but still fires on UPDATE, and ~8,759
-- target rows have no reason — so we drop it, do the work, and re-add the IDENTICAL
-- definition inside the same transaction (same pattern as the lead_category backfill).
begin;

alter table public.contacts drop constraint dq_requires_reason;

create temp table _m as
with dqi as (
  select c.id, c.phone,
         row_number() over (partition by c.phone order by c.created_at desc nulls last, c.id desc) as rn
  from public.contacts c
  join public.users u on u.id = c.assigned_to
  where c.contact_status = 'disqualified'
    and u.status <> 'active'
    and coalesce(c.is_deleted, false) = false
    and c.phone is not null and c.phone <> ''
)
select id, phone, rn,
       first_value(id) over (partition by phone order by rn) as survivor_id
from dqi;

-- 1) Move the timeline (activities + tasks) from duplicate copies → survivor.
update public.activities a set contact_id = m.survivor_id
  from _m m where a.contact_id = m.id and m.rn > 1;
update public.tasks t set contact_id = m.survivor_id
  from _m m where t.contact_id = m.id and m.rn > 1;

-- 2) Soft-delete the duplicate copies (reversible).
update public.contacts c set is_deleted = true, deleted_at = now()
  from _m m where c.id = m.id and m.rn > 1;

-- 3) Reassign every surviving record (one per phone) to Esraa Bakr.
update public.contacts c
  set assigned_to       = 'dc7cbd29-5e22-4325-a37c-a595cd6c2d29',
      assigned_to_name  = 'Esraa Bakr',
      assigned_to_names = '["Esraa Bakr"]'::jsonb,
      assigned_at       = now(),
      assigned_by_name  = 'merge: ex-employee disqualified leads'
  from _m m where c.id = m.survivor_id;

alter table public.contacts add constraint dq_requires_reason
  CHECK (((contact_status <> 'disqualified'::text)
    OR ((disqualify_reason IS NOT NULL) AND (disqualify_reason <> ''::text) AND (disqualify_reason <> '—'::text)))) NOT VALID;

drop table _m;
commit;
