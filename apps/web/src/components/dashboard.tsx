'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
} from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface PatToken {
  id: string;
  prefix: string;
  token: string | null;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
}

interface CreatedPatResponse {
  token: string;
  id: string;
  createdAt: string;
}

const PAT_TUNNELS_REFRESH_INTERVAL_MS = 5000;

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text so user can Ctrl-C
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

const statusConfig = {
  online: { color: 'bg-agentj-online', text: 'text-agentj-online', label: 'Online' },
  offline: { color: 'bg-agentj-offline', text: 'text-muted-foreground', label: 'Offline' },
  stopped: { color: 'bg-agentj-stopped', text: 'text-agentj-stopped', label: 'Stopped' },
} as const;

function StatusBadge({ status }: { status: Tunnel['status'] }) {
  const cfg = statusConfig[status];

  return (
    <Badge variant="outline" className={`gap-1.5 border-transparent ${cfg.text}`}>
      <span
        className={`inline-block size-1.5 rounded-full ${cfg.color} ${status === 'online' ? 'motion-safe:animate-pulse' : ''}`}
      />
      {cfg.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const [pats, setPats] = useState<PatToken[]>([]);
  const [loadingPats, setLoadingPats] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [creatingPat, setCreatingPat] = useState(false);
  const [revokingPatId, setRevokingPatId] = useState<string | null>(null);
  const [selectedPatId, setSelectedPatId] = useState<string | null>(null);
  const [patTunnels, setPatTunnels] = useState<Tunnel[]>([]);
  const [loadingPatTunnels, setLoadingPatTunnels] = useState(false);

  useEffect(() => {
    setLoadingPats(true);
    setSelectedPatId(null);
    setPatTunnels([]);
    void fetch('/api/v1/pats')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<PatToken[]>;
      })
      .then(setPats)
      .catch((err: Error) => {
        toast.error('Failed to load PATs', { description: err.message });
      })
      .finally(() => setLoadingPats(false));
  }, []);

  useEffect(() => {
    if (!selectedPatId) return;

    let isCurrent = true;

    const loadPatTunnels = async (showLoading: boolean, silentError: boolean): Promise<void> => {
      if (showLoading) {
        setLoadingPatTunnels(true);
      }

      try {
        const res = await fetch(`/api/v1/pats/${selectedPatId}/tunnels`);
        if (!res.ok) {
          throw new Error(await res.text());
        }

        const rows = (await res.json()) as Tunnel[];
        if (!isCurrent) {
          return;
        }

        setPatTunnels(rows);
      } catch (error) {
        if (!isCurrent || silentError) {
          return;
        }
        toast.error('Failed to load tunnels', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        if (showLoading && isCurrent) {
          setLoadingPatTunnels(false);
        }
      }
    };

    void loadPatTunnels(true, false);
    const timer = setInterval(() => {
      void loadPatTunnels(false, true);
    }, PAT_TUNNELS_REFRESH_INTERVAL_MS);

    return () => {
      isCurrent = false;
      clearInterval(timer);
    };
  }, [selectedPatId]);

  function togglePat(patId: string) {
    setSelectedPatId((prev) => (prev === patId ? null : patId));
    setPatTunnels([]);
    setLoadingPatTunnels(false);
  }

  async function createPat(): Promise<void> {
    setCreatingPat(true);
    try {
      const response = await fetch('/api/v1/pats', {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());

      const created = (await response.json()) as CreatedPatResponse;
      setNewlyCreatedToken(created.token);
      setPats((prev) => [
        ...prev,
        {
          id: created.id,
          prefix: created.token.slice(0, 12),
          token: created.token,
          scopes: ['tunnels:write', 'requests:read'],
          createdAt: created.createdAt,
          expiresAt: null,
        },
      ]);
      toast.success('PAT created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PAT');
    } finally {
      setCreatingPat(false);
    }
  }

  async function revokePat(patId: string): Promise<void> {
    setRevokingPatId(patId);
    try {
      const response = await fetch(`/api/v1/pats/${patId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await response.text());
      setPats((prev) => prev.filter((p) => p.id !== patId));
      if (selectedPatId === patId) {
        setSelectedPatId(null);
        setPatTunnels([]);
      }
      toast.success('PAT revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke PAT');
    } finally {
      setRevokingPatId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <svg
            width="36"
            height="36"
            viewBox="0 0 512 512"
            role="img"
            aria-label="Agentj"
            className="shrink-0"
          >
            <rect width="512" height="512" rx="108" className="fill-primary" />
            <path d="M136 408 V208 A120 120 0 0 1 376 208 V408 Z" fill="#080c16" />
            <path d="M188 408 V208 A68 68 0 0 1 324 208 V408 Z" className="fill-primary" />
          </svg>
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Agentj</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Control Plane</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <a href="/docs" target="_blank" rel="noopener noreferrer">
              API Docs
              <ExternalLink />
            </a>
          </Button>
        </div>
      </header>

      <Separator />

      {/* ── PATs + Tunnels ─────────────────────────────────────── */}
      <Card
        className="mt-6 animate-fade-up bg-card/80 backdrop-blur-sm"
        style={{ animationDelay: '60ms' }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            PATs
          </CardTitle>
          <CardDescription>
            Manage PATs. Click a row to reveal the full token and its tunnels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newlyCreatedToken && (
            <Alert>
              <CircleAlert className="size-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">
                  New PAT created.
                </p>
                <div className="flex items-center gap-2 rounded-lg border bg-agentj-code p-3">
                  <pre className="flex-1 overflow-x-auto font-mono text-sm leading-relaxed">
                    {newlyCreatedToken}
                  </pre>
                  <CopyButton text={newlyCreatedToken} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewlyCreatedToken(null)}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {loadingPats ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : pats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active PATs yet. Create one to start.</p>
          ) : (
            <div className="space-y-2">
              {pats.map((pat) => {
                const isSelected = selectedPatId === pat.id;
                return (
                  <div key={pat.id} className="rounded-lg border">
                    {/* PAT row */}
                    <div
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-muted/50"
                      onClick={() => togglePat(pat.id)}
                    >
                      {isSelected ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm">{pat.prefix}...</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(pat.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {pat.scopes.length} scope{pat.scopes.length !== 1 ? 's' : ''}
                        </Badge>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void revokePat(pat.id);
                          }}
                          disabled={revokingPatId === pat.id}
                        >
                          {revokingPatId === pat.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            'Revoke'
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded tunnels */}
                    {isSelected && (
                      <div className="border-t bg-muted/20 px-4 py-3">
                        <div className="mb-3 space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">PAT token</p>
                          {pat.token ? (
                            <div className="flex items-center gap-2 rounded-lg border bg-agentj-code p-3">
                              <pre className="flex-1 overflow-x-auto font-mono text-sm leading-relaxed">
                                {pat.token}
                              </pre>
                              <CopyButton text={pat.token} />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Full token is unavailable for this PAT. Recreate the PAT if you need to copy it.
                            </p>
                          )}
                        </div>

                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Globe className="size-4" />
                          Tunnels
                        </div>
                        {loadingPatTunnels ? (
                          <div className="space-y-2">
                            {[1, 2].map((i) => (
                              <Skeleton key={i} className="h-10 w-full rounded-md" />
                            ))}
                          </div>
                        ) : patTunnels.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground/60">
                            No tunnels for this PAT. Create one using the CLI.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border bg-card">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead>Name</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Public URL</TableHead>
                                  <TableHead className="text-right">Target</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {patTunnels.map((tunnel) => (
                                  <TableRow key={tunnel.id} className="group">
                                    <TableCell>
                                      <div>
                                        <p className="font-semibold">{tunnel.subdomain}</p>
                                        <p className="font-mono text-[11px] text-muted-foreground/50">
                                          {tunnel.id}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <StatusBadge status={tunnel.status} />
                                    </TableCell>
                                    <TableCell>
                                      <a
                                        href={tunnel.publicUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-md bg-agentj-code px-2 py-1 font-mono text-xs text-primary transition hover:underline"
                                      >
                                        {tunnel.publicUrl}
                                        <ExternalLink className="size-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                                      </a>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                      {tunnel.targetHost}:{tunnel.targetPort}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button
            onClick={() => void createPat()}
            disabled={creatingPat}
          >
            {creatingPat ? (
              <>
                <Loader2 className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create New PAT'
            )}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
