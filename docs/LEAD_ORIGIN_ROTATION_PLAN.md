# Lead Origin vs Rotation — Radical Split (implementation plan)

## Problem
`contacts.lead_category` conflates two independent axes:
1. **Origin** — where the lead came from (fresh inbound / distributed batch / cold call). *Permanent by nature* (the config even says so).
2. **Freshness / rotation state** — is it a brand-new lead or one that's been passed around. *Dynamic by nature.*

Because both live in one column, every owner→owner reassignment **overwrites the origin** with `'rotation'` (`contactsService.js:646-647`). So a genuinely fresh lead that's reassigned after 30 min (because agent #1 was slow) is mislabeled `rotation`, inflating rotation numbers and hiding that it's still a hot fresh lead.

## Fix: split the two axes
- **Origin** stays in `lead_category`, becomes **immutable** (set once at creation, never auto-overwritten). Values: `fresh` (default inbound), `distributed`, `cold_calls` (+ room for `campaign`/`website`). `rotation` is **removed** from origins.
- **Rotation** becomes a **stored counter** `reassign_count int` (0 = fresh, >0 = rotated), bumped on each real reassignment. "Rotation" is now a derived state, not a category that destroys origin.

Why a stored counter (not derive from activities): the Leads filters + count RPCs need it cheaply; we already increment on the same code path that currently mis-writes `lead_category`.

---

## Touchpoints (grounded)
- **Writes** `contactsService.js`: default `'fresh'` (L402, keep), reassign→`'rotation'` (L647, **redirect**), hand-off→`'rotation'` (L864, **redirect**), distribute→`'distributed'` (L964, keep — distribution *is* an origin).
- **Reassignment already logged** as `activities.type='reassignment'` (recordAssignment L90) → used to backfill the counter.
- **Reads/UI**: `config/leadCategories.js`, `ContactsPage.jsx` (category chips + filter + counts), `ContactsTable.jsx` (badge), `EditContactModal.jsx` (editable dropdown), `CrmDashboardPage.jsx` (fresh+new lens), `BulkActionToolbar.jsx` (category change).
- **RPCs** grouping by `lead_category`: `get_lead_category_counts_rpc`, `get_contact_stats_lead_category`, `get_followup_counts_lead_category`, `get_per_agent_breakdown`, `get_duplicate_leads`, `reassign_contacts_smart`.

---

## Phases (expand → migrate → contract; governance per bulk-data-ops rules: backup + preview + audit)

### Phase 0 — add the state column (additive, invisible, reversible)
- Migration: `ALTER TABLE contacts ADD COLUMN reassign_count int NOT NULL DEFAULT 0;` + partial index for the "rotated" filter.
- Backfill `reassign_count` = count of `activities.type='reassignment'` per contact (preview counts first).
- Reversible: `DROP COLUMN`. No UI change yet.

### Phase 1 — redirect the write (stop corrupting origin)
- `contactsService.js`: on reassign/hand-off, bump `reassign_count` instead of setting `lead_category='rotation'`. Leave `lead_category` untouched. Distribute keeps writing `'distributed'` at creation.
- **One-time data decision (irreversible-ish):** existing leads currently tagged `lead_category='rotation'` have already LOST their true origin. Best recovery = reset them to `'fresh'` (the default) since we can't recover the original from history. Preview the count, confirm, mark in audit_logs.

### Phase 2 — two-axis UI + RPCs
- `leadCategories.js`: origins = `fresh`/`distributed`/`cold_calls` (drop `rotation`; optionally add `campaign`/`website`).
- Leads page: origin chips from `lead_category` **plus** a separate **"Rotation"** filter/toggle from `reassign_count > 0`. Counts: add a rotation count (WHERE reassign_count>0) alongside the origin counts (new/updated RPC).
- `ContactsTable` badge: origin badge + a small `↻` "rotated (Nx)" indicator when `reassign_count>0`.
- `EditContactModal`: origin dropdown editable; rotation shown read-only (derived).
- Drawer: label `lead_category` = "الأصل/Origin"; show rotation state separately.

### Phase 3 — contract
- Remove the old rotation-overwrite paths entirely.
- Optionally add a CHECK constraint so `lead_category` can't be `'rotation'` anymore (guards regressions).

---

## Effort / risk
- **Effort:** medium. Phase 0-1 small (1 migration + ~3 code edits). Phase 2 is the bulk (RPCs + chips/badge/filter). Phase 3 tiny.
- **Risk:** low-medium. Additive column is safe; the only lossy step is resetting already-mislabeled `rotation` leads to `fresh` (Phase 1) — their true origin is already gone, so this is cleanup, not new loss.
- **Backwards compatible** during 0-1: nothing reads the new column yet, old UI keeps working.

## Recommendation
Do Phase 0 now (safe, sets up everything), then 1, then 2 in a DB-capable session with previews. Rotation becomes accurate, and fresh leads stay fresh no matter how many times they're reassigned.
