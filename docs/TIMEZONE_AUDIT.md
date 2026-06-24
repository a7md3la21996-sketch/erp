# Timezone Audit — 2026-06-24

System mixes **UTC** (DB `now()`/`date_trunc`) with the **browser's local time** (Cairo UTC+2/+3) for day/month boundaries → off-by-hours / off-by-a-day bugs. **27 distinct spots.** No shared TZ helper exists; the org timezone setting (Africa/Cairo in Settings) is stored but **never used** in calculations. The follow-up chips fix (`followupDayBounds()` in ContactsPage + `get_followup_counts` RPC taking client boundaries) is the **gold-standard pattern** to replicate.

## 🔴 CRITICAL — touch money / core ops (do carefully, with verification)
- `services/payrollCalculator.js:186` — month-end via `new Date(y,m,0)` (payroll period boundaries).
- `services/kpiTargetsService.js:139-140` — `new Date(year, month-1, 1).toISOString()` month range → off ±2h, miss/double-count rows at month edge.
- `services/leaveService.js:134-140` — `calculateDays` = `Math.ceil(abs(end-start)/86400000)+1`; DST-fragile → wrong leave-balance deduction.
- `services/commissionInstallmentsService.js:32,185,201` — `autoMarkOverdue` + month-end use local-date-string vs UTC ISO → installments mis-flagged / month overflow.
- `services/remindersService.js:15-18` — "today" reminders via local-midnight ISO → miss reminders near midnight.

## 🟠 HIGH — reports / KPIs / task filters
- `services/dashboardService.js:144-147,182-187,200-206,226-231` — "this month" leads, closed-this-month, due-today, this-week activity (local midnight → UTC).
- `pages/TasksPage.jsx:522-540,553,604,982` — "today"/"overdue"/"week" filters; has a comment acknowledging the bug, not fully fixed.
- `services/reportsDataService.js:47-57` — this_month/quarter/year ranges.
- `services/analyticsService.js:175-195` — month/quarter/year ranges.

## 🟡 MEDIUM
- `pages/ActivitiesPage.jsx:163,191-194,276-281` — today/week/month activity filters.
- `services/attendanceService.js:39-41,138-141` — month range via `new Date(year,month,0)`.
- `services/heatmapService.js:44-54` — month cutoff + `toISOString().slice(0,10)` date key.
- `services/birthdayService.js:13` — today via UTC slice.
- `services/scheduleReportService.js:92-109` — next-run boundaries.
- `pages/ContractsPage.jsx:91` — diffDays.
- `services/contactsService.js:320-321` — last_7/last_30 (relative, mostly safe).

## ✅ Already correct
- `pages/ContactsPage.jsx` `followupDayBounds()` + `get_followup_counts` RPC — client computes local boundaries, passes to RPC. **Use this pattern everywhere.**
- DB schema (`timestamptz` + `now()` defaults, `date_trunc` indexes) — UTC-correct; the problem is client boundary math, not storage.

## Recommended fix
1. **Shared helper** `src/utils/dateTime.js` — `dayBounds()`, `monthBounds(year,month)`, `calendarDaysBetween()` computed in the org timezone (or browser-local), returned as ISO timestamps to pass to queries/RPCs.
2. Replace the raw `new Date().setHours()` / `new Date(y,m,...)` boundary math with the helper, file by file.
3. **Phase the money-critical ones** (payroll/leave/commissions) separately, with verification against a real payroll run — do NOT change blindly.
