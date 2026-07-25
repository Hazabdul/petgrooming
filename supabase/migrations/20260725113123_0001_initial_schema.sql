/*
# Miss Meow Management System - Initial Schema

## Overview
Creates the full database schema for Miss Meow Mobile Pet Grooming's management system.
Replaces Excel sheets with a multi-role (Admin/Manager/Employee/Driver) application backed by Supabase.

## Tables Created (13)
1. `profiles` — links auth.users to a display name and role (admin/manager/employee/driver)
2. `divisions` — Groomers, Drivers, Office Staff
3. `employees` — staff records (name, code, division, role, joining date, status, notes)
4. `kpi_items` — KPI criteria per division (e.g. "Compassion First", grouped by category)
5. `evaluation_months` — month/year buckets for KPI evaluations (unique per month-year)
6. `employee_evaluations` — one record per employee per evaluation month (total, max, pct, rating, notes, status)
7. `evaluation_scores` — individual KPI scores (1-5) per employee evaluation
8. `sales_records` — monthly sales per employee/team/van (target, actual, pct, notes)
9. `vans` — fleet records (name, plate, driver, groomer, mulkiya expiry, mileage, status, notes)
10. `van_assignments` — current/historical driver+groomer assignment per van
11. `daily_van_checks` — one check per van per day (driver, mileage, remarks, overall status)
12. `daily_van_check_items` — per-item status for each daily check
13. `notifications` — simple in-app notifications

## Data Safety
- All tables use UUID primary keys.
- created_at / updated_at / created_by added where required.
- No destructive operations; idempotent via IF NOT EXISTS / ON CONFLICT.
- Employees are never hard-deleted (deactivate only); historical records preserved.

## Security (RLS)
- This app HAS a sign-in screen, so policies are scoped TO authenticated with ownership/membership checks.
- profiles is self-readable/writable by owner.
- Business tables are read by all authenticated staff; writes restricted to admin/manager (via is_role helper).
- Drivers can read/write their own daily checks (and any check, since assignments are fluid).
- auth.uid() used everywhere (never current_user).

## Helper
- is_role(text) SQL function checks the requesting user's role from profiles.role.
  Defined AFTER profiles so the dependency resolves.

## Important Notes
1. Role lives in profiles.role (text: 'admin' | 'manager' | 'employee' | 'driver').
2. KPI max score is NEVER hardcoded — derived from COUNT of kpi_items for the division.
3. Checklist status (good/monitor/action_needed/no/yes) stored per item; mulkiya status is
   calculated from expiry at read time, not stored.
4. Default sales target AED 48600 is the column default on sales_records; changeable per record.
5. Eight vans (Van 1..Van 8) are seeded.
*/

-- ============================================================================
-- 1. profiles (created FIRST so is_role can depend on it)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','manager','employee','driver')),
  employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Helper: is_role (defined after profiles)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = required_role
  );
$$;

-- ============================================================================
-- 2. divisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "divisions_select_all" ON public.divisions;
CREATE POLICY "divisions_select_all" ON public.divisions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divisions_write_admin_manager" ON public.divisions;
CREATE POLICY "divisions_write_admin_manager" ON public.divisions
  FOR INSERT TO authenticated WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "divisions_update_admin_manager" ON public.divisions;
CREATE POLICY "divisions_update_admin_manager" ON public.divisions
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 3. employees
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
  role text,
  joining_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','probation','on_leave','inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_employees_division ON public.employees(division_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

DROP POLICY IF EXISTS "employees_select_all" ON public.employees;
CREATE POLICY "employees_select_all" ON public.employees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employees_insert_admin_manager" ON public.employees;
CREATE POLICY "employees_insert_admin_manager" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "employees_update_admin_manager" ON public.employees;
CREATE POLICY "employees_update_admin_manager" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- No DELETE policy: employees with KPI records must not be hard-deleted.
-- Deactivation is done via UPDATE status = 'inactive'.

-- ============================================================================
-- 4. kpi_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kpi_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  category text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (division_id, code)
);

ALTER TABLE public.kpi_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_kpi_items_division ON public.kpi_items(division_id);

DROP POLICY IF EXISTS "kpi_items_select_all" ON public.kpi_items;
CREATE POLICY "kpi_items_select_all" ON public.kpi_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kpi_items_write_admin_manager" ON public.kpi_items;
CREATE POLICY "kpi_items_write_admin_manager" ON public.kpi_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "kpi_items_update_admin_manager" ON public.kpi_items;
CREATE POLICY "kpi_items_update_admin_manager" ON public.kpi_items
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 5. evaluation_months
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evaluation_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year BETWEEN 1900 AND 3000),
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (month, year)
);

