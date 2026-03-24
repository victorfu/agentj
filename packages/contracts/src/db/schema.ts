import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

export const tunnelStatusEnum = pgEnum('tunnel_status', ['offline', 'online', 'stopped']);
export const chunkDirectionEnum = pgEnum('chunk_direction', ['request', 'response']);
export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member']);
export const lineWebhookModeEnum = pgEnum('line_webhook_mode', ['relay', 'managed']);
export const lineWebhookEventStatusEnum = pgEnum('line_webhook_event_status', [
  'pending',
  'delivered',
  'failed'
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  sessionTokenHash: text('session_token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const patTokens = pgTable('pat_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  prefix: text('prefix').notNull(),
  tokenPlaintext: text('token_plaintext'),
  tokenHash: text('token_hash').notNull().unique(),
  scopes: text('scopes').array().notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const tunnels = pgTable('tunnels', {
  id: text('id').primaryKey(),
  patTokenId: text('pat_token_id')
    .notNull()
    .references(() => patTokens.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  subdomain: text('subdomain').notNull().unique(),
  status: tunnelStatusEnum('status').notNull().default('offline'),
  targetHost: text('target_host').notNull(),
  targetPort: integer('target_port').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const tunnelSessions = pgTable('tunnel_sessions', {
  id: text('id').primaryKey(),
  tunnelId: text('tunnel_id')
    .notNull()
    .references(() => tunnels.id, { onDelete: 'cascade' }),
  agentInstanceId: text('agent_instance_id').notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).notNull().defaultNow(),
  disconnectReason: text('disconnect_reason')
});

export const ingressRequests = pgTable('ingress_requests', {
  id: text('id').primaryKey(),
  tunnelId: text('tunnel_id')
    .notNull()
    .references(() => tunnels.id, { onDelete: 'cascade' }),
  streamId: text('stream_id').notNull(),
  method: text('method').notNull(),
  host: text('host').notNull(),
  path: text('path').notNull(),
  query: text('query').notNull().default(''),
  requestHeaders: jsonb('request_headers').$type<Record<string, string | string[]>>().notNull().default({}),
  responseHeaders: jsonb('response_headers').$type<Record<string, string | string[]>>().notNull().default({}),
  statusCode: integer('status_code'),
  latencyMs: integer('latency_ms'),
  requestTruncated: boolean('request_truncated').notNull().default(false),
  responseTruncated: boolean('response_truncated').notNull().default(false),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true })
});

export const ingressPayloadChunks = pgTable('ingress_payload_chunks', {
  id: text('id').primaryKey(),
  requestId: text('request_id')
    .notNull()
    .references(() => ingressRequests.id, { onDelete: 'cascade' }),
  direction: chunkDirectionEnum('direction').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  isBinary: boolean('is_binary').notNull().default(false),
  contentType: text('content_type'),
  dataText: text('data_text'),
  dataBase64: text('data_base64'),
  truncated: boolean('truncated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const lineChannels = pgTable('line_channels', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  tunnelId: text('tunnel_id')
    .notNull()
    .unique()
    .references(() => tunnels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  lineChannelId: text('line_channel_id').notNull(),
  channelSecret: text('channel_secret').notNull(),
  channelAccessToken: text('channel_access_token').notNull(),
  webhookPath: text('webhook_path').notNull().default('/line/webhook'),
  mode: lineWebhookModeEnum('mode').notNull().default('relay'),
  webhookActive: boolean('webhook_active').notNull().default(false),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const lineWebhookEvents = pgTable('line_webhook_events', {
  id: text('id').primaryKey(),
  lineChannelId: text('line_channel_id')
    .notNull()
    .references(() => lineChannels.id, { onDelete: 'cascade' }),
  tunnelId: text('tunnel_id')
    .notNull()
    .references(() => tunnels.id, { onDelete: 'cascade' }),
  webhookEventId: text('webhook_event_id'),
  status: lineWebhookEventStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  lastError: text('last_error'),
  requestHeaders: jsonb('request_headers').$type<Record<string, string | string[]>>().notNull().default({}),
  payloadText: text('payload_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true })
});

export const lineApiCalls = pgTable('line_api_calls', {
  id: text('id').primaryKey(),
  lineChannelId: text('line_channel_id')
    .notNull()
    .references(() => lineChannels.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code'),
  lineRequestId: text('line_request_id'),
  lineAcceptedRequestId: text('line_accepted_request_id'),
  retryKey: text('retry_key'),
  requestBody: jsonb('request_body').$type<Record<string, unknown> | null>(),
  responseBody: jsonb('response_body').$type<Record<string, unknown> | null>(),
  errorBody: jsonb('error_body').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
