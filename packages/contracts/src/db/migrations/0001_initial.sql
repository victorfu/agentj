DO $$
BEGIN
  CREATE TYPE tunnel_status AS ENUM ('offline', 'online', 'stopped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE chunk_direction AS ENUM ('request', 'response');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pat_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  token_plaintext TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tunnels (
  id TEXT PRIMARY KEY,
  pat_token_id TEXT NOT NULL REFERENCES pat_tokens(id) ON DELETE CASCADE,
  subdomain TEXT NOT NULL UNIQUE,
  status tunnel_status NOT NULL DEFAULT 'offline',
  target_host TEXT NOT NULL,
  target_port INT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tunnel_sessions (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
  agent_instance_id TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnect_reason TEXT
);

CREATE TABLE IF NOT EXISTS ingress_requests (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
  stream_id TEXT NOT NULL,
  method TEXT NOT NULL,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  request_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_code INT,
  latency_ms INT,
  request_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  response_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ingress_payload_chunks (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES ingress_requests(id) ON DELETE CASCADE,
  direction chunk_direction NOT NULL,
  chunk_index INT NOT NULL,
  is_binary BOOLEAN NOT NULL DEFAULT FALSE,
  content_type TEXT,
  data_text TEXT,
  data_base64 TEXT,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
