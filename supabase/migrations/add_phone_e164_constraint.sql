-- Enforce E.164 phone format at the DB level so junk like
-- "+201111111944", "+999999999999999", "+2811004160053128203011604031",
-- "01XXXXXXXXX" (no plus) etc. cannot enter regardless of caller bugs.
--
-- The regex matches: leading "+", country code starting with 1-9 (no leading 0),
-- total 8-15 digits after "+" (E.164 spec).
--
-- Mirror at three layers (defense in depth):
--   1. UI    — src/pages/crm/contacts/constants.jsx :: validatePhone
--   2. API   — src/services/contactsService.js :: assertPhoneE164 (in create + update)
--   3. DB    — this constraint
--   4. Import — src/pages/crm/ImportModal.jsx :: cleanPhone .invalid + rejectNoPhone default ON
--
-- NOT VALID skips checking existing rows on add. ~140 historical junk rows
-- (mostly DQ) are preserved. From this point on, INSERT/UPDATE must satisfy
-- the constraint.
--
-- To later remove the legacy junk and tighten the constraint, run:
--   ALTER TABLE contacts VALIDATE CONSTRAINT contacts_phone_e164_format;
-- after cleaning or soft-deleting any remaining offenders.

ALTER TABLE contacts
  ADD CONSTRAINT contacts_phone_e164_format
  CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')
  NOT VALID;

-- Same rule for phone2, but allow NULL (it's an optional secondary phone).
-- 115 historical violations existed at constraint-add time (mostly Egyptian
-- local-format like 01XXXXXXXXX); they're preserved by NOT VALID.
ALTER TABLE contacts
  ADD CONSTRAINT contacts_phone2_e164_format
  CHECK (phone2 IS NULL OR phone2 ~ '^\+[1-9][0-9]{7,14}$')
  NOT VALID;
