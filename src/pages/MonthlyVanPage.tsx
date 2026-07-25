import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useVans } from '@/hooks/use-data';
import type { DailyVanCheck, DailyVanCheckItem } from '@/lib/types';
import { MONTHS_SHORT } from '@/lib/constants';
import { ITEM_STATUS_STYLES, ITEM_STATUS_LABELS } from '@/components/status-badges';
import { PageHeader, Loading, EmptyState, CardSection } from '@/components/common';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const now = new Date();

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function MonthlyVanPage() {
  const { vans, loading: vansLoading } = useVans();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [vanId, setVanId] = useState('');
  const [checks, setChecks] = useState<Record<string, DailyVanCheck>>({});
  const [itemsByCheck, setItemsByCheck] = useState<Record<string, DailyVanCheckItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (!vanId && vans.length > 0) setVanId(vans[0].id);
  }, [vans, vanId]);

  const load = async () => {
    if (!vanId || !month || !year) return;
    setLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(month, year)}`;
    const { data, error } = await supabase
      .from('daily_van_checks')
      .select('*')
      .eq('van_id', vanId)
      .gte('check_date', start)
      .lte('check_date', end);
    if (error) { setLoading(false); return; }
    const checkMap: Record<string, DailyVanCheck> = {};
    (data ?? []).forEach((c) => { checkMap[c.check_date] = c as DailyVanCheck; });
    setChecks(checkMap);
    if (Object.keys(checkMap).length > 0) {
      const { data: itemRows } = await supabase
        .from('daily_van_check_items')
        .select('*')
        .in('check_id', Object.values(checkMap).map((c) => c.id));
      const byCheck: Record<string, DailyVanCheckItem[]> = {};
      (itemRows ?? []).forEach((it) => {
        if (!byCheck[it.check_id]) byCheck[it.check_id] = [];
        byCheck[it.check_id].push(it as DailyVanCheckItem);
      });
      setItemsByCheck(byCheck);
    } else {
      setItemsByCheck({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [vanId, month, year]);

  const days = useMemo(() => {
    const count = daysInMonth(month, year);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [month, year]);

  const dateStr = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const statusForDay = (day: number) => checks[dateStr(day)]?.overall_status ?? 'gray';

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const selectedCheck = selectedDay ? checks[dateStr(selectedDay)] : null;
  const selectedItems = selectedCheck ? itemsByCheck[selectedCheck.id] ?? [] : [];

  if (vansLoading) return <Loading label="Loading vans..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Monthly Van View" subtitle="See the daily checklist status across the month." />

      <CardSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
          <Select value={vanId} onValueChange={setVanId}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Select van" /></SelectTrigger>
            <SelectContent>
              {vans.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardSection>

      {!vanId ? (
        <EmptyState title="Select a van" description="Choose a van to view its monthly checklist." />
      ) : loading ? (
        <Loading label="Loading monthly data..." />
      ) : (
        <CardSection title={`${vans.find((v) => v.id === vanId)?.name ?? ''} — ${MONTHS_SHORT[month - 1]} ${year}`}>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 min-w-[140px] bg-card p-2 text-left font-medium text-muted-foreground">Item / Day</th>
                  {days.map((d) => (
                    <th key={d} className="min-w-[34px] p-1 text-center font-medium text-muted-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="sticky left-0 z-10 bg-card p-2 font-semibold">Overall</td>
                  {days.map((d) => {
                    const st = statusForDay(d);
                    return (
                      <td key={d} className="p-1 text-center">
                        <button
                          onClick={() => setSelectedDay(d)}
                          className={cn('h-7 w-7 rounded transition-transform hover:scale-110', ITEM_STATUS_STYLES[st])}
                          title={`${d} — ${ITEM_STATUS_LABELS[st]}`}
                        />
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b">
                  <td className="sticky left-0 z-10 bg-card p-2 text-muted-foreground">Mileage</td>
                  {days.map((d) => (
                    <td key={d} className="p-1 text-center text-[10px] text-muted-foreground">
                      {checks[dateStr(d)]?.current_mileage ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="sticky left-0 z-10 bg-card p-2 text-muted-foreground">Remarks</td>
                  {days.map((d) => (
                    <td key={d} className="max-w-[60px] truncate p-1 text-[10px] text-muted-foreground" title={checks[dateStr(d)]?.remarks ?? ''}>
                      {checks[dateStr(d)]?.remarks ?? '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend color="bg-emerald-500" label="Good / Valid" />
            <Legend color="bg-amber-500" label="Monitor / Expiring" />
            <Legend color="bg-red-500" label="Issue / Expired / Accident" />
            <Legend color="bg-gray-400" label="Not logged" />
          </div>
        </CardSection>
      )}

      <Dialog open={selectedDay !== null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{MONTHS_SHORT[month - 1]} {selectedDay}, {year}</DialogTitle>
            <DialogDescription>
              {selectedCheck ? `Overall: ${ITEM_STATUS_LABELS[selectedCheck.overall_status]}` : 'No checklist was logged for this day.'}
            </DialogDescription>
          </DialogHeader>
          {selectedCheck && (
            <div className="space-y-1.5">
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Mileage:</span> {selectedCheck.current_mileage?.toLocaleString() ?? '—'}</div>
                <div><span className="text-muted-foreground">Submitted:</span> {selectedCheck.is_submitted ? 'Yes' : 'Draft'}</div>
                {selectedCheck.remarks && <div className="col-span-2"><span className="text-muted-foreground">Remarks:</span> {selectedCheck.remarks}</div>}
              </div>
              {selectedItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{it.item_label}</span>
                  <span className={cn('rounded border px-2 py-0.5 text-xs font-semibold', ITEM_STATUS_STYLES[it.status ?? 'good'])}>
                    {ITEM_STATUS_LABELS[it.status ?? 'good']}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-3 w-3 rounded', color)} /> {label}
    </span>
  );
}
