-- ════════════════════════════════════════════════════════════════════
-- Payroll April 2026 — Part 2: 9 employees from prior session
-- ════════════════════════════════════════════════════════════════════
-- Adds 9 more employees to the April 2026 run created earlier:
--   Nawar · عبدالرحمن أيمن · ندى هاني · شهد · خالد صدقي
--   محمد إبراهيم (terminated 4/15) · جنا (terminated 4/15)
--   ممدوح · فرح
--
-- Then updates the run totals to reflect all 13 employees.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Mark mid-month leavers inactive ────────────────────────────
UPDATE employees
SET status = 'inactive', is_active = false, termination_date = '2026-04-15'
WHERE full_name_ar ILIKE '%محمد%إبراهيم%' OR full_name_en ILIKE '%mohamed%ibrahim%' OR full_name_en ILIKE '%mohammed%ibrahim%';

UPDATE employees
SET status = 'inactive', is_active = false, termination_date = '2026-04-15'
WHERE full_name_ar = 'جنا' OR full_name_ar ILIKE 'جنا %' OR full_name_en ILIKE 'jana%' OR full_name_en ILIKE 'janna%';

-- ── 2. Insert 9 payroll items + update run totals ─────────────────
DO $$
DECLARE
  v_run_id          uuid;
  v_nawar_id        uuid;
  v_abdulrahman_id  uuid;
  v_nada_id         uuid;
  v_shahd_id        uuid;
  v_khaled_id       uuid;
  v_mohamed_id      uuid;
  v_jana_id         uuid;
  v_mamdouh_id      uuid;
  v_farah_id        uuid;
