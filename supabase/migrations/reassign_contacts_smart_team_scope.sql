-- SECURITY FIX for reassign_contacts_smart: enforce TEAM SCOPE inside the DB.
--
-- The original function (reassign_contacts_smart.sql) is SECURITY DEFINER (so it
-- bypasses RLS) and only checked the ACTOR'S ROLE — never whether the leads being
-- moved actually belong to the actor's team. The only ownership guard lived in the
-- browser (ContactsPage validateAgentNames), which is trivially bypassed by calling
-- the RPC directly. Result: any team_leader/sales_manager could reassign ANY lead in
-- the company (other teams' leads) to anyone, by passing arbitrary contact IDs.
--
-- This version computes the actor's allowed-user set (same pattern as
-- get_reassignment_breakdown) and:
--   * managers/team-leaders may only move leads currently owned by a member of
--     their team subtree, and only TO a member of that subtree;
--   * admin/operations/sales_director keep full reach (v_allowed = NULL);
--   * a source lead outside scope is SKIPPED with reason 'out_of_scope' (reuses the
--     existing skipped-array mechanism, so the UI shows exactly what didn't move);
--   * a target user outside scope raises (one target applies to the whole batch).
--
-- Skip reasons (unchanged + new):
--   already_owned | duplicate_new | error | out_of_scope

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
  v_actor_id   uuid := auth.uid();
  v_actor_name text;
  v_actor_team uuid;
  v_allowed    uuid[];   -- NULL = unrestricted (admin/operations/sales_director)
  v_to_name    text;
  v_moved      int := 0;
  v_skipped    jsonb := '[]'::jsonb;
  r            record;
BEGIN
  -- Actor identity + canonical (English-preferred) name for attribution.
  SELECT role, COALESCE(full_name_en, full_name_ar), team_id
    INTO v_actor_role, v_actor_name, v_actor_team
    FROM users WHERE id = v_actor_id;

  -- Authorization + scope. Same allowed roles as before, but managers/team-leaders
  -- are now constrained to their own team subtree instead of the whole company.
  IF v_actor_role IN ('admin','operations','sales_director') THEN
    v_allowed := NULL;                                    -- full reach
  ELSIF v_actor_role IN ('sales_manager','team_leader') THEN
    SELECT array_agg(id) INTO v_allowed FROM users
      WHERE team_id = v_actor_team
         OR team_id IN (SELECT id FROM departments WHERE parent_id = v_actor_team);
    v_allowed := COALESCE(v_allowed, ARRAY[]::uuid[]) || v_actor_id;
  ELSE
    RAISE EXCEPTION 'Not authorized: role=%', COALESCE(v_actor_role,'unknown');
  END IF;

  SELECT COALESCE(full_name_en, full_name_ar) INTO v_to_name FROM users WHERE id = p_to_user_id;
  IF v_to_name IS NULL THEN
    RAISE EXCEPTION 'Target user % not found', p_to_user_id;
  END IF;

  -- The single target applies to the whole batch, so reject an out-of-scope target
  -- outright rather than silently moving nothing.
  IF v_allowed IS NOT NULL AND NOT (p_to_user_id = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Target user % is outside your team scope', p_to_user_id;
  END IF;

  FOR r IN
    SELECT id, full_name, phone, assigned_to, assigned_to_name
    FROM contacts
    WHERE id = ANY(p_contact_ids) AND is_deleted IS NOT TRUE
  LOOP
    -- SCOPE GUARD: managers/team-leaders may only move leads currently owned by a
    -- member of their team subtree. Unowned (NULL) or other-team leads are skipped.
    IF v_allowed IS NOT NULL AND (r.assigned_to IS NULL OR NOT (r.assigned_to = ANY(v_allowed))) THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'contact_id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'reason', 'out_of_scope'));
      CONTINUE;
    END IF;

    -- Already with the target → nothing to do.
    IF r.assigned_to = p_to_user_id THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'contact_id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'reason', 'already_owned'));
      CONTINUE;
    END IF;

    -- Per-row savepoint: a failure here rolls back ONLY this row.
    BEGIN
      INSERT INTO activities (
        type, entity_type, contact_id, notes,
        user_id, user_name_en, from_user_id, to_user_id, status, created_at
      ) VALUES (
        'reassignment', 'contact', r.id,
        COALESCE(r.assigned_to_name,'—') || ' → ' || v_to_name,
        v_actor_id, COALESCE(v_actor_name, p_assigned_by_name), r.assigned_to, p_to_user_id, 'completed', NOW()
      );

      UPDATE contacts SET
        assigned_to       = p_to_user_id,
        assigned_to_name  = v_to_name,
        assigned_to_names = jsonb_build_array(v_to_name),
        assigned_by_name  = p_assigned_by_name,
        assigned_at       = NOW(),
        lead_category     = 'rotation',
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
