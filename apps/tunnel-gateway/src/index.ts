import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import websocketPlugin from '@fastify/websocket';
import {
  asc,
  desc,
  eq,
  inArray,
  lt,
  sql
} from 'drizzle-orm';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type WebSocket from 'ws';
import type { RawData } from 'ws';

import {
  createDb,
  createPool,
  parseGatewayMessage,
  serializeGatewayMessage,
  tunnels,
  tunnelSessions,
  verifyConnectToken,
  ingressRequests,
  ingressPayloadChunks,
  TRACE_HEADER,
  buildTraceId,
  type AgentResponseChunkMessage,
  type AgentResponseEndMessage,
  type AgentResponseStartMessage,
  type GatewayMessage,
  type IngressRequestChunkMessage,
  type IngressRequestEndMessage,
  type IngressRequestStartMessage,
  type StreamErrorMessage
} from '@agentj/contracts';

import { loadGatewayEnv } from './lib/env.js';

const env = loadGatewayEnv(process.env);

const app = Fastify({
  logger: true,
  disableRequestLogging: true
});

await app.register(websocketPlugin);

const pool = createPool(env.DATABASE_URL);
const db = createDb(pool);

app.addHook('onRequest', async (request, reply) => {
  const incoming = request.headers[TRACE_HEADER];
  const traceId = typeof incoming === 'string' ? incoming : buildTraceId();
  reply.header(TRACE_HEADER, traceId);
});

interface AgentConnection {
  tunnelId: string;
  agentInstanceId: string;
  sessionId: string;
  socket: WebSocket;
}

interface StreamState {
  streamId: string;
  tunnelId: string;
  requestId: string;
  reply?: FastifyReply;
  wsSocket?: WebSocket;
  requestBytes: number;
  responseBytes: number;
  requestChunkIndex: number;
  responseChunkIndex: number;
  requestTruncated: boolean;
  responseTruncated: boolean;
  startedAtMs: number;
  protocol: 'http' | 'ws';
}

const agentsByTunnel = new Map<string, AgentConnection>();
const streams = new Map<string, StreamState>();

const REDACT_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key'
]);

const REQUEST_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 1000;

setInterval(() => {
  void cleanupOldRequestLogs();
}, 24 * 60 * 60 * 1000).unref();

app.get('/healthz', async () => {
  await db.execute(sql`select 1`);
  return { ok: true };
});

app.get('/agent/v1/connect', { websocket: true }, (socket, req) => {
  void handleAgentConnection(socket, req);
});

async function handleHttpIngress(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const host = (request.headers.host ?? '').split(':')[0] ?? '';
  const tunnel = await resolveTunnelByHost(host);

  if (!tunnel) {
    reply.code(404).send({
      error: {
        code: 'TUNNEL_NOT_FOUND',
        message: 'No tunnel found for host'
      }
    });
    return;
  }

  const agent = agentsByTunnel.get(tunnel.id);
  if (!agent) {
    reply.code(410).send({
      error: {
        code: 'TUNNEL_OFFLINE',
        message: 'Tunnel is offline'
      }
    });
    return;
  }

  const streamId = `str_${randomUUID()}`;
  const requestId = `req_${randomUUID()}`;

  const state: StreamState = {
    streamId,
    tunnelId: tunnel.id,
    requestId,
    reply,
    requestBytes: 0,
    responseBytes: 0,
    requestChunkIndex: 0,
    responseChunkIndex: 0,
    requestTruncated: false,
    responseTruncated: false,
    startedAtMs: Date.now(),
    protocol: 'http'
  };

  streams.set(streamId, state);

  await db.insert(ingressRequests).values({
    id: requestId,
    tunnelId: tunnel.id,
    streamId,
    method: request.method,
    host,
    path: request.url.split('?')[0] ?? '/',
    query: request.url.includes('?') ? request.url.split('?')[1] ?? '' : '',
    requestHeaders: redactHeaders(request.headers),
    responseHeaders: {}
  });

  const startMessage: IngressRequestStartMessage = {
    type: 'ingress_request_start',
    streamId,
    protocol: 'http',
    method: request.method,
    path: request.url.split('?')[0] ?? '/',
    query: request.url.includes('?') ? (request.url.split('?')[1] ?? '') : '',
    headers: normalizeHeaders(request.headers)
  };

  agent.socket.send(serializeGatewayMessage(startMessage));

  for await (const chunk of request.raw) {
    const buf = Buffer.from(chunk as Buffer);
    const chunkMessage: IngressRequestChunkMessage = {
      type: 'ingress_request_chunk',
      streamId,
      chunkIndex: state.requestChunkIndex,
      isBinary: true,
      dataBase64: buf.toString('base64')
    };

    state.requestChunkIndex += 1;
    agent.socket.send(serializeGatewayMessage(chunkMessage));

    await persistChunk(
      state,
      'request',
      chunkMessage.chunkIndex,
      buf,
      true,
      request.headers['content-type']?.toString() ?? null
    );
  }

  const endMessage: IngressRequestEndMessage = {
    type: 'ingress_request_end',
    streamId
  };
  agent.socket.send(serializeGatewayMessage(endMessage));

  await new Promise<void>((resolve) => {
    reply.raw.once('close', () => resolve());
    reply.raw.once('finish', () => resolve());
  });
}

