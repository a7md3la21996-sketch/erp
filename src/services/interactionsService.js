import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

// ── Unified interaction logging ───────────────────────────────────────────
//
// ONE path that every "take action on a lead" entry point funnels through —
// the drawer's TakeActionForm, the hero Call/Note buttons, the Deal/Meetings
// tabs, the Log-Call/Meeting modals, and the leads-table quick actions.
//
// The actual work now runs inside a single atomic DB function (log_interaction
// RPC): activity + follow-up task + supersede + optional status change all
// commit together or not at all, so a mid-sequence failure can't leave a
// half-written interaction that a retry then duplicates.
//
// Follow-up is MANDATORY for call / whatsapp / meeting / email. It is EXEMPT
// for: note; any interaction whose status change (or current status) is
// disqualified; and the hero WhatsApp quick-send (skipFollowUpEnforcement).

// Exported so the UI gate (disable Save until a date is picked) uses the SAME
// rule the RPC enforces — they can't drift.
export const FOLLOWUP_REQUIRED_TYPES = new Set(['call', 'whatsapp', 'meeting', 'email']);

export function isFollowUpRequired(type, statusTo) {
  if (statusTo === 'disqualified') return false;
  return FOLLOWUP_REQUIRED_TYPES.has(type);
}

/**
 * Log an interaction on a lead atomically (see log_interaction RPC).
 *
 * @param {string} contactId
 * @param {object} payload  type, result, description, notes, meetingSubtype,
 *   mode ('log'|'schedule'), scheduledDate, occurredAt,
 *   statusChange {from,to,dqReason}, followUp {type,title,notes,priority,dueAt,
 *   contactName}, skipFollowUpEnforcement.
 * @returns {Promise<{activity, task, statusActivity}>}
 * @throws  Error('FOLLOWUP_REQUIRED') when a required follow-up date is missing.
 */
export async function logInteraction(contactId, payload = {}) {
  const {
    type,
    result = null,
    description = '',
    notes = null,
    meetingSubtype = null,
    mode = 'log',
    scheduledDate = null,
    occurredAt = null,
    statusChange = null,
    followUp = null,
    skipFollowUpEnforcement = false,
  } = payload;

  if (!contactId) throw new Error('logInteraction: contactId is required');
  if (!type) throw new Error('logInteraction: type is required');

  const { data, error } = await supabase.rpc('log_interaction', {
    p_contact_id: contactId,
    p_type: type,
    p_result: result || null,
    p_description: description || null,
    p_notes: notes || null,
    p_meeting_subtype: meetingSubtype || null,
    p_mode: mode || 'log',
    p_scheduled_date: scheduledDate || null,
    p_occurred_at: occurredAt || null,
    p_status_from: statusChange?.from || null,
    p_status_to: statusChange?.to || null,
    p_dq_reason: statusChange?.dqReason || null,
    p_followup_type: followUp?.type || 'followup',
    p_followup_title: followUp?.title || null,
    p_followup_notes: followUp?.notes || null,
    p_followup_priority: followUp?.priority || 'medium',
    // Normalise the due date to a real UTC instant — a naive datetime-local
    // string ("2026-08-05T10:00") is parsed as LOCAL time here, so every
    // follow-up lands on the same clock (and the right Cairo day).
    p_followup_due_at: followUp?.dueAt ? new Date(followUp.dueAt).toISOString() : null,
    p_followup_contact_name: followUp?.contactName || null,
    p_skip_followup_enforcement: !!skipFollowUpEnforcement,
  });

  if (error) {
    if (/FOLLOWUP_REQUIRED/.test(error.message || '')) throw new Error('FOLLOWUP_REQUIRED');
    reportError('interactionsService', 'logInteraction', error);
    throw new Error(error.message || 'Failed to log interaction');
  }
  return data || {};
}
