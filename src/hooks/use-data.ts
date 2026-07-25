import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Division, Employee, KpiItem, Van } from '@/lib/types';

export function useDivisions() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('divisions').select('*').order('sort_order');
    if (!error && data) setDivisions(data as Division[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { divisions, loading, reload: load };
}

export function useEmployees(filters?: { divisionId?: string; status?: string; search?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from('employees').select('*, division!inner(*)').order('name');
    if (filters?.divisionId) query = query.eq('division_id', filters.divisionId);
    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
    }
    const { data, error } = await query;
    if (error) setError(error.message);
    setEmployees((data as Employee[]) ?? []);
    setLoading(false);
  }, [filters?.divisionId, filters?.status, filters?.search]);

  useEffect(() => { load(); }, [load]);
  return { employees, loading, error, reload: load };
}

export function useKpiItems(divisionId?: string) {
  const [items, setItems] = useState<KpiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!divisionId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('kpi_items')
      .select('*')
      .eq('division_id', divisionId)
      .order('sort_order');
    if (!error && data) setItems(data as KpiItem[]);
    setLoading(false);
  }, [divisionId]);

  useEffect(() => { load(); }, [load]);
  return { kpiItems: items, loading, reload: load };
}

export function useVans() {
  const [vans, setVans] = useState<Van[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('vans')
      .select('*, assigned_driver:employees!vans_assigned_driver_id_fkey(*), assigned_groomer:employees!vans_assigned_groomer_id_fkey(*)')
      .order('name');
    if (error) setError(error.message);
    setVans((data as Van[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { vans, loading, error, reload: load };
}

export function useEmployeesByDivision(divisionCode: string) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*, division!inner(*)')
      .eq('division.code', divisionCode)
      .neq('status', 'inactive')
      .order('name');
    if (!error && data) setEmployees(data as Employee[]);
    setLoading(false);
  }, [divisionCode]);

  useEffect(() => { load(); }, [load]);
  return { employees, loading, reload: load };
}
