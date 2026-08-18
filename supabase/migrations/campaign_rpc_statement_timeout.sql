-- Campaign RPCs are heavy analytics (attribution CTEs + jsonb cross joins over
-- ~25k contacts, ~6-10s). Once the 42702 ambiguity was fixed they ran but
-- intermittently hit the role's default statement_timeout (57014), leaving the
-- Marketing Overview blank. Give each a generous per-function timeout.
alter function public.get_campaign_stats()     set statement_timeout = '30s';
alter function public.get_campaign_funnel()    set statement_timeout = '30s';
alter function public.get_campaign_breakdown() set statement_timeout = '30s';
