# Replace Opportunities with Deal-Events (implementation plan)

## Goal
Retire the heavyweight **opportunity pipeline** (rep must create an opp, then manually advance stages — proven friction: 1082 opps stuck in `qualification`). Replace with **concrete one-click actions on the lead drawer** (Log meeting / Log reservation / Log contract / Log won sale / Log lost). Simpler + faster for sales; the system derives the funnel so managers keep their reporting.

## Core design decisions
1. **`deals` is the money record** (already exists, 110 rows, has `status`, `deal_value`, `unit_code`, `down_payment`, `installments_count`, `contact_id`, `opportunity_id`, `assigned_to`, `project`, `developer`, `notes`). ONE deal per lead, advancing by state.
2. **State machine on `deals.status`:** `reserved → contracted → won` (+ `lost`). Each drawer action advances it; the rep never sees "stages".
3. **Interaction vs money — keep separate:**
   - meeting/call/whatsapp/note = **activities** (already in the timeline; "Log meeting" stays an activity).
   - reservation/contract/won/lost = **deal states** (structured, feed commission + revenue).
4. **`has_opportunity` becomes DERIVED** — a lead with an active deal (reserved/contracted/won) is flagged automatically by a trigger. This permanently kills the sync gap we fought today.
5. **Opportunities data is preserved** (archived + backfilled), never hard-deleted — 27+ files/RPCs/reports read it.

## Dependency surface (must repoint before retiring opps)
Reads `opportunities`: CrmDashboard, DashboardPage, SalesForecastPage, PerformancePage, reportsDataService, kpiTargetsService, GlobalSearch/GlobalFilter, MasterLeadsPage, ContactDrawer, ContactsPage (stage chips), + RPCs `get_campaign_stats_rpc`, `add_contact_opp_counts_rpc`, `permanent_delete_contact_rpc`, RLS. dealsService already parallel (`createDealFromContact`, `getWonDeals`, `createDealFromOpportunity`, `dealExistsForOpportunity`).

---

## Phases (additive first; deliver rep value early, migrate reporting last)

### Phase 0 — model + vocabulary (no data change)
- Confirm/define `deals.status` values: `reserved`, `contracted`, `won`, `lost` (check what the 110 existing rows use; add a CHECK or keep flexible).
- Add any missing light fields to `deals` if needed: `reserved_at`, `contracted_at`, `won_at`, `lost_reason` (event timestamps for the funnel). Additive columns only.
- Decide "one active deal per lead" rule (partial unique index on `contact_id` where status in active set).

### Phase 1 — drawer actions (ADDITIVE, ship first — this is the rep win)
- In ContactDrawer, add concrete buttons: **Log reservation · Log contract · Log won · Log lost** (Log meeting already exists as an activity).
- Each writes/advances the lead's `deals` row via dealsService (reuse `createDealFromContact` + a new `advanceDeal(contactId, toStatus, fields)`); light inline form for unit/value where relevant (reuse DealClosingWizard for "won").
- Also drop a timeline activity (`deal_event`) so the milestone shows in the clean timeline.
- Keep the old opp flow working in parallel (no removal yet). Optionally admin/pilot-first.

### Phase 2 — derive has_opportunity (kills the sync gap)
- Trigger on `deals`: when a lead gets an active deal → set `contacts.contact_status = 'has_opportunity'` (unless disqualified). When the deal goes lost/removed and no other active deal → revert. Replaces the broken manual sync.
- Backfill contact_status from current active deals once.

### Phase 3 — backfill opportunities → deals (careful, previewed, reversible)
- Governance per [[bulk-data-ops-governance]]: full backup of `opportunities` + `deals` first.
- Map opps → deals: `closed_won`→won, `contracted`→contracted, `reserved`→reserved, `negotiation`/`site_visit*`→reserved-or-active (decide), using `dealExistsForOpportunity` to avoid duplicating the 110 existing deals (linked by `opportunity_id`).
- **qualification (1082) = junk stubs** → do NOT migrate; archive/soft-flag. (Separately: the 55+ orphan opps on the 2026-06-29 deleted dups — reparent-or-drop, see [[data-cleanup-2026-07]].)
- Audit every write.

### Phase 4 — repoint reporting (the bulk of the work)
- Migrate dashboards/forecast/reports/RPCs from `opportunities` → `deals` (funnel = deals.status; expected revenue = active deals' deal_value; win rate = won/total). Do one consumer at a time, verify numbers against the old view before switching.

### Phase 5 — retire opportunities
- Stop creating opps everywhere (ContactDrawer deal wizard already writes deals; remove opp-creation paths in BulkModals/BulkActionToolbar/AddContactModal/distribute/handoff).
- Fully hide the Opportunities page/menu (already hidden).
- Archive the `opportunities` table (rename/read-only), don't drop — keep for history.

---

## Effort / risk
- **Big, multi-step** — but front-loaded value: Phase 1 (drawer actions) delivers the rep simplicity immediately and is low-risk (additive). Phase 4 (reporting repoint) is the largest and riskiest — do it consumer-by-consumer with number-parity checks.
- **Reversible**: additive columns + archived (not dropped) opportunities. has_opportunity derivation replaces a broken manual process, so it's strictly better.

## Recommendation
Ship Phase 1 first (concrete drawer actions on top of `deals`) so sales feels the win, and Phase 2 (derived has_opportunity) right after — those two alone fix the friction AND the sync gap. Then backfill (3) and migrate reporting (4) deliberately. Retire opps (5) only once reporting is fully repointed.