app.route({
  method: 'GET',
  url: '/*',
  handler: handleHttpIngress,
  websocket: true,
  wsHandler: (socket, request) => {
    void handlePublicWebsocket(socket, request);
  }
});

app.route({
  method: ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  url: '/*',
  handler: handleHttpIngress
});

async function handleAgentConnection(socket: WebSocket, req: FastifyRequest): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    socket.close(4401, 'Missing bearer token');
    return;
  }

  const token = auth.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyConnectToken(token, env.AGENTJ_CONNECT_TOKEN_SECRET);
  } catch (error) {
    socket.close(4401, (error as Error).message);
    return;
  }

  const sessionId = `ses_${randomUUID()}`;
  let activeConnection: AgentConnection | null = null;

  socket.on('message', (raw) => {
    let message: GatewayMessage;
    try {
      message = parseGatewayMessage(raw.toString());
    } catch (error) {
      app.log.warn({ error }, 'Malformed agent websocket message');
      socket.close(4400, 'Malformed websocket message');
      return;
    }

    void handleAgentMessage(activeConnection, message);

    if (message.type === 'agent_hello') {
      const existing = agentsByTunnel.get(payload.tunnelId);
      if (existing && existing.sessionId !== sessionId) {
        existing.socket.close(4001, 'Superseded by newer agent session');
      }

      activeConnection = {
        tunnelId: payload.tunnelId,
        agentInstanceId: message.agentInstanceId,
        sessionId,
        socket
      };

      agentsByTunnel.set(payload.tunnelId, activeConnection);

      void db.insert(tunnelSessions).values({
        id: sessionId,
        tunnelId: payload.tunnelId,
        agentInstanceId: message.agentInstanceId
      });

      void db
        .update(tunnels)
        .set({ status: 'online', updatedAt: new Date() })
        .where(eq(tunnels.id, payload.tunnelId));

      socket.send(
        serializeGatewayMessage({
          type: 'agent_ready',
          tunnelId: payload.tunnelId
        })
      );
    }

    if (message.type === 'pong') {
      void db
        .update(tunnelSessions)
        .set({ lastHeartbeatAt: new Date() })
        .where(eq(tunnelSessions.id, sessionId));
    }
  });

  const pingTimer = setInterval(() => {
    socket.send(
      serializeGatewayMessage({
        type: 'ping',
        ts: Date.now()
      })
    );
  }, 30000);

  socket.on('close', () => {
    clearInterval(pingTimer);

    if (activeConnection) {
      const latest = agentsByTunnel.get(activeConnection.tunnelId);
      if (latest?.sessionId === activeConnection.sessionId) {
        agentsByTunnel.delete(activeConnection.tunnelId);

        void db
          .update(tunnels)
          .set({ status: 'offline', updatedAt: new Date() })
          .where(eq(tunnels.id, activeConnection.tunnelId));
      }
    }

    void db
      .update(tunnelSessions)
      .set({ disconnectReason: 'socket_closed' })
      .where(eq(tunnelSessions.id, sessionId));
  });
}

