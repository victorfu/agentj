DO $$
BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE line_webhook_mode AS ENUM ('relay', 'managed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE line_webhook_event_status AS ENUM ('pending', 'delivered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_uq
  ON workspace_members(workspace_id, user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pat_tokens
  ADD COLUMN IF NOT EXISTS workspace_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;

INSERT INTO workspaces (id, name, created_by)
SELECT
  'ws_' || substr(md5(u.id), 1, 24),
  COALESCE(NULLIF(split_part(u.email, '@', 1), ''), 'workspace'),
  u.id
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.created_by = u.id
);

INSERT INTO workspace_members (id, workspace_id, user_id, role)
SELECT
  'wm_' || substr(md5(u.id || ':' || w.id), 1, 24),
  w.id,
  u.id,
  'owner'::workspace_role
FROM users u
JOIN workspaces w ON w.created_by = u.id
WHERE NOT EXISTS (
  SELECT 1
  FROM workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.user_id = u.id
);

UPDATE pat_tokens p
SET workspace_id = w.id
FROM workspaces w
WHERE w.created_by = p.user_id
  AND p.workspace_id IS NULL;

UPDATE pat_tokens
SET created_by_user_id = user_id
WHERE created_by_user_id IS NULL;

ALTER TABLE pat_tokens
  ALTER COLUMN workspace_id SET NOT NULL,
  ALTER COLUMN created_by_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pat_tokens_workspace_id_fkey'
  ) THEN
    ALTER TABLE pat_tokens
      ADD CONSTRAINT pat_tokens_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pat_tokens_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE pat_tokens
      ADD CONSTRAINT pat_tokens_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END
$$;

ALTER TABLE tunnels
  ADD COLUMN IF NOT EXISTS workspace_id TEXT;

UPDATE tunnels t
SET workspace_id = p.workspace_id
FROM pat_tokens p
WHERE t.pat_token_id = p.id
  AND t.workspace_id IS NULL;

ALTER TABLE tunnels
  ALTER COLUMN workspace_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tunnels_workspace_id_fkey'
  ) THEN
    ALTER TABLE tunnels
      ADD CONSTRAINT tunnels_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS line_channels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tunnel_id TEXT NOT NULL UNIQUE REFERENCES tunnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  line_channel_id TEXT NOT NULL,
  channel_secret TEXT NOT NULL,
  channel_access_token TEXT NOT NULL,
  webhook_path TEXT NOT NULL DEFAULT '/line/webhook',
  mode line_webhook_mode NOT NULL DEFAULT 'relay',
  webhook_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS line_webhook_events (
  id TEXT PRIMARY KEY,
  line_channel_id TEXT NOT NULL REFERENCES line_channels(id) ON DELETE CASCADE,
  tunnel_id TEXT NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
  webhook_event_id TEXT,
  status line_webhook_event_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  request_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS line_webhook_events_channel_event_uq
  ON line_webhook_events(line_channel_id, webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS line_api_calls (
  id TEXT PRIMARY KEY,
  line_channel_id TEXT NOT NULL REFERENCES line_channels(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  line_request_id TEXT,
  line_accepted_request_id TEXT,
  retry_key TEXT,
  request_body JSONB,
  response_body JSONB,
  error_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
