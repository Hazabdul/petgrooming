export type Role = 'admin' | 'manager' | 'employee' | 'driver';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Division {
  id: string;
  code: 'groomers' | 'drivers' | 'office_staff';
  name: string;
  sort_order: number;
  created_at: string;
}

export type EmployeeStatus = 'active' | 'probation' | 'on_leave' | 'inactive';

export interface Employee {
  id: string;
  name: string;
  code: string;
  division_id: string;
  role: string | null;
  joining_date: string | null;
  status: EmployeeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  division?: Division;
}

export interface KpiItem {
  id: string;
  division_id: string;
  code: string;
  label: string;
  category: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface EvaluationMonth {
  id: string;
  month: number;
  year: number;
  is_locked: boolean;
  created_at: string;
  created_by: string | null;
}

export type Rating = 'outstanding' | 'strong' | 'developing' | 'action_needed' | 'not_evaluated';
export type EvaluationStatus = 'draft' | 'approved';

export interface EmployeeEvaluation {
  id: string;
  employee_id: string;
  evaluation_month_id: string;
  division_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  rating: Rating;
  notes: string | null;
  status: EvaluationStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  employee?: Employee;
  division?: Division;
}

export interface EvaluationScore {
  id: string;
  evaluation_id: string;
  kpi_item_id: string;
  score: number | null;
  created_at: string;
  updated_at: string;
  kpi_item?: KpiItem;
}

export interface SalesRecord {
  id: string;
  month: number;
  year: number;
  employee_id: string | null;
  team: string | null;
  van_id: string | null;
  sales_target: number;
  actual_sales: number;
  achievement_percentage: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  employee?: Employee;
  van?: Van;
}

export type VanStatus = 'active' | 'maintenance' | 'out_of_service' | 'inactive';

export interface Van {
  id: string;
  name: string;
  plate_number: string | null;
  assigned_driver_id: string | null;
  assigned_groomer_id: string | null;
  mulkiya_expiry_date: string | null;
  current_mileage: number;
  status: VanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  assigned_driver?: Employee | null;
  assigned_groomer?: Employee | null;
}

export interface VanAssignment {
  id: string;
  van_id: string;
  driver_id: string | null;
  groomer_id: string | null;
  assigned_from: string;
  assigned_to: string | null;
  created_at: string;
  created_by: string | null;
}

export type OverallCheckStatus = 'green' | 'amber' | 'red' | 'gray';

export interface DailyVanCheck {
  id: string;
  van_id: string;
  check_date: string;
  driver_id: string | null;
  groomer_id: string | null;
  previous_mileage: number | null;
  current_mileage: number | null;
  remarks: string | null;
  overall_status: OverallCheckStatus;
  is_submitted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  van?: Van;
  driver?: Employee | null;
  groomer?: Employee | null;
}

export type CheckItemType = 'normal' | 'accident' | 'mulkiya';
export type CheckItemStatus =
  | 'good'
  | 'monitor'
  | 'action_needed'
  | 'no'
  | 'yes'
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | null;

export interface DailyVanCheckItem {
  id: string;
  check_id: string;
  item_code: string;
  item_label: string;
  item_type: CheckItemType;
  status: CheckItemStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string | null;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
}
