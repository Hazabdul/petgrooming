import { useState } from 'react';
import { Pencil, Plus, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useVans, useEmployees } from '@/hooks/use-data';
import type { Van, VanStatus } from '@/lib/types';
import { VAN_STATUSES, mulkiyaStatus } from '@/lib/constants';
import { VanStatusBadge, MULKIYA_STYLES, MULKIYA_LABELS } from '@/components/status-badges';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface FormState {
  name: string;
  plate_number: string;
  assigned_driver_id: string;
  assigned_groomer_id: string;
  mulkiya_expiry_date: string;
  current_mileage: string;
  status: VanStatus;
  notes: string;
}

export function VansPage() {
  const { vans, loading, error, reload } = useVans();
  const { employees } = useEmployees();
  const drivers = employees.filter((e) => e.division?.code === 'drivers' && e.status !== 'inactive');
  const groomers = employees.filter((e) => e.division?.code === 'groomers' && e.status !== 'inactive');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Van | null>(null);
  const [form, setForm] = useState<FormState>({
    name: '', plate_number: '', assigned_driver_id: '', assigned_groomer_id: '',
    mulkiya_expiry_date: '', current_mileage: '0', status: 'active', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', plate_number: '', assigned_driver_id: '', assigned_groomer_id: '', mulkiya_expiry_date: '', current_mileage: '0', status: 'active', notes: '' });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (van: Van) => {
    setEditing(van);
    setForm({
      name: van.name,
      plate_number: van.plate_number ?? '',
      assigned_driver_id: van.assigned_driver_id ?? '',
      assigned_groomer_id: van.assigned_groomer_id ?? '',
      mulkiya_expiry_date: van.mulkiya_expiry_date ?? '',
      current_mileage: String(van.current_mileage),
      status: van.status,
      notes: van.notes ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Van name is required.'); return; }
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      plate_number: form.plate_number.trim() || null,
      assigned_driver_id: form.assigned_driver_id || null,
      assigned_groomer_id: form.assigned_groomer_id || null,
      mulkiya_expiry_date: form.mulkiya_expiry_date || null,
      current_mileage: Number(form.current_mileage) || 0,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    let result;
    if (editing) {
      result = await supabase.from('vans').update(payload).eq('id', editing.id);
    } else {
      result = await supabase.from('vans').insert(payload);
    }
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setDialogOpen(false);
    reload();
  };

  if (loading) return <Loading label="Loading vans..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vans"
        subtitle="Manage your fleet, assign drivers and groomers, and track Mulkiya expiry."
        actions={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add van</Button>}
      />

      {vans.length === 0 ? (
        <EmptyState title="No vans" description="Add your first van." action={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add van</Button>} />
      ) : (
        <div className="overflow-x-auto scrollbar-thin rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Van</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Groomer</TableHead>
                <TableHead>Mulkiya</TableHead>
                <TableHead className="text-right">Mileage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vans.map((van) => {
                const ms = mulkiyaStatus(van.mulkiya_expiry_date);
                const msKey = ms ?? 'no_expiry';
                return (
                  <TableRow key={van.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        {van.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{van.plate_number ?? '—'}</TableCell>
                    <TableCell>{van.assigned_driver?.name ?? '—'}</TableCell>
                    <TableCell>{van.assigned_groomer?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={MULKIYA_STYLES[msKey]}>{MULKIYA_LABELS[msKey]}</Badge>
                      {van.mulkiya_expiry_date && <div className="mt-0.5 text-xs text-muted-foreground">{van.mulkiya_expiry_date}</div>}
                    </TableCell>
                    <TableCell className="text-right">{van.current_mileage.toLocaleString()}</TableCell>
                    <TableCell><VanStatusBadge status={van.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(van)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit van' : 'Add van'}</DialogTitle>
            <DialogDescription>{editing ? 'Update the van record.' : 'Create a new van record.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Van name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Van 9" />
              </div>
              <div className="grid gap-2">
                <Label>Plate number</Label>
                <Input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Assigned driver</Label>
                <Select value={form.assigned_driver_id || '__none'} onValueChange={(v) => setForm({ ...form, assigned_driver_id: v === '__none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No driver</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned groomer</Label>
                <Select value={form.assigned_groomer_id || '__none'} onValueChange={(v) => setForm({ ...form, assigned_groomer_id: v === '__none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select groomer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No groomer</SelectItem>
                    {groomers.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Mulkiya expiry date</Label>
                <Input type="date" value={form.mulkiya_expiry_date} onChange={(e) => setForm({ ...form, mulkiya_expiry_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Current mileage</Label>
                <Input type="number" value={form.current_mileage} onChange={(e) => setForm({ ...form, current_mileage: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as VanStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAN_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
    </div>
  );
}
