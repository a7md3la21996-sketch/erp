-- Root-cause guard: a disqualified lead can NEVER carry a live next follow-up.
--
-- Previously each code path had to remember to clear next_follow_up_at when
-- disqualifying, and the follow-up chips/filters had to exclude disqualified
-- rows defensively — a bulk op or new RPC that skipped the clear silently put
-- dead leads back into the "overdue" bucket. This trigger moves the guarantee
-- into the database: whatever writes the row (app, RPC, bulk SQL, future code),
-- a status of 'disqualified' forces next_follow_up_at to NULL. Same pattern as
-- the denormalized-name trigger.
CREATE OR REPLACE FUNCTION public.clear_followup_on_disqualify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.contact_status = 'disqualified' THEN
    NEW.next_follow_up_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_followup_on_disqualify ON public.contacts;
CREATE TRIGGER trg_clear_followup_on_disqualify
  BEFORE INSERT OR UPDATE OF contact_status, next_follow_up_at ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_followup_on_disqualify();

-- One-time backfill for any that already slipped through (the app already
-- cleared the 8 known rows; this is idempotent and covers anything since).
UPDATE public.contacts
   SET next_follow_up_at = NULL
 WHERE contact_status = 'disqualified'
   AND next_follow_up_at IS NOT NULL;
