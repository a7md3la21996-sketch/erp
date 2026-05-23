-- Aggregating opportunity-count RPC for the contacts list. Previously the
-- ContactsPage fetched raw opp rows and grouped client-side, which for an
-- admin scrolling a dept where many contacts have multiple opps could
-- balloon the response to thousands of rows just to compute integers.
-- This RPC does the GROUP BY in Postgres and returns one row per contact.
--
-- SECURITY INVOKER so RLS still narrows the count to what each caller can
-- see (a sales_agent's count is the count among their assigned contacts,
-- not the global figure).

CREATE OR REPLACE FUNCTION get_contact_opp_counts(p_contact_ids uuid[])
RETURNS TABLE(contact_id uuid, opp_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT contact_id, COUNT(*)::bigint AS opp_count
  FROM opportunities
  WHERE contact_id = ANY(p_contact_ids)
  GROUP BY contact_id;
$$;

GRANT EXECUTE ON FUNCTION get_contact_opp_counts(uuid[]) TO authenticated;
