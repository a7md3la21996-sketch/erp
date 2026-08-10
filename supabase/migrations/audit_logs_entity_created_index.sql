-- Fix: the ContactDrawer's per-lead Audit tab (getAuditLogs with entityId) runs
--   SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 50
-- On the 106k-row audit_logs table there was no index for the entity_id equality,
-- so the planner used the created_at index and scanned the whole table backwards
-- filtering entity_id → ~4.5s, tripping the client statement timeout (500,
-- SQLSTATE 57014 "canceling statement due to statement timeout").
--
-- A composite btree (entity_id, created_at) is the natural fix BUT it fails to
-- build — some BULK-action audit rows (bulk_reassign / bulk_add_agent) stored a
-- COMMA-JOINED LIST of contact ids in entity_id (up to ~3.7 KB), exceeding the
-- btree per-row limit (8191 bytes): "index row requires 9272 bytes".
--
-- A HASH index sidesteps that: it stores a 4-byte hash so oversized values index
-- fine, and it fully serves the equality lookup `entity_id = $1`. The small set
-- of matching rows is then sorted by created_at in memory (fast — a lead has a
-- handful of audits). The bulk rows (list-valued entity_id) never match a single
-- uuid, so they're irrelevant to a per-lead audit view anyway.
--
-- Run this whole file as-is in the Supabase SQL Editor. CONCURRENTLY avoids
-- locking audit_logs while the index builds — do NOT wrap it in a transaction.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_hash
  ON audit_logs USING hash (entity_id);

-- Root cause (separate follow-up, NOT fixed here): bulk_reassign / bulk_add_agent
-- logging writes a joined id-list into entity_id. It should write a single id (or
-- NULL) and keep the affected-ids list in changes/description instead.
