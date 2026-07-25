/*
# Seed Sample Data

## Overview
Populates the Miss Meow system with realistic demo data so every module has content.

## What gets added
1. Employees (12) — 5 Groomers, 4 Drivers, 3 Office Staff
2. Van details — plates, assigned drivers/groomers, Mulkiya expiry, mileage
3. KPI evaluations — current month scores for all active employees (all 3 divisions)
4. Sales records — 6 monthly sales records for the current month
5. Daily van checks — a few completed checks with item-level statuses (green/amber/red)

## Notes
- Idempotent: re-running is safe (ON CONFLICT DO NOTHING).
- Scores span all rating tiers: Outstanding, Strong, Developing, Action Needed, Not Evaluated.
- One van has an expired Mulkiya, one expiring soon, to exercise those statuses.
- Daily checks include a red (brake + accident) and an amber (tire monitor) so the fleet issue list is populated.
- The seed_eval helper function is defined BEFORE the block that calls it.
*/

-- ============================================================================
-- Helper function: seed_eval (defined first, dropped at end)
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_eval(
  p_month_id uuid,
  p_employee_id uuid,
  p_division_id uuid,
  p_max int,
  p_scores int[],
  p_notes text,
  p_status text
) RETURNS void AS $$
DECLARE
  v_eval_id uuid;
  v_total int := 0;
  v_count int := 0;
  v_pct numeric(5,2);
  v_rating text;
  v_item_id uuid;
  v_idx int;
