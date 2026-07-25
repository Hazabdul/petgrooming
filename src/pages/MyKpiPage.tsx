import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { EvaluationMonth, KpiItem, Rating } from '@/lib/types';
import { MONTHS, SCORE_LABELS } from '@/lib/constants';
import { RatingBadge } from '@/components/status-badges';
import { PageHeader, Loading, EmptyState, CardSection } from '@/components/common';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const now = new Date();

interface ScoreRow {
  kpi_item_id: string;
  score: number | null;
  kpi_item: KpiItem;
}

export function MyKpiPage() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [evalData, setEvalData] = useState<{
    id: string; total_score: number; max_score: number; percentage: number;
    rating: Rating; notes: string | null; status: string;
  } | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);

  useEffect(() => {
    (async () => {
      if (!profile?.employee_id) { setNoProfile(true); setLoading(false); return; }
      setLoading(true);
      setNoProfile(false);
      const { data: em } = await supabase
        .from('evaluation_months').select('id').eq('month', month).eq('year', year).maybeSingle();
      if (!em) { setEvalData(null); setScores([]); setLoading(false); return; }
      const { data: ev } = await supabase
        .from('employee_evaluations')
        .select('id, total_score, max_score, percentage, rating, notes, status')
        .eq('employee_id', profile.employee_id)
        .eq('evaluation_month_id', em.id)
        .maybeSingle();
      if (!ev) { setEvalData(null); setScores([]); setLoading(false); return; }
      setEvalData(ev as typeof evalData);
      const { data: scoreRows } = await supabase
        .from('evaluation_scores')
        .select('kpi_item_id, score, kpi_item:kpi_items(*)')
        .eq('evaluation_id', ev.id);
      setScores((scoreRows as unknown as ScoreRow[]) ?? []);
      setLoading(false);
    })();
  }, [month, year, profile]);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  if (loading) return <Loading label="Loading your KPI results..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="My KPI Results" subtitle="View your monthly performance evaluation." />

      {noProfile ? (
        <EmptyState title="Not linked" description="Your account is not linked to an employee record. Please ask a manager to link your account." />
      ) : (
        <>
          <CardSection>
            <div className="flex flex-col gap-3 sm:flex-row">
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

          {!evalData ? (
            <EmptyState title="No results" description={`No KPI evaluation found for ${MONTHS[month - 1]} ${year}.`} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <StatBox label="Total" value={evalData.total_score} />
                <StatBox label="Max" value={evalData.max_score} />
                <StatBox label="Percentage" value={`${evalData.percentage.toFixed(1)}%`} />
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <div className="mt-2"><RatingBadge rating={evalData.rating} /></div>
                </div>
              </div>

              <CardSection title="Score breakdown">
                <div className="overflow-x-auto scrollbar-thin rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>KPI Criterion</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead>Meaning</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scores.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No scores recorded</TableCell></TableRow>
                      ) : scores.map((s) => (
                        <TableRow key={s.kpi_item_id}>
                          <TableCell className="font-medium">{s.kpi_item.label}</TableCell>
                          <TableCell className="text-muted-foreground">{s.kpi_item.category ?? '—'}</TableCell>
                          <TableCell className="text-center font-semibold">{s.score ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{s.score ? SCORE_LABELS[s.score] : 'Not scored'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardSection>

              {evalData.notes && (
                <CardSection title="Manager notes">
                  <p className="text-sm whitespace-pre-wrap">{evalData.notes}</p>
                </CardSection>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
