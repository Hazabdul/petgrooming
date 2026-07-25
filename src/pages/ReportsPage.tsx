import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDivisions, useEmployees, useVans } from '@/hooks/use-data';
import { MONTHS, MONTHS_SHORT, mulkiyaStatus, ratingLabel } from '@/lib/constants';
import { PageHeader, Loading, EmptyState, CardSection } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { exportData } from '@/lib/export';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

const now = new Date();

type ReportType =
  | 'employee'
  | 'kpi_monthly'
  | 'employee_performance'
  | 'division_average'
  | 'rating'
  | 'sales_monthly'
  | 'sales_employee'
  | 'fleet_daily'
  | 'fleet_monthly'
  | 'van_issues'
  | 'mulkiya'
  | 'mileage';

const REPORTS: { value: ReportType; label: string; group: string }[] = [
  { value: 'employee', label: 'Employee report', group: 'Employee' },
  { value: 'kpi_monthly', label: 'Monthly KPI report', group: 'Employee' },
  { value: 'employee_performance', label: 'Employee performance report', group: 'Employee' },
  { value: 'division_average', label: 'Division average report', group: 'Employee' },
  { value: 'rating', label: 'Rating report', group: 'Employee' },
  { value: 'sales_monthly', label: 'Monthly target vs actual', group: 'Sales' },
  { value: 'sales_employee', label: 'Employee / team sales report', group: 'Sales' },
  { value: 'fleet_daily', label: 'Daily van checklist', group: 'Fleet' },
  { value: 'fleet_monthly', label: 'Monthly van checklist', group: 'Fleet' },
  { value: 'van_issues', label: 'Van issue report', group: 'Fleet' },
  { value: 'mulkiya', label: 'Mulkiya expiry report', group: 'Fleet' },
  { value: 'mileage', label: 'Mileage report', group: 'Fleet' },
];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function ReportsPage() {
  const { divisions } = useDivisions();
  const { employees } = useEmployees();
  const { vans } = useVans();
  const [reportType, setReportType] = useState<ReportType>('employee');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [divisionId, setDivisionId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  const [vanId, setVanId] = useState('all');
  const [rating, setRating] = useState('all');
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const runReport = async () => {
    setLoading(true);
    setLoaded(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(month, year)}`;

    let result: { rows: Record<string, unknown>[]; headers: { key: string; label: string }[] } = { rows: [], headers: [] };

    switch (reportType) {
      case 'employee': result = await employeeReport(divisions, divisionId, status); break;
      case 'kpi_monthly': result = await kpiMonthlyReport(month, year, divisionId, employees); break;
      case 'employee_performance': result = await employeePerformanceReport(month, year, employeeId); break;
      case 'division_average': result = await divisionAverageReport(month, year); break;
      case 'rating': result = await ratingReport(month, year, divisionId); break;
      case 'sales_monthly': result = await salesMonthlyReport(month, year); break;
      case 'sales_employee': result = await salesEmployeeReport(month, year, employeeId, employees); break;
      case 'fleet_daily': result = await fleetDailyReport(month, year, vanId); break;
      case 'fleet_monthly': result = await fleetMonthlyReport(month, year, vanId); break;
      case 'van_issues': result = await vanIssuesReport(start, end, vanId); break;
      case 'mulkiya': result = await mulkiyaReport(vans, vanId); break;
      case 'mileage': result = await mileageReport(vans, vanId); break;
    }
    setRows(result.rows);
    setHeaders(result.headers);
    setLoading(false);
  };

  const reportLabel = REPORTS.find((r) => r.value === reportType)?.label ?? 'Report';
  const baseName = `${reportType}_${MONTHS_SHORT[month - 1]}_${year}`;

  const needsMonth = !['employee', 'mulkiya', 'mileage'].includes(reportType);
  const needsDivision = ['employee', 'kpi_monthly', 'rating'].includes(reportType);
  const needsEmployee = ['employee_performance', 'sales_employee'].includes(reportType);
  const needsVan = ['fleet_daily', 'fleet_monthly', 'van_issues', 'mileage'].includes(reportType);
  const needsRating = ['rating'].includes(reportType);
  const needsStatus = ['employee'].includes(reportType);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Generate and export reports across the system." />

      <CardSection title="Report settings">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Report type</label>
            <Select value={reportType} onValueChange={(v) => { setReportType(v as ReportType); setLoaded(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {needsMonth && (
            <>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Month</label>
                <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setLoaded(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Year</label>
                <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setLoaded(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {needsDivision && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Division</label>
              <Select value={divisionId} onValueChange={(v) => { setDivisionId(v); setLoaded(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All divisions</SelectItem>
                  {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {needsEmployee && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Employee</label>
              <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setLoaded(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {needsVan && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Van</label>
              <Select value={vanId} onValueChange={(v) => { setVanId(v); setLoaded(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vans</SelectItem>
                  {vans.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {needsRating && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rating</label>
              <Select value={rating} onValueChange={(v) => { setRating(v); setLoaded(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ratings</SelectItem>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="strong">Strong</SelectItem>
                  <SelectItem value="developing">Developing</SelectItem>
                  <SelectItem value="action_needed">Action Needed</SelectItem>
                  <SelectItem value="not_evaluated">Not Evaluated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {needsStatus && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setLoaded(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={runReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate report'}
          </Button>
          {loaded && rows.length > 0 && (
            <>
              <Button variant="outline" onClick={() => exportData('excel', baseName, reportLabel, rows, headers)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" onClick={() => exportData('csv', baseName, reportLabel, rows, headers)}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" onClick={() => exportData('pdf', baseName, reportLabel, rows, headers)}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </CardSection>

      {loaded && !loading && rows.length === 0 && (
        <EmptyState title="No data" description="No records match the selected filters." />
      )}

      {loaded && !loading && rows.length > 0 && (
        <CardSection title={reportLabel} description={`${rows.length} record(s)`}>
          <div className="overflow-x-auto scrollbar-thin rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => <TableHead key={h.key}>{h.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {headers.map((h) => <TableCell key={h.key}>{String(row[h.key] ?? '—')}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardSection>
      )}
    </div>
  );
}

async function employeeReport(divisions: { id: string; name: string }[], divId: string, status: string) {
  let q = supabase.from('employees').select('name, code, role, joining_date, status, notes, division:divisions(name)');
  if (divId !== 'all') q = q.eq('division_id', divId);
  if (status !== 'all') q = q.eq('status', status);
  const { data } = await q.order('name');
  const headers = [
    { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'division', label: 'Division' },
    { key: 'role', label: 'Role' }, { key: 'joining_date', label: 'Joining date' }, { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' },
  ];
  const rows = (data ?? []).map((e: Record<string, unknown>) => ({
    name: e.name, code: e.code, division: (e.division as { name: string })?.name ?? '—',
    role: e.role ?? '—', joining_date: e.joining_date ?? '—', status: e.status, notes: e.notes ?? '—',
  }));
  return { rows, headers };
}

async function kpiMonthlyReport(month: number, year: number, divId: string, employees: { id: string; name: string }[]) {
  const { data: em } = await supabase.from('evaluation_months').select('id').eq('month', month).eq('year', year).maybeSingle();
  if (!em) return { rows: [], headers: [] as { key: string; label: string }[] };
  let q = supabase.from('employee_evaluations').select('employee_id, total_score, max_score, percentage, rating, notes, employee:employees(name)');
  if (divId !== 'all') q = q.eq('division_id', divId);
  const { data } = await q.eq('evaluation_month_id', em.id);
  const headers = [
    { key: 'employee', label: 'Employee' }, { key: 'total', label: 'Total' }, { key: 'max', label: 'Max' },
    { key: 'percentage', label: 'Percentage' }, { key: 'rating', label: 'Rating' }, { key: 'notes', label: 'Notes' },
  ];
  const rows = (data ?? []).map((e: Record<string, unknown>) => ({
    employee: (e.employee as { name: string })?.name ?? '—',
    total: e.total_score, max: e.max_score,
    percentage: `${Number(e.percentage).toFixed(1)}%`, rating: ratingLabel(e.rating as never),
    notes: e.notes ?? '—',
  }));
  return { rows, headers };
}

async function employeePerformanceReport(month: number, year: number, empId: string) {
  const { data: em } = await supabase.from('evaluation_months').select('id').eq('month', month).eq('year', year).maybeSingle();
  if (!em) return { rows: [], headers: [] as { key: string; label: string }[] };
  let q = supabase.from('employee_evaluations').select('employee_id, total_score, max_score, percentage, rating, notes, employee:employees(name, code)');
  q = q.eq('evaluation_month_id', em.id);
  if (empId !== 'all') q = q.eq('employee_id', empId);
  const { data } = await q;
  const headers = [
    { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'total', label: 'Total' },
    { key: 'max', label: 'Max' }, { key: 'percentage', label: 'Percentage' }, { key: 'rating', label: 'Rating' },
    { key: 'notes', label: 'Notes' },
  ];
  const rows = (data ?? []).map((e: Record<string, unknown>) => ({
    name: (e.employee as { name: string })?.name ?? '—', code: (e.employee as { code: string })?.code ?? '—',
    total: e.total_score, max: e.max_score, percentage: `${Number(e.percentage).toFixed(1)}%`,
    rating: ratingLabel(e.rating as never), notes: e.notes ?? '—',
  }));
  return { rows, headers };
}

async function divisionAverageReport(month: number, year: number) {
  const { data: em } = await supabase.from('evaluation_months').select('id').eq('month', month).eq('year', year).maybeSingle();
  if (!em) return { rows: [], headers: [] as { key: string; label: string }[] };
  const { data } = await supabase.from('employee_evaluations').select('percentage, division:divisions(name)').eq('evaluation_month_id', em.id);
  const groups: Record<string, number[]> = {};
  (data ?? []).forEach((e: Record<string, unknown>) => {
    const dn = (e.division as { name: string })?.name ?? 'Unknown';
    if (!groups[dn]) groups[dn] = [];
    if (Number(e.percentage) > 0) groups[dn].push(Number(e.percentage));
  });
  const headers = [{ key: 'division', label: 'Division' }, { key: 'count', label: 'Employees' }, { key: 'avg', label: 'Average %' }];
  const rows = Object.entries(groups).map(([division, pcts]) => ({
    division, count: pcts.length, avg: `${(pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1)}%`,
  }));
  return { rows, headers };
}

async function ratingReport(month: number, year: number, divId: string) {
  const { data: em } = await supabase.from('evaluation_months').select('id').eq('month', month).eq('year', year).maybeSingle();
  if (!em) return { rows: [], headers: [] as { key: string; label: string }[] };
  let q = supabase.from('employee_evaluations').select('rating, employee:employees(name), division:divisions(name)').eq('evaluation_month_id', em.id);
  if (divId !== 'all') q = q.eq('division_id', divId);
  const { data } = await q;
  const headers = [{ key: 'name', label: 'Employee' }, { key: 'division', label: 'Division' }, { key: 'rating', label: 'Rating' }];
  const rows = (data ?? []).map((e: Record<string, unknown>) => ({
    name: (e.employee as { name: string })?.name ?? '—',
    division: (e.division as { name: string })?.name ?? '—',
    rating: ratingLabel(e.rating as never),
  }));
  return { rows, headers };
}

async function salesMonthlyReport(month: number, year: number) {
  const { data } = await supabase.from('sales_records').select('employee:employees(name), team, van:vans(name), sales_target, actual_sales, achievement_percentage, notes').eq('month', month).eq('year', year);
  const headers = [
    { key: 'employee', label: 'Employee / Team' }, { key: 'van', label: 'Van' },
    { key: 'target', label: 'Target' }, { key: 'actual', label: 'Actual' },
    { key: 'achievement', label: 'Achievement %' }, { key: 'notes', label: 'Notes' },
  ];
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    employee: (r.employee as { name: string })?.name ?? r.team ?? '—',
    van: (r.van as { name: string })?.name ?? '—',
    target: r.sales_target, actual: r.actual_sales,
    achievement: `${Number(r.achievement_percentage).toFixed(1)}%`, notes: r.notes ?? '—',
  }));
  return { rows, headers };
}

async function salesEmployeeReport(month: number, year: number, empId: string, _employees: unknown[]) {
  let q = supabase.from('sales_records').select('employee:employees(name), team, van:vans(name), sales_target, actual_sales, achievement_percentage, notes').eq('month', month).eq('year', year);
  if (empId !== 'all') q = q.eq('employee_id', empId);
  const { data } = await q;
  const headers = [
    { key: 'employee', label: 'Employee / Team' }, { key: 'van', label: 'Van' },
    { key: 'target', label: 'Target' }, { key: 'actual', label: 'Actual' },
    { key: 'achievement', label: 'Achievement %' }, { key: 'notes', label: 'Notes' },
  ];
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    employee: (r.employee as { name: string })?.name ?? r.team ?? '—',
    van: (r.van as { name: string })?.name ?? '—',
    target: r.sales_target, actual: r.actual_sales,
    achievement: `${Number(r.achievement_percentage).toFixed(1)}%`, notes: r.notes ?? '—',
  }));
  return { rows, headers };
}

async function fleetDailyReport(month: number, year: number, vanId: string) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(month, year)}`;
  let q = supabase.from('daily_van_checks').select('check_date, van:vans(name), driver:employees!daily_van_checks_driver_id_fkey(name), current_mileage, remarks, overall_status, is_submitted').gte('check_date', start).lte('check_date', end);
  if (vanId !== 'all') q = q.eq('van_id', vanId);
  const { data } = await q.order('check_date');
  const headers = [
    { key: 'date', label: 'Date' }, { key: 'van', label: 'Van' }, { key: 'driver', label: 'Driver' },
    { key: 'mileage', label: 'Mileage' }, { key: 'status', label: 'Status' }, { key: 'submitted', label: 'Submitted' }, { key: 'remarks', label: 'Remarks' },
  ];
  const rows = (data ?? []).map((c: Record<string, unknown>) => ({
    date: c.check_date, van: (c.van as { name: string })?.name ?? '—',
    driver: (c.driver as { name: string })?.name ?? '—',
    mileage: c.current_mileage ?? '—', status: String(c.overall_status).replace('_', ' '),
    submitted: c.is_submitted ? 'Yes' : 'Draft', remarks: c.remarks ?? '—',
  }));
  return { rows, headers };
}

async function fleetMonthlyReport(month: number, year: number, vanId: string) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(month, year)}`;
  let q = supabase.from('daily_van_checks').select('check_date, van:vans(name), overall_status, current_mileage, is_submitted').gte('check_date', start).lte('check_date', end);
  if (vanId !== 'all') q = q.eq('van_id', vanId);
  const { data } = await q.order('check_date');
  const headers = [
    { key: 'date', label: 'Date' }, { key: 'van', label: 'Van' },
    { key: 'status', label: 'Status' }, { key: 'mileage', label: 'Mileage' }, { key: 'submitted', label: 'Submitted' },
  ];
  const rows = (data ?? []).map((c: Record<string, unknown>) => ({
    date: c.check_date, van: (c.van as { name: string })?.name ?? '—',
    status: String(c.overall_status).replace('_', ' '), mileage: c.current_mileage ?? '—',
    submitted: c.is_submitted ? 'Yes' : 'Draft',
  }));
  return { rows, headers };
}

async function vanIssuesReport(start: string, end: string, vanId: string) {
  let q = supabase.from('daily_van_checks').select('check_date, van:vans(name), driver:employees!daily_van_checks_driver_id_fkey(name), daily_van_check_items(item_label, status, remarks)').gte('check_date', start).lte('check_date', end);
  if (vanId !== 'all') q = q.eq('van_id', vanId);
  const { data } = await q;
  const headers = [
    { key: 'date', label: 'Date' }, { key: 'van', label: 'Van' }, { key: 'driver', label: 'Driver' },
    { key: 'item', label: 'Checklist item' }, { key: 'status', label: 'Status' }, { key: 'remarks', label: 'Remarks' },
  ];
  const rows: Record<string, unknown>[] = [];
  (data ?? []).forEach((c: Record<string, unknown>) => {
    const items = (c.daily_van_check_items as { item_label: string; status: string; remarks: string }[]) ?? [];
    items.filter((it) => ['action_needed', 'yes', 'expired', 'monitor', 'expiring_soon'].includes(it.status)).forEach((it) => {
      rows.push({
        date: c.check_date, van: (c.van as { name: string })?.name ?? '—',
        driver: (c.driver as { name: string })?.name ?? '—',
        item: it.item_label, status: it.status.replace('_', ' '), remarks: it.remarks ?? '—',
      });
    });
  });
  return { rows, headers };
}

async function mulkiyaReport(vans: { id: string; name: string; plate_number: string | null; mulkiya_expiry_date: string | null; status: string }[], vanId: string) {
  const headers = [
    { key: 'van', label: 'Van' }, { key: 'plate', label: 'Plate' },
    { key: 'expiry', label: 'Mulkiya expiry' }, { key: 'status', label: 'Status' },
  ];
  const filtered = vanId === 'all' ? vans : vans.filter((v) => v.id === vanId);
  const rows = filtered.map((v) => ({
    van: v.name, plate: v.plate_number ?? '—', expiry: v.mulkiya_expiry_date ?? '—',
    status: mulkiyaStatus(v.mulkiya_expiry_date) ?? 'no_expiry',
  }));
  return { rows, headers };
}

async function mileageReport(vans: { id: string; name: string; plate_number: string | null; current_mileage: number; status: string }[], vanId: string) {
  const headers = [
    { key: 'van', label: 'Van' }, { key: 'plate', label: 'Plate' },
    { key: 'mileage', label: 'Current mileage' }, { key: 'status', label: 'Status' },
  ];
  const filtered = vanId === 'all' ? vans : vans.filter((v) => v.id === vanId);
  const rows = filtered.map((v) => ({
    van: v.name, plate: v.plate_number ?? '—', mileage: v.current_mileage.toLocaleString(), status: v.status,
  }));
  return { rows, headers };
}
