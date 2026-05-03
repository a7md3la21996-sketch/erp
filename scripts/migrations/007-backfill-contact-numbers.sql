-- ─────────────────────────────────────────────────────────────────────────
-- Migration 007: Backfill + dedupe contact_number
--
-- Three problems found in the live data on 2026-05-03:
--   1. Some contacts had NULL/empty contact_number (older imports).
--   2. Some clones from Phase 1 ended up with literal "null-2", "null-3",
--      "null-4" because the clone script did `${c.contact_number}-${i}`
--      without a null-check (see scripts/phase1-sample-test.mjs:129).
--   3. One real duplicate ('C-01821-2' shared by 2 rows).
--
-- This migration regenerates a fresh `C-XXXXXXXX-XXXX` (random base36)
-- for every row in those three buckets:
--   - NULL or empty contact_number
--   - "null-N" / "undefined-N" / literal 'null' / 'undefined'
--   - Duplicates: keep the OLDEST row (by created_at, then id), regen
--     the rest
--
-- Per-row generator with retry-on-collision so no two rows ever land on
-- the same code. Wrapped in a transaction with three final assertions:
-- zero NULL, zero garbage, zero duplicates. If any check fails the whole
-- transaction rolls back.
--
-- Run once on Supabase (SQL editor). Idempotent — running again is a no-op.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TEMP TABLE _needs_regen AS
SELECT id FROM public.contacts WHERE contact_number IS NULL OR contact_number = ''
UNION
SELECT id FROM public.contacts
  WHERE contact_number ~ '^(null|undefined)-' OR contact_number IN ('null', 'undefined')
UNION
SELECT id FROM (
  SELECT id, row_number() OVER (PARTITION BY contact_number ORDER BY created_at ASC, id ASC) AS rn
  FROM public.contacts
  WHERE contact_number IS NOT NULL AND contact_number <> ''
    AND contact_number !~ '^(null|undefined)-'
    AND contact_number NOT IN ('null', 'undefined')
) ranked
WHERE rn > 1;

DO $$
DECLARE
  cid uuid;
  new_code text;
  attempts int;
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  alpha_len int := length(alphabet);
  total int;
BEGIN
  SELECT COUNT(*) INTO total FROM _needs_regen;
  RAISE NOTICE 'Regenerating % rows', total;

  FOR cid IN SELECT id FROM _needs_regen LOOP
    attempts := 0;
    LOOP
      new_code := 'C-' ||
        (SELECT string_agg(substring(alphabet FROM (floor(random() * alpha_len)::int + 1) FOR 1), '')
         FROM generate_series(1, 8)) ||
        '-' ||
        (SELECT string_agg(substring(alphabet FROM (floor(random() * alpha_len)::int + 1) FOR 1), '')
         FROM generate_series(1, 4));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.contacts WHERE contact_number = new_code);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique code for %', cid;
      END IF;
    END LOOP;
    UPDATE public.contacts SET contact_number = new_code WHERE id = cid;
  END LOOP;
END $$;

DO $$
DECLARE remaining int; garbage int; dups int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM public.contacts WHERE contact_number IS NULL OR contact_number = '';
  IF remaining > 0 THEN RAISE EXCEPTION 'Still % rows without contact_number', remaining; END IF;
  SELECT COUNT(*) INTO garbage FROM public.contacts WHERE contact_number ~ '^(null|undefined)-' OR contact_number IN ('null', 'undefined');
  IF garbage > 0 THEN RAISE EXCEPTION 'Still % garbage codes', garbage; END IF;
  SELECT COUNT(*) INTO dups FROM (
    SELECT contact_number FROM public.contacts GROUP BY contact_number HAVING COUNT(*) > 1
  ) d;
  IF dups > 0 THEN RAISE EXCEPTION 'Still % duplicate codes', dups; END IF;
  RAISE NOTICE 'Done. All clean.';
END $$;

DROP TABLE _needs_regen;
COMMIT;
