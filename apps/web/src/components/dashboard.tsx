'use client';

import { useEffect, useMemo, useState } from 'react';

interface Project {
  id: string;
  name: string;
  orgId: string;
  requestLogsEnabled: boolean;
  createdAt: string;
}

export function Dashboard() {
  const [token, setToken] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [orgId, setOrgId] = useState('');

  const authHeaders = useMemo(
    () => ({
      authorization: token ? `Bearer ${token}` : ''
    }),
    [token]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetch('/api/v1/projects', { headers: authHeaders })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((data) => {
        setProjects(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [authHeaders, token]);

  async function createProject(): Promise<void> {
    const response = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ orgId, name: projectName })
    });

    if (!response.ok) {
      setError(await response.text());
      return;
    }

    const created = (await response.json()) as Project;
    setProjects((prev) => [created, ...prev]);
    setProjectName('');
    setError(null);
  }

  return (
    <main>
      <h1>Agentj Control Plane</h1>
      <p>Paste a PAT to manage projects and tunnels.</p>

      <section className="card">
        <label htmlFor="token">Personal Access Token</label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="agentj_pat_..."
        />
      </section>

      <section className="card">
        <h2>Create Project</h2>
        <div className="grid">
          <div>
            <label htmlFor="orgId">Org ID</label>
            <input
              id="orgId"
              value={orgId}
              onChange={(event) => setOrgId(event.target.value)}
              placeholder="org_xxx"
            />
          </div>
          <div>
            <label htmlFor="projectName">Project Name</label>
            <input
              id="projectName"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="My Project"
            />
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" onClick={() => void createProject()}>
            Create
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Projects</h2>
        {projects.length === 0 ? <p>No projects found.</p> : null}
        {projects.map((project) => (
          <div key={project.id} style={{ marginBottom: '0.65rem' }}>
            <strong>{project.name}</strong>
            <div>{project.id}</div>
            <small>org: {project.orgId}</small>
          </div>
        ))}
      </section>

      {error ? (
        <section className="card">
          <h2>Error</h2>
          <pre>{error}</pre>
        </section>
      ) : null}
    </main>
  );
}
