# Leads Page — Follow-up / Work-Tracking Plan

**Date:** 2026-06-08
**Page:** `/contacts` (`src/pages/ContactsPage.jsx`)
**Problem:** The page is a *data browser*, not a *work queue*. Follow-up data (next task due, overdue, due-today) already exists in the data but is locked in filters + the drawer — never surfaced per-row, never drives prioritization. A rep can't open the page and immediately know "who do I act on now"; a manager can't see team follow-through health.

**Source of truth for "next action":** the `tasks` table (pending tasks with `due_date`, linked by `contact_id`). This is what the existing Overdue/Today quick filters already query (`ContactsPage.jsx:985-1028`). `activities.next_action_date` (set by LogCallModal) is a secondary/legacy signal; we standardize on `tasks`.

---

## Shared data foundation

### New RPC: `get_next_followup_per_contact(p_contact_ids uuid[])`
Batched, `SECURITY INVOKER` (RLS scopes which tasks are visible — sales_agent sees own, manager sees team), mirrors the existing `get_latest_feedback_per_contact` / `get_contact_opp_counts` pattern.

Returns one row per contact:
| col | meaning |
|---|---|
| `contact_id` | uuid |
| `next_due` | earliest `due_date` among pending tasks for this contact |
| `overdue_count` | pending tasks with `due_date < now()` |
| `pending_count` | all pending tasks |

Migration: `supabase/migrations/next_followup_per_contact.sql` (must be applied to DB).

---

## Phase 1 — Per-row "Next Action" (rep keystone) ⭐
*Unlocks every other phase.*

1. Add the RPC above + migration.
2. In `loadContactsData` (`ContactsPage.jsx`), after the existing non-blocking feedback/opp-count fetches (~line 1296-1322), add a chunked call to `get_next_followup_per_contact(ids)` → merge `_nextFollowup = { next_due, overdue_count, pending_count }` onto each contact in state.
3. New presentational `NextActionCell` (in `crm/contacts/constants.jsx` or a small component):
   - `overdue_count > 0` → 🔴 `متأخرة (N يوم)` (red) — N = days overdue of `next_due`
   - else `next_due` is today → 🟡 `النهاردة` (amber)
   - else `next_due` future → ⚪ `بكرة` / `بعد N يوم`
   - else no pending task → subtle clickable `— حدد متابعة`
4. Render the column in `ContactsTable.jsx` (between Last Feedback and Actions) + a compact line in `ContactsCardList.jsx`.
5. Click on the badge/`حدد متابعة` → opens `QuickTaskModal` prefilled for that contact.

**Effort:** 1 RPC (DB apply needed) + frontend column. **Risk:** low (established pattern).

---

## Phase 2 — Priority sort + "My Work Queue" (#2 + #3)

6. **"قائمة شغلي / يومي"** button near the status chips (rep-facing). v1 reuses the existing ID-set plumbing (no new RPC):
   - Union of `overdueContactIds` + `todayFollowupIds` + (hot & stale), set as `contactIds`, sorted by `next_due` ASC.
   - Empty-state when clear: "مفيش متابعات متأخرة 🎉 — ابدأ يومك".
   - Note: bounded by the existing 300-cap in `fetchContacts` (#5). A rep's daily queue is normally < 300, so acceptable for v1; full-list priority needs the deferred server-side work.
7. **Priority sort option** `priority` in `useContactsFilters`. True composite sort (overdue → today → hot+stale → score) across the *whole* paginated list needs a dedicated `get_leads_work_queue(filters, page)` RPC, because task `due_date` isn't a `contacts` column. **Decision:** ship the Work-Queue *view* (#6, bounded, frontend-only) first; defer full-list priority sort to the same DB session as #5/C-3.

**Effort:** #6 frontend-only (low); #7 deferred (needs RPC).

---

## Phase 3 — Inline reschedule + QuickAction scheduling (#4)

8. Per-row **"أجّل"** on the next-action badge → mini date popover (بكرة / ٣ أيام / أسبوع / تاريخ) → updates the pending task's `due_date` (or creates one if none). Service: `tasksService.rescheduleNextFollowup(contactId, newDate)`.
9. Make `QuickActionPopover` schedule a follow-up like `LogCallModal` does. Today the popover saves an activity but leaves the lead with **no next step** (only LogCall auto-creates a task for no_answer/busy). Extract a shared `createFollowupTask` helper and call it from both.

**Effort:** small service + frontend. **Risk:** low-medium.

---

## Phase 4 — Manager / TL oversight (#both)

10. **Team follow-up health strip** on the page header (role = manager/TL/admin, when no single agent is already selected): per-agent `متأخرة` count + `ليدز باظت (hot+stale)`, each click-through filters the list to that agent. Backed by a small RPC `get_followup_health_by_agent` (team-scoped) — or fold into an extended `get_contact_stats`.
11. Manager filter/sort: "أقدم متابعة متأخرة" + "ليدز عليها متابعة متأخرة" (the Overdue quick filter already role-scopes; surface it for managers per-agent).

**Effort:** 1 RPC + header strip. **Risk:** medium.

---

## Sequencing
1. **Phase 1** (keystone — per-row next action) → biggest single jump in usability.
2. **Phase 2 #6** (Work Queue view — frontend only).
3. **Phase 3** (inline reschedule + QuickAction scheduling).
4. **Phase 4** (manager oversight).
5. Defer to the DB session with #5/C-3: full-list priority sort RPC (`get_leads_work_queue`) + server-side include/exclude.

## DB-apply checklist
- `get_next_followup_per_contact` (Phase 1)
- `get_followup_health_by_agent` (Phase 4)
- `get_leads_work_queue` (deferred full-list priority)
