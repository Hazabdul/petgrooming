import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Rating, EmployeeStatus, VanStatus, OverallCheckStatus } from '@/lib/types';
import { ratingLabel } from '@/lib/constants';

const RATING_STYLES: Record<Rating, string> = {
  outstanding: 'bg-amber-400 text-amber-950 border-amber-500 hover:bg-amber-400',
  strong: 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-500',
  developing: 'bg-amber-500 text-white border-amber-600 hover:bg-amber-500',
  action_needed: 'bg-red-500 text-white border-red-600 hover:bg-red-500',
  not_evaluated: 'bg-gray-400 text-white border-gray-500 hover:bg-gray-400',
};

export function RatingBadge({ rating }: { rating: Rating }) {
  return <Badge className={cn('border', RATING_STYLES[rating])}>{ratingLabel(rating)}</Badge>;
}

const EMPLOYEE_STATUS_STYLES: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  probation: 'bg-blue-100 text-blue-700 border-blue-200',
  on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
  inactive: 'bg-gray-200 text-gray-600 border-gray-300',
};

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  probation: 'Probation',
  on_leave: 'On Leave',
  inactive: 'Inactive',
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <Badge className={EMPLOYEE_STATUS_STYLES[status]}>{EMPLOYEE_STATUS_LABELS[status]}</Badge>;
}

const VAN_STATUS_STYLES: Record<VanStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  maintenance: 'bg-amber-100 text-amber-700 border-amber-200',
  out_of_service: 'bg-red-100 text-red-700 border-red-200',
  inactive: 'bg-gray-200 text-gray-600 border-gray-300',
};

const VAN_STATUS_LABELS: Record<VanStatus, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  out_of_service: 'Out of Service',
  inactive: 'Inactive',
};

export function VanStatusBadge({ status }: { status: VanStatus }) {
  return <Badge className={VAN_STATUS_STYLES[status]}>{VAN_STATUS_LABELS[status]}</Badge>;
}

export const MULKIYA_STYLES: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expiring_soon: 'bg-amber-100 text-amber-700 border-amber-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
  no_expiry: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const MULKIYA_LABELS: Record<string, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  no_expiry: 'No Date',
};

export const CHECK_STATUS_STYLES: Record<OverallCheckStatus, string> = {
  green: 'bg-emerald-500 text-white border-emerald-600',
  amber: 'bg-amber-500 text-white border-amber-600',
  red: 'bg-red-500 text-white border-red-600',
  gray: 'bg-gray-400 text-white border-gray-500',
};

export const CHECK_STATUS_LABELS: Record<OverallCheckStatus, string> = {
  green: 'All Good',
  amber: 'Monitor',
  red: 'Issue',
  gray: 'Not Logged',
};

export function CheckStatusBadge({ status }: { status: OverallCheckStatus }) {
  return <Badge className={cn('border', CHECK_STATUS_STYLES[status])}>{CHECK_STATUS_LABELS[status]}</Badge>;
}

export const ITEM_STATUS_STYLES: Record<string, string> = {
  good: 'bg-emerald-500 text-white border-emerald-600',
  monitor: 'bg-amber-500 text-white border-amber-600',
  action_needed: 'bg-red-500 text-white border-red-600',
  no: 'bg-emerald-500 text-white border-emerald-600',
  yes: 'bg-red-500 text-white border-red-600',
  valid: 'bg-emerald-500 text-white border-emerald-600',
  expiring_soon: 'bg-amber-500 text-white border-amber-600',
  expired: 'bg-red-500 text-white border-red-600',
};

export const ITEM_STATUS_LABELS: Record<string, string> = {
  good: 'Good',
  monitor: 'Monitor',
  action_needed: 'Action Needed',
  no: 'No',
  yes: 'Yes',
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
};
