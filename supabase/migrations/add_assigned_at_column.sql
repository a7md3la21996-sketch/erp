-- Add assigned_at column to track when a contact was assigned to an agent
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Backfill: set assigned_at = created_at for existing contacts that have an assigned_to_name
UPDATE contacts SET assigned_at = created_at WHERE assigned_to_name IS NOT NULL AND assigned_at IS NULL;
