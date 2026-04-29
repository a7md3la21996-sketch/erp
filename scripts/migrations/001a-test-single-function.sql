-- TEST: Run this FIRST to make sure CREATE FUNCTION works
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

-- Verify it was created
SELECT proname FROM pg_proc WHERE proname = 'auto_resolve_assigned_to';
