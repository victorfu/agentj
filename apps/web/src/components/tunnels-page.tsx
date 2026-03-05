'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Globe, KeyRound } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

const PAT_TUNNELS_REFRESH_INTERVAL_MS = 5000;

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

interface PatWithTunnels {
  pat: PatToken;
  tunnels: Tunnel[];
}

export function TunnelsPage() {
  const searchParams = useSearchParams();
  const filterPatId = searchParams.get('pat');
  const [groups, setGroups] = useState<PatWithTunnels[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    const loadAll = async (showLoading: boolean, silentError: boolean) => {
      if (showLoading) setLoading(true);

      try {
        const patsRes = await fetch('/api/v1/pats');
        if (!patsRes.ok) throw new Error(await patsRes.text());
        let pats = (await patsRes.json()) as PatToken[];

        if (filterPatId) {
          pats = pats.filter((p) => p.id === filterPatId);
        }

        const results = await Promise.all(
          pats.map(async (pat) => {
            try {
              const res = await fetch(`/api/v1/pats/${pat.id}/tunnels`);
              if (!res.ok) return { pat, tunnels: [] as Tunnel[] };
              const tunnels = (await res.json()) as Tunnel[];
              return { pat, tunnels };
            } catch {
              return { pat, tunnels: [] as Tunnel[] };
            }
          }),
        );

        if (!isCurrent) return;
        setGroups(results);
      } catch (error) {
        if (!isCurrent || silentError) return;
        toast.error('Failed to load tunnels', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        if (showLoading && isCurrent) setLoading(false);
      }
    };

    void loadAll(true, false);
    const timer = setInterval(() => {
      void loadAll(false, true);
    }, PAT_TUNNELS_REFRESH_INTERVAL_MS);

    return () => {
      isCurrent = false;
      clearInterval(timer);
    };
  }, [filterPatId]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
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
          <Button variant="outline" size="icon-sm" asChild className="sm:hidden">
            <Link href="/">
              <KeyRound className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/">
              <KeyRound className="size-4" />
              PATs
            </Link>
          </Button>
          <Button variant="outline" size="icon-sm" asChild className="sm:hidden">
            <a href="/docs" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <a href="/docs" target="_blank" rel="noopener noreferrer">
              API Docs
              <ExternalLink />
            </a>
          </Button>
        </div>
      </header>

      <Separator />

      {/* Tunnels */}
      <Card
        className="mt-6 animate-fade-up bg-card/80 backdrop-blur-sm"
        style={{ animationDelay: '60ms' }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            Tunnels
          </CardTitle>
          <CardDescription>
            {filterPatId
              ? 'Tunnels for this PAT. Statuses refresh every 5 seconds.'
              : 'All tunnels across your PATs. Statuses refresh every 5 seconds.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {filterPatId && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/tunnels">View all tunnels</Link>
            </Button>
          )}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PATs found. Create one from the dashboard.
            </p>
          ) : (
            groups.map(({ pat, tunnels }) => (
              <div key={pat.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
                  <span className="min-w-0 truncate font-mono">{pat.token ?? `${pat.prefix}...`}</span>
                  <CopyButton text={pat.token ?? pat.prefix} />
                  <Badge variant="secondary" className="text-xs">
                    {pat.scopes.length} scope{pat.scopes.length !== 1 ? 's' : ''}
                  </Badge>
                  <span className="text-xs">
                    Created {new Date(pat.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {tunnels.length === 0 ? (
                  <div className="rounded-lg border px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      No tunnels for this PAT.
                    </p>
                  </div>
                ) : (
                  <>
                  {/* Mobile: stacked cards */}
                  <div className="space-y-3 sm:hidden">
                    {tunnels.map((tunnel) => (
                      <div key={tunnel.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{tunnel.subdomain}</p>
                          <StatusBadge status={tunnel.status} />
                        </div>
                        <a
                          href={tunnel.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate rounded-md bg-agentj-code px-2 py-1 font-mono text-xs text-primary transition hover:underline"
                        >
                          {tunnel.publicUrl}
                        </a>
                        <p className="font-mono text-xs text-muted-foreground">
                          {'→'} {tunnel.targetHost}:{tunnel.targetPort}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
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
                        {tunnels.map((tunnel) => (
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
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
