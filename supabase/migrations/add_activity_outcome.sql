-- Conversation outcome on an interaction ------------------------------------
-- After an ENGAGED touch (call answered / whatsapp+email replied / meeting
-- attended / visit) the rep records WHAT the conversation led to — a richer
-- pipeline signal than the channel-level `result`. Stored per activity.
--
-- Values are the keys from CONVERSATION_OUTCOMES (src/pages/crm/contacts/
-- constants.jsx): interested, wants_meeting, wants_info, callback_scheduled,
-- negotiating, ready_to_reserve, price_high, payment_plan, location,
-- needs_time, comparing, not_interested, no_budget, already_bought,
-- just_browsing, do_not_contact, wrong_person.
--
-- Written by the client as a light UPDATE right after log_interaction (the
-- central RPC is intentionally left untouched). Safe + non-destructive:
-- nullable text, no default, no data rewrite.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS outcome text;

-- Helps the reporting/breakdown queries that will group by outcome.
CREATE INDEX IF NOT EXISTS idx_activities_outcome ON activities (outcome) WHERE outcome IS NOT NULL;