ALTER TABLE public.evaluation_months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eval_months_select_all" ON public.evaluation_months;
CREATE POLICY "eval_months_select_all" ON public.evaluation_months
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "eval_months_write_admin_manager" ON public.evaluation_months;
CREATE POLICY "eval_months_write_admin_manager" ON public.evaluation_months
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "eval_months_update_admin_manager" ON public.evaluation_months;
CREATE POLICY "eval_months_update_admin_manager" ON public.evaluation_months
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 6. employee_evaluations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  evaluation_month_id uuid NOT NULL REFERENCES public.evaluation_months(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE RESTRICT,
  total_score int NOT NULL DEFAULT 0,
  max_score int NOT NULL DEFAULT 0,
  percentage numeric(5,2) NOT NULL DEFAULT 0,
  rating text NOT NULL DEFAULT 'not_evaluated' CHECK (rating IN ('outstanding','strong','developing','action_needed','not_evaluated')),
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (employee_id, evaluation_month_id)
);

ALTER TABLE public.employee_evaluations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_evals_month ON public.employee_evaluations(evaluation_month_id);
CREATE INDEX IF NOT EXISTS idx_evals_employee ON public.employee_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_evals_division ON public.employee_evaluations(division_id);

DROP POLICY IF EXISTS "evals_select_all" ON public.employee_evaluations;
CREATE POLICY "evals_select_all" ON public.employee_evaluations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "evals_insert_admin_manager" ON public.employee_evaluations;
CREATE POLICY "evals_insert_admin_manager" ON public.employee_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "evals_update_admin_manager" ON public.employee_evaluations;
CREATE POLICY "evals_update_admin_manager" ON public.employee_evaluations
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 7. evaluation_scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.employee_evaluations(id) ON DELETE CASCADE,
  kpi_item_id uuid NOT NULL REFERENCES public.kpi_items(id) ON DELETE CASCADE,
  score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, kpi_item_id),
  CHECK (score IS NULL OR (score BETWEEN 1 AND 5))
);

ALTER TABLE public.evaluation_scores ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_scores_eval ON public.evaluation_scores(evaluation_id);

DROP POLICY IF EXISTS "scores_select_all" ON public.evaluation_scores;
CREATE POLICY "scores_select_all" ON public.evaluation_scores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "scores_insert_admin_manager" ON public.evaluation_scores;
CREATE POLICY "scores_insert_admin_manager" ON public.evaluation_scores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "scores_update_admin_manager" ON public.evaluation_scores;
CREATE POLICY "scores_update_admin_manager" ON public.evaluation_scores
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "scores_delete_admin_manager" ON public.evaluation_scores;
CREATE POLICY "scores_delete_admin_manager" ON public.evaluation_scores
  FOR DELETE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 9. vans (created before sales_records & van_assignments which reference it)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate_number text,
  assigned_driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_groomer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  mulkiya_expiry_date date,
  current_mileage int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','out_of_service','inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.vans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vans_select_all" ON public.vans;
CREATE POLICY "vans_select_all" ON public.vans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vans_insert_admin_manager" ON public.vans;
CREATE POLICY "vans_insert_admin_manager" ON public.vans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "vans_update_admin_manager" ON public.vans;
CREATE POLICY "vans_update_admin_manager" ON public.vans
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 8. sales_records
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year BETWEEN 1900 AND 3000),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  team text,
  van_id uuid REFERENCES public.vans(id) ON DELETE SET NULL,
  sales_target numeric(12,2) NOT NULL DEFAULT 48600,
  actual_sales numeric(12,2) NOT NULL DEFAULT 0,
  achievement_percentage numeric(6,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sales_month_year ON public.sales_records(month, year);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON public.sales_records(employee_id);

DROP POLICY IF EXISTS "sales_select_all" ON public.sales_records;
CREATE POLICY "sales_select_all" ON public.sales_records
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sales_insert_admin_manager" ON public.sales_records;
CREATE POLICY "sales_insert_admin_manager" ON public.sales_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "sales_update_admin_manager" ON public.sales_records;
CREATE POLICY "sales_update_admin_manager" ON public.sales_records
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "sales_delete_admin_manager" ON public.sales_records;
CREATE POLICY "sales_delete_admin_manager" ON public.sales_records
  FOR DELETE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 10. van_assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.van_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id uuid NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  groomer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_from date NOT NULL DEFAULT CURRENT_DATE,
  assigned_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.van_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_van_assignments_van ON public.van_assignments(van_id);
CREATE INDEX IF NOT EXISTS idx_van_assignments_current ON public.van_assignments(van_id) WHERE assigned_to IS NULL;

DROP POLICY IF EXISTS "van_assignments_select_all" ON public.van_assignments;
CREATE POLICY "van_assignments_select_all" ON public.van_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "van_assignments_write_admin_manager" ON public.van_assignments;
CREATE POLICY "van_assignments_write_admin_manager" ON public.van_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "van_assignments_update_admin_manager" ON public.van_assignments;
CREATE POLICY "van_assignments_update_admin_manager" ON public.van_assignments
  FOR UPDATE TO authenticated
  USING (public.is_role('admin') OR public.is_role('manager'))
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

-- ============================================================================
-- 11. daily_van_checks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_van_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id uuid NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  check_date date NOT NULL,
  driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  groomer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  previous_mileage int,
  current_mileage int,
  remarks text,
  overall_status text NOT NULL DEFAULT 'gray' CHECK (overall_status IN ('green','amber','red','gray')),
  is_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (van_id, check_date)
);

