-- Smart bulk-reassign RPC.
--
-- Replaces the all-or-nothing bulk_reassign_contacts: that one RAISEs (rolls
-- back everything) if any single row can't move, so the frontend fell back to a
-- slow per-row loop with vague errors ("failed to update 1 contact").
--
-- This version reassigns each contact it can, SKIPS the ones it can't (recording
-- WHY), and returns a structured result so the UI can show exactly what happened
-- and offer to send the skipped ones to a different agent. One round-trip.
--
-- Skips, with reasons:
--   already_owned  — the target already owns this copy (no-op)
--   duplicate_new  — moving it would give the target two "new" leads with the
--                    same phone (uniq_active_new_phone_per_owner)
--   error          — any other constraint (e.g. dq_requires_reason)
--
-- Optional p_new_status / p_new_temperature apply the same status/temperature
-- change the old "reassign + set status" path did — but per-row, so one bad row
-- doesn't sink the batch.
--
-- Returns: { "moved": <int>, "skipped": [ {contact_id, full_name, phone, reason}, ... ] }

CREATE OR REPLACE FUNCTION public.reassign_contacts_smart(
  p_contact_ids uuid[],
  p_to_user_id uuid,
  p_assigned_by_name text,
  p_new_status text DEFAULT NULL,
  p_new_temperature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_role text;
  v_to_name    text;
  v_moved      int := 0;
  v_skipped    jsonb := '[]'::jsonb;
  r            record;
BEGIN
  -- Authorization (same set as bulk_reassign_contacts).
  SELECT role INTO v_actor_role FROM users WHERE id = auth.uid();
  IF v_actor_role NOT IN ('admin','operations','sales_director','sales_manager','team_leader') THEN
    RAISE EXCEPTION 'Not authorized: role=%', COALESCE(v_actor_role,'unknown');
  END IF;

  SELECT COALESCE(full_name_en, full_name_ar) INTO v_to_name FROM users WHERE id = p_to_user_id;
  IF v_to_name IS NULL THEN
    RAISE EXCEPTION 'Target user % not found', p_to_user_id;
  END IF;

  FOR r IN
    SELECT id, full_name, phone, assigned_to, assigned_to_name
    FROM contacts
    WHERE id = ANY(p_contact_ids) AND is_deleted IS NOT TRUE
  LOOP
    -- Already with the target → nothing to do.
    IF r.assigned_to = p_to_user_id THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'contact_id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'reason', 'already_owned'));
      CONTINUE;
    END IF;

    -- Per-row savepoint: a failure here rolls back ONLY this row (and its
    -- activity insert), not the whole batch.
    BEGIN
      INSERT INTO activities (
        type, entity_type, contact_id, notes,
        user_id, user_name_en, from_user_id, to_user_id, status, created_at
      ) VALUES (
        'reassignment', 'contact', r.id,
        COALESCE(r.assigned_to_name,'—') || ' → ' || v_to_name,
        NULL, p_assigned_by_name, r.assigned_to, p_to_user_id, 'completed', NOW()
      );

      UPDATE contacts SET
        assigned_to       = p_to_user_id,
        assigned_to_name  = v_to_name,
        assigned_to_names = jsonb_build_array(v_to_name),
        assigned_by_name  = p_assigned_by_name,
        assigned_at       = NOW(),
        contact_status    = COALESCE(p_new_status, contact_status),
        temperature       = COALESCE(p_new_temperature, temperature)
      WHERE id = r.id;

      v_moved := v_moved + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'contact_id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'reason', 'duplicate_new'));
      WHEN others THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'contact_id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'reason', 'error'));
    END;
  END LOOP;

  RETURN jsonb_build_object('moved', v_moved, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_contacts_smart(uuid[], uuid, text, text, text) TO authenticated;
