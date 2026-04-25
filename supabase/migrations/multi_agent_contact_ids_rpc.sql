-- Lightweight server-side resolver for "contacts with 2+ assigned sales".
-- Replaces a 20k-row client-side scan that fired every time the user
-- toggled the "Single Agent" filter. RLS still applies (SECURITY INVOKER
-- is the default) so a sales agent only gets back IDs they can already see.

CREATE OR REPLACE FUNCTION public.get_multi_agent_contact_ids()
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT c.id
  FROM contacts c
  WHERE c.assigned_to_names IS NOT NULL
    AND jsonb_array_length(c.assigned_to_names) > 1
$$;

GRANT EXECUTE ON FUNCTION public.get_multi_agent_contact_ids() TO authenticated;
