-- Add fingerprint device ID to employees table
-- This links each employee to their ID in the fingerprint/attendance device
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fingerprint_id text;

-- Index for fast lookup during attendance import
CREATE INDEX IF NOT EXISTS idx_employees_fingerprint_id ON employees (fingerprint_id);
