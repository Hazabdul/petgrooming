import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { Employee, Van } from '@/lib/types';
import { monthLabel, mulkiyaStatus } from '@/lib/constants';
import { PageHeader, Loading, ErrorState } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const now = new Date();

interface DashboardData {
  totalEmployees: number;
  totalGroomers: number;
  totalDrivers: number;
  totalOfficeStaff: number;
  avgKpiPct: number;
  ratingCounts: { outstanding: number; strong: number; developing: number; action_needed: number; not_evaluated: number };
  totalVans: number;
  vansCheckedToday: number;
  vansNotCheckedToday: number;
  vansWithIssues: number;
  expiringMulkiya: number;
  divisionAverages: { name: string; percentage: number }[];
  vanCompletion: { week: string; checked: number }[];
}

const RATING_COLORS: Record<string, string> = {
  outstanding: '#f59e0b',
  strong: '#10b981',
  developing: '#f59e0b',
  action_needed: '#ef4444',
  not_evaluated: '#9ca3af',
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: employees } = await supabase.from('employees').select('*, division:divisions(*)') as { data: Employee[] | null };
        const { data: vans } = await supabase.from('vans').select('*') as { data: Van[] | null };
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const [{ data: em }, { data: evals }, { data: todayChecks }] = await Promise.all([
          supabase.from('evaluation_months').select('id').eq('month', now.getMonth() + 1).eq('year', now.getFullYear()).maybeSingle(),
          supabase.from('employee_evaluations').select('division_id, percentage, rating, division:divisions(*)'),
          supabase.from('daily_van_checks').select('id, van_id, overall_status').eq('check_date', todayStr),
        ]);

        const empList = employees ?? [];
        const vanList = vans ?? [];
        const evalList = evals ?? [];
        const checkedVanIds = new Set((todayChecks ?? []).map((c) => c.van_id));
        const checkedToday = (todayChecks ?? []).length;
        const issuesToday = (todayChecks ?? []).filter((c) => c.overall_status === 'red' || c.overall_status === 'amber').length;

        const divisionAverages: { name: string; percentage: number }[] = [];
        const divisions = ['Groomers', 'Drivers', 'Office Staff'];
        const evalRows = evalList as unknown as { division: { id: string; name: string }; percentage: number; rating: string }[];
        const divisionIds = new Map<string, string>();
        evalRows.forEach((e) => divisionIds.set(e.division.name, e.division.id));
        divisions.forEach((name) => {
          const divEvals = evalRows.filter((e) => e.division.name === name && e.percentage > 0);
          const avg = divEvals.length > 0 ? divEvals.reduce((a, e) => a + e.percentage, 0) / divEvals.length : 0;
          divisionAverages.push({ name, percentage: Math.round(avg * 10) / 10 });
        });

        const ratedEvals = evalRows.filter((e) => e.percentage > 0);
        const avgPct = ratedEvals.length > 0 ? ratedEvals.reduce((a, e) => a + e.percentage, 0) / ratedEvals.length : 0;

        const ratingCounts = { outstanding: 0, strong: 0, developing: 0, action_needed: 0, not_evaluated: 0 };
        evalRows.forEach((e) => {
          if (e.rating in ratingCounts) (ratingCounts as Record<string, number>)[e.rating]++;
        });

        const expiringMulkiya = vanList.filter((v) => {
          const ms = mulkiyaStatus(v.mulkiya_expiry_date);
          return ms === 'expired' || ms === 'expiring_soon';
        }).length;

        const vanCompletion: { week: string; checked: number }[] = [];
        for (let w = 0; w < 4; w++) {
          const weekStart = new Date(now.getFullYear(), now.getMonth(), w * 7 + 1);
          const weekEnd = new Date(now.getFullYear(), now.getMonth(), Math.min((w + 1) * 7, daysInMonth()));
          if (weekStart > now && w > 0) break;
          const startStr = dateOf(weekStart);
          const endStr = dateOf(weekEnd);
          const { count } = await supabase
            .from('daily_van_checks')
            .select('id', { count: 'exact', head: true })
            .gte('check_date', startStr)
            .lte('check_date', endStr);
          vanCompletion.push({ week: `Week ${w + 1}`, checked: count ?? 0 });
        }

        setData({
          totalEmployees: empList.length,
          totalGroomers: empList.filter((e) => e.division?.code === 'groomers').length,
          totalDrivers: empList.filter((e) => e.division?.code === 'drivers').length,
          totalOfficeStaff: empList.filter((e) => e.division?.code === 'office_staff').length,
          avgKpiPct: Math.round(avgPct * 10) / 10,
          ratingCounts,
          totalVans: vanList.length,
          vansCheckedToday: checkedToday,
          vansNotCheckedToday: Math.max(0, vanList.length - checkedToday),
          vansWithIssues: issuesToday,
          expiringMulkiya,
          divisionAverages,
          vanCompletion,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Outstanding', value: data.ratingCounts.outstanding, fill: RATING_COLORS.outstanding },
      { name: 'Strong', value: data.ratingCounts.strong, fill: RATING_COLORS.strong },
      { name: 'Developing', value: data.ratingCounts.developing, fill: RATING_COLORS.developing },
      { name: 'Action Needed', value: data.ratingCounts.action_needed, fill: RATING_COLORS.action_needed },
      { name: 'Not Evaluated', value: data.ratingCounts.not_evaluated, fill: RATING_COLORS.not_evaluated },
    ].filter((d) => d.value > 0);
  }, [data]);

  if (loading) return <Loading label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`${monthLabel(now.getMonth() + 1)} ${now.getFullYear()}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total employees" value={data.totalEmployees} accent="sky" />
        <StatCard title="Total groomers" value={data.totalGroomers} accent="cyan" />
        <StatCard title="Total drivers" value={data.totalDrivers} accent="emerald" />
        <StatCard title="Office staff" value={data.totalOfficeStaff} accent="blue" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Avg KPI %" value={`${data.avgKpiPct.toFixed(1)}%`} accent="sky" />
        <StatCard title="Outstanding" value={data.ratingCounts.outstanding} accent="amber" />
        <StatCard title="Strong" value={data.ratingCounts.strong} accent="emerald" />
        <StatCard title="Developing" value={data.ratingCounts.developing} accent="orange" />
        <StatCard title="Action needed" value={data.ratingCounts.action_needed} accent="red" />
        <StatCard title="Not evaluated" value={data.ratingCounts.not_evaluated} accent="gray" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total vans" value={data.totalVans} accent="sky" />
        <StatCard title="Checked today" value={data.vansCheckedToday} accent="emerald" />
        <StatCard title="Not checked today" value={data.vansNotCheckedToday} accent="amber" />
        <StatCard title="Vans with issues" value={data.vansWithIssues} accent="red" />
      </div>

      {data.expiringMulkiya > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span className="font-semibold">{data.expiringMulkiya}</span> van(s) have Mulkiya expiring soon or already expired. Check the Vans page for details.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Average performance by division</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.divisionAverages} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="percentage" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Employee rating distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No ratings yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Monthly van inspection completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.vanCompletion} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="checked" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function daysInMonth() {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function dateOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ACCENTS: Record<string, string> = {
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-700',
};

function StatCard({ title, value, accent }: { title: string; value: string | number; accent: string }) {
  return (
    <div className={`rounded-lg border p-4 ${ACCENTS[accent] ?? ACCENTS.sky}`}>
      <p className="text-xs font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
