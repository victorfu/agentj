'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Lock, Terminal, MessageCircle, Network } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
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

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-background">
      {/* Dot grid background — dark mode only */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-0 dark:opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[480px] z-10">
        {/* Login card */}
        <div className="bg-card border border-border p-8 md:p-12 shadow-lg dark:shadow-[0_10px_15px_-3px_rgba(6,198,86,0.2)] relative rounded-lg dark:rounded-none">
          {/* System Ready pulse */}
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-[10px] font-bold tracking-widest text-primary/60 uppercase">
              System Ready
            </span>
          </div>

          {/* Branding */}
          <div className="mb-10">
            <Link href="/" className="flex items-center gap-3 mb-6 w-fit">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                <Network className="size-6 text-primary" />
              </div>
              <span className="text-primary font-black tracking-tighter text-xl uppercase">
                AgentJ
              </span>
            </Link>
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-2">
              Sign in to AgentJ
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Synthetic photosynthesis for webhooks.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={(e) => void onSubmit(e)}>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                Network Endpoint (Email)
              </label>
              <div className="relative group">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-primary/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-secondary dark:bg-[#163020] border-b-2 border-primary/20 focus:border-primary focus:ring-0 focus:outline-none text-foreground py-4 pl-12 pr-4 transition-all placeholder:text-muted-foreground/30 font-medium text-sm"
                  placeholder="dev@chlorophyll.network"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-primary">
                  Access Token (Password)
                </label>
                <a
                  href="#"
                  className="text-[10px] font-bold uppercase tracking-wider text-primary/60 hover:text-primary transition-colors underline decoration-primary/20"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-primary/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full bg-secondary dark:bg-[#163020] border-b-2 border-primary/20 focus:border-primary focus:ring-0 focus:outline-none text-foreground py-4 pl-12 pr-4 transition-all placeholder:text-muted-foreground/30 font-medium text-sm"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive font-medium">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-4 font-black tracking-tighter uppercase text-lg hover:brightness-110 transition-all active:scale-[0.98] duration-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Initializing...' : 'Initialize Session'}
              <Terminal className="size-5" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-10 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative px-4 bg-card text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">
              External Integration
            </span>
          </div>

          {/* LINE Login */}
          <button
            type="button"
            className="w-full bg-[#06c755] text-white py-4 font-bold tracking-tight hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <MessageCircle className="size-5" style={{ fill: 'currentColor' }} />
            Sign in with LINE
          </button>

          {/* Register link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              New entity?{' '}
              <Link href="/register" className="text-primary font-bold hover:underline ml-1">
                Establish connection (Register)
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom metadata — dark mode only */}
        <div className="mt-6 hidden dark:flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-primary/30 px-2">
          <span>Node: US-EAST-1</span>
          <span>Latency: 14ms</span>
          <span>v4.1.0-stable</span>
        </div>
      </div>
    </main>
  );
}
