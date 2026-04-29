-- =============================================================
-- Migration: UUID Auto-Resolve Triggers (Phase 0.5)
-- Purpose: Auto-populate assigned_to UUID from name on INSERT/UPDATE
--          + auto-set created_by from auth.uid()
-- Depends: users table populated, name conventions consistent
-- Date: 2026-04-28
-- =============================================================

-- 1. Function: resolve assigned_to from name (works for any table with assigned_to_name col)
CREATE OR REPLACE FUNCTION public.auto_resolve_assigned_to()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to_name IS NOT NULL AND NEW.assigned_to IS NULL THEN
    SELECT id INTO NEW.assigned_to
    FROM public.users
    WHERE full_name_en = NEW.assigned_to_name
       OR full_name_ar = NEW.assigned_to_name
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Function: resolve assigned_to for opportunities (also checks agent_name)
CREATE OR REPLACE FUNCTION public.auto_resolve_assigned_to_opps()
RETURNS TRIGGER AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    candidate := COALESCE(NEW.assigned_to_name, NEW.agent_name);
    IF candidate IS NOT NULL THEN
      SELECT id INTO NEW.assigned_to
      FROM public.users
      WHERE full_name_en = candidate
         OR full_name_ar = candidate
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Function: resolve assigned_to for deals (uses agent_en / agent_ar)
CREATE OR REPLACE FUNCTION public.auto_resolve_assigned_to_deals()
RETURNS TRIGGER AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    candidate := COALESCE(NEW.agent_en, NEW.agent_ar);
    IF candidate IS NOT NULL THEN
      SELECT id INTO NEW.assigned_to
      FROM public.users
      WHERE full_name_en = candidate
         OR full_name_ar = candidate
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Function: auto-set created_by from auth.uid() on INSERT
CREATE OR REPLACE FUNCTION public.auto_set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================
-- TRIGGERS — apply functions to tables
-- =============================================================

-- contacts: assigned_to + created_by
DROP TRIGGER IF EXISTS trg_auto_resolve_assigned_to_contacts ON public.contacts;
CREATE TRIGGER trg_auto_resolve_assigned_to_contacts
  BEFORE INSERT OR UPDATE OF assigned_to_name, assigned_to ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_assigned_to();

DROP TRIGGER IF EXISTS trg_auto_set_created_by_contacts ON public.contacts;
CREATE TRIGGER trg_auto_set_created_by_contacts
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_created_by();

-- opportunities: assigned_to (resolves from assigned_to_name OR agent_name)
DROP TRIGGER IF EXISTS trg_auto_resolve_assigned_to_opps ON public.opportunities;
CREATE TRIGGER trg_auto_resolve_assigned_to_opps
  BEFORE INSERT OR UPDATE OF assigned_to_name, agent_name, assigned_to ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_assigned_to_opps();

DROP TRIGGER IF EXISTS trg_auto_set_created_by_opps ON public.opportunities;
CREATE TRIGGER trg_auto_set_created_by_opps
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_created_by();

-- deals: assigned_to (resolves from agent_en OR agent_ar)
DROP TRIGGER IF EXISTS trg_auto_resolve_assigned_to_deals ON public.deals;
CREATE TRIGGER trg_auto_resolve_assigned_to_deals
  BEFORE INSERT OR UPDATE OF agent_en, agent_ar, assigned_to ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_assigned_to_deals();

-- =============================================================
-- VERIFICATION queries (run after creating triggers)
-- =============================================================

-- Verify all triggers exist:
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
-- WHERE trigger_schema = 'public' AND trigger_name LIKE 'trg_auto_%' ORDER BY event_object_table;

-- Test (in SQL Editor — DOES NOT modify data):
-- SELECT public.auto_resolve_assigned_to();  -- should fail (needs trigger context)

-- Smoke test: insert a temp contact and check UUID auto-fills
-- BEGIN;
-- INSERT INTO contacts (full_name, phone, department, contact_type, assigned_to_name)
-- VALUES ('TEST_DELETE_ME', '+999999999', 'sales', 'lead', 'Mamdouh');
-- SELECT id, assigned_to_name, assigned_to FROM contacts WHERE full_name = 'TEST_DELETE_ME';
-- ROLLBACK;
