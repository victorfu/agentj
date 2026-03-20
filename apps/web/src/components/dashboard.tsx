'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  LogOut,
  MessageCircle,
  Network,
  RefreshCw,
  Terminal,
  Gauge
} from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PatToken {
  id: string;
  prefix: string;
  token: string | null;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
}

interface Tunnel {
  id: string;
  subdomain: string;
  publicUrl: string;
  status: 'offline' | 'online' | 'stopped';
  targetHost: string;
  targetPort: number;
  createdAt: string;
  updatedAt: string;
}

interface LineChannel {
  id: string;
  tunnelId: string;
  name: string;
  lineChannelId: string;
  mode: 'relay' | 'managed';
  webhookActive: boolean;
  webhookUrl: string | null;
  createdAt: string;
}

interface CreatedPatResponse {
  token: string;
  id: string;
  createdAt: string;
}

const REFRESH_INTERVAL_MS = 5000;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => void handleCopy()}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: Tunnel['status'] }) {
  const config = {
    online: {
      bg: 'bg-primary/20 border-primary/20 text-primary',
      dot: 'bg-primary animate-pulse'
    },
    offline: {
      bg: 'bg-muted-foreground/20 border-muted-foreground/20 text-muted-foreground',
      dot: 'bg-muted-foreground'
    },
    stopped: {
      bg: 'bg-agentj-stopped/20 border-agentj-stopped/20 text-agentj-stopped',
      dot: 'bg-agentj-stopped'
    }
  } as const;

  const cfg = config[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label}
    </span>
  );
}

