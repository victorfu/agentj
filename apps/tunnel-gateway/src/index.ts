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
import { toOutgoingHttpHeaders } from './lib/http-headers.js';
import {
  createAgentHeartbeatState,
  markAgentPingAndShouldClose,
  markAgentPong
} from './lib/agent-heartbeat.js';
import {
  buildTunnelHostContext,
  resolveTunnelSubdomain,
  unknownTunnelClosePayload
} from './lib/tunnel-routing.js';
import { WebSocketSendQueue } from './lib/ws-send.js';

const env = loadGatewayEnv(process.env);

const app = Fastify({
  logger: true,
  disableRequestLogging: true
});

await app.register(websocketPlugin);

// Disable default body parsing so request.raw stays unconsumed for proxy streaming.
app.removeAllContentTypeParsers();
app.addContentTypeParser('*', function (_request, _payload, done) {
  done(null);
});

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
  sendQueue: WebSocketSendQueue;
}

interface StreamState {
  streamId: string;
  tunnelId: string;
  requestId: string;
  reply?: FastifyReply;
  wsSocket?: WebSocket;
  wsSendQueue?: WebSocketSendQueue;
  requestBytes: number;
  responseBytes: number;
  requestChunkIndex: number;
  responseChunkIndex: number;
  requestTruncated: boolean;
  responseTruncated: boolean;
  startedAtMs: number;
  protocol: 'http' | 'ws';
  timeoutHandle?: NodeJS.Timeout;
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

function runSafely(promise: Promise<unknown>, context: string): void {
  promise.catch((error: unknown) => {
    app.log.error({ context, error }, 'async task failed');
  });
}

function createSocketSendQueue(socket: WebSocket): WebSocketSendQueue {
  return new WebSocketSendQueue(socket, {
    highWatermarkBytes: env.AGENTJ_WS_SEND_HIGH_WATERMARK_BYTES,
    timeoutMs: env.AGENTJ_STREAM_TIMEOUT_MS
  });
}

async function sendToAgent(agent: AgentConnection, message: GatewayMessage): Promise<void> {
  await agent.sendQueue.send(serializeGatewayMessage(message));
}

function armStreamTimeout(state: StreamState): void {
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
  }

  state.timeoutHandle = setTimeout(() => {
    runSafely(
      failStream(state.streamId, 504, 'STREAM_TIMEOUT', 'Stream timed out waiting for agent response'),
      `stream_timeout:${state.streamId}`
    );
  }, env.AGENTJ_STREAM_TIMEOUT_MS);
  state.timeoutHandle.unref();
}

function clearStreamTimeout(state: StreamState): void {
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
    state.timeoutHandle = undefined;
  }
}

function failActiveStreamsForTunnel(tunnelId: string, reason: string): void {
  for (const state of streams.values()) {
    if (state.tunnelId !== tunnelId) {
      continue;
    }

    runSafely(failStream(state.streamId, 502, 'TUNNEL_OFFLINE', reason), `fail_stream:${state.streamId}`);
  }
}

setInterval(() => {
  runSafely(cleanupOldRequestLogs(), 'cleanup_old_request_logs');
}, 24 * 60 * 60 * 1000).unref();

app.get('/healthz', async () => {
  await db.execute(sql`select 1`);
  return { ok: true };
});

app.get('/agent/v1/connect', { websocket: true }, (socket, req) => {
  runSafely(handleAgentConnection(socket, req), 'handle_agent_connection');
});

