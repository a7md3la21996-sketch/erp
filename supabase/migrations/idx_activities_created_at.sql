-- Activities page was slow (~8s) — an EXACT count over the ~186k activities
-- table on every load. The code now uses estimated count; this index makes the
-- ordered list fetch (order by created_at desc + range) and the "today" filter
-- (created_at >= today) fast too.
create index if not exists idx_activities_created_at on public.activities (created_at desc);