async function handlePublicWebsocket(
  socket: WebSocket,
  request: FastifyRequest
): Promise<void> {
  const host = (request.headers.host ?? '').split(':')[0] ?? '';
  const tunnel = await resolveTunnelByHost(host);

  if (!tunnel) {
    socket.close(4404, 'Tunnel not found');
    return;
  }

  const agent = agentsByTunnel.get(tunnel.id);
  if (!agent) {
    socket.close(4410, 'Tunnel offline');
    return;
  }

  const streamId = `str_${randomUUID()}`;
  const requestId = `req_${randomUUID()}`;

  const state: StreamState = {
    streamId,
    tunnelId: tunnel.id,
    requestId,
    wsSocket: socket,
    requestBytes: 0,
    responseBytes: 0,
    requestChunkIndex: 0,
    responseChunkIndex: 0,
    requestTruncated: false,
    responseTruncated: false,
    startedAtMs: Date.now(),
    protocol: 'ws'
  };

  streams.set(streamId, state);

  await db.insert(ingressRequests).values({
    id: requestId,
    tunnelId: tunnel.id,
    streamId,
    method: request.method,
    host,
    path: request.url.split('?')[0] ?? '/',
    query: request.url.includes('?') ? (request.url.split('?')[1] ?? '') : '',
    requestHeaders: redactHeaders(request.headers),
    responseHeaders: {}
  });

  const startMessage: IngressRequestStartMessage = {
    type: 'ingress_request_start',
    streamId,
    protocol: 'ws',
    method: request.method,
    path: request.url.split('?')[0] ?? '/',
    query: request.url.includes('?') ? (request.url.split('?')[1] ?? '') : '',
    headers: normalizeHeaders(request.headers)
  };

  agent.socket.send(serializeGatewayMessage(startMessage));

  socket.on('message', (payload, isBinary) => {
    const payloadBuffer = rawDataToBuffer(payload);
    const chunkMessage: IngressRequestChunkMessage = {
      type: 'ingress_request_chunk',
      streamId,
      chunkIndex: state.requestChunkIndex,
      isBinary,
      dataBase64: isBinary ? payloadBuffer.toString('base64') : undefined,
      dataText: isBinary ? undefined : payloadBuffer.toString('utf8')
    };

    state.requestChunkIndex += 1;
    agent.socket.send(serializeGatewayMessage(chunkMessage));

    const data = isBinary ? payloadBuffer : Buffer.from(payloadBuffer.toString('utf8'), 'utf8');
    void persistChunk(state, 'request', chunkMessage.chunkIndex, data, isBinary, null);
  });

  socket.on('close', () => {
    const endMessage: IngressRequestEndMessage = {
      type: 'ingress_request_end',
      streamId
    };

    agent.socket.send(serializeGatewayMessage(endMessage));
    void finalizeStream(streamId, null, null);
  });
}

function rawDataToBuffer(payload: RawData): Buffer {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return Buffer.concat(payload);
  }

  return Buffer.from(payload);
}

async function handleAgentMessage(
  connection: AgentConnection | null,
  message: GatewayMessage
): Promise<void> {
  if (!connection) {
    return;
  }

  switch (message.type) {
    case 'agent_response_start': {
      await onAgentResponseStart(message);
      return;
    }
    case 'agent_response_chunk': {
      await onAgentResponseChunk(message);
      return;
    }
    case 'agent_response_end': {
      await onAgentResponseEnd(message);
      return;
    }
    case 'stream_error': {
      await onStreamError(message);
      return;
    }
    default:
      return;
  }
}

async function onAgentResponseStart(message: AgentResponseStartMessage): Promise<void> {
  const state = streams.get(message.streamId);
  if (!state) {
    return;
  }

  await db
    .update(ingressRequests)
    .set({ statusCode: message.statusCode, responseHeaders: redactHeaders(message.headers) })
    .where(eq(ingressRequests.id, state.requestId));

  if (state.protocol === 'http' && state.reply) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(message.headers)) {
      headers[key] = Array.isArray(value) ? value.join(',') : value;
    }
    state.reply.raw.writeHead(message.statusCode, headers);
  }
}

async function onAgentResponseChunk(message: AgentResponseChunkMessage): Promise<void> {
  const state = streams.get(message.streamId);
  if (!state) {
    return;
  }

  const data = message.isBinary
    ? Buffer.from(message.dataBase64 ?? '', 'base64')
    : Buffer.from(message.dataText ?? '', 'utf8');

  if (state.protocol === 'http' && state.reply) {
    state.reply.raw.write(data);
  }

  if (state.protocol === 'ws' && state.wsSocket) {
    state.wsSocket.send(data, { binary: message.isBinary });
  }

  await persistChunk(state, 'response', message.chunkIndex, data, message.isBinary, null);
}