export function Dashboard() {
  const [pat, setPat] = useState<PatToken | null>(null);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [lineChannels, setLineChannels] = useState<LineChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  async function ensurePat(): Promise<PatToken | null> {
    const patsRes = await fetch('/api/v1/pats');
    if (patsRes.status === 401) {
      window.location.href = '/login';
      return null;
    }
    if (!patsRes.ok) throw new Error(await patsRes.text());
    const pats = (await patsRes.json()) as PatToken[];

    if (pats.length > 0 && pats[0]) {
      return pats[0];
    }

    const createRes = await fetch('/api/v1/pats', { method: 'POST' });
    if (createRes.status === 401) {
      window.location.href = '/login';
      return null;
    }
    if (!createRes.ok) throw new Error(await createRes.text());
    const created = (await createRes.json()) as CreatedPatResponse;
    setNewToken(created.token);

    return {
      id: created.id,
      prefix: created.token.slice(0, 12),
      token: created.token,
      scopes: ['tunnels:write', 'requests:read', 'line:manage', 'line:messages'],
      createdAt: created.createdAt,
      expiresAt: null
    };
  }

  async function loadTunnels(patId: string, silent: boolean) {
    try {
      const res = await fetch(`/api/v1/pats/${patId}/tunnels`);
      if (!res.ok) return;
      setTunnels((await res.json()) as Tunnel[]);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Failed to load tunnels');
    }
  }

  async function loadLineChannels(patToken: string, silent: boolean) {
    try {
      const res = await fetch('/api/v1/line/channels', {
        headers: { Authorization: `Bearer ${patToken}` }
      });
      if (!res.ok) return;
      setLineChannels((await res.json()) as LineChannel[]);
    } catch (err) {
      if (!silent)
        toast.error(err instanceof Error ? err.message : 'Failed to load LINE channels');
    }
  }

  async function regeneratePat() {
    if (!pat) return;
    setRegenerating(true);
    try {
      await fetch(`/api/v1/pats/${pat.id}`, { method: 'DELETE' });
      const createRes = await fetch('/api/v1/pats', { method: 'POST' });
      if (!createRes.ok) throw new Error(await createRes.text());
      const created = (await createRes.json()) as CreatedPatResponse;
      setNewToken(created.token);

      const newPat: PatToken = {
        id: created.id,
        prefix: created.token.slice(0, 12),
        token: created.token,
        scopes: ['tunnels:write', 'requests:read', 'line:manage', 'line:messages'],
        createdAt: created.createdAt,
        expiresAt: null
      };
      setPat(newPat);
      setTunnels([]);
      setLineChannels([]);
      toast.success('PAT regenerated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate PAT');
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    const init = async () => {
      try {
        const sessionRes = await fetch('/api/v1/auth/session');
        if (sessionRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!sessionRes.ok) throw new Error(await sessionRes.text());

        const currentPat = await ensurePat();
        if (!isCurrent || !currentPat) return;
        setPat(currentPat);
        await Promise.all([
          loadTunnels(currentPat.id, false),
          currentPat.token ? loadLineChannels(currentPat.token, false) : Promise.resolve()
        ]);
      } catch (err) {
        if (isCurrent)
          toast.error('Failed to load dashboard', {
            description: err instanceof Error ? err.message : 'Unknown error'
          });
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void init();
    return () => {
      isCurrent = false;
    };
  }, []);

  // Auto-refresh tunnels
  useEffect(() => {
    if (!pat) return;
    const timer = setInterval(() => {
      void loadTunnels(pat.id, true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pat]);

  const onlineTunnels = tunnels.filter((t) => t.status === 'online');
  const authtokenCommand = newToken
    ? `npx agentj-cli authtoken ${newToken}`
    : pat?.token
      ? `npx agentj-cli authtoken ${pat.token}`
      : 'npx agentj-cli authtoken <YOUR_PAT>';

  // Map tunnelId -> tunnel for LINE channel display
  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border pb-4 mb-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center">
              <Network className="size-5 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">AgentJ</h2>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/console" className="text-primary text-sm font-semibold">
              Dashboard
            </Link>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary text-sm font-medium transition-colors"
            >
              Docs
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => void handleLogout()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Project Overview</h1>
              <p className="text-muted-foreground mt-1">
                Manage and monitor your real-time webhook delivery systems.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="bg-primary/5 border border-border p-5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">Total Tunnels</span>
                <Globe className="size-5 text-primary" />
              </div>
              <span className="text-2xl font-bold">{tunnels.length}</span>
            </div>
            <div className="bg-primary/5 border border-border p-5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">Active Endpoints</span>
                <Activity className="size-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{onlineTunnels.length}</span>
                <span className="text-muted-foreground text-xs font-bold">Online</span>
              </div>
            </div>
            <div className="bg-primary/5 border border-border p-5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">LINE Channels</span>
                <MessageCircle className="size-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{lineChannels.length}</span>
                <span className="text-primary text-xs font-bold">
                  {lineChannels.filter((c) => c.webhookActive).length} active
                </span>
              </div>
            </div>
            <div className="bg-primary/5 border border-border p-5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">Quick Start</span>
                <Terminal className="size-5 text-primary" />
              </div>
              <code className="text-sm font-mono text-primary truncate">
                agentj-cli line init 8080
              </code>
            </div>
          </div>

          {/* PAT Section */}
          {pat && (
            <div className="bg-primary/5 border border-border rounded-xl p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <KeyRound className="size-4 text-primary" />
                    Personal Access Token
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your CLI authentication token. Each account has one PAT.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void regeneratePat()}
                  disabled={regenerating}
                  className="shrink-0"
                >
                  {regenerating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Regenerate
                </Button>
              </div>

              {newToken && (
                <div className="bg-card border border-primary/20 rounded-lg p-4 mb-4">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    New Token — copy now, it won&apos;t be shown again
                  </p>
                  <div className="flex items-center gap-2 bg-muted rounded-md p-3">
                    <code className="flex-1 overflow-x-auto font-mono text-sm text-foreground">
                      {newToken}
                    </code>
                    <CopyButton text={newToken} />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-muted rounded-md p-3">
                  <code className="flex-1 overflow-x-auto font-mono text-sm text-muted-foreground">
                    {pat.token ? pat.token : `${pat.prefix}...`}
                  </code>
                  <CopyButton text={pat.token ?? pat.prefix} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Set your token:</p>
                  <div className="flex items-center gap-2 bg-muted rounded-md p-3">
                    <code className="flex-1 overflow-x-auto font-mono text-sm">
                      {authtokenCommand}
                    </code>
                    <CopyButton text={authtokenCommand} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Start a LINE Bot tunnel:</p>
                  <div className="flex items-center gap-2 bg-muted rounded-md p-3">
                    <code className="flex-1 overflow-x-auto font-mono text-sm">
                      npx agentj-cli line init 8080
                    </code>
                    <CopyButton text="npx agentj-cli line init 8080" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Tunnels Table */}
          <div className="bg-primary/5 border border-border rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Active Tunnels</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gauge className="size-3.5" />
                Auto-refresh 5s
              </div>
            </div>

            {tunnels.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Globe className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No tunnels yet.</p>
                <p className="text-xs text-muted-foreground">
                  Run{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-primary">
                    npx agentj-cli line init 8080
                  </code>{' '}
                  to create your first tunnel.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-border">
                  {tunnels.map((tunnel) => {
                    const lc = lineChannels.find((c) => c.tunnelId === tunnel.id);
                    return (
                      <div key={tunnel.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{tunnel.subdomain}</span>
                            {lc && (
                              <MessageCircle
                                className="size-3.5 text-primary"
                                style={{ fill: 'currentColor' }}
                              />
                            )}
                          </div>
                          <StatusBadge status={tunnel.status} />
                        </div>
                        <a
                          href={tunnel.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded hover:underline"
                        >
                          {tunnel.publicUrl}
                        </a>
                        <p className="font-mono text-xs text-muted-foreground">
                          {'→'} {tunnel.targetHost}:{tunnel.targetPort}
                        </p>
                        {lc && (
                          <div className="text-xs text-muted-foreground">
                            LINE: {lc.name} ({lc.mode}){' '}
                            {lc.webhookActive && (
                              <span className="text-primary font-bold">Webhook Active</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="px-6 py-4 font-semibold">Project Name</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Public URL</th>
                        <th className="px-6 py-4 font-semibold">Target</th>
                        <th className="px-6 py-4 font-semibold">LINE</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tunnels.map((tunnel) => {
                        const lc = lineChannels.find((c) => c.tunnelId === tunnel.id);
                        return (
                          <tr
                            key={tunnel.id}
                            className="hover:bg-primary/5 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
                                  {lc ? (
                                    <MessageCircle
                                      className="size-4"
                                      style={{ fill: 'currentColor' }}
                                    />
                                  ) : (
                                    <Globe className="size-4" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold">{tunnel.subdomain}</span>
                                  {lc && (
                                    <p className="text-xs text-muted-foreground">{lc.name}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={tunnel.status} />
                            </td>
                            <td className="px-6 py-4">
                              <a
                                href={tunnel.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-sm text-primary/80 bg-primary/10 px-2 py-1 rounded hover:underline"
                              >
                                {tunnel.publicUrl}
                                <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                              </a>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                              {tunnel.targetHost}:{tunnel.targetPort}
                            </td>
                            <td className="px-6 py-4">
                              {lc ? (
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-primary capitalize">
                                    {lc.mode}
                                  </span>
                                  {lc.webhookActive ? (
                                    <span className="block text-[10px] text-primary font-bold uppercase tracking-wider">
                                      Webhook Active
                                    </span>
                                  ) : (
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">
                                      Webhook Inactive
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <a
                                href={tunnel.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-sm font-bold"
                              >
                                Open
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">
                    Showing {tunnels.length} tunnel{tunnels.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* System Status Footer */}
          <div className="p-6 border border-border rounded-xl bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-bold">Global System Status</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <p className="text-xs text-muted-foreground">All regions operational</p>
                </div>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Uptime</p>
                <p className="text-sm font-bold">99.999%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Support</p>
                <a href="/docs" className="text-primary text-sm font-bold hover:underline">
                  Docs
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