async function handleHttpIngress(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const hostContext = buildTunnelHostContext(request.headers.host, env.AGENTJ_TUNNEL_BASE_DOMAIN);
  const tunnel = await resolveTunnelByHost(hostContext.parsedHost);

  if (!tunnel) {
    app.log.warn(hostContext, 'no tunnel found for ingress host');
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
  armStreamTimeout(state);

  await db.insert(ingressRequests).values({
    id: requestId,
    tunnelId: tunnel.id,
    streamId,
    method: request.method,
    host: hostContext.parsedHost,
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

  try {
    await sendToAgent(agent, startMessage);
  } catch (error) {
    await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
    return;
  }

  for await (const chunk of request.raw) {
    armStreamTimeout(state);
    const buf = Buffer.from(chunk as Buffer);
    const chunkMessage: IngressRequestChunkMessage = {
      type: 'ingress_request_chunk',
      streamId,
      chunkIndex: state.requestChunkIndex,
      isBinary: true,
      dataBase64: buf.toString('base64')
    };

    state.requestChunkIndex += 1;
    try {
      await sendToAgent(agent, chunkMessage);
    } catch (error) {
      await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
      return;
    }

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
  try {
    await sendToAgent(agent, endMessage);
  } catch (error) {
    await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
    return;
  }

  await new Promise<void>((resolve) => {
    reply.raw.once('close', () => resolve());
    reply.raw.once('finish', () => resolve());
  });
}

app.route({
  method: 'GET',
  url: '/*',
  handler: handleHttpIngress,
  wsHandler: (socket, request) => {
    runSafely(handlePublicWebsocket(socket, request), 'handle_public_websocket');
  }
});

app.route({
  method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
  let agentHelloHandled = false;
  let pingSendInFlight = false;
  const agentSendQueue = createSocketSendQueue(socket);
  const heartbeatState = createAgentHeartbeatState(env.AGENTJ_AGENT_MAX_MISSED_PONGS);

  const helloTimeout = setTimeout(() => {
    if (!activeConnection) {
      app.log.warn({ tunnelId: payload.tunnelId, sessionId }, 'agent hello timeout');
      socket.close(4408, 'Agent hello timeout');
    }
  }, env.AGENTJ_AGENT_HELLO_TIMEOUT_MS);
  helloTimeout.unref();

  socket.on('message', (raw) => {
    let message: GatewayMessage;
    try {
      message = parseGatewayMessage(rawDataToBuffer(raw).toString('utf8'));
    } catch (error) {
      app.log.warn({ error }, 'Malformed agent websocket message');
      socket.close(4400, 'Malformed websocket message');
      return;
    }

    runSafely(handleAgentMessage(activeConnection, message), `handle_agent_message:${message.type}`);

    if (message.type === 'agent_hello') {
      if (agentHelloHandled) {
        socket.close(4400, 'Duplicate agent hello');
        return;
      }
      agentHelloHandled = true;
      clearTimeout(helloTimeout);

      runSafely(
        (async () => {
          const foundTunnel = await db.query.tunnels.findFirst({
            where: eq(tunnels.id, payload.tunnelId),
            columns: { id: true }
          });
          const closePayload = unknownTunnelClosePayload(Boolean(foundTunnel));
          if (closePayload) {
            app.log.warn(
              { tunnelId: payload.tunnelId, sessionId },
              'rejecting agent hello: tunnel id not found in gateway db'
            );
            socket.close(closePayload.code, closePayload.reason);
            return;
          }

          // Avoid registering an offline socket as an active tunnel agent.
          if (socket.readyState !== 1) {
            app.log.warn(
              { tunnelId: payload.tunnelId, sessionId },
              'agent socket closed before registration completed'
            );
            return;
          }

          const existing = agentsByTunnel.get(payload.tunnelId);
          if (existing && existing.sessionId !== sessionId) {
            existing.socket.close(4001, 'Superseded by newer agent session');
          }

          activeConnection = {
            tunnelId: payload.tunnelId,
            agentInstanceId: message.agentInstanceId,
            sessionId,
            socket,
            sendQueue: agentSendQueue
          };

          agentsByTunnel.set(payload.tunnelId, activeConnection);

          runSafely(
            db.insert(tunnelSessions).values({
              id: sessionId,
              tunnelId: payload.tunnelId,
              agentInstanceId: message.agentInstanceId
            }),
            `insert_tunnel_session:${sessionId}`
          );

          runSafely(
            db
              .update(tunnels)
              .set({ status: 'online', updatedAt: new Date() })
              .where(eq(tunnels.id, payload.tunnelId)),
            `mark_tunnel_online:${payload.tunnelId}`
          );

          await agentSendQueue.send(
            serializeGatewayMessage({
              type: 'agent_ready',
              tunnelId: payload.tunnelId
            })
          );
        })(),
        `register_agent_hello:${payload.tunnelId}`
      );
    }

    if (message.type === 'pong') {
      markAgentPong(heartbeatState);
      runSafely(
        db
          .update(tunnelSessions)
          .set({ lastHeartbeatAt: new Date() })
          .where(eq(tunnelSessions.id, sessionId)),
        `heartbeat:${sessionId}`
      );
    }
  });

  const pingTimer = setInterval(() => {
    if (!activeConnection) {
      return;
    }

    if (pingSendInFlight) {
      return;
    }

    pingSendInFlight = true;

    runSafely(
      (async () => {
        try {
          await agentSendQueue.send(
            serializeGatewayMessage({
              type: 'ping',
              ts: Date.now()
            })
          );
        } catch (error) {
          app.log.warn({ error, sessionId }, 'failed to send websocket ping');
          return;
        } finally {
          pingSendInFlight = false;
        }

        if (!activeConnection) {
          return;
        }

        if (markAgentPingAndShouldClose(heartbeatState)) {
          app.log.warn(
            { tunnelId: activeConnection.tunnelId, sessionId, missedPongs: heartbeatState.missedPongs },
            'agent heartbeat timeout'
          );
          socket.close(4411, 'Heartbeat timeout');
        }
      })(),
      `send_ping:${sessionId}`
    );
  }, env.AGENTJ_AGENT_PING_INTERVAL_MS);
  pingTimer.unref();

  socket.on('close', () => {
    clearTimeout(helloTimeout);
    clearInterval(pingTimer);

    if (activeConnection) {
      const latest = agentsByTunnel.get(activeConnection.tunnelId);
      if (latest?.sessionId === activeConnection.sessionId) {
        agentsByTunnel.delete(activeConnection.tunnelId);
        failActiveStreamsForTunnel(activeConnection.tunnelId, 'Agent disconnected');

        runSafely(
          db
            .update(tunnels)
            .set({ status: 'offline', updatedAt: new Date() })
            .where(eq(tunnels.id, activeConnection.tunnelId)),
          `mark_tunnel_offline:${activeConnection.tunnelId}`
        );
      }
    }

    runSafely(
      db
        .update(tunnelSessions)
        .set({ disconnectReason: 'socket_closed' })
        .where(eq(tunnelSessions.id, sessionId)),
      `disconnect_session:${sessionId}`
    );
  });
}

async function handlePublicWebsocket(
  socket: WebSocket,
  request: FastifyRequest
): Promise<void> {
  const hostContext = buildTunnelHostContext(request.headers.host, env.AGENTJ_TUNNEL_BASE_DOMAIN);
  const tunnel = await resolveTunnelByHost(hostContext.parsedHost);

  if (!tunnel) {
    app.log.warn(hostContext, 'no tunnel found for websocket host');
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
  const wsSendQueue = createSocketSendQueue(socket);

  const state: StreamState = {
    streamId,
    tunnelId: tunnel.id,
    requestId,
    wsSocket: socket,
    wsSendQueue,
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
  armStreamTimeout(state);

  await db.insert(ingressRequests).values({
    id: requestId,
    tunnelId: tunnel.id,
    streamId,
    method: request.method,
    host: hostContext.parsedHost,
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

  try {
    await sendToAgent(agent, startMessage);
  } catch (error) {
    await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
    return;
  }

  socket.on('message', (payload, isBinary) => {
    runSafely(
      (async () => {
        armStreamTimeout(state);
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
        try {
          await sendToAgent(agent, chunkMessage);
        } catch (error) {
          await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
          return;
        }

        const data = isBinary ? payloadBuffer : Buffer.from(payloadBuffer.toString('utf8'), 'utf8');
        await persistChunk(state, 'request', chunkMessage.chunkIndex, data, isBinary, null);
      })(),
      `handle_public_ws_chunk:${streamId}:${state.requestChunkIndex}`
    );
  });

  socket.on('close', () => {
    runSafely(
      (async () => {
        const endMessage: IngressRequestEndMessage = {
          type: 'ingress_request_end',
          streamId
        };

        try {
          await sendToAgent(agent, endMessage);
        } catch (error) {
          app.log.warn({ error, streamId }, 'failed to forward websocket end to agent');
        }
        await finalizeStream(streamId, null, null);
      })(),
      `finalize_stream:${streamId}`
    );
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
  armStreamTimeout(state);

  if (state.protocol === 'http' && state.reply && !state.reply.raw.headersSent) {
    state.reply.raw.writeHead(message.statusCode, toOutgoingHttpHeaders(message.headers));
  }

  await db
    .update(ingressRequests)
    .set({ statusCode: message.statusCode, responseHeaders: redactHeaders(message.headers) })
    .where(eq(ingressRequests.id, state.requestId));
}

async function onAgentResponseChunk(message: AgentResponseChunkMessage): Promise<void> {
  const state = streams.get(message.streamId);
  if (!state) {
    return;
  }
  armStreamTimeout(state);

  const data = message.isBinary
    ? Buffer.from(message.dataBase64 ?? '', 'base64')
    : Buffer.from(message.dataText ?? '', 'utf8');

  if (state.protocol === 'http' && state.reply) {
    state.reply.raw.write(data);
  }

  if (state.protocol === 'ws' && state.wsSendQueue) {
    try {
      await state.wsSendQueue.send(data, { binary: message.isBinary });
    } catch (error) {
      await failStream(state.streamId, 502, 'UPSTREAM_STREAM_ERROR', (error as Error).message);
      return;
    }
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
  await failStream(message.streamId, 502, 'UPSTREAM_STREAM_ERROR', message.message);
}

async function failStream(
  streamId: string,
  statusCode: number,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  const state = streams.get(streamId);
  if (!state) {
    return;
  }

  if (state.protocol === 'http' && state.reply && !state.reply.raw.writableEnded) {
    state.reply.raw.statusCode = statusCode;
    state.reply.raw.end(JSON.stringify({
      error: {
        code: errorCode,
        message: errorMessage
      }
    }));
  }

  if (
    state.protocol === 'ws' &&
    state.wsSocket &&
    (state.wsSocket.readyState === 0 || state.wsSocket.readyState === 1)
  ) {
    state.wsSocket.close(1011, errorMessage);
  }

  await finalizeStream(streamId, statusCode, errorMessage);
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
  clearStreamTimeout(state);

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
  const subdomain = resolveTunnelSubdomain(host, env.AGENTJ_TUNNEL_BASE_DOMAIN);
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
  runSafely(shutdown(), 'shutdown_sigint');
});

process.on('SIGTERM', () => {
  runSafely(shutdown(), 'shutdown_sigterm');
});

await app.listen({
  host: '0.0.0.0',
  port: env.PORT
});
