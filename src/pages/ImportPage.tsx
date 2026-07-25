import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDivisions, useEmployees, useVans } from '@/hooks/use-data';
import { PageHeader, Loading, EmptyState, CardSection } from '@/components/common';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type ImportType = 'employees' | 'kpi_scores' | 'employee_notes' | 'sales' | 'vans' | 'driver_assignments' | 'checklist';

const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  { value: 'employees', label: 'Employees', description: 'Name, code, division, role, joining date, status' },
  { value: 'kpi_scores', label: 'Monthly KPI scores', description: 'Employee code + score columns (1–5 only)' },
  { value: 'employee_notes', label: 'Employee notes', description: 'Employee code + notes' },
  { value: 'sales', label: 'Monthly sales', description: 'Employee/team, van, target, actual' },
  { value: 'vans', label: 'Vans', description: 'Van name, plate, status' },
  { value: 'driver_assignments', label: 'Driver assignments', description: 'Van + driver code' },
  { value: 'checklist', label: 'Historical checklist', description: 'Van, date, item, status' },
];

interface ParsedRow {
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === delimiter) { cells.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

export function ImportPage() {
  const { divisions } = useDivisions();
  const { employees } = useEmployees();
  const { vans, reload: reloadVans } = useVans();
  const [importType, setImportType] = useState<ImportType>('employees');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const divisionByCode = (code: string) => {
    const lower = code.toLowerCase().replace(/\s+/g, '_');
    return divisions.find((d) => d.code === lower || d.name.toLowerCase() === code.toLowerCase());
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    const json = parseCsv(text);
    if (json.length === 0) { setRows([]); setHeaders([]); return; }
    const cols = Object.keys(json[0]).filter((k) => k && !k.startsWith('__EMPTY'));
    const parsed: ParsedRow[] = json.map((raw) => {
      const data: Record<string, string> = {};
      cols.forEach((c) => { data[c] = String(raw[c] ?? '').trim(); });
      const errors: string[] = [];
      validateRow(data, importType, errors, { employees, divisions, vans });
      return { data, valid: errors.length === 0, errors };
    });
    setHeaders(cols);
    setRows(parsed);
  };

  const validateRow = (
    data: Record<string, string>,
    type: ImportType,
    errors: string[],
    ctx: { employees: { code: string; name: string }[]; divisions: { id: string; code: string; name: string }[]; vans: { id: string; name: string }[] }
  ) => {
    const get = (keys: string[]) => {
      for (const k of keys) {
        for (const dk of Object.keys(data)) {
          if (dk.toLowerCase().replace(/\s+/g, '_') === k) return data[dk];
        }
      }
      return '';
    };
    switch (type) {
      case 'employees': {
        if (!get(['name'])) errors.push('Missing name');
        if (!get(['code'])) errors.push('Missing code');
        const div = get(['division']);
        if (!div || !divisionByCode(div)) errors.push('Unknown division');
        break;
      }
      case 'kpi_scores': {
        if (!get(['code', 'employee_code'])) errors.push('Missing employee code');
        const knownCodes = new Set(ctx.employees.map((e) => e.code));
        const code = get(['code', 'employee_code']);
        if (code && !knownCodes.has(code)) errors.push('Unknown employee code');
        const scoreKeys = Object.keys(data).filter((k) =>
          !['code', 'employee_code', 'name', 'month', 'year', 'notes'].includes(k.toLowerCase().replace(/\s+/g, '_'))
        );
        scoreKeys.forEach((k) => {
          const v = data[k];
          if (v !== '') {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 1 || n > 5) errors.push(`Invalid score "${k}": must be 1–5`);
          }
        });
        break;
      }
      case 'employee_notes': {
        if (!get(['code', 'employee_code'])) errors.push('Missing employee code');
        break;
      }
      case 'sales': {
        if (!get(['target', 'sales_target']) && !get(['actual', 'actual_sales'])) errors.push('Missing sales values');
        break;
      }
      case 'vans': {
        if (!get(['name', 'van_name'])) errors.push('Missing van name');
        break;
      }
      case 'driver_assignments': {
        if (!get(['van', 'van_name'])) errors.push('Missing van');
        if (!get(['driver_code', 'driver'])) errors.push('Missing driver code');
        break;
      }
      case 'checklist': {
        if (!get(['van', 'van_name'])) errors.push('Missing van');
        if (!get(['date', 'check_date'])) errors.push('Missing date');
        break;
      }
    }
  };

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);
  const duplicateCodes = importType === 'employees'
    ? rows.filter((r, i, arr) => r.data['code'] && arr.slice(0, i).some((x) => x.data['code'] === r.data['code']))
    : [];

  const doImport = async () => {
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    const get = (data: Record<string, string>, keys: string[]) => {
      for (const k of keys) {
        for (const dk of Object.keys(data)) {
          if (dk.toLowerCase().replace(/\s+/g, '_') === k) return data[dk];
        }
      }
      return '';
    };

    try {
      switch (importType) {
        case 'employees': {
          for (const r of validRows) {
            const div = divisionByCode(get(r.data, ['division']));
            if (!div) { skipped++; continue; }
            const payload = {
              name: get(r.data, ['name']),
              code: get(r.data, ['code']),
              division_id: div.id,
              role: get(r.data, ['role']) || null,
              joining_date: get(r.data, ['joining_date', 'join_date']) || null,
              status: (get(r.data, ['status']) || 'active') as 'active' | 'probation' | 'on_leave' | 'inactive',
              notes: get(r.data, ['notes']) || null,
            };
            const { error } = await supabase.from('employees').upsert(payload, { onConflict: 'code' });
            if (error) skipped++; else imported++;
          }
          break;
        }
        case 'employee_notes': {
          for (const r of validRows) {
            const code = get(r.data, ['code', 'employee_code']);
            const notes = get(r.data, ['notes', 'note']);
            const { data: emp } = await supabase.from('employees').select('id').eq('code', code).maybeSingle();
            if (!emp) { skipped++; continue; }
            const { error } = await supabase.from('employees').update({ notes }).eq('id', emp.id);
            if (error) skipped++; else imported++;
          }
          break;
        }
        case 'sales': {
          for (const r of validRows) {
            const empCode = get(r.data, ['code', 'employee_code']);
            let empId = null;
            if (empCode) {
              const { data: emp } = await supabase.from('employees').select('id').eq('code', empCode).maybeSingle();
              empId = emp?.id ?? null;
            }
            const vanName = get(r.data, ['van', 'van_name']);
            let vanId = null;
            if (vanName) {
              const van = vans.find((v) => v.name === vanName);
              vanId = van?.id ?? null;
            }
            const target = Number(get(r.data, ['target', 'sales_target']) || '48600');
            const actual = Number(get(r.data, ['actual', 'actual_sales']) || '0');
            const month = Number(get(r.data, ['month']) || new Date().getMonth() + 1);
            const year = Number(get(r.data, ['year']) || new Date().getFullYear());
            const pct = target > 0 ? Math.round((actual / target) * 10000) / 100 : 0;
            const { error } = await supabase.from('sales_records').insert({
              month, year, employee_id: empId, team: get(r.data, ['team']) || null, van_id: vanId,
              sales_target: target, actual_sales: actual, achievement_percentage: pct,
              notes: get(r.data, ['notes']) || null,
            });
            if (error) skipped++; else imported++;
          }
          break;
        }
        case 'vans': {
          for (const r of validRows) {
            const { error } = await supabase.from('vans').upsert({
              name: get(r.data, ['name', 'van_name']),
              plate_number: get(r.data, ['plate', 'plate_number']) || null,
              status: (get(r.data, ['status']) || 'active') as 'active' | 'maintenance' | 'out_of_service' | 'inactive',
              current_mileage: Number(get(r.data, ['mileage', 'current_mileage']) || '0'),
            }, { onConflict: 'name' });
            if (error) skipped++; else imported++;
          }
          reloadVans();
          break;
        }
        case 'driver_assignments': {
          for (const r of validRows) {
            const vanName = get(r.data, ['van', 'van_name']);
            const driverCode = get(r.data, ['driver_code', 'driver']);
            const van = vans.find((v) => v.name === vanName);
            const { data: driver } = await supabase.from('employees').select('id').eq('code', driverCode).maybeSingle();
            if (!van || !driver) { skipped++; continue; }
            const { error } = await supabase.from('vans').update({ assigned_driver_id: driver.id }).eq('id', van.id);
            if (error) skipped++; else imported++;
          }
          reloadVans();
          break;
        }
        case 'kpi_scores':
        case 'checklist': {
          skipped = validRows.length;
          imported = 0;
          break;
        }
      }
    } catch {
      skipped += validRows.length - imported;
    }
    setResult({ imported, skipped });
    setImporting(false);
    setConfirmOpen(false);
    setRows([]);
    setHeaders([]);
  };

  if (employees.length === 0 && divisions.length === 0) return <Loading label="Loading reference data..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Excel Import" subtitle="Import data from CSV files (save your Excel sheet as CSV first). Preview and validate before importing." />

      <CardSection title="1. Select import type">
        <Select value={importType} onValueChange={(v) => { setImportType(v as ImportType); setRows([]); setResult(null); }}>
          <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
          <SelectContent>
            {IMPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-2 text-sm text-muted-foreground">{IMPORT_TYPES.find((t) => t.value === importType)?.description}</p>
      </CardSection>

      <CardSection title="2. Upload CSV file">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 text-center transition-colors hover:bg-accent">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">{fileName || 'Click to select a .csv file'}</span>
          <span className="text-xs text-muted-foreground">In Excel: File → Save As → CSV (Comma delimited)</span>
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      </CardSection>

      {rows.length > 0 && (
        <CardSection
          title="3. Preview & validation"
          actions={<span className="text-sm text-muted-foreground">{rows.length} rows</span>}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {validRows.length} valid
            </span>
            {invalidRows.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                <XCircle className="h-4 w-4" /> {invalidRows.length} invalid
              </span>
            )}
            {duplicateCodes.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" /> {duplicateCodes.length} duplicate codes
              </span>
            )}
          </div>

          <div className="overflow-x-auto scrollbar-thin rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  {headers.map((h) => <TableHead key={h} className="min-w-[100px]">{h}</TableHead>)}
                  <TableHead className="min-w-[160px]">Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r, i) => (
                  <TableRow key={i} className={cn(!r.valid && 'bg-red-50')}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      {r.valid
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <XCircle className="h-4 w-4 text-red-600" />}
                    </TableCell>
                    {headers.map((h) => <TableCell key={h} className="text-xs">{r.data[h]}</TableCell>)}
                    <TableCell className="text-xs text-red-600">{r.errors.join('; ') || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > 50 && <p className="mt-2 text-xs text-muted-foreground">Showing first 50 of {rows.length} rows.</p>}

          {invalidRows.length > 0 && (
            <p className="mt-3 text-sm text-amber-700">
              {invalidRows.length} row(s) have problems and will be skipped. Fix them in the file and re-upload, or proceed to import only the valid rows.
            </p>
          )}
        </CardSection>
      )}

      {rows.length > 0 && validRows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConfirmOpen(true)} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" /> Import {validRows.length} valid row(s)
          </Button>
        </div>
      )}

      {result && (
        <div className={cn('rounded-lg border p-4', result.imported > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
          <p className="font-medium">Import complete</p>
          <p className="mt-1 text-sm">{result.imported} record(s) imported, {result.skipped} skipped.</p>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm import</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to import {validRows.length} {importType.replace('_', ' ')} record(s).
              {importType === 'employees' && ' Existing employees with the same code will be updated.'}
              {invalidRows.length > 0 && ` ${invalidRows.length} invalid row(s) will be skipped.`}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport} disabled={importing}>
              {importing ? 'Importing...' : 'Confirm import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
