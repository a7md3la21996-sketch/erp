-- Appointment reminders — tiered (day-before / hour-before / due-now) for EVERY
-- lead appointment in contacts.next_follow_up_at (a call, a meeting, a whatsapp).
--
-- Replaces the previous edge-function approach (supabase/functions/followup-
-- reminders), which only pinged at the moment an appointment became due, giving
-- no advance warning. This runs as pure SQL on the SAME 15-min pg_cron job
-- (re-pointed below), so there is exactly one mechanism and no duplicates.
--
-- Applied live via the Supabase SQL editor on 2026-08-16 (cron job re-pointed,
-- new jobid returned). Kept here as the source of truth.

create or replace function public.send_appointment_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare total integer := 0; n integer;
begin
  -- 1) Due now (last 20-min window — matches the ~15-min cron)
  with ins as (
    insert into notifications (type,title_ar,title_en,body_ar,body_en,url,for_user_id,for_user_name,created_at)
    select 'followup_due','موعد مستحق دلوقتي','Appointment due now',
           'حان موعد "'||coalesce(nullif(c.full_name,''),'عميل')||'"',
           'Due now: "'||coalesce(nullif(c.full_name,''),'lead')||'"',
           '/contacts?highlight='||c.id, c.assigned_to, c.assigned_to_name, now()
    from contacts c
    where c.next_follow_up_at > now() - interval '20 minutes'
      and c.next_follow_up_at <= now()
      and c.contact_status <> 'disqualified' and c.assigned_to is not null
      and coalesce(c.is_deleted,false) = false
      and not exists (select 1 from notifications x
        where x.type='followup_due' and x.url='/contacts?highlight='||c.id
          and x.created_at > now() - interval '25 hours')
    returning 1)
  select count(*) into n from ins; total := total + n;

  -- 2) In ~1 hour
  with ins as (
    insert into notifications (type,title_ar,title_en,body_ar,body_en,url,for_user_id,for_user_name,created_at)
    select 'followup_soon_1h','موعد بعد ساعة','Appointment in 1 hour',
           'بعد ساعة ('||to_char(c.next_follow_up_at at time zone 'Africa/Cairo','HH24:MI')||') — موعد مع "'||coalesce(nullif(c.full_name,''),'عميل')||'"',
           'In 1 hour — "'||coalesce(nullif(c.full_name,''),'lead')||'"',
           '/contacts?highlight='||c.id, c.assigned_to, c.assigned_to_name, now()
    from contacts c
    where c.next_follow_up_at > now() + interval '50 minutes'
      and c.next_follow_up_at <= now() + interval '70 minutes'
      and c.contact_status <> 'disqualified' and c.assigned_to is not null
      and coalesce(c.is_deleted,false) = false
      and not exists (select 1 from notifications x
        where x.type='followup_soon_1h' and x.url='/contacts?highlight='||c.id
          and x.created_at > now() - interval '25 hours')
    returning 1)
  select count(*) into n from ins; total := total + n;

  -- 3) Tomorrow (~24h before)
  with ins as (
    insert into notifications (type,title_ar,title_en,body_ar,body_en,url,for_user_id,for_user_name,created_at)
    select 'followup_soon_1d','موعد بكرة','Appointment tomorrow',
           'بكرة الساعة '||to_char(c.next_follow_up_at at time zone 'Africa/Cairo','HH24:MI')||' — موعد مع "'||coalesce(nullif(c.full_name,''),'عميل')||'"',
           'Tomorrow — "'||coalesce(nullif(c.full_name,''),'lead')||'"',
           '/contacts?highlight='||c.id, c.assigned_to, c.assigned_to_name, now()
    from contacts c
    where c.next_follow_up_at > now() + interval '23 hours 40 minutes'
      and c.next_follow_up_at <= now() + interval '24 hours'
      and c.contact_status <> 'disqualified' and c.assigned_to is not null
      and coalesce(c.is_deleted,false) = false
      and not exists (select 1 from notifications x
        where x.type='followup_soon_1d' and x.url='/contacts?highlight='||c.id
          and x.created_at > now() - interval '25 hours')
    returning 1)
  select count(*) into n from ins; total := total + n;

  return total;
end;
$$;

-- Re-point the existing 15-min job from the edge function to this SQL function.
select cron.unschedule('followup-reminders');
select cron.schedule('followup-reminders','*/15 * * * *',$$select public.send_appointment_reminders();$$);
