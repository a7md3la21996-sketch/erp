-- H2: atomic log_interaction RPC.
--
-- Replaces the JS orchestration (createActivity → createTask → updateContact as
-- 4 separate round-trips) with ONE transactional function, so a mid-sequence
-- failure can never leave a half-written interaction (activity with no
-- follow-up) that a retry then duplicates. Everything below commits together or
-- not at all.
--
-- SECURITY INVOKER: runs as the caller, so the existing RLS policies on
-- activities/tasks/contacts still scope every write (no privilege escalation).
-- The actor identity is taken from auth.uid() server-side, so it can't be
-- forged by the client.
--
-- Behaviour mirrors interactionsService.logInteraction EXACTLY, including the
-- known M3 quirk (auto-complete only matches past-due tasks via `due_date <=
-- now`) — that is intentionally left as-is here; M3 is a separate decision.

CREATE OR REPLACE FUNCTION public.log_interaction(
  p_contact_id               uuid,
  p_type                     text,
  p_result                   text DEFAULT NULL,
  p_description              text DEFAULT NULL,
  p_notes                    text DEFAULT NULL,
  p_meeting_subtype          text DEFAULT NULL,
  p_mode                     text DEFAULT 'log',
  p_scheduled_date           timestamptz DEFAULT NULL,
  p_occurred_at              timestamptz DEFAULT NULL,
  p_status_from              text DEFAULT NULL,
  p_status_to                text DEFAULT NULL,
  p_dq_reason                text DEFAULT NULL,
  p_followup_type            text DEFAULT 'followup',
  p_followup_title           text DEFAULT NULL,
  p_followup_notes           text DEFAULT NULL,
  p_followup_priority        text DEFAULT 'medium',
  p_followup_due_at          timestamptz DEFAULT NULL,
  p_followup_contact_name    text DEFAULT NULL,
  p_skip_followup_enforcement boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_name_ar    text;
  v_name_en    text;
  v_cur_status text;
  v_is_deleted boolean;
  v_closes     boolean;
  v_eff_status text;
  v_required   boolean;
  v_match      text[];
  v_now        timestamptz := now();
  v_from_lbl   text;
  v_to_lbl     text;
  v_activity   jsonb;
  v_task       jsonb := NULL;
  v_status_act jsonb := NULL;
BEGIN
  -- Actor names (server-side; client cannot forge who acted).
  SELECT full_name_ar, full_name_en INTO v_name_ar, v_name_en FROM users WHERE id = v_actor_id;

  -- Contact must exist and not be soft-deleted (same guard as createActivity).
  SELECT contact_status, is_deleted INTO v_cur_status, v_is_deleted FROM contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_NOT_FOUND'; END IF;
  IF v_is_deleted THEN RAISE EXCEPTION 'CONTACT_DELETED'; END IF;

  -- COALESCE to a real boolean: `NULL = 'disqualified'` is NULL, and a NULL here
  -- would poison `NOT v_closes` in the task-insert condition (TRUE AND NULL =
  -- NULL → the follow-up task silently wouldn't be created).
  v_closes     := COALESCE(p_status_to = 'disqualified', false);
  v_eff_status := COALESCE(p_status_to, v_cur_status);

  -- ── The follow-up guard — the whole reason this path exists. No UI or direct
  -- API call can log a call/whatsapp/meeting/email without a next step, except
  -- the explicit quick-send bypass.
  v_required := (p_type IN ('call','whatsapp','meeting','email'))
                AND (v_eff_status IS DISTINCT FROM 'disqualified');
  IF v_required AND NOT COALESCE(p_skip_followup_enforcement, false) AND p_followup_due_at IS NULL THEN
    RAISE EXCEPTION 'FOLLOWUP_REQUIRED';
  END IF;

  -- 1) Activity + last_activity_at.
  INSERT INTO activities (
    type, result, description, notes, meeting_subtype, scheduled_date, status,
    contact_id, user_id, user_name_ar, user_name_en, dept, created_at
  ) VALUES (
    p_type, NULLIF(p_result,''), NULLIF(p_description,''), NULLIF(p_notes,''),
    CASE WHEN p_type = 'meeting' THEN p_meeting_subtype ELSE NULL END,
    CASE WHEN p_mode = 'schedule' THEN p_scheduled_date ELSE NULL END,
    CASE WHEN p_mode = 'schedule' THEN 'scheduled' ELSE 'completed' END,
    p_contact_id, v_actor_id, COALESCE(v_name_ar,''), COALESCE(v_name_en,''), 'sales',
    COALESCE(p_occurred_at, v_now)
  )
  RETURNING to_jsonb(activities.*) INTO v_activity;

  UPDATE contacts SET last_activity_at = v_now WHERE id = p_contact_id;

  -- Auto-complete the matching PAST-DUE pending task (the one being fulfilled).
  -- (M3: the `due_date <= now` filter is intentionally kept for now — a separate,
  -- deferred decision. Dropping it marks an early-fulfilled follow-up 'done'
  -- instead of letting the supersede trigger cancel it.)
  v_match := CASE WHEN p_type = 'call' THEN ARRAY['call','followup'] ELSE ARRAY[p_type] END;
  UPDATE tasks SET status = 'done', completed_at = v_now
   WHERE contact_id = p_contact_id AND assigned_to = v_actor_id
     AND status = 'pending' AND type = ANY(v_match) AND due_date <= v_now;

  -- 2) New follow-up task. Its INSERT fires supersede_prior_followups, which
  -- cancels every OTHER pending task and lets next_follow_up_at recompute.
  IF p_followup_due_at IS NOT NULL AND NOT v_closes THEN
    INSERT INTO tasks (
      type, title, notes, priority, status, due_date, contact_id, contact_name,
      dept, assigned_to, assigned_to_name_ar, assigned_to_name_en, created_at
    ) VALUES (
      -- tasks.title is NOT NULL — default it so a caller that omits the title
      -- (e.g. the leads-table quick action) can't fail the whole transaction.
      COALESCE(p_followup_type,'followup'), COALESCE(NULLIF(p_followup_title,''), 'Follow-up'), COALESCE(p_followup_notes,''),
      COALESCE(p_followup_priority,'medium'), 'pending', p_followup_due_at, p_contact_id,
      p_followup_contact_name, 'sales', v_actor_id, COALESCE(v_name_ar,''), COALESCE(v_name_en,''), v_now
    )
    RETURNING to_jsonb(tasks.*) INTO v_task;
  END IF;

  -- 3) Closing the lead: cancel any lingering pending tasks (no orphan).
  IF v_closes THEN
    UPDATE tasks SET status = 'cancelled', completed_at = v_now
     WHERE contact_id = p_contact_id AND status = 'pending';
  END IF;

  -- 4) Optional status change + a matching status_change timeline row.
  IF p_status_to IS NOT NULL AND p_status_to IS DISTINCT FROM COALESCE(p_status_from, v_cur_status) THEN
    UPDATE contacts
       SET contact_status    = p_status_to,
           disqualify_reason = CASE WHEN v_closes THEN p_dq_reason ELSE disqualify_reason END
     WHERE id = p_contact_id;

    v_from_lbl := CASE COALESCE(p_status_from, v_cur_status)
      WHEN 'new' THEN 'New' WHEN 'contacted' THEN 'Contacted' WHEN 'following' THEN 'Following'
      WHEN 'has_opportunity' THEN 'Has Opportunity' WHEN 'disqualified' THEN 'Disqualified'
      ELSE COALESCE(p_status_from, v_cur_status, '—') END;
    v_to_lbl := CASE p_status_to
      WHEN 'new' THEN 'New' WHEN 'contacted' THEN 'Contacted' WHEN 'following' THEN 'Following'
      WHEN 'has_opportunity' THEN 'Has Opportunity' WHEN 'disqualified' THEN 'Disqualified'
      ELSE p_status_to END;

    INSERT INTO activities (type, notes, contact_id, user_id, user_name_ar, user_name_en, dept, created_at)
    VALUES ('status_change',
            v_from_lbl || ' → ' || v_to_lbl || CASE WHEN p_dq_reason IS NOT NULL THEN ' (' || p_dq_reason || ')' ELSE '' END,
            p_contact_id, v_actor_id, COALESCE(v_name_ar,''), COALESCE(v_name_en,''), 'sales', v_now)
    RETURNING to_jsonb(activities.*) INTO v_status_act;
  END IF;

  RETURN jsonb_build_object('activity', v_activity, 'task', v_task, 'statusActivity', v_status_act);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_interaction(
  uuid, text, text, text, text, text, text, timestamptz, timestamptz, text, text, text,
  text, text, text, text, timestamptz, text, boolean
) TO authenticated;
