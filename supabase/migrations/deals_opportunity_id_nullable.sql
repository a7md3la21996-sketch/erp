-- Phase B (opportunity-as-status): allow deals to exist WITHOUT an opportunity.
-- The won-opportunity -> deal bridge is moving into the lead drawer, where a
-- deal is created straight from the contact (opportunity_id = NULL). Old deals
-- keep their opportunity_id; only NEW deals will omit it.
--
-- Safe + reversible: DROP NOT NULL never fails on existing data and does not
-- touch any rows. Re-tighten later with SET NOT NULL if Phase B is abandoned.

-- 1) Inspect the current state first (run this SELECT alone to confirm):
--    SELECT column_name, is_nullable, data_type
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'deals'
--      AND column_name = 'opportunity_id';

-- 2) Make it nullable (no-op if it already is):
ALTER TABLE public.deals ALTER COLUMN opportunity_id DROP NOT NULL;
