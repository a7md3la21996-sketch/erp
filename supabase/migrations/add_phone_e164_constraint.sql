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

-- Per-country digit-count validator. The structural E.164 regex is the
-- first gate; matched country prefixes then require the digit-count for
-- that country (e.g. Egypt 8-10, Saudi 7-9, Kuwait 7-8). Unknown country
-- codes pass through with structural validation only. JS layers
-- (libphonenumber-js) enforce the per-country *prefix* rules on top
-- (e.g. Egyptian mobile must start with 01[0125]) — the DB function is
-- a safety net for direct SQL writes.
CREATE OR REPLACE FUNCTION is_valid_phone_intl(p text) RETURNS boolean AS $$
BEGIN
  IF p IS NULL THEN RETURN TRUE; END IF;
  IF p !~ '^\+[1-9][0-9]{7,14}$' THEN RETURN FALSE; END IF;
  RETURN CASE
    WHEN p ~ '^\+20'  THEN p ~ '^\+20[0-9]{8,10}$'
    WHEN p ~ '^\+966' THEN p ~ '^\+966[0-9]{7,9}$'
    WHEN p ~ '^\+971' THEN p ~ '^\+971[0-9]{7,9}$'
    WHEN p ~ '^\+965' THEN p ~ '^\+965[0-9]{7,8}$'
    WHEN p ~ '^\+974' THEN p ~ '^\+974[0-9]{7,8}$'
    WHEN p ~ '^\+973' THEN p ~ '^\+973[0-9]{7,8}$'
    WHEN p ~ '^\+968' THEN p ~ '^\+968[0-9]{7,8}$'
    WHEN p ~ '^\+962' THEN p ~ '^\+962[0-9]{8,9}$'
    WHEN p ~ '^\+961' THEN p ~ '^\+961[0-9]{7,8}$'
    WHEN p ~ '^\+963' THEN p ~ '^\+963[0-9]{8,9}$'
    WHEN p ~ '^\+964' THEN p ~ '^\+964[0-9]{9,10}$'
    WHEN p ~ '^\+967' THEN p ~ '^\+967[0-9]{8,9}$'
    WHEN p ~ '^\+970' THEN p ~ '^\+970[0-9]{8,9}$'
    WHEN p ~ '^\+218' THEN p ~ '^\+218[0-9]{8,9}$'
    WHEN p ~ '^\+216' THEN p ~ '^\+216[0-9]{8}$'
    WHEN p ~ '^\+213' THEN p ~ '^\+213[0-9]{8,9}$'
    WHEN p ~ '^\+212' THEN p ~ '^\+212[0-9]{8,9}$'
    WHEN p ~ '^\+249' THEN p ~ '^\+249[0-9]{9}$'
    WHEN p ~ '^\+91'  THEN p ~ '^\+91[0-9]{10}$'
    WHEN p ~ '^\+92'  THEN p ~ '^\+92[0-9]{10}$'
    WHEN p ~ '^\+880' THEN p ~ '^\+880[0-9]{8,10}$'
    WHEN p ~ '^\+63'  THEN p ~ '^\+63[0-9]{8,10}$'
    WHEN p ~ '^\+62'  THEN p ~ '^\+62[0-9]{8,12}$'
    WHEN p ~ '^\+94'  THEN p ~ '^\+94[0-9]{9}$'
    WHEN p ~ '^\+977' THEN p ~ '^\+977[0-9]{8,10}$'
    WHEN p ~ '^\+98'  THEN p ~ '^\+98[0-9]{10}$'
    WHEN p ~ '^\+93'  THEN p ~ '^\+93[0-9]{9}$'
    WHEN p ~ '^\+90'  THEN p ~ '^\+90[0-9]{10}$'
    WHEN p ~ '^\+234' THEN p ~ '^\+234[0-9]{10}$'
    WHEN p ~ '^\+254' THEN p ~ '^\+254[0-9]{9}$'
    WHEN p ~ '^\+251' THEN p ~ '^\+251[0-9]{9}$'
    WHEN p ~ '^\+233' THEN p ~ '^\+233[0-9]{9}$'
    WHEN p ~ '^\+27'  THEN p ~ '^\+27[0-9]{9}$'
    WHEN p ~ '^\+1'   THEN p ~ '^\+1[0-9]{10}$'
    WHEN p ~ '^\+44'  THEN p ~ '^\+44[0-9]{9,10}$'
    WHEN p ~ '^\+49'  THEN p ~ '^\+49[0-9]{10,11}$'
    WHEN p ~ '^\+33'  THEN p ~ '^\+33[0-9]{9}$'
    WHEN p ~ '^\+39'  THEN p ~ '^\+39[0-9]{9,10}$'
    WHEN p ~ '^\+34'  THEN p ~ '^\+34[0-9]{9}$'
    WHEN p ~ '^\+351' THEN p ~ '^\+351[0-9]{9}$'
    WHEN p ~ '^\+31'  THEN p ~ '^\+31[0-9]{9}$'
    WHEN p ~ '^\+41'  THEN p ~ '^\+41[0-9]{9}$'
    WHEN p ~ '^\+43'  THEN p ~ '^\+43[0-9]{10,13}$'
    WHEN p ~ '^\+46'  THEN p ~ '^\+46[0-9]{7,9}$'
    WHEN p ~ '^\+47'  THEN p ~ '^\+47[0-9]{8}$'
    WHEN p ~ '^\+45'  THEN p ~ '^\+45[0-9]{8}$'
    WHEN p ~ '^\+358' THEN p ~ '^\+358[0-9]{6,12}$'
    WHEN p ~ '^\+353' THEN p ~ '^\+353[0-9]{9}$'
    WHEN p ~ '^\+30'  THEN p ~ '^\+30[0-9]{10}$'
    WHEN p ~ '^\+48'  THEN p ~ '^\+48[0-9]{9}$'
    WHEN p ~ '^\+420' THEN p ~ '^\+420[0-9]{9}$'
    WHEN p ~ '^\+7'   THEN p ~ '^\+7[0-9]{10}$'
    WHEN p ~ '^\+380' THEN p ~ '^\+380[0-9]{9}$'
    WHEN p ~ '^\+357' THEN p ~ '^\+357[0-9]{8}$'
    WHEN p ~ '^\+61'  THEN p ~ '^\+61[0-9]{9}$'
    WHEN p ~ '^\+64'  THEN p ~ '^\+64[0-9]{8,10}$'
    WHEN p ~ '^\+55'  THEN p ~ '^\+55[0-9]{10,11}$'
    WHEN p ~ '^\+52'  THEN p ~ '^\+52[0-9]{10}$'
    WHEN p ~ '^\+86'  THEN p ~ '^\+86[0-9]{11}$'
    WHEN p ~ '^\+81'  THEN p ~ '^\+81[0-9]{9,10}$'
    WHEN p ~ '^\+82'  THEN p ~ '^\+82[0-9]{9,10}$'
    WHEN p ~ '^\+852' THEN p ~ '^\+852[0-9]{8}$'
    WHEN p ~ '^\+65'  THEN p ~ '^\+65[0-9]{8}$'
    WHEN p ~ '^\+60'  THEN p ~ '^\+60[0-9]{9,10}$'
    WHEN p ~ '^\+66'  THEN p ~ '^\+66[0-9]{9}$'
    ELSE TRUE
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_phone_valid
  CHECK (is_valid_phone_intl(phone))
  NOT VALID;

-- Same rule for phone2, but allow NULL (it's an optional secondary phone).
-- 115 historical violations existed at constraint-add time (mostly Egyptian
-- local-format like 01XXXXXXXXX); they're preserved by NOT VALID.
ALTER TABLE contacts
  ADD CONSTRAINT contacts_phone2_valid
  CHECK (is_valid_phone_intl(phone2))
  NOT VALID;
