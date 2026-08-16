-- Manager appointment digest — gives team-leaders / managers / admins a once-a-
-- day OVERSIGHT notification about their team's appointments, instead of the
-- per-appointment reminders that (correctly) go only to the lead's owner. This
-- is why admins/managers previously got NO notifications at all: every
-- notification was owner-scoped and they own no leads.
--
-- Scope per recipient:
--   • admin / operations / sales_director → all sales agents (org-wide)
--   • team_leader / sales_manager         → their team + all descendant teams
--                                            (recursive on departments.parent_id)
--
-- One notification per manager per day (deduped). Counts today's + overdue
-- appointments from contacts.next_follow_up_at. The deep link matches the
-- content: overdue first if any, else today's follow-ups (NOT the meetings-only
-- filter — the digest covers every appointment type, not just meetings).
--
-- Runs on pg_cron 'team-appointments-digest' at 06:00 UTC (~08–09 Cairo).
-- Applied live via the Supabase SQL editor on 2026-08-16.
--
-- NOTE: notifications.for_user_id is TEXT (not uuid) — hence the ::text casts.

create or replace function public.send_manager_appointment_digest()
returns integer language plpgsql security definer set search_path = public as $$
declare
  m record; scope_ids uuid[];
  today_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Cairo')) at time zone 'Africa/Cairo';
  today_end timestamptz := today_start + interval '1 day';
  n_today int; n_overdue int; total int := 0;
begin
  for m in select id, team_id, role, full_name_ar, full_name_en from users
           where role in ('team_leader','sales_manager','sales_director','admin','operations')
  loop
    if m.role in ('admin','operations','sales_director') then
      select array_agg(id) into scope_ids from users where role = 'sales_agent';
    else
      with recursive tree as (
        select m.team_id as id
        union all
        select d.id from departments d join tree t on d.parent_id = t.id)
      select array_agg(u.id) into scope_ids from users u where u.team_id in (select id from tree);
    end if;
    if scope_ids is null or array_length(scope_ids,1) is null then continue; end if;

    select count(*) filter (where c.next_follow_up_at >= today_start and c.next_follow_up_at < today_end),
           count(*) filter (where c.next_follow_up_at < now())
      into n_today, n_overdue
    from contacts c
    where c.assigned_to = any(scope_ids) and c.next_follow_up_at is not null
      and c.contact_status <> 'disqualified' and coalesce(c.is_deleted,false) = false;

    if coalesce(n_today,0) = 0 and coalesce(n_overdue,0) = 0 then continue; end if;
    if exists (select 1 from notifications x where x.type='team_appointments_digest'
                 and x.for_user_id = m.id::text and x.created_at >= today_start) then continue; end if;

    insert into notifications (type,title_ar,title_en,body_ar,body_en,url,for_user_id,for_user_name,created_at,priority)
    values ('team_appointments_digest','مواعيد فريقك النهاردة','Team appointments today',
      'فريقك: '||coalesce(n_today,0)||' موعد النهاردة'||case when coalesce(n_overdue,0)>0 then ' · '||n_overdue||' متأخر' else '' end,
      'Team: '||coalesce(n_today,0)||' today'||case when coalesce(n_overdue,0)>0 then ' · '||n_overdue||' overdue' else '' end,
      case when coalesce(n_overdue,0)>0 then '/contacts?followup=overdue' else '/contacts?followup=today' end,
      m.id::text, coalesce(m.full_name_en,m.full_name_ar), now(),
      case when coalesce(n_overdue,0)>0 then 'high' else 'normal' end);
    total := total + 1;
  end loop;
  return total;
end; $$;

-- Daily morning digest (06:00 UTC ≈ 08–09 Cairo). Adjust the hour if needed.
select cron.schedule('team-appointments-digest','0 6 * * *',$$select public.send_manager_appointment_digest();$$);
