import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDivisions } from '@/hooks/use-data';
import { useEmployeesByDivision } from '@/hooks/use-data';
import type { Employee, EvaluationMonth, KpiItem, Rating } from '@/lib/types';
import {
  MONTHS, SCORE_LABELS, computeEvaluation, ratingLabel,
} from '@/lib/constants';
import { RatingBadge } from '@/components/status-badges';
import { PageHeader, Loading, EmptyState, ErrorState, CardSection } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-500 text-white border-red-600',
  2: 'bg-orange-500 text-white border-orange-600',
  3: 'bg-amber-500 text-white border-amber-600',
  4: 'bg-sky-500 text-white border-sky-600',
  5: 'bg-emerald-500 text-white border-emerald-600',
};

const now = new Date();

export function KpiPage() {
  const { divisions } = useDivisions();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [divisionCode, setDivisionCode] = useState<'groomers' | 'drivers' | 'office_staff'>('groomers');

  const division = divisions.find((d) => d.code === divisionCode);
  const { employees, loading: empLoading } = useEmployeesByDivision(divisionCode);

  const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [evalMonth, setEvalMonth] = useState<EvaluationMonth | null>(null);
  const [evalMonthLoading, setEvalMonthLoading] = useState(true);

  const [evaluations, setEvaluations] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [dataError, setDataError] = useState<string | null>(null);
  const [mobileEmpIndex, setMobileEmpIndex] = useState(0);

  useEffect(() => {
    setItemsLoading(true);
    if (!division) { setKpiItems([]); setItemsLoading(false); return; }
    supabase.from('kpi_items').select('*').eq('division_id', division.id).order('sort_order')
      .then(({ data, error }) => {
        if (error) setDataError(error.message);
        setKpiItems((data as KpiItem[]) ?? []);
        setItemsLoading(false);
      });
  }, [division]);

  const ensureEvalMonth = useCallback(async (m: number, y: number): Promise<EvaluationMonth | null> => {
    setEvalMonthLoading(true);
    const { data: existing } = await supabase
      .from('evaluation_months').select('*').eq('month', m).eq('year', y).maybeSingle();
    if (existing) {
      setEvalMonthLoading(false);
      return existing as EvaluationMonth;
    }
    const { data: created, error } = await supabase
      .from('evaluation_months').insert({ month: m, year: y }).select().maybeSingle();
    setEvalMonthLoading(false);
    if (error) { setDataError(error.message); return null; }
    return created as EvaluationMonth;
  }, []);

  useEffect(() => {
    setMobileEmpIndex(0);
    setDataError(null);
    setEvaluations({}); setScores({}); setNotesMap({});
    ensureEvalMonth(month, year).then(loadData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, divisionCode, employees]);

  async function loadData(em: EvaluationMonth | null) {
    if (!em || !division || employees.length === 0) return;
    const { data: evals, error: e1 } = await supabase
      .from('employee_evaluations')
      .select('id, employee_id, notes, status')
      .eq('evaluation_month_id', em.id)
      .eq('division_id', division.id);
    if (e1) { setDataError(e1.message); return; }
    const evalByEmp: Record<string, string> = {};
    (evals ?? []).forEach((e) => { evalByEmp[e.employee_id] = e.id; });
    setEvaluations(evalByEmp);

    const notesByEmp: Record<string, string> = {};
    (evals ?? []).forEach((e) => { if (e.notes) notesByEmp[e.employee_id] = e.notes; });
    setNotesMap(notesByEmp);

    if (Object.keys(evalByEmp).length > 0) {
      const { data: scoreRows, error: e2 } = await supabase
        .from('evaluation_scores')
        .select('evaluation_id, kpi_item_id, score')
        .in('evaluation_id', Object.values(evalByEmp));
      if (e2) { setDataError(e2.message); return; }
      const scoreMap: Record<string, number | null> = {};
      (scoreRows ?? []).forEach((s) => {
        scoreMap[`${s.evaluation_id}:${s.kpi_item_id}`] = s.score;
      });
      setScores(scoreMap);
    } else {
      setScores({});
    }
  }

  const groupedItems = useMemo(() => {
    const groups: { category: string; items: KpiItem[] }[] = [];
    kpiItems.forEach((item) => {
      const cat = item.category ?? 'General';
      let g = groups.find((x) => x.category === cat);
      if (!g) { g = { category: cat, items: [] }; groups.push(g); }
      g.items.push(item);
    });
    return groups;
  }, [kpiItems]);

  async function ensureEvaluation(emp: Employee): Promise<string | null> {
    if (evaluations[emp.id]) return evaluations[emp.id];
    if (!evalMonth || !division) return null;
    const { data, error } = await supabase
      .from('employee_evaluations')
      .insert({
        employee_id: emp.id,
        evaluation_month_id: evalMonth.id,
        division_id: division.id,
        max_score: kpiItems.length * 5,
      })
      .select('id')
      .maybeSingle();
    if (error || !data) { setSaveStatus('failed'); return null; }
    setEvaluations((prev) => ({ ...prev, [emp.id]: data.id }));
    return data.id;
  }

  async function recomputeAndSave(evalId: string) {
    const itemScores = kpiItems.map((it) => scores[`${evalId}:${it.id}`] ?? null);
    const { total, max, percentage, rating } = computeEvaluation(itemScores, kpiItems.length);
    const empId = Object.entries(evaluations).find(([, eid]) => eid === evalId)?.[0];
    const notes = empId ? (notesMap[empId] ?? null) : null;
    await supabase
      .from('employee_evaluations')
      .update({ total_score: total, max_score: max, percentage, rating, notes })
      .eq('id', evalId);
  }

  const setScore = async (emp: Employee, item: KpiItem, score: number) => {
    setSaveStatus('saving');
    const evalId = await ensureEvaluation(emp);
    if (!evalId) return;
    const key = `${evalId}:${item.id}`;
    setScores((prev) => ({ ...prev, [key]: score }));
    const { error } = await supabase
      .from('evaluation_scores')
      .upsert({ evaluation_id: evalId, kpi_item_id: item.id, score }, { onConflict: 'evaluation_id,kpi_item_id' });
    if (error) { setSaveStatus('failed'); return; }
    await recomputeAndSave(evalId);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
  };

  const setNotes = async (emp: Employee, text: string) => {
    setNotesMap((prev) => ({ ...prev, [emp.id]: text }));
    setSaveStatus('saving');
    const evalId = await ensureEvaluation(emp);
    if (!evalId) return;
    await recomputeAndSave(evalId);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
  };

  const handleManualSave = async () => {
    setSaveStatus('saving');
    let failed = false;
    for (const emp of employees) {
      const evalId = await ensureEvaluation(emp);
      if (!evalId) { failed = true; continue; }
      await recomputeAndSave(evalId);
    }
    setSaveStatus(failed ? 'failed' : 'saved');
    setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
  };

  function empStats(emp: Employee) {
    const evalId = evaluations[emp.id];
    if (!evalId) return { total: 0, max: kpiItems.length * 5, percentage: 0, rating: 'not_evaluated' as Rating };
    const itemScores = kpiItems.map((it) => scores[`${evalId}:${it.id}`] ?? null);
    return computeEvaluation(itemScores, kpiItems.length);
  }

  if (itemsLoading || empLoading || evalMonthLoading) return <Loading label="Loading KPI data..." />;
  if (dataError) return <ErrorState message={dataError} />;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly KPI"
        subtitle="Score each employee from 1 to 5 on every criterion. Scores save automatically."
        actions={
          <div className="flex items-center gap-3">
            <SaveStatusBadge status={saveStatus} />
            <Button onClick={handleManualSave} variant="default" size="sm">
              <Save className="mr-2 h-4 w-4" /> Save all
            </Button>
          </div>
        }
      />

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
          <Select value={divisionCode} onValueChange={(v) => setDivisionCode(v as typeof divisionCode)}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {divisions.map((d) => <SelectItem key={d.id} value={d.code}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardSection>

      {employees.length === 0 ? (
        <EmptyState title="No active employees" description={`No active employees in ${division?.name}. Add employees first.`} />
      ) : kpiItems.length === 0 ? (
        <EmptyState title="No KPI criteria" description="KPI criteria have not been set up for this division." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card lg:block">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[180px] bg-card">Employee</TableHead>
                    {kpiItems.map((item) => (
                      <TableHead key={item.id} className="min-w-[110px] text-center">
                        <div className="font-medium">{item.label}</div>
                        {item.category && <div className="text-[10px] font-normal text-muted-foreground">{item.category}</div>}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[80px] text-center">Total</TableHead>
                    <TableHead className="min-w-[80px] text-center">Max</TableHead>
                    <TableHead className="min-w-[80px] text-center">%</TableHead>
                    <TableHead className="min-w-[130px] text-center">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const st = empStats(emp);
                    const evalId = evaluations[emp.id];
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="sticky left-0 z-10 bg-card font-medium">
                          {emp.name}
                          <div className="text-xs font-normal text-muted-foreground">{emp.code}</div>
                        </TableCell>
                        {kpiItems.map((item) => {
                          const val = evalId ? scores[`${evalId}:${item.id}`] ?? null : null;
                          return (
                            <TableCell key={item.id} className="text-center">
                              <ScoreSelector value={val} onChange={(s) => setScore(emp, item, s)} />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-semibold">{st.total}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{st.max}</TableCell>
                        <TableCell className="text-center font-semibold">{st.percentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-center"><RatingBadge rating={st.rating} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-4 lg:hidden">
            <div className="flex items-center justify-between rounded-lg border bg-card p-2">
              <Button variant="ghost" size="sm" onClick={() => setMobileEmpIndex((i) => Math.max(0, i - 1))} disabled={mobileEmpIndex === 0}>
                Prev
              </Button>
              <span className="text-sm font-medium">
                {mobileEmpIndex + 1} / {employees.length}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setMobileEmpIndex((i) => Math.min(employees.length - 1, i + 1))} disabled={mobileEmpIndex === employees.length - 1}>
                Next
              </Button>
            </div>
            {employees[mobileEmpIndex] && (
              <MobileEvaluation
                emp={employees[mobileEmpIndex]}
                groupedItems={groupedItems}
                evalId={evaluations[employees[mobileEmpIndex].id]}
                scores={scores}
                notes={notesMap[employees[mobileEmpIndex].id] ?? ''}
                stats={empStats(employees[mobileEmpIndex])}
                onScore={(item, s) => setScore(employees[mobileEmpIndex], item, s)}
                onNotes={(t) => setNotes(employees[mobileEmpIndex], t)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const map = {
    saving: { icon: Loader2, text: 'Saving', cls: 'bg-sky-100 text-sky-700' },
    saved: { icon: Check, text: 'Saved', cls: 'bg-emerald-100 text-emerald-700' },
    failed: { icon: X, text: 'Save failed', cls: 'bg-red-100 text-red-700' },
  };
  const { icon: Icon, text, cls } = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', cls)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} />
      {text}
    </span>
  );
}

function ScoreSelector({ value, onChange }: { value: number | null; onChange: (s: number) => void }) {
  return (
    <Select value={value !== null ? String(value) : '__none'} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn(
        'mx-auto h-9 w-[100px] border-2 font-semibold',
        value !== null ? SCORE_COLORS[value] : 'border-dashed text-muted-foreground'
      )}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Not scored</SelectItem>
        {[5, 4, 3, 2, 1].map((s) => (
          <SelectItem key={s} value={String(s)}>
            {s} — {SCORE_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MobileEvaluation({
  emp, groupedItems, evalId, scores, notes, stats, onScore, onNotes,
}: {
  emp: Employee;
  groupedItems: { category: string; items: KpiItem[] }[];
  evalId?: string;
  scores: Record<string, number | null>;
  notes: string;
  stats: { total: number; max: number; percentage: number; rating: Rating };
  onScore: (item: KpiItem, s: number) => void;
  onNotes: (text: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{emp.name}</h3>
          <p className="text-xs text-muted-foreground">{emp.code}</p>
        </div>
        <RatingBadge rating={stats.rating} />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md bg-muted p-2"><div className="font-semibold">{stats.total}</div><div className="text-xs text-muted-foreground">Total</div></div>
        <div className="rounded-md bg-muted p-2"><div className="font-semibold">{stats.max}</div><div className="text-xs text-muted-foreground">Max</div></div>
        <div className="rounded-md bg-muted p-2"><div className="font-semibold">{stats.percentage.toFixed(1)}%</div><div className="text-xs text-muted-foreground">Pct</div></div>
      </div>
      {groupedItems.map((g) => (
        <div key={g.category} className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.category}</p>
          {g.items.map((item) => {
            const val = evalId ? scores[`${evalId}:${item.id}`] ?? null : null;
            return (
              <div key={item.id} className="mb-2 flex items-center justify-between gap-2">
                <span className="flex-1 text-sm">{item.label}</span>
                <div className="w-[130px]"><ScoreSelector value={val} onChange={(s) => onScore(item, s)} /></div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</label>
        <Textarea rows={2} value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Add notes..." />
      </div>
    </div>
  );
}
