import type { Rating, Role, EmployeeStatus, VanStatus, CheckItemType } from './types';

export const DIVISIONS = [
  { code: 'groomers', name: 'Groomers' },
  { code: 'drivers', name: 'Drivers' },
  { code: 'office_staff', name: 'Office Staff' },
] as const;

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full access to everything' },
  { value: 'manager', label: 'Manager', description: 'KPI scores, reports, van checks, fleet reports' },
  { value: 'employee', label: 'Employee', description: 'View own approved KPI results' },
  { value: 'driver', label: 'Driver', description: 'Complete daily checklist for assigned van' },
];

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'probation', label: 'Probation' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
];

export const VAN_STATUSES: { value: VanStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'out_of_service', label: 'Out of Service' },
  { value: 'inactive', label: 'Inactive' },
];

export const DEFAULT_SALES_TARGET = 48600;
export const MULKIYA_EXPIRING_SOON_DAYS = 30;

export const SCORE_LABELS: Record<number, string> = {
  1: 'Unacceptable',
  2: 'Below Expectations',
  3: 'Developing',
  4: 'Meets Expectations',
  5: 'Exceeds Expectations',
};

export interface ChecklistItemDef {
  code: string;
  label: string;
  type: CheckItemType;
}

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { code: 'engine_condition', label: 'Engine Condition', type: 'normal' },
  { code: 'radiator_water', label: 'Radiator Water', type: 'normal' },
  { code: 'battery', label: 'Battery', type: 'normal' },
  { code: 'brake_condition', label: 'Brake Condition', type: 'normal' },
  { code: 'generator', label: 'Generator', type: 'normal' },
  { code: 'front_tires', label: 'Front Tires', type: 'normal' },
  { code: 'back_tires', label: 'Back Tires', type: 'normal' },
  { code: 'spare_wheel', label: 'Spare Wheel', type: 'normal' },
  { code: 'lights', label: 'Lights', type: 'normal' },
  { code: 'wipers', label: 'Wipers', type: 'normal' },
  { code: 'fire_extinguisher', label: 'Fire Extinguisher', type: 'normal' },
  { code: 'frontside_ac', label: 'Frontside A/C', type: 'normal' },
  { code: 'backside_ac', label: 'Backside A/C', type: 'normal' },
  { code: 'vacuum', label: 'Vacuum', type: 'normal' },
  { code: 'blow_dryer', label: 'Blow Dryer', type: 'normal' },
  { code: 'water_heater', label: 'Water Heater', type: 'normal' },
  { code: 'lavender_oil', label: 'Lavender Oil', type: 'normal' },
  { code: 'microchip_scanner', label: 'Microchip Scanner', type: 'normal' },
  { code: 'tools_kit', label: 'Tools Kit', type: 'normal' },
  { code: 'inside_clean', label: 'Inside Clean', type: 'normal' },
  { code: 'mulkiya_valid', label: 'Mulkiya Valid', type: 'mulkiya' },
  { code: 'accidents', label: 'Accidents', type: 'accident' },
];

export const RATING_RULES: { value: Rating; label: string; min: number; color: string }[] = [
  { value: 'outstanding', label: 'Outstanding', min: 90, color: 'gold' },
  { value: 'strong', label: 'Strong', min: 75, color: 'green' },
  { value: 'developing', label: 'Developing', min: 60, color: 'amber' },
  { value: 'action_needed', label: 'Action Needed', min: 0, color: 'red' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function monthLabel(m: number): string {
  return MONTHS[m - 1] ?? '';
}

export function ratingFromPercentage(percentage: number, hasScores: boolean): Rating {
  if (!hasScores) return 'not_evaluated';
  if (percentage >= 90) return 'outstanding';
  if (percentage >= 75) return 'strong';
  if (percentage >= 60) return 'developing';
  return 'action_needed';
}

export function ratingLabel(r: Rating): string {
  switch (r) {
    case 'outstanding': return 'Outstanding';
    case 'strong': return 'Strong';
    case 'developing': return 'Developing';
    case 'action_needed': return 'Action Needed';
    case 'not_evaluated': return 'Not Evaluated';
  }
}

export function ratingColor(r: Rating): string {
  switch (r) {
    case 'outstanding': return 'gold';
    case 'strong': return 'green';
    case 'developing': return 'amber';
    case 'action_needed': return 'red';
    case 'not_evaluated': return 'gray';
  }
}

export function computeEvaluation(scores: (number | null)[], itemCount: number) {
  const valid = scores.filter((s): s is number => s !== null && s >= 1 && s <= 5);
  const total = valid.reduce((a, b) => a + b, 0);
  const max = itemCount * 5;
  const pct = max > 0 ? (total / max) * 100 : 0;
  const rating = ratingFromPercentage(pct, valid.length > 0);
  return { total, max, percentage: Math.round(pct * 100) / 100, rating, hasScores: valid.length > 0 };
}

export function mulkiyaStatus(expiry: string | null, today = new Date()): 'valid' | 'expiring_soon' | 'expired' | null {
  if (!expiry) return null;
  const exp = new Date(expiry + 'T00:00:00');
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = exp.getTime() - todayMidnight.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= MULKIYA_EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'valid';
}

export function computeOverallCheckStatus(
  items: { item_type: CheckItemType; status: string | null }[]
): 'green' | 'amber' | 'red' | 'gray' {
  const completed = items.filter((i) => i.status !== null);
  if (completed.length === 0) return 'gray';
  const hasRed = completed.some(
    (i) =>
      i.status === 'action_needed' ||
      i.status === 'yes' ||
      i.status === 'expired'
  );
  if (hasRed) return 'red';
  const hasAmber = completed.some(
    (i) => i.status === 'monitor' || i.status === 'expiring_soon'
  );
  if (hasAmber) return 'amber';
  return 'green';
}
