-- Retire lead scoring entirely (2026-08-11).
--
-- The lead score was unused and misleading: a probe on 2026-08-11 found ALL
-- 33,752 contacts sitting at lead_score = 0 (zero non-zero rows, zero NULLs), so
-- the scoring engine had effectively been dead for a long time. The user asked to
-- remove "anything called score" — the UI surfaces and the backend engine
-- (incrementLeadScore + the per-activity SCORE_MAP) are removed in code; this
-- migration drops the now-orphaned column and its history table.
--
-- ORDER MATTERS: run this AFTER the code that removes lead_score is deployed.
-- The previously-live bundle still does `SELECT ... lead_score ...` explicitly
-- (e.g. LeadPoolPage.fetchPoolLeads), so dropping the column while that bundle
-- is live would 400 those reads. Deploy first, then run this.
--
-- NOT REVERSIBLE — the (all-zero) column and its history are gone for good.
-- Run this whole file in the Supabase SQL Editor.

-- Sanity check first (optional): expect 0.
-- SELECT count(*) AS nonzero_scores FROM contacts WHERE lead_score <> 0;

ALTER TABLE contacts DROP COLUMN IF EXISTS lead_score;

-- History table (not exposed via PostgREST; drop if present).
DROP TABLE IF EXISTS lead_score_history;
