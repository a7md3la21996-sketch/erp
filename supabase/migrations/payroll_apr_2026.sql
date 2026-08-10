-- ════════════════════════════════════════════════════════════════════
-- Payroll April 2026 — manual reconciliation
-- ════════════════════════════════════════════════════════════════════
-- This script:
--   1. Adds Sham El-Nessim 2026-04-13 to holidays
--   2. Marks Wael Ghaly (term 4/19) and Nesreen (term 4/12) inactive
--   3. Inserts payroll_run for April 2026
--   4. Inserts payroll_items for the 4 employees we calculated this session:
--        Ahmed Adel · Wael Ghaly · Nesreen · Sara Ramadan
--   5. Records Sara's 1-day annual leave debit (4/19)
--
-- Run via Supabase SQL Editor. The DO block looks up employee IDs by
-- name; verify the matches before committing if names differ.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Public holidays ─────────────────────────────────────────────
INSERT INTO holidays (date, name_ar, name, type)
VALUES ('2026-04-13', 'شم النسيم', 'Sham El-Nessim', 'holiday')
ON CONFLICT (date) DO NOTHING;

-- ── 2. Mark leavers inactive ───────────────────────────────────────
UPDATE employees
SET status = 'inactive', is_active = false, termination_date = '2026-04-19'
WHERE full_name_ar ILIKE '%وائل%غالي%' OR full_name_en ILIKE '%wael%ghaly%';

UPDATE employees
SET status = 'inactive', is_active = false, termination_date = '2026-04-12'
WHERE full_name_ar ILIKE '%نسرين%' OR full_name_en ILIKE '%nesreen%' OR full_name_en ILIKE '%nasreen%';

-- ── 3 & 4. Insert payroll run + items ──────────────────────────────
DO $$
DECLARE
  v_run_id      uuid;
  v_ahmed_id    uuid;
  v_wael_id     uuid;
  v_nesreen_id  uuid;
  v_sara_id     uuid;
