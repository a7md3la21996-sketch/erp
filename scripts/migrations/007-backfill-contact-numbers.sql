-- ─────────────────────────────────────────────────────────────────────────
-- Migration 007: Backfill contact_number for legacy contacts
--
-- Some contacts (mostly older imports / API inserts that bypassed the
-- auto-numbering path) still have NULL or empty contact_number, so the
-- list views show a missing code next to their name. This migration
-- generates a code in the same shape the app uses elsewhere
-- (`C-XXXXXXXX-XXXX`, base36 uppercase) and writes it for every row
-- that needs one. Existing codes are never touched.
--
-- Safety:
--   1. Wrapped in a transaction.
--   2. Uses a per-row generator with retry-on-collision so no two rows
--      ever land on the same code.
--   3. Verifies at the end that:
--        - zero rows still have NULL/empty contact_number
--        - zero duplicate contact_numbers exist anywhere in the table
--
-- Run this once on Supabase (SQL editor).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Pre-flight: how many rows need a code?
DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM public.contacts
  WHERE contact_number IS NULL OR contact_number = '';
  RAISE NOTICE 'Backfilling % contacts with missing contact_number', missing_count;
END $$;

-- 2. Per-row loop with retry-on-collision.
--    Generates `C-XXXXXXXX-XXXX` from random base36 chars.
DO $$
DECLARE
  cid uuid;
  new_code text;
  attempts int;
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  alpha_len int := length(alphabet);
BEGIN
  FOR cid IN
    SELECT id FROM public.contacts
    WHERE contact_number IS NULL OR contact_number = ''
  LOOP
    attempts := 0;
    LOOP
      new_code := 'C-' ||
        (SELECT string_agg(substring(alphabet FROM (floor(random() * alpha_len)::int + 1) FOR 1), '')
         FROM generate_series(1, 8)) ||
        '-' ||
        (SELECT string_agg(substring(alphabet FROM (floor(random() * alpha_len)::int + 1) FOR 1), '')
         FROM generate_series(1, 4));

      -- Re-roll if this code is already in use somewhere.
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.contacts WHERE contact_number = new_code
      );

      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate a unique contact_number for % after 10 tries', cid;
      END IF;
    END LOOP;

    UPDATE public.contacts
    SET contact_number = new_code
    WHERE id = cid;
  END LOOP;
END $$;

-- 3. Verify every row now has a contact_number.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.contacts
  WHERE contact_number IS NULL OR contact_number = '';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Still % rows without contact_number after backfill — abort', remaining;
  END IF;
  RAISE NOTICE 'All contacts now have a contact_number ✓';
END $$;

-- 4. Verify uniqueness across the whole table.
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT contact_number
    FROM public.contacts
    WHERE contact_number IS NOT NULL
    GROUP BY contact_number
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate contact_numbers — abort', dup_count;
  END IF;
  RAISE NOTICE 'All contact_numbers are unique ✓';
END $$;

COMMIT;
