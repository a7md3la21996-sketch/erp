-- Extend get_contact_stats with a p_lead_category filter so picking a lead
-- ORIGIN chip narrows the status / temperature / type chip counts too (the
-- chips already narrow each other; lead_category just wasn't a participant).
--
-- New 5-arg overload (the existing 2/4-arg ones stay for other callers).
-- p_lead_category is applied in `base`, so it flows into every derived count
-- (total, status, temperature, type) — it's a global narrower, not one of the
-- breakdown dimensions, so there's no "exclude own dimension" concern.

CREATE OR REPLACE FUNCTION public.get_contact_stats(
  p_dept          text DEFAULT NULL,
  p_agent_id      uuid DEFAULT NULL,
  p_status        text DEFAULT NULL,
  p_temperature   text DEFAULT NULL,
  p_lead_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH base AS (
    SELECT contact_status, temperature, contact_type, is_blacklisted, assigned_to
    FROM public.contacts
    WHERE is_deleted = false
      AND (p_dept          IS NULL OR department    = p_dept)
      AND (p_agent_id      IS NULL OR assigned_to    = p_agent_id)
      AND (p_lead_category IS NULL OR lead_category  = p_lead_category)
  ),
  fully_filtered AS (
    SELECT * FROM base
    WHERE (p_status      IS NULL OR contact_status = p_status)
      AND (p_temperature IS NULL OR temperature    = p_temperature)
  ),
  for_status_chips AS (
    SELECT * FROM base
    WHERE (p_temperature IS NULL OR temperature = p_temperature)
  ),
  for_temp_chips AS (
    SELECT * FROM base
    WHERE (p_status IS NULL OR contact_status = p_status)
  )
  SELECT jsonb_build_object(
    'total',       (SELECT COUNT(*) FROM fully_filtered),
    'blacklisted', (SELECT COUNT(*) FROM fully_filtered WHERE is_blacklisted = true),
    'unassigned',  (SELECT COUNT(*) FROM fully_filtered WHERE assigned_to IS NULL),
    'status', (
      SELECT jsonb_object_agg(s, c) FROM (
        SELECT contact_status AS s, COUNT(*) AS c
        FROM for_status_chips WHERE contact_status IS NOT NULL GROUP BY contact_status
      ) sx
    ),
    'temperature', (
      SELECT jsonb_object_agg(t, c) FROM (
        SELECT temperature AS t, COUNT(*) AS c
        FROM for_temp_chips WHERE temperature IS NOT NULL GROUP BY temperature
      ) tx
    ),
    'type', (
      SELECT jsonb_object_agg(ty, c) FROM (
        SELECT contact_type AS ty, COUNT(*) AS c
        FROM fully_filtered WHERE contact_type IS NOT NULL GROUP BY contact_type
      ) txx
    )
  );
$function$;
GRANT EXECUTE ON FUNCTION public.get_contact_stats(text, uuid, text, text, text) TO authenticated;
