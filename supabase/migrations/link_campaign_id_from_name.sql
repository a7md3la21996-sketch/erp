-- ============================================================================
-- Safety net: a lead attributed to a campaign by NAME can never be left without
-- the campaign_id FK.
--
-- The app already resolves campaign_name -> campaign_id on add/edit/import
-- (contactsService.resolveCampaignLinks). This trigger moves the guarantee INTO
-- the database so it also holds for writes that bypass the app: service-role
-- scripts, raw SQL in the Supabase editor, future webhooks/integrations, or any
-- other bulk tool. Whatever writes the row, if campaign_name is set and
-- campaign_id is null, the FK is filled from the matching campaign.
--
-- Same pattern as the denormalized-name trigger and clear_followup_on_disqualify.
--
-- Design choice: this trigger only LINKS to an EXISTING campaign (matched
-- case/space-insensitively on name_en/name_ar). It deliberately does NOT create
-- a new campaign — a trigger inserting into another table on every row is risky
-- and would let typos silently spawn junk campaigns. Registering brand-new
-- campaigns stays the app's job (resolveCampaignLinks auto-registers there); a
-- name with no matching campaign is simply left as-is (name only) for cleanup.
-- ============================================================================

-- Normalize a campaign name for matching: trim, collapse internal whitespace,
-- lowercase. Kept as a small immutable helper so the trigger and the backfill
-- use identical logic.
CREATE OR REPLACE FUNCTION public.norm_campaign_name(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.set_campaign_id_from_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_id  uuid;
  v_key text;
BEGIN
  -- Nothing to do unless the row is attributed by name but missing the FK.
  IF NEW.campaign_name IS NULL OR btrim(NEW.campaign_name) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.campaign_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_key := public.norm_campaign_name(NEW.campaign_name);

  SELECT c.id
    INTO v_id
    FROM campaigns c
   WHERE public.norm_campaign_name(c.name_en) = v_key
      OR public.norm_campaign_name(c.name_ar) = v_key
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    NEW.campaign_id := v_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_campaign_id_from_name ON public.contacts;
CREATE TRIGGER trg_set_campaign_id_from_name
  BEFORE INSERT OR UPDATE OF campaign_name, campaign_id ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_campaign_id_from_name();

-- One-time idempotent backfill: link any remaining live lead that has a
-- campaign_name matching a registered campaign but no campaign_id. (The app-side
-- backfill already did this on 2026-07-25; this makes the migration self-
-- contained and catches anything written since.)
UPDATE public.contacts ct
   SET campaign_id = c.id
  FROM public.campaigns c
 WHERE ct.campaign_id IS NULL
   AND ct.campaign_name IS NOT NULL
   AND btrim(ct.campaign_name) <> ''
   AND (ct.is_deleted IS NULL OR ct.is_deleted = false)
   AND (
        public.norm_campaign_name(ct.campaign_name) = public.norm_campaign_name(c.name_en)
     OR public.norm_campaign_name(ct.campaign_name) = public.norm_campaign_name(c.name_ar)
   );
