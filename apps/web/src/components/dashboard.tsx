'use client';

import { useEffect, useMemo, useState } from 'react';

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

interface DevPatResponse {
  token: string;
}

interface CreatedDevPatResponse {
  token: string;
  id: string;
  createdAt: string;
}

export function Dashboard() {
  const [token, setToken] = useState('');
  const [devPat, setDevPat] = useState<string | null>(null);
  const [devPatError, setDevPatError] = useState<string | null>(null);
  const [patMessage, setPatMessage] = useState<string | null>(null);
  const [creatingDevPat, setCreatingDevPat] = useState(false);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => ({
      authorization: token ? `Bearer ${token}` : ''
    }),
    [token]
  );

  useEffect(() => {
    void fetch('/api/v1/pats/dev')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json() as Promise<DevPatResponse>;
      })
      .then((data) => {
        setDevPat(data.token);
        setToken((current) => current || data.token);
        setDevPatError(null);
      })
      .catch((err: Error) => {
        setDevPatError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetch('/api/v1/tunnels', { headers: authHeaders })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((data) => {
        setTunnels(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [authHeaders, token]);

  async function createDevPat(): Promise<void> {
    setCreatingDevPat(true);
    try {
      const response = await fetch('/api/v1/pats/dev', { method: 'POST' });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const created = (await response.json()) as CreatedDevPatResponse;
      setDevPat(created.token);
      setToken(created.token);
      setPatMessage(`New PAT created at ${new Date(created.createdAt).toLocaleString()}`);
      setDevPatError(null);
    } catch (err) {
      setDevPatError(err instanceof Error ? err.message : 'Failed to create PAT');
    } finally {
      setCreatingDevPat(false);
    }
  }

  const cardClassName =
    'mb-4 rounded-2xl border border-agentj-border bg-agentj-panel p-4 md:p-6';
  const inputClassName =
    'w-full rounded-xl border border-agentj-border bg-white px-3 py-2 text-base text-agentj-ink shadow-sm outline-none transition focus:border-agentj-accent focus:ring-2 focus:ring-agentj-accent/20';

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <h1 className="mb-3 text-4xl font-bold sm:text-5xl">Agentj Control Plane</h1>
      <p className="mb-6 text-xl text-agentj-ink">Generate a PAT from web, then use it directly in CLI.</p>

      <section className={cardClassName}>
        <h2 className="mb-3 text-2xl font-semibold sm:text-3xl">Development PAT</h2>
        <p className="mb-3 text-sm text-agentj-muted">
          Local development mode exposes a dev PAT by default and can generate new PATs from web.
        </p>
        {devPat ? (
          <pre className="mb-3 overflow-x-auto rounded-xl border border-agentj-border/70 bg-white/80 p-3 text-sm">
            {devPat}
          </pre>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (devPat) {
                setToken(devPat);
                setPatMessage('Dev PAT applied to active token field.');
              }
            }}
            disabled={!devPat}
            className="rounded-xl border border-agentj-border bg-white px-4 py-2 text-sm font-semibold text-agentj-ink transition hover:bg-agentj-panel disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use Dev PAT
          </button>
          <button
            type="button"
            onClick={() => void createDevPat()}
            disabled={creatingDevPat}
            className="rounded-xl bg-agentj-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingDevPat ? 'Generating...' : 'Generate New PAT'}
          </button>
        </div>
        {patMessage ? <p className="mt-3 text-sm text-agentj-muted">{patMessage}</p> : null}
        {devPatError ? (
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {devPatError}
          </pre>
        ) : null}
      </section>

      <section className={cardClassName}>
        <label htmlFor="token" className="mb-2 block text-sm font-medium text-agentj-muted">
          Personal Access Token
        </label>
        <input
          id="token"
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="agentj_pat_..."
          className={inputClassName}
        />
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 text-2xl font-semibold sm:text-3xl">Tunnels</h2>
        {tunnels.length === 0 ? <p className="text-xl">No tunnels found.</p> : null}
        {tunnels.map((tunnel) => (
          <div
            key={tunnel.id}
            className="mb-3 rounded-xl border border-agentj-border/70 bg-white/70 p-3"
          >
            <strong>{tunnel.subdomain}</strong>
            <div className="mt-1 text-sm text-agentj-muted">{tunnel.id}</div>
            <small className="text-sm text-agentj-muted">
              {tunnel.status} · {tunnel.publicUrl} {'->'} http://{tunnel.targetHost}:{tunnel.targetPort}
            </small>
          </div>
        ))}
      </section>

      {error ? (
        <section className={cardClassName}>
          <h2 className="mb-2 text-2xl font-semibold sm:text-3xl">Error</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
