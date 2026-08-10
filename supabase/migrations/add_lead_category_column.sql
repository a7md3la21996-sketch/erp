-- Explicit lead-category (ORIGIN) on contacts: Fresh / Rotation / Distributed /
-- Cold Calls. PERMANENT — describes where the lead came from, unlike
-- contact_status (the transient work state). Lets sales tell a real fresh lead
-- apart from a rotated / distributed one at a glance.
--
-- NULLABLE. The Leads page shows a colored badge + a filter from it. New leads
-- set it on add/import; reassign -> 'rotation' and distribute -> 'distributed'
-- automatically. Existing rows are backfilled once below.
--
-- NOTE: the backfill must briefly drop the NOT VALID check constraint
-- `dq_requires_reason`. ~9,821 legacy rows are contact_status='disqualified'
-- with no reason (they predate the constraint, which is NOT VALID so it never
-- checked them). A NOT VALID constraint is still enforced on UPDATE, so any
-- row-touch on those rows fails — blocking the backfill. We drop it, backfill,
-- then re-add it with the IDENTICAL definition (NOT VALID), all in one
-- transaction: same end state, no window where new bad disqualifications slip
-- in. The legacy reason-less rows are untouched (a separate data-quality issue).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_category text;
CREATE INDEX IF NOT EXISTS idx_contacts_lead_category ON contacts(lead_category);

-- DB-level safety net: any new lead inserted without an explicit category is
-- 'fresh'. distribute sets 'distributed' explicitly (overrides the default);
-- reassign is an UPDATE so the default never applies there. This keeps new
-- leads categorized even before the frontend ships / via any insert path.
ALTER TABLE contacts ALTER COLUMN lead_category SET DEFAULT 'fresh';

ALTER TABLE contacts DROP CONSTRAINT dq_requires_reason;

-- ── One-time backfill (precedence, highest first) ──────────────────────────
--   distributed : contact_number ends in -D<n>  (a distribute-feature clone,
--                 e.g. C-MOH7QYJ6-D1 / nested C-...-D1-D1). Anchored at end so
--                 random "-D.." inside the id (C-MP8E02K0-DAXR) is NOT matched.
--   rotation    : has a reassignment activity   (handed between agents)
--   cold_calls  : source = 'cold_call'          (none today; kept for symmetry)
--   fresh       : everything else (default)
-- Verified distribution on 2026-06-28 over 31,085 active leads:
--   distributed 2,528 · rotation 7,529 · fresh 21,028  (cold_calls 0).

UPDATE contacts c SET lead_category = CASE
  WHEN c.contact_number ~ '-D[0-9]+$' THEN 'distributed'
  WHEN EXISTS (
    SELECT 1 FROM activities a
    WHERE a.contact_id = c.id AND a.type = 'reassignment'
  ) THEN 'rotation'
  WHEN c.source = 'cold_call' THEN 'cold_calls'
  ELSE 'fresh'
END
WHERE c.is_deleted IS NOT TRUE AND c.lead_category IS NULL;

-- Re-add the constraint exactly as it was (NOT VALID — does not re-check the
-- existing reason-less rows; only enforces new disqualifications).
ALTER TABLE contacts ADD CONSTRAINT dq_requires_reason
  CHECK (
    contact_status <> 'disqualified'
    OR (disqualify_reason IS NOT NULL
        AND disqualify_reason <> ''
        AND disqualify_reason <> '—')
  ) NOT VALID;
