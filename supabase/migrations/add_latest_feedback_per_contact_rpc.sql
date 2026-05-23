-- Latest-feedback-per-contact RPC for the leads list "Last Feedback"
-- column. The old implementation pulled .range(0,199) activities per
-- chunk of 200 contacts, so for any chunk where ~30 contacts dominated
-- the activity log, the remaining ~170 silently fell out of the result
-- (their feedback column stayed empty even when they had real notes).
--
-- DISTINCT ON returns the newest row per contact whose notes OR
-- description is non-empty, in a single round-trip. SECURITY INVOKER so
-- the activities RLS still narrows visibility per role.

CREATE OR REPLACE FUNCTION get_latest_feedback_per_contact(p_contact_ids uuid[])
RETURNS TABLE(
  contact_id uuid,
  id uuid,
  notes text,
  description text,
  created_at timestamptz,
  user_name_ar text,
  user_name_en text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT ON (contact_id)
    contact_id, id, notes, description, created_at, user_name_ar, user_name_en
  FROM activities
  WHERE contact_id = ANY(p_contact_ids)
    AND (
      (notes IS NOT NULL AND notes <> '')
      OR (description IS NOT NULL AND description <> '')
    )
  ORDER BY contact_id, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_latest_feedback_per_contact(uuid[]) TO authenticated;