BEGIN
  SELECT id INTO v_eval_id FROM employee_evaluations
    WHERE employee_id = p_employee_id AND evaluation_month_id = p_month_id;
  IF v_eval_id IS NOT NULL THEN RETURN; END IF;

  IF p_scores IS NOT NULL AND array_length(p_scores, 1) > 0 THEN
    FOREACH v_idx IN ARRAY p_scores LOOP
      IF v_idx IS NOT NULL THEN
        v_total := v_total + v_idx;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END IF;

  IF v_count > 0 THEN
    v_pct := ROUND((v_total::numeric / p_max) * 100, 2);
    v_rating := CASE
      WHEN v_pct >= 90 THEN 'outstanding'
      WHEN v_pct >= 75 THEN 'strong'
      WHEN v_pct >= 60 THEN 'developing'
      ELSE 'action_needed'
    END;
  ELSE
    v_pct := 0;
    v_rating := 'not_evaluated';
  END IF;

  INSERT INTO employee_evaluations (employee_id, evaluation_month_id, division_id, total_score, max_score, percentage, rating, notes, status)
  VALUES (p_employee_id, p_month_id, p_division_id, v_total, p_max, v_pct, v_rating, p_notes, p_status)
  RETURNING id INTO v_eval_id;

  IF p_scores IS NOT NULL AND array_length(p_scores, 1) > 0 THEN
    FOR v_idx IN 1..array_length(p_scores, 1) LOOP
      SELECT id INTO v_item_id FROM kpi_items
        WHERE division_id = p_division_id ORDER BY sort_order LIMIT 1 OFFSET (v_idx - 1);
      IF v_item_id IS NOT NULL THEN
        INSERT INTO evaluation_scores (evaluation_id, kpi_item_id, score)
        VALUES (v_eval_id, v_item_id, p_scores[v_idx])
        ON CONFLICT (evaluation_id, kpi_item_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Employees (12)
-- ============================================================================

DO $$
DECLARE
  g uuid; d uuid; o uuid;
BEGIN
  SELECT id INTO g FROM divisions WHERE code = 'groomers';
  SELECT id INTO d FROM divisions WHERE code = 'drivers';
  SELECT id INTO o FROM divisions WHERE code = 'office_staff';

  INSERT INTO employees (name, code, division_id, role, joining_date, status, notes) VALUES
    ('Sarah Mitchell', 'GR-001', g, 'Senior Groomer', '2023-03-15', 'active', 'Excellent with anxious pets and cats.'),
    ('James Cooper', 'GR-002', g, 'Groomer', '2023-07-01', 'active', NULL),
    ('Priya Sharma', 'GR-003', g, 'Groomer', '2024-01-10', 'active', 'Strong attention to detail.'),
    ('Ahmed Hassan', 'GR-004', g, 'Junior Groomer', '2024-09-20', 'probation', 'Currently in 3-month probation.'),
    ('Maria Santos', 'GR-005', g, 'Senior Groomer', '2022-11-05', 'on_leave', 'On maternity leave until October.'),
    ('Raj Patel', 'DR-001', d, 'Driver', '2023-02-01', 'active', NULL),
    ('Omar Khalid', 'DR-002', d, 'Driver', '2023-06-12', 'active', NULL),
    ('David Thompson', 'DR-003', d, 'Driver', '2024-03-18', 'active', NULL),
    ('Lisa Chen', 'DR-004', d, 'Driver', '2024-08-01', 'probation', NULL),
    ('Fatima Al-Zahra', 'OF-001', o, 'Office Manager', '2022-06-01', 'active', 'Handles scheduling and client relations.'),
    ('Tom Wilson', 'OF-002', o, 'Booking Coordinator', '2023-09-15', 'active', NULL),
    ('Nadia Rahman', 'OF-003', o, 'Client Service Representative', '2024-02-20', 'active', NULL)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================================================
-- Van details
-- ============================================================================

DO $$
DECLARE
  gr1 uuid; gr2 uuid; gr3 uuid; gr4 uuid;
  dr1 uuid; dr2 uuid; dr3 uuid; dr4 uuid;
BEGIN
  SELECT id INTO gr1 FROM employees WHERE code = 'GR-001';
  SELECT id INTO gr2 FROM employees WHERE code = 'GR-002';
  SELECT id INTO gr3 FROM employees WHERE code = 'GR-003';
  SELECT id INTO gr4 FROM employees WHERE code = 'GR-004';
  SELECT id INTO dr1 FROM employees WHERE code = 'DR-001';
  SELECT id INTO dr2 FROM employees WHERE code = 'DR-002';
  SELECT id INTO dr3 FROM employees WHERE code = 'DR-003';
  SELECT id INTO dr4 FROM employees WHERE code = 'DR-004';

  UPDATE vans SET plate_number = 'DXB-A-12345', assigned_driver_id = dr1, assigned_groomer_id = gr1, mulkiya_expiry_date = '2027-01-15', current_mileage = 48200 WHERE name = 'Van 1';
  UPDATE vans SET plate_number = 'DXB-B-23456', assigned_driver_id = dr2, assigned_groomer_id = gr2, mulkiya_expiry_date = '2025-08-20', current_mileage = 61500 WHERE name = 'Van 2';
  UPDATE vans SET plate_number = 'DXB-C-34567', assigned_driver_id = dr3, assigned_groomer_id = gr3, mulkiya_expiry_date = '2026-11-30', current_mileage = 39800 WHERE name = 'Van 3';
  UPDATE vans SET plate_number = 'DXB-D-45678', assigned_driver_id = dr4, assigned_groomer_id = gr4, mulkiya_expiry_date = '2024-12-01', current_mileage = 72300 WHERE name = 'Van 4';
  UPDATE vans SET plate_number = 'DXB-E-56789', mulkiya_expiry_date = '2026-05-10', current_mileage = 55000 WHERE name = 'Van 5';
  UPDATE vans SET plate_number = 'DXB-F-67890', mulkiya_expiry_date = '2027-03-22', current_mileage = 33100, status = 'maintenance' WHERE name = 'Van 6';
  UPDATE vans SET plate_number = 'DXB-G-78901', mulkiya_expiry_date = '2026-09-18', current_mileage = 41000 WHERE name = 'Van 7';
  UPDATE vans SET plate_number = 'DXB-H-89012', mulkiya_expiry_date = '2025-07-05', current_mileage = 28000, status = 'inactive' WHERE name = 'Van 8';
END $$;

-- ============================================================================
-- KPI evaluations for current month
-- ============================================================================

DO $$
DECLARE
  em_id uuid;
  g uuid; d uuid; o uuid;
  e_gr1 uuid; e_gr2 uuid; e_gr3 uuid; e_gr4 uuid; e_gr5 uuid;
  e_dr1 uuid; e_dr2 uuid; e_dr3 uuid; e_dr4 uuid;
  e_of1 uuid; e_of2 uuid; e_of3 uuid;
  cur_month int := EXTRACT(MONTH FROM now());
  cur_year int := EXTRACT(YEAR FROM now());
BEGIN
  SELECT id INTO g FROM divisions WHERE code = 'groomers';
  SELECT id INTO d FROM divisions WHERE code = 'drivers';
  SELECT id INTO o FROM divisions WHERE code = 'office_staff';

  INSERT INTO evaluation_months (month, year) VALUES (cur_month, cur_year)
    ON CONFLICT (month, year) DO NOTHING;
  SELECT id INTO em_id FROM evaluation_months WHERE month = cur_month AND year = cur_year;

  SELECT id INTO e_gr1 FROM employees WHERE code = 'GR-001';
  SELECT id INTO e_gr2 FROM employees WHERE code = 'GR-002';
  SELECT id INTO e_gr3 FROM employees WHERE code = 'GR-003';
  SELECT id INTO e_gr4 FROM employees WHERE code = 'GR-004';
  SELECT id INTO e_gr5 FROM employees WHERE code = 'GR-005';
  SELECT id INTO e_dr1 FROM employees WHERE code = 'DR-001';
  SELECT id INTO e_dr2 FROM employees WHERE code = 'DR-002';
  SELECT id INTO e_dr3 FROM employees WHERE code = 'DR-003';
  SELECT id INTO e_dr4 FROM employees WHERE code = 'DR-004';
  SELECT id INTO e_of1 FROM employees WHERE code = 'OF-001';
  SELECT id INTO e_of2 FROM employees WHERE code = 'OF-002';
  SELECT id INTO e_of3 FROM employees WHERE code = 'OF-003';

  -- Groomers (22 items, max = 110)
  PERFORM seed_eval(em_id, e_gr1, g, 110,
    ARRAY[5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,5,5,5,5],
    'Consistently excellent. Top performer.', 'approved');
  PERFORM seed_eval(em_id, e_gr2, g, 110,
    ARRAY[4,4,4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,3,4,4,4],
    'Solid performer. Can improve on client reminders.', 'approved');
  PERFORM seed_eval(em_id, e_gr3, g, 110,
    ARRAY[3,3,4,4,3,3,3,3,3,3,4,3,3,3,4,3,3,2,3,3,4,3],
    'Good potential. Needs to work on reliability and cancellations.', 'approved');
  PERFORM seed_eval(em_id, e_gr4, g, 110,
    ARRAY[3,2,2,3,2,2,2,3,2,3,3,2,2,2,3,2,2,2,2,3,2,2],
    'Needs significant improvement. Reassess at end of probation.', 'draft');
  PERFORM seed_eval(em_id, e_gr5, g, 110,
    ARRAY[]::int[],
    'On leave — not evaluated this month.', 'approved');

  -- Drivers (16 items, max = 80)
  PERFORM seed_eval(em_id, e_dr1, d, 80,
    ARRAY[5,5,5,5,5,5,5,5,5,5,4,5,5,5,5,5],
    'Reliable and thorough. Excellent van care.', 'approved');
  PERFORM seed_eval(em_id, e_dr2, d, 80,
    ARRAY[4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4],
    'Good driver. Should complete vehicle checks more consistently.', 'approved');
  PERFORM seed_eval(em_id, e_dr3, d, 80,
    ARRAY[3,3,4,3,3,3,3,3,4,3,3,3,3,4,3,2],
    'Needs improvement on punctuality and schedule changes.', 'approved');
  PERFORM seed_eval(em_id, e_dr4, d, 80,
    ARRAY[3,3,3,NULL,NULL,3,3,NULL,3,3,NULL,3,3,3,NULL,NULL],
    'Probation — partial scoring. Some items pending.', 'draft');

  -- Office Staff (19 items, max = 95)
  PERFORM seed_eval(em_id, e_of1, o, 95,
    ARRAY[5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],
    'Outstanding office manager. Drives the team.', 'approved');
  PERFORM seed_eval(em_id, e_of2, o, 95,
    ARRAY[4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,4,3,4],
    'Good coordinator. Can improve on booking accuracy.', 'approved');
  PERFORM seed_eval(em_id, e_of3, o, 95,
    ARRAY[3,3,4,3,3,3,4,3,3,3,3,4,3,3,3,3,3,3,3],
    'Developing. Needs to improve response times to team messages.', 'approved');
END $$;

-- ============================================================================
-- Sales records (current month)
-- ============================================================================

DO $$
DECLARE
  cur_month int := EXTRACT(MONTH FROM now());
  cur_year int := EXTRACT(YEAR FROM now());
  v1 uuid; v2 uuid; v3 uuid; v4 uuid;
  gr1 uuid; gr2 uuid; gr3 uuid;
  of1 uuid;
BEGIN
  SELECT id INTO v1 FROM vans WHERE name = 'Van 1';
  SELECT id INTO v2 FROM vans WHERE name = 'Van 2';
  SELECT id INTO v3 FROM vans WHERE name = 'Van 3';
  SELECT id INTO v4 FROM vans WHERE name = 'Van 4';
  SELECT id INTO gr1 FROM employees WHERE code = 'GR-001';
  SELECT id INTO gr2 FROM employees WHERE code = 'GR-002';
  SELECT id INTO gr3 FROM employees WHERE code = 'GR-003';
  SELECT id INTO of1 FROM employees WHERE code = 'OF-001';

  INSERT INTO sales_records (month, year, employee_id, team, van_id, sales_target, actual_sales, achievement_percentage, notes) VALUES
    (cur_month, cur_year, gr1, 'Van 1 Team', v1, 48600, 52300, 0, 'Strong month with repeat clients.'),
    (cur_month, cur_year, gr2, 'Van 2 Team', v2, 48600, 41200, 0, 'Below target — 2 cancellations.'),
    (cur_month, cur_year, gr3, 'Van 3 Team', v3, 48600, 48950, 0, 'Just hit target.'),
    (cur_month, cur_year, NULL, 'Van 4 Team', v4, 48600, 35600, 0, 'Driver on probation impacted bookings.'),
    (cur_month, cur_year, of1, 'Office Bookings', NULL, 48600, 61800, 0, 'Excellent upselling of packages.'),
    (cur_month, cur_year, NULL, 'Overall Company', NULL, 194400, 239850, 0, 'Combined across all vans.')
  ON CONFLICT DO NOTHING;

  UPDATE sales_records SET achievement_percentage = ROUND((actual_sales / sales_target) * 100, 2)
    WHERE month = cur_month AND year = cur_year;
END $$;

-- ============================================================================
-- Daily van checks + items
-- ============================================================================

DO $$
DECLARE
  v1 uuid; v2 uuid; v3 uuid; v4 uuid;
  dr1 uuid; dr2 uuid; dr3 uuid; dr4 uuid;
  gr1 uuid; gr2 uuid; gr3 uuid; gr4 uuid;
  d1 date := CURRENT_DATE;
  d2 date := CURRENT_DATE - 1;
  d3 date := CURRENT_DATE - 2;
  d4 date := CURRENT_DATE - 3;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
BEGIN
  SELECT id INTO v1 FROM vans WHERE name = 'Van 1';
  SELECT id INTO v2 FROM vans WHERE name = 'Van 2';
  SELECT id INTO v3 FROM vans WHERE name = 'Van 3';
  SELECT id INTO v4 FROM vans WHERE name = 'Van 4';
  SELECT id INTO dr1 FROM employees WHERE code = 'DR-001';
  SELECT id INTO dr2 FROM employees WHERE code = 'DR-002';
  SELECT id INTO dr3 FROM employees WHERE code = 'DR-003';
  SELECT id INTO dr4 FROM employees WHERE code = 'DR-004';
  SELECT id INTO gr1 FROM employees WHERE code = 'GR-001';
  SELECT id INTO gr2 FROM employees WHERE code = 'GR-002';
  SELECT id INTO gr3 FROM employees WHERE code = 'GR-003';
  SELECT id INTO gr4 FROM employees WHERE code = 'GR-004';

  INSERT INTO daily_van_checks (van_id, check_date, driver_id, groomer_id, previous_mileage, current_mileage, remarks, overall_status, is_submitted) VALUES
    (v1, d4, dr1, gr1, 48100, 48150, 'All good.', 'green', true),
    (v2, d4, dr2, gr2, 61400, 61480, 'Front tires need monitoring.', 'amber', true),
    (v3, d4, dr3, gr3, 39700, 39760, 'Brake issue reported and accident in parking lot.', 'red', true),
    (v1, d3, dr1, gr1, 48150, 48190, 'Smooth day.', 'green', true),
    (v2, d3, dr2, gr2, 61480, 61520, 'All good after tire check.', 'green', true),
    (v4, d3, dr4, gr4, 72250, 72300, 'Wipers need replacing soon.', 'amber', true),
    (v1, d2, dr1, gr1, 48190, 48200, 'All good.', 'green', true),
    (v2, d2, dr2, gr2, 61520, 61500, 'Battery issue — action needed.', 'red', true),
    (v3, d2, dr3, gr3, 39760, 39800, 'Resolved brake issue. All good.', 'green', true),
    (v1, d1, dr1, gr1, 48200, 48200, 'Started shift, all checks passed.', 'green', true)
  ON CONFLICT (van_id, check_date) DO NOTHING;

  SELECT id INTO c1 FROM daily_van_checks WHERE van_id = v3 AND check_date = d4;
  SELECT id INTO c2 FROM daily_van_checks WHERE van_id = v2 AND check_date = d4;
  SELECT id INTO c3 FROM daily_van_checks WHERE van_id = v2 AND check_date = d2;
  SELECT id INTO c4 FROM daily_van_checks WHERE van_id = v4 AND check_date = d3;

  -- Van 3 (day 4): RED — brake action_needed + accident yes
  IF c1 IS NOT NULL THEN
    INSERT INTO daily_van_check_items (check_id, item_code, item_label, item_type, status) VALUES
      (c1, 'engine_condition', 'Engine Condition', 'normal', 'good'),
      (c1, 'radiator_water', 'Radiator Water', 'normal', 'good'),
      (c1, 'battery', 'Battery', 'normal', 'good'),
      (c1, 'brake_condition', 'Brake Condition', 'normal', 'action_needed'),
      (c1, 'generator', 'Generator', 'normal', 'good'),
      (c1, 'front_tires', 'Front Tires', 'normal', 'good'),
      (c1, 'back_tires', 'Back Tires', 'normal', 'good'),
      (c1, 'spare_wheel', 'Spare Wheel', 'normal', 'good'),
      (c1, 'lights', 'Lights', 'normal', 'good'),
      (c1, 'wipers', 'Wipers', 'normal', 'good'),
      (c1, 'fire_extinguisher', 'Fire Extinguisher', 'normal', 'good'),
      (c1, 'frontside_ac', 'Frontside A/C', 'normal', 'good'),
      (c1, 'backside_ac', 'Backside A/C', 'normal', 'good'),
      (c1, 'vacuum', 'Vacuum', 'normal', 'good'),
      (c1, 'blow_dryer', 'Blow Dryer', 'normal', 'good'),
      (c1, 'water_heater', 'Water Heater', 'normal', 'good'),
      (c1, 'lavender_oil', 'Lavender Oil', 'normal', 'good'),
      (c1, 'microchip_scanner', 'Microchip Scanner', 'normal', 'good'),
      (c1, 'tools_kit', 'Tools Kit', 'normal', 'good'),
      (c1, 'inside_clean', 'Inside Clean', 'normal', 'good'),
      (c1, 'mulkiya_valid', 'Mulkiya Valid', 'mulkiya', 'valid'),
      (c1, 'accidents', 'Accidents', 'accident', 'yes')
    ON CONFLICT (check_id, item_code) DO NOTHING;
  END IF;

  -- Van 2 (day 4): AMBER — front tires monitor
  IF c2 IS NOT NULL THEN
    INSERT INTO daily_van_check_items (check_id, item_code, item_label, item_type, status) VALUES
      (c2, 'engine_condition', 'Engine Condition', 'normal', 'good'),
      (c2, 'radiator_water', 'Radiator Water', 'normal', 'good'),
      (c2, 'battery', 'Battery', 'normal', 'good'),
      (c2, 'brake_condition', 'Brake Condition', 'normal', 'good'),
      (c2, 'generator', 'Generator', 'normal', 'good'),
      (c2, 'front_tires', 'Front Tires', 'normal', 'monitor'),
      (c2, 'back_tires', 'Back Tires', 'normal', 'good'),
      (c2, 'spare_wheel', 'Spare Wheel', 'normal', 'good'),
      (c2, 'lights', 'Lights', 'normal', 'good'),
      (c2, 'wipers', 'Wipers', 'normal', 'good'),
      (c2, 'fire_extinguisher', 'Fire Extinguisher', 'normal', 'good'),
      (c2, 'frontside_ac', 'Frontside A/C', 'normal', 'good'),
      (c2, 'backside_ac', 'Backside A/C', 'normal', 'good'),
      (c2, 'vacuum', 'Vacuum', 'normal', 'good'),
      (c2, 'blow_dryer', 'Blow Dryer', 'normal', 'good'),
      (c2, 'water_heater', 'Water Heater', 'normal', 'good'),
      (c2, 'lavender_oil', 'Lavender Oil', 'normal', 'good'),
      (c2, 'microchip_scanner', 'Microchip Scanner', 'normal', 'good'),
      (c2, 'tools_kit', 'Tools Kit', 'normal', 'good'),
      (c2, 'inside_clean', 'Inside Clean', 'normal', 'good'),
      (c2, 'mulkiya_valid', 'Mulkiya Valid', 'mulkiya', 'valid'),
      (c2, 'accidents', 'Accidents', 'accident', 'no')
    ON CONFLICT (check_id, item_code) DO NOTHING;
  END IF;

  -- Van 2 (day 2): RED — battery action_needed
  IF c3 IS NOT NULL THEN
    INSERT INTO daily_van_check_items (check_id, item_code, item_label, item_type, status) VALUES
      (c3, 'engine_condition', 'Engine Condition', 'normal', 'good'),
      (c3, 'radiator_water', 'Radiator Water', 'normal', 'good'),
      (c3, 'battery', 'Battery', 'normal', 'action_needed'),
      (c3, 'brake_condition', 'Brake Condition', 'normal', 'good'),
      (c3, 'generator', 'Generator', 'normal', 'good'),
      (c3, 'front_tires', 'Front Tires', 'normal', 'good'),
      (c3, 'back_tires', 'Back Tires', 'normal', 'good'),
      (c3, 'spare_wheel', 'Spare Wheel', 'normal', 'good'),
      (c3, 'lights', 'Lights', 'normal', 'good'),
      (c3, 'wipers', 'Wipers', 'normal', 'good'),
      (c3, 'fire_extinguisher', 'Fire Extinguisher', 'normal', 'good'),
      (c3, 'frontside_ac', 'Frontside A/C', 'normal', 'good'),
      (c3, 'backside_ac', 'Backside A/C', 'normal', 'good'),
      (c3, 'vacuum', 'Vacuum', 'normal', 'good'),
      (c3, 'blow_dryer', 'Blow Dryer', 'normal', 'good'),
      (c3, 'water_heater', 'Water Heater', 'normal', 'good'),
      (c3, 'lavender_oil', 'Lavender Oil', 'normal', 'good'),
      (c3, 'microchip_scanner', 'Microchip Scanner', 'normal', 'good'),
      (c3, 'tools_kit', 'Tools Kit', 'normal', 'good'),
      (c3, 'inside_clean', 'Inside Clean', 'normal', 'good'),
      (c3, 'mulkiya_valid', 'Mulkiya Valid', 'mulkiya', 'valid'),
      (c3, 'accidents', 'Accidents', 'accident', 'no')
    ON CONFLICT (check_id, item_code) DO NOTHING;
  END IF;

  -- Van 4 (day 3): AMBER — wipers monitor + expired mulkiya
  IF c4 IS NOT NULL THEN
    INSERT INTO daily_van_check_items (check_id, item_code, item_label, item_type, status) VALUES
      (c4, 'engine_condition', 'Engine Condition', 'normal', 'good'),
      (c4, 'radiator_water', 'Radiator Water', 'normal', 'good'),
      (c4, 'battery', 'Battery', 'normal', 'good'),
      (c4, 'brake_condition', 'Brake Condition', 'normal', 'good'),
      (c4, 'generator', 'Generator', 'normal', 'good'),
      (c4, 'front_tires', 'Front Tires', 'normal', 'good'),
      (c4, 'back_tires', 'Back Tires', 'normal', 'good'),
      (c4, 'spare_wheel', 'Spare Wheel', 'normal', 'good'),
      (c4, 'lights', 'Lights', 'normal', 'good'),
      (c4, 'wipers', 'Wipers', 'normal', 'monitor'),
      (c4, 'fire_extinguisher', 'Fire Extinguisher', 'normal', 'good'),
      (c4, 'frontside_ac', 'Frontside A/C', 'normal', 'good'),
      (c4, 'backside_ac', 'Backside A/C', 'normal', 'good'),
      (c4, 'vacuum', 'Vacuum', 'normal', 'good'),
      (c4, 'blow_dryer', 'Blow Dryer', 'normal', 'good'),
      (c4, 'water_heater', 'Water Heater', 'normal', 'good'),
      (c4, 'lavender_oil', 'Lavender Oil', 'normal', 'good'),
      (c4, 'microchip_scanner', 'Microchip Scanner', 'normal', 'good'),
      (c4, 'tools_kit', 'Tools Kit', 'normal', 'good'),
      (c4, 'inside_clean', 'Inside Clean', 'normal', 'good'),
      (c4, 'mulkiya_valid', 'Mulkiya Valid', 'mulkiya', 'expired'),
      (c4, 'accidents', 'Accidents', 'accident', 'no')
    ON CONFLICT (check_id, item_code) DO NOTHING;
  END IF;
END $$;

-- Clean up helper
DROP FUNCTION IF EXISTS seed_eval(uuid, uuid, uuid, int, int[], text, text);
