import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Eraser, Save, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useVans } from '@/hooks/use-data';
import type { DailyVanCheck, DailyVanCheckItem, Van } from '@/lib/types';
import {
  CHECKLIST_ITEMS, mulkiyaStatus, computeOverallCheckStatus,
} from '@/lib/constants';
import { ITEM_STATUS_STYLES, ITEM_STATUS_LABELS, CheckStatusBadge } from '@/components/status-badges';
import { PageHeader, Loading, EmptyState, ErrorState, CardSection } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ItemStatus = DailyVanCheckItem['status'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const NORMAL_OPTIONS: ItemStatus[] = ['good', 'monitor', 'action_needed'];
const ACCIDENT_OPTIONS: ItemStatus[] = ['no', 'yes'];

export function ChecklistPage() {
  const { vans, loading: vansLoading } = useVans();
  const activeVans = vans.filter((v) => v.status === 'active' || v.status === 'maintenance');
  const [vanId, setVanId] = useState('');
  const [date, setDate] = useState(todayStr());

  const [van, setVan] = useState<Van | null>(null);
  const [check, setCheck] = useState<DailyVanCheck | null>(null);
  const [items, setItems] = useState<Record<string, ItemStatus>>({});
  const [currentMileage, setCurrentMileage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!vanId) { if (vans.length > 0 && !vanId) setVanId(vans[0].id); return; }
    const found = vans.find((v) => v.id === vanId) ?? null;
    setVan(found);
  }, [vanId, vans]);

  const loadCheck = async () => {
    if (!vanId || !date) return;
    setLoading(true);
    setError(null);
    setCheck(null);
    setItems({});
    setCurrentMileage('');
    setRemarks('');
    const { data: existing } = await supabase
      .from('daily_van_checks')
      .select('*')
      .eq('van_id', vanId)
      .eq('check_date', date)
      .maybeSingle();
    if (existing) {
      const c = existing as DailyVanCheck;
      setCheck(c);
      setCurrentMileage(c.current_mileage != null ? String(c.current_mileage) : '');
      setRemarks(c.remarks ?? '');
      const { data: itemRows } = await supabase
        .from('daily_van_check_items')
        .select('item_code, status')
        .eq('check_id', c.id);
      const itemMap: Record<string, ItemStatus> = {};
      (itemRows ?? []).forEach((r) => { itemMap[r.item_code] = r.status as ItemStatus; });
      setItems(itemMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (vanId && date) loadCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vanId, date]);

  const mulkiyaVal = useMemo(() => mulkiyaStatus(van?.mulkiya_expiry_date ?? null), [van]);

  const allItems = useMemo(() => {
    const map: Record<string, ItemStatus> = { ...items };
    if (mulkiyaVal) map['mulkiya_valid'] = mulkiyaVal;
    return map;
  }, [items, mulkiyaVal]);

  const overall = useMemo(() => {
    const typedItems = CHECKLIST_ITEMS.map((it) => ({
      item_type: it.type,
      status: it.type === 'mulkiya' ? (mulkiyaVal ?? null) : (allItems[it.code] ?? null),
    }));
    return computeOverallCheckStatus(typedItems);
  }, [allItems, mulkiyaVal]);

  const setItem = (code: string, status: ItemStatus) => {
    setItems((prev) => ({ ...prev, [code]: status }));
  };

  const markAllGood = () => {
    const next: Record<string, ItemStatus> = {};
    CHECKLIST_ITEMS.forEach((it) => {
      if (it.type === 'normal') next[it.code] = 'good';
      else if (it.type === 'accident') next[it.code] = 'no';
    });
    setItems(next);
  };

  const clearForm = () => {
    setItems({});
    setCurrentMileage('');
    setRemarks('');
    setConfirmClear(false);
  };

  const upsertCheck = async (submit: boolean): Promise<DailyVanCheck | null> => {
    if (!van) return null;
    setSaving(true);
    setError(null);
    const status = submit ? overall : 'gray';
    const payload = {
      van_id: van.id,
      check_date: date,
      driver_id: van.assigned_driver_id,
      groomer_id: van.assigned_groomer_id,
      previous_mileage: check?.current_mileage ?? van.current_mileage,
      current_mileage: currentMileage ? Number(currentMileage) : null,
      remarks: remarks.trim() || null,
      overall_status: status,
      is_submitted: submit,
    };
    let checkId = check?.id;
    if (checkId) {
      const { error: e } = await supabase.from('daily_van_checks').update(payload).eq('id', checkId);
      if (e) { setError(e.message); setSaving(false); return null; }
    } else {
      const { data, error: e } = await supabase.from('daily_van_checks').insert(payload).select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Failed to create check'); setSaving(false); return null; }
      checkId = data.id;
      setCheck(data);
    }
    if (!checkId) { setSaving(false); return null; }
    const itemRows = CHECKLIST_ITEMS.map((it) => ({
      check_id: checkId,
      item_code: it.code,
      item_label: it.label,
      item_type: it.type,
      status: it.type === 'mulkiya' ? (mulkiyaVal ?? null) : (items[it.code] ?? null),
    }));
    const { error: ie } = await supabase
      .from('daily_van_check_items')
      .upsert(itemRows, { onConflict: 'check_id,item_code' });
    if (ie) { setError(ie.message); setSaving(false); return null; }

    if (currentMileage) {
      const mileage = Number(currentMileage);
      if (Number.isFinite(mileage) && mileage > van.current_mileage) {
        await supabase.from('vans').update({ current_mileage: mileage }).eq('id', van.id);
      }
    }
    setSaving(false);
    setToast(submit ? 'Checklist submitted' : 'Draft saved');
    setTimeout(() => setToast(null), 2500);
    return check ? { ...check, ...payload } as DailyVanCheck : (await supabase.from('daily_van_checks').select('*').eq('id', checkId).maybeSingle()).data as DailyVanCheck;
  };

  if (vansLoading) return <Loading label="Loading vans..." />;

  if (activeVans.length === 0) return (
    <div className="space-y-6">
      <PageHeader title="Daily Van Checklist" />
      <EmptyState title="No active vans" description="Add or activate a van before completing a checklist." />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Van Checklist" subtitle="Complete the daily inspection for your van." />

      <CardSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="grid flex-1 gap-1.5">
            <Label className="text-xs">Van</Label>
            <Select value={vanId} onValueChange={setVanId}>
              <SelectTrigger><SelectValue placeholder="Select van" /></SelectTrigger>
              <SelectContent>
                {activeVans.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-44" />
          </div>
        </div>
      </CardSection>

      {van && (
        <CardSection title={van.name}>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <InfoItem label="Driver" value={van.assigned_driver?.name ?? 'Unassigned'} />
            <InfoItem label="Groomer" value={van.assigned_groomer?.name ?? 'Unassigned'} />
            <InfoItem label="Plate" value={van.plate_number ?? '—'} />
            <InfoItem label="Mulkiya expiry" value={van.mulkiya_expiry_date ?? '—'} />
            <InfoItem label="Previous mileage" value={check?.previous_mileage != null ? check.previous_mileage.toLocaleString() : van.current_mileage.toLocaleString()} />
            <div>
              <p className="text-xs text-muted-foreground">Mulkiya status</p>
              <span className={cn('mt-1 inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold', ITEM_STATUS_STYLES[mulkiyaVal ?? 'good'])}>
                {ITEM_STATUS_LABELS[mulkiyaVal ?? 'good']}
              </span>
            </div>
          </div>
        </CardSection>
      )}

      {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading ? (
        <Loading label="Loading checklist..." />
      ) : (
        <>
          <CardSection
            title="Checklist items"
            actions={
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <CheckStatusBadge status={overall} />
              </div>
            }
          >
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((it) => {
                const status = it.type === 'mulkiya' ? (mulkiyaVal ?? null) : (items[it.code] ?? null);
                const options = it.type === 'accident' ? ACCIDENT_OPTIONS : it.type === 'mulkiya' ? null : NORMAL_OPTIONS;
                return (
                  <div key={it.code} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium">{it.label}</span>
                    {it.type === 'mulkiya' ? (
                      <span className={cn('inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold', ITEM_STATUS_STYLES[status ?? 'good'])}>
                        {ITEM_STATUS_LABELS[status ?? 'good']}
                      </span>
                    ) : (
                      <div className="flex gap-1.5">
                        {options!.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setItem(it.code, opt)}
                            className={cn(
                              'rounded-md border px-3 py-1.5 text-xs font-semibold transition-all',
                              status === opt
                                ? ITEM_STATUS_STYLES[opt!] + ' scale-105'
                                : 'border-input bg-background text-muted-foreground hover:bg-accent'
                            )}
                          >
                            {ITEM_STATUS_LABELS[opt!]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardSection>

          <CardSection title="Mileage & remarks">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Current mileage</Label>
                <Input type="number" value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} placeholder="e.g. 45000" />
              </div>
              <div className="grid gap-2">
                <Label>Daily remarks</Label>
                <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any notes about today..." />
              </div>
            </div>
          </CardSection>

          <div className="sticky bottom-0 flex flex-wrap gap-2 rounded-lg border bg-card p-3 shadow-lg">
            <Button variant="outline" onClick={markAllGood} disabled={saving}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Mark all good
            </Button>
            <Button variant="outline" onClick={() => setConfirmClear(true)} disabled={saving}>
              <Eraser className="mr-2 h-4 w-4" /> Clear form
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => upsertCheck(false)} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> Save draft
            </Button>
            <Button onClick={() => upsertCheck(true)} disabled={saving}>
              {saving ? <CalendarCheck className="mr-2 h-4 w-4 animate-pulse" /> : <Send className="mr-2 h-4 w-4" />}
              Submit checklist
            </Button>
            {toast && <span className="ml-2 self-center text-sm font-medium text-emerald-600">{toast}</span>}
          </div>
        </>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the form?</AlertDialogTitle>
            <AlertDialogDescription>This will reset all item selections, mileage, and remarks for this checklist.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearForm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