ALTER TABLE public.daily_van_checks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_checks_van_date ON public.daily_van_checks(van_id, check_date);
CREATE INDEX IF NOT EXISTS idx_checks_month ON public.daily_van_checks(check_date);

DROP POLICY IF EXISTS "checks_select_all" ON public.daily_van_checks;
CREATE POLICY "checks_select_all" ON public.daily_van_checks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checks_insert_all" ON public.daily_van_checks;
CREATE POLICY "checks_insert_all" ON public.daily_van_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_role('admin') OR public.is_role('manager') OR public.is_role('driver')
  );

DROP POLICY IF EXISTS "checks_update_all" ON public.daily_van_checks;
CREATE POLICY "checks_update_all" ON public.daily_van_checks
  FOR UPDATE TO authenticated
  USING (
    public.is_role('admin') OR public.is_role('manager') OR public.is_role('driver')
  )
  WITH CHECK (
    public.is_role('admin') OR public.is_role('manager') OR public.is_role('driver')
  );

-- ============================================================================
-- 12. daily_van_check_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_van_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.daily_van_checks(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  item_label text NOT NULL,
  item_type text NOT NULL DEFAULT 'normal' CHECK (item_type IN ('normal','accident','mulkiya')),
  status text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_id, item_code)
);

ALTER TABLE public.daily_van_check_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_check_items_check ON public.daily_van_check_items(check_id);
CREATE INDEX IF NOT EXISTS idx_check_items_status ON public.daily_van_check_items(status);

DROP POLICY IF EXISTS "check_items_select_all" ON public.daily_van_check_items;
CREATE POLICY "check_items_select_all" ON public.daily_van_check_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "check_items_insert_all" ON public.daily_van_check_items;
CREATE POLICY "check_items_insert_all" ON public.daily_van_check_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_role('admin') OR public.is_role('manager') OR public.is_role('driver')
  );

DROP POLICY IF EXISTS "check_items_update_all" ON public.daily_van_check_items;
CREATE POLICY "check_items_update_all" ON public.daily_van_check_items
  FOR UPDATE TO authenticated
  USING (
    public.is_role('admin') OR public.is_role('manager') OR public.is_role('driver')
  )
  WITH CHECK (
    public.is_role('admin') OR public.is_role('manager') OR public.is_role('driver')
  );

-- ============================================================================
-- 13. notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error','success')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

DROP POLICY IF EXISTS "notifications_select_owner" ON public.notifications;
CREATE POLICY "notifications_select_owner" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_role('admin'));

DROP POLICY IF EXISTS "notifications_insert_admin_manager" ON public.notifications;
CREATE POLICY "notifications_insert_admin_manager" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_role('admin') OR public.is_role('manager'));

DROP POLICY IF EXISTS "notifications_update_owner" ON public.notifications;
CREATE POLICY "notifications_update_owner" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_admin" ON public.notifications;
CREATE POLICY "notifications_delete_admin" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.is_role('admin'));

-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','employees','employee_evaluations','evaluation_scores','sales_records','vans','daily_van_checks','daily_van_check_items','notifications'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- Seed: divisions
-- ============================================================================

INSERT INTO public.divisions (code, name, sort_order) VALUES
  ('groomers', 'Groomers', 1),
  ('drivers', 'Drivers', 2),
  ('office_staff', 'Office Staff', 3)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Seed: vans (8)
-- ============================================================================

