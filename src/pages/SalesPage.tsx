import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDivisions, useEmployees, useVans } from '@/hooks/use-data';
import type { SalesRecord } from '@/lib/types';
import { DEFAULT_SALES_TARGET, MONTHS } from '@/lib/constants';
import { PageHeader, Loading, EmptyState, ErrorState, CardSection } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const now = new Date();

interface FormState {
  employee_id: string;
  team: string;
  van_id: string;
  sales_target: string;
  actual_sales: string;
  notes: string;
}

export function SalesPage() {
  const { divisions } = useDivisions();
  const { employees } = useEmployees();
  const { vans } = useVans();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalesRecord | null>(null);
  const [form, setForm] = useState<FormState>({
    employee_id: '', team: '', van_id: '', sales_target: String(DEFAULT_SALES_TARGET), actual_sales: '0', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalesRecord | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('sales_records')
      .select('*, employee:employees(*), van:vans(*)')
      .eq('month', month).eq('year', year)
      .order('created_at');
    if (e) setError(e.message);
    setRecords((data as SalesRecord[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, year]);

  const openAdd = () => {
    setEditing(null);
    setForm({ employee_id: '', team: '', van_id: '', sales_target: String(DEFAULT_SALES_TARGET), actual_sales: '0', notes: '' });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (r: SalesRecord) => {
    setEditing(r);
    setForm({
      employee_id: r.employee_id ?? '',
      team: r.team ?? '',
      van_id: r.van_id ?? '',
      sales_target: String(r.sales_target),
      actual_sales: String(r.actual_sales),
      notes: r.notes ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const target = Number(form.sales_target);
    const actual = Number(form.actual_sales);
    if (!Number.isFinite(target) || !Number.isFinite(actual)) {
      setFormError('Target and actual must be valid numbers.');
      return;
    }
    const pct = target > 0 ? Math.round((actual / target) * 10000) / 100 : 0;
    setSaving(true);
    setFormError(null);
    const payload = {
      month, year,
      employee_id: form.employee_id || null,
      team: form.team.trim() || null,
      van_id: form.van_id || null,
      sales_target: target,
      actual_sales: actual,
      achievement_percentage: pct,
      notes: form.notes.trim() || null,
    };
    let result;
    if (editing) {
      result = await supabase.from('sales_records').update(payload).eq('id', editing.id);
    } else {
      result = await supabase.from('sales_records').insert(payload);
    }
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setDialogOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error: e } = await supabase.from('sales_records').delete().eq('id', deleteTarget.id);
    if (e) { alert(e.message); return; }
    setDeleteTarget(null);
    load();
  };

  const totalTarget = records.reduce((a, r) => a + Number(r.sales_target), 0);
  const totalActual = records.reduce((a, r) => a + Number(r.actual_sales), 0);
  const totalDiff = totalActual - totalTarget;
  const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  if (loading) return <Loading label="Loading sales records..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Tracking"
        subtitle="Track monthly sales targets and achievement. Default target: AED 48,600."
        actions={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add record</Button>}
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
        </div>
      </CardSection>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total target" value={`AED ${totalTarget.toLocaleString()}`} />
        <StatCard label="Total actual" value={`AED ${totalActual.toLocaleString()}`} />
        <StatCard label="Difference" value={`AED ${totalDiff.toLocaleString()}`} className={totalDiff >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        <StatCard label="Achievement" value={`${totalPct.toFixed(1)}%`} className={totalPct >= 100 ? 'text-emerald-600' : 'text-amber-600'} />
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No sales records"
          description="Add a sales record for this month."
          action={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add record</Button>}
        />
      ) : (
        <div className="overflow-x-auto scrollbar-thin rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee / Team</TableHead>
                <TableHead>Van</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Achievement</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const diff = Number(r.actual_sales) - Number(r.sales_target);
                const pct = Number(r.achievement_percentage);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.employee?.name ?? r.team ?? '—'}
                    </TableCell>
                    <TableCell>{r.van?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">{Number(r.sales_target).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(r.actual_sales).toLocaleString()}</TableCell>
                    <TableCell className={cn('text-right font-medium', diff >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-semibold', pct >= 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                        {pct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.notes ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit sales record' : 'Add sales record'}</DialogTitle>
            <DialogDescription>{MONTHS[month - 1]} {year}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select value={form.employee_id || '__none'} onValueChange={(v) => setForm({ ...form, employee_id: v === '__none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select employee (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No specific employee</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Team</Label>
                <Input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="e.g. Van 1 Team" />
              </div>
              <div className="grid gap-2">
                <Label>Van</Label>
                <Select value={form.van_id || '__none'} onValueChange={(v) => setForm({ ...form, van_id: v === '__none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select van (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No van</SelectItem>
                    {vans.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Sales target (AED)</Label>
                <Input type="number" value={form.sales_target} onChange={(e) => setForm({ ...form, sales_target: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Actual sales (AED)</Label>
                <Input type="number" value={form.actual_sales} onChange={(e) => setForm({ ...form, actual_sales: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales record?</AlertDialogTitle>
            <AlertDialogDescription>This record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={cn('mt-2 text-xl font-bold', className)}>{value}</div>
    </div>
  );
}
