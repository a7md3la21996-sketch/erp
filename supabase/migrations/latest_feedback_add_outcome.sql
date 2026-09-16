-- Add `outcome` to the latest-feedback-per-contact RPC so the Leads table can
-- show the conversation outcome badge next to the result. Adding a column to a
-- RETURNS TABLE signature needs a DROP first (CREATE OR REPLACE can't change
-- the return type). Additive + non-destructive.

DROP FUNCTION IF EXISTS get_latest_feedback_per_contact(uuid[]);

CREATE OR REPLACE FUNCTION get_latest_feedback_per_contact(p_contact_ids uuid[])
RETURNS TABLE(
  contact_id uuid,
  id uuid,
  notes text,
  description text,
  result text,
  outcome text,
  type text,
  created_at timestamptz,
  user_name_ar text,
  user_name_en text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT ON (contact_id)
    contact_id, id, notes, description, result, outcome, type, created_at, user_name_ar, user_name_en
  FROM activities
  WHERE contact_id = ANY(p_contact_ids)
    AND (
      (notes IS NOT NULL AND notes <> '')
      OR (description IS NOT NULL AND description <> '')
      OR (result IS NOT NULL AND result <> '')
    )
  ORDER BY contact_id, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_latest_feedback_per_contact(uuid[]) TO authenticated;
