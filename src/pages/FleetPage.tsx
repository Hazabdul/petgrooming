import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useVans } from '@/hooks/use-data';
import type { DailyVanCheck, DailyVanCheckItem, Van } from '@/lib/types';
import { MONTHS, MONTHS_SHORT, mulkiyaStatus } from '@/lib/constants';
import { MULKIYA_STYLES, MULKIYA_LABELS, VanStatusBadge } from '@/components/status-badges';
import { PageHeader, Loading, EmptyState, CardSection } from '@/components/common';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const now = new Date();

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

interface IssueRow {
  date: string;
  van_name: string;
  driver_name: string;
  item_label: string;
  status: string;
  remarks: string | null;
}

export function FleetPage() {
  const { vans, loading: vansLoading } = useVans();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [checksByVan, setChecksByVan] = useState<Record<string, DailyVanCheck[]>>({});
  const [itemsByCheck, setItemsByCheck] = useState<Record<string, DailyVanCheckItem[]>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(month, year)}`;
    const { data: checks, error } = await supabase
      .from('daily_van_checks')
      .select('*, van:vans(*)')
      .gte('check_date', start)
      .lte('check_date', end);
    if (error) { setLoading(false); return; }
    const byVan: Record<string, DailyVanCheck[]> = {};
    (checks ?? []).forEach((c) => {
      const cid = (c as DailyVanCheck).van_id;
      if (!byVan[cid]) byVan[cid] = [];
      byVan[cid].push(c as DailyVanCheck);
    });
    setChecksByVan(byVan);
    if (checks && checks.length > 0) {
      const { data: itemRows } = await supabase
        .from('daily_van_check_items')
        .select('*')
        .in('check_id', checks.map((c) => (c as DailyVanCheck).id));
      const byCheck: Record<string, DailyVanCheckItem[]> = {};
      (itemRows ?? []).forEach((it) => {
        const cid = (it as DailyVanCheckItem).check_id;
        if (!byCheck[cid]) byCheck[cid] = [];
        byCheck[cid].push(it as DailyVanCheckItem);
      });
      setItemsByCheck(byCheck);
    } else {
      setItemsByCheck({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, year]);

  const driverName = (van: Van) => van.assigned_driver?.name ?? '—';

  const issues: IssueRow[] = useMemo(() => {
    const out: IssueRow[] = [];
    Object.values(checksByVan).forEach((vanChecks) => {
      vanChecks.forEach((c) => {
        const items = itemsByCheck[c.id] ?? [];
        items.forEach((it) => {
          if (it.status === 'action_needed' || it.status === 'yes' || it.status === 'expired' || it.status === 'monitor' || it.status === 'expiring_soon') {
            out.push({
              date: c.check_date,
              van_name: c.van?.name ?? vans.find((v) => v.id === c.van_id)?.name ?? '—',
              driver_name: driverName(vans.find((v) => v.id === c.van_id) as Van),
              item_label: it.item_label,
              status: it.status ?? '',
              remarks: it.remarks ?? c.remarks,
            });
          }
        });
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [checksByVan, itemsByCheck, vans]);

  const statsForVan = (van: Van) => {
    const vanChecks = checksByVan[van.id] ?? [];
    const counts = { green: 0, amber: 0, red: 0, gray: 0 };
    const totalDays = daysInMonth(month, year);
    const loggedDates = new Set(vanChecks.map((c) => c.check_date));
    for (let d = 1; d <= totalDays; d++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (loggedDates.has(ds)) {
        const c = vanChecks.find((x) => x.check_date === ds);
        if (c) counts[c.overall_status]++;
      } else {
        counts.gray++;
      }
    }
    const daysChecked = vanChecks.length;
    const daysWithIssues = vanChecks.filter((c) => c.overall_status === 'red' || c.overall_status === 'amber').length;
    return { counts, daysChecked, daysWithIssues, totalDays };
  };

  if (vansLoading) return <Loading label="Loading fleet..." />;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <PageHeader title="Fleet Summary" subtitle={`Overview for ${MONTHS[month - 1]} ${year}.`} />

      <CardSection>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_SHORT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardSection>

      {loading ? (
        <Loading label="Loading fleet data..." />
      ) : vans.length === 0 ? (
        <EmptyState title="No vans" description="Add vans to see the fleet summary." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {vans.map((van) => {
              const s = statsForVan(van);
              const ms = mulkiyaStatus(van.mulkiya_expiry_date);
              const msKey = ms ?? 'no_expiry';
              return (
                <div key={van.id} className="rounded-lg border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{van.name}</h3>
                      <p className="text-xs text-muted-foreground">{van.plate_number ?? 'No plate'}</p>
                    </div>
                    <VanStatusBadge status={van.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <Field label="Driver" value={driverName(van)} />
                    <Field label="Groomer" value={van.assigned_groomer?.name ?? '—'} />
                    <Field label="Mileage" value={van.current_mileage.toLocaleString()} />
                    <Field label="Mulkiya" value={
                      <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold', MULKIYA_STYLES[msKey])}>
                        {MULKIYA_LABELS[msKey]}
                      </span>
                    } />
                    <Field label="Days checked" value={String(s.daysChecked)} />
                    <Field label="Days w/ issues" value={String(s.daysWithIssues)} />
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Monthly status</span>
                      <span>{s.totalDays} days</span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="bg-emerald-500" style={{ width: `${(s.counts.green / s.totalDays) * 100}%` }} />
                      <div className="bg-amber-500" style={{ width: `${(s.counts.amber / s.totalDays) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(s.counts.red / s.totalDays) * 100}%` }} />
                      <div className="bg-gray-300" style={{ width: `${(s.counts.gray / s.totalDays) * 100}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {s.counts.green}</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {s.counts.amber}</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {s.counts.red}</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" /> {s.counts.gray}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <CardSection title="Issues this month" description="All items flagged as Monitor, Action Needed, Accident, or Mulkiya issues.">
            {issues.length === 0 ? (
              <EmptyState title="No issues" description="No flagged items during this month." />
            ) : (
              <div className="overflow-x-auto scrollbar-thin rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Van</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((iss, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-xs">{iss.date}</TableCell>
                        <TableCell className="font-medium">{iss.van_name}</TableCell>
                        <TableCell>{iss.driver_name}</TableCell>
                        <TableCell>{iss.item_label}</TableCell>
                        <TableCell>
                          <span className="rounded border px-2 py-0.5 text-xs font-semibold capitalize" style={{}}>
                            {iss.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">{iss.remarks ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardSection>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
