'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Network, MessageCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined })
      });

      if (!response.ok) {
        setError(await response.text());
        return;
      }

      router.push('/console');
      router.refresh();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full bg-secondary dark:bg-primary/10 border-none focus:ring-2 focus:ring-primary focus:outline-none text-foreground px-4 py-3 rounded-sm transition-all text-[14px] placeholder:text-muted-foreground/30';

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background relative">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[1100px] grid md:grid-cols-2 gap-0 overflow-hidden rounded-xl border border-border bg-muted shadow-lg dark:shadow-[0_0_15px_rgba(6,198,86,0.2)]">
        {/* Left panel — branding */}
        <div className="hidden md:flex flex-col justify-between p-12 bg-card relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,_rgba(6,198,86,0.2)_0%,_transparent_70%)]" />
          </div>

          <div className="relative z-10">
            <Link href="/" className="flex items-center gap-2 mb-8 w-fit">
              <Network className="size-7 text-primary" />
              <span className="text-xl font-black tracking-tighter text-primary uppercase">
                AgentJ
              </span>
            </Link>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-6">
              Synthetic Photosynthesis for Webhooks.
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-md">
              Deploy high-density event streams with the world&apos;s most efficient routing engine.
              Scale from zero to billions of requests with biological precision.
            </p>
          </div>

          {/* System status card */}
          <div className="relative z-10 bg-primary/5 p-6 rounded-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
                System Status
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground font-medium">Global Throughput</span>
                <span className="text-primary font-bold">14.2M req/s</span>
              </div>
              <div className="w-full bg-primary/10 h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[85%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — registration form */}
        <div className="p-8 md:p-12 bg-muted flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Create your AgentJ account
            </h1>
            <p className="text-muted-foreground text-[14px]">
              Start building your technical ecosystem today.
            </p>
          </div>

          <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="fullname"
                className="text-[12px] font-bold tracking-wider text-primary uppercase"
              >
                Full Name
              </label>
              <input
                id="fullname"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Linus Torvalds"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[12px] font-bold tracking-wider text-primary uppercase"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="dev@stitch.network"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[12px] font-bold tracking-wider text-primary uppercase"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className={inputClass}
                placeholder="••••••••••••"
              />
            </div>

            {/* Terms */}
            <div className="flex items-center gap-3 py-2">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
                className="w-4 h-4 bg-secondary dark:bg-primary/10 border-border rounded-sm text-primary focus:ring-primary"
              />
              <label htmlFor="terms" className="text-[12px] text-muted-foreground leading-tight">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            {error ? (
              <p className="text-sm text-destructive font-medium">{error}</p>
            ) : null}

            {/* Primary action */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-sm font-extrabold tracking-tight text-[16px] hover:shadow-[0_0_20px_rgba(6,198,86,0.3)] transition-all active:scale-[0.98] duration-100 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Get Started'}
            </button>

            {/* Divider */}
            <div className="relative py-4 flex items-center gap-4">
              <div className="flex-grow h-[1px] bg-border" />
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase">
                Or continue with
              </span>
              <div className="flex-grow h-[1px] bg-border" />
            </div>

            {/* LINE signup */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-primary/10 text-primary py-3 rounded-sm font-bold border border-primary/20 hover:bg-primary/20 transition-all"
            >
              <MessageCircle className="size-5" style={{ fill: 'currentColor' }} />
              LINE
            </button>

            <p className="text-center text-[13px] text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
