import type { Role } from '@/lib/types';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  ClipboardList,
  Truck,
  CalendarCheck,
  Ship,
  BarChart3,
  Upload,
  TrendingUp,
  ClipboardPen,
} from 'lucide-react';

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
  { id: 'employees', label: 'Employees', icon: Users, roles: ['admin', 'manager'] },
  { id: 'kpi', label: 'Monthly KPI', icon: ClipboardPen, roles: ['admin', 'manager'] },
  { id: 'kpi-summary', label: 'KPI Summary', icon: ClipboardList, roles: ['admin', 'manager'] },
  { id: 'my-kpi', label: 'My KPI Results', icon: ClipboardList, roles: ['employee'] },
  { id: 'sales', label: 'Sales Tracking', icon: TrendingUp, roles: ['admin', 'manager'] },
  { id: 'vans', label: 'Vans', icon: Truck, roles: ['admin', 'manager'] },
  { id: 'checklist', label: 'Daily Checklist', icon: CalendarCheck, roles: ['admin', 'manager', 'driver'] },
  { id: 'monthly-van', label: 'Monthly Van View', icon: CalendarCheck, roles: ['admin', 'manager'] },
  { id: 'fleet', label: 'Fleet Summary', icon: Ship, roles: ['admin', 'manager'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { id: 'import', label: 'Excel Import', icon: Upload, roles: ['admin'] },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
