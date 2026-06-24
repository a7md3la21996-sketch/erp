-- Let a contact's CURRENT owner see its full activity history.
--
-- Problem: activities_select only let an agent see activities they created
-- (or a teammate created). So when a lead was reassigned/handed off to an agent
-- on another team (or any sales_agent), the new owner could NOT see the previous
-- agent's calls/notes on that lead — the history looked "lost" on reassign.
--
-- Fix: add one clause — you can see an activity if you currently own its contact.
-- Additive (OR), so it only WIDENS visibility; nothing that was visible becomes
-- hidden. The owner check is scoped to the activity's own contact_id.

ALTER POLICY activities_select ON public.activities
USING (
  is_admin()
  OR (user_id = auth.uid())
  OR (user_name_en = (SELECT full_name_en FROM public.users WHERE id = auth.uid()))
  OR (user_id = ANY (get_team_member_ids()))
  OR EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = activities.contact_id
      AND c.assigned_to = auth.uid()
  )
);
