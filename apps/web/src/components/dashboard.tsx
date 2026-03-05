'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, CircleAlert, Copy, ExternalLink, Globe, KeyRound, Loader2 } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

interface CreatedPatResponse {
  token: string;
  id: string;
  createdAt: string;
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

export function Dashboard() {
  const [pats, setPats] = useState<PatToken[]>([]);
  const [loadingPats, setLoadingPats] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [creatingPat, setCreatingPat] = useState(false);
  const [revokingPatId, setRevokingPatId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingPats(true);
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

  async function createPat(): Promise<void> {
    setCreatingPat(true);
    try {
      const response = await fetch('/api/v1/pats', {
        method: 'POST'
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
          expiresAt: null
        }
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
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(await response.text());
      setPats((prev) => prev.filter((p) => p.id !== patId));
      toast.success('PAT revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke PAT');
    } finally {
      setRevokingPatId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Agentj" className="h-10 w-10 rounded-lg dark:hidden" />
          <img
            src="/logo-dark.svg"
            alt="Agentj"
            className="hidden h-10 w-10 rounded-lg dark:block"
          />
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Agentj</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Control Plane</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="icon-sm" asChild className="sm:hidden">
            <Link href="/tunnels">
              <Globe className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/tunnels">
              <Globe className="size-4" />
              Tunnels
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

      {/* PATs */}
      <Card
        className="mt-6 animate-fade-up bg-card/80 backdrop-blur-sm"
        style={{ animationDelay: '60ms' }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            PATs
          </CardTitle>
          <CardDescription>Manage your Personal Access Tokens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newlyCreatedToken && (
            <Alert>
              <CircleAlert className="size-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">New PAT created.</p>
                <div className="flex items-center gap-2 rounded-lg border bg-agentj-code p-3">
                  <pre className="flex-1 overflow-x-auto font-mono text-sm leading-relaxed">
                    {newlyCreatedToken}
                  </pre>
                  <CopyButton text={newlyCreatedToken} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setNewlyCreatedToken(null)}>
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
            <p className="text-sm text-muted-foreground">
              No active PATs yet. Create one to start.
            </p>
          ) : (
            <div className="space-y-2">
              {pats.map((pat) => (
                <div key={pat.id} className="rounded-lg border">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Link
                      href={`/tunnels?pat=${pat.id}`}
                      className="min-w-0 flex-1 transition hover:opacity-70"
                    >
                      <p className="truncate font-mono text-sm">{pat.prefix}...</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(pat.createdAt).toLocaleDateString()}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {pat.scopes.length} scope{pat.scopes.length !== 1 ? 's' : ''}
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void revokePat(pat.id)}
                        disabled={revokingPatId === pat.id}
                      >
                        {revokingPatId === pat.id ? <Loader2 className="animate-spin" /> : 'Revoke'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button onClick={() => void createPat()} disabled={creatingPat}>
            {creatingPat ? (
              <>
                <Loader2 className="animate-spin" />
                Creating...
              </>
            ) : (
              'New PAT'
            )}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
