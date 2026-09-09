-- ═══════════════════════════════════════════════════════════════════════
-- SECURITY FIX — fail-closed team scope
-- ═══════════════════════════════════════════════════════════════════════
-- BUG: get_team_member_ids/names expand scope from the caller's team_id. When
-- that team_id points at a ROOT department (parent_id IS NULL) — i.e. the
-- org-level "Sales"/"Operations" container, NOT a real team — the caller ends
-- up sharing scope with EVERYONE parked on that root. A team_leader created
-- without a real team (left on the Sales root) therefore saw the whole system.
--
-- ROOT of the flaw: access is INFERRED from position in the org tree, and the
-- tree's root = everything, so a misplaced row silently over-grants (fail-open).
--
-- FIX (fail-closed): a root department is never a real team. Anyone scoped to
-- one falls back to SELF ONLY. Deny-by-default instead of grant-by-position.
-- No legitimate manager/leader is on a root dept (verified), so nothing breaks.
--
-- Run this ENTIRE file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_team_member_ids()
RETURNS uuid[] AS $$
DECLARE
  _role text;
  _team_id uuid;
  _team_ids uuid[];
BEGIN
  SELECT role, team_id INTO _role, _team_id FROM public.users WHERE id = auth.uid();
  IF _role = 'admin' OR _role = 'operations' THEN
    RETURN NULL; -- NULL means no filter (see all)
  END IF;
  IF _team_id IS NULL THEN
    RETURN ARRAY[auth.uid()];
  END IF;
  -- FAIL-CLOSED: a ROOT department (parent_id IS NULL) is an org container, not
  -- a real team. Being scoped to it must NOT grant visibility over everyone
  -- parked on the root. Treat as "no team" -> self only.
  IF EXISTS (SELECT 1 FROM public.departments d WHERE d.id = _team_id AND d.parent_id IS NULL) THEN
    RETURN ARRAY[auth.uid()];
  END IF;
  _team_ids := ARRAY[_team_id];
  IF _role = 'sales_manager' THEN
    SELECT array_agg(id) INTO _team_ids FROM public.departments WHERE parent_id = _team_id OR id = _team_id;
  END IF;
  RETURN (SELECT array_agg(id) FROM public.users WHERE team_id = ANY(_team_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_team_member_names()
RETURNS text[] AS $$
DECLARE
  _role text;
  _team_id uuid;
  _team_ids uuid[];
BEGIN
  SELECT role, team_id INTO _role, _team_id FROM public.users WHERE id = auth.uid();
  IF _role = 'admin' OR _role = 'operations' THEN
    RETURN NULL;
  END IF;
  IF _team_id IS NULL THEN
    RETURN (SELECT ARRAY[full_name_en] FROM public.users WHERE id = auth.uid());
  END IF;
  -- FAIL-CLOSED: root department -> self only (see note above).
  IF EXISTS (SELECT 1 FROM public.departments d WHERE d.id = _team_id AND d.parent_id IS NULL) THEN
    RETURN (SELECT ARRAY[full_name_en] FROM public.users WHERE id = auth.uid());
  END IF;
  _team_ids := ARRAY[_team_id];
  IF _role = 'sales_manager' THEN
    SELECT array_agg(id) INTO _team_ids FROM public.departments WHERE parent_id = _team_id OR id = _team_id;
  END IF;
  RETURN (SELECT array_agg(full_name_en) FROM public.users WHERE team_id = ANY(_team_ids) AND full_name_en IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
