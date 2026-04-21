-- Atomic permanent-delete for a contact and all its related rows.
-- Runs inside a single transaction: if any step fails, the whole delete rolls back,
-- avoiding orphaned opportunities/activities/tasks/reminders.
--
-- Apply: run this once against your Supabase Postgres.
-- Call from JS: supabase.rpc('permanent_delete_contact', { p_contact_id: id })

CREATE OR REPLACE FUNCTION public.permanent_delete_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER   -- respect caller's RLS (admin/sales_manager per contacts_delete policy)
AS $$
BEGIN
  -- Related records first (FK-safe order)
  DELETE FROM public.opportunities WHERE contact_id = p_contact_id;
  DELETE FROM public.activities    WHERE contact_id = p_contact_id;
  DELETE FROM public.tasks         WHERE contact_id = p_contact_id;
  DELETE FROM public.reminders     WHERE entity_id  = p_contact_id;
  -- Contact itself
  DELETE FROM public.contacts      WHERE id         = p_contact_id;
END;
$$;

-- Allow authenticated users to invoke (the function itself respects RLS on the DELETE
-- statements via SECURITY INVOKER, so users without delete permission will still fail).
GRANT EXECUTE ON FUNCTION public.permanent_delete_contact(uuid) TO authenticated;