BEGIN
  -- Look up employees by name (adjust the LIKE patterns if your data differs)
  SELECT id INTO v_ahmed_id   FROM employees WHERE full_name_ar ILIKE '%أحمد%عادل%' OR full_name_en ILIKE '%ahmed%adel%' LIMIT 1;
  SELECT id INTO v_wael_id    FROM employees WHERE full_name_ar ILIKE '%وائل%غالي%' OR full_name_en ILIKE '%wael%ghaly%' LIMIT 1;
  SELECT id INTO v_nesreen_id FROM employees WHERE full_name_ar ILIKE '%نسرين%'   OR full_name_en ILIKE '%nesreen%' OR full_name_en ILIKE '%nasreen%' LIMIT 1;
  SELECT id INTO v_sara_id    FROM employees WHERE full_name_ar ILIKE '%سارة%رمضان%' OR full_name_en ILIKE '%sara%ramadan%' LIMIT 1;

  IF v_ahmed_id   IS NULL THEN RAISE EXCEPTION 'Ahmed Adel not found';   END IF;
  IF v_wael_id    IS NULL THEN RAISE EXCEPTION 'Wael Ghaly not found';   END IF;
  IF v_nesreen_id IS NULL THEN RAISE EXCEPTION 'Nesreen not found';      END IF;
  IF v_sara_id    IS NULL THEN RAISE EXCEPTION 'Sara Ramadan not found'; END IF;

  -- Upsert the April 2026 run
  INSERT INTO payroll_runs (
    month, year, run_date, total_employees,
    total_gross, total_deductions, total_net,
    status, notes, created_at
  )
  VALUES (
    4, 2026, NOW(), 4,
    13200 + 11400 + 4000 + 10000,  -- 38,600
    2185 + 2916 + 775 + 291,        -- 6,167
    11015 + 8484 + 3225 + 9709,     -- 32,433
    'completed',
    'Manual reconciliation — May 2026 session: 4 employees with bespoke rules (Sham El-Nessim, terminations, Sara ×1 late, Saturday sales pattern, single-punch 2.5d, half-day, leave-balance debit)',
    NOW()
  )
  ON CONFLICT (month, year) DO UPDATE
    SET total_employees   = EXCLUDED.total_employees,
        total_gross       = EXCLUDED.total_gross,
        total_deductions  = EXCLUDED.total_deductions,
        total_net         = EXCLUDED.total_net,
        notes             = EXCLUDED.notes
  RETURNING id INTO v_run_id;

  -- Clear any prior items for this run before reinserting
  DELETE FROM payroll_items WHERE run_id = v_run_id;

  -- ── Ahmed Adel: 13,200 base · -2,185 deductions · 11,015 net ─────
  -- Salary changed mid-month (15k → 12k from 4/13)
  -- 147 late min · 409 early-leave min · 11 single-punch days (=2.5d) · 1 absence
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary, allowances,
    tax, social_insurance, late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes,
    notes, created_at
  ) VALUES (
    v_run_id, v_ahmed_id, 'أحمد عادل',
    13200, 0, 0, 0,
    270, 440,
    0, 0, 0, 1475,  -- early-leave 375 + single-punch 1100
    2185, 11015,
    18, 1, 147, 0,
    'Pro-rated salary 15k→12k at 4/13. Sales Saturday pattern (4/4,4/18 leave; 4/11 absent w/notice; 4/25 worked). 4/13 Sham El-Nessim. Single-punch deduction 2.5d for 10 incomplete days.',
    NOW()
  );

  -- ── Wael Ghaly: 11,400 base (19/30 days) · -2,916 deductions · 8,484 net ──
  -- Terminated 4/19 · 308 late min · 157 early-leave min · 4/5 quarter day · 3 absences
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary, allowances,
    tax, social_insurance, late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes,
    notes, created_at
  ) VALUES (
    v_run_id, v_wael_id, 'وائل غالي',
    11400, 0, 0, 0,
    770, 1800,
    0, 0, 0, 346,  -- early-leave 196 + quarter-day 4/5 = 150
    2916, 8484,
    13, 3, 308, 0,
    'Terminated 2026-04-19. Pro-rated 19/30 days. 4/5 single punch at 14:58 = quarter-day deduction. Sales Saturday: 4/11 absent (work day). No end-of-service benefits.',
    NOW()
  );

  -- ── Nesreen: 4,000 base (12/30 days) · -775 deductions · 3,225 net ──
  -- Terminated 4/12 · 78 late min · 2 absences
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary, allowances,
    tax, social_insurance, late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes,
    notes, created_at
  ) VALUES (
    v_run_id, v_nesreen_id, 'نسرين',
    4000, 0, 0, 0,
    108, 667,
    0, 0, 0, 0,
    775, 3225,
    8, 2, 78, 0,
    'Terminated 2026-04-12. Pro-rated 12/30 days. Sales Saturday: 4/11 absent (work day). No end-of-service benefits.',
    NOW()
  );

  -- ── Sara Ramadan: 10,000 base · -291 deductions · 9,709 net ─────
  -- Special: late multiplier ×1 (not ×2). 4/19 absence taken from annual leave balance.
  -- 163 late min (4/21 only) · 16 early-leave min · 4/2 half-day · 4/26-30 treated as normal days
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary, allowances,
    tax, social_insurance, late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes,
    notes, created_at
  ) VALUES (
    v_run_id, v_sara_id, 'سارة رمضان',
    10000, 0, 0, 0,
    113, 0,
    0, 0, 0, 178,  -- half-day 4/2 = 167 + early-leave 11
    291, 9709,
    20, 0, 163, 0,
    'All Saturdays leave (not sales). Late multiplier ×1 (not ×2). 4/2 half-day (left 13:57). 4/19 absence debited from annual leave balance, NOT from salary. 4/26-30 came 9-5 (treated as normal full days).',
    NOW()
  );

  RAISE NOTICE 'Payroll run April 2026 created with id %', v_run_id;
END $$;

-- ── 5. Sara's leave balance debit (1 day for 4/19) ─────────────────
-- Adjust the table/column names below if your leave-balance schema differs.
-- Common patterns:
--   employee_leave_balances(employee_id, year, leave_type, used_days, ...)
--   leave_requests(employee_id, start_date, end_date, type, status, ...)
--
-- This block writes a leave_request record so the day shows up in her
-- history. If your project uses employee_leave_balances directly, change
-- to an UPDATE on that table.
DO $$
DECLARE
  v_sara_id uuid;
BEGIN
  SELECT id INTO v_sara_id FROM employees
  WHERE full_name_ar ILIKE '%سارة%رمضان%' OR full_name_en ILIKE '%sara%ramadan%' LIMIT 1;

  IF v_sara_id IS NULL THEN
    RAISE NOTICE 'Sara not found — skipping leave debit';
    RETURN;
  END IF;

  -- Insert leave request for the 4/19 absence (best-effort; ignore if table absent)
  BEGIN
    INSERT INTO leave_requests (
      employee_id, start_date, end_date, leave_type, status,
      days_count, reason, created_at
    ) VALUES (
      v_sara_id, '2026-04-19', '2026-04-19', 'annual', 'approved',
      1, 'Approved annual leave — debited from balance instead of salary deduction', NOW()
    );
    RAISE NOTICE 'Sara leave request inserted for 2026-04-19';
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE 'leave_requests table/columns differ — please debit Sara 1 day manually from her leave balance';
  END;
END $$;
