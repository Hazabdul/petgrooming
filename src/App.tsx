import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/pages/LoginPage';
import { AppLayout } from '@/components/AppLayout';
import { Loading } from '@/components/common';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { KpiPage } from '@/pages/KpiPage';
import { KpiSummaryPage } from '@/pages/KpiSummaryPage';
import { SalesPage } from '@/pages/SalesPage';
import { VansPage } from '@/pages/VansPage';
import { ChecklistPage } from '@/pages/ChecklistPage';
import { MonthlyVanPage } from '@/pages/MonthlyVanPage';
import { FleetPage } from '@/pages/FleetPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MyKpiPage } from '@/pages/MyKpiPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ImportPage } from '@/pages/ImportPage';

function getHashPage(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h || 'dashboard';
}

function AppShell() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState(getHashPage());

  useEffect(() => {
    const onHash = () => setPage(getHashPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (p: string) => {
    window.location.hash = `/${p}`;
    setPage(p);
  };

  if (loading) return <Loading label="Loading..." />;

  if (!session) return <LoginPage />;

  if (session && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Loading label="Setting up your profile..." />
        <p className="max-w-sm text-sm text-muted-foreground">
          If this persists, your account may not have a profile yet. Please contact an administrator.
        </p>
      </div>
    );
  }

  const role = profile!.role;
  let effectivePage = page;
  if (role === 'employee' && !['my-kpi'].includes(page)) effectivePage = 'my-kpi';
  if (role === 'driver' && !['checklist'].includes(page)) effectivePage = 'checklist';
  if ((role === 'admin' || role === 'manager') && page === 'my-kpi') effectivePage = 'dashboard';

  const renderPage = () => {
    switch (effectivePage) {
      case 'dashboard': return <DashboardPage />;
      case 'employees': return <EmployeesPage />;
      case 'kpi': return <KpiPage />;
      case 'kpi-summary': return <KpiSummaryPage />;
      case 'my-kpi': return <MyKpiPage />;
      case 'sales': return <SalesPage />;
      case 'vans': return <VansPage />;
      case 'checklist': return <ChecklistPage />;
      case 'monthly-van': return <MonthlyVanPage />;
      case 'fleet': return <FleetPage />;
      case 'reports': return <ReportsPage />;
      case 'import': return <ImportPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AppLayout activePage={effectivePage} onNavigate={navigate}>
      {renderPage()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
