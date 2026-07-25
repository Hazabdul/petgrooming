import { useState } from 'react';
import { Pencil, Plus, Search, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDivisions, useEmployees } from '@/hooks/use-data';
import type { Employee, EmployeeStatus } from '@/lib/types';
import { EMPLOYEE_STATUSES } from '@/lib/constants';
import { EmployeeStatusBadge } from '@/components/status-badges';
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

interface FormState {
  name: string;
  code: string;
  division_id: string;
  role: string;
  joining_date: string;
  status: EmployeeStatus;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '', code: '', division_id: '', role: '', joining_date: '', status: 'active', notes: '',
};

export function EmployeesPage() {
  const { divisions, loading: divLoading } = useDivisions();
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { employees, loading, error, reload } = useEmployees({
    divisionId: divisionFilter === 'all' ? undefined : divisionFilter,
    status: statusFilter,
    search: search.trim() || undefined,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [deactivateHasKpi, setDeactivateHasKpi] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, division_id: divisions[0]?.id ?? '' });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      name: emp.name,
      code: emp.code,
      division_id: emp.division_id,
      role: emp.role ?? '',
      joining_date: emp.joining_date ?? '',
      status: emp.status,
      notes: emp.notes ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.division_id) {
      setFormError('Name, code, and division are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      division_id: form.division_id,
      role: form.role.trim() || null,
      joining_date: form.joining_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    let result;
    if (editing) {
      result = await supabase.from('employees').update(payload).eq('id', editing.id);
    } else {
      result = await supabase.from('employees').insert(payload);
    }
    setSaving(false);
    if (result.error) {
      setFormError(result.error.message.includes('duplicate')
        ? 'An employee with this code already exists.'
        : result.error.message);
      return;
    }
    setDialogOpen(false);
    reload();
  };

  const checkKpiAndOpenDeactivate = async (emp: Employee) => {
    const { count } = await supabase
      .from('employee_evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', emp.id);
    setDeactivateHasKpi((count ?? 0) > 0);
    setDeactivateTarget(emp);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    const { error } = await supabase
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', deactivateTarget.id);
    setDeactivating(false);
    if (error) {
      alert(error.message);
      return;
    }
    setDeactivateTarget(null);
    reload();
  };

  if (loading || divLoading) return <Loading label="Loading employees..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle="Manage your grooming, driver, and office staff records."
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add employee
          </Button>
        }
      />

      <CardSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Division" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All divisions</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {EMPLOYEE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardSection>

      {employees.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="Add your first employee or adjust the filters above."
          action={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add employee</Button>}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{emp.code}</TableCell>
                  <TableCell>{emp.division?.name ?? '—'}</TableCell>
                  <TableCell>{emp.role ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{emp.joining_date ?? '—'}</TableCell>
                  <TableCell><EmployeeStatusBadge status={emp.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(emp)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {emp.status !== 'inactive' && (
                        <Button variant="ghost" size="icon" onClick={() => checkKpiAndOpenDeactivate(emp)} title="Deactivate">
                          <UserCog className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit employee' : 'Add employee'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the employee record.' : 'Create a new employee record.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="emp-name">Name *</Label>
              <Input id="emp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="emp-code">Code *</Label>
                <Input id="emp-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. GR-001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-div">Division *</Label>
                <Select value={form.division_id} onValueChange={(v) => setForm({ ...form, division_id: v })}>
                  <SelectTrigger id="emp-div"><SelectValue placeholder="Select division" /></SelectTrigger>
                  <SelectContent>
                    {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="emp-role">Role / Title</Label>
                <Input id="emp-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Senior Groomer" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-joined">Joining date</Label>
                <Input id="emp-joined" type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EmployeeStatus })}>
                <SelectTrigger id="emp-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-notes">Notes</Label>
              <Textarea id="emp-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateHasKpi
                ? 'This employee has KPI records, so they will not be deleted. They will be marked as Inactive and hidden from active lists, but their historical data is preserved.'
                : 'The employee will be marked as Inactive. You can re-activate them later by editing their record.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              disabled={deactivating}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