async function onAgentResponseEnd(message: AgentResponseEndMessage): Promise<void> {
  const state = streams.get(message.streamId);
  if (!state) {
    return;
  }

  if (state.protocol === 'http' && state.reply) {
    state.reply.raw.end();
  }

  if (state.protocol === 'ws' && state.wsSocket) {
    state.wsSocket.close();
  }

  await finalizeStream(message.streamId, null, null);
}

async function onStreamError(message: StreamErrorMessage): Promise<void> {
  const state = streams.get(message.streamId);
  if (!state) {
    return;
  }

  if (state.protocol === 'http' && state.reply) {
    state.reply.raw.statusCode = 502;
    state.reply.raw.end(JSON.stringify({
      error: {
        code: 'UPSTREAM_STREAM_ERROR',
        message: message.message
      }
    }));
  }

  if (state.protocol === 'ws' && state.wsSocket) {
    state.wsSocket.close(1011, message.message);
  }

  await finalizeStream(message.streamId, 502, message.message);
}

async function finalizeStream(
  streamId: string,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  const state = streams.get(streamId);
  if (!state) {
    return;
  }

  const endedAt = new Date();
  const latencyMs = endedAt.getTime() - state.startedAtMs;

  await db
    .update(ingressRequests)
    .set({
      statusCode: statusCode ?? undefined,
      latencyMs,
      endedAt
    })
    .where(eq(ingressRequests.id, state.requestId));

  if (errorMessage) {
    app.log.warn({ streamId, errorMessage }, 'stream error');
  }

  streams.delete(streamId);
}

async function resolveTunnelByHost(host: string) {
  const suffix = `.${env.AGENTJ_TUNNEL_BASE_DOMAIN}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain) {
    return null;
  }

  return db.query.tunnels.findFirst({
    where: eq(tunnels.subdomain, subdomain),
    orderBy: [desc(tunnels.createdAt)]
  });
}

async function persistChunk(
  state: StreamState,
  direction: 'request' | 'response',
  chunkIndex: number,
  chunk: Buffer,
  isBinary: boolean,
  contentType: string | null
): Promise<void> {
  const byteLength = chunk.byteLength;
  const isRequest = direction === 'request';

  if (isRequest) {
    state.requestBytes += byteLength;
  } else {
    state.responseBytes += byteLength;
  }

  const total = isRequest ? state.requestBytes : state.responseBytes;
  const truncated = total > env.AGENTJ_REQUEST_BODY_LIMIT_BYTES;

  if (truncated) {
    if (isRequest && !state.requestTruncated) {
      state.requestTruncated = true;
      await db
        .update(ingressRequests)
        .set({ requestTruncated: true })
        .where(eq(ingressRequests.id, state.requestId));
    }

    if (!isRequest && !state.responseTruncated) {
      state.responseTruncated = true;
      await db
        .update(ingressRequests)
        .set({ responseTruncated: true })
        .where(eq(ingressRequests.id, state.requestId));
    }

    return;
  }

  await db.insert(ingressPayloadChunks).values({
    id: `chk_${randomUUID()}`,
    requestId: state.requestId,
    direction,
    chunkIndex,
    isBinary,
    contentType,
    dataText: isBinary ? null : chunk.toString('utf8'),
    dataBase64: isBinary ? chunk.toString('base64') : null,
    truncated: false
  });
}

async function cleanupOldRequestLogs(): Promise<void> {
  const cutoff = new Date(Date.now() - REQUEST_LOG_RETENTION_MS);

  while (true) {
    const expired = await db
      .select({ id: ingressRequests.id })
      .from(ingressRequests)
      .where(lt(ingressRequests.startedAt, cutoff))
      .orderBy(asc(ingressRequests.startedAt))
      .limit(CLEANUP_BATCH_SIZE);

    if (expired.length === 0) {
      return;
    }

    const ids = expired.map((row) => row.id);
    await db.delete(ingressRequests).where(inArray(ingressRequests.id, ids));

    if (expired.length < CLEANUP_BATCH_SIZE) {
      return;
    }
  }
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    output[key.toLowerCase()] = value;
  }
  return output;
}

function redactHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const normalized = normalizeHeaders(headers);
  for (const key of Object.keys(normalized)) {
    if (REDACT_HEADERS.has(key)) {
      normalized[key] = '[REDACTED]';
    }
  }
  return normalized;
}

const shutdown = async () => {
  await app.close();
  await pool.end();
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

await app.listen({
  host: '0.0.0.0',
  port: env.PORT
});
