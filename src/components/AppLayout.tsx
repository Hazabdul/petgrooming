import { useState } from 'react';
import { Cat, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { navItemsForRole } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export function AppLayout({ activePage, onNavigate, children }: AppLayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = profile ? navItemsForRole(profile.role) : [];
  const roleLabel = profile ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '';

  const handleNav = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        <div className="rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 p-2 text-white">
          <Cat className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Miss Meow</p>
          <p className="truncate text-xs text-muted-foreground">Management System</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-2 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
            {profile?.full_name?.charAt(0).toUpperCase() ?? profile?.email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? profile?.email}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">{SidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r bg-card shadow-xl">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 lg:hidden">
          <button
            className="flex items-center gap-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
            <span className="text-sm font-bold">Miss Meow</span>
          </button>
          {mobileOpen ? (
            <X className="h-5 w-5" onClick={() => setMobileOpen(false)} />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
              {profile?.full_name?.charAt(0).toUpperCase() ?? profile?.email.charAt(0).toUpperCase()}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
