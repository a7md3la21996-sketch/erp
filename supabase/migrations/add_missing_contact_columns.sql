-- Migration: Add missing columns to contacts table
-- These columns are referenced in contactsService.js but were missing from the schema

-- Per-agent status tracking (JSONB object: { "Agent Name": "status" })
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS agent_statuses jsonb DEFAULT '{}';

-- Multi-agent assignment names (JSONB array: ["Agent1", "Agent2"])
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_to_names jsonb DEFAULT '[]';

-- Auto-generated contact number (e.g. "C-M1ABC2")
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_number text;

-- Index for contact_number lookups
CREATE INDEX IF NOT EXISTS idx_contacts_number ON contacts(contact_number);

-- GIN index for assigned_to_names array containment queries
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_names ON contacts USING GIN (assigned_to_names);