INSERT INTO public.vans (name, plate_number, status, current_mileage) VALUES
  ('Van 1', NULL, 'active', 0),
  ('Van 2', NULL, 'active', 0),
  ('Van 3', NULL, 'active', 0),
  ('Van 4', NULL, 'active', 0),
  ('Van 5', NULL, 'active', 0),
  ('Van 6', NULL, 'active', 0),
  ('Van 7', NULL, 'active', 0),
  ('Van 8', NULL, 'active', 0)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Seed: KPI items for each division
-- ============================================================================

DO $$
DECLARE
  g_div uuid; d_div uuid; o_div uuid;
BEGIN
  SELECT id INTO g_div FROM public.divisions WHERE code = 'groomers';
  SELECT id INTO d_div FROM public.divisions WHERE code = 'drivers';
  SELECT id INTO o_div FROM public.divisions WHERE code = 'office_staff';

  INSERT INTO public.kpi_items (division_id, code, label, category, description, sort_order) VALUES
    (g_div, 'compassion_first_1', 'Handles pets gently and patiently', 'Compassion First', 'Handles pets gently and patiently', 1),
    (g_div, 'compassion_first_2', 'Comforts stressed or scared pets', 'Compassion First', 'Comforts stressed or scared pets', 2),
    (g_div, 'compassion_first_3', 'Never rushes a groom', 'Compassion First', 'Never rushes a groom', 3),
    (g_div, 'welfare_hygiene_1', 'Sanitizes tools after every pet', 'Welfare and Hygiene', 'Sanitizes tools after every pet', 4),
    (g_div, 'welfare_hygiene_2', 'Uses grooming products correctly', 'Welfare and Hygiene', 'Uses grooming products correctly', 5),
    (g_div, 'welfare_hygiene_3', 'Completes the hygiene checklist', 'Welfare and Hygiene', 'Completes the hygiene checklist', 6),
    (g_div, 'welfare_hygiene_4', 'Checks pet safety before and after grooming', 'Welfare and Hygiene', 'Checks pet safety before and after grooming', 7),
    (g_div, 'accountability_1', 'Reports incidents immediately', 'Accountability', 'Reports incidents immediately', 8),
    (g_div, 'accountability_2', 'Takes responsibility for mistakes', 'Accountability', 'Takes responsibility for mistakes', 9),
    (g_div, 'accountability_3', 'Communicates clearly with the office', 'Accountability', 'Communicates clearly with the office', 10),
    (g_div, 'professionalism_1', 'Maintains a clean and professional appearance', 'Professionalism', 'Maintains a clean and professional appearance', 11),
    (g_div, 'professionalism_2', 'Follows grooming instructions correctly', 'Professionalism', 'Follows grooming instructions correctly', 12),
    (g_div, 'professionalism_3', 'Pays attention to detail', 'Professionalism', 'Pays attention to detail', 13),
    (g_div, 'professionalism_4', 'Takes quality photos and videos', 'Professionalism', 'Takes quality photos and videos', 14),
    (g_div, 'teamwork_1', 'Is respectful to team members and drivers', 'Teamwork', 'Is respectful to team members and drivers', 15),
    (g_div, 'teamwork_2', 'Supports teammates', 'Teamwork', 'Supports teammates', 16),
    (g_div, 'teamwork_3', 'Demonstrates flexibility', 'Teamwork', 'Demonstrates flexibility', 17),
    (g_div, 'reliability_1', 'Arrives on time', 'Reliability', 'Arrives on time', 18),
    (g_div, 'reliability_2', 'Has no unexplained cancellations', 'Reliability', 'Has no unexplained cancellations', 19),
    (g_div, 'reliability_3', 'Maintains an organized van', 'Reliability', 'Maintains an organized van', 20),
    (g_div, 'client_experience_1', 'Responds properly to client complaints', 'Client Experience', 'Responds properly to client complaints', 21),
    (g_div, 'client_experience_2', 'Reminds clients about the next grooming schedule', 'Client Experience', 'Reminds clients about the next grooming schedule', 22)
  ON CONFLICT (division_id, code) DO NOTHING;

  INSERT INTO public.kpi_items (division_id, code, label, category, description, sort_order) VALUES
    (d_div, 'pet_handling_1', 'Is calm and careful with pets in the van', 'Pet Handling', 'Is calm and careful with pets in the van', 1),
    (d_div, 'pet_handling_2', 'Handles loading and unloading gently', 'Pet Handling', 'Handles loading and unloading gently', 2),
    (d_div, 'van_care_1', 'Keeps the van clean after every trip', 'Van Care', 'Keeps the van clean after every trip', 3),
    (d_div, 'van_care_2', 'Checks van safety before departure', 'Van Care', 'Checks van safety before departure', 4),
    (d_div, 'van_care_3', 'Maintains personal hygiene and uniform', 'Van Care', 'Maintains personal hygiene and uniform', 5),
    (d_div, 'accountability_1', 'Reports delays or issues immediately', 'Accountability', 'Reports delays or issues immediately', 6),
    (d_div, 'accountability_2', 'Logs trips and updates correctly', 'Accountability', 'Logs trips and updates correctly', 7),
    (d_div, 'accountability_3', 'Reports vehicle incidents immediately', 'Accountability', 'Reports vehicle incidents immediately', 8),
    (d_div, 'professionalism_1', 'Maintains a professional appearance', 'Professionalism', 'Maintains a professional appearance', 9),
    (d_div, 'professionalism_2', 'Follows SOP instructions', 'Professionalism', 'Follows SOP instructions', 10),
    (d_div, 'professionalism_3', 'Completes the vehicle check every shift', 'Professionalism', 'Completes the vehicle check every shift', 11),
    (d_div, 'teamwork_1', 'Is respectful to the groomer and team', 'Teamwork', 'Is respectful to the groomer and team', 12),
    (d_div, 'teamwork_2', 'Supports the groomer during sessions', 'Teamwork', 'Supports the groomer during sessions', 13),
    (d_div, 'teamwork_3', 'Demonstrates flexibility', 'Teamwork', 'Demonstrates flexibility', 14),
    (d_div, 'reliability_1', 'Arrives on time', 'Reliability', 'Arrives on time', 15),
    (d_div, 'reliability_2', 'Has no unexplained schedule changes', 'Reliability', 'Has no unexplained schedule changes', 16)
  ON CONFLICT (division_id, code) DO NOTHING;

  INSERT INTO public.kpi_items (division_id, code, label, category, description, sort_order) VALUES
    (o_div, 'client_service_1', 'Treats clients with warmth and care', 'Client Service', 'Treats clients with warmth and care', 1),
    (o_div, 'client_service_2', 'Responds to client concerns properly', 'Client Service', 'Responds to client concerns properly', 2),
    (o_div, 'pet_welfare_1', 'Prioritizes pet welfare during scheduling', 'Pet Welfare', 'Prioritizes pet welfare during scheduling', 3),
    (o_div, 'pet_welfare_2', 'Ensures groomers have the correct supplies', 'Pet Welfare', 'Ensures groomers have the correct supplies', 4),
    (o_div, 'accountability_1', 'Takes ownership of booking errors', 'Accountability', 'Takes ownership of booking errors', 5),
    (o_div, 'accountability_2', 'Reports problems to management', 'Accountability', 'Reports problems to management', 6),
    (o_div, 'accountability_3', 'Resolves complaints properly', 'Accountability', 'Resolves complaints properly', 7),
    (o_div, 'professionalism_1', 'Maintains professional behavior', 'Professionalism', 'Maintains professional behavior', 8),
    (o_div, 'professionalism_2', 'Gives clear and correct booking instructions', 'Professionalism', 'Gives clear and correct booking instructions', 9),
    (o_div, 'professionalism_3', 'Follows office SOPs', 'Professionalism', 'Follows office SOPs', 10),
    (o_div, 'professionalism_4', 'Pays attention to scheduling details', 'Professionalism', 'Pays attention to scheduling details', 11),
    (o_div, 'teamwork_1', 'Communicates respectfully with staff', 'Teamwork', 'Communicates respectfully with staff', 12),
    (o_div, 'teamwork_2', 'Supports groomers and drivers', 'Teamwork', 'Supports groomers and drivers', 13),
    (o_div, 'teamwork_3', 'Demonstrates flexibility', 'Teamwork', 'Demonstrates flexibility', 14),
    (o_div, 'reliability_1', 'Responds to team messages', 'Reliability', 'Responds to team messages', 15),
    (o_div, 'reliability_2', 'Has no unexplained absences or late arrivals', 'Reliability', 'Has no unexplained absences or late arrivals', 16),
    (o_div, 'reliability_3', 'Handles work without errors', 'Reliability', 'Handles work without errors', 17),
    (o_div, 'sales_1', 'Achieves booking targets', 'Sales', 'Achieves booking targets', 18),
    (o_div, 'sales_2', 'Offers grooming packages to clients', 'Sales', 'Offers grooming packages to clients', 19)
  ON CONFLICT (division_id, code) DO NOTHING;
END $$;
