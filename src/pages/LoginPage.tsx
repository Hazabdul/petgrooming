import { useState } from 'react';
import { Cat, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      setError(error.includes('Invalid login credentials')
        ? 'Incorrect email or password.'
        : error);
    }
  };

  const fillDemo = (em: string) => {
    setEmail(em);
    setPassword('missmeow123');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-white/80 shadow-xl backdrop-blur md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-sky-500 to-cyan-600 p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5">
              <Cat className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Miss Meow</p>
              <p className="text-xs text-sky-100">Mobile Pet Grooming</p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold leading-snug">
              The simple way to manage your grooming team.
            </h2>
            <p className="text-sm text-sky-100">
              Employee records, monthly KPI scores, sales tracking, and daily van checks — all in one place.
              No more spreadsheets.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Monthly KPI scoring for every division</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Daily van checklists for drivers</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Fleet, sales, and performance reports</li>
            </ul>
          </div>
          <p className="text-xs text-sky-100/80">© {new Date().getFullYear()} Miss Meow Mobile Pet Grooming</p>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <div className="rounded-xl bg-sky-500 p-2.5 text-white">
              <Cat className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold">Miss Meow</p>
              <p className="text-xs text-muted-foreground">Mobile Pet Grooming</p>
            </div>
          </div>

          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Enter your credentials to access the system.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@missmeow.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Sign in
                </Button>
              </form>

              <div className="mt-6 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Demo admin account</p>
                <p className="mt-1">Email: <span className="font-mono">admin@missmeow.com</span></p>
                <p>Password: <span className="font-mono">missmeow123</span></p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => fillDemo('admin@missmeow.com')}
                >
                  Fill admin credentials
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
