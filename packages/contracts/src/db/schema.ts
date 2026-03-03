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

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const patTokens = pgTable('pat_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
