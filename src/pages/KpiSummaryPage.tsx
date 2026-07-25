import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDivisions } from '@/hooks/use-data';
import type { Division, Employee, EvaluationMonth, Rating } from '@/lib/types';
import { MONTHS } from '@/lib/constants';
import { RatingBadge } from '@/components/status-badges';
import { PageHeader, Loading, EmptyState, ErrorState, CardSection } from '@/components/common';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface EvalRow {
  id: string;
  employee_id: string;
  division_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  rating: Rating;
  notes: string | null;
  employee: Employee;
  division: Division;
}

const now = new Date();

export function KpiSummaryPage() {
  const { divisions } = useDivisions();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [divFilter, setDivFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data: em } = await supabase
        .from('evaluation_months').select('id').eq('month', month).eq('year', year).maybeSingle();
      if (!em) { setRows([]); setLoading(false); return; }
      const { data, error: e } = await supabase
        .from('employee_evaluations')
        .select('id, employee_id, division_id, total_score, max_score, percentage, rating, notes, employee:employees(*), division:divisions(*)')
        .eq('evaluation_month_id', em.id);
      if (e) { setError(e.message); setLoading(false); return; }
      setRows((data as unknown as EvalRow[]) ?? []);
      setLoading(false);
    })();
  }, [month, year]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (divFilter !== 'all' && r.division_id !== divFilter) return false;
      if (ratingFilter !== 'all' && r.rating !== ratingFilter) return false;
      if (empSearch.trim() && !r.employee.name.toLowerCase().includes(empSearch.toLowerCase())) return false;
      return true;
    });
  }, [rows, divFilter, ratingFilter, empSearch]);

  const summaries = useMemo(() => {
    return divisions.map((d) => {
      const divRows = rows.filter((r) => r.division_id === d.id);
      const count = divRows.length;
      const avgScore = count > 0 ? divRows.reduce((a, r) => a + r.total_score, 0) / count : 0;
      const avgPct = count > 0 ? divRows.reduce((a, r) => a + r.percentage, 0) / count : 0;
      const ratedRows = divRows.filter((r) => r.rating !== 'not_evaluated');
      let overall: Rating = 'not_evaluated';
      if (ratedRows.length > 0) {
        const avg = ratedRows.reduce((a, r) => a + r.percentage, 0) / ratedRows.length;
        overall = avg >= 90 ? 'outstanding' : avg >= 75 ? 'strong' : avg >= 60 ? 'developing' : 'action_needed';
      }
      return { division: d, count, avgScore: Math.round(avgScore * 10) / 10, avgPct: Math.round(avgPct * 10) / 10, overall };
    });
  }, [divisions, rows]);

  if (loading) return <Loading label="Loading KPI summary..." />;
  if (error) return <ErrorState message={error} />;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <PageHeader title="KPI Summary" subtitle="Overview of KPI performance across all divisions." />

      <CardSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
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

      <div className="grid gap-4 sm:grid-cols-3">
        {summaries.map((s) => (
          <div key={s.division.id} className="rounded-lg border bg-card p-5">
            <h3 className="font-semibold">{s.division.name}</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-sky-600">{s.count}</div>
                <div className="text-xs text-muted-foreground">Employees</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{s.avgScore.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Avg score</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{s.avgPct.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Avg %</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall rating</span>
              <RatingBadge rating={s.overall} />
            </div>
          </div>
        ))}
      </div>

      <CardSection title="Employee summary" description="Detailed KPI results for the selected month.">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Select value={divFilter} onValueChange={setDivFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Division" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All divisions</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Rating" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              <SelectItem value="outstanding">Outstanding</SelectItem>
              <SelectItem value="strong">Strong</SelectItem>
              <SelectItem value="developing">Developing</SelectItem>
              <SelectItem value="action_needed">Action Needed</SelectItem>
              <SelectItem value="not_evaluated">Not Evaluated</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search employee..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="w-full sm:w-56" />
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No evaluations found" description="No KPI data for the selected filters and month." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Max</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee.name}</TableCell>
                    <TableCell>{r.division.name}</TableCell>
                    <TableCell className="text-center">{r.total_score}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{r.max_score}</TableCell>
                    <TableCell className="text-center font-semibold">{r.percentage.toFixed(1)}%</TableCell>
                    <TableCell className="text-center"><RatingBadge rating={r.rating} /></TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">{r.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardSection>
    </div>
  );
}
