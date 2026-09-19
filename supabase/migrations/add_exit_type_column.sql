-- Exit axis for the lead lifecycle model: split the single "disqualified" state
-- into WHY the lead left — disqualified (junk / never a fit) vs lost (a real
-- prospect that reached qualification and was lost). Only meaningful when
-- contact_status = 'disqualified'. Nullable; back-compat safe (nothing reads it
-- until the UI/reports are migrated). See memory: lead-lifecycle-model-locked.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS exit_type text
  CHECK (exit_type IS NULL OR exit_type IN ('disqualified', 'lost'));

COMMENT ON COLUMN contacts.exit_type IS
  'Exit axis: disqualified (junk/never-fit, data-quality signal) vs lost (real prospect lost after reaching qualified+, win-loss signal). Set only when contact_status=disqualified.';

CREATE INDEX IF NOT EXISTS idx_contacts_exit_type
  ON contacts(exit_type) WHERE exit_type IS NOT NULL;