BEGIN
  -- Find the existing run
  SELECT id INTO v_run_id FROM payroll_runs WHERE month = 4 AND year = 2026 LIMIT 1;
  IF v_run_id IS NULL THEN RAISE EXCEPTION 'April 2026 payroll run not found — run part 1 first'; END IF;

  -- Look up employees
  SELECT id INTO v_nawar_id       FROM employees WHERE full_name_ar ILIKE '%nawar%' OR full_name_en ILIKE '%nawar%' OR full_name_ar ILIKE '%نوار%' LIMIT 1;
  SELECT id INTO v_abdulrahman_id FROM employees WHERE full_name_ar ILIKE '%عبد%الرحمن%أيمن%' OR full_name_ar ILIKE '%عبدالرحمن%أيمن%' OR full_name_en ILIKE '%abdul%rahman%ayman%' OR full_name_en ILIKE '%abdelrahman%ayman%' LIMIT 1;
  SELECT id INTO v_nada_id        FROM employees WHERE full_name_ar ILIKE '%ندى%هاني%' OR full_name_en ILIKE '%nada%hany%' OR full_name_en ILIKE '%nada%hani%' LIMIT 1;
  SELECT id INTO v_shahd_id       FROM employees WHERE full_name_ar ILIKE '%شهد%' OR full_name_en ILIKE '%shahd%' OR full_name_en ILIKE '%shahed%' LIMIT 1;
  SELECT id INTO v_khaled_id      FROM employees WHERE full_name_ar ILIKE '%خالد%صدقي%' OR full_name_en ILIKE '%khaled%sed%' OR full_name_en ILIKE '%khaled%sidky%' LIMIT 1;
  SELECT id INTO v_mohamed_id     FROM employees WHERE full_name_ar ILIKE '%محمد%إبراهيم%' OR full_name_en ILIKE '%mohamed%ibrahim%' OR full_name_en ILIKE '%mohammed%ibrahim%' LIMIT 1;
  SELECT id INTO v_jana_id        FROM employees WHERE full_name_ar = 'جنا' OR full_name_ar ILIKE 'جنا %' OR full_name_en ILIKE 'jana%' OR full_name_en ILIKE 'janna%' LIMIT 1;
  SELECT id INTO v_mamdouh_id     FROM employees WHERE full_name_ar ILIKE '%ممدوح%' OR full_name_en ILIKE '%mamdouh%' OR full_name_en ILIKE '%mamdoh%' LIMIT 1;
  SELECT id INTO v_farah_id       FROM employees WHERE full_name_ar ILIKE '%فرح%' OR full_name_en ILIKE '%farah%' LIMIT 1;

  IF v_nawar_id       IS NULL THEN RAISE EXCEPTION 'Nawar not found';        END IF;
  IF v_abdulrahman_id IS NULL THEN RAISE EXCEPTION 'Abdulrahman not found';  END IF;
  IF v_nada_id        IS NULL THEN RAISE EXCEPTION 'Nada Hany not found';    END IF;
  IF v_shahd_id       IS NULL THEN RAISE EXCEPTION 'Shahd not found';        END IF;
  IF v_khaled_id      IS NULL THEN RAISE EXCEPTION 'Khaled Sedki not found'; END IF;
  IF v_mohamed_id     IS NULL THEN RAISE EXCEPTION 'Mohamed Ibrahim not found'; END IF;
  IF v_jana_id        IS NULL THEN RAISE EXCEPTION 'Jana not found';         END IF;
  IF v_mamdouh_id     IS NULL THEN RAISE EXCEPTION 'Mamdouh not found';      END IF;
  IF v_farah_id       IS NULL THEN RAISE EXCEPTION 'Farah not found';        END IF;

  -- Remove any prior items for these employees (idempotent re-run)
  DELETE FROM payroll_items
  WHERE run_id = v_run_id
    AND employee_id IN (v_nawar_id, v_abdulrahman_id, v_nada_id, v_shahd_id, v_khaled_id, v_mohamed_id, v_jana_id, v_mamdouh_id, v_farah_id);

  -- ── Nawar — 13,000 base · -433.33 deductions · 12,566.67 net ─────
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_nawar_id, 'Nawar',
    13000, 0, 0, 0,
    0, 433.33,
    0, 0, 0, 0,
    433.33, 12566.67,
    19, 1, 51, 0,
    'Single absent day 4/13 (later corrected to Sham El-Nessim — kept as deduction per session decision). Previously calculated. Worked OT but not applied.',
    NOW()
  );

  -- ── عبدالرحمن أيمن — 13,000 base · -1,505.86 deductions · 11,494.14 net ──
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_abdulrahman_id, 'عبدالرحمن أيمن',
    13000, 0, 0, 0,
    0, 1330.73,
    0, 0, 0, 175.13,
    1505.86, 11494.14,
    18, 2, 0, 0,
    'Early-leave penalty 175.13 for 4 days. Other deductions per April attendance.',
    NOW()
  );

  -- ── ندى هاني — 13,000 base · -574.16 deductions · 12,425.84 net ─────
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_nada_id, 'ندى هاني',
    13000, 0, 0, 0,
    0, 574.16,
    0, 0, 0, 0,
    574.16, 12425.84,
    20, 0, 0, 0,
    'New hire. Standard April calculations.',
    NOW()
  );

  -- ── شهد — 6,000 base · -1,544.67 deductions · 4,455.33 net ─────
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_shahd_id, 'شهد',
    6000, 0, 0, 0,
    0, 1496.67,
    0, 0, 0, 48,
    1544.67, 4455.33,
    16, 4, 0, 0,
    'Penalty 48 EGP (1.92h early-leave).',
    NOW()
  );

  -- ── خالد صدقي — 9,250 base · -3,135.72 deductions · 6,114.28 net ─────
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_khaled_id, 'خالد صدقي',
    9250, 0, 0, 0,
    0, 927.37,
    0, 2000, 0, 208.35,
    3135.72, 6114.28,
    16, 3, 0, 0,
    'Variable salary: 8,500 first half + 10,000 from 4/16. Loan 2,000 deducted in full this month. Penalty 208.35 (5h early-leave).',
    NOW()
  );

  -- ── محمد إبراهيم — 4,000 base (15/30) · -2,123 deductions · 1,877 net ──
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_mohamed_id, 'محمد إبراهيم',
    4000, 0, 0, 0,
    0, 2123,
    0, 0, 0, 0,
    2123, 1877,
    8, 7, 0, 0,
    'Terminated 2026-04-15. Pro-rated 15/30 days. Vanished after 4/15.',
    NOW()
  );

  -- ── جنا — 3,750 base (15/30) · -1,068.75 deductions · 2,681.25 net ──
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_jana_id, 'جنا',
    3750, 0, 0, 0,
    0, 1068.75,
    0, 0, 0, 0,
    1068.75, 2681.25,
    9, 1, 0, 0,
    'Terminated 2026-04-15 (سابت الشغل). Full salary 7,500. Pro-rated 15/30 days.',
    NOW()
  );

  -- ── ممدوح — 9,000 base · -3,542.50 deductions · 5,457.50 net ─────
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_mamdouh_id, 'ممدوح',
    9000, 0, 0, 0,
    0, 951.25,
    0, 2500, 0, 91.25,
    3542.50, 5457.50,
    16, 3, 0, 0,
    'Loan 2,500 deducted in full this month. Penalty 91.25 (2.43h early-leave).',
    NOW()
  );

  -- ── فرح — 8,000 base · -2,702.78 deductions · 5,297.22 net ─────
  INSERT INTO payroll_items (
    run_id, employee_id, employee_name, base_salary,
    allowances, tax, social_insurance,
    late_deduction, absent_deduction,
    overtime_bonus, loan_deduction, other_additions, other_deductions,
    total_deductions, net_salary,
    present_days, absent_days, late_minutes, overtime_minutes, notes, created_at
  ) VALUES (
    v_run_id, v_farah_id, 'فرح',
    8000, 0, 0, 0,
    0, 2598.89,
    0, 0, 0, 103.89,
    2702.78, 5297.22,
    16, 4, 0, 0,
    'Penalty 103.89 (3.12h early-leave). 4/8 treated as hour-based deduction.',
    NOW()
  );

  -- ── 3. Update run totals (all 13 employees) ─────────────────────
  UPDATE payroll_runs
  SET total_employees   = 13,
      total_gross       = 117600,
      total_deductions  = 22797.77,
      total_net         = 94802.23,
      notes             = 'May 2026 reconciliation — 13 employees: 4 (Ahmed Adel, Wael, Nesreen, Sara) + 9 from prior session (Nawar, Abdulrahman, Nada, Shahd, Khaled, Mohamed Ibrahim, Jana, Mamdouh, Farah). 3 terminations: Wael 4/19, Nesreen 4/12, Mohamed Ibrahim 4/15, Jana 4/15.'
  WHERE id = v_run_id;

  RAISE NOTICE 'April 2026 run updated with 9 additional employees. Run id: %', v_run_id;
END $$;

-- ── 4. Loans: ensure خالد and ممدوح loans are recorded as paid ────
-- If loans table has balance tracking, decrement balance_paid for the
-- 2,000 (Khaled) and 2,500 (Mamdouh) deductions. Skipped silently if
-- the schema differs.
DO $$
DECLARE
  v_khaled_id  uuid;
  v_mamdouh_id uuid;
BEGIN
  SELECT id INTO v_khaled_id  FROM employees WHERE full_name_ar ILIKE '%خالد%صدقي%' LIMIT 1;
  SELECT id INTO v_mamdouh_id FROM employees WHERE full_name_ar ILIKE '%ممدوح%' LIMIT 1;

  -- If you track loans in employee_loans with balance_paid + last_deducted_at,
  -- the savePayrollRun trigger will handle this when the run is locked.
  -- Here we just note the intent.
  RAISE NOTICE 'Khaled loan: 2000 EGP deducted this run (employee_id %)', v_khaled_id;
  RAISE NOTICE 'Mamdouh loan: 2500 EGP deducted this run (employee_id %)', v_mamdouh_id;
END $$;
